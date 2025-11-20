-- CRM Leads normalization (email/phone) + unique indexes per organization
-- Safe to run multiple times

-- 1) Normalization functions (immutable)
create or replace function public.normalize_email(p text) returns text
language sql immutable as $$
  select case when p is null then null else lower(trim(p)) end
$$;

create or replace function public.normalize_phone_e164_br(p text) returns text
language plpgsql immutable as $$
declare d text; begin
  if p is null then return null; end if;
  d := regexp_replace(p, '\\D', '', 'g');
  -- Se tiver 11 dígitos e não começar com 55, prefixar Brasil
  if length(d) = 11 and left(d, 2) <> '55' then
    d := '55' || d;
  end if;
  -- Aceitar números >= 10 dígitos (fixo sem DDI não vira válido)
  if length(d) >= 10 then
    return '+' || d;
  end if;
  return null;
end$$;

-- 2) Generated columns em crm_leads (sem triggers)
alter table public.crm_leads
  add column if not exists phone_normalized text generated always as (public.normalize_phone_e164_br(whatsapp)) stored,
  add column if not exists email_normalized text generated always as (public.normalize_email(email)) stored;

-- 3) Deduplicação defensiva antes dos índices únicos (prioridade telefone)
with d as (
  select id,
         row_number() over (partition by organization_id, phone_normalized order by updated_at desc, created_at desc, id desc) as rn
  from public.crm_leads
  where phone_normalized is not null
)
delete from public.crm_leads l
using d
where l.id = d.id and d.rn > 1;

with d as (
  select id,
         row_number() over (partition by organization_id, email_normalized order by updated_at desc, created_at desc, id desc) as rn
  from public.crm_leads
  where email_normalized is not null
)
delete from public.crm_leads l
using d
where l.id = d.id and d.rn > 1;

-- 4) Índices (únicos parciais para dedupe e leitura por organização)
create unique index if not exists uniq_crm_leads_org_phone
  on public.crm_leads(organization_id, phone_normalized)
  where phone_normalized is not null;

create unique index if not exists uniq_crm_leads_org_email
  on public.crm_leads(organization_id, email_normalized)
  where email_normalized is not null;

create index if not exists crm_leads_org_created_at_idx
  on public.crm_leads(organization_id, created_at desc);


