-- Migration: Improve expired token cleanup and downgrade logic
-- Behavior changes:
-- - Always delete expired redeemed tokens (valid_until < now())
-- - Only downgrade organization plan_id to trial_expired when NO valid redeemed token remains for that org
-- - Keep attributed_token_id consistent (NULL when downgrading)

SET search_path = public, auth;

-- Ensure trial_expired plan exists (safety)
DO $$
DECLARE v_exists int;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM public.saas_plans WHERE slug = 'trial_expired';
  IF COALESCE(v_exists,0) = 0 THEN
    INSERT INTO public.saas_plans (name, slug, price_monthly, price_yearly, features, limits, active, currency)
    VALUES ('Trial Expirado', 'trial_expired', 0, 0, ARRAY[]::text[], '{}'::jsonb, true, 'BRL');
  END IF;
END $$;

-- Replace checker to only downgrade when no valid token remains
CREATE OR REPLACE FUNCTION public.check_and_fix_expired_tokens(p_organization_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trial_expired_id uuid;
  v_org_id uuid;
  v_token_id uuid;
  v_updated_count int := 0;
  v_deleted_count int := 0;
  v_orgs_updated uuid[] := ARRAY[]::uuid[];
  v_has_valid boolean := false;
  v_rows int := 0;
  cur refcursor;
BEGIN
  -- Resolve Trial Expired plan id
  SELECT id INTO v_trial_expired_id FROM public.saas_plans WHERE slug = 'trial_expired' LIMIT 1;

  -- Helper to process a single organization id
  PERFORM 1; -- no-op placeholder to keep structure clear

  IF p_organization_id IS NOT NULL THEN
    v_org_id := p_organization_id;

    -- 1) Delete expired redeemed tokens for this org
    DELETE FROM public.saas_plan_tokens t
    WHERE t.applied_organization_id = v_org_id
      AND t.status = 'redeemed'
      AND t.valid_until IS NOT NULL
      AND t.valid_until < now();
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_rows;

    -- 2) Check if any valid redeemed token remains
    SELECT EXISTS (
      SELECT 1 FROM public.saas_plan_tokens t
      WHERE t.applied_organization_id = v_org_id
        AND t.status = 'redeemed'
        AND t.valid_until IS NOT NULL
        AND t.valid_until >= now()
    ) INTO v_has_valid;

    -- 3) Downgrade only if no valid token remains
    IF NOT v_has_valid AND v_trial_expired_id IS NOT NULL THEN
      UPDATE public.saas_organizations
      SET plan_id = v_trial_expired_id,
          attributed_token_id = NULL,
          updated_at = now()
      WHERE id = v_org_id;
      IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        v_orgs_updated := array_append(v_orgs_updated, v_org_id);
      END IF;
    END IF;

  ELSE
    -- Process all orgs that have any expired redeemed token
    OPEN cur FOR
      SELECT DISTINCT t.applied_organization_id
      FROM public.saas_plan_tokens t
      WHERE t.status = 'redeemed'
        AND t.valid_until IS NOT NULL
        AND t.valid_until < now()
        AND t.applied_organization_id IS NOT NULL;

    LOOP
      FETCH cur INTO v_org_id;
      EXIT WHEN NOT FOUND;

      -- Delete expired tokens for this org (accumulate count)
      DELETE FROM public.saas_plan_tokens t
      WHERE t.applied_organization_id = v_org_id
        AND t.status = 'redeemed'
        AND t.valid_until IS NOT NULL
        AND t.valid_until < now();
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_deleted_count := v_deleted_count + v_rows;

      -- Check if any valid token remains
      SELECT EXISTS (
        SELECT 1 FROM public.saas_plan_tokens t
        WHERE t.applied_organization_id = v_org_id
          AND t.status = 'redeemed'
          AND t.valid_until IS NOT NULL
          AND t.valid_until >= now()
      ) INTO v_has_valid;

      -- Downgrade only if no valid token remains
      IF NOT v_has_valid AND v_trial_expired_id IS NOT NULL THEN
        UPDATE public.saas_organizations
        SET plan_id = v_trial_expired_id,
            attributed_token_id = NULL,
            updated_at = now()
        WHERE id = v_org_id;
        IF FOUND THEN
          v_updated_count := v_updated_count + 1;
          v_orgs_updated := array_append(v_orgs_updated, v_org_id);
        END IF;
      END IF;
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

COMMENT ON FUNCTION public.check_and_fix_expired_tokens(uuid) IS 'Deletes expired redeemed plan tokens and downgrades organization plan to trial_expired only when no valid token remains.';

GRANT EXECUTE ON FUNCTION public.check_and_fix_expired_tokens(uuid) TO authenticated, anon;


