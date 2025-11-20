-- WhatsApp schema for client Supabase
-- Tables: integrations, contacts, conversations, messages, events (optional)

-- Enable pgcrypto for UUIDs if not already
create extension if not exists pgcrypto;

-- Integrations
create table if not exists public.whatsapp_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  provider text not null check (provider in ('zapi','evolution')),
  instance_id text not null,
  instance_token text,
  client_token text not null,
  base_url text,
  is_active boolean not null default true,
  webhook_secret text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only one active integration per organization
create unique index if not exists uniq_whatsapp_integration_active
  on public.whatsapp_integrations (organization_id)
  where is_active = true;

-- Contacts
create table if not exists public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  phone_e164 text not null,
  name text,
  lead_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uniq_whatsapp_contact_phone
  on public.whatsapp_contacts (organization_id, phone_e164);

-- Conversations
create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  contact_id uuid not null references public.whatsapp_contacts(id) on delete cascade,
  lead_id text,
  status text not null default 'open' check (status in ('open','closed')),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uniq_whatsapp_conversation_contact
  on public.whatsapp_conversations (organization_id, contact_id);

-- Messages
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  type text not null check (type in ('text','image','audio','document')),
  body text,
  media_url text,
  media_mime text,
  provider_message_id text,
  status text check (status in ('queued','sent','delivered','read','failed')),
  error text,
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_messages_conv_time
  on public.whatsapp_messages (conversation_id, timestamp desc);

-- Events (optional)
create table if not exists public.whatsapp_events (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  provider text not null,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- RLS (permissive for development: allow authenticated users)
alter table public.whatsapp_integrations enable row level security;
alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_integrations'
  ) then
    create policy whatsapp_integrations_select on public.whatsapp_integrations for select to authenticated using (true);
    create policy whatsapp_integrations_modify on public.whatsapp_integrations for all to authenticated using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_contacts'
  ) then
    create policy whatsapp_contacts_select on public.whatsapp_contacts for select to authenticated using (true);
    create policy whatsapp_contacts_modify on public.whatsapp_contacts for all to authenticated using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_conversations'
  ) then
    create policy whatsapp_conversations_select on public.whatsapp_conversations for select to authenticated using (true);
    create policy whatsapp_conversations_modify on public.whatsapp_conversations for all to authenticated using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_messages'
  ) then
    create policy whatsapp_messages_select on public.whatsapp_messages for select to authenticated using (true);
    create policy whatsapp_messages_modify on public.whatsapp_messages for all to authenticated using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_events'
  ) then
    create policy whatsapp_events_select on public.whatsapp_events for select to authenticated using (true);
    create policy whatsapp_events_modify on public.whatsapp_events for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Storage bucket for media
insert into storage.buckets (id, name, public)
select 'whatsapp-media', 'whatsapp-media', false
where not exists (select 1 from storage.buckets where id = 'whatsapp-media');

-- Ensure ON CONFLICT target exists for whatsapp_integrations
-- We allow one row per (organization_id, provider) and at most one active per org (kept by partial index)

-- Create a unique index usable by ON CONFLICT
create unique index if not exists uniq_whatsapp_integration_org_provider
  on public.whatsapp_integrations (organization_id, provider);

-- Dev policy: allow anon role to read/write WhatsApp tables (front uses anon client without user session)
-- NOTE: For production, restrict to authenticated or move writes to Edge Functions.

alter table public.whatsapp_integrations enable row level security;

do $$
begin
  -- Allow anon for select/insert/update/delete (dev only)
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_integrations' and policyname = 'whatsapp_integrations_select_anon'
  ) then
    create policy whatsapp_integrations_select_anon on public.whatsapp_integrations for select to anon using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_integrations' and policyname = 'whatsapp_integrations_modify_anon'
  ) then
    create policy whatsapp_integrations_modify_anon on public.whatsapp_integrations for all to anon using (true) with check (true);
  end if;
end $$;

-- Allow anon read on WhatsApp tables so UI can list content (dev). For prod, restrict.

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='whatsapp_contacts' and policyname='whatsapp_contacts_select_anon') then
    create policy whatsapp_contacts_select_anon on public.whatsapp_contacts for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='whatsapp_conversations' and policyname='whatsapp_conversations_select_anon') then
    create policy whatsapp_conversations_select_anon on public.whatsapp_conversations for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='whatsapp_messages' and policyname='whatsapp_messages_select_anon') then
    create policy whatsapp_messages_select_anon on public.whatsapp_messages for select to anon using (true);
  end if;
