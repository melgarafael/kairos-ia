/*
  Make session RPCs idempotent with UPSERT to avoid unique violations on token_hash
*/

-- start_session: upsert by token_hash
CREATE OR REPLACE FUNCTION public.start_session(
  p_token text,
  p_refresh_token text,
  p_expires_at timestamptz,
  p_ip inet,
  p_user_agent text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_token_hash text := encode(digest(p_token, 'sha256'), 'hex');
  v_refresh_token_hash text := encode(digest(p_refresh_token, 'sha256'), 'hex');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.saas_sessions (user_id, token_hash, refresh_token_hash, expires_at, ip_address, user_agent, active, created_at, last_seen_at)
  VALUES (v_user_id, v_token_hash, v_refresh_token_hash, p_expires_at, p_ip, p_user_agent, true, now(), now())
  ON CONFLICT (token_hash) DO UPDATE SET
    refresh_token_hash = EXCLUDED.refresh_token_hash,
    expires_at = EXCLUDED.expires_at,
    ip_address = EXCLUDED.ip_address,
    user_agent = EXCLUDED.user_agent,
    active = true,
    last_seen_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- refresh_session: update by old hash when provided; otherwise upsert by new hash
CREATE OR REPLACE FUNCTION public.refresh_session(
  p_old_token text,
  p_new_token text,
  p_new_refresh_token text,
  p_new_expires_at timestamptz,
  p_ip inet,
  p_user_agent text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_old_hash text := CASE WHEN p_old_token IS NULL THEN NULL ELSE encode(digest(p_old_token, 'sha256'), 'hex') END;
  v_new_hash text := encode(digest(p_new_token, 'sha256'), 'hex');
  v_new_refresh_hash text := encode(digest(p_new_refresh_token, 'sha256'), 'hex');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_old_hash IS NOT NULL THEN
    UPDATE public.saas_sessions
    SET token_hash = v_new_hash,
        refresh_token_hash = v_new_refresh_hash,
        expires_at = p_new_expires_at,
        ip_address = p_ip,
        user_agent = p_user_agent,
        active = true,
        last_seen_at = now()
    WHERE user_id = v_user_id AND token_hash = v_old_hash
    RETURNING id INTO v_id;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.saas_sessions (user_id, token_hash, refresh_token_hash, expires_at, ip_address, user_agent, active, created_at, last_seen_at)
    VALUES (v_user_id, v_new_hash, v_new_refresh_hash, p_new_expires_at, p_ip, p_user_agent, true, now(), now())
    ON CONFLICT (token_hash) DO UPDATE SET
      refresh_token_hash = EXCLUDED.refresh_token_hash,
      expires_at = EXCLUDED.expires_at,
      ip_address = EXCLUDED.ip_address,
      user_agent = EXCLUDED.user_agent,
      active = true,
      last_seen_at = now()
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;


