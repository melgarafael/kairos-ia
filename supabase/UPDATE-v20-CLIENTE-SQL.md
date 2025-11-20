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

-- Add CNPJ and company_name to crm_leads
-- Create crm_lead_interests to link leads with produtos_servicos and quantities

begin;

-- Ensure pgcrypto for gen_random_uuid
create extension if not exists pgcrypto;

-- 1) New columns on crm_leads
alter table public.crm_leads
  add column if not exists cnpj text,
  add column if not exists company_name text;

-- 2) Interests table
create table if not exists public.crm_lead_interests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  produto_servico_id uuid not null references public.produtos_servicos(id) on delete restrict,
  quantity integer not null default 1 check (quantity >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, produto_servico_id)
);

-- 3) Indexes
create index if not exists idx_crm_lead_interests_lead on public.crm_lead_interests(lead_id);
create index if not exists idx_crm_lead_interests_prod on public.crm_lead_interests(produto_servico_id);
create index if not exists idx_crm_lead_interests_org on public.crm_lead_interests(organization_id);

-- 4) updated_at trigger
create or replace function public.trg_set_timestamp() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_crm_lead_interests on public.crm_lead_interests;
create trigger set_timestamp_crm_lead_interests
  before update on public.crm_lead_interests
  for each row execute function public.trg_set_timestamp();

commit;

-- Maintain crm_leads.value as sum of interested products (preco_base * quantity)
-- If no interests, keep existing value (manual). We will only update value when interests change;
-- if user set a manual value and there are interests, the trigger will compute and override.

begin;

create or replace function public.recalc_lead_value(p_lead_id uuid) returns void as $$
declare
  v_org uuid;
  v_sum numeric;
begin
  select organization_id into v_org from public.crm_leads where id = p_lead_id;

  -- Sum of preco_base * quantity for the same organization
  select coalesce(sum(ps.preco_base * li.quantity), 0)
    into v_sum
  from public.crm_lead_interests li
  join public.produtos_servicos ps
    on ps.id = li.produto_servico_id
   and ps.organization_id = li.organization_id
  where li.lead_id = p_lead_id;

  -- Update crm_leads.value if there are any interests
  if v_sum > 0 then
    update public.crm_leads
       set value = v_sum,
           updated_at = now()
     where id = p_lead_id;
  end if;
end;
$$ language plpgsql;

create or replace function public.trg_recalc_lead_value() returns trigger as $$
begin
  perform public.recalc_lead_value(coalesce(new.lead_id, old.lead_id));
  return new;
end;
$$ language plpgsql;

do $$
begin
  perform 1 from information_schema.tables
   where table_schema = 'public' and table_name = 'crm_lead_interests';
  if found then
    drop trigger if exists recalc_lead_value_ins on public.crm_lead_interests;
    create trigger recalc_lead_value_ins
      after insert on public.crm_lead_interests
      for each row execute function public.trg_recalc_lead_value();

    drop trigger if exists recalc_lead_value_upd on public.crm_lead_interests;
    create trigger recalc_lead_value_upd
      after update on public.crm_lead_interests
      for each row execute function public.trg_recalc_lead_value();

    drop trigger if exists recalc_lead_value_del on public.crm_lead_interests;
    create trigger recalc_lead_value_del
      after delete on public.crm_lead_interests
      for each row execute function public.trg_recalc_lead_value();
  end if;
end $$;

commit;




-- 7) Marcar versão
insert into public.app_migrations (version, applied_at)
values ('20', now())
on conflict (version) do nothing;