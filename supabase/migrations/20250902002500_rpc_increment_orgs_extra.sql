-- Safe increment/decrement of organizations_extra
SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.perform_orgs_extra_increment(p_user_id uuid, p_delta int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current int;
  v_new int;
BEGIN
  SELECT organizations_extra INTO v_current FROM public.saas_users WHERE id = p_user_id FOR UPDATE;
  v_current := COALESCE(v_current, 0);
  v_new := GREATEST(0, v_current + COALESCE(p_delta,0));
  UPDATE public.saas_users SET organizations_extra = v_new, updated_at = now() WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.perform_orgs_extra_increment(uuid, int) TO service_role;


