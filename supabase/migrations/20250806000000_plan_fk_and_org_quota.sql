-- Master SaaS - ensure plan FK + org quota
SET search_path = public, auth;

-- 1) Ensure saas_plans has organizations limit in limits JSON
DO $$
BEGIN
  -- create trial if missing (safety)
  IF NOT EXISTS (SELECT 1 FROM public.saas_plans WHERE slug = 'trial') THEN
    INSERT INTO public.saas_plans (name, slug, price_monthly, price_yearly, features, limits, active)
    VALUES ('Trial', 'trial', 0, 0,
      ARRAY['1 Organização e 1 Usuário', '14 dias grátis', 'Suporte por email'],
      '{"users": 1, "patients": 50, "storage_gb": 0.5, "appointments_per_month": 100, "organizations": 1}'::jsonb,
      true);
  END IF;

  -- Set organizations limit per plan
  UPDATE public.saas_plans 
  SET limits = jsonb_set(coalesce(limits, '{}'::jsonb), '{organizations}', to_jsonb(1), true)
  WHERE slug IN ('trial','basic');

  UPDATE public.saas_plans 
  SET limits = jsonb_set(coalesce(limits, '{}'::jsonb), '{organizations}', to_jsonb(2), true)
  WHERE slug IN ('professional');
END $$;

-- 2) Ensure columns in saas_users: plan_id (uuid, FK), organizations_extra, organizations_quota_override
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saas_users' AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE public.saas_users ADD COLUMN plan_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saas_users' AND column_name = 'organizations_extra'
  ) THEN
    ALTER TABLE public.saas_users ADD COLUMN organizations_extra integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saas_users' AND column_name = 'organizations_quota_override'
  ) THEN
    ALTER TABLE public.saas_users ADD COLUMN organizations_quota_override integer;
  END IF;
END $$;

-- 3) Backfill plan_id in saas_users to trial if null and add FK + NOT NULL
DO $$
DECLARE
  v_trial uuid;
BEGIN
  SELECT id INTO v_trial FROM public.saas_plans WHERE slug = 'trial' LIMIT 1;
  -- if still null, raise to avoid setting NOT NULL without value
  IF v_trial IS NULL THEN
    RAISE EXCEPTION 'Trial plan not found in saas_plans';
  END IF;

  UPDATE public.saas_users SET plan_id = v_trial WHERE plan_id IS NULL;

  -- Add FK if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'saas_users' AND constraint_name = 'saas_users_plan_id_fkey'
  ) THEN
    ALTER TABLE public.saas_users
      ADD CONSTRAINT saas_users_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.saas_plans(id) ON UPDATE CASCADE;
  END IF;

  -- Make NOT NULL
  ALTER TABLE public.saas_users ALTER COLUMN plan_id SET NOT NULL;
END $$;

-- 4) saas_subscriptions: manter para registro de inscrições (apenas FK opcional)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saas_subscriptions' AND column_name = 'plan_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'saas_subscriptions' AND constraint_name = 'saas_subscriptions_plan_id_fkey'
    ) THEN
      ALTER TABLE public.saas_subscriptions
        ADD CONSTRAINT saas_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.saas_plans(id) ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

-- 5) RPC to compute allowed organizations from plan + extras/override
CREATE OR REPLACE FUNCTION public.get_user_org_quota(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan_slug text;
  v_limits jsonb;
  v_base int;
  v_extra int;
  v_override int;
  v_allowed int;
BEGIN
  SELECT p.slug, p.limits
  INTO v_plan_slug, v_limits
  FROM public.saas_plans p
  JOIN public.saas_users u ON u.plan_id = p.id
  WHERE u.id = p_user_id;

  v_base := COALESCE((v_limits->>'organizations')::int, 1);
  SELECT organizations_extra, organizations_quota_override
  INTO v_extra, v_override
  FROM public.saas_users
  WHERE id = p_user_id;

  v_allowed := COALESCE(v_override, v_base + COALESCE(v_extra,0));

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'base_limit', v_base,
    'extra', COALESCE(v_extra,0),
    'override', v_override,
    'plan_slug', v_plan_slug
  );
END;
$$;

-- 6) Grant execute to authenticated for RPC (read-only calc)
GRANT EXECUTE ON FUNCTION public.get_user_org_quota(uuid) TO authenticated, anon;


