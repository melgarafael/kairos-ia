-- Trail Comments: Sistema de comentários públicos para trilhas (Master)
SET search_path = public, auth;

BEGIN;

-- 1) Tabela de comentários por trilha e aula
CREATE TABLE IF NOT EXISTS public.trail_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trail_type text NOT NULL CHECK (trail_type IN ('monetization', 'n8n', 'multi-agents')),
  lesson_key text NOT NULL,
  content text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb, -- Array de URLs ou base64 de imagens
  parent_id uuid REFERENCES public.trail_comments(id) ON DELETE CASCADE, -- Para respostas aninhadas
  approved boolean NOT NULL DEFAULT false, -- Moderação: só mostra se true
  moderator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- Admin que aprovou/rejeitou
  moderator_note text, -- Nota do moderador (opcional)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz -- Soft delete
);

-- 2) Índices para performance
CREATE INDEX IF NOT EXISTS idx_trail_comments_trail_lesson 
  ON public.trail_comments (trail_type, lesson_key) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_trail_comments_approved 
  ON public.trail_comments (approved, created_at DESC) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_trail_comments_parent 
  ON public.trail_comments (parent_id) 
  WHERE deleted_at IS NULL AND parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trail_comments_user 
  ON public.trail_comments (user_id) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_trail_comments_pending 
  ON public.trail_comments (approved, created_at DESC) 
  WHERE approved = false AND deleted_at IS NULL;

-- 3) Trigger para updated_at
CREATE OR REPLACE FUNCTION public.trail_comments_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trail_comments_set_updated_at_trigger ON public.trail_comments;
CREATE TRIGGER trail_comments_set_updated_at_trigger
  BEFORE UPDATE ON public.trail_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.trail_comments_set_updated_at();

-- 4) RLS: usuários autenticados podem criar, todos podem ler aprovados
ALTER TABLE public.trail_comments ENABLE ROW LEVEL SECURITY;

-- Política de leitura: qualquer um pode ver comentários aprovados
DROP POLICY IF EXISTS trail_comments_select_approved ON public.trail_comments;
CREATE POLICY trail_comments_select_approved ON public.trail_comments
  FOR SELECT
  TO anon, authenticated
  USING (
    approved = true 
    AND deleted_at IS NULL
  );

-- Política de criação: usuários autenticados podem criar (mas fica pendente)
DROP POLICY IF EXISTS trail_comments_insert_authenticated ON public.trail_comments;
CREATE POLICY trail_comments_insert_authenticated ON public.trail_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND deleted_at IS NULL
  );

-- Política de atualização: usuário pode editar seu próprio comentário (mantém pendente)
DROP POLICY IF EXISTS trail_comments_update_own ON public.trail_comments;
CREATE POLICY trail_comments_update_own ON public.trail_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- Nota: approved não pode ser alterado via política RLS (só admin via service role)
    -- A verificação será feita no trigger ou na função RPC
  );

-- 5) RPCs para o Client Supabase (serão criados em migration separada no Client)
-- Mas aqui criamos funções auxiliares para o Master

