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


