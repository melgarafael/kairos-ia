-- Fix: get_effective_features_for_org should use get_effective_organization_plan
-- to properly handle token expiry for PRO/Starter plans
-- This ensures that accounts with PRO plan don't fall back to trial when tokens are expired
SET search_path = public, auth;

-- Update get_effective_features_for_org to use get_effective_organization_plan
-- This ensures token expiry logic is properly applied
CREATE OR REPLACE FUNCTION public.get_effective_features_for_org(p_user_id uuid, p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_master_id uuid;
  v_plan_id uuid;
  v_plan_effective_id uuid;
  v_plan_slug text;
  v_plan_effective_slug text;
  v_trial_ends_at timestamptz;
  v_defaults jsonb := '{}'::jsonb;
  v_plan jsonb := '{}'::jsonb;
  v_over jsonb := '{}'::jsonb;
  v_features jsonb := '{}'::jsonb;
BEGIN
  IF p_organization_id IS NULL THEN
    RETURN public.get_effective_features(p_user_id);
  END IF;

  -- Resolve organization by Master id or Client id mirror
  SELECT id, plan_id, trial_ends_at
  INTO v_org_master_id, v_plan_id, v_trial_ends_at
  FROM public.saas_organizations
  WHERE id = p_organization_id OR client_org_id = p_organization_id
  LIMIT 1;

  IF v_org_master_id IS NULL THEN
    -- Unknown org: fallback to legacy user-based features
    RETURN public.get_effective_features(p_user_id);
  END IF;

  IF v_plan_id IS NULL THEN
    RETURN jsonb_build_object('features','{}'::jsonb,'plan_id',NULL,'plan_slug',NULL,'organization_id',v_org_master_id);
  END IF;

  -- IMPORTANT: Use get_effective_organization_plan to check for token expiry
  -- This ensures PRO/Starter plans with expired tokens are properly handled
  v_plan_effective_id := public.get_effective_organization_plan(v_org_master_id);
  
  -- If get_effective_organization_plan returns NULL, use the organization's plan_id
  IF v_plan_effective_id IS NULL THEN
    v_plan_effective_id := v_plan_id;
  END IF;

  -- Get plan slug for effective plan
  SELECT slug INTO v_plan_effective_slug FROM public.saas_plans WHERE id = v_plan_effective_id LIMIT 1;
  
  -- Also get original plan slug for reference
  SELECT slug INTO v_plan_slug FROM public.saas_plans WHERE id = v_plan_id LIMIT 1;

  -- Additional check: if effective plan is still trial and trial_ends_at is expired, swap to trial_expired
  -- This handles cases where get_effective_organization_plan didn't catch it (e.g., non-token plans)
  IF v_plan_effective_slug = 'trial' AND v_trial_ends_at IS NOT NULL AND v_trial_ends_at < now() THEN
    SELECT id INTO v_plan_effective_id FROM public.saas_plans WHERE slug = 'trial_expired' LIMIT 1;
    IF v_plan_effective_id IS NULL THEN
      v_plan_effective_id := v_plan_id; -- safety fallback
    END IF;
    SELECT slug INTO v_plan_effective_slug FROM public.saas_plans WHERE id = v_plan_effective_id LIMIT 1;
  END IF;

  -- Merge defaults + plan features + org overrides
  SELECT COALESCE(jsonb_object_agg(key, default_value), '{}'::jsonb)
  INTO v_defaults
  FROM public.saas_features;

  SELECT COALESCE(jsonb_object_agg(feature_key, value), '{}'::jsonb)
  INTO v_plan
  FROM public.saas_plan_features
  WHERE plan_id = v_plan_effective_id;

  -- Use v_org_master_id (not p_organization_id) for org overrides
  SELECT COALESCE(jsonb_object_agg(feature_key, value), '{}'::jsonb)
  INTO v_over
  FROM public.saas_org_feature_overrides
  WHERE organization_id = v_org_master_id
    AND (expires_at IS NULL OR expires_at > now());

  v_features := v_defaults || v_plan || v_over;

  RETURN jsonb_build_object(
    'features', v_features,
    'plan_id', v_plan_id,
    'plan_effective_id', v_plan_effective_id,
    'plan_slug', v_plan_effective_slug,
    'plan_original_slug', v_plan_slug,
    'organization_id', v_org_master_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_features_for_org(uuid, uuid) TO authenticated, anon;

COMMENT ON FUNCTION public.get_effective_features_for_org IS 'Returns effective features for an organization, properly handling token expiry for PRO/Starter plans using get_effective_organization_plan';

