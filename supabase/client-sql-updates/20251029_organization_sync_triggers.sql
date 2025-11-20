-- CLIENT: Organization -> MASTER sync via HTTP webhook
-- Requires pg_net extension enabled in Client Supabase

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pgcrypto') then
    create extension pgcrypto;
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    create extension pg_net;
  end if;
end $$;

create table if not exists public.saas_sync_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

-- Expected keys to be configured by ops:
--  - sync_org_to_master_url: https://<MASTER>.supabase.co/functions/v1/sync-org-to-master
--  - sync_org_webhook_secret: shared secret for X-Sync-Secret header
insert into public.saas_sync_settings(key, value) values ('sync_org_to_master_enabled', 'true')
on conflict (key) do nothing;

create or replace function public.fn_notify_master_on_client_org_change()
returns trigger language plpgsql as $$
declare
  enabled text;
  webhook_url text;
  secret text;
  payload jsonb;
  resp record;
begin
  select value into enabled from public.saas_sync_settings where key = 'sync_org_to_master_enabled';
  if coalesce(enabled, 'false') <> 'true' then
    return null;
  end if;
  select value into webhook_url from public.saas_sync_settings where key = 'sync_org_to_master_url';
  select value into secret from public.saas_sync_settings where key = 'sync_org_webhook_secret';
  if coalesce(webhook_url,'') = '' or coalesce(secret,'') = '' then
    return null;
  end if;

  if tg_op = 'INSERT' then
    payload := jsonb_build_object('event','insert','organization', to_jsonb(new), 'owner_id', new.owner_id);
  elsif tg_op = 'UPDATE' then
    payload := jsonb_build_object('event','update','organization', to_jsonb(new), 'owner_id', new.owner_id);
  elsif tg_op = 'DELETE' then
    payload := jsonb_build_object('event','delete','organization', to_jsonb(old), 'owner_id', old.owner_id);
  else
    return null;
  end if;

  select * into resp from net.http_post(
    url := webhook_url,
    headers := jsonb_build_object('content-type','application/json','x-sync-secret', secret),
    body := payload
  );
  return null;
end
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_sync_org_to_master_aiud') then
    create trigger trg_sync_org_to_master_aiud
      after insert or update or delete on public.saas_organizations
      for each row execute function public.fn_notify_master_on_client_org_change();
  end if;
end $$;


