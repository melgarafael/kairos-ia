-- Master: Organization Sync System (History, Guardrails, Notify, RPC)
-- Safe, idempotent migration for MASTER Supabase

-- 1) Ensure required extensions
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pgcrypto') then
    create extension pgcrypto;
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    create extension pg_net;
  end if;
end $$;

-- 2) Ensure supporting settings table for sync webhooks (URL, secrets, flags)
create table if not exists public.saas_sync_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

-- Convenience upserts (no-ops if already set by ops):
insert into public.saas_sync_settings(key, value)
  values ('sync_org_to_client_enabled', 'true')
on conflict (key) do nothing;

-- 3) History table for auditing saas_organizations
create table if not exists public.saas_organizations_history (
  id bigserial primary key,
  saas_org_id uuid not null references public.saas_organizations(id) on delete cascade,
  action text not null check (action in ('insert','update','delete')),
  changed_at timestamptz not null default now(),
  changed_by uuid null,
  old_row jsonb,
  new_row jsonb
);

-- 3.1) Trigger function to log history
create or replace function public.fn_log_saas_org_history()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into public.saas_organizations_history(saas_org_id, action, changed_by, old_row, new_row)
    values (new.id, 'insert', null, null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.saas_organizations_history(saas_org_id, action, changed_by, old_row, new_row)
    values (new.id, 'update', null, to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.saas_organizations_history(saas_org_id, action, changed_by, old_row, new_row)
    values (old.id, 'delete', null, to_jsonb(old), null);
    return old;
  end if;
  return null;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_log_saas_org_history_aiu'
  ) then
    create trigger trg_log_saas_org_history_aiu
      after insert or update on public.saas_organizations
      for each row execute function public.fn_log_saas_org_history();
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_log_saas_org_history_ad'
  ) then
    create trigger trg_log_saas_org_history_ad
      after delete on public.saas_organizations
      for each row execute function public.fn_log_saas_org_history();
  end if;
end $$;

-- 4) Guardrail: prevent client_org_id change after set (immutable once assigned)
create or replace function public.fn_prevent_client_org_id_change()
returns trigger language plpgsql as $$
begin
  if (old.client_org_id is not null) and (new.client_org_id is distinct from old.client_org_id) then
    -- Allow controlled bypass via session setting set locally by a privileged function
    if coalesce(current_setting('app.allow_client_org_id_change', true), '0') <> '1' then
      raise exception 'client_org_id is immutable once set (old=%, new=%)', old.client_org_id, new.client_org_id
        using errcode = '22023';
    end if;
  end if;
  return new;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_prevent_client_org_id_change'
  ) then
    create trigger trg_prevent_client_org_id_change
      before update on public.saas_organizations
      for each row execute function public.fn_prevent_client_org_id_change();
  end if;
end $$;

-- 5) Constraint: ensure unique (owner_id, client_org_id) (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'saas_organizations_owner_client_unique'
  ) then
    alter table public.saas_organizations
      add constraint saas_organizations_owner_client_unique unique (owner_id, client_org_id);
  end if;
end $$;

-- Helpful indexes (idempotent)
create index if not exists idx_saas_orgs_client_org_id on public.saas_organizations(client_org_id);
create index if not exists idx_saas_orgs_owner_client on public.saas_organizations(owner_id, client_org_id);

-- 6) Notify trigger: on insert/update, ping Edge Function to propagate updates to Client
--    Uses settings table for URL and enable flag. Edge Function will securely read client creds.
create or replace function public.fn_notify_org_update_master()
returns trigger language plpgsql as $$
declare
  enabled text;
  webhook_url text;
  resp record;
  payload jsonb;
begin
  select value into enabled from public.saas_sync_settings where key = 'sync_org_to_client_enabled';
  if coalesce(enabled, 'false') <> 'true' then
    return null; -- disabled
  end if;
  select value into webhook_url from public.saas_sync_settings where key = 'sync_org_to_client_url';
  if coalesce(webhook_url, '') = '' then
    return null; -- not configured
  end if;

  if tg_op = 'INSERT' then
    payload := jsonb_build_object('event', 'insert', 'master_org_id', new.id);
  else
    payload := jsonb_build_object('event', 'update', 'master_org_id', new.id);
  end if;

  select * into resp from net.http_post(
    url := webhook_url,
    headers := jsonb_build_object('content-type','application/json'),
    body := payload
  );
  return null;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_notify_org_update_master_au'
  ) then
    create trigger trg_notify_org_update_master_au
      after insert or update on public.saas_organizations
      for each row execute function public.fn_notify_org_update_master();
  end if;
end $$;

-- 7) RPC: detect_orphan_organizations
--    Reports duplicates and anomalies within MASTER mapping; cross-database checks are handled by cron Edge function separately.
create or replace function public.detect_orphan_organizations()
returns table (
  issue text,
  owner_id uuid,
  master_org_id uuid,
  client_org_id uuid,
  conflict_ids uuid[]
) language sql as $$
with base as (
  select id as master_org_id, owner_id, client_org_id
  from public.saas_organizations
),
dups as (
  select owner_id, client_org_id, array_agg(master_org_id order by master_org_id) as ids
  from base
  where client_org_id is not null
  group by owner_id, client_org_id
  having count(*) > 1
),
null_client as (
  select owner_id, master_org_id, client_org_id
  from base
  where client_org_id is null
)
select 'duplicate_mapping'::text as issue, b.owner_id, null::uuid as master_org_id, b.client_org_id, d.ids as conflict_ids
from dups d
join base b on b.owner_id = d.owner_id and b.client_org_id = d.client_org_id
union all
select 'missing_client_org_id'::text as issue, n.owner_id, n.master_org_id, null::uuid as client_org_id, null::uuid[] as conflict_ids
from null_client n
order by issue;
$$;

-- 9) Controlled re-link function to change client_org_id safely (bypasses guard with session setting)
create or replace function public.relink_client_organization(
  p_master_org_id uuid,
  p_new_client_org_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.saas_organizations where id = p_master_org_id;
  if v_owner is null then
    raise exception 'Organization not found';
  end if;
  if v_owner <> p_user_id then
    raise exception 'Only owner can relink organization';
  end if;

  perform set_config('app.allow_client_org_id_change', '1', true);
  update public.saas_organizations
    set client_org_id = p_new_client_org_id,
        updated_at = now()
  where id = p_master_org_id;
  return true;
end
$$;

-- 8) Documentation notes for operators (no-op placeholders)
-- To enable propagation to client, configure:
--   insert into public.saas_sync_settings(key, value) values ('sync_org_to_client_url', 'https://<MASTER>.supabase.co/functions/v1/sync-org-to-client')
--     on conflict (key) do update set value = excluded.value, updated_at = now();
--   insert into public.saas_sync_settings(key, value) values ('sync_org_to_client_enabled', 'true')
--     on conflict (key) do update set value = excluded.value, updated_at = now();


