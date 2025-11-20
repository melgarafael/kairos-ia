/*
  CRM Leads.stage -> enforce consistency with CRM Stages
  - Allow NULL on crm_leads.stage
  - Backfill existing values to match crm_stages.name (case-insensitive)
  - Null out unmatched values
  - Add composite FK (organization_id, stage) -> crm_stages(organization_id, name)
    with ON UPDATE CASCADE and ON DELETE SET NULL
  - Remove legacy normalization trigger/functions that forced canonical values
*/

begin;

-- 1) Drop legacy trigger and functions (idempotent)
drop trigger if exists trg_crm_leads_normalize_stage on public.crm_leads;
drop function if exists public.trg_crm_leads_normalize_stage();
drop function if exists public.normalize_stage_name(uuid, text);

-- 2) Allow NULL and drop default on crm_leads.stage
alter table public.crm_leads
  alter column stage drop default;

-- stage might already be nullable, but drop not null just in case
alter table public.crm_leads
  alter column stage drop not null;

-- 3) Backfill: normalize case to exact crm_stages.name when there is a match
update public.crm_leads l
set stage = s.name
from public.crm_stages s
where l.organization_id = s.organization_id
  and s.name is not null
  and l.stage is not null
  and trim(l.stage) <> ''
  and lower(l.stage) = lower(s.name);

-- 4) Cleanup: set to NULL when not matching any stage name for the same org
update public.crm_leads l
set stage = null
where l.stage is not null
  and trim(l.stage) <> ''
  and not exists (
    select 1
    from public.crm_stages s
    where s.organization_id = l.organization_id
      and s.name = l.stage
  );

-- Also null-out empty or 'null' textual values
update public.crm_leads
set stage = null
where stage is null
   or trim(coalesce(stage, '')) = ''
   or lower(coalesce(stage, '')) = 'null';

-- 5) Add helpful index for lookups by (organization_id, stage)
create index if not exists idx_crm_leads_org_stage on public.crm_leads(organization_id, stage);

-- 6) Add composite foreign key constraint
alter table public.crm_leads
  add constraint crm_leads_stage_fkey
  foreign key (organization_id, stage)
  references public.crm_stages(organization_id, name)
  on update cascade
  on delete set null;

commit;


