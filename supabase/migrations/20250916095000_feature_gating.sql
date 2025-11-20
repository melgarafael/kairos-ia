SET search_path = public, auth;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feature_type') THEN
    CREATE TYPE feature_type AS ENUM ('boolean','int','decimal','string','json','enum');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.saas_features (
  key text PRIMARY KEY,
  type feature_type NOT NULL,
  default_value jsonb NOT NULL DEFAULT 'null',
  enum_options jsonb,
  category text,
  description text,
  ui_schema jsonb,
  dev_only boolean DEFAULT false,
  deprecated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saas_plan_features (
  plan_id uuid NOT NULL REFERENCES public.saas_plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL REFERENCES public.saas_features(key) ON DELETE RESTRICT,
  value jsonb NOT NULL,
  enforced boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (plan_id, feature_key)
);

CREATE TABLE IF NOT EXISTS public.saas_org_feature_overrides (
  organization_id uuid NOT NULL REFERENCES public.saas_organizations(id) ON DELETE CASCADE,
  feature_key text NOT NULL REFERENCES public.saas_features(key) ON DELETE RESTRICT,
  value jsonb NOT NULL,
  reason text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (organization_id, feature_key)
);

ALTER TABLE public.saas_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_org_feature_overrides ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_effective_features(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan_id uuid;
  v_org_id uuid;
  v_plan_slug text;
  v_defaults jsonb := '{}'::jsonb;
  v_plan jsonb := '{}'::jsonb;
  v_over jsonb := '{}'::jsonb;
  v_features jsonb := '{}'::jsonb;
BEGIN
  SELECT plan_id, organization_id INTO v_plan_id, v_org_id
  FROM public.saas_users
  WHERE id = p_user_id
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RETURN jsonb_build_object('features','{}'::jsonb,'plan_id',NULL,'plan_slug',NULL,'organization_id',v_org_id);
  END IF;

  SELECT slug INTO v_plan_slug FROM public.saas_plans WHERE id = v_plan_id LIMIT 1;

  SELECT COALESCE(jsonb_object_agg(key, default_value), '{}'::jsonb)
  INTO v_defaults
  FROM public.saas_features;

  SELECT COALESCE(jsonb_object_agg(feature_key, value), '{}'::jsonb)
  INTO v_plan
  FROM public.saas_plan_features
  WHERE plan_id = v_plan_id;

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
    'plan_id', v_plan_id,
    'plan_slug', v_plan_slug,
    'organization_id', v_org_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_features(uuid) TO authenticated, anon;


