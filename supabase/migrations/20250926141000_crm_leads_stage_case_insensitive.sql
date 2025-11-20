/*
  Case-insensitive support for crm_leads.stage against crm_stages.name
  - Enforce uniqueness of (organization_id, lower(name)) in crm_stages
  - BEFORE INSERT/UPDATE trigger on crm_leads to fix the stage casing
    by replacing with the exact crm_stages.name for the org (if found)
  - Does NOT relax FK semantics (FK stays), but makes inputs tolerant to case
*/

begin;

-- 1) Unique constraint (by functional unique index) to avoid duplicates by case
create unique index if not exists crm_stages_org_lower_name_key
on public.crm_stages (organization_id, lower(name));

-- 2) Function to fix the stage case before FK check
create or replace function public.trg_crm_leads_fix_stage_case()
returns trigger
language plpgsql
as $$
declare
  v_name text;
begin
  -- Only when stage provided
  if new.stage is not null and trim(new.stage) <> '' then
    select s.name into v_name
    from public.crm_stages s
    where s.organization_id = new.organization_id
      and lower(s.name) = lower(new.stage)
    limit 1;

    if v_name is not null then
      new.stage := v_name; -- replace with exact cased name
    end if;
  end if;
  return new;
end;
$$;

-- 3) Install trigger (runs before FK validation)
drop trigger if exists trg_crm_leads_fix_stage_case on public.crm_leads;
create trigger trg_crm_leads_fix_stage_case
before insert or update on public.crm_leads
for each row execute function public.trg_crm_leads_fix_stage_case();

commit;


