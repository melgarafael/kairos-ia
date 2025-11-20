-- Sincronização automática de migrações para master_migrations
-- Este arquivo foi gerado automaticamente pelo script sync-master-migrations.mjs
-- Data: 2025-11-11T20:42:31.604Z
-- Total de migrações: 82

set search_path = public;

-- Garantir que a tabela existe
create table if not exists public.master_migrations (
  version int primary key,
  name text not null,
  sql text not null,
  created_at timestamptz not null default now()
);

-- Inserir/atualizar todas as migrações

-- v3
insert into public.master_migrations(version, name, sql)
values (
  3,
  'v3 - CRM Stage Normalization',
  $mig_v3$/*
  CRM Stage Normalization
  - Aliases por organização
  - Função normalize_stage_name
  - Trigger BEFORE INSERT/UPDATE em crm_leads
  - Backfill inicial de sinônimos óbvios
*/

-- 1) Tabela de aliases por organização
create table if not exists public.crm_stage_aliases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.saas_organizations(id) on delete cascade,
  alias text not null,
  canonical text not null, -- valores canônicos: novo, contato, proposta, negociacao, fechado, perdido
  created_at timestamptz default now(),
  unique (organization_id, alias)
);

-- 2) Função de normalização
create or replace function public.normalize_stage_name(p_org uuid, p_raw text)
returns text
language plpgsql
as $$
declare
  v_raw text := coalesce(trim(lower(p_raw)), '');
  v_result text := null;
begin
  if v_raw = '' then
    return 'novo';
  end if;

  -- a) tenta achar em aliases
  select a.canonical into v_result
  from public.crm_stage_aliases a
  where a.organization_id = p_org and a.alias = v_raw
  limit 1;

  if v_result is not null then
    return v_result;
  end if;

  -- b) dicionário padrão
  if v_raw in ('novo','novo lead','topo','inicio','início') then
    return 'novo';
  elseif v_raw in ('contato','contato inicial','em contato') then
    return 'contato';
  elseif v_raw in ('proposta','proposta enviada') then
    return 'proposta';
  elseif v_raw in ('negociacao','negociação','em negociacao','em negociação') then
    return 'negociacao';
  elseif v_raw in ('fechado','fechado ganho','ganho','venda fechada') then
    return 'fechado';
  elseif v_raw in ('perdido','fechado perdido','venda perdida') then
    return 'perdido';
  end if;

  -- c) fallback: mantém value em minúsculas (evita nulo)
  return v_raw;
end;
$$;

-- 3) Trigger
create or replace function public.trg_crm_leads_normalize_stage()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.stage := public.normalize_stage_name(new.organization_id, new.stage);
  elsif tg_op = 'UPDATE' then
    if new.stage is distinct from old.stage then
      new.stage := public.normalize_stage_name(new.organization_id, new.stage);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_crm_leads_normalize_stage on public.crm_leads;
create trigger trg_crm_leads_normalize_stage
before insert or update on public.crm_leads
for each row execute function public.trg_crm_leads_normalize_stage();

-- 4) Backfill de dados existentes (idempotente)
update public.crm_leads l
set stage = public.normalize_stage_name(l.organization_id, l.stage)
where true;

-- v3 - CRM Stage Normalization (aliases, function, trigger, backfill)$mig_v3$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v4
insert into public.master_migrations(version, name, sql)
values (
  4,
  'v4 - Migration 4',
  $mig_v4$BEGIN;

LOCK TABLE public.produtos_servicos IN SHARE ROW EXCLUSIVE MODE;

-- 1) Colunas
ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS cobranca_tipo text;

ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS estoque_quantidade numeric;

ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS tem_estoque boolean;

-- 2) Default
ALTER TABLE public.produtos_servicos
  ALTER COLUMN tem_estoque SET DEFAULT false;

-- 3) Constraint CHECK (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'produtos_servicos_cobranca_tipo_chk'
      AND n.nspname = 'public'
      AND t.relname = 'produtos_servicos'
  ) THEN
    ALTER TABLE public.produtos_servicos
      ADD CONSTRAINT produtos_servicos_cobranca_tipo_chk
      CHECK (cobranca_tipo IN ('unica','mensal','trimestral','semestral','anual')) NOT VALID;
  END IF;
END
$$;

-- 4) Validar a constraint (pode falhar se houver dados inválidos)
ALTER TABLE public.produtos_servicos
  VALIDATE CONSTRAINT produtos_servicos_cobranca_tipo_chk;

-- 5) Comentários
COMMENT ON COLUMN public.produtos_servicos.cobranca_tipo IS 'Tipo de cobrança do produto/serviço: única, mensal, trimestral, semestral ou anual';
COMMENT ON COLUMN public.produtos_servicos.estoque_quantidade IS 'Quantidade de itens disponíveis em estoque para produtos';
COMMENT ON COLUMN public.produtos_servicos.tem_estoque IS 'Indica se o produto/serviço possui controle de estoque';

-- 6) Registrar migração$mig_v4$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v6
insert into public.master_migrations(version, name, sql)
values (
  6,
  'v6 - Enhance convert_lead_to_client RPC (reuse existing client, default nascimento)',
  $mig_v6$-- v6  Sincronizar table de leads e clientes para conversão entre eles

-- Enhance convert_lead_to_client RPC (reuse existing client, default nascimento)
-- Safe to run multiple times (CREATE OR REPLACE)

create or replace function public.convert_lead_to_client(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead record;
  v_client_id uuid;
  v_existing_id uuid;
begin
  -- Fetch lead
  select * into v_lead from public.crm_leads where id = p_lead_id;
  if not found then
    raise exception 'Lead não encontrado';
  end if;

  -- Try to reuse existing client for same organization by phone or email
  select c.id
    into v_existing_id
  from public.clients c
  where c.organization_id = v_lead.organization_id
    and (
      (v_lead.whatsapp is not null and nullif(trim(v_lead.whatsapp), '') is not null and c.telefone = trim(v_lead.whatsapp))
      or (v_lead.email is not null and nullif(trim(v_lead.email), '') is not null and c.email = trim(v_lead.email))
    )
  limit 1;

  if v_existing_id is not null then
    v_client_id := v_existing_id;
  else
    -- clients requires nascimento (date) and telefone (text)
    insert into public.clients (
      id, organization_id, nome, email, telefone, nascimento, created_at
    ) values (
      gen_random_uuid(),
      v_lead.organization_id,
      coalesce(nullif(trim(v_lead.name), ''), 'Sem nome'),
      nullif(trim(v_lead.email), ''),
      coalesce(nullif(trim(v_lead.whatsapp), ''), ''),
      date '1970-01-01',
      now()
    )
    returning id into v_client_id;
  end if;

  -- Mark lead as converted
  update public.crm_leads
  set converted_client_id = v_client_id,
      converted_at = now(),
      stage = coalesce(stage, 'fechado')
  where id = p_lead_id;

  return v_client_id;
end;
$$;


-- Add valor_pago to clients and sync RPC

alter table public.clients
  add column if not exists valor_pago numeric(10,2) default 0;

-- When converting a lead to client, set clients.valor_pago if lead has payment
create or replace function public.convert_lead_to_client(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead record;
  v_client_id uuid;
  v_existing_id uuid;
begin
  select * into v_lead from public.crm_leads where id = p_lead_id;
  if not found then
    raise exception 'Lead não encontrado';
  end if;

  select c.id into v_existing_id
  from public.clients c
  where c.organization_id = v_lead.organization_id
    and (
      (v_lead.whatsapp is not null and nullif(trim(v_lead.whatsapp), '') is not null and c.telefone = trim(v_lead.whatsapp))
      or (v_lead.email is not null and nullif(trim(v_lead.email), '') is not null and c.email = trim(v_lead.email))
    )
  limit 1;

  if v_existing_id is not null then
    v_client_id := v_existing_id;
    -- opcional: atualizar valor_pago acumulando
    if coalesce(v_lead.has_payment, false) and coalesce(v_lead.payment_value, 0) > 0 then
      update public.clients
      set valor_pago = coalesce(valor_pago, 0) + coalesce(v_lead.payment_value, 0)
      where id = v_client_id;
    end if;
  else
    insert into public.clients (
      id, organization_id, nome, email, telefone, nascimento, valor_pago, created_at
    ) values (
      gen_random_uuid(),
      v_lead.organization_id,
      coalesce(nullif(trim(v_lead.name), ''), 'Sem nome'),
      nullif(trim(v_lead.email), ''),
      coalesce(nullif(trim(v_lead.whatsapp), ''), ''),
      date '1970-01-01',
      case when coalesce(v_lead.has_payment, false) then coalesce(v_lead.payment_value, 0) else 0 end,
      now()
    )
    returning id into v_client_id;
  end if;

  update public.crm_leads
  set converted_client_id = v_client_id,
      converted_at = now(),
      stage = coalesce(stage, 'fechado')
  where id = p_lead_id;

  return v_client_id;
end;
$$;


-- Auto-convert lead to client when stage changes to closed (fechado/ganho)

create or replace function public.trg_auto_convert_on_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    -- only when stage actually changed to a closed state
    if coalesce(old.stage, '') is distinct from coalesce(new.stage, '') then
      if lower(coalesce(new.stage, '')) in ('fechado', 'fechado ganho', 'ganho', 'venda fechada') then
        -- perform conversion (idempotent: function reuses existing client)
        perform public.convert_lead_to_client(new.id);
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists auto_convert_on_close on public.crm_leads;
create trigger auto_convert_on_close
  after update on public.crm_leads
  for each row execute function public.trg_auto_convert_on_close();


-- Create client from lead WITHOUT marking the lead as converted

create or replace function public.create_client_from_lead_no_convert(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead record;
  v_client_id uuid;
begin
  select * into v_lead from public.crm_leads where id = p_lead_id;
  if not found then
    raise exception 'Lead não encontrado';
  end if;

  -- Reuse existing client by phone/email within org
  select id into v_client_id from public.clients c
  where c.organization_id = v_lead.organization_id
    and (
      (v_lead.whatsapp is not null and nullif(trim(v_lead.whatsapp), '') is not null and c.telefone = trim(v_lead.whatsapp))
      or (v_lead.email is not null and nullif(trim(v_lead.email), '') is not null and c.email = trim(v_lead.email))
    )
  limit 1;

  if v_client_id is null then
    insert into public.clients (
      id, organization_id, nome, email, telefone, nascimento, valor_pago, created_at
    ) values (
      gen_random_uuid(),
      v_lead.organization_id,
      coalesce(nullif(trim(v_lead.name), ''), 'Sem nome'),
      nullif(trim(v_lead.email), ''),
      coalesce(nullif(trim(v_lead.whatsapp), ''), ''),
      date '1970-01-01',
      case when coalesce(v_lead.has_payment, false) then coalesce(v_lead.payment_value, 0) else 0 end,
      now()
    ) returning id into v_client_id;
  else
    -- Update valor_pago if we already have payment on the lead
    if coalesce(v_lead.has_payment, false) and coalesce(v_lead.payment_value, 0) > 0 then
      update public.clients set valor_pago = coalesce(v_lead.payment_value, 0) where id = v_client_id;
    end if;
  end if;

  return v_client_id;
end;
$$;

-- Replace auto-convert trigger to use the non-converting function
drop trigger if exists auto_convert_on_close on public.crm_leads;
create trigger auto_convert_on_close
  after update on public.crm_leads
  for each row execute function public.trg_auto_convert_on_close();

-- Sync client.valor_pago when lead payment fields change
create or replace function public.trg_sync_client_payment_from_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
begin
  if tg_op = 'UPDATE' then
    if (coalesce(old.payment_value,0) is distinct from coalesce(new.payment_value,0))
       or (coalesce(old.has_payment,false) is distinct from coalesce(new.has_payment,false)) then
      -- find matching client in same org by phone/email
      select id into v_client_id from public.clients c
      where c.organization_id = new.organization_id
        and (
          (new.whatsapp is not null and nullif(trim(new.whatsapp), '') is not null and c.telefone = trim(new.whatsapp))
          or (new.email is not null and nullif(trim(new.email), '') is not null and c.email = trim(new.email))
        )
      limit 1;
      if v_client_id is not null then
        update public.clients
        set valor_pago = case when coalesce(new.has_payment,false) then coalesce(new.payment_value,0) else 0 end
        where id = v_client_id;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_client_payment_from_lead on public.crm_leads;
create trigger sync_client_payment_from_lead
  after update on public.crm_leads
  for each row execute function public.trg_sync_client_payment_from_lead();

-- Update auto-convert-on-close behavior without touching previous migrations
-- Redefine trigger function to only create client (do NOT mark lead as converted)

create or replace function public.trg_auto_convert_on_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if coalesce(old.stage, '') is distinct from coalesce(new.stage, '') then
      if lower(coalesce(new.stage, '')) in ('fechado', 'fechado ganho', 'ganho', 'venda fechada') then
        perform public.create_client_from_lead_no_convert(new.id);
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists auto_convert_on_close on public.crm_leads;
create trigger auto_convert_on_close
  after update on public.crm_leads
  for each row execute function public.trg_auto_convert_on_close();$mig_v6$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v7
insert into public.master_migrations(version, name, sql)
values (
  7,
  'v7 - WhatsApp schema for client Supabase',
  $mig_v7$-- WhatsApp schema for client Supabase
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
COMMENT ON COLUMN crm_leads.has_whatsapp IS 'Indica se o número do lead foi verificado e tem WhatsApp ativo';$mig_v7$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v8
insert into public.master_migrations(version, name, sql)
values (
  8,
  'v8 - Create table for storing user''s WhatsApp webhook configurations',
  $mig_v8$-- Create table for storing user's WhatsApp webhook configurations
-- This is separate from the WuzAPI webhook which always points to our orchestrator

CREATE TABLE IF NOT EXISTS public.whatsapp_user_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL UNIQUE,
  webhook_url text NOT NULL,
  events text[] NOT NULL DEFAULT '{"All"}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_user_webhooks_org 
  ON public.whatsapp_user_webhooks(organization_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_user_webhooks_active 
  ON public.whatsapp_user_webhooks(is_active);

-- Enable RLS
ALTER TABLE public.whatsapp_user_webhooks ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'whatsapp_user_webhooks'
    AND policyname = 'Users can view own webhooks'
  ) THEN
    CREATE POLICY "Users can view own webhooks" 
      ON public.whatsapp_user_webhooks 
      FOR SELECT 
      TO authenticated 
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'whatsapp_user_webhooks'
    AND policyname = 'Users can manage own webhooks'
  ) THEN
    CREATE POLICY "Users can manage own webhooks" 
      ON public.whatsapp_user_webhooks 
      FOR ALL 
      TO authenticated 
      USING (true) 
      WITH CHECK (true);
  END IF;
END $$;

-- Add WhatsApp-specific event types to webhook_event_types table
INSERT INTO public.webhook_event_types (event_type, display_name, description, example_payload, category, is_active)
VALUES
  ('whatsapp_message_received', 'Mensagem WhatsApp Recebida', 'Disparado quando uma mensagem é recebida no WhatsApp', 
   '{"event_type":"whatsapp_message_received","data":{"phone":"+5511999999999","message":"Olá","is_from_me":false}}'::jsonb, 
   'whatsapp', true),
  
  ('whatsapp_message_sent', 'Mensagem WhatsApp Enviada', 'Disparado quando uma mensagem é enviada pelo WhatsApp', 
   '{"event_type":"whatsapp_message_sent","data":{"phone":"+5511999999999","message":"Olá","is_from_me":true}}'::jsonb, 
   'whatsapp', true),
  
  ('whatsapp_message_read', 'Mensagem WhatsApp Lida', 'Disparado quando uma mensagem é marcada como lida', 
   '{"event_type":"whatsapp_message_read","data":{"message_id":"ABC123","phone":"+5511999999999"}}'::jsonb, 
   'whatsapp', true),
  
  ('whatsapp_presence', 'Presença WhatsApp', 'Disparado quando há mudança de presença (digitando, online, etc)', 
   '{"event_type":"whatsapp_presence","data":{"phone":"+5511999999999","state":"composing"}}'::jsonb, 
   'whatsapp', true),
  
  ('whatsapp_contact_created', 'Contato WhatsApp Criado', 'Disparado quando um novo contato WhatsApp é adicionado', 
   '{"event_type":"whatsapp_contact_created","data":{"phone":"+5511999999999","name":"João Silva"}}'::jsonb, 
   'whatsapp', true),
  
  ('whatsapp_conversation_started', 'Conversa WhatsApp Iniciada', 'Disparado quando uma nova conversa é iniciada', 
   '{"event_type":"whatsapp_conversation_started","data":{"phone":"+5511999999999","contact_name":"João Silva"}}'::jsonb, 
   'whatsapp', true)
ON CONFLICT (event_type) DO UPDATE
SET 
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  example_payload = EXCLUDED.example_payload,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

-- Add missing columns to whatsapp_contacts if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'whatsapp_contacts' 
    AND column_name = 'is_whatsapp'
  ) THEN
    ALTER TABLE public.whatsapp_contacts 
    ADD COLUMN is_whatsapp boolean DEFAULT true;
  END IF;
END $$;

-- Add missing columns to whatsapp_conversations if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'whatsapp_conversations' 
    AND column_name = 'last_message'
  ) THEN
    ALTER TABLE public.whatsapp_conversations 
    ADD COLUMN last_message text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'whatsapp_conversations' 
    AND column_name = 'unread_count'
  ) THEN
    ALTER TABLE public.whatsapp_conversations 
    ADD COLUMN unread_count integer DEFAULT 0;
  END IF;
END $$;

-- Add missing columns to whatsapp_messages if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'whatsapp_messages' 
    AND column_name = 'instance_id'
  ) THEN
    ALTER TABLE public.whatsapp_messages 
    ADD COLUMN instance_id text;
  END IF;
END $$;


-- Sync entradas from pagamentos, leads (has_payment), and clients (valor_pago)
-- This migration creates a link table for idempotency, mapping functions,
-- trigger functions, triggers, and backfill routines.

-- 1) Link table for idempotency (maps source record -> entrada row)
create table if not exists public.entradas_source_links (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null,
  source_type text not null check (source_type in ('pagamento','lead_payment','client_valor_pago')),
  source_id uuid not null,
  entrada_id uuid not null references public.entradas(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, source_type, source_id)
);

drop trigger if exists update_entradas_source_links_updated_at on public.entradas_source_links;
create trigger update_entradas_source_links_updated_at
  before update on public.entradas_source_links
  for each row execute function public.update_updated_at_column();

-- 2) Mapping helpers
create or replace function public.map_pagamento_metodo_to_entradas(m text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(m,''))
    when 'dinheiro' then 'dinheiro'
    when 'pix' then 'pix'
    when 'transferencia' then 'transferencia'
    when 'cheque' then 'cheque'
    when 'cartao' then 'cartao_credito'
    when 'cartao_credito' then 'cartao_credito'
    when 'cartao_debito' then 'cartao_debito'
    when 'boleto' then 'boleto'
    else 'dinheiro'
  end;
$$;

create or replace function public.map_produto_categoria_to_entrada_categoria(
  ps_categoria text,
  ps_tipo text,
  ps_tipo_cobranca text,
  ps_cobranca_tipo text
)
returns text
language sql
immutable
as $$
  select case
    when lower(coalesce(ps_categoria,'')) in (
      'consulta','exame','procedimento','terapia','cirurgia','treinamento'
    ) then 'Serviços'
    when lower(coalesce(ps_categoria,'')) in (
      'consultoria'
    ) then 'Consultoria'
    when lower(coalesce(ps_categoria,'')) in (
      'medicamento','equipamento','material','software'
    ) then 'Produtos'
    when lower(coalesce(ps_categoria,'')) in (
      'assinatura'
    ) or lower(coalesce(ps_tipo_cobranca,'')) in (
      'mensal','trimestral','semestral','anual'
    ) or lower(coalesce(ps_cobranca_tipo,'')) in (
      'mensal','trimestral','semestral','anual'
    ) then 'Assinatura'
    else 'Outros'
  end;
$$;

-- 3) Upsert from pagamentos
create or replace function public.upsert_entrada_for_pagamento(p_pagamento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_entrada_id uuid;
  v_categoria text;
  v_metodo text;
  v_descricao text;
  v_prod_id uuid;
  v_cliente_id uuid;
begin
  select p.*, c.nome as cliente_nome,
         ps.nome as produto_nome,
         ps.categoria as ps_categoria,
         ps.tipo as ps_tipo,
         ps.tipo_cobranca as ps_tipo_cobranca,
         ps.cobranca_tipo as ps_cobranca_tipo
    into r
    from public.pagamentos p
    left join public.clients c on c.id = p.client_id
    left join public.produtos_servicos ps on ps.id = p.servico_id
   where p.id = p_pagamento_id;

  if not found then
    return;
  end if;

  -- Require organization_id and positive valor
  if r.organization_id is null or coalesce(r.valor, 0) <= 0 then
    return;
  end if;

  -- If not confirmed, remove any existing entrada for this pagamento
  if r.status is distinct from 'confirmado' then
    select entrada_id into v_entrada_id
      from public.entradas_source_links
     where organization_id = r.organization_id
       and source_type = 'pagamento'
       and source_id = p_pagamento_id;
    if v_entrada_id is not null then
      delete from public.entradas where id = v_entrada_id;
    end if;
    return;
  end if;

  v_metodo := public.map_pagamento_metodo_to_entradas(r.metodo);
  v_categoria := public.map_produto_categoria_to_entrada_categoria(r.ps_categoria, r.ps_tipo, r.ps_tipo_cobranca, r.ps_cobranca_tipo);
  v_descricao := coalesce('Pagamento ' || v_metodo || coalesce(' - ' || r.produto_nome, ''), 'Pagamento');
  v_cliente_id := r.client_id;
  v_prod_id := r.servico_id;

  select entrada_id into v_entrada_id
    from public.entradas_source_links
   where organization_id = r.organization_id
     and source_type = 'pagamento'
     and source_id = p_pagamento_id;

  if v_entrada_id is null then
    insert into public.entradas (
      organization_id, descricao, valor, categoria, data_entrada,
      metodo_pagamento, cliente_id, produto_servico_id, observacoes
    ) values (
      r.organization_id,
      v_descricao,
      r.valor,
      v_categoria,
      coalesce(r.data_pagamento, now()),
      v_metodo,
      v_cliente_id,
      v_prod_id,
      'origem: pagamento/' || p_pagamento_id::text
    ) returning id into v_entrada_id;

    insert into public.entradas_source_links (organization_id, source_type, source_id, entrada_id)
    values (r.organization_id, 'pagamento', p_pagamento_id, v_entrada_id);
  else
    update public.entradas
       set descricao = v_descricao,
           valor = r.valor,
           categoria = v_categoria,
           data_entrada = coalesce(r.data_pagamento, now()),
           metodo_pagamento = v_metodo,
           cliente_id = v_cliente_id,
           produto_servico_id = v_prod_id
     where id = v_entrada_id;
  end if;
end;
$$;

create or replace function public.trg_entradas_from_pagamentos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upsert_entrada_for_pagamento(new.id);
  return new;
end;
$$;

create or replace function public.trg_entradas_from_pagamentos_del()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entrada_id uuid;
begin
  select entrada_id into v_entrada_id
    from public.entradas_source_links
   where organization_id = old.organization_id
     and source_type = 'pagamento'
     and source_id = old.id;
  if v_entrada_id is not null then
    delete from public.entradas where id = v_entrada_id;
  end if;
  return old;
end;
$$;

drop trigger if exists entradas_from_pagamentos_ins on public.pagamentos;
create trigger entradas_from_pagamentos_ins
  after insert on public.pagamentos
  for each row execute function public.trg_entradas_from_pagamentos();

drop trigger if exists entradas_from_pagamentos_upd on public.pagamentos;
create trigger entradas_from_pagamentos_upd
  after update on public.pagamentos
  for each row execute function public.trg_entradas_from_pagamentos();

drop trigger if exists entradas_from_pagamentos_del on public.pagamentos;
create trigger entradas_from_pagamentos_del
  after delete on public.pagamentos
  for each row execute function public.trg_entradas_from_pagamentos_del();

-- 4) Upsert from leads.has_payment/payment_value
create or replace function public.upsert_entrada_for_lead_payment(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_entrada_id uuid;
begin
  select * into r from public.crm_leads where id = p_lead_id;
  if not found then
    return;
  end if;

  if r.organization_id is null then
    return;
  end if;

  if coalesce(r.has_payment, false) = true and coalesce(r.payment_value, 0) > 0 then
    select entrada_id into v_entrada_id
      from public.entradas_source_links
     where organization_id = r.organization_id
       and source_type = 'lead_payment'
       and source_id = p_lead_id;

    if v_entrada_id is null then
      insert into public.entradas (
        organization_id, descricao, valor, categoria, data_entrada,
        metodo_pagamento, cliente_id, produto_servico_id, observacoes
      ) values (
        r.organization_id,
        coalesce('Pagamento lead: ' || nullif(trim(r.name), ''), 'Pagamento lead'),
        r.payment_value,
        'Vendas',
        now(),
        'dinheiro',
        null,
        null,
        'origem: lead_payment/' || p_lead_id::text
      ) returning id into v_entrada_id;

      insert into public.entradas_source_links (organization_id, source_type, source_id, entrada_id)
      values (r.organization_id, 'lead_payment', p_lead_id, v_entrada_id);
    else
      update public.entradas
         set descricao = coalesce('Pagamento lead: ' || nullif(trim(r.name), ''), 'Pagamento lead'),
             valor = r.payment_value,
             categoria = 'Vendas',
             data_entrada = now(),
             metodo_pagamento = 'dinheiro'
       where id = v_entrada_id;
    end if;
  else
    -- Remove entrada if payment no longer valid
    select entrada_id into v_entrada_id
      from public.entradas_source_links
     where organization_id = r.organization_id
       and source_type = 'lead_payment'
       and source_id = p_lead_id;
    if v_entrada_id is not null then
      delete from public.entradas where id = v_entrada_id;
    end if;
  end if;
end;
$$;

create or replace function public.trg_entradas_from_leads()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upsert_entrada_for_lead_payment(new.id);
  return new;
end;
$$;

create or replace function public.trg_entradas_from_leads_del()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_entrada_id uuid; begin
  select entrada_id into v_entrada_id
    from public.entradas_source_links
   where organization_id = old.organization_id
     and source_type = 'lead_payment'
     and source_id = old.id;
  if v_entrada_id is not null then
    delete from public.entradas where id = v_entrada_id;
  end if;
  return old;
end;$$;

drop trigger if exists entradas_from_leads_ins on public.crm_leads;
create trigger entradas_from_leads_ins
  after insert on public.crm_leads
  for each row execute function public.trg_entradas_from_leads();

drop trigger if exists entradas_from_leads_upd on public.crm_leads;
create trigger entradas_from_leads_upd
  after update on public.crm_leads
  for each row execute function public.trg_entradas_from_leads();

drop trigger if exists entradas_from_leads_del on public.crm_leads;
create trigger entradas_from_leads_del
  after delete on public.crm_leads
  for each row execute function public.trg_entradas_from_leads_del();

-- 5) Upsert from clients.valor_pago (> 0)
create or replace function public.upsert_entrada_for_client_valor_pago(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_entrada_id uuid;
begin
  select * into r from public.clients where id = p_client_id;
  if not found then
    return;
  end if;
  if r.organization_id is null then
    return;
  end if;

  if coalesce(r.valor_pago, 0) > 0 then
    select entrada_id into v_entrada_id
      from public.entradas_source_links
     where organization_id = r.organization_id
       and source_type = 'client_valor_pago'
       and source_id = p_client_id;

    if v_entrada_id is null then
      insert into public.entradas (
        organization_id, descricao, valor, categoria, data_entrada,
        metodo_pagamento, cliente_id, produto_servico_id, observacoes
      ) values (
        r.organization_id,
        coalesce('Cliente pagante: ' || nullif(trim(r.nome), ''), 'Cliente pagante'),
        r.valor_pago,
        'Vendas',
        now(),
        'dinheiro',
        r.id,
        null,
        'origem: client_valor_pago/' || p_client_id::text
      ) returning id into v_entrada_id;

      insert into public.entradas_source_links (organization_id, source_type, source_id, entrada_id)
      values (r.organization_id, 'client_valor_pago', p_client_id, v_entrada_id);
    else
      update public.entradas
         set descricao = coalesce('Cliente pagante: ' || nullif(trim(r.nome), ''), 'Cliente pagante'),
             valor = r.valor_pago,
             categoria = 'Vendas',
             data_entrada = now(),
             metodo_pagamento = 'dinheiro',
             cliente_id = r.id
       where id = v_entrada_id;
    end if;
  else
    select entrada_id into v_entrada_id
      from public.entradas_source_links
     where organization_id = r.organization_id
       and source_type = 'client_valor_pago'
       and source_id = p_client_id;
    if v_entrada_id is not null then
      delete from public.entradas where id = v_entrada_id;
    end if;
  end if;
end;
$$;

create or replace function public.trg_entradas_from_clients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upsert_entrada_for_client_valor_pago(new.id);
  return new;
end;
$$;

create or replace function public.trg_entradas_from_clients_del()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_entrada_id uuid; begin
  select entrada_id into v_entrada_id
    from public.entradas_source_links
   where organization_id = old.organization_id
     and source_type = 'client_valor_pago'
     and source_id = old.id;
  if v_entrada_id is not null then
    delete from public.entradas where id = v_entrada_id;
  end if;
  return old;
end;$$;

drop trigger if exists entradas_from_clients_upd on public.clients;
create trigger entradas_from_clients_upd
  after update on public.clients
  for each row execute function public.trg_entradas_from_clients();

drop trigger if exists entradas_from_clients_del on public.clients;
create trigger entradas_from_clients_del
  after delete on public.clients
  for each row execute function public.trg_entradas_from_clients_del();

-- 6) Backfill routines
create or replace function public.backfill_entradas_from_pagamentos()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record; begin
  for r in
    select id from public.pagamentos
     where status = 'confirmado' and organization_id is not null and coalesce(valor,0) > 0
  loop
    perform public.upsert_entrada_for_pagamento(r.id);
  end loop;
end;$$;

create or replace function public.backfill_entradas_from_leads()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record; begin
  for r in
    select id from public.crm_leads
     where coalesce(has_payment,false) = true and coalesce(payment_value,0) > 0 and organization_id is not null
  loop
    perform public.upsert_entrada_for_lead_payment(r.id);
  end loop;
end;$$;

create or replace function public.backfill_entradas_from_clients()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record; begin
  for r in
    select id from public.clients
     where coalesce(valor_pago,0) > 0 and organization_id is not null
  loop
    perform public.upsert_entrada_for_client_valor_pago(r.id);
  end loop;
end;$$;

