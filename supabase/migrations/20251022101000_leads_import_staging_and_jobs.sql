-- Leads import pipeline: staging (UNLOGGED) and jobs table

-- Staging table for bulk import (fast inserts, no WAL)
create unlogged table if not exists public.crm_leads_import_staging (
  import_id uuid not null,
  organization_id uuid not null,
  row_num int,
  name text,
  whatsapp text,
  email text,
  phone_normalized text,
  email_normalized text,
  stage text,
  value numeric(10,2),
  source text,
  canal text,
  description text,
  created_at timestamptz default now()
);

create index if not exists crm_leads_import_staging_idx
  on public.crm_leads_import_staging(import_id, organization_id);

-- Jobs table to track progress and errors
create table if not exists public.crm_leads_import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.saas_organizations(id) on delete cascade,
  filename text,
  total_rows int default 0,
  staged_rows int default 0,
  processed_rows int default 0,
  duplicate_rows int default 0,
  invalid_rows int default 0,
  status text not null default 'staging', -- staging|queued|processing|done|failed|cancelled
  error text,
  created_at timestamptz default now(),
  started_at timestamptz,
  finished_at timestamptz
);