end $$;

-- Dev-only: allow anon inserts/updates/deletes for WhatsApp tables so Edge Function (using anon key) can write
-- For production, prefer using client's service role in the Edge or tightening policies to specific JWT claims.

alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='whatsapp_contacts' and policyname='whatsapp_contacts_modify_anon') then
    create policy whatsapp_contacts_modify_anon on public.whatsapp_contacts for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='whatsapp_conversations' and policyname='whatsapp_conversations_modify_anon') then
    create policy whatsapp_conversations_modify_anon on public.whatsapp_conversations for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='whatsapp_messages' and policyname='whatsapp_messages_modify_anon') then
    create policy whatsapp_messages_modify_anon on public.whatsapp_messages for all to anon using (true) with check (true);
  end if;
end $$;


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


-- Create whatsapp_instances table for per-organization instances and tokens
-- RLS enabled; no direct client access expected (managed via Edge Functions with service role)

create table if not exists public.whatsapp_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  instance_id text not null,
  instance_token text not null,
  client_token text not null,
  is_active boolean not null default true,
  status text null,
  device_jid text null,
  connected_at timestamptz null,
  webhook_url text null,
  events text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- uniqueness: one instance_id per org; also unique tokens
create unique index if not exists whatsapp_instances_org_instance_uidx on public.whatsapp_instances (organization_id, instance_id);
create unique index if not exists whatsapp_instances_instance_token_uidx on public.whatsapp_instances (instance_token);
create unique index if not exists whatsapp_instances_client_token_uidx on public.whatsapp_instances (client_token);
create index if not exists whatsapp_instances_org_idx on public.whatsapp_instances (organization_id);

alter table public.whatsapp_instances enable row level security;

-- Optional helper trigger to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_on_whatsapp_instances on public.whatsapp_instances;
create trigger set_timestamp_on_whatsapp_instances
before update on public.whatsapp_instances
for each row execute function public.set_updated_at();


-- Fix: allow deleting leads referenced by appointments
-- Context: Previously, the FK appointments.lead_id -> crm_leads.id had no
--          ON DELETE action (default NO ACTION). Deleting a lead with linked
--          appointments failed with a foreign key violation.
-- Decision: Align with other relationships (clients/collaborators/org) and
--           cascade delete appointments tied exclusively to a lead.
--           This avoids violating the CHECK constraint that enforces exactly
--           one of (client_id, lead_id) is set.

begin;

-- Drop existing FK if present
alter table if exists public.appointments
  drop constraint if exists appointments_lead_id_fkey;

-- Recreate FK with ON DELETE CASCADE
alter table public.appointments
  add constraint appointments_lead_id_fkey
  foreign key (lead_id)
  references public.crm_leads(id)
  on delete cascade;

commit;

-- Add avatar_url for WhatsApp contacts and enforce unique provider message ids

-- Add avatar_url column if missing
alter table if exists public.whatsapp_contacts
  add column if not exists avatar_url text;

-- Unique provider message id per organization (ignore nulls)
create unique index if not exists uniq_whatsapp_msg_provider_id
  on public.whatsapp_messages (organization_id, provider_message_id)
  where provider_message_id is not null;

-- Helpful index for conversations ordering
create index if not exists idx_whatsapp_conversations_last_msg
  on public.whatsapp_conversations (organization_id, last_message_at desc);

-- Add last_message_preview and unread_count to whatsapp_conversations

alter table if exists public.whatsapp_conversations
  add column if not exists last_message_preview text,
  add column if not exists unread_count integer not null default 0;


-- Add instance_id to whatsapp_messages and helpful indexes

alter table if exists public.whatsapp_messages
  add column if not exists instance_id text;

-- Index to filter by instance efficiently
create index if not exists idx_whatsapp_messages_org_instance_time
  on public.whatsapp_messages (organization_id, instance_id, timestamp desc);



-- RLS policies for whatsapp_instances to allow Edge (anon key) to operate

alter table if exists public.whatsapp_instances enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'whatsapp_instances' and policyname = 'whatsapp_instances_select_anon'
  ) then
    create policy whatsapp_instances_select_anon on public.whatsapp_instances for select to anon using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'whatsapp_instances' and policyname = 'whatsapp_instances_modify_anon'
  ) then
    create policy whatsapp_instances_modify_anon on public.whatsapp_instances for all to anon using (true) with check (true);
  end if;