-- Execute backfills
select public.backfill_entradas_from_pagamentos();
select public.backfill_entradas_from_leads();
select public.backfill_entradas_from_clients();$mig_v8$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v9
insert into public.master_migrations(version, name, sql)
values (
  9,
  'v9 - Repositório de Mensagens de WhatsApp (cliente)',
  $mig_v9$-- Repositório de Mensagens de WhatsApp (cliente)
-- Objetivo: armazenar mensagens recebidas/enviadas (cliente, IA, humano) com filtros, FT e pronto para RAG

-- Extensões necessárias (idempotentes)
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists vector;

-- Enums idempotentes
do $$ begin
  create type sender_type as enum ('cliente','ia','humano');
exception when duplicate_object then null; end $$;

do $$ begin
  create type msg_direction as enum ('inbound','outbound');
exception when duplicate_object then null; end $$;

-- Tabela principal
create table if not exists public.repositorio_de_mensagens (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  whatsapp_cliente text not null,
  whatsapp_empresa text not null,
  sender_type sender_type not null,
  direction msg_direction not null,
  content_text text,
  content_raw jsonb,
  has_media boolean default false,
  media_type text,
  media_url text,
  media_size_bytes integer,
  provider text,
  provider_message_id text,
  thread_id text,
  conversation_id text generated always as (
    md5(lower(coalesce(whatsapp_cliente,'')) || '|' || lower(coalesce(whatsapp_empresa,'')))
  ) stored,
  reply_to_provider_message_id text,
  language text,
  labels text[] default '{}',
  ai_model text,
  ai_agent_id text,
  human_operator_id text,
  tsv tsvector generated always as (
    setweight(to_tsvector('portuguese', coalesce(content_text,'')), 'A')
  ) stored,
  embedding vector(1536)
);

-- Unicidade por mensagem do provedor (ignora nulos)
create unique index if not exists repositorio_de_mensagens_provider_message_id_uk
  on public.repositorio_de_mensagens(provider_message_id)
  where provider_message_id is not null;

-- Índices de performance
create index if not exists repositorio_de_mensagens_created_at_idx
  on public.repositorio_de_mensagens(created_at desc);

create index if not exists repositorio_de_mensagens_cliente_idx
  on public.repositorio_de_mensagens(whatsapp_cliente);

create index if not exists repositorio_de_mensagens_sender_idx
  on public.repositorio_de_mensagens(sender_type);

create index if not exists repositorio_de_mensagens_conv_idx
  on public.repositorio_de_mensagens(conversation_id);

create index if not exists repositorio_de_mensagens_tsv_idx
  on public.repositorio_de_mensagens using gin(tsv);

-- Índice para embeddings (HNSW quando disponível)
do $$ begin
  execute 'create index if not exists repositorio_de_mensagens_emb_hnsw on public.repositorio_de_mensagens using hnsw (embedding vector_cosine_ops)';
exception when others then
  begin
    execute 'create index if not exists repositorio_de_mensagens_emb_ivfflat on public.repositorio_de_mensagens using ivfflat (embedding vector_cosine_ops)';
  exception when others then null; end;
end $$;

-- RLS (permitir authenticated e service_role)
alter table public.repositorio_de_mensagens enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='repositorio_de_mensagens' and policyname='rm_select_authenticated'
  ) then
    create policy rm_select_authenticated on public.repositorio_de_mensagens for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='repositorio_de_mensagens' and policyname='rm_modify_authenticated'
  ) then
    create policy rm_modify_authenticated on public.repositorio_de_mensagens for all to authenticated using (true) with check (true);
  end if;
  -- service_role não passa por RLS, mas manter política para simetria não é necessário
end $$;

-- Views auxiliares
create or replace view public.vw_rm_conversas as
select
  conversation_id,
  min(created_at) as first_message_at,
  max(created_at) as last_message_at,
  count(*) as total_msgs,
  count(*) filter (where sender_type = 'cliente') as total_cliente,
  count(*) filter (where sender_type = 'ia') as total_ia,
  count(*) filter (where sender_type = 'humano') as total_humano,
  min(whatsapp_cliente) as whatsapp_cliente,
  min(whatsapp_empresa) as whatsapp_empresa
from public.repositorio_de_mensagens
group by conversation_id;

create or replace view public.vw_rm_insights_diarios as
select
  date_trunc('day', created_at) as dia,
  sender_type,
  count(*) as total
from public.repositorio_de_mensagens
group by 1,2
order by 1 desc;

-- Helper function para busca full-text com websearch
create or replace function public.rm_buscar(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_sender sender_type default null,
  p_numero text default null,
  p_query text default null,
  p_limit int default 100,
  p_offset int default 0
)
returns setof public.repositorio_de_mensagens
language sql
stable
as $$
  select *
  from public.repositorio_de_mensagens m
  where m.created_at between coalesce(p_inicio, '-infinity') and coalesce(p_fim, 'infinity')
    and (p_sender is null or m.sender_type = p_sender)
    and (p_numero is null or m.whatsapp_cliente = p_numero or m.whatsapp_empresa = p_numero)
    and (
      p_query is null
      or m.tsv @@ websearch_to_tsquery('portuguese', p_query)
    )
  order by m.created_at desc
  limit greatest(0, p_limit)
  offset greatest(0, p_offset)
$$;

create table if not exists public.app_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);$mig_v9$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v10
insert into public.master_migrations(version, name, sql)
values (
  10,
  'v10 - Repositório de mensagens: adicionar organization_id, RLS por organização e ajustar RPC',
  $mig_v10$-- v10 – Repositório de mensagens: adicionar organization_id, RLS por organização e ajustar RPC

-- Adicionar coluna organization_id
alter table if exists public.repositorio_de_mensagens
  add column if not exists organization_id uuid;

-- Trigger para preencher organization_id a partir do contexto se nulo
create or replace function public.rm_set_org_from_context()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    begin
      new.organization_id := nullif(current_setting('app.organization_id', true), '')::uuid;
    exception when others then
      -- ignora
      new.organization_id := new.organization_id;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rm_set_org_from_context on public.repositorio_de_mensagens;
create trigger trg_rm_set_org_from_context
before insert on public.repositorio_de_mensagens
for each row execute function public.rm_set_org_from_context();

-- Índice por organização + created_at
create index if not exists repositorio_de_mensagens_org_created_idx
  on public.repositorio_de_mensagens(organization_id, created_at desc);

-- Atualizar RLS: restringir por organização
alter table public.repositorio_de_mensagens enable row level security;

-- Remover políticas antigas permissivas, se existirem
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='repositorio_de_mensagens' and policyname='rm_select_authenticated') then
    drop policy rm_select_authenticated on public.repositorio_de_mensagens;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='repositorio_de_mensagens' and policyname='rm_modify_authenticated') then
    drop policy rm_modify_authenticated on public.repositorio_de_mensagens;
  end if;
end $$;

-- Criar políticas por organização (authenticated)
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='repositorio_de_mensagens' and policyname='rm_select_by_org'
  ) then
    create policy rm_select_by_org on public.repositorio_de_mensagens
      for select to authenticated
      using (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='repositorio_de_mensagens' and policyname='rm_insert_by_org'
  ) then
    create policy rm_insert_by_org on public.repositorio_de_mensagens
      for insert to authenticated
      with check (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='repositorio_de_mensagens' and policyname='rm_update_by_org'
  ) then
    create policy rm_update_by_org on public.repositorio_de_mensagens
      for update to authenticated
      using (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      ) with check (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      );
  end if;
end $$;

-- Ajustar RPC rm_buscar para filtrar por organização
drop function if exists public.rm_buscar(timestamptz, timestamptz, sender_type, text, text, int, int);

create or replace function public.rm_buscar(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_sender sender_type default null,
  p_numero text default null,
  p_query text default null,
  p_limit int default 100,
  p_offset int default 0,
  p_org uuid default null
)
returns setof public.repositorio_de_mensagens
language sql
stable
as $$
  select *
  from public.repositorio_de_mensagens m
  where m.created_at between coalesce(p_inicio, '-infinity') and coalesce(p_fim, 'infinity')
    and (p_sender is null or m.sender_type = p_sender)
    and (p_numero is null or m.whatsapp_cliente = p_numero or m.whatsapp_empresa = p_numero)
    and (
      p_query is null
      or m.tsv @@ websearch_to_tsquery('portuguese', p_query)
    )
    and (
      m.organization_id is not null
      and m.organization_id = coalesce(p_org, nullif(current_setting('app.organization_id', true), '')::uuid)
    )
  order by m.created_at desc
  limit greatest(0, p_limit)
  offset greatest(0, p_offset)
$$;
$mig_v10$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v11
insert into public.master_migrations(version, name, sql)
values (
  11,
  'v11 - Ajuste de NOT NULL em repositorio_de_mensagens',
  $mig_v11$-- v11 – Ajuste de NOT NULL em repositorio_de_mensagens
-- Requisito: apenas whatsapp_cliente, sender_type e content_text devem ser NOT NULL

-- 1) Backfill seguro para evitar falhas ao aplicar NOT NULL
update public.repositorio_de_mensagens
set content_text = ''
where content_text is null;

update public.repositorio_de_mensagens
set whatsapp_cliente = ''
where whatsapp_cliente is null;

do $$
begin
  -- Se sender_type estiver nulo, assumir 'cliente'
  update public.repositorio_de_mensagens
  set sender_type = 'cliente'::sender_type
  where sender_type is null;
exception when others then
  -- ignorar caso o enum não exista por algum motivo
  null;
end $$;

-- 2) Definir defaults mínimos (opcional mas útil)
alter table if exists public.repositorio_de_mensagens
  alter column content_text set default '';

-- 3) Tornar APENAS estes campos obrigatórios
alter table if exists public.repositorio_de_mensagens
  alter column whatsapp_cliente set not null,
  alter column sender_type set not null,
  alter column content_text set not null;

-- 4) Remover NOT NULL dos demais que tinham restrição
do $$
begin
  -- created_at originalmente era NOT NULL
  begin
    alter table public.repositorio_de_mensagens alter column created_at drop not null;
  exception when others then null; end;
  -- whatsapp_empresa originalmente era NOT NULL
  begin
    alter table public.repositorio_de_mensagens alter column whatsapp_empresa drop not null;
  exception when others then null; end;
  -- direction originalmente era NOT NULL
  begin
    alter table public.repositorio_de_mensagens alter column direction drop not null;
  exception when others then null; end;
end $$;

-- Create RPC to set organization context for RLS policies
set search_path = public, auth;

-- Drop and recreate for idempotency
drop function if exists public.set_rls_context(uuid);

create or replace function public.set_rls_context(p_organization_id uuid)
returns void
language sql
as $$
  select set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
$$;

-- Ensure authenticated/anon roles can execute (PostgREST)
do $$ begin
  grant execute on function public.set_rls_context(uuid) to anon, authenticated;
exception when others then
  -- ignore if roles not present in this environment
  null;
end $$;

comment on function public.set_rls_context(uuid) is 'Sets app.organization_id GUC for row-level policies.';


$mig_v11$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v12
insert into public.master_migrations(version, name, sql)
values (
  12,
  'v12 - Normalize legacy values in produtos_servicos to satisfy CHECK constraints',
  $mig_v12$-- Normalize legacy values in produtos_servicos to satisfy CHECK constraints
-- This migration maps common variants (case/accents) to the canonical values
-- Safe to run multiple times

begin;

-- Categoria: canonical set
-- ['Consulta','Exame','Procedimento','Terapia','Cirurgia','Medicamento','Equipamento','Material','Software','Imovel','Treinamento','Outros']
update public.produtos_servicos set categoria = 'Consulta' where categoria ilike 'consulta';
update public.produtos_servicos set categoria = 'Exame' where categoria ilike 'exame';
update public.produtos_servicos set categoria = 'Procedimento' where categoria ilike 'procedimento';
update public.produtos_servicos set categoria = 'Terapia' where categoria ilike 'terapia';
update public.produtos_servicos set categoria = 'Cirurgia' where categoria ilike 'cirurgia';
update public.produtos_servicos set categoria = 'Medicamento' where categoria ilike 'medicamento';
update public.produtos_servicos set categoria = 'Equipamento' where categoria ilike 'equipamento';
update public.produtos_servicos set categoria = 'Material' where categoria ilike 'material';
update public.produtos_servicos set categoria = 'Software' where categoria ilike 'software';
-- Handle accented/improper forms for Imovel
update public.produtos_servicos set categoria = 'Imovel' where categoria in ('Imóvel','imóvel','Imovel','imovel');
update public.produtos_servicos set categoria = 'Treinamento' where categoria ilike 'treinamento';
update public.produtos_servicos set categoria = 'Outros' where categoria ilike 'outros';

-- Anything else -> Outros
update public.produtos_servicos
   set categoria = 'Outros'
 where categoria not in ('Consulta','Exame','Procedimento','Terapia','Cirurgia','Medicamento','Equipamento','Material','Software','Imovel','Treinamento','Outros');

-- Tipo: canonical set
-- ['produto','servico','consultoria','assinatura','curso','evento','imovel','software']
update public.produtos_servicos set tipo = 'produto' where lower(tipo) in ('produto','produtos');
update public.produtos_servicos set tipo = 'servico' where lower(tipo) in ('servico','serviço','servicos','serviços');
update public.produtos_servicos set tipo = 'consultoria' where lower(tipo) like 'consultoria%';
update public.produtos_servicos set tipo = 'assinatura' where lower(tipo) like 'assinatura%';
update public.produtos_servicos set tipo = 'curso' where lower(tipo) like 'curso%';
update public.produtos_servicos set tipo = 'evento' where lower(tipo) like 'evento%';
update public.produtos_servicos set tipo = 'imovel' where lower(tipo) in ('imovel','imóvel','imoveis','imóveis');
update public.produtos_servicos set tipo = 'software' where lower(tipo) like 'software%';

-- Fallback para valores fora do conjunto
update public.produtos_servicos
   set tipo = 'servico'
 where lower(tipo) not in ('produto','servico','serviço','consultoria','assinatura','curso','evento','imovel','imóvel','software');

-- Cobranca_tipo: canonical set
-- ['unica','mensal','trimestral','semestral','anual']
update public.produtos_servicos set cobranca_tipo = 'unica' where lower(cobranca_tipo) in ('unica','única');
update public.produtos_servicos set cobranca_tipo = 'mensal' where lower(cobranca_tipo) like 'mensal%';
update public.produtos_servicos set cobranca_tipo = 'trimestral' where lower(cobranca_tipo) like 'trimestral%';
update public.produtos_servicos set cobranca_tipo = 'semestral' where lower(cobranca_tipo) like 'semestral%';
update public.produtos_servicos set cobranca_tipo = 'anual' where lower(cobranca_tipo) like 'anual%';

-- Fallback para valores fora do conjunto
update public.produtos_servicos
   set cobranca_tipo = 'unica'
 where lower(cobranca_tipo) not in ('unica','única','mensal','trimestral','semestral','anual');

commit;


-- Atualiza o CHECK de categoria da tabela produtos_servicos para incluir 'Imovel'
-- e alinhar ao conjunto canônico utilizado no frontend.

begin;

alter table public.produtos_servicos
  drop constraint if exists produtos_servicos_categoria_check;

alter table public.produtos_servicos
  add constraint produtos_servicos_categoria_check
  check (
    categoria = any (array[
      'Consulta',
      'Exame',
      'Procedimento',
      'Terapia',
      'Cirurgia',
      'Medicamento',
      'Equipamento',
      'Material',
      'Software',
      'Imovel',
      'Treinamento',
      'Outros'
    ])
  );

commit;


$mig_v12$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v13
insert into public.master_migrations(version, name, sql)
values (
  13,
  'v13 - Add optional Instagram username to crm_leads',
  $mig_v13$-- Add optional Instagram username to crm_leads
alter table if exists public.crm_leads
  add column if not exists instagram_username text;

comment on column public.crm_leads.instagram_username is 'Instagram @username of the lead';


$mig_v13$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v14
insert into public.master_migrations(version, name, sql)
values (
  14,
  'v14 - James (ElevenLabs agent linkage) per organization',
  $mig_v14$-- James (ElevenLabs agent linkage) per organization

create table if not exists public.james (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  agent_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create index if not exists idx_james_org on public.james (organization_id);

alter table public.james enable row level security;

-- Shared helper to keep updated_at fresh (idempotent)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_on_james on public.james;
create trigger set_timestamp_on_james
before update on public.james
for each row execute function public.set_updated_at();

-- RLS policies by organization context (requires set_rls_context to be called)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'james' and policyname = 'james_select_own_org'
  ) then
    create policy james_select_own_org on public.james
      for select to anon, authenticated
      using (
        organization_id is not null
        and organization_id::text = nullif(current_setting('app.organization_id', true), '')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'james' and policyname = 'james_modify_own_org'
  ) then
    create policy james_modify_own_org on public.james
      for all to anon, authenticated
      using (
        organization_id is not null
        and organization_id::text = nullif(current_setting('app.organization_id', true), '')
      )
      with check (
        organization_id is not null
        and organization_id::text = nullif(current_setting('app.organization_id', true), '')
      );
  end if;
end $$;

-- Helper RPCs atômicos (setam contexto e operam na mesma call)
create or replace function public.james_get(p_organization_id uuid)
returns table(agent_id text)
language plpgsql security definer
as $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  return query
    select j.agent_id
    from public.james j
    where j.organization_id = p_organization_id
    limit 1;
end;
$$;
grant execute on function public.james_get(uuid) to anon, authenticated;

create or replace function public.james_upsert(p_organization_id uuid, p_agent_id text)
returns void
language plpgsql security definer
as $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  insert into public.james (organization_id, agent_id)
  values (p_organization_id, coalesce(p_agent_id, ''))
  on conflict (organization_id) do update
    set agent_id = excluded.agent_id,
        updated_at = now();
end;
$$;
grant execute on function public.james_upsert(uuid, text) to anon, authenticated;


-- 2) Marcar versão$mig_v14$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v15
insert into public.master_migrations(version, name, sql)
values (
  15,
  'v15 - n8n connections per organization + RPCs (security definer)',
  $mig_v15$-- v15 – n8n connections per organization + RPCs (security definer)

create table if not exists public.n8n_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  base_url text not null,
  api_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create index if not exists idx_n8n_connections_org on public.n8n_connections (organization_id);

alter table public.n8n_connections enable row level security;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_n8n_conn_updated_at on public.n8n_connections;
create trigger trg_n8n_conn_updated_at before update on public.n8n_connections
for each row execute function public.set_updated_at();

do $$
begin
  if not exists (select 1 from pg_policies where tablename='n8n_connections' and policyname='n8n_conn_select') then
    create policy n8n_conn_select on public.n8n_connections
      for select to anon, authenticated
      using (organization_id::text = nullif(current_setting('app.organization_id', true), ''));
  end if;
  if not exists (select 1 from pg_policies where tablename='n8n_connections' and policyname='n8n_conn_modify') then
    create policy n8n_conn_modify on public.n8n_connections
      for all to anon, authenticated
      using (organization_id::text = nullif(current_setting('app.organization_id', true), ''))
      with check (organization_id::text = nullif(current_setting('app.organization_id', true), ''));
  end if;
end $$;

-- Atomic RPCs
create or replace function public.n8n_get(p_organization_id uuid)
returns table(base_url text, api_key text)
language plpgsql security definer as $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  return query select c.base_url, c.api_key from public.n8n_connections c where c.organization_id = p_organization_id limit 1;
end; $$;
grant execute on function public.n8n_get(uuid) to anon, authenticated;

create or replace function public.n8n_upsert(p_organization_id uuid, p_base_url text, p_api_key text)
returns void
language plpgsql security definer as $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  insert into public.n8n_connections (organization_id, base_url, api_key)
  values (p_organization_id, p_base_url, p_api_key)
  on conflict (organization_id) do update set base_url = excluded.base_url, api_key = excluded.api_key, updated_at = now();
end; $$;
grant execute on function public.n8n_upsert(uuid, text, text) to anon, authenticated;


-- 2) Marcar versão$mig_v15$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v16
insert into public.master_migrations(version, name, sql)
values (
  16,
  'v16 - CRM Lead Activities: add field_changed and log description changes',
  $mig_v16$--
-- CRM Lead Activities: add field_changed and log description changes
--
-- This migration updates the audit trail for leads so that it records
-- specific field changes (starting with stage and description), avoiding
-- misleading entries where old/new values repeat when nothing changed.

-- 1) Schema: add column field_changed
alter table if exists public.crm_lead_activities
  add column if not exists field_changed text;

-- 2) Logic: update trigger function to log per-field changes
create or replace function public.log_crm_lead_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_any_inserted boolean := false;
begin
  v_actor := coalesce(new.updated_by, new.created_by, old.updated_by, old.created_by);

  if tg_op = 'INSERT' then
    -- Lead created
    insert into public.crm_lead_activities (
      lead_id, user_id, action, field_changed, description, created_at
    ) values (
      new.id, v_actor, 'INSERT', 'insert', 'Lead criado: ' || coalesce(new.name,''), now()
    );
    return new;

  elsif tg_op = 'UPDATE' then
    -- Stage change
    if old.stage is distinct from new.stage then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, old_value, new_value, created_at
      ) values (
        new.id, v_actor, 'UPDATE', 'stage',
        'Lead movido para: ' || coalesce(new.stage,'indefinido'),
        old.stage, new.stage, now()
      );
      v_any_inserted := true;
    end if;

    -- Description change
    if coalesce(old.description,'') is distinct from coalesce(new.description,'') then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, old_value, new_value, created_at
      ) values (
        new.id, v_actor, 'UPDATE', 'description',
        'Descrição atualizada',
        old.description, new.description, now()
      );
      v_any_inserted := true;
    end if;

    -- Payment status change (keep as meaningful event)
    if coalesce(old.has_payment,false) is distinct from coalesce(new.has_payment,false) then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, old_value, new_value, created_at
      ) values (
        new.id, v_actor, 'UPDATE', 'has_payment',
        case when new.has_payment then 'Lead marcado como pago' else 'Lead desmarcado como pago' end,
        coalesce(old.payment_value,0)::text,
        coalesce(new.payment_value,0)::text,
        now()
      );
      v_any_inserted := true;
    elsif coalesce(old.payment_value,0) is distinct from coalesce(new.payment_value,0) then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, old_value, new_value, created_at
      ) values (
        new.id, v_actor, 'UPDATE', 'payment_value',
        'Valor do pagamento atualizado',
        coalesce(old.payment_value,0)::text,
        coalesce(new.payment_value,0)::text,
        now()
      );
      v_any_inserted := true;
    end if;

    -- Fallback generic update (only if nothing above was logged)
    if not v_any_inserted then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, created_at
      ) values (
        new.id, v_actor, 'UPDATE', null, 'Lead atualizado: ' || coalesce(new.name,''), now()
      );
    end if;

    return new;

  elsif tg_op = 'DELETE' then
    insert into public.crm_lead_activities (
      lead_id, user_id, action, field_changed, description, created_at
    ) values (
      old.id, v_actor, 'DELETE', 'delete', 'Lead excluído: ' || coalesce(old.name,''), now()
    );
    return old;
  end if;

  return new;
exception when others then
  -- Non-critical; don’t block writes
  raise notice 'CRM lead activity logging failed: %', sqlerrm;
  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

-- 3) Ensure trigger exists (idempotent)
drop trigger if exists crm_lead_activity_trigger on public.crm_leads;
create trigger crm_lead_activity_trigger
  after insert or update or delete on public.crm_leads
  for each row execute function public.log_crm_lead_changes();

-- 2) Marcar versão$mig_v16$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v17
insert into public.master_migrations(version, name, sql)
values (
  17,
  'v17 - Trilha de Monetização: progresso por etapa',
  $mig_v17$-- v17 – Trilha de Monetização: progresso por etapa

-- 1) Tabela de progresso por organização e etapa
create table if not exists public.monetization_trail_progress (
  organization_id uuid not null,
  step_key text not null,
  completed boolean not null default false,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monetization_trail_progress_pkey primary key (organization_id, step_key)
);

-- 2) Índices auxiliares
create index if not exists monetization_trail_progress_org_idx on public.monetization_trail_progress (organization_id);
create index if not exists monetization_trail_progress_completed_idx on public.monetization_trail_progress (completed);

-- 3) Trigger para updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists monetization_trail_progress_set_updated_at on public.monetization_trail_progress;
create trigger monetization_trail_progress_set_updated_at
before update on public.monetization_trail_progress
for each row execute function public.set_updated_at();

-- 4) RLS por organização (usa app.organization_id configurado via RPC set_rls_context)
alter table public.monetization_trail_progress enable row level security;

drop policy if exists "trail_read_org" on public.monetization_trail_progress;
create policy "trail_read_org" on public.monetization_trail_progress
  for select to authenticated
  using ((organization_id::text = current_setting('app.organization_id', true)));

drop policy if exists "trail_write_org" on public.monetization_trail_progress;
create policy "trail_write_org" on public.monetization_trail_progress
  for insert to authenticated
  with check ((organization_id::text = current_setting('app.organization_id', true)));

drop policy if exists "trail_update_org" on public.monetization_trail_progress;
create policy "trail_update_org" on public.monetization_trail_progress
  for update to authenticated
  using ((organization_id::text = current_setting('app.organization_id', true)))
  with check ((organization_id::text = current_setting('app.organization_id', true)));
$mig_v17$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v18
insert into public.master_migrations(version, name, sql)
values (
  18,
  'v18 - RPC para remover conexão do n8n por organização',
  $mig_v18$-- v18 – RPC para remover conexão do n8n por organização

create or replace function public.n8n_delete(p_organization_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Setar o contexto de organização para cumprir as policies RLS
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);

  -- Remover a conexão vinculada
  delete from public.n8n_connections c
  where c.organization_id = p_organization_id;
end; $$;

grant execute on function public.n8n_delete(uuid) to anon, authenticated;
$mig_v18$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v19
insert into public.master_migrations(version, name, sql)
values (
  19,
  'v19 - Ensure webhook_event_types exists and is populated with a complete catalog',
  $mig_v19$-- Ensure webhook_event_types exists and is populated with a complete catalog
-- Safe to run multiple times; uses IF NOT EXISTS and ON CONFLICT guards

set search_path = public, auth;

-- 1) Table
create table if not exists public.webhook_event_types (
  id uuid primary key default gen_random_uuid(),
  event_type text unique not null,
  display_name text not null,
  description text not null,
  example_payload jsonb not null default '{}'::jsonb,
  category text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) RLS + public SELECT policy
alter table public.webhook_event_types enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'webhook_event_types'
      and policyname = 'Event types são públicos'
  ) then
    create policy "Event types são públicos"
      on public.webhook_event_types
      for select
      to public
      using (true);
  end if;
end $$;

-- 3) Helpful index
create index if not exists webhook_event_types_category_idx
  on public.webhook_event_types(category);

-- 4) Catalog (UPSERT)
insert into public.webhook_event_types (event_type, display_name, description, example_payload, category, is_active)
values
  -- CRM & Leads
  ('lead_created', 'Lead Criado', 'Disparado quando um lead é adicionado ao CRM', '{"event_type":"lead_created","lead":{"id":"..."}}'::jsonb, 'crm', true),
  ('lead_updated', 'Lead Atualizado', 'Disparado quando dados do lead são modificados', '{"event_type":"lead_updated","lead":{"id":"..."}}'::jsonb, 'crm', true),
  ('lead_stage_changed', 'Lead Mudou Etapa', 'Quando o lead muda de etapa no funil', '{"event_type":"lead_stage_changed","lead":{"id":"..."},"old_stage":"novo","new_stage":"contato"}'::jsonb, 'crm', true),
  ('lead_converted', 'Lead Convertido', 'Quando um lead vira cliente', '{"event_type":"lead_converted","lead":{"id":"..."},"client_id":"..."}'::jsonb, 'crm', true),

  -- Clientes
  ('client_created', 'Cliente Cadastrado', 'Disparado quando um novo cliente é cadastrado', '{"event_type":"client_created","client":{"id":"..."}}'::jsonb, 'clients', true),
  ('client_updated', 'Cliente Atualizado', 'Disparado quando dados do cliente são modificados', '{"event_type":"client_updated","client":{"id":"..."}}'::jsonb, 'clients', true),

  -- Agendamentos
  ('appointment_created', 'Agendamento Criado', 'Disparado quando um agendamento é criado', '{"event_type":"appointment_created","appointment":{"id":"..."}}'::jsonb, 'appointments', true),
  ('appointment_updated', 'Agendamento Atualizado', 'Disparado quando um agendamento é modificado', '{"event_type":"appointment_updated","appointment":{"id":"..."}}'::jsonb, 'appointments', true),
  ('appointment_status_changed', 'Status do Agendamento Mudou', 'Quando o status do agendamento é alterado', '{"event_type":"appointment_status_changed","appointment":{"id":"..."},"old_status":"agendado","new_status":"realizado"}'::jsonb, 'appointments', true),

  -- Financeiro
  ('payment_received', 'Pagamento Recebido', 'Disparado quando um pagamento é confirmado', '{"event_type":"payment_received","payment":{"id":"..."}}'::jsonb, 'financial', true),

  -- Colaboradores
  ('collaborator_created', 'Colaborador Cadastrado', 'Disparado quando novo colaborador é adicionado', '{"event_type":"collaborator_created","collaborator":{"id":"..."}}'::jsonb, 'collaborators', true),
  ('collaborator_updated', 'Colaborador Atualizado', 'Disparado quando dados do colaborador são modificados', '{"event_type":"collaborator_updated","collaborator":{"id":"..."}}'::jsonb, 'collaborators', true),

  -- Produtos & Serviços
  ('product_created', 'Produto/Serviço Criado', 'Disparado quando um item é criado', '{"event_type":"product_created","product":{"id":"..."}}'::jsonb, 'products', true),
  ('product_updated', 'Produto/Serviço Atualizado', 'Disparado quando um item é modificado', '{"event_type":"product_updated","product":{"id":"..."}}'::jsonb, 'products', true),

  -- WhatsApp (caso ainda não exista no Client)
  ('whatsapp_message_received', 'Mensagem WhatsApp Recebida', 'Quando uma mensagem é recebida no WhatsApp', '{"event_type":"whatsapp_message_received","data":{"phone":"+5511999999999"}}'::jsonb, 'whatsapp', true),
  ('whatsapp_message_sent', 'Mensagem WhatsApp Enviada', 'Quando uma mensagem é enviada', '{"event_type":"whatsapp_message_sent","data":{"phone":"+5511999999999"}}'::jsonb, 'whatsapp', true),
  ('whatsapp_message_read', 'Mensagem WhatsApp Lida', 'Quando a mensagem é lida', '{"event_type":"whatsapp_message_read","data":{"message_id":"ABC"}}'::jsonb, 'whatsapp', true),
  ('whatsapp_presence', 'Presença WhatsApp', 'Mudança de presença (digitando, online)', '{"event_type":"whatsapp_presence","data":{"phone":"+5511999999999","state":"composing"}}'::jsonb, 'whatsapp', true),
  ('whatsapp_contact_created', 'Contato WhatsApp Criado', 'Novo contato WhatsApp adicionado', '{"event_type":"whatsapp_contact_created","data":{"phone":"+5511999999999"}}'::jsonb, 'whatsapp', true),
  ('whatsapp_conversation_started', 'Conversa WhatsApp Iniciada', 'Nova conversa iniciada', '{"event_type":"whatsapp_conversation_started","data":{"phone":"+5511999999999"}}'::jsonb, 'whatsapp', true)
on conflict (event_type) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  example_payload = excluded.example_payload,
  category = excluded.category,
  is_active = excluded.is_active;

$mig_v19$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v20
insert into public.master_migrations(version, name, sql)
values (
  20,
  'v20 - Migration 20',
  $mig_v20$/*
  CRM Leads.stage -> enforce consistency with CRM Stages
  - Allow NULL on crm_leads.stage
  - Backfill existing values to match crm_stages.name (case-insensitive)
  - Null out unmatched values
  - Add composite FK (organization_id, stage) -> crm_stages(organization_id, name)
    with ON UPDATE CASCADE and ON DELETE SET NULL
  - Remove legacy normalization trigger/functions that forced canonical values
*/

begin;

-- 1) Drop legacy trigger and functions (idempotent)
drop trigger if exists trg_crm_leads_normalize_stage on public.crm_leads;
drop function if exists public.trg_crm_leads_normalize_stage();
drop function if exists public.normalize_stage_name(uuid, text);

-- 2) Allow NULL and drop default on crm_leads.stage
alter table public.crm_leads
  alter column stage drop default;

-- stage might already be nullable, but drop not null just in case
alter table public.crm_leads
  alter column stage drop not null;

-- 3) Backfill: normalize case to exact crm_stages.name when there is a match
update public.crm_leads l
set stage = s.name
from public.crm_stages s
where l.organization_id = s.organization_id
  and s.name is not null
  and l.stage is not null
  and trim(l.stage) <> ''
  and lower(l.stage) = lower(s.name);

-- 4) Cleanup: set to NULL when not matching any stage name for the same org
update public.crm_leads l
set stage = null
where l.stage is not null
  and trim(l.stage) <> ''
  and not exists (
    select 1
    from public.crm_stages s
    where s.organization_id = l.organization_id
      and s.name = l.stage
  );

