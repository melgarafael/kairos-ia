-- Migration: Check and update plan_id for Pro/Starter plans with expired tokens
-- Rule: Applies if organization plan is Pro or Starter AND has expired token (via attributed_token_id OR applied_organization_id)
-- When token expires, update organization plan_id to Trial Expired: 8441539f-aed4-4fd7-a0df-2768d0ad29d4

SET search_path = public, auth;

-- Plan IDs constants
-- Starter: 8b5a1000-957c-4eaf-beca-954a78187337
-- PRO: d4836a79-186f-4905-bfac-77ec52fa1dde
-- Trial Expired: 8441539f-aed4-4fd7-a0df-2768d0ad29d4

-- Ensure Trial Expired plan exists
DO $$
DECLARE v_exists int;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM public.saas_plans WHERE slug = 'trial_expired' OR id = '8441539f-aed4-4fd7-a0df-2768d0ad29d4'::uuid;
  IF COALESCE(v_exists,0) = 0 THEN
    INSERT INTO public.saas_plans (id, name, slug, price_monthly, price_yearly, features, limits, active, currency)
    VALUES ('8441539f-aed4-4fd7-a0df-2768d0ad29d4'::uuid, 'Trial Expirado', 'trial_expired', 0, 0, ARRAY[]::text[], '{}'::jsonb, true, 'BRL')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Function to check and update plan_id for a specific organization
-- Only applies if:
-- 1. Organization plan is Pro or Starter
-- 2. Organization has expired token (checked via attributed_token_id OR applied_organization_id)
-- 3. The token is expired (valid_until < now())
-- Note: p_organization_id MUST be the primary key (id) from saas_organizations (Master Supabase)
-- because saas_plan_tokens.applied_organization_id references the Master organization id, NOT client_org_id
-- This function expects Master Org ID, not Client Org ID
CREATE OR REPLACE FUNCTION public.check_expired_token_for_org(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_trial_expired_id uuid := '8441539f-aed4-4fd7-a0df-2768d0ad29d4'::uuid;
  v_org RECORD;
  v_token RECORD;
  v_plan_slug text;
  v_updated boolean := false;
BEGIN
  -- Get organization with plan_id and attributed_token_id
  -- Note: p_organization_id should always be the primary key (id) from saas_organizations
  -- because saas_users.organization_id references saas_organizations(id), not client_org_id
  SELECT 
    o.id,
    o.plan_id,
    o.attributed_token_id
  INTO v_org
  FROM public.saas_organizations o
  WHERE o.id = p_organization_id
  LIMIT 1;

  -- If organization not found, return
  IF v_org.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Organization not found',
      'updated', false
    );
  END IF;

  -- Get plan slug to check if it's Pro or Starter
  SELECT slug INTO v_plan_slug
  FROM public.saas_plans
  WHERE id = v_org.plan_id
  LIMIT 1;

  -- Rule: Only apply for Pro or Starter plans
  -- Check by slug OR by plan_id (for backward compatibility)
  IF (v_plan_slug NOT IN ('professional', 'pro', 'starter') 
      AND v_org.plan_id NOT IN (
        '8b5a1000-957c-4eaf-beca-954a78187337'::uuid, -- Starter
        'd4836a79-186f-4905-bfac-77ec52fa1dde'::uuid  -- PRO
      )) THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Organization plan is not Pro or Starter, skipping check',
      'updated', false
    );
  END IF;

  -- Rule: Check tokens via attributed_token_id OR applied_organization_id
  -- First try attributed_token_id (if filled)
  IF v_org.attributed_token_id IS NOT NULL THEN
    -- Get the attributed token
    SELECT 
      id,
      valid_until,
      status,
      plan_id
    INTO v_token
    FROM public.saas_plan_tokens
    WHERE id = v_org.attributed_token_id
    LIMIT 1;

    -- If token found via attributed_token_id, check expiration
    IF v_token.id IS NOT NULL THEN
      -- Check if token is expired
      IF v_token.valid_until IS NOT NULL AND v_token.valid_until < now() THEN
        -- Token is expired: update organization plan_id to Trial Expired
        UPDATE public.saas_organizations
        SET plan_id = v_trial_expired_id,
            attributed_token_id = NULL, -- Clear attribution since token is expired
            updated_at = now()
        WHERE id = v_org.id;
        
        v_updated := true;
        
        RETURN jsonb_build_object(
          'success', true,
          'message', 'Token expired (via attributed_token_id), organization plan updated to Trial Expired',
          'updated', true,
          'old_plan_id', v_org.plan_id,
          'new_plan_id', v_trial_expired_id
        );
      END IF;

      -- Token is still valid
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Token is still valid (via attributed_token_id)',
        'updated', false,
        'valid_until', v_token.valid_until
      );
    END IF;
  END IF;

  -- If no attributed_token_id or token not found, check via applied_organization_id
  -- Get the most recent redeemed token applied to this organization
  SELECT 
    id,
    valid_until,
    status,
    plan_id
  INTO v_token
  FROM public.saas_plan_tokens
  WHERE applied_organization_id = v_org.id
    AND status = 'redeemed'
    AND plan_id IN (
      '8b5a1000-957c-4eaf-beca-954a78187337'::uuid, -- Starter
      'd4836a79-186f-4905-bfac-77ec52fa1dde'::uuid  -- PRO
    )
  ORDER BY applied_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  -- If no token found via applied_organization_id, return
  IF v_token.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'No token found for this organization (neither attributed_token_id nor applied_organization_id)',
      'updated', false
    );
  END IF;

  -- Check if token is expired
  IF v_token.valid_until IS NOT NULL AND v_token.valid_until < now() THEN
    -- Token is expired: update organization plan_id to Trial Expired
    UPDATE public.saas_organizations
    SET plan_id = v_trial_expired_id,
        attributed_token_id = NULL, -- Clear attribution if exists
        updated_at = now()
    WHERE id = v_org.id;
    
    v_updated := true;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Token expired (via applied_organization_id), organization plan updated to Trial Expired',
      'updated', true,
      'old_plan_id', v_org.plan_id,
      'new_plan_id', v_trial_expired_id
    );
  END IF;

  -- Token is still valid
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Token is still valid (via applied_organization_id)',
    'updated', false,
    'valid_until', v_token.valid_until
  );