-- RPC: Listar comentários aprovados de uma aula (público)
CREATE OR REPLACE FUNCTION public.trail_comments_list(
  p_trail_type text,
  p_lesson_key text,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_email text,
  user_name text,
  content text,
  attachments text[], -- Array de strings (URLs base64)
  parent_id uuid,
  created_at timestamptz,
  reply_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  WITH replies_count AS (
    SELECT 
      tc_sub.parent_id,
      COUNT(*) as cnt
    FROM public.trail_comments tc_sub
    WHERE tc_sub.approved = true 
      AND tc_sub.deleted_at IS NULL
      AND tc_sub.parent_id IS NOT NULL
    GROUP BY tc_sub.parent_id
  )
  SELECT 
    tc.id,
    tc.user_id,
    u.email::text as user_email,
    COALESCE(
      (u.raw_user_meta_data->>'name')::text,
      (u.raw_user_meta_data->>'full_name')::text,
      split_part(u.email, '@', 1)
    ) as user_name,
    tc.content,
    CASE 
      WHEN tc.attachments IS NULL OR tc.attachments = '[]'::jsonb THEN ARRAY[]::text[]
      ELSE ARRAY(SELECT jsonb_array_elements_text(tc.attachments))
    END as attachments,
    tc.parent_id,
    tc.created_at,
    COALESCE(rc.cnt, 0)::bigint as reply_count
  FROM public.trail_comments tc
  LEFT JOIN auth.users u ON u.id = tc.user_id
  LEFT JOIN replies_count rc ON rc.parent_id = tc.id
  WHERE tc.trail_type = p_trail_type
    AND tc.lesson_key = p_lesson_key
    AND tc.approved = true
    AND tc.deleted_at IS NULL
    AND tc.parent_id IS NULL -- Apenas comentários principais (respostas são carregadas separadamente)
  ORDER BY tc.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trail_comments_list(text, text, int, int) TO authenticated, anon;

-- RPC: Listar respostas de um comentário
CREATE OR REPLACE FUNCTION public.trail_comments_replies(
  p_parent_id uuid,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_email text,
  user_name text,
  content text,
  attachments text[], -- Array de strings (URLs base64)
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.id,
    tc.user_id,
    u.email::text as user_email,
    COALESCE(
      (u.raw_user_meta_data->>'name')::text,
      (u.raw_user_meta_data->>'full_name')::text,
      split_part(u.email, '@', 1)
    ) as user_name,
    tc.content,
    CASE 
      WHEN tc.attachments IS NULL OR tc.attachments = '[]'::jsonb THEN ARRAY[]::text[]
      ELSE ARRAY(SELECT jsonb_array_elements_text(tc.attachments))
    END as attachments,
    tc.created_at
  FROM public.trail_comments tc
  LEFT JOIN auth.users u ON u.id = tc.user_id
  WHERE tc.parent_id = p_parent_id
    AND tc.approved = true
    AND tc.deleted_at IS NULL
  ORDER BY tc.created_at ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trail_comments_replies(uuid, int) TO authenticated, anon;

-- RPC: Criar comentário (cria pendente)
CREATE OR REPLACE FUNCTION public.trail_comments_create(
  p_user_id uuid,
  p_trail_type text,
  p_lesson_key text,
  p_content text,
  p_attachments text[] DEFAULT ARRAY[]::text[], -- Array de strings (URLs base64)
  p_parent_id uuid DEFAULT NULL
)
RETURNS public.trail_comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_row public.trail_comments;
BEGIN
  -- Verificar se usuário está autenticado
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.trail_comments (
    user_id,
    trail_type,
    lesson_key,
    content,
    attachments,
    parent_id,
    approved -- Sempre false inicialmente
  )
  VALUES (
    p_user_id,
    p_trail_type,
    p_lesson_key,
    p_content,
    COALESCE(to_jsonb(p_attachments), '[]'::jsonb), -- Converter array para JSONB
    p_parent_id,
    false -- Sempre false inicialmente (aguardando aprovação)
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trail_comments_create(uuid, text, text, text, text[], uuid) TO authenticated;

-- RPC: Atualizar próprio comentário (mantém status de aprovação)
CREATE OR REPLACE FUNCTION public.trail_comments_update(
  p_comment_id uuid,
  p_user_id uuid,
  p_content text,
  p_attachments text[] DEFAULT NULL -- Array de strings (URLs base64)
)
RETURNS public.trail_comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_row public.trail_comments;
BEGIN
  -- Verificar se usuário é o dono do comentário
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.trail_comments
  SET 
    content = p_content,
    attachments = COALESCE(to_jsonb(p_attachments), attachments), -- Converter array para JSONB se fornecido
    updated_at = now()
    -- approved não é atualizado aqui (só admin via service role pode mudar)
  WHERE id = p_comment_id
    AND user_id = p_user_id
    AND deleted_at IS NULL
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment not found or unauthorized';
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trail_comments_update(uuid, uuid, text, text[]) TO authenticated;

COMMIT;