-- Also null-out empty or 'null' textual values
update public.crm_leads
set stage = null
where stage is null
   or trim(coalesce(stage, '')) = ''
   or lower(coalesce(stage, '')) = 'null';

-- 5) Add helpful index for lookups by (organization_id, stage)
create index if not exists idx_crm_leads_org_stage on public.crm_leads(organization_id, stage);

-- 6) Add composite foreign key constraint
alter table public.crm_leads
  add constraint crm_leads_stage_fkey
  foreign key (organization_id, stage)
  references public.crm_stages(organization_id, name)
  on update cascade
  on delete set null;

commit;

-- Add CNPJ and company_name to crm_leads
-- Create crm_lead_interests to link leads with produtos_servicos and quantities

begin;

-- Ensure pgcrypto for gen_random_uuid
create extension if not exists pgcrypto;

-- 1) New columns on crm_leads
alter table public.crm_leads
  add column if not exists cnpj text,
  add column if not exists company_name text;

-- 2) Interests table
create table if not exists public.crm_lead_interests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  produto_servico_id uuid not null references public.produtos_servicos(id) on delete restrict,
  quantity integer not null default 1 check (quantity >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, produto_servico_id)
);

-- 3) Indexes
create index if not exists idx_crm_lead_interests_lead on public.crm_lead_interests(lead_id);
create index if not exists idx_crm_lead_interests_prod on public.crm_lead_interests(produto_servico_id);
create index if not exists idx_crm_lead_interests_org on public.crm_lead_interests(organization_id);

-- 4) updated_at trigger
create or replace function public.trg_set_timestamp() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_crm_lead_interests on public.crm_lead_interests;
create trigger set_timestamp_crm_lead_interests
  before update on public.crm_lead_interests
  for each row execute function public.trg_set_timestamp();

commit;

-- Maintain crm_leads.value as sum of interested products (preco_base * quantity)
-- If no interests, keep existing value (manual). We will only update value when interests change;
-- if user set a manual value and there are interests, the trigger will compute and override.

begin;

create or replace function public.recalc_lead_value(p_lead_id uuid) returns void as $$
declare
  v_org uuid;
  v_sum numeric;
begin
  select organization_id into v_org from public.crm_leads where id = p_lead_id;

  -- Sum of preco_base * quantity for the same organization
  select coalesce(sum(ps.preco_base * li.quantity), 0)
    into v_sum
  from public.crm_lead_interests li
  join public.produtos_servicos ps
    on ps.id = li.produto_servico_id
   and ps.organization_id = li.organization_id
  where li.lead_id = p_lead_id;

  -- Update crm_leads.value if there are any interests
  if v_sum > 0 then
    update public.crm_leads
       set value = v_sum,
           updated_at = now()
     where id = p_lead_id;
  end if;
end;
$$ language plpgsql;

create or replace function public.trg_recalc_lead_value() returns trigger as $$
begin
  perform public.recalc_lead_value(coalesce(new.lead_id, old.lead_id));
  return new;
end;
$$ language plpgsql;

do $$
begin
  perform 1 from information_schema.tables
   where table_schema = 'public' and table_name = 'crm_lead_interests';
  if found then
    drop trigger if exists recalc_lead_value_ins on public.crm_lead_interests;
    create trigger recalc_lead_value_ins
      after insert on public.crm_lead_interests
      for each row execute function public.trg_recalc_lead_value();

    drop trigger if exists recalc_lead_value_upd on public.crm_lead_interests;
    create trigger recalc_lead_value_upd
      after update on public.crm_lead_interests
      for each row execute function public.trg_recalc_lead_value();

    drop trigger if exists recalc_lead_value_del on public.crm_lead_interests;
    create trigger recalc_lead_value_del
      after delete on public.crm_lead_interests
      for each row execute function public.trg_recalc_lead_value();
  end if;
end $$;

commit;




-- 7) Marcar versão$mig_v20$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v21
insert into public.master_migrations(version, name, sql)
values (
  21,
  'v21 - Migration 21',
  $mig_v21$/*
  Case-insensitive support for crm_leads.stage against crm_stages.name
  - Enforce uniqueness of (organization_id, lower(name)) in crm_stages
  - BEFORE INSERT/UPDATE trigger on crm_leads to fix the stage casing
    by replacing with the exact crm_stages.name for the org (if found)
  - Does NOT relax FK semantics (FK stays), but makes inputs tolerant to case
*/

begin;

-- 1) Unique constraint (by functional unique index) to avoid duplicates by case
create unique index if not exists crm_stages_org_lower_name_key
on public.crm_stages (organization_id, lower(name));

-- 2) Function to fix the stage case before FK check
create or replace function public.trg_crm_leads_fix_stage_case()
returns trigger
language plpgsql
as $$
declare
  v_name text;
begin
  -- Only when stage provided
  if new.stage is not null and trim(new.stage) <> '' then
    select s.name into v_name
    from public.crm_stages s
    where s.organization_id = new.organization_id
      and lower(s.name) = lower(new.stage)
    limit 1;

    if v_name is not null then
      new.stage := v_name; -- replace with exact cased name
    end if;
  end if;
  return new;
end;
$$;

-- 3) Install trigger (runs before FK validation)
drop trigger if exists trg_crm_leads_fix_stage_case on public.crm_leads;
create trigger trg_crm_leads_fix_stage_case
before insert or update on public.crm_leads
for each row execute function public.trg_crm_leads_fix_stage_case();

commit;


-- 4) Marcar versão$mig_v21$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v22
insert into public.master_migrations(version, name, sql)
values (
  22,
  'v22 - Migration 22',
  $mig_v22$/*
  Visibility control for Kanban: crm_leads.show_in_kanban
  - Adds boolean column with default TRUE
  - Backfills: converted leads => FALSE, others => TRUE
  - BEFORE UPDATE trigger: when converted_client_id transitions from NULL to NOT NULL, set show_in_kanban=FALSE
*/

begin;

-- 1) Column
alter table public.crm_leads
  add column if not exists show_in_kanban boolean not null default true;

-- 2) Backfill
update public.crm_leads
set show_in_kanban = case when converted_client_id is not null then false else true end;

-- 3) Trigger to auto-hide on conversion (only on first transition)
create or replace function public.trg_crm_leads_hide_on_conversion()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if (old.converted_client_id is null and new.converted_client_id is not null) then
      new.show_in_kanban := false;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_crm_leads_hide_on_conversion on public.crm_leads;
create trigger trg_crm_leads_hide_on_conversion
before update on public.crm_leads
for each row execute function public.trg_crm_leads_hide_on_conversion();

commit;

-- 4) Marcar versão$mig_v22$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v23
insert into public.master_migrations(version, name, sql)
values (
  23,
  'v23 - Add sale columns on crm_leads and link entradas to produto_servico when possible',
  $mig_v23$-- Add sale columns on crm_leads and link entradas to produto_servico when possible

begin;

-- 1) Columns to store sold product and quantity (for AI agent/automation use)
alter table public.crm_leads
  add column if not exists sold_produto_servico_id uuid references public.produtos_servicos(id) on delete set null,
  add column if not exists sold_quantity integer not null default 1 check (sold_quantity >= 1);

-- 2) Update function to propagate produto_servico_id to entradas for lead payments
create or replace function public.upsert_entrada_for_lead_payment(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_entrada_id uuid;
  v_product_id uuid;
begin
  select * into r from public.crm_leads where id = p_lead_id;
  if not found then
    return;
  end if;

  if r.organization_id is null then
    return;
  end if;

  -- Decide product to attach to entrada
  v_product_id := r.sold_produto_servico_id;
  if v_product_id is null then
    select li.produto_servico_id
      into v_product_id
    from public.crm_lead_interests li
    where li.lead_id = p_lead_id
    order by li.created_at asc
    limit 1;
  end if;

  if coalesce(r.has_payment, false) = true and coalesce(r.payment_value, 0) > 0 then
    select entrada_id into v_entrada_id
      from public.entradas_source_links
     where organization_id = r.organization_id
       and source_type = 'lead_payment'
       and source_id = p_lead_id;

    if v_entrada_id is null then
      insert into public.entradas (
        organization_id, descricao, valor, categoria, data_entrada,
        metodo_pagamento, cliente_id, produto_servico_id, observacoes
      ) values (
        r.organization_id,
        coalesce('Pagamento lead: ' || nullif(trim(r.name), ''), 'Pagamento lead'),
        r.payment_value,
        'Vendas',
        now(),
        'dinheiro',
        null,
        v_product_id,
        'origem: lead_payment/' || p_lead_id::text
      ) returning id into v_entrada_id;

      insert into public.entradas_source_links (organization_id, source_type, source_id, entrada_id)
      values (r.organization_id, 'lead_payment', p_lead_id, v_entrada_id);
    else
      update public.entradas
         set descricao = coalesce('Pagamento lead: ' || nullif(trim(r.name), ''), 'Pagamento lead'),
             valor = r.payment_value,
             categoria = 'Vendas',
             data_entrada = now(),
             metodo_pagamento = 'dinheiro',
             produto_servico_id = v_product_id
       where id = v_entrada_id;
    end if;
  else
    -- Remove entrada if payment no longer valid
    select entrada_id into v_entrada_id
      from public.entradas_source_links
     where organization_id = r.organization_id
       and source_type = 'lead_payment'
       and source_id = p_lead_id;
    if v_entrada_id is not null then
      delete from public.entradas where id = v_entrada_id;
    end if;
  end if;
end;
$$;

commit;


-- 3) Marcar versão$mig_v23$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v24
insert into public.master_migrations(version, name, sql)
values (
  24,
  'v24 - Add conversion flag to crm_stages so organizations can choose their conversion stage',
  $mig_v24$-- Add conversion flag to crm_stages so organizations can choose their conversion stage

begin;

alter table public.crm_stages
  add column if not exists is_conversion_stage boolean not null default false;

-- Optional: ensure only one conversion stage per organization (soft, not strict):
-- We won't add a partial unique index now to avoid migration conflicts; logic handled in app.

commit;


-- 1) Marcar versão$mig_v24$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v25
insert into public.master_migrations(version, name, sql)
values (
  25,
  'v25 - Fix lead conversion flow and allow deleting clients referenced by converted leads',
  $mig_v25$-- Fix lead conversion flow and allow deleting clients referenced by converted leads
-- Changes:
-- 1) Recreate FK crm_leads.converted_client_id -> clients.id with ON DELETE SET NULL
-- 2) Restore auto-convert trigger to actually mark converted_client_id
-- 3) Backfill converted_client_id for existing data and realign show_in_kanban

begin;


-- 1) Recreate FK with ON DELETE SET NULL (previously NO ACTION)
alter table if exists public.crm_leads
  drop constraint if exists crm_leads_converted_client_id_fkey;

alter table public.crm_leads
  add constraint crm_leads_converted_client_id_fkey
  foreign key (converted_client_id)
  references public.clients(id)
  on update cascade
  on delete set null;

-- 2) Restore auto-convert trigger to mark the lead as converted
create or replace function public.trg_auto_convert_on_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if coalesce(old.stage, '') is distinct from coalesce(new.stage, '') then
      if lower(coalesce(new.stage, '')) in ('fechado', 'fechado ganho', 'ganho', 'venda fechada') then
        -- Avoid double work if already converted
        if new.converted_client_id is null then
          perform public.convert_lead_to_client(new.id);
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists auto_convert_on_close on public.crm_leads;
create trigger auto_convert_on_close
  after update on public.crm_leads
  for each row execute function public.trg_auto_convert_on_close();

-- 3a) Backfill: set converted_client_id where we can match an existing client by phone/email in same org
with matches as (
  select l.id as lead_id, c.id as client_id
  from public.crm_leads l
  join public.clients c
    on c.organization_id = l.organization_id
   and (
     (l.whatsapp is not null and nullif(trim(l.whatsapp), '') is not null and c.telefone = trim(l.whatsapp))
     or (l.email is not null and nullif(trim(l.email), '') is not null and c.email = trim(l.email))
   )
  where l.converted_client_id is null
)
update public.crm_leads l
set converted_client_id = m.client_id,
    converted_at = coalesce(l.converted_at, now())
from matches m
where l.id = m.lead_id;

-- 3b) Realign show_in_kanban flag if the column exists
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'crm_leads'
      and column_name = 'show_in_kanban'
  ) then
    update public.crm_leads
    set show_in_kanban = case when converted_client_id is not null then false else true end;
  end if;
end $$;

commit;

-- 1) Marcar versão$mig_v25$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v26
insert into public.master_migrations(version, name, sql)
values (
  26,
  'v26 - Cria bucket público para imagens de produtos e políticas básicas',
  $mig_v26$-- Cria bucket público para imagens de produtos e políticas básicas

BEGIN;

-- Bucket público para imagens de produtos
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Leitura pública
drop policy if exists "Public read access for product-images" on storage.objects;
create policy "Public read access for product-images"
  on storage.objects
  for select
  using (bucket_id = 'product-images');

-- Upload por usuários autenticados
drop policy if exists "Authenticated upload to product-images" on storage.objects;
create policy "Authenticated upload to product-images"
  on storage.objects
  for insert
  with check (bucket_id = 'product-images');

-- Atualização por usuários autenticados
drop policy if exists "Authenticated update to product-images" on storage.objects;
create policy "Authenticated update to product-images"
  on storage.objects
  for update
  using (bucket_id = 'product-images');

-- Exclusão por usuários autenticados
drop policy if exists "Authenticated delete from product-images" on storage.objects;
create policy "Authenticated delete from product-images"
  on storage.objects
  for delete
  using (bucket_id = 'product-images');

COMMIT;

-- Adiciona coluna para Base64 das imagens em produtos/serviços
-- Armazena até 5 strings base64 separadas por quebras de linha ("\n")

BEGIN;

ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS imagens_base64 text;

COMMENT ON COLUMN public.produtos_servicos.imagens_base64 IS 'Até 5 imagens em Base64 (data URL) separadas por quebra de linha (\n).';

COMMIT;

-- Adiciona coluna para Base64 das imagens em produtos/serviços
-- Armazena até 5 strings base64 separadas por quebras de linha ("\n")

BEGIN;

ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS imagens_base64 text;

COMMENT ON COLUMN public.produtos_servicos.imagens_base64 IS 'Até 5 imagens em Base64 (data URL) separadas por quebra de linha (\n).';

COMMIT;





-- 1) Marcar versão$mig_v26$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v27
insert into public.master_migrations(version, name, sql)
values (
  27,
  'v27 - Preferências de dashboard e presets de filtros para Reports',
  $mig_v27$-- Preferências de dashboard e presets de filtros para Reports
-- Observa: seguir convenção do projeto de criar migrações separadas do CLIENT-SQL-SETUP

create table if not exists user_dashboard_prefs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  page text not null,
  tab text not null,
  widgets jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_user_dashboard_prefs_org_user on user_dashboard_prefs(organization_id, user_id);

create table if not exists report_filter_presets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  name text not null,
  filters jsonb not null,
  created_at timestamptz default now()
);

create index if not exists idx_report_filter_presets_org_user on report_filter_presets(organization_id, user_id);



-- 1) Marcar versão$mig_v27$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v28
insert into public.master_migrations(version, name, sql)
values (
  28,
  'v28 - Extensões para Produtos/Serviços',
  $mig_v28$-- Extensões para Produtos/Serviços
-- - tags (text[])
-- - custom_fields (jsonb)
-- - impostos/custos opcionais
-- - status granular (rascunho, ativo, sob_demanda, fora_catalogo)
-- - estoque_minimo e locais (jsonb)
-- - tabelas auxiliares: produto_variantes e produtos_relacionados

BEGIN;

-- 1) Novas colunas na tabela principal
ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS imposto_percent numeric(5,2) CHECK (imposto_percent >= 0 AND imposto_percent <= 100),
  ADD COLUMN IF NOT EXISTS custo_base numeric(12,2),
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS estoque_minimo integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estoque_locais jsonb DEFAULT '[]'::jsonb;

-- Constraint de status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'produtos_servicos' AND c.conname = 'produtos_servicos_status_check'
  ) THEN
    ALTER TABLE public.produtos_servicos
      ADD CONSTRAINT produtos_servicos_status_check
      CHECK (status = ANY (ARRAY['rascunho','ativo','sob_demanda','fora_catalogo']));
  END IF;
END $$;

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_produtos_servicos_tags_gin ON public.produtos_servicos USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_produtos_servicos_status ON public.produtos_servicos (status);

-- 2) Tabela de variantes/planos
CREATE TABLE IF NOT EXISTS public.produto_variantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  produto_id uuid NOT NULL REFERENCES public.produtos_servicos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  preco numeric(12,2) NOT NULL DEFAULT 0,
  cobranca_tipo text NOT NULL CHECK (cobranca_tipo = ANY (ARRAY['unica','mensal','trimestral','semestral','anual'])),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_produto_variantes_produto ON public.produto_variantes (produto_id);
CREATE INDEX IF NOT EXISTS idx_produto_variantes_org ON public.produto_variantes (organization_id);

-- 3) Tabela de relacionamentos (upsell/cross-sell)
CREATE TABLE IF NOT EXISTS public.produtos_relacionados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  produto_id uuid NOT NULL REFERENCES public.produtos_servicos(id) ON DELETE CASCADE,
  relacionado_id uuid NOT NULL REFERENCES public.produtos_servicos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Evitar duplicidade
CREATE UNIQUE INDEX IF NOT EXISTS uq_produtos_relacionados_pair
  ON public.produtos_relacionados (produto_id, relacionado_id);

CREATE INDEX IF NOT EXISTS idx_produtos_relacionados_org ON public.produtos_relacionados (organization_id);

COMMENT ON TABLE public.produto_variantes IS 'Planos/variações de um produto ou serviço.';
COMMENT ON TABLE public.produtos_relacionados IS 'Relacionamentos para upsell/cross-sell.';

COMMIT;


-- 1) Marcar versão$mig_v28$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v29
insert into public.master_migrations(version, name, sql)
values (
  29,
  'v29 - Enable RLS and add organization-scoped policies for crm_lead_interests',
  $mig_v29$-- Enable RLS and add organization-scoped policies for crm_lead_interests
-- Safe, idempotent migration

begin;

-- Ensure helper exists
create or replace function public.set_rls_context(p_organization_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
end; $$;

-- Enable RLS on crm_lead_interests
do $$
begin
  perform 1 from information_schema.tables 
   where table_schema = 'public' and table_name = 'crm_lead_interests';
  if found then
    execute 'alter table public.crm_lead_interests enable row level security';
  end if;
end $$;

-- Policies (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'crm_lead_interests' and policyname = 'interests_select_org'
  ) then
    create policy "interests_select_org"
      on public.crm_lead_interests
      for select
      to authenticated, anon
      using ((organization_id::text = nullif(current_setting('app.organization_id', true), '')));
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'crm_lead_interests' and policyname = 'interests_modify_org'
  ) then
    create policy "interests_modify_org"
      on public.crm_lead_interests
      for all
      to authenticated, anon
      using ((organization_id::text = nullif(current_setting('app.organization_id', true), '')))
      with check ((organization_id::text = nullif(current_setting('app.organization_id', true), '')));
  end if;
end $$;

commit;




-- 1) Marcar versão$mig_v29$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v30
insert into public.master_migrations(version, name, sql)
values (
  30,
  'v30 - Consolidate lead interests into crm_leads',
  $mig_v30$-- Consolidate lead interests into crm_leads.interests (JSONB)
-- Remove table crm_lead_interests and replace value recalculation and RPCs

begin;

-- 1) Add interests column
alter table if exists public.crm_leads
  add column if not exists interests jsonb;

-- 2) Backfill from crm_lead_interests if it exists
do $$
begin
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' and table_name = 'crm_lead_interests'
  ) then
    update public.crm_leads l
       set interests = coalesce(
         (
           select jsonb_agg(jsonb_build_object(
             'produto_servico_id', li.produto_servico_id,
             'quantity', greatest(1, li.quantity)
           ) order by li.created_at asc)
           from public.crm_lead_interests li
           where li.lead_id = l.id
         ), '[]'::jsonb)
     where l.interests is null;
  end if;
end $$;

-- 3) Function to recalc lead value based on interests JSON
create or replace function public.recalc_lead_value(p_lead_id uuid) returns void as $$
declare
  v_sum numeric;
  v_org uuid;
  v_interests jsonb;
begin
  select organization_id, coalesce(interests, '[]'::jsonb)
    into v_org, v_interests
  from public.crm_leads
  where id = p_lead_id;

  if v_interests is null then
    return;
  end if;

  select coalesce(sum(ps.preco_base * coalesce((item->>'quantity')::int, 1)), 0)
    into v_sum
  from jsonb_array_elements(v_interests) as item
  join public.produtos_servicos ps
    on ps.id = (item->>'produto_servico_id')::uuid
   and ps.organization_id = v_org;

  if v_sum > 0 then
    update public.crm_leads
       set value = v_sum,
           updated_at = now()
     where id = p_lead_id;
  end if;
end; $$ language plpgsql;

-- 4) Trigger to recalc when interests change
create or replace function public.trg_recalc_lead_value_on_leads() returns trigger as $$
begin
  if tg_op in ('INSERT','UPDATE') then
    perform public.recalc_lead_value(new.id);
  end if;
  return new;
end; $$ language plpgsql;

drop trigger if exists recalc_lead_value_on_leads on public.crm_leads;
create trigger recalc_lead_value_on_leads
  after insert or update of interests on public.crm_leads
  for each row execute function public.trg_recalc_lead_value_on_leads();

-- 5) Update upsert_entrada_for_lead_payment to read first item from interests JSON
create or replace function public.upsert_entrada_for_lead_payment(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_entrada_id uuid;
  v_product_id uuid;
  v_first_item jsonb;
begin
  select * into r from public.crm_leads where id = p_lead_id;
  if not found then return; end if;
  if r.organization_id is null then return; end if;

  -- Preferred: explicit sold_produto_servico_id
  v_product_id := r.sold_produto_servico_id;

  -- Fallback: first interest item in JSON
  if v_product_id is null and r.interests is not null then
    select value into v_first_item from jsonb_array_elements(r.interests) limit 1;
    if v_first_item is not null then
      v_product_id := (v_first_item->>'produto_servico_id')::uuid;
    end if;
  end if;

  if coalesce(r.has_payment, false) = true and coalesce(r.payment_value, 0) > 0 then
    select entrada_id into v_entrada_id
      from public.entradas_source_links
     where organization_id = r.organization_id
       and source_type = 'lead_payment'
       and source_id = p_lead_id;

    if v_entrada_id is null then
      insert into public.entradas (
        organization_id, descricao, valor, categoria, data_entrada,
        metodo_pagamento, cliente_id, produto_servico_id, observacoes
      ) values (
        r.organization_id,
        coalesce('Pagamento lead: ' || nullif(trim(r.name), ''), 'Pagamento lead'),
        r.payment_value,
        'Vendas',
        now(),
        'dinheiro',
        null,
        v_product_id,
        'origem: lead_payment/' || p_lead_id::text
      ) returning id into v_entrada_id;

      insert into public.entradas_source_links (organization_id, source_type, source_id, entrada_id)
      values (r.organization_id, 'lead_payment', p_lead_id, v_entrada_id);
    else
      update public.entradas
         set descricao = coalesce('Pagamento lead: ' || nullif(trim(r.name), ''), 'Pagamento lead'),
             valor = r.payment_value,
             categoria = 'Vendas',
             data_entrada = now(),
             metodo_pagamento = 'dinheiro',
             produto_servico_id = v_product_id
       where id = v_entrada_id;
    end if;
  else
    -- Remove entrada if payment no longer valid
    select entrada_id into v_entrada_id
      from public.entradas_source_links
     where organization_id = r.organization_id
       and source_type = 'lead_payment'
       and source_id = p_lead_id;
    if v_entrada_id is not null then
      delete from public.entradas where id = v_entrada_id;
    end if;
  end if;
end;
$$;

-- 6) Drop old triggers and table (idempotent)
do $$
begin
  if exists (
    select 1 from information_schema.tables where table_schema = 'public' and table_name = 'crm_lead_interests'
  ) then
    drop trigger if exists recalc_lead_value_ins on public.crm_lead_interests;
    drop trigger if exists recalc_lead_value_upd on public.crm_lead_interests;
    drop trigger if exists recalc_lead_value_del on public.crm_lead_interests;
    drop table if exists public.crm_lead_interests cascade;
  end if;
end $$;

commit;

-- 1) Marcar versão$mig_v30$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v31
insert into public.master_migrations(version, name, sql)
values (
  31,
  'v31 - Add single interest columns on crm_leads and migrate from JSONB',
  $mig_v31$-- Add single interest columns on crm_leads and migrate from JSONB
-- Creates: interest_produto_servico_id (uuid), interest_quantity (int4)
-- Backfills from crm_leads.interests (first item) if present
-- Updates value recalculation and payment upsert fallback to use the new columns

begin;

-- 1) Add new columns (idempotent)
alter table if exists public.crm_leads
  add column if not exists interest_produto_servico_id uuid,
  add column if not exists interest_quantity int4;

-- Default interest_quantity to 1 when NULL
update public.crm_leads
   set interest_quantity = 1
 where interest_quantity is null;

-- 2) Backfill from interests JSONB (first array item)
do $$
declare
  v_has_interests boolean;
begin
  select exists (
    select 1 from information_schema.columns 
     where table_schema='public' and table_name='crm_leads' and column_name='interests'
  ) into v_has_interests;

  if v_has_interests then
    update public.crm_leads l
       set interest_produto_servico_id = coalesce(interest_produto_servico_id,
         (
           select (elem->>'produto_servico_id')::uuid
             from jsonb_array_elements(l.interests) elem
             order by 1
             limit 1
         )
       ),
           interest_quantity = coalesce(interest_quantity,
         (
           select greatest(1, coalesce((elem->>'quantity')::int, 1))
             from jsonb_array_elements(l.interests) elem
             order by 1
             limit 1
         )
       )
     where l.interests is not null and jsonb_typeof(l.interests) = 'array';
  end if;
end $$;

-- 3) Recalc value based on interest_* columns
create or replace function public.recalc_lead_value_by_interest(p_lead_id uuid) returns void as $$
declare
  r record;
  v_price numeric;
  v_total numeric;
begin
  select organization_id, interest_produto_servico_id, greatest(1, coalesce(interest_quantity, 1)) as qty
    into r
  from public.crm_leads
  where id = p_lead_id;

  if r.interest_produto_servico_id is null then
    return;
  end if;

  select ps.preco_base into v_price
    from public.produtos_servicos ps
   where ps.id = r.interest_produto_servico_id
     and ps.organization_id = r.organization_id;

  v_total := coalesce(v_price, 0) * coalesce(r.qty, 1);

  update public.crm_leads
     set value = coalesce(v_total, 0),
         updated_at = now()
   where id = p_lead_id;
end;
$$ language plpgsql;

-- 4) Trigger to recalc when interest columns change
create or replace function public.trg_recalc_lead_value_on_interest() returns trigger as $$
begin
  if tg_op in ('INSERT','UPDATE') then
    perform public.recalc_lead_value_by_interest(new.id);
  end if;
  return new;
end; $$ language plpgsql;

drop trigger if exists recalc_lead_value_on_interest on public.crm_leads;
create trigger recalc_lead_value_on_interest
  after insert or update of interest_produto_servico_id, interest_quantity on public.crm_leads
  for each row execute function public.trg_recalc_lead_value_on_interest();

-- 5) Update payment upsert function to use interest_* as fallback
create or replace function public.upsert_entrada_for_lead_payment(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_entrada_id uuid;
  v_product_id uuid;
begin
  select * into r from public.crm_leads where id = p_lead_id;
  if not found then return; end if;
  if r.organization_id is null then return; end if;

  -- Preferred: explicit sold product
  v_product_id := r.sold_produto_servico_id;

  -- Fallback: interest product
  if v_product_id is null then
    v_product_id := r.interest_produto_servico_id;
  end if;

  if coalesce(r.has_payment, false) = true and coalesce(r.payment_value, 0) > 0 then
    select entrada_id into v_entrada_id
      from public.entradas_source_links
     where organization_id = r.organization_id
       and source_type = 'lead_payment'
       and source_id = p_lead_id;

    if v_entrada_id is null then
      insert into public.entradas (
        organization_id, descricao, valor, categoria, data_entrada,
        metodo_pagamento, cliente_id, produto_servico_id, observacoes
      ) values (
        r.organization_id,
        coalesce('Pagamento lead: ' || nullif(trim(r.name), ''), 'Pagamento lead'),
        r.payment_value,
        'Vendas',
        now(),
        'dinheiro',
        null,
        v_product_id,
        'origem: lead_payment/' || p_lead_id::text
      ) returning id into v_entrada_id;

      insert into public.entradas_source_links (organization_id, source_type, source_id, entrada_id)
      values (r.organization_id, 'lead_payment', p_lead_id, v_entrada_id);
    else
      update public.entradas
         set descricao = coalesce('Pagamento lead: ' || nullif(trim(r.name), ''), 'Pagamento lead'),
             valor = r.payment_value,
             categoria = 'Vendas',
             data_entrada = now(),
             metodo_pagamento = 'dinheiro',
             produto_servico_id = v_product_id
       where id = v_entrada_id;
    end if;
  else
    -- Remove if no longer valid
    select entrada_id into v_entrada_id
      from public.entradas_source_links
     where organization_id = r.organization_id
       and source_type = 'lead_payment'
       and source_id = p_lead_id;
    if v_entrada_id is not null then
      delete from public.entradas where id = v_entrada_id;
    end if;
  end if;
end;
$$;

commit;


-- 1) Marcar versão$mig_v31$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v32
insert into public.master_migrations(version, name, sql)
values (
  32,
  'v32 - crm_leads',
  $mig_v32$-- crm_leads.sold_quantity deve ser obrigatório APENAS quando houver sold_produto_servico_id
-- Regra atual: coluna está NOT NULL com default 1. Vamos remover NOT NULL/default
-- e criar um CHECK condicional.

begin;

-- 1) Tornar sold_quantity opcional e remover default
alter table if exists public.crm_leads
  alter column sold_quantity drop not null;

do $$
begin
  -- Remover default, se existir (idempotente)
  begin
    alter table public.crm_leads alter column sold_quantity drop default;
  exception when others then
    -- ignora se já não houver default
    null;
  end;
end $$;

-- 2) Constraint condicional: se houver sold_produto_servico_id, exigir quantity >= 1
do $$
begin
  if not exists (
    select 1
      from pg_constraint c
      join pg_class t on c.conrelid = t.oid
     where t.relname = 'crm_leads'
       and c.conname = 'crm_leads_sold_qty_req_when_product'
  ) then
    alter table public.crm_leads
      add constraint crm_leads_sold_qty_req_when_product
      check (
        sold_produto_servico_id is null
        or (sold_quantity is not null and sold_quantity >= 1)
      );
  end if;
end $$;

commit;

-- Fim: a constraint existente crm_leads_sold_quantity_check (>= 1) é mantida.

-- 1) Marcar versão$mig_v32$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v33
insert into public.master_migrations(version, name, sql)
values (
  33,
  'v33 - Add origin tagging for CRM lead activities',
  $mig_v33$-- Add origin tagging for CRM lead activities
-- Distinção entre ações feitas via UI (com header) e automações (sem header)
--

-- 1) Schema: adicionar coluna de origem
alter table if exists public.crm_lead_activities
  add column if not exists origin text;

comment on column public.crm_lead_activities.origin is 'Origem do evento: ui | automation | edge | system';

