-- Extend feature gating: compute features by OWNER plan when a user is operating inside a member organization.
-- IMPORTANT: Master migration only. Do not include in Client auto-updater.
SET search_path = public, auth;

-- Function: get_effective_features_for_org(p_user_id, p_organization_id)
-- Returns a jsonb with effective features, plan_id and plan_slug considering the OWNER of the given organization.
create or replace function public.get_effective_features_for_org(p_user_id uuid, p_organization_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_plan_id uuid;
  v_plan_effective_id uuid;
  v_plan_slug text;
  v_trial_ends_at timestamptz;
  v_defaults jsonb := '{}'::jsonb;
  v_plan jsonb := '{}'::jsonb;
  v_over jsonb := '{}'::jsonb;
  v_features jsonb := '{}'::jsonb;
begin
  if p_organization_id is null then
    return public.get_effective_features(p_user_id);
  end if;

  -- Find owner_id from master mirror
  select owner_id into v_owner_id
  from public.saas_organizations
  where client_org_id = p_organization_id
  limit 1;

  if v_owner_id is null then
    -- Fallback: try to derive via inviter on membership
    select invited_by into v_owner_id
    from public.saas_memberships
    where saas_user_id = p_user_id and organization_id_in_client = p_organization_id
    limit 1;
  end if;

  if v_owner_id is null then
    -- No owner found, fallback to user features
    return public.get_effective_features(p_user_id);
  end if;

  -- Load owner's plan
  select plan_id, trial_ends_at into v_plan_id, v_trial_ends_at
  from public.saas_users
  where id = v_owner_id
  limit 1;

  if v_plan_id is null then
    return jsonb_build_object('features','{}'::jsonb,'plan_id',null,'plan_slug',null,'organization_id',p_organization_id);
  end if;

  select slug into v_plan_slug from public.saas_plans where id = v_plan_id limit 1;
  v_plan_effective_id := v_plan_id;

  -- Align with trial-expired override
  if v_plan_slug = 'trial' and v_trial_ends_at is not null and v_trial_ends_at < now() then
    select id into v_plan_effective_id from public.saas_plans where slug = 'trial_expired' limit 1;
    if v_plan_effective_id is null then
      v_plan_effective_id := v_plan_id; -- safety fallback
    end if;
  end if;

  -- Defaults + plan + org overrides
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


