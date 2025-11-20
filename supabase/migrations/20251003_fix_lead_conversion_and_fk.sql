-- Fix lead conversion flow and allow deleting clients referenced by converted leads
-- Changes:
-- 1) Recreate FK crm_leads.converted_client_id -> clients.id with ON DELETE SET NULL
-- 2) Restore auto-convert trigger to actually mark converted_client_id
-- 3) Backfill converted_client_id for existing data and realign show_in_kanban

begin;

-- 1) Recreate FK with ON DELETE SET NULL (previously NO ACTION)
alter table if exists public.crm_leads
  drop constraint if exists crm_leads_converted_client_id_fkey;

alter table public.crm_leads
  add constraint crm_leads_converted_client_id_fkey
  foreign key (converted_client_id)
  references public.clients(id)
  on update cascade
  on delete set null;

-- 2) Restore auto-convert trigger to mark the lead as converted
create or replace function public.trg_auto_convert_on_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if coalesce(old.stage, '') is distinct from coalesce(new.stage, '') then
      if lower(coalesce(new.stage, '')) in ('fechado', 'fechado ganho', 'ganho', 'venda fechada') then
        -- Avoid double work if already converted
        if new.converted_client_id is null then
          perform public.convert_lead_to_client(new.id);
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists auto_convert_on_close on public.crm_leads;
create trigger auto_convert_on_close
  after update on public.crm_leads
  for each row execute function public.trg_auto_convert_on_close();

-- 3a) Backfill: set converted_client_id where we can match an existing client by phone/email in same org
with matches as (
  select l.id as lead_id, c.id as client_id
  from public.crm_leads l
  join public.clients c
    on c.organization_id = l.organization_id
   and (
     (l.whatsapp is not null and nullif(trim(l.whatsapp), '') is not null and c.telefone = trim(l.whatsapp))
     or (l.email is not null and nullif(trim(l.email), '') is not null and c.email = trim(l.email))
   )
  where l.converted_client_id is null
)
update public.crm_leads l
set converted_client_id = m.client_id,
    converted_at = coalesce(l.converted_at, now())
from matches m
where l.id = m.lead_id;

-- 3b) Realign show_in_kanban flag if the column exists
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'crm_leads'
      and column_name = 'show_in_kanban'
  ) then
    update public.crm_leads
    set show_in_kanban = case when converted_client_id is not null then false else true end;
  end if;
end $$;

commit;


