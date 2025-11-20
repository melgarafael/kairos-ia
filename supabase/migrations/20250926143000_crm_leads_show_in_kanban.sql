/*
  Visibility control for Kanban: crm_leads.show_in_kanban
  - Adds boolean column with default TRUE
  - Backfills: converted leads => FALSE, others => TRUE
  - BEFORE UPDATE trigger: when converted_client_id transitions from NULL to NOT NULL, set show_in_kanban=FALSE
*/

begin;

-- 1) Column
alter table public.crm_leads
  add column if not exists show_in_kanban boolean not null default true;

-- 2) Backfill
update public.crm_leads
set show_in_kanban = case when converted_client_id is not null then false else true end;

-- 3) Trigger to auto-hide on conversion (only on first transition)
create or replace function public.trg_crm_leads_hide_on_conversion()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if (old.converted_client_id is null and new.converted_client_id is not null) then
      new.show_in_kanban := false;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_crm_leads_hide_on_conversion on public.crm_leads;
create trigger trg_crm_leads_hide_on_conversion
before update on public.crm_leads
for each row execute function public.trg_crm_leads_hide_on_conversion();

commit;


