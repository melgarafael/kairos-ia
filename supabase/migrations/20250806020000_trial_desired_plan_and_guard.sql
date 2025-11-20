-- Add desired_plan and trial fields + RPC for status
SET search_path = public, auth;

-- saas_users: desired_plan (slug), trial_started_at, trial_ends_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saas_users' AND column_name = 'desired_plan'
  ) THEN
    ALTER TABLE public.saas_users ADD COLUMN desired_plan text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saas_users' AND column_name = 'trial_started_at'
  ) THEN
    ALTER TABLE public.saas_users ADD COLUMN trial_started_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saas_users' AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE public.saas_users ADD COLUMN trial_ends_at timestamptz DEFAULT (now() + interval '14 days');
  END IF;
END $$;

-- Backfill desired_plan from raw_user_meta_data if present (best effort)
UPDATE public.saas_users u
SET desired_plan = COALESCE(u.desired_plan,
  (SELECT (NEW.raw_user_meta_data->>'desired_plan') FROM auth.users NEW WHERE NEW.id = u.id LIMIT 1)
)
WHERE u.desired_plan IS NULL;

-- RPC: get_trial_status(user_id)
CREATE OR REPLACE FUNCTION public.get_trial_status(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user record;
  v_now timestamptz := now();
  v_trial_active boolean;
BEGIN
  SELECT id, plan_id, desired_plan, trial_started_at, trial_ends_at
  INTO v_user
  FROM public.saas_users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  v_trial_active := COALESCE(v_user.trial_ends_at, v_now) > v_now;

  RETURN jsonb_build_object(
    'exists', true,
    'trial_active', v_trial_active,
    'trial_ends_at', v_user.trial_ends_at,
    'trial_started_at', v_user.trial_started_at,
    'plan_id', v_user.plan_id,
    'desired_plan', v_user.desired_plan
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trial_status(uuid) TO authenticated, anon;


