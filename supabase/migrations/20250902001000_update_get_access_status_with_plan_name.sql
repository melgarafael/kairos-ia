-- Update RPC to include plan_name/slug and to check subscriptions by user_id
SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.get_access_status(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  u RECORD;
  v_now timestamptz := now();
  v_trial_active boolean;
  v_has_active_subscription boolean := false;
  v_plan_name text := NULL;
  v_plan_slug text := NULL;
  v_current_period_end timestamptz := NULL;
BEGIN
  SELECT id, organization_id, trial_ends_at, desired_plan, plan_id
  INTO u
  FROM public.saas_users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false, 'allowed', false);
  END IF;

  -- trial flag
  v_trial_active := COALESCE(u.trial_ends_at, v_now) > v_now;

  -- plan info
  IF u.plan_id IS NOT NULL THEN
    SELECT name, slug INTO v_plan_name, v_plan_slug FROM public.saas_plans WHERE id = u.plan_id LIMIT 1;
  END IF;

  -- subscription check (by user_id now)
  SELECT EXISTS(
    SELECT 1 FROM public.saas_subscriptions s
    WHERE s.user_id = u.id AND s.status = 'active' AND (s.current_period_end IS NULL OR s.current_period_end > v_now)
  ) INTO v_has_active_subscription;

  -- also fetch last period end (optional)
  SELECT s.current_period_end INTO v_current_period_end
  FROM public.saas_subscriptions s
  WHERE s.user_id = u.id
  ORDER BY s.updated_at DESC NULLS LAST
  LIMIT 1;

  RETURN jsonb_build_object(
    'exists', true,
    'trial_active', v_trial_active,
    'has_active_subscription', v_has_active_subscription,
    'desired_plan', u.desired_plan,
    'plan_id', u.plan_id,
    'plan_name', v_plan_name,
    'plan_slug', v_plan_slug,
    'current_period_end', v_current_period_end,
    'allowed', (v_has_active_subscription OR v_trial_active)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_access_status(uuid) TO authenticated, anon;


