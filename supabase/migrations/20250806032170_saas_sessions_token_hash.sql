/*
  Strengthen saas_sessions by storing only token hashes.
  - Adds token_hash, refresh_token_hash
  - Backfills from existing plaintext columns
  - Replaces RPCs to use hashes
  - Drops plaintext columns and old indexes
*/

-- Ensure pgcrypto for digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add new columns if not present
ALTER TABLE public.saas_sessions
  ADD COLUMN IF NOT EXISTS token_hash text,
  ADD COLUMN IF NOT EXISTS refresh_token_hash text;

-- Backfill hashes from existing plaintext tokens (one-time)
UPDATE public.saas_sessions
SET token_hash = COALESCE(token_hash, encode(digest(token, 'sha256'), 'hex')),
    refresh_token_hash = COALESCE(refresh_token_hash, encode(digest(refresh_token, 'sha256'), 'hex'))
WHERE (token IS NOT NULL OR refresh_token IS NOT NULL);

-- Indexes and constraints on hashes
DROP INDEX IF EXISTS saas_sessions_token_idx;
CREATE UNIQUE INDEX IF NOT EXISTS saas_sessions_token_hash_uidx ON public.saas_sessions(token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS saas_sessions_refresh_token_hash_uidx ON public.saas_sessions(refresh_token_hash);

-- Replace RPCs to use hashes only
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
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

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
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_session(
  p_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rows int;
  v_hash text := encode(digest(p_token, 'sha256'), 'hex');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.saas_sessions
  SET active = false,
      ended_at = now(),
      last_seen_at = now()
  WHERE user_id = v_user_id AND token_hash = v_hash AND active = true;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- Finally, drop plaintext columns to eliminate sensitive data at rest
ALTER TABLE public.saas_sessions
  DROP COLUMN IF EXISTS token,
  DROP COLUMN IF EXISTS refresh_token;


