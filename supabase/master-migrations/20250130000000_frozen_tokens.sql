-- Migration: Frozen Tokens System
-- Adds support for frozen tokens that can be "unfrozen" when attributed to an organization
-- Frozen tokens have a license_duration_days (duration in days) that determines their expiration when attributed
-- The duration starts counting from the attribution date

SET search_path = public, auth;

-- Add columns for frozen token functionality
ALTER TABLE public.saas_plan_tokens
  ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS license_duration_days integer;

-- Create index for efficient queries on frozen tokens
CREATE INDEX IF NOT EXISTS idx_spt_is_frozen ON public.saas_plan_tokens(is_frozen);
CREATE INDEX IF NOT EXISTS idx_spt_license_duration_days ON public.saas_plan_tokens(license_duration_days);

-- Add comments for documentation
COMMENT ON COLUMN public.saas_plan_tokens.is_frozen IS 'Indicates if this token is frozen. Frozen tokens need to be "unfrozen" (set to false) when attributed to an organization.';
COMMENT ON COLUMN public.saas_plan_tokens.license_duration_days IS 'Duration in days for frozen tokens. When a frozen token is attributed (is_frozen changes to false), valid_until is calculated as now() + license_duration_days. NULL for non-frozen tokens.';

-- Drop old version of function if it exists (with timestamptz parameter)
DROP FUNCTION IF EXISTS public.calculate_frozen_token_expiration(timestamptz);

-- Function to calculate expiration date based on duration (days from now)
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

-- Trigger function to handle frozen token attribution
-- When is_frozen changes from true to false, calculate valid_until based on license_duration_days
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

-- Create trigger to automatically calculate expiration when frozen token is attributed
DROP TRIGGER IF EXISTS trg_frozen_token_attribution ON public.saas_plan_tokens;
CREATE TRIGGER trg_frozen_token_attribution
  BEFORE UPDATE ON public.saas_plan_tokens
  FOR EACH ROW
  WHEN (OLD.is_frozen IS DISTINCT FROM NEW.is_frozen)
  EXECUTE FUNCTION public.handle_frozen_token_attribution();

-- Drop old version of function if it exists (with license_deadline parameter)
DROP FUNCTION IF EXISTS public.update_frozen_token(uuid, boolean, timestamptz);

-- RPC function for admins to update frozen token status and license duration
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

