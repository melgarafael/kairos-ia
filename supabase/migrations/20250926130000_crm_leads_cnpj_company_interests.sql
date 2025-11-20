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


