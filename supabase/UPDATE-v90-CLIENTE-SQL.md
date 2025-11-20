BEGIN;

-- 0. CRIAR A TABELA SE NÃO EXISTIR
CREATE TABLE IF NOT EXISTS public.manychat_credentials (
  organization_id uuid PRIMARY KEY,
  user_id uuid,
  api_key text,
  tag_resposta_id text,
  tag_resposta_nome text,
  field_resposta_id text,
  field_resposta_nome text,
  flow_ns text,
  flow_nome text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 1. ADICIONAR COLUNAS PARA METADADOS DO MANYCHAT (idempotente)
ALTER TABLE public.manychat_credentials
  ADD COLUMN IF NOT EXISTS tag_resposta_id text,
  ADD COLUMN IF NOT EXISTS tag_resposta_nome text,
  ADD COLUMN IF NOT EXISTS field_resposta_id text,
  ADD COLUMN IF NOT EXISTS field_resposta_nome text,
  ADD COLUMN IF NOT EXISTS flow_ns text,
  ADD COLUMN IF NOT EXISTS flow_nome text;

-- 2. FUNÇÃO PARA INSERIR/ATUALIZAR TUDO DE UMA VEZ
CREATE OR REPLACE FUNCTION public.manychat_credentials_upsert_full(
  p_organization_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_api_key text DEFAULT NULL,
  p_tag_resposta_id text DEFAULT NULL,
  p_tag_resposta_nome text DEFAULT NULL,
  p_field_resposta_id text DEFAULT NULL,
  p_field_resposta_nome text DEFAULT NULL,
  p_flow_ns text DEFAULT NULL,
  p_flow_nome text DEFAULT NULL
) RETURNS public.manychat_credentials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.manychat_credentials;
  v_org uuid := p_organization_id;
  v_user uuid := coalesce(p_user_id, auth.uid());
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;

  PERFORM set_config('app.organization_id', v_org::text, true);

  INSERT INTO public.manychat_credentials (
    organization_id,
    user_id,
    api_key,
    tag_resposta_id,
    tag_resposta_nome,
    field_resposta_id,
    field_resposta_nome,
    flow_ns,
    flow_nome,
    created_at,
    updated_at
  ) VALUES (
    v_org,
    v_user,
    nullif(btrim(coalesce(p_api_key, '')), ''),
    nullif(btrim(coalesce(p_tag_resposta_id, '')), ''),
    nullif(btrim(coalesce(p_tag_resposta_nome, '')), ''),
    nullif(btrim(coalesce(p_field_resposta_id, '')), ''),
    nullif(btrim(coalesce(p_field_resposta_nome, '')), ''),
    nullif(btrim(coalesce(p_flow_ns, '')), ''),
    nullif(btrim(coalesce(p_flow_nome, '')), ''),
    now(),
    now()
  )
  ON CONFLICT (organization_id) DO UPDATE
    SET user_id = coalesce(excluded.user_id, manychat_credentials.user_id),
        api_key = coalesce(excluded.api_key, manychat_credentials.api_key),
        tag_resposta_id = coalesce(excluded.tag_resposta_id, manychat_credentials.tag_resposta_id),
        tag_resposta_nome = coalesce(excluded.tag_resposta_nome, manychat_credentials.tag_resposta_nome),
        field_resposta_id = coalesce(excluded.field_resposta_id, manychat_credentials.field_resposta_id),
        field_resposta_nome = coalesce(excluded.field_resposta_nome, manychat_credentials.field_resposta_nome),
        flow_ns = coalesce(excluded.flow_ns, manychat_credentials.flow_ns),
        flow_nome = coalesce(excluded.flow_nome, manychat_credentials.flow_nome),
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- 3. FUNÇÃO PARA BUSCAR AS CONFIGURAÇÕES DO MANYCHAT
CREATE OR REPLACE FUNCTION public.manychat_credentials_get(
  p_organization_id uuid DEFAULT NULL
) RETURNS public.manychat_credentials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := coalesce(
    p_organization_id,
    NULLIF(current_setting('app.organization_id', true), '')::uuid
  );
  v_row public.manychat_credentials;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;

  PERFORM set_config('app.organization_id', v_org::text, true);

  SELECT *
    INTO v_row
    FROM public.manychat_credentials
   WHERE organization_id = v_org
   LIMIT 1;

  RETURN v_row;
END;
$$;

-- 4. GRANTS (idempotente)
DO $$
BEGIN
  -- Grant execute for upsert
  BEGIN
    GRANT EXECUTE ON FUNCTION public.manychat_credentials_upsert_full(
      uuid, uuid, text, text, text, text, text, text, text
    ) TO anon;
  EXCEPTION WHEN others THEN
    -- ignore
  END;

  BEGIN
    GRANT EXECUTE ON FUNCTION public.manychat_credentials_upsert_full(
      uuid, uuid, text, text, text, text, text, text, text
    ) TO authenticated;
  EXCEPTION WHEN others THEN
  END;

  BEGIN
    GRANT EXECUTE ON FUNCTION public.manychat_credentials_upsert_full(
      uuid, uuid, text, text, text, text, text, text, text
    ) TO service_role;
  EXCEPTION WHEN others THEN
  END;

  -- Grant execute for get
  BEGIN
    GRANT EXECUTE ON FUNCTION public.manychat_credentials_get(uuid) TO anon;
  EXCEPTION WHEN others THEN
  END;

  BEGIN
    GRANT EXECUTE ON FUNCTION public.manychat_credentials_get(uuid) TO authenticated;
  EXCEPTION WHEN others THEN
  END;

  BEGIN
    GRANT EXECUTE ON FUNCTION public.manychat_credentials_get(uuid) TO service_role;
  EXCEPTION WHEN others THEN
  END;
END$$;

COMMIT;

-- Registrar versão (remova esta parte se public.app_migrations não existir)
INSERT INTO public.app_migrations (version, applied_at)
VALUES ('90', now())
ON CONFLICT (version) DO NOTHING;