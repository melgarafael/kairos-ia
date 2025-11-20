-- Master Supabase migration: Repository of user-owned Supabase connections
-- Purpose: Persist multiple Supabase connections per owner (saas_users.id)
-- Notes:
-- - This table is in the MASTER project. Apply manually (do NOT add to Client AutoUpdater)
-- - Policies allow each owner to read/write only their own rows

create extension if not exists pgcrypto;

create table if not exists public.saas_supabases_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.saas_users(id) on delete cascade,
  supabase_url text not null,
  -- anon/public key stored base64-encoded (compat with existing encrypted fields)
  anon_key_encrypted text not null,
  -- optional service-role key (base64-encoded)
  service_role_encrypted text,
  -- optional label/nickname for UX
  label text,
  -- optional project ref (extracted from supabase_url)
  project_ref text,
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Avoid duplicate rows of the exact same (owner, url, anon_key)
create unique index if not exists saas_supabases_connections_owner_url_uniq
  on public.saas_supabases_connections(owner_id, supabase_url);

create index if not exists saas_supabases_connections_owner_idx
  on public.saas_supabases_connections(owner_id);

-- Small helper to extract project ref (optional)
create or replace function public.extract_project_ref(p_url text)
returns text language sql immutable parallel safe as $$
  select case
           when p_url is null or trim(p_url) = '' then null
           else split_part(replace(split_part(p_url, '://', 2), 'supabase.co', ''), '.', 1)
         end
$$;

-- RLS
alter table public.saas_supabases_connections enable row level security;

-- Policies: owner can read/write own rows
drop policy if exists "ssc_owner_select" on public.saas_supabases_connections;
create policy "ssc_owner_select" on public.saas_supabases_connections
  for select to authenticated, anon
  using (owner_id = auth.uid());

drop policy if exists "ssc_owner_insert" on public.saas_supabases_connections;
create policy "ssc_owner_insert" on public.saas_supabases_connections
  for insert to authenticated, anon
  with check (owner_id = auth.uid());

drop policy if exists "ssc_owner_update" on public.saas_supabases_connections;
create policy "ssc_owner_update" on public.saas_supabases_connections
  for update to authenticated, anon
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Grants for app roles (fits existing pattern)
grant select, insert, update on public.saas_supabases_connections to anon, authenticated;

-- Trigger to keep project_ref and updated_at fresh
create or replace function public.ssc_before_ins_upd()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    if new.project_ref is null then
      new.project_ref := public.extract_project_ref(new.supabase_url);
    end if;
    new.updated_at := coalesce(new.updated_at, now());
    return new;
  elsif TG_OP = 'UPDATE' then
    if new.supabase_url is distinct from old.supabase_url and (new.project_ref is null or new.project_ref = old.project_ref) then
      new.project_ref := public.extract_project_ref(new.supabase_url);
    end if;
    new.updated_at := now();
    return new;
  end if;
  return new;
end
$$;

drop trigger if exists ssc_biu on public.saas_supabases_connections;
create trigger ssc_biu before insert or update on public.saas_supabases_connections
for each row execute function public.ssc_before_ins_upd();

comment on table public.saas_supabases_connections is 'Repository of user-owned Supabase connections (Master). Stores anon/service keys base64-encoded.';
comment on column public.saas_supabases_connections.anon_key_encrypted is 'Base64-encoded anon/public key';
comment on column public.saas_supabases_connections.service_role_encrypted is 'Base64-encoded service role key (optional)';


