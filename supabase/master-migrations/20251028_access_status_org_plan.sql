-- Master migration: Access status by organization plan/subscription
-- Goal: Compute allowed and plan info from saas_organizations + saas_subscriptions (organization scope)
set search_path = public, auth;

create or replace function public.get_access_status(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  u record;
  v_master_org_id uuid;
  v_plan_id uuid;
  v_plan_slug text;
  v_has_active_subscription boolean := false;
  v_current_period_end timestamptz := null;
begin
  select id, organization_id
  into u
  from public.saas_users
  where id = p_user_id;

  if not found then
    return jsonb_build_object('exists', false, 'allowed', false);
  end if;

  if u.organization_id is not null then
    -- Map client org id to master org id
    select id, plan_id into v_master_org_id, v_plan_id
    from public.saas_organizations
    where client_org_id = u.organization_id
    limit 1;

    if v_master_org_id is null then
      -- As a fallback, if client id equals a master id, allow direct match
      select id, plan_id into v_master_org_id, v_plan_id
      from public.saas_organizations
      where id = u.organization_id
      limit 1;
    end if;

    if v_master_org_id is not null then
      -- Active subscription by organization
      select exists(
        select 1 from public.saas_subscriptions s
        where s.organization_id = v_master_org_id
          and s.status = 'active'
          and (s.current_period_end is null or s.current_period_end > now())
      ) into v_has_active_subscription;

      -- latest period end (optional)
      select s.current_period_end into v_current_period_end
      from public.saas_subscriptions s
      where s.organization_id = v_master_org_id
      order by s.updated_at desc nulls last
      limit 1;

      if v_plan_id is not null then
        select slug into v_plan_slug from public.saas_plans where id = v_plan_id limit 1;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'exists', true,
    'has_active_subscription', v_has_active_subscription,
    'plan_id', v_plan_id,
    'plan_slug', v_plan_slug,
    'current_period_end', v_current_period_end,
    'allowed', coalesce(v_has_active_subscription, false)
  );
end;
$$;

grant execute on function public.get_access_status(uuid) to authenticated, anon;


