SET search_path = public, auth;

-- RPC: get_access_status(user)
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
BEGIN
  SELECT id, organization_id, trial_ends_at, desired_plan, plan_id
  INTO u
  FROM public.saas_users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false, 'allowed', false);
  END IF;

  v_trial_active := COALESCE(u.trial_ends_at, v_now) > v_now;

  IF u.organization_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.saas_subscriptions s
      WHERE s.organization_id = u.organization_id AND s.status = 'active'
    ) INTO v_has_active_subscription;
  END IF;

  RETURN jsonb_build_object(
    'exists', true,
    'trial_active', v_trial_active,
    'has_active_subscription', v_has_active_subscription,
    'desired_plan', u.desired_plan,
    'plan_id', u.plan_id,
    'allowed', (v_has_active_subscription OR v_trial_active)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_access_status(uuid) TO authenticated, anon;


