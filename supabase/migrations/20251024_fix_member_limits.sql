-- Fix member limits per plan and ensure explicit values for production IDs
set search_path = public, auth;

do $$ begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'saas_plans' and column_name = 'max_members_per_org'
  ) then
    alter table public.saas_plans add column max_members_per_org int;
  end if;
end $$;

-- Defaults by slug (Trial=0, Starter=1, Pro=2). Keep idempotent.
update public.saas_plans
  set max_members_per_org = case slug
    when 'trial' then 0
    when 'starter' then 1
    when 'pro' then 2
    when 'basic' then 1
    when 'professional' then 2
    else coalesce(max_members_per_org, 0)
  end
where coalesce(max_members_per_org, -1) <> case slug
  when 'trial' then 0
  when 'starter' then 1
  when 'pro' then 2
  when 'basic' then 1
  when 'professional' then 2
  else coalesce(max_members_per_org, 0)
end;

-- Explicit production IDs mapping for Starter/Pro/Trial
do $$ begin
  begin
    update public.saas_plans set max_members_per_org = 2 where id = 'd4836a79-186f-4905-bfac-77ec52fa1dde'; -- PRO → 2 convites (3 com o owner)
  exception when others then null; end;
  begin
    update public.saas_plans set max_members_per_org = 1 where id = '8b5a1000-957c-4eaf-beca-954a78187337'; -- STARTER → 1 convite (2 com o owner)
  exception when others then null; end;
  begin
    update public.saas_plans set max_members_per_org = 0 where id = '4663da1a-b552-4127-b1af-4bc30c681682'; -- TRIAL → 0 convites
  exception when others then null; end;
end $$;

-- Optional safety: ensure value not null
update public.saas_plans set max_members_per_org = 0 where max_members_per_org is null;