-- 2) Função utilitária segura para obter header da requisição (se disponível)
create or replace function public.get_request_header(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_headers text;
  v_value text;
begin
  -- Tenta ler os headers do PostgREST (se disponível na versão do Supabase)
  begin
    v_headers := current_setting('request.headers', true);
  exception when others then
    v_headers := null;
  end;

  if v_headers is null then
    return null;
  end if;

  begin
    v_value := (v_headers::jsonb ->> p_name);
  exception when others then
    v_value := null;
  end;

  return v_value;
end;
$$;

-- 3) Atualizar trigger para registrar a origem
create or replace function public.log_crm_lead_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_any_inserted boolean := false;
  v_origin text;
begin
  v_actor := coalesce(new.updated_by, new.created_by, old.updated_by, old.created_by);
  v_origin := coalesce(public.get_request_header('x-tomik-origin'), 'automation');

  if tg_op = 'INSERT' then
    insert into public.crm_lead_activities (
      lead_id, user_id, action, field_changed, description, origin, created_at
    ) values (
      new.id, v_actor, 'INSERT', 'insert', 'Lead criado: ' || coalesce(new.name,''), v_origin, now()
    );
    return new;

  elsif tg_op = 'UPDATE' then
    -- Stage change
    if old.stage is distinct from new.stage then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, old_value, new_value, origin, created_at
      ) values (
        new.id, v_actor, 'UPDATE', 'stage',
        'Lead movido para: ' || coalesce(new.stage,'indefinido'),
        old.stage, new.stage, v_origin, now()
      );
      v_any_inserted := true;
    end if;

    -- Description change
    if coalesce(old.description,'') is distinct from coalesce(new.description,'') then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, old_value, new_value, origin, created_at
      ) values (
        new.id, v_actor, 'UPDATE', 'description',
        'Descrição atualizada',
        old.description, new.description, v_origin, now()
      );
      v_any_inserted := true;
    end if;

    -- Payment status change
    if coalesce(old.has_payment,false) is distinct from coalesce(new.has_payment,false) then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, old_value, new_value, origin, created_at
      ) values (
        new.id, v_actor, 'UPDATE', 'has_payment',
        case when new.has_payment then 'Lead marcado como pago' else 'Lead desmarcado como pago' end,
        coalesce(old.payment_value,0)::text,
        coalesce(new.payment_value,0)::text,
        v_origin, now()
      );
      v_any_inserted := true;
    elsif coalesce(old.payment_value,0) is distinct from coalesce(new.payment_value,0) then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, old_value, new_value, origin, created_at
      ) values (
        new.id, v_actor, 'UPDATE', 'payment_value',
        'Valor do pagamento atualizado',
        coalesce(old.payment_value,0)::text,
        coalesce(new.payment_value,0)::text,
        v_origin, now()
      );
      v_any_inserted := true;
    end if;

    if not v_any_inserted then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, origin, created_at
      ) values (
        new.id, v_actor, 'UPDATE', null, 'Lead atualizado: ' || coalesce(new.name,''), v_origin, now()
      );
    end if;

    return new;

  elsif tg_op = 'DELETE' then
    insert into public.crm_lead_activities (
      lead_id, user_id, action, field_changed, description, origin, created_at
    ) values (
      old.id, v_actor, 'DELETE', 'delete', 'Lead excluído: ' || coalesce(old.name,''), v_origin, now()
    );
    return old;
  end if;

  return new;
exception when others then
  raise notice 'CRM lead activity logging failed: %', sqlerrm;
  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

-- 4) Garantir trigger
drop trigger if exists crm_lead_activity_trigger on public.crm_leads;
create trigger crm_lead_activity_trigger
  after insert or update or delete on public.crm_leads
  for each row execute function public.log_crm_lead_changes();


-- 1) Marcar versão$mig_v33$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v34
insert into public.master_migrations(version, name, sql)
values (
  34,
  'v34 - 1) SKU column',
  $mig_v34$/*
  # Add SKU to produtos_servicos and create produto_variantes table

  1. Add column:
     - produtos_servicos.sku text (nullable)
     - Unique index (organization_id, sku) where sku is not null

  2. Create table produto_variantes (if not exists)
     - id uuid PK
     - organization_id uuid
     - produto_id uuid FK -> produtos_servicos(id) on delete cascade
     - nome text not null
     - preco numeric(12,2) not null default 0
     - cobranca_tipo text check in ('unica','mensal','trimestral','semestral','anual') default 'unica'
     - ativo boolean default true
     - created_at timestamptz default now()
     - updated_at timestamptz default now()

  3. Security
     - Enable RLS
     - Dev policy permissiva (mantém padrão do projeto)

  4. Indexes
     - produto_variantes: organization_id, produto_id
*/

-- 1) SKU column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'produtos_servicos' AND column_name = 'sku'
  ) THEN
    ALTER TABLE public.produtos_servicos ADD COLUMN sku text;
  END IF;
END $$;

-- Unique index for (organization_id, sku) when sku is not null
CREATE UNIQUE INDEX IF NOT EXISTS produtos_servicos_org_sku_uniq
  ON public.produtos_servicos(organization_id, sku)
  WHERE sku IS NOT NULL;

-- 2) produto_variantes table
CREATE TABLE IF NOT EXISTS public.produto_variantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  produto_id uuid NOT NULL REFERENCES public.produtos_servicos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  preco numeric(12,2) NOT NULL DEFAULT 0,
  cobranca_tipo text NOT NULL DEFAULT 'unica'::text CHECK (cobranca_tipo = ANY (ARRAY['unica'::text,'mensal'::text,'trimestral'::text,'semestral'::text,'anual'::text])),
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.produto_variantes ENABLE ROW LEVEL SECURITY;

-- Dev permissive policy (align with project defaults)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'produto_variantes' AND policyname = 'Dev: acesso total produto_variantes'
  ) THEN
    CREATE POLICY "Dev: acesso total produto_variantes" ON public.produto_variantes FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS produto_variantes_org_idx ON public.produto_variantes(organization_id);
CREATE INDEX IF NOT EXISTS produto_variantes_produto_idx ON public.produto_variantes(produto_id);




-- 1) Marcar versão$mig_v34$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v35
insert into public.master_migrations(version, name, sql)
values (
  35,
  'v35 - CRM Leads: custom_fields e índices de apoio à migração',
  $mig_v35$-- v35 – CRM Leads: custom_fields e índices de apoio à migração

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'custom_fields'
  ) THEN
    ALTER TABLE public.crm_leads ADD COLUMN custom_fields jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS crm_leads_org_whatsapp_idx ON public.crm_leads(organization_id, whatsapp);
CREATE INDEX IF NOT EXISTS crm_leads_org_email_idx ON public.crm_leads(organization_id, email);$mig_v35$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v36
insert into public.master_migrations(version, name, sql)
values (
  36,
  'v36 - RAG datasets e embeddings (pgvector)',
  $mig_v36$-- v36 – RAG datasets e embeddings (pgvector)

-- 0) Extensão pgvector (idempotente)
create extension if not exists vector;

-- 1) Função utilitária para setar organization_id a partir do contexto
create or replace function public.rag_set_org_from_context()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    begin
      new.organization_id := nullif(current_setting('app.organization_id', true), '')::uuid;
    exception when others then
      new.organization_id := new.organization_id;
    end;
  end if;
  return new;
end;
$$;

-- 2) Tabela de fontes (um dataset por upload)
create table if not exists public.rag_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  name text not null,
  storage_path text not null,
  mime_type text,
  status text not null default 'pending', -- pending|processing|ready|failed
  total_rows integer default 0,
  processed_rows integer default 0,
  schema_json jsonb,
  created_by uuid,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger para preencher organization_id
drop trigger if exists trg_rag_sources_set_org_from_context on public.rag_sources;
create trigger trg_rag_sources_set_org_from_context
before insert on public.rag_sources
for each row execute function public.rag_set_org_from_context();

-- 3) Itens/chunks (texto + embedding)
create table if not exists public.rag_items (
  id bigserial primary key,
  organization_id uuid,
  source_id uuid not null references public.rag_sources(id) on delete cascade,
  row_index integer,
  category text,
  content text not null,
  fields jsonb,
  metadata jsonb,
  hash text unique,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

-- Trigger para preencher organization_id nos itens
drop trigger if exists trg_rag_items_set_org_from_context on public.rag_items;
create trigger trg_rag_items_set_org_from_context
before insert on public.rag_items
for each row execute function public.rag_set_org_from_context();

-- 4) Índices úteis
create index if not exists rag_sources_org_idx on public.rag_sources (organization_id);
create index if not exists rag_items_org_idx on public.rag_items (organization_id);
create index if not exists rag_items_source_idx on public.rag_items (source_id);
create index if not exists rag_items_category_idx on public.rag_items (category);
create index if not exists rag_items_embedding_ivfflat on public.rag_items using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- 5) RLS por organização
alter table public.rag_sources enable row level security;
alter table public.rag_items enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='rag_sources' and policyname='rag_sources_select_by_org'
  ) then
    create policy rag_sources_select_by_org on public.rag_sources
      for select to authenticated
      using (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='rag_sources' and policyname='rag_sources_insert_by_org'
  ) then
    create policy rag_sources_insert_by_org on public.rag_sources
      for insert to authenticated
      with check (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='rag_sources' and policyname='rag_sources_update_by_org'
  ) then
    create policy rag_sources_update_by_org on public.rag_sources
      for update to authenticated
      using (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      ) with check (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='rag_items' and policyname='rag_items_select_by_org'
  ) then
    create policy rag_items_select_by_org on public.rag_items
      for select to authenticated
      using (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='rag_items' and policyname='rag_items_insert_by_org'
  ) then
    create policy rag_items_insert_by_org on public.rag_items
      for insert to authenticated
      with check (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='rag_items' and policyname='rag_items_update_by_org'
  ) then
    create policy rag_items_update_by_org on public.rag_items
      for update to authenticated
      using (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      ) with check (
        organization_id is not null and organization_id::text = current_setting('app.organization_id', true)
      );
  end if;
end $$;

-- 6) RPC de similaridade (usa organization_id do contexto por padrão)
drop function if exists public.match_rag(vector, uuid, text, int, uuid);
create or replace function public.match_rag(
  p_query_embedding vector(1536),
  p_source_id uuid default null,
  p_category text default null,
  p_limit int default 10,
  p_org uuid default null
)
returns table (
  id bigint,
  source_id uuid,
  category text,
  content text,
  fields jsonb,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    ri.id,
    ri.source_id,
    ri.category,
    ri.content,
    ri.fields,
    ri.metadata,
    1 - (ri.embedding <=> p_query_embedding) as similarity
  from public.rag_items ri
  where ri.embedding is not null
    and (
      ri.organization_id = coalesce(p_org, nullif(current_setting('app.organization_id', true), '')::uuid)
    )
    and (p_source_id is null or ri.source_id = p_source_id)
    and (p_category is null or ri.category = p_category)
  order by ri.embedding <=> p_query_embedding
  limit greatest(1, p_limit);
$$;

-- 7) Marcar versão$mig_v36$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v37
insert into public.master_migrations(version, name, sql)
values (
  37,
  'v37 - Migration 37',
  $mig_v37$BEGIN;

LOCK TABLE public.produtos_servicos IN SHARE ROW EXCLUSIVE MODE;

-- Add checkout_url column for product/checkout link
ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS checkout_url text;

COMMENT ON COLUMN public.produtos_servicos.checkout_url IS 'Public product/checkout link (optional)';

-- Optional: basic URL sanity via length; no strict constraint to avoid breaking imports
-- ALTER TABLE public.produtos_servicos
--   ADD CONSTRAINT produtos_servicos_checkout_url_len CHECK (char_length(checkout_url) <= 2048) NOT VALID;

COMMIT;

-- 7) Marcar versão$mig_v37$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v38
insert into public.master_migrations(version, name, sql)
values (
  38,
  'v38 - Migration 38',
  $mig_v38$BEGIN;

LOCK TABLE public.produtos_servicos IN SHARE ROW EXCLUSIVE MODE;

-- Add sales_page_url column for product sales/landing page
ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS sales_page_url text;

COMMENT ON COLUMN public.produtos_servicos.sales_page_url IS 'Public sales/landing page link (optional)';

-- Optional: basic URL sanity via length; no strict constraint to avoid breaking imports
-- ALTER TABLE public.produtos_servicos
--   ADD CONSTRAINT produtos_servicos_sales_page_url_len CHECK (char_length(sales_page_url) <= 2048) NOT VALID;

COMMIT;

-- 8) Marcar versão$mig_v38$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v39
insert into public.master_migrations(version, name, sql)
values (
  39,
  'v39 - Produtos: garantir custom_fields/tags e adicionar checkout_url em produto_variantes',
  $mig_v39$-- v39 – Produtos: garantir custom_fields/tags e adicionar checkout_url em produto_variantes

BEGIN;

-- 1) Garantir colunas de extensões em produtos_servicos (idempotente)
ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS imposto_percent numeric(5,2) CHECK (imposto_percent >= 0 AND imposto_percent <= 100),
  ADD COLUMN IF NOT EXISTS custo_base numeric(12,2),
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS estoque_minimo integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estoque_locais jsonb DEFAULT '[]'::jsonb;

-- Constraint de status (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
   WHERE t.relname = 'produtos_servicos' AND c.conname = 'produtos_servicos_status_check'
  ) THEN
    ALTER TABLE public.produtos_servicos
      ADD CONSTRAINT produtos_servicos_status_check
      CHECK (status = ANY (ARRAY['rascunho','ativo','sob_demanda','fora_catalogo']));
  END IF;
END $$;

-- Índices úteis (idempotentes)
CREATE INDEX IF NOT EXISTS idx_produtos_servicos_tags_gin ON public.produtos_servicos USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_produtos_servicos_status ON public.produtos_servicos (status);

-- 2) Tabela produto_variantes: garantir existência e adicionar checkout_url
CREATE TABLE IF NOT EXISTS public.produto_variantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  produto_id uuid NOT NULL REFERENCES public.produtos_servicos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  preco numeric(12,2) NOT NULL DEFAULT 0,
  cobranca_tipo text NOT NULL CHECK (cobranca_tipo = ANY (ARRAY['unica','mensal','trimestral','semestral','anual'])),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Nova coluna: checkout_url para link do plano/variante
ALTER TABLE public.produto_variantes
  ADD COLUMN IF NOT EXISTS checkout_url text;

-- Índices
CREATE INDEX IF NOT EXISTS idx_produto_variantes_produto ON public.produto_variantes (produto_id);
CREATE INDEX IF NOT EXISTS idx_produto_variantes_org ON public.produto_variantes (organization_id);

-- RLS padrão (mantém alinhado com ambiente dev permissivo quando necessário)
ALTER TABLE public.produto_variantes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'produto_variantes' AND policyname = 'Dev: acesso total produto_variantes'
  ) THEN
    CREATE POLICY "Dev: acesso total produto_variantes" ON public.produto_variantes FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;

-- 3) Marcar versão$mig_v39$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v40
insert into public.master_migrations(version, name, sql)
values (
  40,
  'v40 - Q&A Pairs per organization',
  $mig_v40$-- Q&A Pairs per organization
set search_path = public, auth;

create table if not exists public.qna_pairs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  pergunta text not null,
  resposta text not null,
  categoria text default 'Geral',
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_qna_pairs_org on public.qna_pairs(organization_id);
create index if not exists idx_qna_pairs_categoria on public.qna_pairs(categoria);
create index if not exists idx_qna_pairs_search on public.qna_pairs using gin (to_tsvector('portuguese', coalesce(pergunta,'') || ' ' || coalesce(resposta,'') || ' ' || coalesce(categoria,'')));

alter table public.qna_pairs enable row level security;

-- updated_at trigger (reusable)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_on_qna_pairs on public.qna_pairs;
create trigger set_timestamp_on_qna_pairs
before update on public.qna_pairs
for each row execute function public.set_updated_at();

-- RLS: organization scoped via app.organization_id (set by set_rls_context)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='qna_pairs' and policyname='qna_pairs_select_own_org') then
    create policy qna_pairs_select_own_org on public.qna_pairs
      for select to authenticated
      using (
        organization_id is not null
        and organization_id::text = nullif(current_setting('app.organization_id', true), '')
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='qna_pairs' and policyname='qna_pairs_modify_own_org') then
    create policy qna_pairs_modify_own_org on public.qna_pairs
      for all to authenticated
      using (
        organization_id is not null
        and organization_id::text = nullif(current_setting('app.organization_id', true), '')
      )
      with check (
        organization_id is not null
        and organization_id::text = nullif(current_setting('app.organization_id', true), '')
      );
  end if;
end $$;

comment on table public.qna_pairs is 'Perguntas e Respostas por organização (Q&A Knowledge Base).';



-- 3) Marcar versão$mig_v40$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v41
insert into public.master_migrations(version, name, sql)
values (
  41,
  'v41 - Q&A: ajustar RLS para permitir SELECT por anon (com contexto de organização)',
  $mig_v41$-- v41 – Q&A: ajustar RLS para permitir SELECT por anon (com contexto de organização)

BEGIN;

-- Garantir que RLS está habilitado
ALTER TABLE public.qna_pairs ENABLE ROW LEVEL SECURITY;

-- Recriar política de SELECT para incluir anon (idempotente)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='qna_pairs' AND policyname='qna_pairs_select_own_org'
  ) THEN
    DROP POLICY qna_pairs_select_own_org ON public.qna_pairs;
  END IF;
END $$;

CREATE POLICY qna_pairs_select_own_org ON public.qna_pairs
  FOR SELECT
  TO anon, authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id::text = NULLIF(current_setting('app.organization_id', true), '')
  );

-- Garantir que a política de modificação existe (apenas autenticados)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='qna_pairs' AND policyname='qna_pairs_modify_own_org'
  ) THEN
    CREATE POLICY qna_pairs_modify_own_org ON public.qna_pairs
      FOR ALL
      TO authenticated
      USING (
        organization_id IS NOT NULL
        AND organization_id::text = NULLIF(current_setting('app.organization_id', true), '')
      )
      WITH CHECK (
        organization_id IS NOT NULL
        AND organization_id::text = NULLIF(current_setting('app.organization_id', true), '')
      );
  END IF;
END $$;

COMMIT;
$mig_v41$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v42
insert into public.master_migrations(version, name, sql)
values (
  42,
  'v42 - Q&A: permitir INSERT/UPDATE/DELETE via anon (escopo por organização)',
  $mig_v42$-- v42 – Q&A: permitir INSERT/UPDATE/DELETE via anon (escopo por organização)

set search_path = public, auth;

alter table public.qna_pairs enable row level security;

do $$
begin
  if exists (
    select 1 from pg_policies 
    where schemaname='public' and tablename='qna_pairs' and policyname='qna_pairs_modify_own_org'
  ) then
    drop policy qna_pairs_modify_own_org on public.qna_pairs;
  end if;
end $$;

create policy qna_pairs_modify_own_org on public.qna_pairs
  for all
  to anon, authenticated
  using (
    organization_id is not null
    and organization_id::text = nullif(current_setting('app.organization_id', true), '')
  )
  with check (
    organization_id is not null
    and organization_id::text = nullif(current_setting('app.organization_id', true), '')
  );$mig_v42$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v43
insert into public.master_migrations(version, name, sql)
values (
  43,
  'v43 - Q&A: RPCs para inserir/bulk inserir com contexto RLS na mesma sessão',
  $mig_v43$-- v43 – Q&A: RPCs para inserir/bulk inserir com contexto RLS na mesma sessão

BEGIN;

-- Função para inserir único registro garantindo contexto de organização na MESMA sessão
create or replace function public.qna_insert(
  p_organization_id uuid,
  p_pergunta text,
  p_resposta text,
  p_categoria text default 'Geral',
  p_tags text[] default '{}'
)
returns public.qna_pairs
language plpgsql
as $$
declare
  rec public.qna_pairs;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  insert into public.qna_pairs (organization_id, pergunta, resposta, categoria, tags)
  values (
    p_organization_id,
    trim(coalesce(p_pergunta, '')),
    trim(coalesce(p_resposta, '')),
    coalesce(nullif(trim(coalesce(p_categoria, '')), ''), 'Geral'),
    coalesce(p_tags, '{}'::text[])
  )
  returning * into rec;
  return rec;
end;
$$;

grant execute on function public.qna_insert(uuid, text, text, text, text[]) to anon, authenticated;

-- Função bulk – insere vários itens (espera JSON array de objetos)
create or replace function public.qna_bulk_upsert(
  p_organization_id uuid,
  p_items jsonb
)
returns integer
language plpgsql
as $$
declare
  item jsonb;
  v_count int := 0;
  v_tags text[];
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return 0;
  end if;
  for item in select jsonb_array_elements(p_items) loop
    v_tags := coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(item->'tags_list')),
      '{}'::text[]
    );
    insert into public.qna_pairs (organization_id, pergunta, resposta, categoria, tags)
    values (
      p_organization_id,
      trim(coalesce(item->>'pergunta', '')),
      trim(coalesce(item->>'resposta', '')),
      coalesce(nullif(trim(coalesce(item->>'categoria', '')), ''), 'Geral'),
      v_tags
    )
    on conflict do nothing;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.qna_bulk_upsert(uuid, jsonb) to anon, authenticated;

COMMIT;
$mig_v43$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v44
insert into public.master_migrations(version, name, sql)
values (
  44,
  'v44 - Q&A: RLS lê header x-organization-id como fallback do app.organization_id',
  $mig_v44$-- v44 – Q&A: RLS lê header x-organization-id como fallback do app.organization_id

BEGIN;

-- Habilitar RLS (idempotente)
ALTER TABLE public.qna_pairs ENABLE ROW LEVEL SECURITY;

-- Recriar política de SELECT para aceitar o header OU GUC
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='qna_pairs' AND policyname='qna_pairs_select_own_org'
  ) THEN
    DROP POLICY qna_pairs_select_own_org ON public.qna_pairs;
  END IF;
END $$;

CREATE POLICY qna_pairs_select_own_org ON public.qna_pairs
  FOR SELECT
  TO anon, authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id::text = coalesce(
      nullif(current_setting('request.header.x-organization-id', true), ''),
      nullif(current_setting('app.organization_id', true), '')
    )
  );

-- Recriar política de modificação para aceitar o header OU GUC
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='qna_pairs' AND policyname='qna_pairs_modify_own_org'
  ) THEN
    DROP POLICY qna_pairs_modify_own_org ON public.qna_pairs;
  END IF;
END $$;

CREATE POLICY qna_pairs_modify_own_org ON public.qna_pairs
  FOR ALL
  TO anon, authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id::text = coalesce(
      nullif(current_setting('request.header.x-organization-id', true), ''),
      nullif(current_setting('app.organization_id', true), '')
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id::text = coalesce(
      nullif(current_setting('request.header.x-organization-id', true), ''),
      nullif(current_setting('app.organization_id', true), '')
    )
  );

COMMIT;
$mig_v44$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v45
insert into public.master_migrations(version, name, sql)
values (
  45,
  'v45 - Q&A: RPC qna_list (lista itens com contexto de organização na mesma sessão)',
  $mig_v45$-- v45 – Q&A: RPC qna_list (lista itens com contexto de organização na mesma sessão)

BEGIN;

set search_path = public, auth;

-- Função para listar Q&A garantindo contexto de organização
create or replace function public.qna_list(
  p_organization_id uuid,
  p_query text default null,
  p_limit int default 200,
  p_offset int default 0
)
returns setof public.qna_pairs
language plpgsql
as $$
begin
  -- Garantir contexto da organização na sessão atual (RLS)
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);

  return query
    select *
    from public.qna_pairs
    where organization_id = p_organization_id
      and (
        p_query is null
        or trim(p_query) = ''
        or (
          to_tsvector('portuguese', coalesce(pergunta,'') || ' ' || coalesce(resposta,'') || ' ' || coalesce(categoria,''))
          @@ plainto_tsquery('portuguese', p_query)
        )
      )
    order by updated_at desc
    limit greatest(0, coalesce(p_limit, 200))
    offset greatest(0, coalesce(p_offset, 0));
end;
$$;

grant execute on function public.qna_list(uuid, text, int, int) to anon, authenticated;

COMMIT;
$mig_v45$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v46
insert into public.master_migrations(version, name, sql)
values (
  46,
  'v46 - Agent Prompts – store per-organization agent prompts and related instructions',
  $mig_v46$-- Agent Prompts – store per-organization agent prompts and related instructions
-- Use case: N8n or the app can fetch the latest prompt by organization + agent_name

-- 1) Table
create table if not exists public.agent_prompts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  agent_name text not null,
  prompt text not null,
  tools_instructions text null,
  tasks text null,
  business_description text null,
  agent_goal text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, agent_name)
);

create index if not exists agent_prompts_org_idx on public.agent_prompts (organization_id);

-- 2) RLS
alter table public.agent_prompts enable row level security;

-- 3) updated_at trigger (idempotent shared helper)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_on_agent_prompts on public.agent_prompts;
create trigger set_timestamp_on_agent_prompts
before update on public.agent_prompts
for each row execute function public.set_updated_at();

-- 4) Policies (idempotent) –
-- Select is allowed for anon and authenticated when org context is provided via header or app setting.
-- Modifications restricted to authenticated with the same org context.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_prompts' and policyname = 'agent_prompts_select_ctx'
  ) then
    create policy agent_prompts_select_ctx on public.agent_prompts
      for select
      to anon, authenticated
      using (
        organization_id is not null
        and organization_id::text = coalesce(
          nullif(current_setting('request.header.x-organization-id', true), ''),
          nullif(current_setting('app.organization_id', true), '')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_prompts' and policyname = 'agent_prompts_modify_ctx'
  ) then
    create policy agent_prompts_modify_ctx on public.agent_prompts
      for all
      to authenticated
      using (
        organization_id is not null
        and organization_id::text = coalesce(
          nullif(current_setting('request.header.x-organization-id', true), ''),
          nullif(current_setting('app.organization_id', true), '')
        )
      )
      with check (
        organization_id is not null
        and organization_id::text = coalesce(
          nullif(current_setting('request.header.x-organization-id', true), ''),
          nullif(current_setting('app.organization_id', true), '')
        )
      );
  end if;
end $$;


-- agent_prompts RLS fix: allow writes from anon (UI) with strict org check

BEGIN;

-- Ensure RLS is enabled (idempotent safety)
ALTER TABLE IF EXISTS public.agent_prompts ENABLE ROW LEVEL SECURITY;

-- Recreate modify policy to include anon + authenticated with WITH CHECK
DROP POLICY IF EXISTS agent_prompts_modify_ctx ON public.agent_prompts;
CREATE POLICY agent_prompts_modify_ctx ON public.agent_prompts
  FOR ALL
  TO anon, authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id::text = coalesce(
      NULLIF(current_setting('request.header.x-organization-id', true), ''),
      NULLIF(current_setting('app.organization_id', true), '')
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id::text = coalesce(
      NULLIF(current_setting('request.header.x-organization-id', true), ''),
      NULLIF(current_setting('app.organization_id', true), '')
    )
  );

COMMIT;

-- v45 – Agent Prompts: RPCs para upsert com contexto RLS na mesma sessão

BEGIN;

create or replace function public.agent_prompts_upsert(
  p_organization_id uuid,
  p_agent_name text,
  p_prompt text,
  p_tools_instructions text default null,
  p_tasks text default null,
  p_business_description text default null,
  p_agent_goal text default null
)
returns public.agent_prompts
language plpgsql
as $$
declare
  rec public.agent_prompts;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  insert into public.agent_prompts (
    organization_id, agent_name, prompt, tools_instructions, tasks, business_description, agent_goal
  ) values (
    p_organization_id,
    trim(coalesce(p_agent_name, '')),
    trim(coalesce(p_prompt, '')),
    nullif(trim(coalesce(p_tools_instructions, '')), ''),
    nullif(trim(coalesce(p_tasks, '')), ''),
    nullif(trim(coalesce(p_business_description, '')), ''),
    nullif(trim(coalesce(p_agent_goal, '')), '')
  )
  on conflict (organization_id, agent_name)
  do update set
    prompt = EXCLUDED.prompt,
    tools_instructions = EXCLUDED.tools_instructions,
    tasks = EXCLUDED.tasks,
    business_description = EXCLUDED.business_description,
    agent_goal = EXCLUDED.agent_goal,
    updated_at = now()
  returning * into rec;
  return rec;
end;
$$;

grant execute on function public.agent_prompts_upsert(
  uuid, text, text, text, text, text, text
) to anon, authenticated;

COMMIT;


$mig_v46$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v47
insert into public.master_migrations(version, name, sql)
values (
  47,
  'v47 - RPCs de delete para Q&A e Agent Prompts com contexto RLS na mesma sessão',
  $mig_v47$-- v47 – RPCs de delete para Q&A e Agent Prompts com contexto RLS na mesma sessão

BEGIN;

-- Q&A: deletar por id
create or replace function public.qna_delete(
  p_organization_id uuid,
  p_id uuid
)
returns boolean
language plpgsql
as $$
declare
  v_deleted int := 0;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  delete from public.qna_pairs
  where id = p_id
    and organization_id = p_organization_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

grant execute on function public.qna_delete(uuid, uuid) to anon, authenticated;

-- Agent Prompts: deletar por id
create or replace function public.agent_prompts_delete(
  p_organization_id uuid,
  p_id uuid
)
returns boolean
language plpgsql
as $$
declare
  v_deleted int := 0;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  delete from public.agent_prompts
  where id = p_id
    and organization_id = p_organization_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

grant execute on function public.agent_prompts_delete(uuid, uuid) to anon, authenticated;

COMMIT;$mig_v47$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v48
insert into public.master_migrations(version, name, sql)
values (
  48,
  'v48 - Trilha de Monetização: RLS com header x-organization-id',
  $mig_v48$-- v48 – Trilha de Monetização: RLS com header x-organization-id

BEGIN;

-- Habilitar RLS (idempotente)
ALTER TABLE public.monetization_trail_progress ENABLE ROW LEVEL SECURITY;

-- Recriar política de SELECT para aceitar o header OU GUC
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='monetization_trail_progress' AND policyname='trail_read_ctx'
  ) THEN
    DROP POLICY trail_read_ctx ON public.monetization_trail_progress;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='monetization_trail_progress' AND policyname='trail_read_org'
  ) THEN
    DROP POLICY trail_read_org ON public.monetization_trail_progress;
  END IF;
END $$;

CREATE POLICY trail_read_ctx ON public.monetization_trail_progress
  FOR SELECT
  TO anon, authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id::text = coalesce(
      nullif(current_setting('request.header.x-organization-id', true), ''),
      nullif(current_setting('app.organization_id', true), '')
    )
  );

-- Recriar política de modificação para aceitar o header OU GUC
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='monetization_trail_progress' AND policyname='trail_modify_ctx'
  ) THEN
    DROP POLICY trail_modify_ctx ON public.monetization_trail_progress;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='monetization_trail_progress' AND policyname='trail_write_org'
  ) THEN
    DROP POLICY trail_write_org ON public.monetization_trail_progress;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='monetization_trail_progress' AND policyname='trail_update_org'
  ) THEN
    DROP POLICY trail_update_org ON public.monetization_trail_progress;
  END IF;
END $$;

CREATE POLICY trail_modify_ctx ON public.monetization_trail_progress
  FOR ALL
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id::text = coalesce(
      nullif(current_setting('request.header.x-organization-id', true), ''),
      nullif(current_setting('app.organization_id', true), '')
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id::text = coalesce(
      nullif(current_setting('request.header.x-organization-id', true), ''),
      nullif(current_setting('app.organization_id', true), '')
    )
  );

COMMIT;
$mig_v48$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v49
insert into public.master_migrations(version, name, sql)
values (
  49,
  'v49 - AI Agent Metrics schema and functions',
  $mig_v49$-- AI Agent Metrics schema and functions
-- Computes conversation-level and daily metrics for WhatsApp repository messages
-- Follows organization-scoped RLS via explicit organization_id param

-- 1) Helpful indexes on repositorio_de_mensagens for time-window queries
create index if not exists idx_rm_org_time on public.repositorio_de_mensagens(organization_id, created_at desc);
create index if not exists idx_rm_org_sender on public.repositorio_de_mensagens(organization_id, sender_type);
create index if not exists idx_rm_org_whats on public.repositorio_de_mensagens(organization_id, whatsapp_cliente, whatsapp_empresa);

