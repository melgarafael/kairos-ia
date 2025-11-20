SET search_path = public, auth;

-- Update: compute effective features based on organization's plan and trial_ends_at
-- Never include this in Client AutoUpdater. Master-only migration.

create or replace function public.get_effective_features_for_org(p_user_id uuid, p_organization_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_org_master_id uuid;
  v_plan_id uuid;
  v_plan_effective_id uuid;
  v_plan_slug text;
  v_plan_effective_slug text;
  v_trial_ends_at timestamptz;
  v_defaults jsonb := '{}'::jsonb;
  v_plan jsonb := '{}'::jsonb;
  v_over jsonb := '{}'::jsonb;
  v_features jsonb := '{}'::jsonb;
begin
  if p_organization_id is null then
    return public.get_effective_features(p_user_id);
  end if;

  -- Resolve organization by Master id or Client id mirror
  select id, plan_id, trial_ends_at
  into v_org_master_id, v_plan_id, v_trial_ends_at
  from public.saas_organizations
  where id = p_organization_id or client_org_id = p_organization_id
  limit 1;

  if v_org_master_id is null then
    -- Unknown org: fallback to legacy user-based features
    return public.get_effective_features(p_user_id);
  end if;

  if v_plan_id is null then
    return jsonb_build_object('features','{}'::jsonb,'plan_id',null,'plan_slug',null,'organization_id',v_org_master_id);
  end if;

  -- Compute effective plan (swap to trial_expired when needed)
  select slug into v_plan_slug from public.saas_plans where id = v_plan_id limit 1;
  v_plan_effective_id := v_plan_id;

  if v_plan_slug = 'trial' and v_trial_ends_at is not null and v_trial_ends_at < now() then
    select id into v_plan_effective_id from public.saas_plans where slug = 'trial_expired' limit 1;
    if v_plan_effective_id is null then
      v_plan_effective_id := v_plan_id; -- safety fallback
    end if;
  end if;

  select slug into v_plan_effective_slug from public.saas_plans where id = v_plan_effective_id limit 1;

  -- Merge defaults + plan features + org overrides
  select coalesce(jsonb_object_agg(key, default_value), '{}'::jsonb)
  into v_defaults
  from public.saas_features;

  select coalesce(jsonb_object_agg(feature_key, value), '{}'::jsonb)
  into v_plan
  from public.saas_plan_features
  where plan_id = v_plan_effective_id;

  select coalesce(jsonb_object_agg(feature_key, value), '{}'::jsonb)
  into v_over
  from public.saas_org_feature_overrides
  where organization_id = v_org_master_id
    and (expires_at is null or expires_at > now());

  v_features := v_defaults || v_plan || v_over;

  return jsonb_build_object(
    'features', v_features,
    'plan_id', v_plan_id,
    'plan_effective_id', v_plan_effective_id,
    'plan_slug', v_plan_effective_slug,
    'plan_original_slug', v_plan_slug,
    'organization_id', v_org_master_id
  );
end;
$$;

grant execute on function public.get_effective_features_for_org(uuid, uuid) to authenticated, anon;

-- Delegate user-based computation to org when possible; otherwise, keep legacy behavior
create or replace function public.get_effective_features(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_org_id uuid;
  v_plan_id uuid;
  v_plan_effective_id uuid;
  v_plan_slug text;
  v_trial_ends_at timestamptz;
  v_defaults jsonb := '{}'::jsonb;
  v_plan jsonb := '{}'::jsonb;
  v_over jsonb := '{}'::jsonb;
  v_features jsonb := '{}'::jsonb;
begin
  select organization_id into v_user_org_id
  from public.saas_users
  where id = p_user_id
  limit 1;

  if v_user_org_id is not null then
    return public.get_effective_features_for_org(p_user_id, v_user_org_id);
  end if;

  -- Legacy path (no org selected): use user plan and trial_ends_at
  select plan_id, trial_ends_at into v_plan_id, v_trial_ends_at
  from public.saas_users
  where id = p_user_id
  limit 1;

  if v_plan_id is null then
    return jsonb_build_object('features','{}'::jsonb,'plan_id',null,'plan_slug',null,'organization_id',null);
  end if;

  select slug into v_plan_slug from public.saas_plans where id = v_plan_id limit 1;
  v_plan_effective_id := v_plan_id;

  if v_plan_slug = 'trial' and v_trial_ends_at is not null and v_trial_ends_at < now() then
    select id into v_plan_effective_id from public.saas_plans where slug = 'trial_expired' limit 1;
    if v_plan_effective_id is null then
      v_plan_effective_id := v_plan_id; -- safety fallback
    end if;
  end if;

  -- For consistency, surface the effective slug
  select slug into v_plan_slug from public.saas_plans where id = v_plan_effective_id limit 1;

  select coalesce(jsonb_object_agg(key, default_value), '{}'::jsonb)
  into v_defaults
  from public.saas_features;

  select coalesce(jsonb_object_agg(feature_key, value), '{}'::jsonb)
  into v_plan
  from public.saas_plan_features
  where plan_id = v_plan_effective_id;

  v_features := v_defaults || v_plan;

  return jsonb_build_object(
    'features', v_features,
    'plan_id', v_plan_id,
    'plan_effective_id', v_plan_effective_id,
    'plan_slug', v_plan_slug,
    'organization_id', null
  );
end;
$$;

grant execute on function public.get_effective_features(uuid) to authenticated, anon;


