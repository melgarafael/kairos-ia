-- Master migration: Normalize per-organization Supabase credentials
-- Use ONLY the client_* columns on public.saas_organizations (MASTER). Remove any unused columns accidentally added.

do $$
begin
  -- Ensure desired columns exist (idempotent)
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saas_organizations' and column_name = 'client_supabase_url'
  ) then
    alter table public.saas_organizations add column client_supabase_url text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saas_organizations' and column_name = 'client_anon_key_encrypted'
  ) then
    alter table public.saas_organizations add column client_anon_key_encrypted text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saas_organizations' and column_name = 'client_service_key_encrypted'
  ) then
    alter table public.saas_organizations add column client_service_key_encrypted text;
  end if;

  -- Drop unintended columns if they exist
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saas_organizations' and column_name = 'supabase_url'
  ) then
    alter table public.saas_organizations drop column if exists supabase_url;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saas_organizations' and column_name = 'supabase_key_encrypted'
  ) then
    alter table public.saas_organizations drop column if exists supabase_key_encrypted;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saas_organizations' and column_name = 'service_role_encrypted'
  ) then
    alter table public.saas_organizations drop column if exists service_role_encrypted;
  end if;

  -- Optional metadata/convenience indexes
  create index if not exists idx_saas_orgs_client_org_id on public.saas_organizations (client_org_id);
  create index if not exists idx_saas_orgs_owner_client on public.saas_organizations (owner_id, client_org_id);
end $$;

-- Notes:
-- - client_anon_key_encrypted: anon/public key (compat)
-- - client_service_key_encrypted: service_role (backend tasks prefer este campo)
-- - client_supabase_url: URL do Supabase do cliente por organização