-- 2) Conversation message counts per (whatsapp_cliente, whatsapp_empresa)
--    Returns total messages and IA-only counts for a given window
create or replace function public.ai_agent_metrics_conversation_counts(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  whatsapp_cliente text,
  whatsapp_empresa text,
  total_messages bigint,
  ia_messages bigint,
  human_messages bigint,
  first_message_at timestamptz,
  last_message_at timestamptz
)
language sql
stable
as $$
  with base as (
    select whatsapp_cliente,
           whatsapp_empresa,
           sender_type,
           created_at
    from public.repositorio_de_mensagens
    where organization_id = p_org
      and created_at >= p_from
      and created_at <= p_to
  )
  select
    b.whatsapp_cliente,
    b.whatsapp_empresa,
    count(*) as total_messages,
    count(*) filter (where b.sender_type = 'ia') as ia_messages,
    count(*) filter (where b.sender_type = 'cliente' or b.sender_type = 'humano') as human_messages,
    min(b.created_at) as first_message_at,
    max(b.created_at) as last_message_at
  from base b
  where coalesce(b.whatsapp_cliente, '') <> '' and coalesce(b.whatsapp_empresa, '') <> ''
  group by 1,2
  order by last_message_at desc;
$$;

comment on function public.ai_agent_metrics_conversation_counts is 'Conversation-level message counts and time bounds for a window, grouped by client/company numbers.';

-- 3) Conversation dynamics focused on user intervals (cliente only)
--    Computes per-conversation stats: avg, median, p90 interval (seconds) between consecutive messages from the user
create or replace function public.ai_agent_metrics_conversation_dynamics(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  whatsapp_cliente text,
  whatsapp_empresa text,
  messages_from_user bigint,
  avg_interval_seconds numeric,
  median_interval_seconds numeric,
  p90_interval_seconds numeric
)
language plpgsql
stable
as $$
begin
  return query
  with msgs as (
    select whatsapp_cliente,
           whatsapp_empresa,
           created_at,
           lag(created_at) over(partition by whatsapp_cliente, whatsapp_empresa order by created_at) as prev_created_at,
           sender_type
    from public.repositorio_de_mensagens
    where organization_id = p_org
      and created_at >= p_from
      and created_at <= p_to
      and sender_type = 'cliente'
      and coalesce(whatsapp_cliente,'') <> ''
      and coalesce(whatsapp_empresa,'') <> ''
  ), gaps as (
    select whatsapp_cliente,
           whatsapp_empresa,
           extract(epoch from (created_at - prev_created_at))::numeric as gap_seconds
    from msgs
    where prev_created_at is not null
  ), stats as (
    select whatsapp_cliente,
           whatsapp_empresa,
           count(*) as messages_from_user,
           avg(gap_seconds) as avg_interval_seconds,
           percentile_cont(0.5) within group (order by gap_seconds) as median_interval_seconds,
           percentile_cont(0.90) within group (order by gap_seconds) as p90_interval_seconds
    from gaps
    group by whatsapp_cliente, whatsapp_empresa
  )
  select * from stats
  order by messages_from_user desc;
end;
$$;

comment on function public.ai_agent_metrics_conversation_dynamics is 'Per-conversation user-only inter-message intervals (avg/median/p90) within a time window.';

-- 4) Daily aggregates (America/Sao_Paulo, UTC-3) with counts of distinct users and messages per day
--    p_granularity: 'day' | 'week' | 'month' | '90d' (rolled into days)
create or replace function public.ai_agent_metrics_daily(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  day date,
  messages_total bigint,
  users_attended bigint
)
language sql
stable
as $$
  with tz as (
    select (created_at at time zone 'America/Sao_Paulo')::date as d,
           whatsapp_cliente
    from public.repositorio_de_mensagens
    where organization_id = p_org
      and created_at >= p_from
      and created_at <= p_to
  )
  select
    t.d as day,
    count(*) as messages_total,
    count(distinct t.whatsapp_cliente) as users_attended
  from tz t
  group by t.d
  order by t.d asc;
$$;

comment on function public.ai_agent_metrics_daily is 'Daily totals in America/Sao_Paulo: messages and distinct users attended per day.';

-- 5) Wrapper RPC enforcing org context from session/app header when called via anon (optional)
-- We keep direct p_org param for Edge usage. Policies should ensure callers can only see their org.

-- 5) Summary across the window: total messages and distinct users attended (unique whatsapp_cliente)
create or replace function public.ai_agent_metrics_summary(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  total_messages bigint,
  human_messages bigint,
  users_attended bigint
)
language sql
stable
as $$
  select
    count(*) as total_messages,
    count(*) filter (where sender_type in ('cliente','humano')) as human_messages,
    count(distinct whatsapp_cliente) as users_attended
  from public.repositorio_de_mensagens
  where organization_id = p_org
    and created_at >= p_from
    and created_at <= p_to;
$$;

comment on function public.ai_agent_metrics_summary is 'Window summary: total messages and distinct whatsapp_cliente count for the organization.';

-- 6) Persistent daily aggregation table (optional performance/cache layer)
create table if not exists public.ai_agent_metrics_daily_agg (
  organization_id uuid not null,
  day date not null,
  messages_total bigint not null,
  users_attended bigint not null,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, day)
);

alter table public.ai_agent_metrics_daily_agg enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_agent_metrics_daily_agg' and policyname = 'Allow org read'
  ) then
    create policy "Allow org read" on public.ai_agent_metrics_daily_agg
      for select
      using (current_setting('app.organization_id', true)::uuid = organization_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_agent_metrics_daily_agg' and policyname = 'Allow org upsert'
  ) then
    create policy "Allow org upsert" on public.ai_agent_metrics_daily_agg
      for insert with check (current_setting('app.organization_id', true)::uuid = organization_id);
    create policy "Allow org update" on public.ai_agent_metrics_daily_agg
      for update using (current_setting('app.organization_id', true)::uuid = organization_id);
  end if;
end $$;

-- 7) Backfill RPC to populate daily aggregation from repositorio_de_mensagens
create or replace function public.ai_agent_metrics_backfill_daily(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns void
language plpgsql
as $$
begin
  -- Ensure RLS context for policies that rely on app.organization_id
  perform set_config('app.organization_id', p_org::text, true);

  with d as (
    select
      (created_at at time zone 'America/Sao_Paulo')::date as day,
      count(*) as messages_total,
      count(distinct whatsapp_cliente) as users_attended
    from public.repositorio_de_mensagens
    where organization_id = p_org
      and created_at >= p_from
      and created_at <= p_to
    group by 1
  )
  insert into public.ai_agent_metrics_daily_agg(organization_id, day, messages_total, users_attended, inserted_at, updated_at)
  select p_org, d.day, d.messages_total, d.users_attended, now(), now()
  from d
  on conflict (organization_id, day) do update
    set messages_total = excluded.messages_total,
        users_attended = excluded.users_attended,
        updated_at = now();
end;
$$;

-- 8) Conversation depth metrics (messages per conversation statistics)
create or replace function public.ai_agent_metrics_depth(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  conversations bigint,
  messages_total bigint,
  avg_msgs_per_conversation numeric,
  p50_msgs_per_conversation numeric,
  p90_msgs_per_conversation numeric
)
language sql
stable
as $$
  with conv as (
    select whatsapp_cliente, whatsapp_empresa, count(*) as msgs
    from public.repositorio_de_mensagens
    where organization_id = p_org
      and created_at >= p_from and created_at <= p_to
      and coalesce(whatsapp_cliente,'') <> '' and coalesce(whatsapp_empresa,'') <> ''
    group by 1,2
  )
  select
    count(*) as conversations,
    coalesce(sum(msgs),0) as messages_total,
    case when count(*) > 0 then round(avg(msgs)::numeric, 2) else 0 end as avg_msgs_per_conversation,
    percentile_cont(0.5) within group (order by msgs) as p50_msgs_per_conversation,
    percentile_cont(0.90) within group (order by msgs) as p90_msgs_per_conversation
  from conv;
$$;

-- 9) Human involvement rate: % of conversations with at least 1 human message in window
create or replace function public.ai_agent_metrics_human_involvement(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  conversations bigint,
  conversations_with_human bigint,
  involvement_rate numeric
)
language sql
stable
as $$
  with conv as (
    select whatsapp_cliente, whatsapp_empresa,
           bool_or(sender_type in ('cliente','humano')) as has_human
    from public.repositorio_de_mensagens
    where organization_id = p_org
      and created_at >= p_from and created_at <= p_to
      and coalesce(whatsapp_cliente,'') <> '' and coalesce(whatsapp_empresa,'') <> ''
    group by 1,2
  )
  select
    count(*) as conversations,
    count(*) filter (where has_human) as conversations_with_human,
    case when count(*) > 0 then round(100.0 * count(*) filter (where has_human) / count(*), 2) else 0 end as involvement_rate
  from conv;
$$;

-- 10) Time-to-handoff: messages until first human message (per conversation) + percentiles
create or replace function public.ai_agent_metrics_time_to_handoff(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  conversations bigint,
  with_handoff bigint,
  avg_msgs_until_handoff numeric,
  p50_msgs_until_handoff numeric,
  p90_msgs_until_handoff numeric
)
language sql
stable
as $$
  with msgs as (
    select whatsapp_cliente, whatsapp_empresa, sender_type, created_at
    from public.repositorio_de_mensagens
    where organization_id = p_org
      and created_at >= p_from and created_at <= p_to
      and coalesce(whatsapp_cliente,'') <> '' and coalesce(whatsapp_empresa,'') <> ''
  ), ordered as (
    select *, row_number() over (partition by whatsapp_cliente, whatsapp_empresa order by created_at) as rn
    from msgs
  ), first_human as (
    select whatsapp_cliente, whatsapp_empresa, min(rn) as first_human_rn
    from ordered where sender_type in ('cliente','humano') group by 1,2
  ), conv as (
    select o.whatsapp_cliente, o.whatsapp_empresa, o.rn, fh.first_human_rn
    from ordered o
    left join first_human fh using (whatsapp_cliente, whatsapp_empresa)
  ), per_conv as (
    select whatsapp_cliente, whatsapp_empresa,
           min(first_human_rn) as first_handoff_at,
           max(rn) as last_rn
    from conv group by 1,2
  ), filtered as (
    select * from per_conv
  )
  select
    count(*) as conversations,
    count(*) filter (where first_handoff_at is not null) as with_handoff,
    case when count(*) filter (where first_handoff_at is not null) > 0
      then round(avg(first_handoff_at)::numeric, 2) else 0 end as avg_msgs_until_handoff,
    percentile_cont(0.5) within group (order by first_handoff_at) filter (where first_handoff_at is not null) as p50_msgs_until_handoff,
    percentile_cont(0.90) within group (order by first_handoff_at) filter (where first_handoff_at is not null) as p90_msgs_until_handoff
  from filtered;
$$;


-- 11) Top terms (n-grams simples) a partir de content_text
create or replace function public.ai_agent_metrics_top_terms(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz,
  p_limit int default 20,
  p_min_len int default 3,
  p_ngram int default 1
)
returns table (
  term text,
  freq bigint
)
language sql
stable
as $$
  with msgs as (
    select regexp_split_to_array(lower(coalesce(content_text,'')), '[^0-9A-Za-zÀ-ÿ]+' ) as arr
    from public.repositorio_de_mensagens
    where organization_id = p_org
      and created_at >= p_from and created_at <= p_to
      and coalesce(content_text,'') <> ''
  ), unigrams as (
    select t.token as term
    from msgs m,
         unnest(m.arr) with ordinality as t(token, pos)
    where length(t.token) >= p_min_len
  ), bigrams as (
    select concat(t1.token,' ',t2.token) as term
    from msgs m,
         unnest(m.arr) with ordinality as t1(token, pos)
         join unnest(m.arr) with ordinality as t2(token, pos)
           on t2.pos = t1.pos + 1
    where length(t1.token) >= p_min_len and length(t2.token) >= p_min_len
  ), terms as (
    select term from unigrams where p_ngram = 1
    union all
    select term from bigrams where p_ngram = 2
  )
  select term, count(*) as freq
  from terms
  group by term
  order by freq desc
  limit greatest(p_limit, 1);
$$;

-- 12) Satisfação proxy via termos de agradecimento (cliente/humano)
create or replace function public.ai_agent_metrics_satisfaction_proxy(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  conversations bigint,
  positive_conversations bigint,
  satisfaction_rate numeric
)
language sql
stable
as $$
  with msgs as (
    select whatsapp_cliente, whatsapp_empresa, lower(coalesce(content_text,'')) as txt
    from public.repositorio_de_mensagens
    where organization_id = p_org
      and created_at >= p_from and created_at <= p_to
      and sender_type in ('cliente','humano')
      and coalesce(content_text,'') <> ''
  ), flags as (
    select whatsapp_cliente, whatsapp_empresa,
           bool_or(txt ~* '\m(obrigad|valeu)') as is_positive
    from msgs
    group by 1,2
  )
  select
    count(*) as conversations,
    count(*) filter (where is_positive) as positive_conversations,
    case when count(*) > 0 then round(100.0 * count(*) filter (where is_positive) / count(*), 2) else 0 end as satisfaction_rate
  from flags;
$$;

-- 13) Métricas por instância (whatsapp_empresa)
create or replace function public.ai_agent_metrics_by_instance(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  whatsapp_empresa text,
  messages_total bigint,
  conversations bigint,
  conversations_with_human bigint,
  involvement_rate numeric,
  avg_msgs_per_conversation numeric
)
language sql
stable
as $$
  with base as (
    select whatsapp_empresa, whatsapp_cliente, sender_type
    from public.repositorio_de_mensagens
    where organization_id = p_org
      and created_at >= p_from and created_at <= p_to
      and coalesce(whatsapp_empresa,'') <> '' and coalesce(whatsapp_cliente,'') <> ''
  ), msgs as (
    select whatsapp_empresa, count(*) as messages_total
    from base group by 1
  ), conv as (
    select whatsapp_empresa, whatsapp_cliente, count(*) as msgs,
           bool_or(sender_type in ('cliente','humano')) as has_human
    from base
    group by 1,2
  ), agg as (
    select whatsapp_empresa,
           count(*) as conversations,
           count(*) filter (where has_human) as conversations_with_human,
           case when count(*) > 0 then round(100.0 * count(*) filter (where has_human) / count(*), 2) else 0 end as involvement_rate,
           case when count(*) > 0 then round(avg(msgs)::numeric, 2) else 0 end as avg_msgs_per_conversation
    from conv group by 1
  )
  select a.whatsapp_empresa, m.messages_total, a.conversations, a.conversations_with_human, a.involvement_rate, a.avg_msgs_per_conversation
  from agg a
  left join msgs m using (whatsapp_empresa)
  order by m.messages_total desc nulls last, a.conversations desc;
$$;




$mig_v49$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v50
insert into public.master_migrations(version, name, sql)
values (
  50,
  'v50 - Agent Prompts: RPC de listagem com contexto RLS na mesma sessão',
  $mig_v50$-- v50 – Agent Prompts: RPC de listagem com contexto RLS na mesma sessão

BEGIN;

create or replace function public.agent_prompts_list(
  p_organization_id uuid,
  p_query text default null,
  p_limit int default 500,
  p_offset int default 0
)
returns setof public.agent_prompts
language plpgsql
as $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  return query
    select *
    from public.agent_prompts
    where organization_id = p_organization_id
      and (
        p_query is null
        or p_query = ''
        or (
          coalesce(agent_name,'') ilike '%' || p_query || '%'
          or coalesce(prompt,'') ilike '%' || p_query || '%'
          or coalesce(business_description,'') ilike '%' || p_query || '%'
          or coalesce(agent_goal,'') ilike '%' || p_query || '%'
        )
      )
    order by updated_at desc
    limit greatest(p_limit, 1)
    offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.agent_prompts_list(uuid, text, int, int) to anon, authenticated;

COMMIT;$mig_v50$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v51
insert into public.master_migrations(version, name, sql)
values (
  51,
  'v51 - Migration 51',
  $mig_v51$BEGIN;

-- v51 – Agent Prompts: adicionar campos JSONB para Output Format, RLHF e Few-Shots
alter table if exists public.agent_prompts
  add column if not exists output_format jsonb default '{}'::jsonb,
  add column if not exists rhf_feedbacks jsonb default '[]'::jsonb,
  add column if not exists fewshots_examples jsonb default '[]'::jsonb;

COMMIT;
$mig_v51$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v52
insert into public.master_migrations(version, name, sql)
values (
  52,
  'v52 - Migration 52',
  $mig_v52$BEGIN;

-- v52 – Agent Prompts: atualizar RPCs para incluir novos campos JSONB e contexto de organização

-- Listagem com contexto (mesma sessão)
create or replace function public.agent_prompts_list(
  p_organization_id uuid,
  p_query text default null,
  p_limit int default 500,
  p_offset int default 0
)
returns setof public.agent_prompts
language plpgsql
as $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  return query
    select id,
           organization_id,
           agent_name,
           prompt,
           tools_instructions,
           tasks,
           business_description,
           agent_goal,
           output_format,
           rhf_feedbacks,
           fewshots_examples,
           created_at,
           updated_at
    from public.agent_prompts
    where organization_id = p_organization_id
      and (
        p_query is null
        or p_query = ''
        or (
          coalesce(agent_name,'') ilike '%' || p_query || '%'
          or coalesce(prompt,'') ilike '%' || p_query || '%'
          or coalesce(business_description,'') ilike '%' || p_query || '%'
          or coalesce(agent_goal,'') ilike '%' || p_query || '%'
        )
      )
    order by updated_at desc
    limit greatest(p_limit, 1)
    offset greatest(p_offset, 0);
end;
$$;
grant execute on function public.agent_prompts_list(uuid, text, int, int) to anon, authenticated;

-- Upsert incluindo os novos campos
create or replace function public.agent_prompts_upsert(
  p_organization_id uuid,
  p_agent_name text,
  p_prompt text,
  p_tools_instructions text default null,
  p_tasks text default null,
  p_business_description text default null,
  p_agent_goal text default null,
  p_output_format jsonb default '{}'::jsonb,
  p_rhf_feedbacks jsonb default '[]'::jsonb,
  p_fewshots_examples jsonb default '[]'::jsonb
)
returns public.agent_prompts
language plpgsql
as $$
declare
  rec public.agent_prompts;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  insert into public.agent_prompts (
    organization_id,
    agent_name,
    prompt,
    tools_instructions,
    tasks,
    business_description,
    agent_goal,
    output_format,
    rhf_feedbacks,
    fewshots_examples
  ) values (
    p_organization_id,
    trim(coalesce(p_agent_name, '')),
    trim(coalesce(p_prompt, '')),
    nullif(trim(coalesce(p_tools_instructions, '')), ''),
    nullif(trim(coalesce(p_tasks, '')), ''),
    nullif(trim(coalesce(p_business_description, '')), ''),
    nullif(trim(coalesce(p_agent_goal, '')), ''),
    p_output_format,
    p_rhf_feedbacks,
    p_fewshots_examples
  )
  on conflict (organization_id, agent_name)
  do update set
    prompt = EXCLUDED.prompt,
    tools_instructions = EXCLUDED.tools_instructions,
    tasks = EXCLUDED.tasks,
    business_description = EXCLUDED.business_description,
    agent_goal = EXCLUDED.agent_goal,
    output_format = EXCLUDED.output_format,
    rhf_feedbacks = EXCLUDED.rhf_feedbacks,
    fewshots_examples = EXCLUDED.fewshots_examples,
    updated_at = now()
  returning * into rec;
  return rec;
end;
$$;
grant execute on function public.agent_prompts_upsert(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb
) to anon, authenticated;

COMMIT;$mig_v52$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v53
insert into public.master_migrations(version, name, sql)
values (
  53,
  'v53 - Migration 53',
  $mig_v53$BEGIN;

-- v53 – RPC rm_list_chats: listar conversas agregadas por organização
create or replace function public.rm_list_chats(
  p_organization_id uuid,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  conversation_id text,
  whatsapp_empresa text,
  whatsapp_cliente text,
  last_message_at timestamptz,
  messages_count bigint
)
language sql
stable
as $$
  select
    m.conversation_id,
    m.whatsapp_empresa,
    m.whatsapp_cliente,
    max(m.created_at) as last_message_at,
    count(*) as messages_count
  from public.repositorio_de_mensagens m
  where m.organization_id = p_organization_id
  group by m.conversation_id, m.whatsapp_empresa, m.whatsapp_cliente
  order by last_message_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0)
$$;

do $$ begin
  grant execute on function public.rm_list_chats(uuid, int, int) to anon, authenticated;
exception when others then null; end $$;

COMMIT;$mig_v53$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v54
insert into public.master_migrations(version, name, sql)
values (
  54,
  'v54 - Migration 54',
  $mig_v54$BEGIN;

-- v54 – Fix agent_prompts_list: return columns in table order (avoid 42804)

drop function if exists public.agent_prompts_list(uuid, text, int, int);

create or replace function public.agent_prompts_list(
  p_organization_id uuid,
  p_query text default null,
  p_limit int default 500,
  p_offset int default 0
)
returns setof public.agent_prompts
language plpgsql
as $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  return query
    select *
      from public.agent_prompts
     where organization_id = p_organization_id
       and (
         p_query is null
         or p_query = ''
         or (
           coalesce(agent_name,'') ilike '%' || p_query || '%'
           or coalesce(prompt,'') ilike '%' || p_query || '%'
           or coalesce(business_description,'') ilike '%' || p_query || '%'
           or coalesce(agent_goal,'') ilike '%' || p_query || '%'
         )
       )
     order by updated_at desc
     limit greatest(p_limit, 1)
     offset greatest(p_offset, 0);
end;
$$;

do $$ begin
  grant execute on function public.agent_prompts_list(uuid, text, int, int) to anon, authenticated;
exception when others then null; end $$;

COMMIT;$mig_v54$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v55
insert into public.master_migrations(version, name, sql)
values (
  55,
  'v55 - Migration 55',
  $mig_v55$BEGIN;

-- v55 – Agent Prompts: tonalidade (tone_of_voice) + upsert atualizado

-- 1) Coluna nova em agent_prompts
alter table if exists public.agent_prompts
  add column if not exists tone_of_voice text null;

-- 2) RPC upsert com p_tone_of_voice e grants
drop function if exists public.agent_prompts_upsert(uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb);

create or replace function public.agent_prompts_upsert(
  p_organization_id uuid,
  p_agent_name text,
  p_prompt text,
  p_tools_instructions text default null,
  p_tasks text default null,
  p_business_description text default null,
  p_agent_goal text default null,
  p_output_format jsonb default '{}'::jsonb,
  p_rhf_feedbacks jsonb default '[]'::jsonb,
  p_fewshots_examples jsonb default '[]'::jsonb,
  p_tone_of_voice text default null
)
returns public.agent_prompts
language plpgsql
as $$
declare
  rec public.agent_prompts;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  insert into public.agent_prompts (
    organization_id, agent_name, prompt, tools_instructions, tasks, business_description, agent_goal, output_format, rhf_feedbacks, fewshots_examples, tone_of_voice
  ) values (
    p_organization_id,
    trim(coalesce(p_agent_name, '')),
    trim(coalesce(p_prompt, '')),
    nullif(trim(coalesce(p_tools_instructions, '')), ''),
    nullif(trim(coalesce(p_tasks, '')), ''),
    nullif(trim(coalesce(p_business_description, '')), ''),
    nullif(trim(coalesce(p_agent_goal, '')), ''),
    p_output_format,
    p_rhf_feedbacks,
    p_fewshots_examples,
    nullif(trim(coalesce(p_tone_of_voice, '')), '')
  )
  on conflict (organization_id, agent_name)
  do update set
    prompt = EXCLUDED.prompt,
    tools_instructions = EXCLUDED.tools_instructions,
    tasks = EXCLUDED.tasks,
    business_description = EXCLUDED.business_description,
    agent_goal = EXCLUDED.agent_goal,
    output_format = EXCLUDED.output_format,
    rhf_feedbacks = EXCLUDED.rhf_feedbacks,
    fewshots_examples = EXCLUDED.fewshots_examples,
    tone_of_voice = EXCLUDED.tone_of_voice,
    updated_at = now()
  returning * into rec;
  return rec;
end;
$$;

do $$ begin
  grant execute on function public.agent_prompts_upsert(
    uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, text
  ) to anon, authenticated;
exception when others then null; end $$;

COMMIT;$mig_v55$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v56
insert into public.master_migrations(version, name, sql)
values (
  56,
  'v56 - Migration 56',
  $mig_v56$BEGIN;

-- v56 – RPC rm_get_conversation_messages: obter mensagens por conversation_id (mesma sessão)
create or replace function public.rm_get_conversation_messages(
  p_organization_id uuid,
  p_conversation_id text,
  p_limit int default 200,
  p_offset int default 0
)
returns table (
  id uuid,
  conversation_id text,
  content_text text,
  sender_type public.sender_type,
  whatsapp_cliente text,
  whatsapp_empresa text,
  created_at timestamptz
)
language plpgsql
stable
as $$
begin
  -- Garantir contexto de organização na MESMA sessão
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);

  return query
  select m.id,
         m.conversation_id,
         m.content_text,
         m.sender_type,
         m.whatsapp_cliente,
         m.whatsapp_empresa,
         m.created_at
  from public.repositorio_de_mensagens m
  where m.organization_id = p_organization_id
    and m.conversation_id = p_conversation_id
  order by m.created_at asc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

do $$ begin
  grant execute on function public.rm_get_conversation_messages(uuid, text, int, int) to anon, authenticated;
exception when others then null; end $$;

COMMIT;$mig_v56$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v57
insert into public.master_migrations(version, name, sql)
values (
  57,
  'v57 - Migration 57',
  $mig_v57$/*
  Case-insensitive fix for crm_leads.stage before FK check
  - Requires unique index on (organization_id, lower(name)) in crm_stages
  - BEFORE INSERT/UPDATE: if stage provided, replace by exact crm_stages.name
  - Does not invent values; if no match, keeps provided value (FK will enforce)
*/

begin;

-- 1) Unique functional index to prevent duplicates by case (idempotent)
create unique index if not exists crm_stages_org_lower_name_key
on public.crm_stages (organization_id, lower(name));

-- 2) Function
create or replace function public.trg_crm_leads_fix_stage_case()
returns trigger
language plpgsql
as $$
declare
  v_name text;
begin
  if new.stage is null or trim(new.stage) = '' then
    return new;
  end if;

  select s.name into v_name
  from public.crm_stages s
  where s.organization_id = new.organization_id
    and lower(s.name) = lower(new.stage)
  limit 1;

  if v_name is not null then
    new.stage := v_name;
  end if;

  return new;
end;
$$;

-- 3) Trigger
drop trigger if exists trg_crm_leads_fix_stage_case on public.crm_leads;
create trigger trg_crm_leads_fix_stage_case
before insert or update of stage on public.crm_leads
for each row
execute function public.trg_crm_leads_fix_stage_case();

commit;$mig_v57$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v58
insert into public.master_migrations(version, name, sql)
values (
  58,
  'v58 - Migration 58',
  $mig_v58$BEGIN;

-- v58 – RPC crm_leads_upsert: inserção/atualização com contexto de organização + normalização de stage

-- 1) Helper (idempotente): garante a existência da função de contexto
create or replace function public.set_rls_context(p_organization_id uuid)
returns void
language sql
as $$
  select set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
$$;

-- 2) Remover versões anteriores (qualquer assinatura) para evitar sobrecarga
do $$
declare r record;
begin
  for r in (
    select p.oid, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'crm_leads_upsert'
  ) loop
    execute format('drop function if exists public.crm_leads_upsert(%s);', r.args);
  end loop;
end $$;

-- 3) RPC principal (atenção à ordem: argumentos obrigatórios primeiro)

create or replace function public.crm_leads_upsert(
  p_organization_id uuid,
  p_name text,
  p_id uuid default null,
  p_whatsapp text default null,
  p_email text default null,
  p_instagram_username text default null,
  p_stage text default null,
  p_value numeric(10,2) default 0,
  p_priority text default 'medium',
  p_source text default null,
  p_canal text default null,
  p_has_payment boolean default false,
  p_payment_value numeric(10,2) default 0,
  p_sold_produto_servico_id uuid default null,
  p_sold_quantity integer default 1,
  p_interest_produto_servico_id uuid default null,
  p_interest_quantity integer default 1,
  p_custom_fields jsonb default '{}'::jsonb,
  p_created_at timestamptz default null,
  p_updated_at timestamptz default null
)
returns public.crm_leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage text;
  rec public.crm_leads;
begin
  -- 2.1) Contexto de organização na MESMA sessão
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);

  -- 2.2) Normalização de stage (case-insensitive) para o name exato da organização
  if p_stage is not null and trim(p_stage) <> '' then
    select s.name into v_stage
    from public.crm_stages s
    where s.organization_id = p_organization_id
      and lower(s.name) = lower(p_stage)
    limit 1;
  end if;

  -- Se não matchar, manter NULL para não violar a FK
  if v_stage is null and (p_stage is null or trim(p_stage) = '') then
    v_stage := null;
  end if;

  if p_id is null then
    -- INSERT
    insert into public.crm_leads (
      organization_id, name, whatsapp, email, instagram_username, stage,
      description, value, priority, source, canal,
      has_payment, payment_value, sold_produto_servico_id, sold_quantity,
      interest_produto_servico_id, interest_quantity, custom_fields,
      created_at, updated_at
    ) values (
      p_organization_id,
      trim(coalesce(p_name, '')),
      nullif(trim(coalesce(p_whatsapp, '')), ''),
      nullif(trim(coalesce(p_email, '')), ''),
      nullif(trim(coalesce(p_instagram_username, '')), ''),
      coalesce(v_stage, null),
      null,
      coalesce(p_value, 0),
      coalesce(nullif(trim(p_priority), ''), 'medium'),
      nullif(trim(coalesce(p_source, '')), ''),
      nullif(trim(coalesce(p_canal, '')), ''),
      coalesce(p_has_payment, false),
      coalesce(p_payment_value, 0),
      p_sold_produto_servico_id,
      greatest(coalesce(p_sold_quantity, 1), 1),
      p_interest_produto_servico_id,
      greatest(coalesce(p_interest_quantity, 1), 1),
      coalesce(p_custom_fields, '{}'::jsonb),
      coalesce(p_created_at, now()),
      coalesce(p_updated_at, now())
    ) returning * into rec;
  else
    -- UPDATE
    update public.crm_leads set
      name = trim(coalesce(p_name, name)),
      whatsapp = coalesce(nullif(trim(coalesce(p_whatsapp, '')), ''), whatsapp),
      email = coalesce(nullif(trim(coalesce(p_email, '')), ''), email),
      instagram_username = coalesce(nullif(trim(coalesce(p_instagram_username, '')), ''), instagram_username),
      stage = coalesce(v_stage, stage),
      value = coalesce(p_value, value),
      priority = coalesce(nullif(trim(p_priority), ''), priority),
      source = coalesce(nullif(trim(coalesce(p_source, '')), ''), source),
      canal = coalesce(nullif(trim(coalesce(p_canal, '')), ''), canal),
      has_payment = coalesce(p_has_payment, has_payment),
      payment_value = coalesce(p_payment_value, payment_value),
      sold_produto_servico_id = coalesce(p_sold_produto_servico_id, sold_produto_servico_id),
      sold_quantity = greatest(coalesce(p_sold_quantity, sold_quantity, 1), 1),
      interest_produto_servico_id = coalesce(p_interest_produto_servico_id, interest_produto_servico_id),
      interest_quantity = greatest(coalesce(p_interest_quantity, interest_quantity, 1), 1),
      custom_fields = coalesce(p_custom_fields, custom_fields),
      updated_at = coalesce(p_updated_at, now())
    where id = p_id and organization_id = p_organization_id
    returning * into rec;
  end if;

  return rec;