END;
$$;

COMMENT ON FUNCTION public.check_expired_token_for_org(uuid) IS 'Checks if organization with Pro/Starter plan has expired token (via attributed_token_id or applied_organization_id). If expired, updates plan_id to Trial Expired.';

GRANT EXECUTE ON FUNCTION public.check_expired_token_for_org(uuid) TO authenticated, anon;

-- Function to check expired tokens for user's organization
-- This should be called when user accesses the app
-- Logic:
-- 1. Get user_id (p_user_id)
-- 2. Find organization in saas_organizations (Master) where owner_id = p_user_id
-- 3. Get the Master Org ID (primary key id)
-- 4. Check attributed_token_id -> saas_plan_tokens -> valid_until
-- 5. If expired, update plan_id using Master Org ID
-- NOTE: Uses owner_id, NOT saas_users.organization_id (which is Client Org ID)
CREATE OR REPLACE FUNCTION public.check_user_org_expired_token(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_master_org_id uuid; -- The Master organization ID (primary key from saas_organizations)
  v_result jsonb;
BEGIN
  -- Get Master Org ID from saas_organizations using owner_id
  -- This is the correct way: find organization where user is the owner
  SELECT id INTO v_master_org_id
  FROM public.saas_organizations
  WHERE owner_id = p_user_id
  LIMIT 1;

  -- If organization not found, return error
  IF v_master_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Organization not found',
      'updated', false,
      'message', 'No organization found for this user as owner'
    );
  END IF;

  -- Check expired token for the Master organization using Master Org ID
  -- The check_expired_token_for_org function will:
  -- 1. Get organization by Master Org ID
  -- 2. Check attributed_token_id
  -- 3. Check saas_plan_tokens -> valid_until
  -- 4. If expired, update plan_id to Trial Expired
  SELECT public.check_expired_token_for_org(v_master_org_id) INTO v_result;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.check_user_org_expired_token(uuid) IS 'Checks expired tokens for the user''s organization. Should be called when user accesses the app.';

GRANT EXECUTE ON FUNCTION public.check_user_org_expired_token(uuid) TO authenticated, anon;

