-- Add 'internal' provider and session status fields for WhatsApp integrations
-- Safe-check drop of existing provider CHECK constraint and recreate with new set

do $$
declare
  constraint_name text;
begin
  select pc.conname into constraint_name
  from pg_constraint pc
  join pg_class c on c.oid = pc.conrelid and c.relname = 'whatsapp_integrations'
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where pc.contype = 'c'
    and pc.conkey = (
      select array_agg(attnum order by attnum)
      from pg_attribute
      where attrelid = c.oid and attname = 'provider'
    );

  if constraint_name is not null then
    execute format('alter table public.whatsapp_integrations drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.whatsapp_integrations
  add constraint whatsapp_integrations_provider_check
  check (provider in ('zapi','evolution','internal'));

-- Session status fields (for internal provider)
alter table public.whatsapp_integrations
  add column if not exists device_jid text,
  add column if not exists pairing_status text,
  add column if not exists connected_at timestamptz,
  add column if not exists last_seen timestamptz;


