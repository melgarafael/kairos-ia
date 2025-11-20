-- Fix: Corrige ambiguidade de parent_id na função trail_comments_list
SET search_path = public, auth;

BEGIN;

-- Recriar a função com a correção da ambiguidade
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

COMMIT;