end;
$$;

do $$ begin
  grant execute on function public.crm_leads_upsert(
    uuid, text, uuid, text, text, text, text, numeric, text, text, text, boolean, numeric, uuid, integer, uuid, integer, jsonb, timestamptz, timestamptz
  ) to anon, authenticated;
exception when others then null; end $$;

COMMIT;$mig_v58$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v59
insert into public.master_migrations(version, name, sql)
values (
  59,
  'v59 - Migration 59',
  $mig_v59$BEGIN;

-- v59 – Produtos/Serviços: coluna imagens_urls (idempotente)
-- Objetivo: corrigir instalações que não receberam a coluna durante updates anteriores.
-- Regras:
--  - Não quebrar quem já tem a coluna (ADD COLUMN IF NOT EXISTS)
--  - Comentar a coluna para documentação
--  - Registrar versão em app_migrations

LOCK TABLE public.produtos_servicos IN SHARE ROW EXCLUSIVE MODE;

-- 1) Adicionar coluna imagens_urls, se ausente
ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS imagens_urls text;

-- 2) Comentário explicativo (idempotente)
DO $$
BEGIN
  BEGIN
    COMMENT ON COLUMN public.produtos_servicos.imagens_urls IS 'Até 5 URLs de imagens do produto/serviço, separados por quebra de linha (\n).';
  EXCEPTION WHEN others THEN
    -- Ignorar caso a coluna não exista por algum motivo
    NULL;
  END;
END $$;

COMMIT;

-- 3) Registrar migração (idempotente)$mig_v59$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v60
insert into public.master_migrations(version, name, sql)
values (
  60,
  'v60 - Appointments.tipo como texto livre (permite NULL)',
  $mig_v60$-- V60 – Appointments.tipo como texto livre (permite NULL)
BEGIN;

-- 1) Remover constraint de valores permitidos (se existir)
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_tipo_check;

-- 2) Permitir NULL no campo tipo
ALTER TABLE public.appointments
  ALTER COLUMN tipo DROP NOT NULL;

-- 3) Documentação
COMMENT ON COLUMN public.appointments.tipo IS 'Tipo livre do agendamento (texto). Pode ser NULL. Qualquer valor é aceito.';

COMMIT;

-- 4) Registrar versão$mig_v60$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v61
insert into public.master_migrations(version, name, sql)
values (
  61,
  'v61 - Clients: `nascimento` opcional (DROP NOT NULL)',
  $mig_v61$-- V61 – Clients: `nascimento` opcional (DROP NOT NULL)
BEGIN;

-- 1) Tornar a coluna opcional (idempotente)
ALTER TABLE public.clients
  ALTER COLUMN nascimento DROP NOT NULL;

-- 2) Comentário explicativo (opcional)
DO $$
BEGIN
  BEGIN
    COMMENT ON COLUMN public.clients.nascimento IS 'Data de nascimento do cliente. Campo opcional.';
  EXCEPTION WHEN others THEN
    NULL;
  END;
END $$;

COMMIT;

-- 3) Registrar migração (idempotente)$mig_v61$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v62
insert into public.master_migrations(version, name, sql)
values (
  62,
  'v62 - View inserível appointments_api (tolerante a "" em UUID) + regras de INSERT/UPDATE',
  $mig_v62$-- V62 – View inserível appointments_api (tolerante a "" em UUID) + regras de INSERT/UPDATE
begin;

-- 0) Helper para converter texto→uuid, tratando '' como NULL e dando erro claro em lixo
create or replace function public.safe_uuid(p_text text)
returns uuid
language plpgsql
as $$
declare
  v uuid;
begin
  if p_text is null or btrim(p_text) = '' then
    return null;
  end if;
  begin
    v := p_text::uuid;
    return v;
  exception when others then
    raise exception 'invalid input syntax for type uuid: "%"', p_text using errcode = '22P02';
  end;
end;
$$;

comment on function public.safe_uuid(text) is 'Converte texto→uuid; "" vira NULL; valores inválidos disparam 22P02.';

-- 1) View com colunas de IDs como text (para aceitar "" via PostgREST) e retornar dados legíveis
create or replace view public.appointments_api as
select
  a.id,
  a.organization_id::text    as organization_id,
  a.datetime,
  a.duration_minutes,
  a.tipo,
  a.status,
  a.criado_por::text         as criado_por,
  a.anotacoes,
  a.arquivos,
  a.valor_consulta,
  a.created_at,
  a.client_id::text          as client_id,
  a.lead_id::text            as lead_id,
  a.collaborator_id::text    as collaborator_id,
  a.title,
  a.updated_at
from public.appointments a;

comment on view public.appointments_api is 'Fachada tolerante para criar/atualizar appointments via PostgREST (Create Row). Converte ""→NULL e faz cast text→uuid nas regras.';

-- 2) Regras INSTEAD OF para INSERT/UPDATE (drop antes por idempotência)
drop rule if exists appointments_api_insert on public.appointments_api;
drop rule if exists appointments_api_update on public.appointments_api;

create rule appointments_api_insert as
on insert to public.appointments_api
do instead
insert into public.appointments (
  organization_id, datetime, duration_minutes, tipo, status, criado_por,
  anotacoes, arquivos, valor_consulta, client_id, lead_id, collaborator_id, title, created_at
) values (
  public.safe_uuid(new.organization_id),
  new.datetime,
  coalesce(new.duration_minutes, 30),
  new.tipo,
  coalesce(nullif(new.status, ''), 'agendado'),
  public.safe_uuid(new.criado_por),
  nullif(new.anotacoes, ''),
  new.arquivos,
  new.valor_consulta,
  public.safe_uuid(new.client_id),
  public.safe_uuid(new.lead_id),
  public.safe_uuid(new.collaborator_id),
  nullif(new.title, ''),
  coalesce(new.created_at, now())
)
returning
  id,
  organization_id::text      as organization_id,
  datetime,
  duration_minutes,
  tipo,
  status,
  criado_por::text           as criado_por,
  anotacoes,
  arquivos,
  valor_consulta,
  created_at,
  client_id::text            as client_id,
  lead_id::text              as lead_id,
  collaborator_id::text      as collaborator_id,
  title,
  updated_at;

create rule appointments_api_update as
on update to public.appointments_api
do instead
update public.appointments set
  -- organization_id não é alterado por padrão
  datetime          = coalesce(new.datetime, public.appointments.datetime),
  duration_minutes  = coalesce(new.duration_minutes, public.appointments.duration_minutes),
  tipo              = coalesce(new.tipo, public.appointments.tipo),
  status            = coalesce(nullif(new.status,''), public.appointments.status),
  criado_por        = coalesce(public.safe_uuid(new.criado_por), public.appointments.criado_por),
  anotacoes         = coalesce(nullif(new.anotacoes,''), public.appointments.anotacoes),
  arquivos          = coalesce(new.arquivos, public.appointments.arquivos),
  valor_consulta    = coalesce(new.valor_consulta, public.appointments.valor_consulta),
  client_id         = coalesce(public.safe_uuid(new.client_id), public.appointments.client_id),
  lead_id           = coalesce(public.safe_uuid(new.lead_id), public.appointments.lead_id),
  collaborator_id   = coalesce(public.safe_uuid(new.collaborator_id), public.appointments.collaborator_id),
  title             = coalesce(nullif(new.title,''), public.appointments.title),
  updated_at        = now()
where id = new.id
returning
  id,
  organization_id::text      as organization_id,
  datetime,
  duration_minutes,
  tipo,
  status,
  criado_por::text           as criado_por,
  anotacoes,
  arquivos,
  valor_consulta,
  created_at,
  client_id::text            as client_id,
  lead_id::text              as lead_id,
  collaborator_id::text      as collaborator_id,
  title,
  updated_at;

-- 3) Grants de acesso (RLS continua aplicada na tabela base)
grant select, insert, update on public.appointments_api to anon, authenticated;

commit;

-- 4) Registrar versão$mig_v62$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v63
insert into public.master_migrations(version, name, sql)
values (
  63,
  'v63 - Importação escalável de Leads (staging + commit + dedupe)',
  $mig_v63$-- v63 – Importação escalável de Leads (staging + commit + dedupe)

begin;

-- Funções de normalização
create or replace function public.normalize_email(p text) returns text
language sql immutable as $$ select case when p is null then null else lower(trim(p)) end $$;

create or replace function public.normalize_phone_e164_br(p text) returns text
language plpgsql immutable as $$
declare d text; begin
  if p is null then return null; end if;
  d := regexp_replace(p, '\\D', '', 'g');
  if length(d)=11 and left(d,2) <> '55' then d := '55'||d; end if;
  if length(d)>=10 then return '+'||d; end if;
  return null;
end $$;

-- Colunas geradas em crm_leads
alter table if exists public.crm_leads
  add column if not exists phone_normalized text generated always as (public.normalize_phone_e164_br(whatsapp)) stored,
  add column if not exists email_normalized text generated always as (public.normalize_email(email)) stored;

-- Deduplicação defensiva (prioridade telefone)
with d as (
  select id, row_number() over (partition by organization_id, phone_normalized order by updated_at desc, created_at desc, id desc) as rn
  from public.crm_leads where phone_normalized is not null
)
delete from public.crm_leads l using d where l.id=d.id and d.rn>1;

with d as (
  select id, row_number() over (partition by organization_id, email_normalized order by updated_at desc, created_at desc, id desc) as rn
  from public.crm_leads where email_normalized is not null
)
delete from public.crm_leads l using d where l.id=d.id and d.rn>1;

-- Índices
create unique index if not exists uniq_crm_leads_org_phone on public.crm_leads(organization_id, phone_normalized) where phone_normalized is not null;
create unique index if not exists uniq_crm_leads_org_email on public.crm_leads(organization_id, email_normalized) where email_normalized is not null;
create index if not exists crm_leads_org_created_at_idx on public.crm_leads(organization_id, created_at desc);

-- Staging UNLOGGED e jobs
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
create index if not exists crm_leads_import_staging_idx on public.crm_leads_import_staging(import_id, organization_id);

create table if not exists public.crm_leads_import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.saas_organizations(id) on delete cascade,
  filename text,
  total_rows int default 0,
  staged_rows int default 0,
  processed_rows int default 0,
  duplicate_rows int default 0,
  invalid_rows int default 0,
  status text not null default 'staging',
  error text,
  created_at timestamptz default now(),
  started_at timestamptz,
  finished_at timestamptz
);

-- RPCs
create or replace function public.leads_import_start(p_organization_id uuid, p_filename text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid := gen_random_uuid(); begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  insert into public.crm_leads_import_jobs(id, organization_id, filename) values (v_id, p_organization_id, p_filename);
  return v_id; end $$;
grant execute on function public.leads_import_start(uuid, text) to anon, authenticated;

create or replace function public.leads_import_stage_rows(p_organization_id uuid, p_import_id uuid, p_rows jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare v_count int; begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  insert into public.crm_leads_import_staging(import_id, organization_id, row_num, name, whatsapp, email, phone_normalized, email_normalized, stage, value, source, canal, description)
  select p_import_id, p_organization_id,
         coalesce((row->>'row_num')::int, null),
         nullif(trim(row->>'name'),''),
         nullif(trim(row->>'whatsapp'),''),
         nullif(trim(row->>'email'),''),
         public.normalize_phone_e164_br(row->>'whatsapp'),
         public.normalize_email(row->>'email'),
         coalesce(nullif(trim(row->>'stage'), ''), 'novo'),
         nullif(row->>'value','')::numeric,
         nullif(trim(row->>'source'),''),
         nullif(trim(row->>'canal'),''),
         nullif(trim(row->>'description'), '')
  from jsonb_array_elements(p_rows) row;
  get diagnostics v_count = row_count;
  update public.crm_leads_import_jobs set staged_rows = staged_rows + v_count, total_rows = greatest(total_rows, staged_rows + v_count)
  where id = p_import_id and organization_id = p_organization_id;
  return v_count; end $$;
grant execute on function public.leads_import_stage_rows(uuid, uuid, jsonb) to anon, authenticated;

create or replace function public.leads_import_commit(p_organization_id uuid, p_import_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_lock_ok boolean; begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  v_lock_ok := pg_try_advisory_lock(hashtext('leads_import')::bigint, hashtext(p_import_id::text)::bigint);
  if not v_lock_ok then raise exception 'Import já em processamento'; end if;
  update public.crm_leads_import_jobs set status='processing', started_at=now() where id=p_import_id and organization_id=p_organization_id;

  insert into public.crm_leads(id, organization_id, name, whatsapp, email, stage, value, source, canal, description)
  select gen_random_uuid(), s.organization_id, coalesce(nullif(s.name,''), 'Sem nome'), s.whatsapp, s.email, coalesce(nullif(s.stage,''), 'novo'), coalesce(s.value, 0), s.source, s.canal, s.description
  from public.crm_leads_import_staging s
  where s.import_id = p_import_id and s.organization_id = p_organization_id and s.phone_normalized is not null
  on conflict on constraint uniq_crm_leads_org_phone do update set
    name = excluded.name, whatsapp = excluded.whatsapp, email = excluded.email, stage = excluded.stage,
    value = excluded.value, source = excluded.source, canal = excluded.canal, description = excluded.description, updated_at = now();

  insert into public.crm_leads(id, organization_id, name, whatsapp, email, stage, value, source, canal, description)
  select gen_random_uuid(), s.organization_id, coalesce(nullif(s.name,''), 'Sem nome'), s.whatsapp, s.email, coalesce(nullif(s.stage,''), 'novo'), coalesce(s.value, 0), s.source, s.canal, s.description
  from public.crm_leads_import_staging s
  where s.import_id = p_import_id and s.organization_id = p_organization_id and s.phone_normalized is null and s.email_normalized is not null
  on conflict on constraint uniq_crm_leads_org_email do update set
    name = excluded.name, whatsapp = excluded.whatsapp, email = excluded.email, stage = excluded.stage,
    value = excluded.value, source = excluded.source, canal = excluded.canal, description = excluded.description, updated_at = now();

  update public.crm_leads_import_jobs set processed_rows = (select count(*) from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id), status='done', finished_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  delete from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id;
  perform pg_advisory_unlock(hashtext('leads_import')::bigint, hashtext(p_import_id::text)::bigint);
  return jsonb_build_object('status','done');
exception when others then
  perform pg_advisory_unlock(hashtext('leads_import')::bigint, hashtext(p_import_id::text)::bigint);
  update public.crm_leads_import_jobs set status='failed', error=SQLERRM, finished_at=now() where id=p_import_id and organization_id=p_organization_id;
  raise; end $$;
grant execute on function public.leads_import_commit(uuid, uuid) to anon, authenticated;

create or replace function public.leads_import_status(p_organization_id uuid, p_import_id uuid)
returns public.crm_leads_import_jobs language sql security definer set search_path=public as $$
  select * from public.crm_leads_import_jobs where id=p_import_id and organization_id=p_organization_id; $$;
grant execute on function public.leads_import_status(uuid, uuid) to anon, authenticated;

commit;
$mig_v63$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v64
insert into public.master_migrations(version, name, sql)
values (
  64,
  'v64 - Hotfix: normalização de email e remoção de dedupe destrutivo',
  $mig_v64$-- v64 – Hotfix: normalização de email e remoção de dedupe destrutivo

begin;

-- 1) Corrigir função de normalização de email (vazio -> null)
create or replace function public.normalize_email(p text) returns text
language sql immutable as $$
  select case
           when p is null or trim(p) = '' then null
           else lower(trim(p))
         end
$$;

-- 2) Forçar recomputar colunas geradas (email_normalized)
-- (em colunas GENERATED STORED, um update que reescreve o mesmo valor reavalia a expressão)
update public.crm_leads set email = email;

-- 3) Remover quaisquer blocos de deduplicação destrutivos futuros (documentação)
-- Nenhuma ação DDL aqui; a recomendação é não reexecutar deletes por rn>1.

commit;
$mig_v64$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v65
insert into public.master_migrations(version, name, sql)
values (
  65,
  'v65 - Migration 65',
  $mig_v65$BEGIN;

-- v65 – Normalização defensiva para UUID/inteiros em crm_leads_upsert (aceitar "" do n8n)

-- 1) Helpers idempotentes para converter strings vazias em NULL
create or replace function public.uuid_or_null(p_text text)
returns uuid
language plpgsql immutable as $$
declare v text; begin
  if p_text is null then return null; end if;
  v := nullif(trim(p_text), '');
  if v is null then return null; end if;
  begin
    return v::uuid;
  exception when others then
    return null; -- se não for uuid válido, retorna NULL
  end;
end $$;

create or replace function public.int_or_null(p_text text)
returns int
language plpgsql immutable as $$
declare v text; begin
  if p_text is null then return null; end if;
  v := nullif(trim(p_text), '');
  if v is null then return null; end if;
  begin
    return v::int;
  exception when others then
    return null; -- se não for inteiro válido, retorna NULL
  end;
end $$;

-- 2) Remover versões anteriores da RPC para re-criar com parâmetros text nos campos problemáticos
do $$
declare r record;
begin
  for r in (
    select p.oid, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'crm_leads_upsert'
  ) loop
    execute format('drop function if exists public.crm_leads_upsert(%s);', r.args);
  end loop;
end $$;

-- 3) Recriar crm_leads_upsert aceitando strings vazias para sold_/interest_ via TEXT
create or replace function public.crm_leads_upsert(
  p_organization_id uuid,
  p_name text,
  p_id uuid default null,
  p_whatsapp text default null,
  p_email text default null,
  p_instagram_username text default null,
  p_stage text default null,
  p_value numeric(10,2) default 0,
  p_priority text default 'medium',
  p_source text default null,
  p_canal text default null,
  p_has_payment boolean default false,
  p_payment_value numeric(10,2) default 0,
  p_sold_produto_servico_id text default null, -- ALTERADO p/ text
  p_sold_quantity text default null,           -- ALTERADO p/ text
  p_interest_produto_servico_id text default null, -- ALTERADO p/ text
  p_interest_quantity text default null,           -- ALTERADO p/ text
  p_custom_fields jsonb default '{}'::jsonb,
  p_created_at timestamptz default null,
  p_updated_at timestamptz default null
)
returns public.crm_leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage text;
  rec public.crm_leads;
  v_sold_ps uuid := public.uuid_or_null(p_sold_produto_servico_id);
  v_sold_qty int := coalesce(greatest(public.int_or_null(p_sold_quantity), 1), null);
  v_interest_ps uuid := public.uuid_or_null(p_interest_produto_servico_id);
  v_interest_qty int := coalesce(greatest(public.int_or_null(p_interest_quantity), 1), null);
begin
  -- Contexto de organização (mesma sessão)
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);

  -- Normalização de stage para o name exato da organização (case-insensitive)
  if p_stage is not null and trim(p_stage) <> '' then
    select s.name into v_stage
    from public.crm_stages s
    where s.organization_id = p_organization_id
      and lower(s.name) = lower(p_stage)
    limit 1;
  end if;

  if v_stage is null and (p_stage is null or trim(p_stage) = '') then
    v_stage := null;
  end if;

  if p_id is null then
    insert into public.crm_leads (
      organization_id, name, whatsapp, email, instagram_username, stage,
      description, value, priority, source, canal,
      has_payment, payment_value, sold_produto_servico_id, sold_quantity,
      interest_produto_servico_id, interest_quantity, custom_fields,
      created_at, updated_at
    ) values (
      p_organization_id,
      trim(coalesce(p_name, '')),
      nullif(trim(coalesce(p_whatsapp, '')), ''),
      nullif(trim(coalesce(p_email, '')), ''),
      nullif(trim(coalesce(p_instagram_username, '')), ''),
      coalesce(v_stage, null),
      null,
      coalesce(p_value, 0),
      coalesce(nullif(trim(p_priority), ''), 'medium'),
      nullif(trim(coalesce(p_source, '')), ''),
      nullif(trim(coalesce(p_canal, '')), ''),
      coalesce(p_has_payment, false),
      coalesce(p_payment_value, 0),
      v_sold_ps,
      case when v_sold_ps is null then null else coalesce(v_sold_qty, 1) end,
      v_interest_ps,
      case when v_interest_ps is null then null else coalesce(v_interest_qty, 1) end,
      coalesce(p_custom_fields, '{}'::jsonb),
      coalesce(p_created_at, now()),
      coalesce(p_updated_at, now())
    ) returning * into rec;
  else
    update public.crm_leads set
      name = trim(coalesce(p_name, name)),
      whatsapp = coalesce(nullif(trim(coalesce(p_whatsapp, '')), ''), whatsapp),
      email = coalesce(nullif(trim(coalesce(p_email, '')), ''), email),
      instagram_username = coalesce(nullif(trim(coalesce(p_instagram_username, '')), ''), instagram_username),
      stage = coalesce(v_stage, stage),
      value = coalesce(p_value, value),
      priority = coalesce(nullif(trim(p_priority), ''), priority),
      source = coalesce(nullif(trim(coalesce(p_source, '')), ''), source),
      canal = coalesce(nullif(trim(coalesce(p_canal, '')), ''), canal),
      has_payment = coalesce(p_has_payment, has_payment),
      payment_value = coalesce(p_payment_value, payment_value),
      sold_produto_servico_id = coalesce(v_sold_ps, sold_produto_servico_id),
      sold_quantity = case
        when coalesce(v_sold_ps, sold_produto_servico_id) is null then null
        else greatest(coalesce(v_sold_qty, sold_quantity, 1), 1)
      end,
      interest_produto_servico_id = coalesce(v_interest_ps, interest_produto_servico_id),
      interest_quantity = case
        when coalesce(v_interest_ps, interest_produto_servico_id) is null then null
        else greatest(coalesce(v_interest_qty, interest_quantity, 1), 1)
      end,
      custom_fields = coalesce(p_custom_fields, custom_fields),
      updated_at = coalesce(p_updated_at, now())
    where id = p_id and organization_id = p_organization_id
    returning * into rec;
  end if;

  return rec;
end;
$$;

-- 4) Grants
do $$ begin
  grant execute on function public.crm_leads_upsert(
    uuid, text, uuid, text, text, text, text, numeric, text, text, text, boolean, numeric, text, text, text, text, jsonb, timestamptz, timestamptz
  ) to anon, authenticated;
exception when others then null; end $$;

COMMIT;$mig_v65$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v66
insert into public.master_migrations(version, name, sql)
values (
  66,
  'v66 - Fix definitivo: advisory lock compatível e ajuste na RPC de commit',
  $mig_v66$-- v66 – Fix definitivo: advisory lock compatível e ajuste na RPC de commit

begin;

-- 1) Chave estável para advisory locks (usa md5 -> 64 bits)
create or replace function public.advisory_key(p text)
returns bigint
language sql immutable as $$
  select (('x' || substr(md5(coalesce(p,'')), 1, 16))::bit(64))::bigint
$$;

-- 2) Wrappers compatíveis (sempre 1 argumento bigint)
create or replace function public.try_advisory_lock(p text)
returns boolean
language sql volatile as $$
  select pg_try_advisory_lock(public.advisory_key(p))
$$;

create or replace function public.advisory_unlock(p text)
returns boolean
language sql volatile as $$
  select pg_advisory_unlock(public.advisory_key(p))
$$;

-- 3) Atualizar a RPC de commit para usar os wrappers
create or replace function public.leads_import_commit(p_organization_id uuid, p_import_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare v_lock_key text := 'leads_import:' || p_import_id::text; v_lock_ok boolean;
begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  v_lock_ok := public.try_advisory_lock(v_lock_key);
  if not v_lock_ok then
    raise exception 'Import já em processamento';
  end if;

  update public.crm_leads_import_jobs
    set status='processing', started_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  -- Passo 1: upsert por telefone normalizado
  insert into public.crm_leads(
    id, organization_id, name, whatsapp, email, stage, value, source, canal, description
  )
  select gen_random_uuid(), s.organization_id,
         coalesce(nullif(s.name,''), 'Sem nome'),
         s.whatsapp, s.email, coalesce(nullif(s.stage,''), 'novo'), coalesce(s.value, 0), s.source, s.canal, s.description
  from public.crm_leads_import_staging s
  where s.import_id = p_import_id
    and s.organization_id = p_organization_id
    and s.phone_normalized is not null
  on conflict on constraint uniq_crm_leads_org_phone do update set
    name = excluded.name,
    whatsapp = excluded.whatsapp,
    email = excluded.email,
    stage = excluded.stage,
    value = excluded.value,
    source = excluded.source,
    canal = excluded.canal,
    description = excluded.description,
    updated_at = now();

  -- Passo 2: upsert por email normalizado (quando não há telefone)
  insert into public.crm_leads(
    id, organization_id, name, whatsapp, email, stage, value, source, canal, description
  )
  select gen_random_uuid(), s.organization_id,
         coalesce(nullif(s.name,''), 'Sem nome'),
         s.whatsapp, s.email, coalesce(nullif(s.stage,''), 'novo'), coalesce(s.value, 0), s.source, s.canal, s.description
  from public.crm_leads_import_staging s
  where s.import_id = p_import_id
    and s.organization_id = p_organization_id
    and s.phone_normalized is null
    and s.email_normalized is not null
  on conflict on constraint uniq_crm_leads_org_email do update set
    name = excluded.name,
    whatsapp = excluded.whatsapp,
    email = excluded.email,
    stage = excluded.stage,
    value = excluded.value,
    source = excluded.source,
    canal = excluded.canal,
    description = excluded.description,
    updated_at = now();

  update public.crm_leads_import_jobs
    set processed_rows = (select count(*) from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id),
        status='done',
        finished_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  delete from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id;

  perform public.advisory_unlock(v_lock_key);
  return jsonb_build_object('status','done');
exception when others then
  perform public.advisory_unlock(v_lock_key);
  update public.crm_leads_import_jobs
    set status='failed', error=SQLERRM, finished_at=now()
  where id=p_import_id and organization_id=p_organization_id;
  raise;
end;
$$;

grant execute on function public.try_advisory_lock(text) to anon, authenticated;
grant execute on function public.advisory_unlock(text) to anon, authenticated;
grant execute on function public.leads_import_commit(uuid, uuid) to anon, authenticated;

commit;$mig_v66$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v67
insert into public.master_migrations(version, name, sql)
values (
  67,
  'v67 - Fix definitivo de upsert: usar inferência por colunas (sem constraint name)',
  $mig_v67$-- v67 – Fix definitivo de upsert: usar inferência por colunas (sem constraint name)

begin;

-- 1) Garantir índices únicos parciais (necessários para ON CONFLICT por colunas)
create unique index if not exists uniq_crm_leads_org_phone
  on public.crm_leads(organization_id, phone_normalized)
  where phone_normalized is not null;

create unique index if not exists uniq_crm_leads_org_email
  on public.crm_leads(organization_id, email_normalized)
  where email_normalized is not null;

-- 2) Atualizar leads_import_commit para ON CONFLICT por colunas + predicado
create or replace function public.leads_import_commit(p_organization_id uuid, p_import_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare v_lock_key text := 'leads_import:' || p_import_id::text; v_lock_ok boolean;
begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  v_lock_ok := public.try_advisory_lock(v_lock_key);
  if not v_lock_ok then
    raise exception 'Import já em processamento';
  end if;

  update public.crm_leads_import_jobs
    set status='processing', started_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  -- Passo 1: upsert por telefone normalizado
  insert into public.crm_leads(
    id, organization_id, name, whatsapp, email, stage, value, source, canal, description
  )
  select gen_random_uuid(), s.organization_id,
         coalesce(nullif(s.name,''), 'Sem nome'),
         s.whatsapp, s.email, coalesce(nullif(s.stage,''), 'novo'), coalesce(s.value, 0), s.source, s.canal, s.description
  from public.crm_leads_import_staging s
  where s.import_id = p_import_id
    and s.organization_id = p_organization_id
    and s.phone_normalized is not null
  on conflict (organization_id, phone_normalized)
    where phone_normalized is not null
  do update set
    name = excluded.name,
    whatsapp = excluded.whatsapp,
    email = excluded.email,
    stage = excluded.stage,
    value = excluded.value,
    source = excluded.source,
    canal = excluded.canal,
    description = excluded.description,
    updated_at = now();

  -- Passo 2: upsert por email normalizado (quando não há telefone)
  insert into public.crm_leads(
    id, organization_id, name, whatsapp, email, stage, value, source, canal, description
  )
  select gen_random_uuid(), s.organization_id,
         coalesce(nullif(s.name,''), 'Sem nome'),
         s.whatsapp, s.email, coalesce(nullif(s.stage,''), 'novo'), coalesce(s.value, 0), s.source, s.canal, s.description
  from public.crm_leads_import_staging s
  where s.import_id = p_import_id
    and s.organization_id = p_organization_id
    and s.phone_normalized is null
    and s.email_normalized is not null
  on conflict (organization_id, email_normalized)
    where email_normalized is not null
  do update set
    name = excluded.name,
    whatsapp = excluded.whatsapp,
    email = excluded.email,
    stage = excluded.stage,
    value = excluded.value,
    source = excluded.source,
    canal = excluded.canal,
    description = excluded.description,
    updated_at = now();

  update public.crm_leads_import_jobs
    set processed_rows = (select count(*) from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id),
        status='done',
        finished_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  delete from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id;

  perform public.advisory_unlock(v_lock_key);
  return jsonb_build_object('status','done');
exception when others then
  perform public.advisory_unlock(v_lock_key);
  update public.crm_leads_import_jobs
    set status='failed', error=SQLERRM, finished_at=now()
  where id=p_import_id and organization_id=p_organization_id;
  raise;
end;
$$;

grant execute on function public.leads_import_commit(uuid, uuid) to anon, authenticated;

commit;$mig_v67$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v68
insert into public.master_migrations(version, name, sql)
values (
  68,
  'v68 - Commit idempotente: deduplicação por chave antes do UPSERT (fix 21000)',
  $mig_v68$-- v68 – Commit idempotente: deduplicação por chave antes do UPSERT (fix 21000)

begin;

-- Garantir índices únicos parciais (idempotente)
create unique index if not exists uniq_crm_leads_org_phone
  on public.crm_leads(organization_id, phone_normalized)
  where phone_normalized is not null;

create unique index if not exists uniq_crm_leads_org_email
  on public.crm_leads(organization_id, email_normalized)
  where email_normalized is not null;

-- Reescrever commit com pré-deduplicação por chave usando DISTINCT ON
create or replace function public.leads_import_commit(p_organization_id uuid, p_import_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare v_lock_key text := 'leads_import:' || p_import_id::text; v_lock_ok boolean;
begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  v_lock_ok := public.try_advisory_lock(v_lock_key);
  if not v_lock_ok then
    raise exception 'Import já em processamento';
  end if;

  update public.crm_leads_import_jobs
    set status='processing', started_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  -- 1) UPSERT por telefone (dedup no staging por (org, phone_normalized), escolhendo a última linha)
  with s_phone as (
    select distinct on (s.organization_id, s.phone_normalized)
           s.organization_id, s.name, s.whatsapp, s.email, s.stage, s.value, s.source, s.canal, s.description,
           s.phone_normalized, s.email_normalized
    from public.crm_leads_import_staging s
    where s.import_id = p_import_id
      and s.organization_id = p_organization_id
      and s.phone_normalized is not null
    order by s.organization_id, s.phone_normalized, coalesce(s.row_num, 0) desc, s.created_at desc
  )
  insert into public.crm_leads(
    id, organization_id, name, whatsapp, email, stage, value, source, canal, description
  )
  select gen_random_uuid(), sp.organization_id,
         coalesce(nullif(sp.name,''), 'Sem nome'),
         sp.whatsapp, sp.email, coalesce(nullif(sp.stage,''), 'novo'), coalesce(sp.value, 0), sp.source, sp.canal, sp.description
  from s_phone sp
  on conflict (organization_id, phone_normalized)
    where phone_normalized is not null
  do update set
    name = excluded.name,
    whatsapp = excluded.whatsapp,
    email = excluded.email,
    stage = excluded.stage,
    value = excluded.value,
    source = excluded.source,
    canal = excluded.canal,
    description = excluded.description,
    updated_at = now();

  -- 2) UPSERT por email (dedup no staging por (org, email_normalized); somente onde não há telefone)
  with s_email as (
    select distinct on (s.organization_id, s.email_normalized)
           s.organization_id, s.name, s.whatsapp, s.email, s.stage, s.value, s.source, s.canal, s.description,
           s.email_normalized
    from public.crm_leads_import_staging s
    where s.import_id = p_import_id
      and s.organization_id = p_organization_id
      and s.phone_normalized is null
      and s.email_normalized is not null
    order by s.organization_id, s.email_normalized, coalesce(s.row_num, 0) desc, s.created_at desc
  )
  insert into public.crm_leads(
    id, organization_id, name, whatsapp, email, stage, value, source, canal, description
  )
  select gen_random_uuid(), se.organization_id,
         coalesce(nullif(se.name,''), 'Sem nome'),
         se.whatsapp, se.email, coalesce(nullif(se.stage,''), 'novo'), coalesce(se.value, 0), se.source, se.canal, se.description
  from s_email se
  on conflict (organization_id, email_normalized)
    where email_normalized is not null
  do update set
    name = excluded.name,
    whatsapp = excluded.whatsapp,
    email = excluded.email,
    stage = excluded.stage,
    value = excluded.value,
    source = excluded.source,
    canal = excluded.canal,
    description = excluded.description,
    updated_at = now();

  update public.crm_leads_import_jobs
    set processed_rows = (select count(*) from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id),
        status='done',
        finished_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  delete from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id;

  perform public.advisory_unlock(v_lock_key);
  return jsonb_build_object('status','done');
exception when others then
  perform public.advisory_unlock(v_lock_key);
  update public.crm_leads_import_jobs
    set status='failed', error=SQLERRM, finished_at=now()
  where id=p_import_id and organization_id=p_organization_id;
  raise;
end;
$$;

grant execute on function public.leads_import_commit(uuid, uuid) to anon, authenticated;

commit;$mig_v68$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v69
insert into public.master_migrations(version, name, sql)
values (
  69,
  'v69 - Commit com MERGE (Postgres 15): idempotente e sem violações únicas',
  $mig_v69$-- v69 – Commit com MERGE (Postgres 15): idempotente e sem violações únicas

begin;

-- Garantir índices únicos (idempotente)
create unique index if not exists uniq_crm_leads_org_phone
  on public.crm_leads(organization_id, phone_normalized)
  where phone_normalized is not null;

create unique index if not exists uniq_crm_leads_org_email
  on public.crm_leads(organization_id, email_normalized)
  where email_normalized is not null;

create or replace function public.leads_import_commit(p_organization_id uuid, p_import_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare v_lock_key text := 'leads_import:' || p_import_id::text; v_lock_ok boolean;
begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  v_lock_ok := public.try_advisory_lock(v_lock_key);
  if not v_lock_ok then
    raise exception 'Import já em processamento';
  end if;

  update public.crm_leads_import_jobs
    set status='processing', started_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  -- 1) PHONE: fonte deduplicada
  with s_phone as (
    select distinct on (s.organization_id, s.phone_normalized)
           s.organization_id, coalesce(nullif(s.name,''), 'Sem nome') as name,
           s.whatsapp, s.email,
           coalesce(nullif(s.stage,''), 'novo') as stage,
           coalesce(s.value, 0) as value,
           s.source, s.canal, s.description,
           s.phone_normalized
    from public.crm_leads_import_staging s
    where s.import_id = p_import_id
      and s.organization_id = p_organization_id
      and s.phone_normalized is not null
    order by s.organization_id, s.phone_normalized, coalesce(s.row_num, 0) desc, s.created_at desc
  )
  merge into public.crm_leads t
  using s_phone s
  on (t.organization_id = s.organization_id and t.phone_normalized = s.phone_normalized)
  when matched then update set
    name = s.name,
    whatsapp = s.whatsapp,
    email = s.email,
    stage = s.stage,
    value = s.value,
    source = s.source,
    canal = s.canal,
    description = s.description,
    updated_at = now()
  when not matched then insert (
    id, organization_id, name, whatsapp, email, stage, value, source, canal, description
  ) values (
    gen_random_uuid(), s.organization_id, s.name, s.whatsapp, s.email, s.stage, s.value, s.source, s.canal, s.description
  );

  -- 2) EMAIL: fonte deduplicada (somente registros sem phone_normalized)
  with s_email as (
    select distinct on (s.organization_id, s.email_normalized)
           s.organization_id, coalesce(nullif(s.name,''), 'Sem nome') as name,
           s.whatsapp, s.email,
           coalesce(nullif(s.stage,''), 'novo') as stage,
           coalesce(s.value, 0) as value,
           s.source, s.canal, s.description,
           s.email_normalized
    from public.crm_leads_import_staging s
    where s.import_id = p_import_id
      and s.organization_id = p_organization_id
      and s.phone_normalized is null
      and s.email_normalized is not null
    order by s.organization_id, s.email_normalized, coalesce(s.row_num, 0) desc, s.created_at desc
  )
  merge into public.crm_leads t
  using s_email s
  on (t.organization_id = s.organization_id and t.email_normalized = s.email_normalized)
  when matched then update set
    name = s.name,
    whatsapp = s.whatsapp,
    email = s.email,
    stage = s.stage,
    value = s.value,
    source = s.source,
    canal = s.canal,
    description = s.description,
    updated_at = now()
  when not matched then insert (
    id, organization_id, name, whatsapp, email, stage, value, source, canal, description
  ) values (
    gen_random_uuid(), s.organization_id, s.name, s.whatsapp, s.email, s.stage, s.value, s.source, s.canal, s.description
  );

  update public.crm_leads_import_jobs
    set processed_rows = (select count(*) from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id),
        status='done', finished_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  delete from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id;

  perform public.advisory_unlock(v_lock_key);
  return jsonb_build_object('status','done');
exception when others then
  perform public.advisory_unlock(v_lock_key);
  update public.crm_leads_import_jobs set status='failed', error=SQLERRM, finished_at=now() where id=p_import_id and organization_id=p_organization_id;
  raise;
end;
$$;

grant execute on function public.leads_import_commit(uuid, uuid) to anon, authenticated;

commit;$mig_v69$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v70
insert into public.master_migrations(version, name, sql)
values (
  70,
  'v70 - Permitir emails duplicados (não bloquear import) + preferências',
  $mig_v70$-- v70 – Permitir emails duplicados (não bloquear import) + preferências

begin;

-- 1) Remover unicidade de email_normalized e manter índice normal
drop index if exists uniq_crm_leads_org_email;
create index if not exists idx_crm_leads_org_email
  on public.crm_leads(organization_id, email_normalized)
  where email_normalized is not null;

-- 2) Preferências de import por organização (futuro)
create table if not exists public.crm_import_prefs (
  organization_id uuid primary key references public.saas_organizations(id) on delete cascade,
  email_strategy text not null default 'allow_duplicates' check (email_strategy in ('allow_duplicates','update_if_exists')),
  updated_at timestamptz default now()
);

