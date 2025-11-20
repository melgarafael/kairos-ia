-- Migration: Implement effective plan logic considering token expiry
-- When Starter/PRO plans expire in saas_plan_tokens, treat as Trial Expired

SET search_path = public, auth;

-- Constants for plan IDs
-- Starter: 8b5a1000-957c-4eaf-beca-954a78187337
-- PRO: d4836a79-186f-4905-bfac-77ec52fa1dde
-- Trial Expired: 8441539f-aed4-4fd7-a0df-2768d0ad29d4

-- Function to get effective plan_id for an organization
-- Considers token expiry: if org has Starter/PRO and token is expired, returns Trial Expired
CREATE OR REPLACE FUNCTION public.get_effective_organization_plan(p_organization_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_plan_id uuid;
  v_plan_slug text;
  v_trial_expired_id uuid;
  v_token_valid_until timestamptz;
  v_has_active_token boolean := false;
BEGIN
  -- Get organization's current plan_id
  SELECT plan_id INTO v_plan_id
  FROM public.saas_organizations
  WHERE id = p_organization_id
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get plan slug
  SELECT slug INTO v_plan_slug
  FROM public.saas_plans
  WHERE id = v_plan_id
  LIMIT 1;

  -- Get Trial Expired plan ID
  SELECT id INTO v_trial_expired_id
  FROM public.saas_plans
  WHERE slug = 'trial_expired'
  LIMIT 1;

  -- Only check token expiry for Starter or PRO plans
  -- IMPORTANT: Only apply expiry logic if there's actually a token in saas_plan_tokens
  -- If no token exists, user keeps their original plan (for legacy/vitalício users)
  IF v_plan_id IN (
    '8b5a1000-957c-4eaf-beca-954a78187337'::uuid, -- Starter
    'd4836a79-186f-4905-bfac-77ec52fa1dde'::uuid  -- PRO
  ) THEN
    -- Check if there's a token for this organization
    SELECT valid_until INTO v_token_valid_until
    FROM public.saas_plan_tokens
    WHERE applied_organization_id = p_organization_id
      AND status = 'redeemed'
      AND plan_id = v_plan_id
    ORDER BY applied_at DESC
    LIMIT 1;

    -- Only apply expiry logic if a token actually exists
    -- If no token exists (v_token_valid_until IS NULL), user keeps original plan
    IF v_token_valid_until IS NOT NULL THEN
      -- Token exists: check if it's expired
      IF v_token_valid_until < now() THEN
        -- Token is expired: return Trial Expired plan ID
        IF v_trial_expired_id IS NOT NULL THEN
          RETURN v_trial_expired_id;
        END IF;
      END IF;
      -- If token exists and is NOT expired, fall through to return original plan
    END IF;
    -- If no token exists (v_token_valid_until IS NULL), fall through to return original plan
  END IF;

  -- Return original plan_id if no expiry condition applies
  RETURN v_plan_id;
END;
$$;

COMMENT ON FUNCTION public.get_effective_organization_plan IS 'Returns effective plan_id for an organization. If Starter/PRO plan has expired token, returns Trial Expired plan_id.';

GRANT EXECUTE ON FUNCTION public.get_effective_organization_plan(uuid) TO authenticated, anon;

-- Update get_effective_features to use organization's effective plan when checking via organization
-- This extends the existing logic to consider token expiry
CREATE OR REPLACE FUNCTION public.get_effective_features(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan_id uuid;
  v_plan_effective_id uuid;
  v_org_id uuid;
  v_plan_slug text;
  v_trial_ends_at timestamptz;
  v_defaults jsonb := '{}'::jsonb;
  v_plan jsonb := '{}'::jsonb;
  v_over jsonb := '{}'::jsonb;
  v_features jsonb := '{}'::jsonb;
BEGIN
  SELECT plan_id, organization_id, trial_ends_at
  INTO v_plan_id, v_org_id, v_trial_ends_at
  FROM public.saas_users
  WHERE id = p_user_id
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RETURN jsonb_build_object('features','{}'::jsonb,'plan_id',NULL,'plan_slug',NULL,'organization_id',v_org_id);
  END IF;

  -- If user has an organization, check effective plan considering token expiry
  IF v_org_id IS NOT NULL THEN
    v_plan_effective_id := public.get_effective_organization_plan(v_org_id);
    -- If function returned NULL, fallback to user's plan_id
    IF v_plan_effective_id IS NULL THEN
      v_plan_effective_id := v_plan_id;
    END IF;
  ELSE
    v_plan_effective_id := v_plan_id;
  END IF;

  SELECT slug INTO v_plan_slug FROM public.saas_plans WHERE id = v_plan_effective_id LIMIT 1;

  -- Still check trial expiry from user's trial_ends_at (backward compatibility)
  IF v_plan_slug = 'trial' AND v_trial_ends_at IS NOT NULL AND v_trial_ends_at < now() THEN
    SELECT id INTO v_plan_effective_id FROM public.saas_plans WHERE slug = 'trial_expired' LIMIT 1;
    IF v_plan_effective_id IS NULL THEN
      v_plan_effective_id := v_plan_id; -- safety fallback
    END IF;
    SELECT slug INTO v_plan_slug FROM public.saas_plans WHERE id = v_plan_effective_id LIMIT 1;
  END IF;

  SELECT COALESCE(jsonb_object_agg(key, default_value), '{}'::jsonb)
  INTO v_defaults
  FROM public.saas_features;

  SELECT COALESCE(jsonb_object_agg(feature_key, value), '{}'::jsonb)
  INTO v_plan
  FROM public.saas_plan_features
  WHERE plan_id = v_plan_effective_id;

  IF v_org_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_object_agg(feature_key, value), '{}'::jsonb)
    INTO v_over
    FROM public.saas_org_feature_overrides
    WHERE organization_id = v_org_id
      AND (expires_at IS NULL OR expires_at > now());
  END IF;

  v_features := v_defaults || v_plan || v_over;

  RETURN jsonb_build_object(
    'features', v_features,
    'plan_id', v_plan_effective_id,
    'plan_slug', v_plan_slug,
    'organization_id', v_org_id
  );
END;
$$;

-- Also update get_effective_features_for_org to use token expiry logic
CREATE OR REPLACE FUNCTION public.get_effective_features_for_org(p_user_id uuid, p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id uuid;
  v_plan_id uuid;
  v_plan_effective_id uuid;
  v_master_org_id uuid;
  v_plan_slug text;
  v_trial_ends_at timestamptz;
  v_defaults jsonb := '{}'::jsonb;
  v_plan jsonb := '{}'::jsonb;
  v_over jsonb := '{}'::jsonb;
  v_features jsonb := '{}'::jsonb;
BEGIN
  IF p_organization_id IS NULL THEN
    RETURN public.get_effective_features(p_user_id);
  END IF;

  -- Find owner_id from master mirror
  SELECT owner_id INTO v_owner_id
  FROM public.saas_organizations
  WHERE client_org_id = p_organization_id
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    -- Fallback: try to derive via inviter on membership
    SELECT invited_by INTO v_owner_id
    FROM public.saas_memberships
    WHERE saas_user_id = p_user_id AND organization_id_in_client = p_organization_id
    LIMIT 1;
  END IF;

  IF v_owner_id IS NULL THEN
    -- No owner found, fallback to user features
    RETURN public.get_effective_features(p_user_id);
  END IF;

  -- Get organization ID from master
  SELECT id INTO v_master_org_id
  FROM public.saas_organizations
  WHERE client_org_id = p_organization_id
  LIMIT 1;

  -- Use effective plan considering token expiry
  IF v_master_org_id IS NOT NULL THEN
    v_plan_effective_id := public.get_effective_organization_plan(v_master_org_id);
  END IF;

  -- Fallback: Load owner's plan if effective plan is null
  IF v_plan_effective_id IS NULL THEN
    SELECT plan_id, trial_ends_at INTO v_plan_id, v_trial_ends_at
    FROM public.saas_users
    WHERE id = v_owner_id
    LIMIT 1;

    IF v_plan_id IS NULL THEN
      RETURN jsonb_build_object('features','{}'::jsonb,'plan_id',NULL,'plan_slug',NULL,'organization_id',p_organization_id);
    END IF;

    v_plan_effective_id := v_plan_id;
  END IF;

  SELECT slug INTO v_plan_slug FROM public.saas_plans WHERE id = v_plan_effective_id LIMIT 1;

  -- Check trial expiry from owner's trial_ends_at
  IF v_plan_slug = 'trial' AND v_trial_ends_at IS NOT NULL AND v_trial_ends_at < now() THEN
    SELECT id INTO v_plan_effective_id FROM public.saas_plans WHERE slug = 'trial_expired' LIMIT 1;
    IF v_plan_effective_id IS NULL THEN
      v_plan_effective_id := v_plan_id; -- safety fallback
    END IF;
    SELECT slug INTO v_plan_slug FROM public.saas_plans WHERE id = v_plan_effective_id LIMIT 1;
  END IF;

  -- Defaults + plan + org overrides
  SELECT COALESCE(jsonb_object_agg(key, default_value), '{}'::jsonb)
  INTO v_defaults
  FROM public.saas_features;

  SELECT COALESCE(jsonb_object_agg(feature_key, value), '{}'::jsonb)
  INTO v_plan
  FROM public.saas_plan_features
  WHERE plan_id = v_plan_effective_id;

  SELECT COALESCE(jsonb_object_agg(feature_key, value), '{}'::jsonb)
  INTO v_over
  FROM public.saas_org_feature_overrides
  WHERE organization_id = p_organization_id
    AND (expires_at IS NULL OR expires_at > now());

  v_features := v_defaults || v_plan || v_over;

  RETURN jsonb_build_object(
    'features', v_features,
    'plan_id', v_plan_effective_id,
    'plan_slug', v_plan_slug,
    'organization_id', p_organization_id
  );
END;
$$;