end $$;


-- Add client_token to saas_organizations and auto-generate for new/existing rows

create extension if not exists pgcrypto;

alter table if exists public.saas_organizations
  add column if not exists client_token text;

-- Backfill missing tokens with random hex
update public.saas_organizations
set client_token = encode(gen_random_bytes(16), 'hex')
where client_token is null;

-- Enforce uniqueness and presence going forward
create unique index if not exists saas_organizations_client_token_uidx on public.saas_organizations (client_token);

-- Trigger to set client_token on insert if missing
create or replace function public.set_client_token_if_missing()
returns trigger as $$
begin
  if new.client_token is null then
    new.client_token = encode(gen_random_bytes(16), 'hex');
  end if;
  return new;
end;
$$ language plpgsql;

do $$
begin
  if exists (
    select 1 from information_schema.tables where table_schema = 'public' and table_name = 'saas_organizations'
  ) then
    drop trigger if exists trg_set_client_token_if_missing on public.saas_organizations;
    create trigger trg_set_client_token_if_missing
    before insert on public.saas_organizations
    for each row execute function public.set_client_token_if_missing();
  end if;
end $$;


-- Link whatsapp_integrations to whatsapp_instances via FKs

-- Ensure whatsapp_instances has unique instance_id and instance_token (already created earlier)
create unique index if not exists whatsapp_instances_instance_uidx on public.whatsapp_instances (instance_id);

-- BACKFILL: create whatsapp_instances rows for existing integrations before adding FKs
-- Only for rows where organization_id looks like a UUID
with src as (
  select 
    wi.organization_id::uuid as org_id,
    wi.instance_id,
    coalesce(nullif(wi.instance_token, ''), encode(gen_random_bytes(24), 'hex')) as instance_token,
    coalesce(org.client_token, encode(gen_random_bytes(24), 'hex')) as client_token
  from public.whatsapp_integrations wi
  left join public.saas_organizations org on org.id = (wi.organization_id::uuid)
  where wi.organization_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
)
insert into public.whatsapp_instances (organization_id, instance_id, instance_token, client_token, is_active)
select s.org_id, s.instance_id, s.instance_token, s.client_token, true
from src s
on conflict (organization_id, instance_id) do update
set instance_token = excluded.instance_token
where public.whatsapp_instances.instance_token is null;

-- Ensure whatsapp_integrations.instance_token matches the instance row
update public.whatsapp_integrations wi
set instance_token = inst.instance_token
from public.whatsapp_instances inst
where wi.instance_id = inst.instance_id
  and wi.organization_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and inst.organization_id = wi.organization_id::uuid
  and (wi.instance_token is null or wi.instance_token <> inst.instance_token);

-- Add FKs as NOT VALID first to avoid failing during backfill
alter table if exists public.whatsapp_integrations
  add constraint fk_whatsapp_integ_instance_id
  foreign key (instance_id) references public.whatsapp_instances(instance_id)
  on update cascade on delete set null not valid;

alter table if exists public.whatsapp_integrations
  add constraint fk_whatsapp_integ_instance_token
  foreign key (instance_token) references public.whatsapp_instances(instance_token)
  on update cascade on delete set null not valid;

-- Validate after backfill
alter table if exists public.whatsapp_integrations validate constraint fk_whatsapp_integ_instance_id;
alter table if exists public.whatsapp_integrations validate constraint fk_whatsapp_integ_instance_token;


-- Add avatar_url column to whatsapp_contacts if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'whatsapp_contacts' 
        AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE whatsapp_contacts 
        ADD COLUMN avatar_url text;
    END IF;
END $$;


-- Adicionar campo has_whatsapp para indicar se o lead tem WhatsApp verificado
ALTER TABLE crm_leads 
ADD COLUMN IF NOT EXISTS has_whatsapp BOOLEAN DEFAULT false;

-- Criar índice para buscar leads com WhatsApp rapidamente
CREATE INDEX IF NOT EXISTS idx_crm_leads_has_whatsapp 
ON crm_leads(has_whatsapp) 
WHERE has_whatsapp = true;

-- Comentário explicativo
COMMENT ON COLUMN crm_leads.has_whatsapp IS 'Indica se o número do lead foi verificado e tem WhatsApp ativo';



insert into public.app_migrations (version, applied_at)
values ('7', now())
on conflict (version) do nothing;