-- 3) Atualizar leads_import_commit para não bloquear em email duplicado
create or replace function public.leads_import_commit(p_organization_id uuid, p_import_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_lock_key text := 'leads_import:' || p_import_id::text;
  v_lock_ok boolean;
  v_email_strategy text := 'allow_duplicates';
begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  v_lock_ok := public.try_advisory_lock(v_lock_key);
  if not v_lock_ok then
    raise exception 'Import já em processamento';
  end if;

  select coalesce((select email_strategy from public.crm_import_prefs where organization_id=p_organization_id), 'allow_duplicates')
    into v_email_strategy;

  update public.crm_leads_import_jobs
    set status='processing', started_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  -- Passo 1: MERGE por telefone (continua único)
  with s_phone as (
    select distinct on (s.organization_id, s.phone_normalized)
           s.organization_id, coalesce(nullif(s.name,''), 'Sem nome') as name,
           s.whatsapp, s.email,
           coalesce(nullif(s.stage,''), 'novo') as stage,
           coalesce(s.value, 0) as value,
           s.source, s.canal, s.description,
           s.phone_normalized
    from public.crm_leads_import_staging s
    where s.import_id = p_import_id
      and s.organization_id = p_organization_id
      and s.phone_normalized is not null
    order by s.organization_id, s.phone_normalized, coalesce(s.row_num, 0) desc, s.created_at desc
  )
  merge into public.crm_leads t
  using s_phone s
  on (t.organization_id = s.organization_id and t.phone_normalized = s.phone_normalized)
  when matched then update set
    name = s.name,
    whatsapp = s.whatsapp,
    email = s.email,
    stage = s.stage,
    value = s.value,
    source = s.source,
    canal = s.canal,
    description = s.description,
    updated_at = now()
  when not matched then insert (
    id, organization_id, name, whatsapp, email, stage, value, source, canal, description
  ) values (
    gen_random_uuid(), s.organization_id, s.name, s.whatsapp, s.email, s.stage, s.value, s.source, s.canal, s.description
  );

  -- Passo 2: EMAIL – estratégia padrão: permitir duplicados (dedup só dentro do próprio arquivo)
  if v_email_strategy = 'allow_duplicates' then
    with s_email as (
      select distinct on (s.organization_id, s.email_normalized)
             s.organization_id, coalesce(nullif(s.name,''), 'Sem nome') as name,
             s.whatsapp, s.email,
             coalesce(nullif(s.stage,''), 'novo') as stage,
             coalesce(s.value, 0) as value,
             s.source, s.canal, s.description
      from public.crm_leads_import_staging s
      where s.import_id = p_import_id
        and s.organization_id = p_organization_id
        and s.phone_normalized is null
        and s.email_normalized is not null
      order by s.organization_id, s.email_normalized, coalesce(s.row_num, 0) desc, s.created_at desc
    )
    insert into public.crm_leads(
      id, organization_id, name, whatsapp, email, stage, value, source, canal, description
    )
    select gen_random_uuid(), se.organization_id, se.name, se.whatsapp, se.email, se.stage, se.value, se.source, se.canal, se.description
    from s_email se;
  else
    -- update_if_exists (opcional futuro): manter comportamento do v69
    with s_email as (
      select distinct on (s.organization_id, s.email_normalized)
             s.organization_id, coalesce(nullif(s.name,''), 'Sem nome') as name,
             s.whatsapp, s.email,
             coalesce(nullif(s.stage,''), 'novo') as stage,
             coalesce(s.value, 0) as value,
             s.source, s.canal, s.description,
             s.email_normalized
      from public.crm_leads_import_staging s
      where s.import_id = p_import_id
        and s.organization_id = p_organization_id
        and s.phone_normalized is null
        and s.email_normalized is not null
      order by s.organization_id, s.email_normalized, coalesce(s.row_num, 0) desc, s.created_at desc
    ), chosen as (
      select s.*, (
        select id from public.crm_leads t
        where t.organization_id = s.organization_id and t.email_normalized = s.email_normalized
        order by t.created_at asc, t.id asc limit 1
      ) as target_id
      from s_email s
    ), upd as (
      update public.crm_leads t
      set name = c.name, whatsapp = c.whatsapp, email = c.email, stage = c.stage, value = c.value,
          source = c.source, canal = c.canal, description = c.description, updated_at = now()
      from chosen c
      where c.target_id is not null and t.id = c.target_id
      returning c.email_normalized
    )
    insert into public.crm_leads(id, organization_id, name, whatsapp, email, stage, value, source, canal, description)
    select gen_random_uuid(), c.organization_id, c.name, c.whatsapp, c.email, c.stage, c.value, c.source, c.canal, c.description
    from chosen c
    where c.target_id is null;
  end if;

  update public.crm_leads_import_jobs
    set processed_rows = (select count(*) from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id),
        status='done', finished_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  delete from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id;

  perform public.advisory_unlock(v_lock_key);
  return jsonb_build_object('status','done');
exception when others then
  perform public.advisory_unlock(v_lock_key);
  update public.crm_leads_import_jobs set status='failed', error=SQLERRM, finished_at=now() where id=p_import_id and organization_id=p_organization_id;
  raise;
end;
$$;

grant execute on function public.leads_import_commit(uuid, uuid) to anon, authenticated;

commit;$mig_v70$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v71
insert into public.master_migrations(version, name, sql)
values (
  71,
  'v71 - Correção: criar consulta ao marcar agendamento como realizado (schema atual)',
  $mig_v71$-- v71 – Correção: criar consulta ao marcar agendamento como realizado (schema atual)

begin;

-- 1) Função corrigida: usa client_id/collaborator_id e campos atuais
create or replace function public.auto_create_consultation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Quando status muda para 'realizado', cria uma consulta vinculada
  if NEW.status = 'realizado' and coalesce(OLD.status, '') <> 'realizado' then
    insert into public.consultations (
      organization_id,
      appointment_id,
      client_id,
      collaborator_id,
      date,
      type,
      notes,
      status,
      created_at
    ) values (
      NEW.organization_id,
      NEW.id,
      NEW.client_id,
      NEW.collaborator_id,
      NEW.datetime,
      coalesce(nullif(NEW.tipo, ''), 'consulta'),
      NEW.anotacoes,
      'completed',
      now()
    );
  end if;
  return NEW;
end;
$$;

-- 2) Garantir trigger idempotente nos agendamentos
drop trigger if exists auto_consultation_trigger on public.appointments;
create trigger auto_consultation_trigger
after update on public.appointments
for each row execute function public.auto_create_consultation();

-- 3) Blindagem opcional: colunas compat em consultations
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='consultations' and column_name='patient_id'
  ) then
    alter table public.consultations add column patient_id uuid generated always as (client_id) stored;
    comment on column public.consultations.patient_id is 'Compatibility alias for client_id (legacy)';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='consultations' and column_name='professional_id'
  ) then
    alter table public.consultations add column professional_id uuid generated always as (collaborator_id) stored;
    comment on column public.consultations.professional_id is 'Compatibility alias for collaborator_id (legacy)';
  end if;
end $$;

commit;$mig_v71$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v72
insert into public.master_migrations(version, name, sql)
values (
  72,
  'v72 - Agenda: normalizar tipo ao criar consulta a partir de agendamento realizado',
  $mig_v72$-- v72 – Agenda: normalizar tipo ao criar consulta a partir de agendamento realizado

begin;

-- 1) Recriar função com normalização de tipo (sem alterar v71)
create or replace function public.auto_create_consultation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Quando status muda para 'realizado', cria uma consulta vinculada
  if NEW.status = 'realizado' and coalesce(OLD.status, '') <> 'realizado' then
    -- Normaliza o tipo para os valores aceitos pela tabela consultations
    -- Valores como 'reuniao', 'follow_up', 'onboarding' serão tratados como 'consulta'
    declare v_type text := lower(coalesce(nullif(NEW.tipo, ''), 'consulta'));
    begin
      if v_type not in ('consulta','retorno','exame') then
        v_type := 'consulta';
      end if;
    end;

    insert into public.consultations (
      organization_id,
      appointment_id,
      client_id,
      collaborator_id,
      date,
      type,
      notes,
      status,
      created_at
    ) values (
      NEW.organization_id,
      NEW.id,
      NEW.client_id,
      NEW.collaborator_id,
      NEW.datetime,
      v_type,
      NEW.anotacoes,
      'completed',
      now()
    );
  end if;
  return NEW;
end;
$$;

-- 2) Garantir trigger (idempotente) — não rompe bases existentes
drop trigger if exists auto_consultation_trigger on public.appointments;
create trigger auto_consultation_trigger
after update on public.appointments
for each row execute function public.auto_create_consultation();

commit;$mig_v72$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v73
insert into public.master_migrations(version, name, sql)
values (
  73,
  'v73 - Agenda: correção definitiva da criação de consultations ao marcar realizado',
  $mig_v73$-- v73 – Agenda: correção definitiva da criação de consultations ao marcar realizado

begin;

-- 1) Função resiliente: normaliza tipo e evita colidir com versões anteriores
create or replace function public.auto_create_consultation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  -- Cria consulta somente na transição para 'realizado'
  if NEW.status = 'realizado' and coalesce(OLD.status, '') <> 'realizado' then
    -- Normalização de tipo: aceita apenas ('consulta','retorno','exame')
    v_type := lower(coalesce(nullif(NEW.tipo, ''), 'consulta'));
    if v_type not in ('consulta','retorno','exame') then
      v_type := 'consulta';
    end if;

    insert into public.consultations (
      organization_id,
      appointment_id,
      client_id,
      collaborator_id,
      date,
      type,
      notes,
      status,
      created_at
    ) values (
      NEW.organization_id,
      NEW.id,
      NEW.client_id,
      NEW.collaborator_id,
      NEW.datetime,
      v_type,
      NEW.anotacoes,
      'completed',
      now()
    );
  end if;
  return NEW;
end;
$$;

-- 2) Trigger idempotente para a função
drop trigger if exists auto_consultation_trigger on public.appointments;
create trigger auto_consultation_trigger
after update on public.appointments
for each row execute function public.auto_create_consultation();

commit;$mig_v73$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v74
insert into public.master_migrations(version, name, sql)
values (
  74,
  'v74 - Tutorial Manychat: progresso por usuário + RPCs; RPCs da Trilha',
  $mig_v74$-- v74 – Tutorial Manychat: progresso por usuário + RPCs; RPCs da Trilha
-- Regras: executar SEMPRE no CLIENT (BYO) do usuário final.

-- 1) Tabela: progresso do tutorial Manychat por organization_id + user_id + step_id
create table if not exists public.tutorial_manychat_progress (
  organization_id uuid not null,
  user_id uuid not null,
  step_id text not null,
  completed boolean not null default true,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tutorial_manychat_progress_pkey primary key (organization_id, user_id, step_id)
);

-- 1.1) Trigger updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tutorial_manychat_progress_set_updated_at on public.tutorial_manychat_progress;
create trigger tutorial_manychat_progress_set_updated_at
before update on public.tutorial_manychat_progress
for each row execute function public.set_updated_at();

-- 1.2) RLS (usa app.organization_id na sessão)
alter table public.tutorial_manychat_progress enable row level security;

drop policy if exists "mc_read_org" on public.tutorial_manychat_progress;
create policy "mc_read_org" on public.tutorial_manychat_progress
  for select to authenticated
  using ((organization_id::text = current_setting('app.organization_id', true)));

drop policy if exists "mc_write_org" on public.tutorial_manychat_progress;
create policy "mc_write_org" on public.tutorial_manychat_progress
  for insert to authenticated
  with check ((organization_id::text = current_setting('app.organization_id', true)));

drop policy if exists "mc_update_org" on public.tutorial_manychat_progress;
create policy "mc_update_org" on public.tutorial_manychat_progress
  for update to authenticated
  using ((organization_id::text = current_setting('app.organization_id', true)))
  with check ((organization_id::text = current_setting('app.organization_id', true)));

-- 2) RPCs (sempre na MESMA sessão: set_config + operação)

-- 2.1) Listar progresso Manychat por org e usuário
create or replace function public.tutorial_manychat_progress_list(
  p_organization_id uuid,
  p_user_id uuid
)
returns setof public.tutorial_manychat_progress
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  return query
  select * from public.tutorial_manychat_progress
  where organization_id = p_organization_id and user_id = p_user_id
  order by step_id asc;
end;
$$;

grant execute on function public.tutorial_manychat_progress_list(uuid, uuid) to authenticated, anon;

-- 2.2) Upsert de um passo Manychat
create or replace function public.tutorial_manychat_progress_upsert(
  p_organization_id uuid,
  p_user_id uuid,
  p_step_id text,
  p_completed boolean default true
)
returns public.tutorial_manychat_progress
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row public.tutorial_manychat_progress;
begin
  perform set_config('app.organization_id', p_organization_id::text, true);

  insert into public.tutorial_manychat_progress (organization_id, user_id, step_id, completed, completed_at)
  values (p_organization_id, p_user_id, p_step_id, coalesce(p_completed, true), case when coalesce(p_completed, true) then now() else null end)
  on conflict (organization_id, user_id, step_id) do update
    set completed = excluded.completed,
        completed_at = case when excluded.completed then now() else null end,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.tutorial_manychat_progress_upsert(uuid, uuid, text, boolean) to authenticated, anon;

-- 3) RPCs da Trilha (caso projeto ainda não possua)
-- 3.1) Listar progresso da trilha por organização
create or replace function public.monetization_trail_progress_list(
  p_organization_id uuid
)
returns table(step_key text, completed boolean, completed_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  return query
  select step_key, completed, completed_at
  from public.monetization_trail_progress
  where organization_id = p_organization_id
  order by step_key asc;
end;
$$;

grant execute on function public.monetization_trail_progress_list(uuid) to authenticated, anon;

-- 3.2) Upsert de um passo da trilha
create or replace function public.monetization_trail_progress_upsert(
  p_organization_id uuid,
  p_step_key text,
  p_completed boolean
)
returns public.monetization_trail_progress
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row public.monetization_trail_progress;
begin
  perform set_config('app.organization_id', p_organization_id::text, true);

  insert into public.monetization_trail_progress (organization_id, step_key, completed, completed_at)
  values (p_organization_id, p_step_key, coalesce(p_completed, true), case when coalesce(p_completed, true) then now() else null end)
  on conflict (organization_id, step_key) do update
    set completed = excluded.completed,
        completed_at = case when excluded.completed then now() else null end,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.monetization_trail_progress_upsert(uuid, text, boolean) to authenticated, anon;

-- 4) Marcar versão$mig_v74$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v75
insert into public.master_migrations(version, name, sql)
values (
  75,
  'v75 - Importação de Leads: aumentar statement_timeout e índices de staging',
  $mig_v75$-- v75 – Importação de Leads: aumentar statement_timeout e índices de staging

begin;

-- 1) Índices adicionais para acelerar DISTINCT ON e MERGE durante o commit
create index if not exists crm_leads_import_staging_phone_idx
  on public.crm_leads_import_staging(import_id, organization_id, phone_normalized)
  where phone_normalized is not null;

create index if not exists crm_leads_import_staging_email_idx
  on public.crm_leads_import_staging(import_id, organization_id, email_normalized)
  where email_normalized is not null;

-- 2) Aumentar o statement_timeout dentro da função de commit (operações pesadas)
create or replace function public.leads_import_commit(p_organization_id uuid, p_import_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
set statement_timeout = '600s'
as $$
declare
  v_lock_key text := 'leads_import:' || p_import_id::text;
  v_lock_ok boolean;
  v_email_strategy text := 'allow_duplicates';
begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  v_lock_ok := public.try_advisory_lock(v_lock_key);
  if not v_lock_ok then
    raise exception 'Import já em processamento';
  end if;

  select coalesce((select email_strategy from public.crm_import_prefs where organization_id=p_organization_id), 'allow_duplicates')
    into v_email_strategy;

  update public.crm_leads_import_jobs
    set status='processing', started_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  -- Passo 1: MERGE por telefone (único)
  with s_phone as (
    select distinct on (s.organization_id, s.phone_normalized)
           s.organization_id, coalesce(nullif(s.name,''), 'Sem nome') as name,
           s.whatsapp, s.email,
           coalesce(nullif(s.stage,''), 'novo') as stage,
           coalesce(s.value, 0) as value,
           s.source, s.canal, s.description,
           s.phone_normalized
    from public.crm_leads_import_staging s
    where s.import_id = p_import_id
      and s.organization_id = p_organization_id
      and s.phone_normalized is not null
    order by s.organization_id, s.phone_normalized, coalesce(s.row_num, 0) desc, s.created_at desc
  )
  merge into public.crm_leads t
  using s_phone s
  on (t.organization_id = s.organization_id and t.phone_normalized = s.phone_normalized)
  when matched then update set
    name = s.name,
    whatsapp = s.whatsapp,
    email = s.email,
    stage = s.stage,
    value = s.value,
    source = s.source,
    canal = s.canal,
    description = s.description,
    updated_at = now()
  when not matched then insert (
    id, organization_id, name, whatsapp, email, stage, value, source, canal, description
  ) values (
    gen_random_uuid(), s.organization_id, s.name, s.whatsapp, s.email, s.stage, s.value, s.source, s.canal, s.description
  );

  -- Passo 2: EMAIL – estratégia padrão: permitir duplicados (dedupe só dentro do arquivo)
  if v_email_strategy = 'allow_duplicates' then
    with s_email as (
      select distinct on (s.organization_id, s.email_normalized)
             s.organization_id, coalesce(nullif(s.name,''), 'Sem nome') as name,
             s.whatsapp, s.email,
             coalesce(nullif(s.stage,''), 'novo') as stage,
             coalesce(s.value, 0) as value,
             s.source, s.canal, s.description
      from public.crm_leads_import_staging s
      where s.import_id = p_import_id
        and s.organization_id = p_organization_id
        and s.phone_normalized is null
        and s.email_normalized is not null
      order by s.organization_id, s.email_normalized, coalesce(s.row_num, 0) desc, s.created_at desc
    )
    insert into public.crm_leads(
      id, organization_id, name, whatsapp, email, stage, value, source, canal, description
    )
    select gen_random_uuid(), se.organization_id, se.name, se.whatsapp, se.email, se.stage, se.value, se.source, se.canal, se.description
    from s_email se;
  else
    -- update_if_exists: manter comportamento anterior (atualiza se já existir, senão insere)
    with s_email as (
      select distinct on (s.organization_id, s.email_normalized)
             s.organization_id, coalesce(nullif(s.name,''), 'Sem nome') as name,
             s.whatsapp, s.email,
             coalesce(nullif(s.stage,''), 'novo') as stage,
             coalesce(s.value, 0) as value,
             s.source, s.canal, s.description,
             s.email_normalized
      from public.crm_leads_import_staging s
      where s.import_id = p_import_id
        and s.organization_id = p_organization_id
        and s.phone_normalized is null
        and s.email_normalized is not null
      order by s.organization_id, s.email_normalized, coalesce(s.row_num, 0) desc, s.created_at desc
    ), chosen as (
      select s.*, (
        select id from public.crm_leads t
        where t.organization_id = s.organization_id and t.email_normalized = s.email_normalized
        order by t.created_at asc, t.id asc limit 1
      ) as target_id
      from s_email s
    ), upd as (
      update public.crm_leads t
      set name = c.name, whatsapp = c.whatsapp, email = c.email, stage = c.stage, value = c.value,
          source = c.source, canal = c.canal, description = c.description, updated_at = now()
      from chosen c
      where c.target_id is not null and t.id = c.target_id
      returning c.email_normalized
    )
    insert into public.crm_leads(id, organization_id, name, whatsapp, email, stage, value, source, canal, description)
    select gen_random_uuid(), c.organization_id, c.name, c.whatsapp, c.email, c.stage, c.value, c.source, c.canal, c.description
    from chosen c
    where c.target_id is null;
  end if;

  update public.crm_leads_import_jobs
    set processed_rows = (select count(*) from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id),
        status='done', finished_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  delete from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id;

  perform public.advisory_unlock(v_lock_key);
  return jsonb_build_object('status','done');
exception when others then
  perform public.advisory_unlock(v_lock_key);
  update public.crm_leads_import_jobs set status='failed', error=SQLERRM, finished_at=now() where id=p_import_id and organization_id=p_organization_id;
  raise;
end;
$$;

grant execute on function public.leads_import_commit(uuid, uuid) to anon, authenticated;

commit;$mig_v75$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v76
insert into public.master_migrations(version, name, sql)
values (
  76,
  'v76 - Kanban sem limites e de alta performance',
  $mig_v76$-- v76 – Kanban sem limites e de alta performance
-- 1) Índices para paginação e agregações rápidas
-- 2) RPC de estatísticas do Kanban (conta/soma por organização)

begin;

-- Índices úteis para paginação por data e filtros comuns
create index if not exists idx_crm_leads_org_created_at
  on public.crm_leads(organization_id, created_at desc);

create index if not exists idx_crm_leads_org_stage
  on public.crm_leads(organization_id, stage);

create index if not exists idx_crm_leads_org_has_payment_true
  on public.crm_leads(organization_id)
  where has_payment is true;

create index if not exists idx_crm_leads_org_priority_high
  on public.crm_leads(organization_id)
  where priority = 'high';

create index if not exists idx_crm_leads_org_highlight
  on public.crm_leads(organization_id)
  where is_highlight is true;

-- RPC: Estatísticas do Kanban por organização
create or replace function public.kanban_leads_stats(p_organization_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_total bigint := 0;
  v_total_paid_value numeric := 0;
  v_high_priority bigint := 0;
  v_highlighted bigint := 0;
  v_with_payment bigint := 0;
  v_stage jsonb := '{}'::jsonb;
begin
  perform set_config('app.organization_id', p_organization_id::text, true);

  select count(*) into v_total from public.crm_leads where organization_id = p_organization_id;
  select coalesce(sum(payment_value), 0) into v_total_paid_value from public.crm_leads where organization_id = p_organization_id and has_payment is true;
  select count(*) into v_high_priority from public.crm_leads where organization_id = p_organization_id and priority = 'high';
  select count(*) into v_highlighted from public.crm_leads where organization_id = p_organization_id and is_highlight is true;
  select count(*) into v_with_payment from public.crm_leads where organization_id = p_organization_id and has_payment is true;

  select coalesce(jsonb_object_agg(coalesce(stage,'(sem estágio)'), cnt), '{}'::jsonb) into v_stage
  from (
    select stage, count(*)::bigint as cnt
    from public.crm_leads
    where organization_id = p_organization_id
    group by stage
  ) s;

  return jsonb_build_object(
    'total', v_total,
    'total_paid_value', v_total_paid_value,
    'high_priority', v_high_priority,
    'highlighted', v_highlighted,
    'with_payment', v_with_payment,
    'by_stage', v_stage
  );
end;
$$;

grant execute on function public.kanban_leads_stats(uuid) to anon, authenticated;

commit;$mig_v76$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v77
insert into public.master_migrations(version, name, sql)
values (
  77,
  'v77 - Organização: Sync Master↔Client (triggers + RPC de migração)',
  $mig_v77$-- v77 – Organização: Sync Master↔Client (triggers + RPC de migração)
-- Objetivo:
--  1) Habilitar sincronização de saas_organizations do CLIENT → MASTER via webhook (pg_net)
--  2) Permitir migração de dados entre organizações no CLIENT via RPC idempotente (dry-run/executar)

-- 1) CLIENT → MASTER: triggers e função de notificação (usa pg_net)
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


