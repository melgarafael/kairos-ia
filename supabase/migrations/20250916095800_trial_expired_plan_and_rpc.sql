SET search_path = public, auth;

-- 1) Ensure special plan for expired trials
DO $$
DECLARE v_exists int;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM public.saas_plans WHERE slug = 'trial_expired';
  IF COALESCE(v_exists,0) = 0 THEN
    INSERT INTO public.saas_plans (name, slug, price_monthly, price_yearly, features, limits, active, currency)
    VALUES ('Trial Expirado', 'trial_expired', 0, 0, ARRAY[]::text[], '{}'::jsonb, true, 'BRL');
  END IF;
END $$;

-- 2) Update get_effective_features to use expired-trial plan when applicable
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

  SELECT slug INTO v_plan_slug FROM public.saas_plans WHERE id = v_plan_id LIMIT 1;
  v_plan_effective_id := v_plan_id;

  IF v_plan_slug = 'trial' AND v_trial_ends_at IS NOT NULL AND v_trial_ends_at < now() THEN
    SELECT id INTO v_plan_effective_id FROM public.saas_plans WHERE slug = 'trial_expired' LIMIT 1;
    IF v_plan_effective_id IS NULL THEN
      v_plan_effective_id := v_plan_id; -- safety fallback
    END IF;
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

GRANT EXECUTE ON FUNCTION public.get_effective_features(uuid) TO authenticated, anon;


-- 3) Helper RPC: grant_trial_bonus_internal (usado pela Edge grant-trial-bonus)
create or replace function public.grant_trial_bonus_internal(p_user_id uuid, p_days integer default 7)
returns table(user_id uuid, trial_ends_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_now timestamptz := now();
  v_new timestamptz;
begin
  update public.saas_users u
  set trial_ends_at = (
    greatest(coalesce(u.trial_ends_at, v_now), v_now) + make_interval(days => greatest(1, coalesce(p_days, 7)))
  ),
  updated_at = now()
  where u.id = p_user_id
  returning u.id, u.trial_ends_at into user_id, v_new;

  return query select p_user_id as user_id, v_new as trial_ends_at;
end;
$$;

grant execute on function public.grant_trial_bonus_internal(uuid, integer) to authenticated, anon;

