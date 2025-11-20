-- Master migration: Auto-assign organization plan
-- Behavior:
-- - If it's the owner's first organization and NEW.plan_id is null, copy plan from saas_users.plan_id
-- - If it's NOT the first org and NEW.plan_id is null, default to 'trial_expired'
set search_path = public, auth;

create or replace function public.saas_org_before_insert_auto_plan()
returns trigger
language plpgsql
security definer
as $$
declare
  v_count int := 0;
  v_user_plan uuid := null;
  v_trial_expired uuid := null;
begin
  -- Only act when plan_id not provided
  if NEW.plan_id is not null then
    return NEW;
  end if;

  if NEW.owner_id is null then
    return NEW;
  end if;

  select count(*) into v_count from public.saas_organizations where owner_id = NEW.owner_id;
  select plan_id into v_user_plan from public.saas_users where id = NEW.owner_id limit 1;
  select id into v_trial_expired from public.saas_plans where slug = 'trial_expired' limit 1;

  if coalesce(v_count,0) = 0 then
    -- First org → inherit user's plan if available
    if NEW.plan_id is null then
      NEW.plan_id := v_user_plan;
    end if;
  else
    -- Next orgs → default to trial_expired when not specified
    if NEW.plan_id is null then
      NEW.plan_id := v_trial_expired;
    end if;
  end if;

  return NEW;
end
$$;

drop trigger if exists saas_org_bi_auto_plan on public.saas_organizations;
create trigger saas_org_bi_auto_plan
before insert on public.saas_organizations
for each row execute function public.saas_org_before_insert_auto_plan();


