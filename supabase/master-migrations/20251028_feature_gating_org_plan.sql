-- Master migration: Feature gating by organization plan
-- Goal: Compute effective features based on saas_organizations.plan_id (not user.plan)
-- Notes: Apply on MASTER only. Keep client AutoUpdater untouched.
set search_path = public, auth;

-- get_effective_features_for_org: returns features, plan info by organization
create or replace function public.get_effective_features_for_org(p_user_id uuid, p_organization_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_master_org_id uuid;
  v_plan_id uuid;
  v_plan_slug text;
  v_defaults jsonb := '{}'::jsonb;
  v_plan jsonb := '{}'::jsonb;
  v_over jsonb := '{}'::jsonb;
  v_features jsonb := '{}'::jsonb;
begin
  if p_organization_id is null then
    -- No org context → fallback to legacy per-user computation
    return public.get_effective_features(p_user_id);
  end if;

  -- Map client org id → master org id
  select id, plan_id
  into v_master_org_id, v_plan_id
  from public.saas_organizations
  where client_org_id = p_organization_id
  limit 1;

  if v_master_org_id is null then
    -- As a secondary lookup, allow passing a master org id directly in p_organization_id
    select id, plan_id
    into v_master_org_id, v_plan_id
    from public.saas_organizations
    where id = p_organization_id
    limit 1;
  end if;

  if v_master_org_id is null then
    -- Unknown organization → fallback to per-user
    return public.get_effective_features(p_user_id);
  end if;

  if v_plan_id is null then
    return jsonb_build_object('features','{}'::jsonb,'plan_id',null,'plan_slug',null,'organization_id',p_organization_id);
  end if;

  select slug into v_plan_slug from public.saas_plans where id = v_plan_id limit 1;

  -- Compose: defaults + plan + org overrides
  select coalesce(jsonb_object_agg(key, default_value), '{}'::jsonb)
  into v_defaults
  from public.saas_features;

  select coalesce(jsonb_object_agg(feature_key, value), '{}'::jsonb)
  into v_plan
  from public.saas_plan_features
  where plan_id = v_plan_id;

  select coalesce(jsonb_object_agg(feature_key, value), '{}'::jsonb)
  into v_over
  from public.saas_org_feature_overrides
  where organization_id = p_organization_id
    and (expires_at is null or expires_at > now());

  v_features := v_defaults || v_plan || v_over;

  return jsonb_build_object(
    'features', v_features,
    'plan_id', v_plan_id,
    'plan_slug', v_plan_slug,
    'organization_id', p_organization_id
  );
end;
$$;

grant execute on function public.get_effective_features_for_org(uuid, uuid) to authenticated, anon;


