-- Master registry for Client Schema Migrations (V2)
-- This file creates a canonical store for migrations and simple logging tables

set search_path = public;

-- Store of canonical migrations (source of truth for SQL)
create table if not exists public.master_migrations (
  version int primary key,
  name text not null,
  sql text not null,
  created_at timestamptz not null default now()
);

comment on table public.master_migrations is 'Canonical registry of client schema migrations (SQL stored here).';

-- RLS: somente service-role (bypassa RLS). Nenhuma policy aberta por padrão.
alter table public.master_migrations enable row level security;
-- Garantir que não existam policies herdadas antigas
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='master_migrations') then
    -- drop all existing policies for a clean slate
    execute (
      select string_agg(format('drop policy if exists %I on public.master_migrations;', polname), ' ')
      from pg_policies
      where schemaname='public' and tablename='master_migrations'
    );
  end if;
end$$;

-- Lightweight logs for runs per organization
create table if not exists public.client_migration_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  project_ref text,
  from_version int not null default 0,
  to_version int not null default 0,
  status text not null check (status in ('ok','error')),
  error text,
  steps jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_migration_logs_org_created_at
  on public.client_migration_logs(organization_id, created_at desc);

-- RLS for logs: only service-role/RPC. No open policies.
alter table public.client_migration_logs enable row level security;
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='client_migration_logs') then
    execute (
      select string_agg(format('drop policy if exists %I on public.client_migration_logs;', polname), ' ')
      from pg_policies
      where schemaname='public' and tablename='client_migration_logs'
    );
  end if;
end$$;

-- Optional: state/cooldown table (not strictly required by the function right now)
create table if not exists public.client_migration_state (
  organization_id text primary key,
  last_check_at timestamptz,
  last_status text,
  last_error text,
  last_applied_version int,
  lock_until timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.client_migration_state is 'Optional state/cooldown helpers for client migrations.';