-- 2) CLIENT: RPC migrate_organization_data (dry-run e execução)
create or replace function public.migrate_organization_data(
  p_from_org_id uuid,
  p_to_org_id uuid,
  p_user_id uuid,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  from_owner uuid;
  to_owner uuid;
  r record;
  upd_count bigint;
  results jsonb := '[]'::jsonb;
  sql text;
  has_updated_at boolean;
  org_col_type text;
begin
  if p_from_org_id = p_to_org_id then
    raise exception 'from and to organization must be different';
  end if;

  -- Validate ownership
  select owner_id into from_owner from public.saas_organizations where id = p_from_org_id;
  select owner_id into to_owner from public.saas_organizations where id = p_to_org_id;
  if from_owner is null or to_owner is null then
    raise exception 'source or target organization not found';
  end if;
  if from_owner <> p_user_id or to_owner <> p_user_id then
    raise exception 'user is not owner of both organizations';
  end if;

  if not p_dry_run then
    -- (removido) não renomeamos na origem; clonaremos linhas referenciadas faltantes genericamente

    -- Pre-step: clonar crm_stages faltantes (metadados completos) da origem para o destino
    begin
      insert into public.crm_stages
      select (json_populate_record(NULL::public.crm_stages,
               ((to_jsonb(s) - 'id' - 'created_at' - 'updated_at' - 'organization_id') ||
               jsonb_build_object('organization_id', p_to_org_id))::json
             )).*
      from public.crm_stages s
      where s.organization_id = p_from_org_id
        and not exists (
          select 1 from public.crm_stages d
          where d.organization_id = p_to_org_id and d.name = s.name
        );
    exception when undefined_table then
      null;
    end;

    -- Pre-step genérico: para toda FK composta que inclua organization_id no parent,
    -- clonar do org de origem para o destino as linhas faltantes, baseando-se no conjunto de chaves naturais
    -- (todas as colunas da FK exceto organization_id).
    declare
      fk_rec record;
      cond text;
      col text;
      col_list text;
      sel_list text;
    begin
      for fk_rec in (
        select con.oid,
               ns_p.nspname as parent_schema,
               rel_p.relname as parent_table,
               array_agg(pa.attname order by ck.ord) as parent_cols
        from pg_constraint con
        join pg_class rel_p on rel_p.oid = con.confrelid
        join pg_namespace ns_p on ns_p.oid = rel_p.relnamespace
        join unnest(con.confkey) with ordinality as ck(attnum, ord) on true
        join pg_attribute pa on pa.attrelid = con.confrelid and pa.attnum = ck.attnum
        join pg_class rel_c on rel_c.oid = con.conrelid
        join pg_namespace ns_c on ns_c.oid = rel_c.relnamespace
        where con.contype = 'f'
          and ns_p.nspname = 'public'
          and ns_c.nspname = 'public'
        group by con.oid, parent_schema, parent_table
      ) loop
        if array_position(fk_rec.parent_cols, 'organization_id') is not null
           and array_length(fk_rec.parent_cols, 1) > 1 then
          cond := '';
          foreach col in array fk_rec.parent_cols loop
            if col <> 'organization_id' then
              if cond <> '' then cond := cond || ' and '; end if;
              cond := cond || format('d.%I is not distinct from p.%I', col, col);
            end if;
          end loop;
          if cond <> '' then
            select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position) into col_list
            from information_schema.columns c
            where c.table_schema = fk_rec.parent_schema and c.table_name = fk_rec.parent_table and c.column_name <> 'id';
            select string_agg(
                     format('(rec).%I', c.column_name),
                     ', ' order by c.ordinal_position) into sel_list
            from information_schema.columns c
            where c.table_schema = fk_rec.parent_schema and c.table_name = fk_rec.parent_table and c.column_name <> 'id';

            sql := format(
              'insert into %I.%I (%s)
               select %s
               from (
                 select json_populate_record(NULL::%I.%I,
                         ((to_jsonb(p) - ''organization_id'') || jsonb_build_object(''organization_id'', $1))::json
                       ) as rec
                 from %I.%I p
                 where p.organization_id = $2
                   and not exists (
                     select 1 from %I.%I d
                     where d.organization_id = $1 and %s
                   )
               ) q',
              fk_rec.parent_schema, fk_rec.parent_table,
              col_list,
              sel_list,
              fk_rec.parent_schema, fk_rec.parent_table,
              fk_rec.parent_schema, fk_rec.parent_table,
              fk_rec.parent_schema, fk_rec.parent_table,
              cond
            );
            begin
              execute sql using p_to_org_id, p_from_org_id;
            exception when undefined_table then
              null;
            end;
          end if;
        end if;
      end loop;
    end;
  end if;

  -- Iterate public tables with organization_id
  for r in (
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'organization_id'
      and t.table_type = 'BASE TABLE'
      and c.table_name <> 'saas_organizations'
      and c.table_name <> 'crm_stages'
    group by c.table_name
    order by c.table_name
  ) loop
    -- Detect column type to cast parameters safely (some legacy tables use text/varchar)
    select c.data_type into org_col_type
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = r.table_name and c.column_name = 'organization_id'
    limit 1;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = r.table_name and column_name = 'updated_at'
    ) into has_updated_at;

    if p_dry_run then
      if org_col_type = 'uuid' then
        execute format('select count(*) from public.%I where organization_id = $1::uuid', r.table_name)
          into upd_count using p_from_org_id;
      else
        execute format('select count(*) from public.%I where organization_id::text = $1::text', r.table_name)
          into upd_count using p_from_org_id;
      end if;
      results := results || jsonb_build_array(jsonb_build_object('table', r.table_name, 'would_update', upd_count));
    else
      if has_updated_at then
        if org_col_type = 'uuid' then
          sql := format('update public.%I set organization_id = $1::uuid, updated_at = now() where organization_id = $2::uuid', r.table_name);
        else
          sql := format('update public.%I set organization_id = $1::text, updated_at = now() where organization_id::text = $2::text', r.table_name);
        end if;
      else
        if org_col_type = 'uuid' then
          sql := format('update public.%I set organization_id = $1::uuid where organization_id = $2::uuid', r.table_name);
        else
          sql := format('update public.%I set organization_id = $1::text where organization_id::text = $2::text', r.table_name);
        end if;
      end if;
      execute sql using p_to_org_id, p_from_org_id;
      get diagnostics upd_count = row_count;
      results := results || jsonb_build_array(jsonb_build_object('table', r.table_name, 'updated', upd_count));
    end if;
  end loop;

  return jsonb_build_object(
    'dry_run', p_dry_run,
    'from', p_from_org_id,
    'to', p_to_org_id,
    'summary', results
  );
end
$$;

-- 3) Registrar versão
create table if not exists public.app_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

-- CLIENT: apontar para o MASTER e usar o mesmo secret
insert into public.saas_sync_settings(key, value)
values ('sync_org_to_master_url', 'https://qckjiolragbvvpqvfhrj.functions.supabase.co/sync-org-to-master')
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into public.saas_sync_settings(key, value)
values ('sync_org_webhook_secret', '96f1cef1-0a75-4693-ae0c-003453925dba')
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into public.saas_sync_settings(key, value)
values ('sync_org_to_master_enabled', 'true')
on conflict (key) do update set value = excluded.value, updated_at = now();$mig_v77$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v78
insert into public.master_migrations(version, name, sql)
values (
  78,
  'v78 - Kanban: Otimizações de Performance para Grandes Volumes',
  $mig_v78$-- v78 – Kanban: Otimizações de Performance para Grandes Volumes
-- Objetivo:
--  1) Adicionar índices compostos para otimizar queries de paginação e filtros no kanban
--  2) Melhorar performance quando há mais de 1000 leads (evita travamentos)
--  3) Suportar paginação server-side com queries rápidas mesmo com milhões de leads

-- Índice composto para queries de paginação por estágio (query mais comum no kanban)
-- Usado por: SELECT * FROM crm_leads WHERE organization_id = ? AND stage = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
CREATE INDEX IF NOT EXISTS idx_crm_leads_kanban_pagination 
  ON public.crm_leads(organization_id, stage, created_at DESC);

-- Índice para filtros de busca (nome, whatsapp, email)
-- Usado por: WHERE organization_id = ? AND (name ILIKE ? OR whatsapp ILIKE ? OR email ILIKE ?)
-- Nota: Índices separados para cada coluna de busca para melhor performance com ILIKE
CREATE INDEX IF NOT EXISTS idx_crm_leads_org_name_search 
  ON public.crm_leads(organization_id, name text_pattern_ops) 
  WHERE name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_leads_org_whatsapp_search 
  ON public.crm_leads(organization_id, whatsapp text_pattern_ops) 
  WHERE whatsapp IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_leads_org_email_search 
  ON public.crm_leads(organization_id, email text_pattern_ops) 
  WHERE email IS NOT NULL;

-- Índice para filtro de prioridade combinado com organização
-- Usado por: WHERE organization_id = ? AND priority = ?
CREATE INDEX IF NOT EXISTS idx_crm_leads_org_priority 
  ON public.crm_leads(organization_id, priority) 
  WHERE priority IS NOT NULL;

-- Índice para filtro de origem combinado com organização
-- Usado por: WHERE organization_id = ? AND source = ?
CREATE INDEX IF NOT EXISTS idx_crm_leads_org_source 
  ON public.crm_leads(organization_id, source) 
  WHERE source IS NOT NULL;

-- Índice para filtro de canal combinado com organização
-- Usado por: WHERE organization_id = ? AND canal = ?
CREATE INDEX IF NOT EXISTS idx_crm_leads_org_canal 
  ON public.crm_leads(organization_id, canal) 
  WHERE canal IS NOT NULL;

-- Índice para contagem rápida por organização (usado para determinar se deve usar paginação)
-- Usado por: SELECT COUNT(*) FROM crm_leads WHERE organization_id = ?
-- Nota: Índice em organization_id já deve existir, mas garantimos que está otimizado
CREATE INDEX IF NOT EXISTS idx_crm_leads_org_count 
  ON public.crm_leads(organization_id) 
  WHERE organization_id IS NOT NULL;

-- Comentários explicativos
COMMENT ON INDEX idx_crm_leads_kanban_pagination IS 
  'Índice otimizado para paginação de leads no kanban por estágio e data de criação';

COMMENT ON INDEX idx_crm_leads_org_name_search IS 
  'Índice para busca de texto (ILIKE) em nome';

COMMENT ON INDEX idx_crm_leads_org_whatsapp_search IS 
  'Índice para busca de texto (ILIKE) em whatsapp';

COMMENT ON INDEX idx_crm_leads_org_email_search IS 
  'Índice para busca de texto (ILIKE) em email';

COMMENT ON INDEX idx_crm_leads_org_priority IS 
  'Índice para filtro de prioridade por organização';

COMMENT ON INDEX idx_crm_leads_org_source IS 
  'Índice para filtro de origem por organização';

COMMENT ON INDEX idx_crm_leads_org_canal IS 
  'Índice para filtro de canal por organização';

-- Registrar versão
create table if not exists public.app_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);$mig_v78$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v79
insert into public.master_migrations(version, name, sql)
values (
  79,
  'v79 - Kanban: Ordenação Visual de Leads por Posição (stage_order)',
  $mig_v79$-- v79 – Kanban: Ordenação Visual de Leads por Posição (stage_order)
-- Objetivo:
--  1) Adicionar coluna stage_order para manter a posição exata onde o usuário solta o card no Kanban
--  2) Permitir ordenação customizada por drag-and-drop sem depender apenas de created_at
--  3) Garantir que leads fiquem exatamente onde o usuário os posiciona visualmente

-- Add stage_order column to crm_leads for visual position ordering within stages
-- This allows users to manually reorder leads within a stage via drag and drop

begin;

-- Add stage_order column (nullable initially for backward compatibility)
alter table public.crm_leads
  add column if not exists stage_order integer default null;

-- Create index for efficient ordering queries
create index if not exists idx_crm_leads_stage_order 
  on public.crm_leads(organization_id, stage, stage_order);

-- Backfill: assign initial order based on created_at (oldest = 0, newest = N)
-- This ensures existing leads maintain their current visual order
with ranked as (
  select 
    id,
    row_number() over (partition by organization_id, stage order by created_at asc) - 1 as initial_order
  from public.crm_leads
  where stage is not null
)
update public.crm_leads l
set stage_order = r.initial_order
from ranked r
where l.id = r.id and l.stage_order is null;

-- Set default for new leads (will be overridden by application logic)
alter table public.crm_leads
  alter column stage_order set default 0;

-- Add helpful comment
comment on column public.crm_leads.stage_order is 
  'Visual position order within the stage (0 = first, increasing downwards). Used for drag-and-drop positioning in Kanban view.';

commit;

-- Registrar versão
create table if not exists public.app_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);$mig_v79$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v80
insert into public.master_migrations(version, name, sql)
values (
  80,
  'v80 - Q&A: RPC de update com contexto RLS na mesma sessão',
  $mig_v80$-- v80 – Q&A: RPC de update com contexto RLS na mesma sessão

-- Esta migration corrige o erro PGRST116 ao editar Q&A, garantindo que o contexto RLS
-- seja configurado na mesma sessão da operação UPDATE.

set search_path = public, auth;

BEGIN;

-- Q&A: atualizar por id garantindo contexto de organização na MESMA sessão
create or replace function public.qna_update(
  p_organization_id uuid,
  p_id uuid,
  p_pergunta text default null,
  p_resposta text default null,
  p_categoria text default null,
  p_tags text[] default null
)
returns public.qna_pairs
language plpgsql
as $$
declare
  rec public.qna_pairs;
begin
  -- Configurar contexto RLS na mesma sessão
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  
  -- Atualizar apenas campos fornecidos (não null)
  -- Se o parâmetro for null, mantém o valor atual; se for fornecido (mesmo vazio), atualiza
  update public.qna_pairs
  set
    pergunta = case when p_pergunta is not null then trim(p_pergunta) else pergunta end,
    resposta = case when p_resposta is not null then trim(p_resposta) else resposta end,
    categoria = case 
      when p_categoria is not null then coalesce(nullif(trim(p_categoria), ''), 'Geral')
      else categoria 
    end,
    tags = coalesce(p_tags, tags),
    updated_at = now()
  where id = p_id
    and organization_id = p_organization_id
  returning * into rec;
  
  if rec.id is null then
    raise exception 'Q&A não encontrado ou sem permissão';
  end if;
  
  return rec;
end;
$$;

grant execute on function public.qna_update(uuid, uuid, text, text, text, text[]) to anon, authenticated;

COMMIT;
$mig_v80$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v81
insert into public.master_migrations(version, name, sql)
values (
  81,
  'v81 - AI Agent Workflows: Tabela para armazenar fluxos de trabalho de agentes de IA',
  $mig_v81$-- v81 – AI Agent Workflows: Tabela para armazenar fluxos de trabalho de agentes de IA
-- 
-- Esta migration cria a estrutura para que usuários possam desenhar e salvar
-- fluxos de trabalho para agentes de IA de atendimento e conversação.
--
-- Inspiração: Excalidraw, Whimsical, Miro
-- Design: Filosofia Apple (simplicidade, clareza, profundidade)

set search_path = public, auth;

BEGIN;

-- Tabela principal de workflows de agentes de IA
create table if not exists public.ai_agent_workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  
  -- Metadados básicos
  name text not null,
  description text,
  
  -- Dados do fluxograma (formato React Flow / XYFlow)
  -- nodes: array de nós do fluxograma
  -- edges: array de conexões entre nós
  -- viewport: posição e zoom do canvas
  workflow_data jsonb not null default '{
    "nodes": [],
    "edges": [],
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  }'::jsonb,
  
  -- Versão do workflow (para versionamento futuro)
  version integer not null default 1,
  
  -- Status e controle
  is_active boolean not null default true,
  is_template boolean not null default false, -- Templates podem ser compartilhados
  
  -- Categoria/tags para organização
  category text,
  tags text[] default '{}'::text[],
  
  -- Metadata adicional
  metadata jsonb default '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, -- Referência ao usuário que criou
  
  -- Constraints
  constraint ai_agent_workflows_name_check check (char_length(trim(name)) > 0),
  constraint ai_agent_workflows_version_check check (version > 0)
);

-- Índices para performance
create index if not exists ai_agent_workflows_org_id_idx 
  on public.ai_agent_workflows(organization_id);

create index if not exists ai_agent_workflows_org_active_idx 
  on public.ai_agent_workflows(organization_id, is_active) 
  where is_active = true;

create index if not exists ai_agent_workflows_category_idx 
  on public.ai_agent_workflows(organization_id, category) 
  where category is not null;

create index if not exists ai_agent_workflows_tags_idx 
  on public.ai_agent_workflows using gin(tags);

create index if not exists ai_agent_workflows_updated_at_idx 
  on public.ai_agent_workflows(updated_at desc);

-- Índice GIN para busca full-text no workflow_data
create index if not exists ai_agent_workflows_data_idx 
  on public.ai_agent_workflows using gin(workflow_data);

-- RLS (Row Level Security)
alter table public.ai_agent_workflows enable row level security;

-- Policy: usuários podem ver apenas workflows da sua organização
create policy ai_agent_workflows_select_policy
  on public.ai_agent_workflows
  for select
  using (
    organization_id = (current_setting('app.organization_id', true))::uuid
  );

-- Policy: usuários podem inserir workflows na sua organização
create policy ai_agent_workflows_insert_policy
  on public.ai_agent_workflows
  for insert
  with check (
    organization_id = (current_setting('app.organization_id', true))::uuid
  );

-- Policy: usuários podem atualizar workflows da sua organização
create policy ai_agent_workflows_update_policy
  on public.ai_agent_workflows
  for update
  using (
    organization_id = (current_setting('app.organization_id', true))::uuid
  )
  with check (
    organization_id = (current_setting('app.organization_id', true))::uuid
  );

-- Policy: usuários podem deletar workflows da sua organização
create policy ai_agent_workflows_delete_policy
  on public.ai_agent_workflows
  for delete
  using (
    organization_id = (current_setting('app.organization_id', true))::uuid
  );

-- Trigger para atualizar updated_at automaticamente
create or replace function public.ai_agent_workflows_update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ai_agent_workflows_update_updated_at_trigger
  before update on public.ai_agent_workflows
  for each row
  execute function public.ai_agent_workflows_update_updated_at();

-- Função RPC para listar workflows (com contexto RLS)
create or replace function public.ai_agent_workflows_list(
  p_organization_id uuid,
  p_query text default null,
  p_category text default null,
  p_tags text[] default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns setof public.ai_agent_workflows
language plpgsql
as $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  
  return query
  select *
  from public.ai_agent_workflows
  where organization_id = p_organization_id
    and (
      p_query is null
      or p_query = ''
      or (
        name ilike '%' || p_query || '%'
        or coalesce(description, '') ilike '%' || p_query || '%'
        or coalesce(category, '') ilike '%' || p_query || '%'
      )
    )
    and (p_category is null or category = p_category)
    and (p_tags is null or tags && p_tags)
  order by updated_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.ai_agent_workflows_list(uuid, text, text, text[], integer, integer) 
  to anon, authenticated;

-- Função RPC para criar/atualizar workflow
-- Remover versões antigas da função se existirem (com assinaturas diferentes)
drop function if exists public.ai_agent_workflows_upsert(uuid, uuid, text, text, jsonb, text, text[], boolean);
drop function if exists public.ai_agent_workflows_upsert(uuid, text, uuid, text, jsonb, text, text[], boolean);

create or replace function public.ai_agent_workflows_upsert(
  p_organization_id uuid,
  p_name text,
  p_id uuid default null,
  p_description text default null,
  p_workflow_data jsonb default null,
  p_category text default null,
  p_tags text[] default null,
  p_is_active boolean default true
)
returns public.ai_agent_workflows
language plpgsql
as $$
declare
  rec public.ai_agent_workflows;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  
  -- Se p_id for fornecido, atualiza; senão, cria novo
  if p_id is not null then
    update public.ai_agent_workflows
    set
      name = trim(p_name),
      description = nullif(trim(coalesce(p_description, '')), ''),
      workflow_data = coalesce(p_workflow_data, workflow_data),
      category = nullif(trim(coalesce(p_category, '')), ''),
      tags = coalesce(p_tags, tags),
      is_active = p_is_active,
      updated_at = now()
    where id = p_id
      and organization_id = p_organization_id
    returning * into rec;
    
    if rec.id is null then
      raise exception 'Workflow não encontrado ou sem permissão';
    end if;
  else
    insert into public.ai_agent_workflows (
      organization_id,
      name,
      description,
      workflow_data,
      category,
      tags,
      is_active
    ) values (
      p_organization_id,
      trim(p_name),
      nullif(trim(coalesce(p_description, '')), ''),
      coalesce(p_workflow_data, '{"nodes": [], "edges": [], "viewport": {"x": 0, "y": 0, "zoom": 1}}'::jsonb),
      nullif(trim(coalesce(p_category, '')), ''),
      coalesce(p_tags, '{}'::text[]),
      p_is_active
    )
    returning * into rec;
  end if;
  
  return rec;
end;
$$;

grant execute on function public.ai_agent_workflows_upsert(uuid, text, uuid, text, jsonb, text, text[], boolean) 
  to anon, authenticated;

-- Função RPC para deletar workflow
create or replace function public.ai_agent_workflows_delete(
  p_organization_id uuid,
  p_id uuid
)
returns boolean
language plpgsql
as $$
declare
  v_deleted int := 0;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  
  delete from public.ai_agent_workflows
  where id = p_id
    and organization_id = p_organization_id;
  
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

grant execute on function public.ai_agent_workflows_delete(uuid, uuid) 
  to anon, authenticated;

COMMIT;
$mig_v81$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v82
insert into public.master_migrations(version, name, sql)
values (
  82,
  'v82 - Trail Notes: Sistema de anotações para trilhas',
  $mig_v82$-- v82 – Trail Notes: Sistema de anotações para trilhas
-- 
-- Esta migration cria a estrutura para que usuários possam fazer anotações
-- sobre as aulas das trilhas (Monetização, n8n, Multi Agentes).
--
-- Design: Filosofia Apple (simplicidade, clareza, profundidade)
-- Funcionalidades: Criar, editar, deletar notas por aula; auto-save

SET search_path = public, auth;

BEGIN;

-- 1) Tabela de notas por trilha, organização e aula
CREATE TABLE IF NOT EXISTS public.trail_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  trail_type text NOT NULL CHECK (trail_type IN ('monetization', 'n8n', 'multi-agents')),
  lesson_key text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trail_notes_org_trail_lesson_unique UNIQUE (organization_id, trail_type, lesson_key)
);

-- 2) Índices para performance
CREATE INDEX IF NOT EXISTS idx_trail_notes_org_trail 
  ON public.trail_notes (organization_id, trail_type);

CREATE INDEX IF NOT EXISTS idx_trail_notes_lesson_key 
  ON public.trail_notes (lesson_key);

CREATE INDEX IF NOT EXISTS idx_trail_notes_updated_at 
  ON public.trail_notes (updated_at DESC);

-- 3) Trigger para updated_at
CREATE OR REPLACE FUNCTION public.trail_notes_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trail_notes_set_updated_at_trigger ON public.trail_notes;
CREATE TRIGGER trail_notes_set_updated_at_trigger
  BEFORE UPDATE ON public.trail_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.trail_notes_set_updated_at();

-- 4) RLS por organização
ALTER TABLE public.trail_notes ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='trail_notes' AND policyname='trail_notes_select_ctx'
  ) THEN
    DROP POLICY trail_notes_select_ctx ON public.trail_notes;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='trail_notes' AND policyname='trail_notes_modify_ctx'
  ) THEN
    DROP POLICY trail_notes_modify_ctx ON public.trail_notes;
  END IF;
END $$;

-- Política de leitura: aceita header OU GUC
CREATE POLICY trail_notes_select_ctx ON public.trail_notes
  FOR SELECT
  TO anon, authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id::text = COALESCE(
      NULLIF(current_setting('request.header.x-organization-id', true), ''),
      NULLIF(current_setting('app.organization_id', true), '')
    )
  );

-- Política de modificação: aceita header OU GUC
CREATE POLICY trail_notes_modify_ctx ON public.trail_notes
  FOR ALL
  TO anon, authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id::text = COALESCE(
      NULLIF(current_setting('request.header.x-organization-id', true), ''),
      NULLIF(current_setting('app.organization_id', true), '')
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id::text = COALESCE(
      NULLIF(current_setting('request.header.x-organization-id', true), ''),
      NULLIF(current_setting('app.organization_id', true), '')
    )
  );

-- 5) RPC: Obter nota de uma aula específica
CREATE OR REPLACE FUNCTION public.trail_notes_get(
  p_organization_id uuid,
  p_trail_type text,
  p_lesson_key text
)
RETURNS TABLE (
  id uuid,
  content text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  RETURN QUERY
  SELECT 
    tn.id,
    tn.content,
    tn.created_at,
    tn.updated_at
  FROM public.trail_notes tn
  WHERE tn.organization_id = p_organization_id
    AND tn.trail_type = p_trail_type
    AND tn.lesson_key = p_lesson_key
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trail_notes_get(uuid, text, text) TO authenticated, anon;

-- 6) RPC: Upsert de nota (criar ou atualizar)
CREATE OR REPLACE FUNCTION public.trail_notes_upsert(
  p_organization_id uuid,
  p_trail_type text,
  p_lesson_key text,
  p_content text
)
RETURNS public.trail_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_row public.trail_notes;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  INSERT INTO public.trail_notes (
    organization_id,
    trail_type,
    lesson_key,
    content
  )
  VALUES (
    p_organization_id,
    p_trail_type,
    p_lesson_key,
    COALESCE(p_content, '')
  )
  ON CONFLICT (organization_id, trail_type, lesson_key) 
  DO UPDATE SET
    content = EXCLUDED.content,
    updated_at = now()
  RETURNING * INTO v_row;
  
  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trail_notes_upsert(uuid, text, text, text) TO authenticated, anon;

-- 7) RPC: Deletar nota
CREATE OR REPLACE FUNCTION public.trail_notes_delete(
  p_organization_id uuid,
  p_trail_type text,
  p_lesson_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_deleted int;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  DELETE FROM public.trail_notes
  WHERE organization_id = p_organization_id
    AND trail_type = p_trail_type
    AND lesson_key = p_lesson_key;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN v_deleted > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trail_notes_delete(uuid, text, text) TO authenticated, anon;

COMMIT;
$mig_v82$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v83
insert into public.master_migrations(version, name, sql)
values (
  83,
  'v83 - Add cliente_messages field to ai_agent_metrics_summary function',
  $mig_v83$-- Add cliente_messages field to ai_agent_metrics_summary function
-- This allows calculating average messages per user using only cliente messages

-- Drop existing function first since we're changing the return type
drop function if exists public.ai_agent_metrics_summary(uuid, timestamptz, timestamptz);

-- Create the function with the new return type
create function public.ai_agent_metrics_summary(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  total_messages bigint,
  human_messages bigint,
  cliente_messages bigint,
  users_attended bigint
)
language sql
stable
as $$
  select
    count(*) as total_messages,
    count(*) filter (where sender_type in ('cliente','humano')) as human_messages,
    count(*) filter (where sender_type = 'cliente') as cliente_messages,
    count(distinct whatsapp_cliente) as users_attended
  from public.repositorio_de_mensagens
  where organization_id = p_org
    and created_at >= p_from
    and created_at <= p_to;
$$;

comment on function public.ai_agent_metrics_summary is 'Window summary: total messages, human messages, cliente messages, and distinct whatsapp_cliente count for the organization.';
$mig_v83$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v84
insert into public.master_migrations(version, name, sql)
values (
  84,
  'v84 - Remove constraint única de telefone para permitir múltiplos leads com mesmo telefone',
  $mig_v84$-- v84 – Remove constraint única de telefone para permitir múltiplos leads com mesmo telefone

begin;

-- 1) Remover índice único em phone_normalized
drop index if exists public.uniq_crm_leads_org_phone;

-- 2) Criar índice não-único para performance (consultas por telefone)
create index if not exists idx_crm_leads_org_phone
  on public.crm_leads(organization_id, phone_normalized)
  where phone_normalized is not null;

-- 3) Atualizar leads_import_commit para remover ON CONFLICT de telefone (permite duplicatas)
create or replace function public.leads_import_commit(p_organization_id uuid, p_import_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare v_lock_key text := 'leads_import:' || p_import_id::text; v_lock_ok boolean;
begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  v_lock_ok := public.try_advisory_lock(v_lock_key);
  if not v_lock_ok then
    raise exception 'Import já em processamento';
  end if;

  update public.crm_leads_import_jobs
    set status='processing', started_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  -- 1) INSERT por telefone (sem deduplicação - permite múltiplos leads com mesmo telefone)
  insert into public.crm_leads(
    id, organization_id, name, whatsapp, email, stage, value, source, canal, description
  )
  select gen_random_uuid(), s.organization_id,
         coalesce(nullif(s.name,''), 'Sem nome'),
         s.whatsapp, s.email, coalesce(nullif(s.stage,''), 'novo'), coalesce(s.value, 0), s.source, s.canal, s.description
  from public.crm_leads_import_staging s
  where s.import_id = p_import_id
    and s.organization_id = p_organization_id
    and s.phone_normalized is not null;

  -- 2) UPSERT por email (mantém deduplicação por email quando não há telefone)
  with s_email as (
    select distinct on (s.organization_id, s.email_normalized)
           s.organization_id, s.name, s.whatsapp, s.email, s.stage, s.value, s.source, s.canal, s.description,
           s.email_normalized
    from public.crm_leads_import_staging s
    where s.import_id = p_import_id
      and s.organization_id = p_organization_id
      and s.phone_normalized is null
      and s.email_normalized is not null
    order by s.organization_id, s.email_normalized, coalesce(s.row_num, 0) desc, s.created_at desc
  )
  insert into public.crm_leads(
    id, organization_id, name, whatsapp, email, stage, value, source, canal, description
  )
  select gen_random_uuid(), se.organization_id,
         coalesce(nullif(se.name,''), 'Sem nome'),
         se.whatsapp, se.email, coalesce(nullif(se.stage,''), 'novo'), coalesce(se.value, 0), se.source, se.canal, se.description
  from s_email se
  on conflict (organization_id, email_normalized)
    where email_normalized is not null
  do update set
    name = excluded.name,
    whatsapp = excluded.whatsapp,
    email = excluded.email,
    stage = excluded.stage,
    value = excluded.value,
    source = excluded.source,
    canal = excluded.canal,
    description = excluded.description,
    updated_at = now();

  update public.crm_leads_import_jobs
    set processed_rows = (select count(*) from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id),
        status='done',
        finished_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  delete from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id;

  perform public.advisory_unlock(v_lock_key);
  return jsonb_build_object('status','done');
exception when others then
  perform public.advisory_unlock(v_lock_key);
  update public.crm_leads_import_jobs
    set status='failed', error=SQLERRM, finished_at=now()
  where id=p_import_id and organization_id=p_organization_id;
  raise;
end;
$$;

grant execute on function public.leads_import_commit(uuid, uuid) to anon, authenticated;

commit;$mig_v84$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();


-- v85
insert into public.master_migrations(version, name, sql)
values (
  85,
  'v85 - RPC para Reordenar Leads em Estágio (crm_leads_reorder_stage)',
  $mig_v85$-- v85 – RPC para Reordenar Leads em Estágio (crm_leads_reorder_stage)
-- Objetivo:
--  1) Criar RPC que reordena todos os leads de um estágio sequencialmente
--  2) Garantir que stage_order seja único e sequencial (0, 1, 2, 3...) sem conflitos
--  3) Resolver problema de reordenação onde apenas um lead era atualizado, causando conflitos

begin;

-- RPC para reordenar leads em um estágio após mover um lead
-- Garante que stage_order seja sequencial (0, 1, 2, 3...) sem conflitos
CREATE OR REPLACE FUNCTION public.crm_leads_reorder_stage(
  p_organization_id uuid,
  p_stage text,
  p_lead_ids uuid[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lead_id uuid;
  v_order integer := 0;
BEGIN
  -- Validar que todos os leads pertencem à organização e ao estágio
  IF NOT EXISTS (
    SELECT 1 FROM public.crm_leads
    WHERE organization_id = p_organization_id
      AND stage = p_stage
      AND id = ANY(p_lead_ids)
    HAVING COUNT(*) = array_length(p_lead_ids, 1)
  ) THEN
    RAISE EXCEPTION 'Nem todos os leads pertencem à organização e estágio especificados';
  END IF;

  -- Atualizar stage_order sequencialmente para cada lead na ordem especificada
  FOREACH v_lead_id IN ARRAY p_lead_ids
  LOOP
    UPDATE public.crm_leads
    SET stage_order = v_order,
        updated_at = now()
    WHERE id = v_lead_id
      AND organization_id = p_organization_id
      AND stage = p_stage;
    
    v_order := v_order + 1;
  END LOOP;

  RETURN true;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.crm_leads_reorder_stage(uuid, text, uuid[]) TO authenticated, anon;

COMMENT ON FUNCTION public.crm_leads_reorder_stage IS 
  'Reordena leads em um estágio específico, garantindo stage_order sequencial sem conflitos. Usado após drag-and-drop no Kanban.';

commit;

-- Registrar versão
create table if not exists public.app_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);$mig_v85$
)
on conflict (version) do update set 
  name = excluded.name, 
  sql = excluded.sql,
  created_at = now();

