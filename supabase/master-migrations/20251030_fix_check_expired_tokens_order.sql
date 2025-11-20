-- Migration: Fix expired-token handling order and harden RPCs
-- Steps per org with expired redeemed tokens:
-- 1) Collect expired token IDs
-- 2) If org.attributed_token_id points to any expired token, set it to NULL
-- 3) If no other valid redeemed token remains, set plan_id to trial_expired
-- 4) Delete the expired tokens by ID (after clearing attribution)

SET search_path = public, auth;

-- Safety: create helpful index (no-op if exists)
CREATE INDEX IF NOT EXISTS idx_spt_org_status_valid ON public.saas_plan_tokens(applied_organization_id, status, valid_until);

-- Ensure Trial Expired exists
DO $$
DECLARE v_exists int;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM public.saas_plans WHERE slug = 'trial_expired';
  IF COALESCE(v_exists,0) = 0 THEN
    INSERT INTO public.saas_plans (name, slug, price_monthly, price_yearly, features, limits, active, currency)
    VALUES ('Trial Expirado', 'trial_expired', 0, 0, ARRAY[]::text[], '{}'::jsonb, true, 'BRL');
  END IF;
END $$;

-- Replace main checker with correct ordering
CREATE OR REPLACE FUNCTION public.check_and_fix_expired_tokens(p_organization_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_trial_expired_id uuid;
  v_org_id uuid;
  v_updated_count int := 0;
  v_deleted_count int := 0;
  v_orgs_updated uuid[] := ARRAY[]::uuid[];
  v_has_valid boolean := false;
  v_expired_ids uuid[] := ARRAY[]::uuid[];
  v_rows int := 0;
  cur refcursor;
BEGIN
  SELECT id INTO v_trial_expired_id FROM public.saas_plans WHERE slug = 'trial_expired' LIMIT 1;

  IF p_organization_id IS NOT NULL THEN
    v_org_id := p_organization_id;

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

      -- Downgrade plan if none remains
      IF NOT v_has_valid AND v_trial_expired_id IS NOT NULL THEN
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

      IF NOT v_has_valid AND v_trial_expired_id IS NOT NULL THEN
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

-- Ensure helper RPC sets search_path too
CREATE OR REPLACE FUNCTION public.check_user_organization_expired_tokens(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id uuid;
  v_result jsonb;
BEGIN
  SELECT organization_id INTO v_org_id FROM public.saas_users WHERE id = p_user_id LIMIT 1;
  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User has no organization', 'updated_count', 0, 'deleted_count', 0);
  END IF;
  SELECT public.check_and_fix_expired_tokens(v_org_id) INTO v_result;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_fix_expired_tokens(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_user_organization_expired_tokens(uuid) TO authenticated, anon;


