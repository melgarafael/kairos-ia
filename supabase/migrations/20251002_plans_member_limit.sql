-- Plans: add max_members_per_org and org display name on memberships
set search_path = public, auth;

begin;

do $$ begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'saas_plans' and column_name = 'max_members_per_org'
  ) then
    alter table public.saas_plans add column max_members_per_org int;
  end if;
end $$;

-- Reasonable defaults if null (handled in app/edge)
update public.saas_plans set max_members_per_org = coalesce(max_members_per_org, case when slug='professional' then 50 when slug='basic' then 5 else 2 end);

-- memberships: optional display name for org
do $$ begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'saas_memberships' and column_name = 'organization_name'
  ) then
    alter table public.saas_memberships add column organization_name text;
  end if;
end $$;

commit;


