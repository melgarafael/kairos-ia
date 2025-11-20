-- Migration: Fix expired tokens plan ID issue
-- When a plan token expires, update organization plan_id to Trial Expired and remove expired tokens
-- Also add attributed_token_id column to track which token is currently assigned

SET search_path = public, auth;

-- 1) Add attributed_token_id column to saas_organizations
ALTER TABLE public.saas_organizations 
ADD COLUMN IF NOT EXISTS attributed_token_id uuid REFERENCES public.saas_plan_tokens(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.saas_organizations.attributed_token_id IS 'ID of the plan token currently attributed to this organization. When a new token is assigned, this field is updated.';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_saas_orgs_attributed_token_id ON public.saas_organizations(attributed_token_id);

-- 2) Create RPC function to check and fix expired tokens
-- This function will:
-- - Find organizations with expired tokens by checking applied_organization_id in saas_plan_tokens
-- - Update their plan_id to Trial Expired
-- - Delete the expired tokens from saas_plan_tokens
CREATE OR REPLACE FUNCTION public.check_and_fix_expired_tokens(p_organization_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trial_expired_id uuid;
  v_org RECORD;
  v_token RECORD;
  v_updated_count int := 0;
  v_deleted_count int := 0;
  v_orgs_updated uuid[] := ARRAY[]::uuid[];
  v_expired_token_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  -- Get Trial Expired plan ID
  SELECT id INTO v_trial_expired_id
  FROM public.saas_plans
  WHERE slug = 'trial_expired'
  LIMIT 1;

  IF v_trial_expired_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Trial Expired plan not found',
      'updated_count', 0,
      'deleted_count', 0
    );
  END IF;

  -- If specific organization_id provided, process only that one
  IF p_organization_id IS NOT NULL THEN
    -- Verify organization exists
    SELECT o.id, o.plan_id
    INTO v_org
    FROM public.saas_organizations o
    WHERE o.id = p_organization_id
    LIMIT 1;

    IF v_org.id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Organization not found',
        'updated_count', 0,
        'deleted_count', 0
      );
    END IF;

    -- Find all expired tokens for this organization
    FOR v_token IN
      SELECT id, plan_id, valid_until, status, applied_organization_id
      FROM public.saas_plan_tokens
      WHERE applied_organization_id = p_organization_id
        AND status = 'redeemed'
        AND valid_until < now()
    LOOP
      -- Collect expired token IDs
      v_expired_token_ids := array_append(v_expired_token_ids, v_token.id);
    END LOOP;

    -- If there are expired tokens, update organization and delete them
    IF array_length(v_expired_token_ids, 1) > 0 THEN
      -- Update organization plan_id to Trial Expired
      UPDATE public.saas_organizations
      SET plan_id = v_trial_expired_id,
          attributed_token_id = NULL,
          updated_at = now()
      WHERE id = v_org.id;

      -- Delete all expired tokens
      DELETE FROM public.saas_plan_tokens
      WHERE id = ANY(v_expired_token_ids);

      v_updated_count := 1;
      v_deleted_count := array_length(v_expired_token_ids, 1);
      v_orgs_updated := ARRAY[v_org.id];
    END IF;
  ELSE
    -- Process all organizations with expired tokens
    -- Check all organizations that have expired tokens, regardless of current plan_id
    FOR v_org IN
      SELECT DISTINCT o.id, o.plan_id
      FROM public.saas_organizations o
      INNER JOIN public.saas_plan_tokens t ON t.applied_organization_id = o.id
      WHERE t.status = 'redeemed'
        AND t.valid_until < now()
    LOOP
      -- Find all expired tokens for this organization
      v_expired_token_ids := ARRAY[]::uuid[];
      FOR v_token IN
        SELECT id
        FROM public.saas_plan_tokens
        WHERE applied_organization_id = v_org.id
          AND status = 'redeemed'
          AND valid_until < now()
      LOOP
        v_expired_token_ids := array_append(v_expired_token_ids, v_token.id);
      END LOOP;

      -- If there are expired tokens, update organization and delete them
      IF array_length(v_expired_token_ids, 1) > 0 THEN
        -- Update organization plan_id to Trial Expired
        UPDATE public.saas_organizations
        SET plan_id = v_trial_expired_id,
            attributed_token_id = NULL,
            updated_at = now()
        WHERE id = v_org.id;

        -- Delete all expired tokens
        DELETE FROM public.saas_plan_tokens
        WHERE id = ANY(v_expired_token_ids);

        v_updated_count := v_updated_count + 1;
        v_deleted_count := v_deleted_count + array_length(v_expired_token_ids, 1);
        v_orgs_updated := array_append(v_orgs_updated, v_org.id);
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'deleted_count', v_deleted_count,
    'organizations_updated', v_orgs_updated
  );
END;
$$;

COMMENT ON FUNCTION public.check_and_fix_expired_tokens IS 'Checks for expired tokens and updates organization plan_id to Trial Expired, then deletes expired tokens. Can process a specific organization or all organizations.';

GRANT EXECUTE ON FUNCTION public.check_and_fix_expired_tokens(uuid) TO authenticated, anon;

-- 3) Also create a function that runs automatically on organization access
-- This will be called when user logs in to check their organization
CREATE OR REPLACE FUNCTION public.check_user_organization_expired_tokens(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id uuid;
  v_result jsonb;
BEGIN
  -- Get user's organization_id
  SELECT organization_id INTO v_org_id
  FROM public.saas_users
  WHERE id = p_user_id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User has no organization',
      'updated_count', 0,
      'deleted_count', 0
    );
  END IF;

  -- Check and fix expired tokens for this organization
  SELECT public.check_and_fix_expired_tokens(v_org_id) INTO v_result;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.check_user_organization_expired_tokens IS 'Checks and fixes expired tokens for the user''s organization. Should be called when user logs in.';

GRANT EXECUTE ON FUNCTION public.check_user_organization_expired_tokens(uuid) TO authenticated, anon;

