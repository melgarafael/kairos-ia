/*
  # SaaS Sessions tracking (Master Supabase)

  This migration assumes the table `saas_sessions` already exists.
  It hardens RLS policies and provides RPC helpers to start/refresh/end sessions,
  plus a maintenance function to deactivate expired sessions.
*/

-- Ensure helpful columns exist
ALTER TABLE IF EXISTS saas_sessions
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

-- Enable RLS
ALTER TABLE IF EXISTS saas_sessions ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to be idempotent
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'saas_sessions' AND policyname = 'Users can view own sessions'
  ) THEN
    EXECUTE 'DROP POLICY "Users can view own sessions" ON public.saas_sessions';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'saas_sessions' AND policyname = 'Users can update own sessions'
  ) THEN
    EXECUTE 'DROP POLICY "Users can update own sessions" ON public.saas_sessions';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'saas_sessions' AND policyname = 'Users can insert own session'
  ) THEN
    EXECUTE 'DROP POLICY "Users can insert own session" ON public.saas_sessions';
  END IF;
END $$;

CREATE POLICY "Users can view own sessions"
ON public.saas_sessions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update own sessions"
ON public.saas_sessions FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own session"
ON public.saas_sessions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Helpful indexes
CREATE INDEX IF NOT EXISTS saas_sessions_user_id_idx ON public.saas_sessions(user_id);
CREATE INDEX IF NOT EXISTS saas_sessions_expires_at_idx ON public.saas_sessions(expires_at);
CREATE INDEX IF NOT EXISTS saas_sessions_active_idx ON public.saas_sessions(active);

-- RPC: start_session
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.saas_sessions (user_id, token, refresh_token, expires_at, ip_address, user_agent, active, created_at, last_seen_at)
  VALUES (v_user_id, p_token, p_refresh_token, p_expires_at, p_ip, p_user_agent, true, now(), now())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- RPC: refresh_session
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.saas_sessions
  SET token = p_new_token,
      refresh_token = p_new_refresh_token,
      expires_at = p_new_expires_at,
      ip_address = p_ip,
      user_agent = p_user_agent,
      active = true,
      last_seen_at = now()
  WHERE user_id = v_user_id AND token = p_old_token
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    -- If not found, start a new one
    INSERT INTO public.saas_sessions (user_id, token, refresh_token, expires_at, ip_address, user_agent, active, created_at, last_seen_at)
    VALUES (v_user_id, p_new_token, p_new_refresh_token, p_new_expires_at, p_ip, p_user_agent, true, now(), now())
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- RPC: end_session
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.saas_sessions
  SET active = false,
      ended_at = now(),
      last_seen_at = now()
  WHERE user_id = v_user_id AND token = p_token AND active = true;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- Maintenance: deactivate expired sessions
CREATE OR REPLACE FUNCTION public.deactivate_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows int;
BEGIN
  UPDATE public.saas_sessions
  SET active = false,
      ended_at = COALESCE(ended_at, now())
  WHERE active = true AND expires_at < now();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;



