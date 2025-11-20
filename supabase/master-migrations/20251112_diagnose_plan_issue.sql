-- Diagnostic function to help identify why PRO accounts are reading trial permissions
-- Usage: SELECT * FROM diagnose_user_plan_issue('user_id_here');
SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.diagnose_user_plan_issue(p_user_id uuid)
RETURNS TABLE (
  step text,
  value text,
  details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_org_id uuid;
  v_user_plan_id uuid;
  v_user_plan_slug text;
  v_org_master_id uuid;
  v_org_plan_id uuid;
  v_org_plan_slug text;
  v_effective_plan_id uuid;
  v_effective_plan_slug text;
  v_owner_id uuid;
  v_owner_plan_id uuid;
  v_owner_plan_slug text;
  v_token_valid_until timestamptz;
  v_features_result jsonb;
BEGIN
  -- Step 1: Get user's organization_id and plan_id
  SELECT organization_id, plan_id INTO v_user_org_id, v_user_plan_id
  FROM public.saas_users
  WHERE id = p_user_id
  LIMIT 1;

  IF v_user_plan_id IS NOT NULL THEN
    SELECT slug INTO v_user_plan_slug FROM public.saas_plans WHERE id = v_user_plan_id LIMIT 1;
  END IF;

  RETURN QUERY SELECT 
    '1. User Plan'::text,
    COALESCE(v_user_plan_slug, 'NULL')::text,
    jsonb_build_object(
      'user_id', p_user_id,
      'organization_id', v_user_org_id,
      'plan_id', v_user_plan_id,
      'plan_slug', v_user_plan_slug
    );

  -- Step 2: Get organization details
  IF v_user_org_id IS NOT NULL THEN
    SELECT id, plan_id, owner_id INTO v_org_master_id, v_org_plan_id, v_owner_id
    FROM public.saas_organizations
    WHERE id = v_user_org_id OR client_org_id = v_user_org_id
    LIMIT 1;

    IF v_org_plan_id IS NOT NULL THEN
      SELECT slug INTO v_org_plan_slug FROM public.saas_plans WHERE id = v_org_plan_id LIMIT 1;
    END IF;

    RETURN QUERY SELECT 
      '2. Organization Plan'::text,
      COALESCE(v_org_plan_slug, 'NULL')::text,
      jsonb_build_object(
        'master_org_id', v_org_master_id,
        'client_org_id', v_user_org_id,
        'plan_id', v_org_plan_id,
        'plan_slug', v_org_plan_slug,
        'owner_id', v_owner_id
      );

    -- Step 3: Get effective plan using get_effective_organization_plan
    IF v_org_master_id IS NOT NULL THEN
      v_effective_plan_id := public.get_effective_organization_plan(v_org_master_id);
      
      IF v_effective_plan_id IS NOT NULL THEN
        SELECT slug INTO v_effective_plan_slug FROM public.saas_plans WHERE id = v_effective_plan_id LIMIT 1;
      END IF;

      RETURN QUERY SELECT 
        '3. Effective Plan (via get_effective_organization_plan)'::text,
        COALESCE(v_effective_plan_slug, 'NULL')::text,
        jsonb_build_object(
          'effective_plan_id', v_effective_plan_id,
          'effective_plan_slug', v_effective_plan_slug,
          'original_plan_id', v_org_plan_id,
          'original_plan_slug', v_org_plan_slug
        );

      -- Step 4: Check for tokens if plan is PRO or Starter
      IF v_org_plan_id IN (
        '8b5a1000-957c-4eaf-beca-954a78187337'::uuid, -- Starter
        'd4836a79-186f-4905-bfac-77ec52fa1dde'::uuid  -- PRO
      ) THEN
        SELECT valid_until INTO v_token_valid_until
        FROM public.saas_plan_tokens
        WHERE applied_organization_id = v_org_master_id
          AND status = 'redeemed'
          AND plan_id = v_org_plan_id
        ORDER BY applied_at DESC
        LIMIT 1;

        RETURN QUERY SELECT 
          '4. Token Status'::text,
          CASE 
            WHEN v_token_valid_until IS NULL THEN 'No token found'
            WHEN v_token_valid_until < now() THEN 'Token EXPIRED'
            ELSE 'Token VALID'
          END::text,
          jsonb_build_object(
            'token_valid_until', v_token_valid_until,
            'is_expired', CASE WHEN v_token_valid_until IS NOT NULL AND v_token_valid_until < now() THEN true ELSE false END,
            'plan_id', v_org_plan_id
          );
      END IF;
    END IF;

    -- Step 5: Get owner's plan
    IF v_owner_id IS NOT NULL THEN
      SELECT plan_id INTO v_owner_plan_id
      FROM public.saas_users
      WHERE id = v_owner_id
      LIMIT 1;

      IF v_owner_plan_id IS NOT NULL THEN
        SELECT slug INTO v_owner_plan_slug FROM public.saas_plans WHERE id = v_owner_plan_id LIMIT 1;
      END IF;

      RETURN QUERY SELECT 
        '5. Owner Plan'::text,
        COALESCE(v_owner_plan_slug, 'NULL')::text,
        jsonb_build_object(
          'owner_id', v_owner_id,
          'owner_plan_id', v_owner_plan_id,
          'owner_plan_slug', v_owner_plan_slug
        );
    END IF;

    -- Step 6: Get actual features result
    SELECT * INTO v_features_result
    FROM public.get_effective_features_for_org(p_user_id, v_user_org_id);

    RETURN QUERY SELECT 
      '6. Actual Features Result'::text,
      (v_features_result->>'plan_slug')::text,
      v_features_result;
  ELSE
    RETURN QUERY SELECT 
      '2. Organization Plan'::text,
      'User has no organization_id'::text,
      jsonb_build_object('error', 'User organization_id is NULL');
  END IF;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.diagnose_user_plan_issue(uuid) TO authenticated, anon;

COMMENT ON FUNCTION public.diagnose_user_plan_issue IS 'Diagnostic function to help identify why PRO accounts are reading trial permissions. Returns step-by-step analysis of plan resolution.';

