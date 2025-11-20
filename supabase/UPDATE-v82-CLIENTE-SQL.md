-- v82 – Trail Notes: Sistema de anotações para trilhas
-- 
-- Esta migration cria a estrutura para que usuários possam fazer anotações
-- sobre as aulas das trilhas (Monetização, n8n, Multi Agentes).
--
-- Design: Filosofia Apple (simplicidade, clareza, profundidade)
-- Funcionalidades: Criar, editar, deletar notas por aula; auto-save

SET search_path = public, auth;

BEGIN;

-- 1) Tabela de notas por trilha, organização e aula
CREATE TABLE IF NOT EXISTS public.trail_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  trail_type text NOT NULL CHECK (trail_type IN ('monetization', 'n8n', 'multi-agents')),
  lesson_key text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trail_notes_org_trail_lesson_unique UNIQUE (organization_id, trail_type, lesson_key)
);

-- 2) Índices para performance
CREATE INDEX IF NOT EXISTS idx_trail_notes_org_trail 
  ON public.trail_notes (organization_id, trail_type);

CREATE INDEX IF NOT EXISTS idx_trail_notes_lesson_key 
  ON public.trail_notes (lesson_key);

CREATE INDEX IF NOT EXISTS idx_trail_notes_updated_at 
  ON public.trail_notes (updated_at DESC);

-- 3) Trigger para updated_at
CREATE OR REPLACE FUNCTION public.trail_notes_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trail_notes_set_updated_at_trigger ON public.trail_notes;
CREATE TRIGGER trail_notes_set_updated_at_trigger
  BEFORE UPDATE ON public.trail_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.trail_notes_set_updated_at();

-- 4) RLS por organização
ALTER TABLE public.trail_notes ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='trail_notes' AND policyname='trail_notes_select_ctx'
  ) THEN
    DROP POLICY trail_notes_select_ctx ON public.trail_notes;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='trail_notes' AND policyname='trail_notes_modify_ctx'
  ) THEN
    DROP POLICY trail_notes_modify_ctx ON public.trail_notes;
  END IF;
END $$;

-- Política de leitura: aceita header OU GUC
CREATE POLICY trail_notes_select_ctx ON public.trail_notes
  FOR SELECT
  TO anon, authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id::text = COALESCE(
      NULLIF(current_setting('request.header.x-organization-id', true), ''),
      NULLIF(current_setting('app.organization_id', true), '')
    )
  );

-- Política de modificação: aceita header OU GUC
CREATE POLICY trail_notes_modify_ctx ON public.trail_notes
  FOR ALL
  TO anon, authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id::text = COALESCE(
      NULLIF(current_setting('request.header.x-organization-id', true), ''),
      NULLIF(current_setting('app.organization_id', true), '')
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id::text = COALESCE(
      NULLIF(current_setting('request.header.x-organization-id', true), ''),
      NULLIF(current_setting('app.organization_id', true), '')
    )
  );

-- 5) RPC: Obter nota de uma aula específica
CREATE OR REPLACE FUNCTION public.trail_notes_get(
  p_organization_id uuid,
  p_trail_type text,
  p_lesson_key text
)
RETURNS TABLE (
  id uuid,
  content text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  RETURN QUERY
  SELECT 
    tn.id,
    tn.content,
    tn.created_at,
    tn.updated_at
  FROM public.trail_notes tn
  WHERE tn.organization_id = p_organization_id
    AND tn.trail_type = p_trail_type
    AND tn.lesson_key = p_lesson_key
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trail_notes_get(uuid, text, text) TO authenticated, anon;

-- 6) RPC: Upsert de nota (criar ou atualizar)
CREATE OR REPLACE FUNCTION public.trail_notes_upsert(
  p_organization_id uuid,
  p_trail_type text,
  p_lesson_key text,
  p_content text
)
RETURNS public.trail_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_row public.trail_notes;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  INSERT INTO public.trail_notes (
    organization_id,
    trail_type,
    lesson_key,
    content
  )
  VALUES (
    p_organization_id,
    p_trail_type,
    p_lesson_key,
    COALESCE(p_content, '')
  )
  ON CONFLICT (organization_id, trail_type, lesson_key) 
  DO UPDATE SET
    content = EXCLUDED.content,
    updated_at = now()
  RETURNING * INTO v_row;
  
  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trail_notes_upsert(uuid, text, text, text) TO authenticated, anon;

-- 7) RPC: Deletar nota
CREATE OR REPLACE FUNCTION public.trail_notes_delete(
  p_organization_id uuid,
  p_trail_type text,
  p_lesson_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_deleted int;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  DELETE FROM public.trail_notes
  WHERE organization_id = p_organization_id
    AND trail_type = p_trail_type
    AND lesson_key = p_lesson_key;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN v_deleted > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trail_notes_delete(uuid, text, text) TO authenticated, anon;

COMMIT;

-- Marcar versão
INSERT INTO public.app_migrations (version, applied_at)
VALUES ('82', now())
ON CONFLICT (version) DO NOTHING;

