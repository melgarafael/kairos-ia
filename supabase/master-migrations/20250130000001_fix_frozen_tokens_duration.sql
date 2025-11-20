-- Migration: Fix Frozen Tokens to use duration (days) instead of fixed date
-- Frozen tokens should store a duration (e.g., 30 days) that starts counting from attribution date
-- This migration handles the case where license_deadline exists and needs to be converted

SET search_path = public, auth;

-- Ensure license_duration_days column exists (in case first migration wasn't applied yet)
ALTER TABLE public.saas_plan_tokens
  ADD COLUMN IF NOT EXISTS license_duration_days integer;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_spt_license_duration_days ON public.saas_plan_tokens(license_duration_days);

-- Migrate existing data: if license_deadline exists, calculate days from now
-- Only migrate if license_duration_days is NULL (to avoid overwriting existing data)
DO $$
BEGIN
  -- Check if license_deadline column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'saas_plan_tokens' 
    AND column_name = 'license_deadline'
  ) THEN
    -- Migrate frozen tokens with license_deadline to license_duration_days
    UPDATE public.saas_plan_tokens
    SET license_duration_days = GREATEST(1, EXTRACT(EPOCH FROM (license_deadline - now())) / 86400)::integer
    WHERE is_frozen = true 
      AND license_deadline IS NOT NULL 
      AND license_duration_days IS NULL;
    
    -- Drop old column and index
    DROP INDEX IF EXISTS idx_spt_license_deadline;
    ALTER TABLE public.saas_plan_tokens DROP COLUMN IF EXISTS license_deadline;
  END IF;
END $$;

-- Set default to 30 days for frozen tokens without duration
UPDATE public.saas_plan_tokens
SET license_duration_days = 30
WHERE is_frozen = true AND license_duration_days IS NULL;

-- Update comments
COMMENT ON COLUMN public.saas_plan_tokens.license_duration_days IS 'Duration in days for frozen tokens. When a frozen token is attributed (is_frozen changes to false), valid_until is calculated as now() + license_duration_days. NULL for non-frozen tokens.';

-- Drop old version of function if it exists (with timestamptz parameter)
DROP FUNCTION IF EXISTS public.calculate_frozen_token_expiration(timestamptz);

-- Update function to calculate expiration based on duration (days from now)
CREATE OR REPLACE FUNCTION public.calculate_frozen_token_expiration(
  p_license_duration_days integer
)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_expiration timestamptz;
BEGIN
  -- If duration is NULL or invalid, return NULL
  IF p_license_duration_days IS NULL OR p_license_duration_days <= 0 THEN
    RETURN NULL;
  END IF;

  -- Calculate expiration as now() + duration days
  v_expiration := now() + (p_license_duration_days || ' days')::interval;

  RETURN v_expiration;
END;
$$;

-- Update trigger function to use duration instead of deadline
CREATE OR REPLACE FUNCTION public.handle_frozen_token_attribution()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_expiration timestamptz;
BEGIN
  -- Check if token is being unfrozen (is_frozen changed from true to false)
  IF OLD.is_frozen = true AND NEW.is_frozen = false THEN
    -- Token is being attributed, calculate expiration based on license_duration_days
    IF NEW.license_duration_days IS NOT NULL AND NEW.license_duration_days > 0 THEN
      v_expiration := public.calculate_frozen_token_expiration(NEW.license_duration_days);
      NEW.valid_until := v_expiration;
    ELSE
      -- If license_duration_days is NULL or invalid, use default 30 days
      NEW.valid_until := now() + interval '30 days';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop old version of function if it exists (with license_deadline parameter)
DROP FUNCTION IF EXISTS public.update_frozen_token(uuid, boolean, timestamptz);

-- Update RPC function to use duration instead of deadline
CREATE OR REPLACE FUNCTION public.update_frozen_token(
  p_token_id uuid,
  p_is_frozen boolean,
  p_license_duration_days integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_token public.saas_plan_tokens;
BEGIN
  -- Validate inputs
  IF p_token_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token ID is required');
  END IF;

  -- Load token
  SELECT * INTO v_token
  FROM public.saas_plan_tokens
  WHERE id = p_token_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token not found');
  END IF;

  -- Validate: if marking as frozen, license_duration_days should be provided and positive
  IF p_is_frozen = true AND (p_license_duration_days IS NULL OR p_license_duration_days <= 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'License duration (days) is required and must be positive when marking token as frozen');
  END IF;

  -- Validate: if not frozen, license_duration_days should be NULL
  IF p_is_frozen = false AND p_license_duration_days IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'License duration should be NULL for non-frozen tokens');
  END IF;

  -- Update token
  UPDATE public.saas_plan_tokens
  SET 
    is_frozen = p_is_frozen,
    license_duration_days = p_license_duration_days,
    updated_at = now()
  WHERE id = p_token_id;

  -- Reload updated token to return full details
  SELECT * INTO v_token
  FROM public.saas_plan_tokens
  WHERE id = p_token_id;

  RETURN jsonb_build_object(
    'success', true,
    'token_id', p_token_id,
    'is_frozen', p_is_frozen,
    'license_duration_days', p_license_duration_days,
    'valid_until', v_token.valid_until
  );
END;
$$;

-- Specify full function signature in COMMENT to avoid ambiguity
COMMENT ON FUNCTION public.update_frozen_token(uuid, boolean, integer) IS 'Admin function to update frozen token status and license duration. When is_frozen is set to false, the trigger will automatically calculate valid_until as now() + license_duration_days.';