-- Update the existing check_and_fix_expired_tokens to also check Pro/Starter with attributed_token_id
-- This ensures backward compatibility while adding the new rule
CREATE OR REPLACE FUNCTION public.check_and_fix_expired_tokens(p_organization_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_trial_expired_id uuid := '8441539f-aed4-4fd7-a0df-2768d0ad29d4'::uuid;
  v_org_id uuid;
  v_updated_count int := 0;
  v_deleted_count int := 0;
  v_orgs_updated uuid[] := ARRAY[]::uuid[];
  v_has_valid boolean := false;
  v_expired_ids uuid[] := ARRAY[]::uuid[];
  v_rows int := 0;
  v_check_result jsonb;
  cur refcursor;
BEGIN
  SELECT id INTO v_trial_expired_id FROM public.saas_plans WHERE slug = 'trial_expired' OR id = '8441539f-aed4-4fd7-a0df-2768d0ad29d4'::uuid LIMIT 1;

  IF p_organization_id IS NOT NULL THEN
    v_org_id := p_organization_id;

    -- NEW: First check Pro/Starter organizations with attributed_token_id
    -- This ensures organizations with attributed tokens are checked first
    SELECT public.check_expired_token_for_org(v_org_id) INTO v_check_result;
    IF (v_check_result->>'updated')::boolean = true THEN
      v_updated_count := v_updated_count + 1;
      v_orgs_updated := array_append(v_orgs_updated, v_org_id);
    END IF;

    -- Continue with existing logic for general expired token cleanup
    -- 1) Collect expired token IDs for this org
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
      INTO v_expired_ids
    FROM public.saas_plan_tokens
    WHERE applied_organization_id = v_org_id
      AND valid_until IS NOT NULL
      AND valid_until < now();

    IF array_length(v_expired_ids, 1) IS NOT NULL THEN
      -- 2) Clear attribution if pointing to an expired token
      UPDATE public.saas_organizations
      SET attributed_token_id = NULL,
          updated_at = now()
      WHERE id = v_org_id
        AND attributed_token_id = ANY(v_expired_ids);

      -- 3) Check if any valid token remains
      SELECT EXISTS (
        SELECT 1 FROM public.saas_plan_tokens t
        WHERE t.applied_organization_id = v_org_id
          AND t.valid_until IS NOT NULL
          AND t.valid_until >= now()
      ) INTO v_has_valid;

      -- Downgrade plan if none remains (only if not already updated by check_expired_token_for_org)
      IF NOT v_has_valid AND v_trial_expired_id IS NOT NULL AND (v_check_result->>'updated')::boolean = false THEN
        UPDATE public.saas_organizations
        SET plan_id = v_trial_expired_id,
            updated_at = now()
        WHERE id = v_org_id;
        IF FOUND THEN
          v_updated_count := v_updated_count + 1;
          v_orgs_updated := array_append(v_orgs_updated, v_org_id);
        END IF;
      END IF;

      -- 4) Delete the expired tokens by ID
      DELETE FROM public.saas_plan_tokens WHERE id = ANY(v_expired_ids);
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_deleted_count := v_deleted_count + v_rows;
    END IF;

  ELSE
    -- Process all orgs that have at least one expired redeemed token
    OPEN cur FOR
      SELECT DISTINCT applied_organization_id
      FROM public.saas_plan_tokens
      WHERE status = 'redeemed'
        AND valid_until IS NOT NULL
        AND valid_until < now()
        AND applied_organization_id IS NOT NULL;

    LOOP
      FETCH cur INTO v_org_id;
      EXIT WHEN NOT FOUND;

      -- NEW: Check Pro/Starter organizations with attributed_token_id first
      SELECT public.check_expired_token_for_org(v_org_id) INTO v_check_result;
      IF (v_check_result->>'updated')::boolean = true THEN
        v_updated_count := v_updated_count + 1;
        v_orgs_updated := array_append(v_orgs_updated, v_org_id);
      END IF;

      -- 1) Collect expired token IDs for org
      SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
        INTO v_expired_ids
      FROM public.saas_plan_tokens
      WHERE applied_organization_id = v_org_id
        AND valid_until IS NOT NULL
        AND valid_until < now();

      IF array_length(v_expired_ids, 1) IS NULL THEN
        CONTINUE;
      END IF;

      -- 2) Clear attribution if pointing to an expired token
      UPDATE public.saas_organizations
      SET attributed_token_id = NULL,
          updated_at = now()
      WHERE id = v_org_id
        AND attributed_token_id = ANY(v_expired_ids);

      -- 3) Any valid token remains?
      SELECT EXISTS (
        SELECT 1 FROM public.saas_plan_tokens t
        WHERE t.applied_organization_id = v_org_id
          AND t.valid_until IS NOT NULL
          AND t.valid_until >= now()
      ) INTO v_has_valid;

      -- Downgrade only if no valid token remains AND not already updated by check_expired_token_for_org
      IF NOT v_has_valid AND v_trial_expired_id IS NOT NULL AND (v_check_result->>'updated')::boolean = false THEN
        UPDATE public.saas_organizations
        SET plan_id = v_trial_expired_id,
            updated_at = now()
        WHERE id = v_org_id;
        IF FOUND THEN
          v_updated_count := v_updated_count + 1;
          v_orgs_updated := array_append(v_orgs_updated, v_org_id);
        END IF;
      END IF;

      -- 4) Delete expired tokens by ID
      DELETE FROM public.saas_plan_tokens WHERE id = ANY(v_expired_ids);
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_deleted_count := v_deleted_count + v_rows;
    END LOOP;
    CLOSE cur;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'deleted_count', v_deleted_count,
    'organizations_updated', v_orgs_updated
  );
END;
$$;

COMMENT ON FUNCTION public.check_and_fix_expired_tokens(uuid) IS 'Checks for expired tokens including Pro/Starter plans with attributed_token_id. Updates organization plan_id to Trial Expired when tokens expire.';

