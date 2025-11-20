-- Master Migration: Update Tours infra (saas_users.tour_update_version + updates_tour)

begin;

-- 1) Column on saas_users: tour_update_version
alter table public.saas_users
  add column if not exists tour_update_version integer;

-- Backfill: set 0 for existing users where null
update public.saas_users set tour_update_version = 0 where tour_update_version is null;

-- 2) Table updates_tour: single row with current_version + optional title/notes
create table if not exists public.updates_tour (
  id uuid primary key default gen_random_uuid(),
  current_version integer not null default 1,
  title text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure at least one row exists (idempotent)
do $$
begin
  if not exists (select 1 from public.updates_tour) then
    insert into public.updates_tour (current_version, title, notes)
    values (1, 'v1 – Prompts n8n, Trilha de Monetização, CNPJ + Produtos em Leads', 'Primeiro update tour');
  end if;
end $$;

-- Trigger to keep updated_at fresh
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

drop trigger if exists updates_tour_set_updated_at on public.updates_tour;
create trigger updates_tour_set_updated_at
before update on public.updates_tour
for each row execute function public.update_updated_at();

commit;


