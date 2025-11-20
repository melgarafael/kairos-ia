-- Member seats per organization controlled by plan + add-ons
set search_path = public, auth;

begin;

-- 1) saas_plans: add max_members_per_org if missing
do $$ begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'saas_plans' and column_name = 'max_members_per_org'
  ) then
    alter table public.saas_plans add column max_members_per_org int;
  end if;
end $$;

-- Set explicit defaults for known slugs; you can tune later via Admin panel
update public.saas_plans
  set max_members_per_org = case slug
    when 'trial' then 1
    when 'basic' then 2
    when 'professional' then 3
    when 'starter' then 2
    when 'pro' then 3
    else coalesce(max_members_per_org, 2)
  end
where coalesce(max_members_per_org, 0) = 0;

-- Explicit mapping for current production plan IDs
-- IDs provided by product: PRO, Starter, Trial
update public.saas_plans set max_members_per_org = 2 where id = 'd4836a79-186f-4905-bfac-77ec52fa1dde'; -- PRO: 2 convites (total 3 usuários com o dono)
update public.saas_plans set max_members_per_org = 1 where id = '8b5a1000-957c-4eaf-beca-954a78187337'; -- Starter: 1 convite (total 2 usuários com o dono)
update public.saas_plans set max_members_per_org = 0 where id = '4663da1a-b552-4127-b1af-4bc30c681682'; -- Trial: 0 convites

-- 2) Extra seats purchased per owner account (for all their orgs)
do $$ begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'saas_users' and column_name = 'member_seats_extra'
  ) then
    alter table public.saas_users add column member_seats_extra int not null default 0;
  end if;
end $$;

-- 3) Optional per-organization override (manual grant)
create table if not exists public.saas_org_member_overrides (
  organization_id uuid not null references public.saas_organizations(id) on delete cascade,
  max_members int not null,
  reason text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz,
  primary key (organization_id)
);

-- 4) Helper RPC to compute allowed seats for a given client org id
create or replace function public.get_org_member_quota(p_client_org_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_plan_id uuid;
  v_plan_limit int := 0;
  v_extra int := 0;
  v_override int := null;
begin
  -- Map master org
  select o.owner_id, coalesce(o.plan_id, u.plan_id)
    into v_owner_id, v_plan_id
  from public.saas_organizations o
  left join public.saas_users u on u.id = o.owner_id
  where o.client_org_id = p_client_org_id
  limit 1;

  if v_plan_id is not null then
    select coalesce(max_members_per_org, 0) into v_plan_limit from public.saas_plans where id = v_plan_id;
  end if;

  if v_owner_id is not null then
    select coalesce(member_seats_extra, 0) into v_extra from public.saas_users where id = v_owner_id;
  end if;

  select max_members into v_override 
  from public.saas_org_member_overrides
  where organization_id = (select id from public.saas_organizations where client_org_id = p_client_org_id limit 1)
    and (expires_at is null or expires_at > now());

  return jsonb_build_object(
    'allowed', coalesce(v_override, v_plan_limit + v_extra),
    'plan_limit', v_plan_limit,
    'extra', v_extra,
    'override', v_override
  );
end $$;

grant execute on function public.get_org_member_quota(uuid) to authenticated, anon;

-- 5) Admin helpers to set extras safely
create or replace function public.perform_member_seats_increment(p_user_id uuid, p_delta int)
returns void
language plpgsql
security definer
as $$
declare
  v_current int;
begin
  select member_seats_extra into v_current from public.saas_users where id = p_user_id for update;
  v_current := coalesce(v_current, 0);
  update public.saas_users set member_seats_extra = greatest(0, v_current + coalesce(p_delta,0)), updated_at = now() where id = p_user_id;
end $$;

grant execute on function public.perform_member_seats_increment(uuid, int) to service_role;

commit;


