/*
  Case-insensitive fix for crm_leads.stage before FK check
  - Requires unique index on (organization_id, lower(name)) in crm_stages
  - BEFORE INSERT/UPDATE: if stage provided, replace by exact crm_stages.name
  - Does not invent values; if no match, keeps provided value (FK will enforce)
*/

begin;

-- 1) Unique functional index to prevent duplicates by case (idempotent)
create unique index if not exists crm_stages_org_lower_name_key
on public.crm_stages (organization_id, lower(name));

-- 2) Function
create or replace function public.trg_crm_leads_fix_stage_case()
returns trigger
language plpgsql
as $$
declare
  v_name text;
begin
  if new.stage is null or trim(new.stage) = '' then
    return new;
  end if;

  select s.name into v_name
  from public.crm_stages s
  where s.organization_id = new.organization_id
    and lower(s.name) = lower(new.stage)
  limit 1;

  if v_name is not null then
    new.stage := v_name;
  end if;

  return new;
end;
$$;

-- 3) Trigger
drop trigger if exists trg_crm_leads_fix_stage_case on public.crm_leads;
create trigger trg_crm_leads_fix_stage_case
before insert or update of stage on public.crm_leads
for each row
execute function public.trg_crm_leads_fix_stage_case();

commit;


insert into public.app_migrations (version, applied_at)
values ('57', now())
on conflict (version) do nothing;