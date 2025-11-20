-- PATCH RÁPIDO: garantir que public.professionals seja uma VIEW
do $$
declare
  v_relkind char;
begin
  select c.relkind
    into v_relkind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'professionals';

  if v_relkind in ('r','p','f') then
    execute 'drop table if exists public.professionals cascade';
  elsif v_relkind = 'm' then
    execute 'drop materialized view if exists public.professionals cascade';
  elsif v_relkind = 'v' then
    execute 'drop view if exists public.professionals cascade';
  end if;
end $$;

create or replace view public.professionals as
select
  c.id,
  c.organization_id,
  c.name,
  c.position,
  c.email,
  c.phone,
  c.credentials,
  c.notes,
  c.active,
  c.created_at,
  c.updated_at,
  0::int as total_consultations,
  0::int as consultations_this_month,
  0::int as upcoming_appointments,
  null::numeric as average_rating,
  '[]'::jsonb as upcoming_appointments_details,
  (c.position)::text as specialty
from public.collaborators c;

comment on view public.professionals
  is 'Compatibility view that maps collaborators to legacy professionals references.';

grant select on public.professionals to anon, authenticated, service_role;

create or replace rule professionals_update as
on update to public.professionals
do instead
update public.collaborators set
  name        = coalesce(new.name,        public.collaborators.name),
  position    = coalesce(new.position,    public.collaborators.position),
  email       = coalesce(new.email,       public.collaborators.email),
  phone       = coalesce(new.phone,       public.collaborators.phone),
  credentials = coalesce(new.credentials, public.collaborators.credentials),
  notes       = coalesce(new.notes,       public.collaborators.notes),
  active      = coalesce(new.active,      public.collaborators.active),
  updated_at  = now()
where public.collaborators.id = new.id
returning
  public.collaborators.id,
  public.collaborators.organization_id,
  public.collaborators.name,
  public.collaborators.position,
  public.collaborators.email,
  public.collaborators.phone,
  public.collaborators.credentials,
  public.collaborators.notes,
  public.collaborators.active,
  public.collaborators.created_at,
  public.collaborators.updated_at,
  0::int as total_consultations,
  0::int as consultations_this_month,
  0::int as upcoming_appointments,
  null::numeric as average_rating,
  '[]'::jsonb as upcoming_appointments_details,
  (public.collaborators.position)::text as specialty;

create or replace rule professionals_insert as
on insert to public.professionals
do instead
insert into public.collaborators (
  id, organization_id, name, position, email, phone, credentials, notes, active, created_at, updated_at
) values (
  coalesce(new.id, gen_random_uuid()),
  new.organization_id,
  new.name,
  new.position,
  new.email,
  new.phone,
  new.credentials,
  new.notes,
  coalesce(new.active, true),
  coalesce(new.created_at, now()),
  coalesce(new.updated_at, now())
)
returning
  id,
  organization_id,
  name,
  position,
  email,
  phone,
  credentials,
  notes,
  active,
  created_at,
  updated_at,
  0::int as total_consultations,
  0::int as consultations_this_month,
  0::int as upcoming_appointments,
  null::numeric as average_rating,
  '[]'::jsonb as upcoming_appointments_details,
  (position)::text as specialty;

create or replace rule professionals_delete as
on delete to public.professionals
do instead
delete from public.collaborators where id = old.id
returning
  old.id,
  old.organization_id,
  old.name,
  old.position,
  old.email,
  old.phone,
  old.credentials,
  old.notes,
  old.active,
  old.created_at,
  now() as updated_at,
  0::int as total_consultations,
  0::int as consultations_this_month,
  0::int as upcoming_appointments,
  null::numeric as average_rating,
  '[]'::jsonb as upcoming_appointments_details,
  (old.position)::text as specialty;

-- PRELUDE: zera a professionals para permitir recriações com colunas diferentes
do $$
begin
  if exists (select 1 from pg_rules where schemaname = 'public' and tablename = 'professionals' and rulename = 'professionals_update') then
    drop rule professionals_update on public.professionals;
  end if;
  if exists (select 1 from pg_rules where schemaname = 'public' and tablename = 'professionals' and rulename = 'professionals_insert') then
    drop rule professionals_insert on public.professionals;
  end if;
  if exists (select 1 from pg_rules where schemaname = 'public' and tablename = 'professionals' and rulename = 'professionals_delete') then
    drop rule professionals_delete on public.professionals;
  end if;
exception when others then
  raise notice 'Skipping drop rules: %', sqlerrm;
end $$;

drop view if exists public.professionals cascade;

-- PRELUDE para 'patients' sem deadlock:
-- - Se for TABLE: renomeia (evita DROP ... CASCADE)
-- - Se for VIEW/MVIEW: droppa e recria
-- - Depois cria a VIEW de compatibilidade apontando para clients

do $$
declare
  v_relkind char;
  v_oldname text := 'patients';
  v_newname text;
begin
  select c.relkind
    into v_relkind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = v_oldname;

  if v_relkind is null then
    -- não existe nada com esse nome; segue para criar a VIEW
    raise notice 'public.patients não existe; criando como VIEW de compatibilidade.';
  elsif v_relkind in ('r','p','f') then
    -- É TABELA/FTABLE/PTABLE -> RENOMEAR (evita CASCADE e deadlocks)
    v_newname := format('patients_legacy_%s', replace(now()::text, ' ', '_'));
    begin
      -- Tenta obter lock e renomear; se não der, apenas pula com aviso
      execute 'alter table public.'||quote_ident(v_oldname)||' rename to '||quote_ident(v_newname);
      raise notice 'Renomeado public.% para public.% (mantida cópia legada).', v_oldname, v_newname;
    exception when others then
      -- se estiver em uso, não falha a migration inteira; apenas avisa
      raise notice 'Não foi possível renomear public.%: %', v_oldname, sqlerrm;
    end;
  elsif v_relkind = 'm' then
    -- MATERIALIZED VIEW -> droppa e recria
    execute 'drop materialized view if exists public.patients cascade';
  elsif v_relkind = 'v' then
    -- VIEW -> droppa e recria
    execute 'drop view if exists public.patients cascade';
  end if;
end $$;

-- (Re)cria a VIEW de compatibilidade (idempotente)
create or replace view public.patients as
select
  c.id,
  c.organization_id,
  c.nome,
  c.email,
  c.telefone,
  c.nascimento,
  c.documentos,
  c.endereco,
  c.observacoes,
  c.ativo,
  c.created_at,
  c.updated_at
from public.clients c;

comment on view public.patients is 'Compatibility view mapping clients -> patients for legacy code.';
grant select on public.patients to anon, authenticated, service_role;


alter table public.crm_leads
  add column if not exists converted_client_id uuid references public.clients(id),
  add column if not exists converted_at timestamptz;

create or replace function public.convert_lead_to_client(p_lead_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_lead record;
  v_client_id uuid;
begin
  select * into v_lead from public.crm_leads where id = p_lead_id;
  if not found then
    raise exception 'Lead não encontrado';
  end if;

  insert into public.clients (id, organization_id, nome, email, telefone, created_at)
  values (gen_random_uuid(), v_lead.organization_id, v_lead.name, v_lead.email, v_lead.whatsapp, now())
  returning id into v_client_id;

  update public.crm_leads
  set converted_client_id = v_client_id,
      converted_at = now(),
      stage = coalesce(stage, 'fechado')
  where id = p_lead_id;

  return v_client_id;
end;
$$;

-- 2) Appointments com Lead
alter table public.appointments
  add column if not exists lead_id uuid references public.crm_leads(id);

DO $$ BEGIN IF NOT EXISTS ( SELECT 1 FROM pg_constraint c WHERE c.conname = 'appointments_client_or_lead_chk' AND c.conrelid = 'public.appointments'::regclass ) THEN ALTER TABLE public.appointments ADD CONSTRAINT appointments_client_or_lead_chk CHECK ( ((client_id IS NOT NULL)::int + (lead_id IS NOT NULL)::int) = 1 ); END IF; END $$;

create index if not exists idx_appointments_lead_id on public.appointments(lead_id);

-- 3) Preferências por usuário
create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  organization_id uuid not null,
  feature text not null, -- ex: 'leads_table_columns'
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id, feature)
);

-- RLS: permitir select/upsert apenas para o próprio user_id na mesma organization_id

create or replace view public.professionals as
select
  c.id,
  c.organization_id,
  c.name,
  c.position,
  c.email,
  c.phone,
  c.credentials,
  c.notes,
  c.active,
  c.created_at,
  c.updated_at
from public.collaborators c;

comment on view public.professionals is 'Compatibility view that maps collaborators to legacy professionals references.';

-- Ensure basic privileges (selection checks will still honor RLS on base table)
grant select on public.professionals to anon, authenticated, service_role;

-- Compatibility column for legacy triggers/functions expecting NEW.professional_id on appointments
-- Mirrors collaborator_id; read-only to callers

do $$
begin
  -- Add generated column if it doesn't exist
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'appointments' and column_name = 'professional_id'
  ) then
    alter table public.appointments
      add column professional_id uuid generated always as (collaborator_id) stored;
  end if;
exception when others then
  raise notice 'Skipping professional_id compat column creation: %', sqlerrm;
end $$;

comment on column public.appointments.professional_id is 'Compatibility alias for collaborator_id (generated column). Used by legacy triggers/functions.';

-- Extend compatibility view to include columns expected by legacy queries
-- Adds totals/metrics columns with safe defaults

create or replace view public.professionals as
select
  c.id,
  c.organization_id,
  c.name,
  c.position,
  c.email,
  c.phone,
  c.credentials,
  c.notes,
  c.active,
  c.created_at,
  c.updated_at,
  0::int as total_consultations,
  0::int as consultations_this_month,
  0::int as upcoming_appointments,
  null::numeric as average_rating,
  '[]'::jsonb as upcoming_appointments_details
from public.collaborators c;

grant select on public.professionals to anon, authenticated, service_role;

-- Add optional title column to appointments for event naming (Google Calendar-like)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'appointments' and column_name = 'title'
  ) then
    alter table public.appointments
      add column title text;
  end if;
exception when others then
  raise notice 'Skipping title column creation: %', sqlerrm;
end $$;

comment on column public.appointments.title is 'Optional event title for calendar cards.';

-- Compatibility view for legacy references to public.patients
-- Maps to current public.clients

create or replace view public.patients as
select
  c.id,
  c.organization_id,
  c.nome,
  c.email,
  c.telefone,
  c.nascimento,
  c.documentos,
  c.endereco,
  c.observacoes,
  c.ativo,
  c.created_at,
  c.updated_at
from public.clients c;

comment on view public.patients is 'Compatibility view mapping clients -> patients for legacy code.';

grant select on public.patients to anon, authenticated, service_role;



-- Compatibility column for legacy triggers/functions expecting NEW.patient_id on appointments
-- Mirrors client_id; read-only to callers

do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'appointments' and column_name = 'patient_id'
  ) then
    alter table public.appointments
      add column patient_id uuid generated always as (client_id) stored;
  end if;
exception when others then
  raise notice 'Skipping patient_id compat column creation: %', sqlerrm;
end $$;

comment on column public.appointments.patient_id is 'Compatibility alias for client_id (generated column). Used by legacy triggers/functions.';

-- Safely append `specialty` to professionals compatibility view

-- Drop rules temporarily to allow view replacement
do $$
begin
  if exists (select 1 from pg_rules where schemaname = 'public' and tablename = 'professionals' and rulename = 'professionals_update') then
    drop rule professionals_update on public.professionals;
  end if;
  if exists (select 1 from pg_rules where schemaname = 'public' and tablename = 'professionals' and rulename = 'professionals_insert') then
    drop rule professionals_insert on public.professionals;
  end if;
  if exists (select 1 from pg_rules where schemaname = 'public' and tablename = 'professionals' and rulename = 'professionals_delete') then
    drop rule professionals_delete on public.professionals;
  end if;
exception when others then
  raise notice 'Skipping drop rules: %', sqlerrm;
end $$;

-- Recreate view keeping existing column order and appending specialty at the end
create or replace view public.professionals as
select
  c.id,
  c.organization_id,
  c.name,
  c.position,
  c.email,
  c.phone,
  c.credentials,
  c.notes,
  c.active,
  c.created_at,
  c.updated_at,
  0::int as total_consultations,
  0::int as consultations_this_month,
  0::int as upcoming_appointments,
  null::numeric as average_rating,
  '[]'::jsonb as upcoming_appointments_details,
  (c.position)::text as specialty
from public.collaborators c;

grant select on public.professionals to anon, authenticated, service_role;

-- Recreate rules with updated RETURNING projection (now includes specialty at the end)
create or replace rule professionals_update as
on update to public.professionals
do instead
update public.collaborators set
  name = coalesce(new.name, public.collaborators.name),
  position = coalesce(new.position, public.collaborators.position),
  email = coalesce(new.email, public.collaborators.email),
  phone = coalesce(new.phone, public.collaborators.phone),
  credentials = coalesce(new.credentials, public.collaborators.credentials),
  notes = coalesce(new.notes, public.collaborators.notes),
  active = coalesce(new.active, public.collaborators.active),
  updated_at = now()
where public.collaborators.id = new.id
returning
  public.collaborators.id,
  public.collaborators.organization_id,
  public.collaborators.name,
  public.collaborators.position,
  public.collaborators.email,
  public.collaborators.phone,
  public.collaborators.credentials,
  public.collaborators.notes,
  public.collaborators.active,
  public.collaborators.created_at,
  public.collaborators.updated_at,
  0::int as total_consultations,
  0::int as consultations_this_month,
  0::int as upcoming_appointments,
  null::numeric as average_rating,
  '[]'::jsonb as upcoming_appointments_details,
  (public.collaborators.position)::text as specialty;

create or replace rule professionals_insert as
on insert to public.professionals
do instead
insert into public.collaborators (
  id, organization_id, name, position, email, phone, credentials, notes, active, created_at, updated_at
) values (
  coalesce(new.id, gen_random_uuid()),
  new.organization_id,
  new.name,
  new.position,
  new.email,
  new.phone,
  new.credentials,
  new.notes,
  coalesce(new.active, true),
  coalesce(new.created_at, now()),
  coalesce(new.updated_at, now())
)
returning
  id,
  organization_id,
  name,
  position,
  email,
  phone,
  credentials,
  notes,
  active,
  created_at,
  updated_at,
  0::int as total_consultations,
  0::int as consultations_this_month,
  0::int as upcoming_appointments,
  null::numeric as average_rating,
  '[]'::jsonb as upcoming_appointments_details,
  (position)::text as specialty;

create or replace rule professionals_delete as
on delete to public.professionals
do instead
delete from public.collaborators where id = old.id
returning
  old.id,
  old.organization_id,
  old.name,
  old.position,
  old.email,
  old.phone,
  old.credentials,
  old.notes,
  old.active,
  old.created_at,
  now() as updated_at,
  0::int as total_consultations,
  0::int as consultations_this_month,
  0::int as upcoming_appointments,
  null::numeric as average_rating,
  '[]'::jsonb as upcoming_appointments_details,
  (old.position)::text as specialty;

create or replace trigger automation_appointment_created
  after insert on public.appointments
  for each row execute function public.trigger_appointment_created();

create or replace trigger automation_appointment_status_changed
  after update on public.appointments
  for each row execute function public.trigger_appointment_status_changed();

-- =============================================
-- Webhooks Core: tables, functions, triggers
-- Ensures appointment-created/updated events enqueue webhook_events
-- Safe to run multiple times (IF NOT EXISTS guards)
-- =============================================

-- 0) Compatibility columns (aliases) to support legacy references
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'appointments' and column_name = 'patient_id'
  ) then
    alter table public.appointments
      add column patient_id uuid generated always as (client_id) stored;
  end if;
exception when others then
  raise notice 'Skipping patient_id compat column creation: %', sqlerrm;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'appointments' and column_name = 'professional_id'
  ) then
    alter table public.appointments
      add column professional_id uuid generated always as (collaborator_id) stored;
  end if;
exception when others then
  raise notice 'Skipping professional_id compat column creation: %', sqlerrm;
end $$;


-- 1) Tables required by the webhook processor
create table if not exists public.webhook_configurations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  webhook_url text not null,
  event_types text[] not null default '{}',
  authentication_type text not null default 'none',
  authentication_config jsonb not null default '{}'::jsonb,
  headers jsonb not null default '{}'::jsonb,
  retry_attempts int not null default 3,
  timeout_seconds int not null default 30,
  rate_limit_per_minute int not null default 60,
  is_active boolean not null default true,
  total_triggers int not null default 0,
  successful_triggers int not null default 0,
  failed_triggers int not null default 0,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  webhook_config_id uuid,
  event_type text not null,
  event_data jsonb not null,
  webhook_url text not null,
  request_payload jsonb not null,
  response_status int,
  response_data jsonb,
  response_headers jsonb,
  execution_time_ms int,
  status text not null default 'pending',
  error_message text,
  retry_count int not null default 0,
  created_at timestamptz not null default now(),
  constraint webhook_events_status_check check (status in ('pending','success','failed','timeout'))
);

create index if not exists webhook_events_created_at_idx on public.webhook_events (created_at desc);
create index if not exists webhook_events_status_idx on public.webhook_events (status);
create index if not exists webhook_events_org_idx on public.webhook_events (organization_id);


-- 2) Function: enqueue webhook events for active configurations
create or replace function public.trigger_webhook_event(
  p_organization_id uuid,
  p_event_type text,
  p_event_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg record;
  total_triggered integer := 0;
begin
  for cfg in
    select *
    from public.webhook_configurations
    where is_active = true
      and organization_id = p_organization_id
      and (event_types @> array[p_event_type]::text[])
  loop
    insert into public.webhook_events (
      organization_id,
      webhook_config_id,
      event_type,
      event_data,
      webhook_url,
      request_payload,
      status,
      created_at
    ) values (
      p_organization_id,
      cfg.id,
      p_event_type,
      p_event_data,
      cfg.webhook_url,
      jsonb_build_object(
        'event_type', p_event_type,
        'organization_id', p_organization_id,
        'timestamp', now(),
        'data', p_event_data
      ),
      'pending',
      now()
    );
    total_triggered := total_triggered + 1;
  end loop;

  return jsonb_build_object('triggered', total_triggered);
exception when others then
  raise notice 'Error in trigger_webhook_event: %', sqlerrm;
  return jsonb_build_object('triggered', total_triggered, 'error', sqlerrm);
end;
$$;


-- 3) Appointment triggers -> enqueue webhook events
create or replace function public.webhook_trigger_appointment_created()
returns trigger
language plpgsql
as $$
declare
  client_data jsonb;
  professional_data jsonb;
begin
  -- Related entities
  select row_to_json(c) into client_data from public.clients c where c.id = new.client_id;
  select row_to_json(co) into professional_data from public.collaborators co where co.id = new.collaborator_id;

  perform public.trigger_webhook_event(
    new.organization_id,
    'appointment_created',
    jsonb_build_object(
      'appointment', row_to_json(new),
      'client', client_data,
      'professional', professional_data,
      'timestamp', now()
    )
  );

  return new;
end;
$$;

create or replace function public.webhook_trigger_appointment_status_changed()
returns trigger
language plpgsql
as $$
declare
  client_data jsonb;
  professional_data jsonb;
begin
  if old.status is distinct from new.status then
    select row_to_json(c) into client_data from public.clients c where c.id = new.client_id;
    select row_to_json(co) into professional_data from public.collaborators co where co.id = new.collaborator_id;

    perform public.trigger_webhook_event(
      new.organization_id,
      'appointment_status_changed',
      jsonb_build_object(
        'appointment', row_to_json(new),
        'client', client_data,
        'professional', professional_data,
        'old_status', old.status,
        'new_status', new.status,
        'timestamp', now()
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists automation_appointment_created on public.appointments;
create trigger automation_appointment_created
  after insert on public.appointments
  for each row execute function public.webhook_trigger_appointment_created();

drop trigger if exists automation_appointment_status_changed on public.appointments;
create trigger automation_appointment_status_changed
  after update on public.appointments
  for each row execute function public.webhook_trigger_appointment_status_changed();


-- 4) Housekeeping: keep updated_at on webhook_configurations
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_webhook_configurations_updated_at on public.webhook_configurations;
create trigger update_webhook_configurations_updated_at
  before update on public.webhook_configurations
  for each row execute function public.update_updated_at_column();

-- ==========================================================
-- Webhooks Events Extension
-- - Registers additional event types (collaborators, products, etc.)
-- - Adds server-side triggers to enqueue webhook_events
-- - Removes consultations/professionals triggers per request
-- ==========================================================

-- 0) Ensure table webhook_event_types exists (no-op if already there)
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

-- 1) Upsert event types
insert into public.webhook_event_types (event_type, display_name, description, example_payload, category, is_active)
values
  ('appointment_updated', 'Agendamento Atualizado', 'Disparado quando um agendamento é modificado', '{"event_type":"appointment_updated","appointment":{"id":"..."}}'::jsonb, 'appointments', true),
  ('client_updated', 'Cliente Atualizado', 'Disparado quando dados do cliente são modificados', '{"event_type":"client_updated","client":{"id":"..."}}'::jsonb, 'clients', true),
  ('lead_created', 'Lead Criado', 'Disparado quando um lead é adicionado ao CRM', '{"event_type":"lead_created","lead":{"id":"..."}}'::jsonb, 'crm', true),
  ('lead_updated', 'Lead Atualizado', 'Disparado quando um lead é modificado', '{"event_type":"lead_updated","lead":{"id":"..."}}'::jsonb, 'crm', true),
  ('lead_stage_changed', 'Lead Mudou Etapa', 'Disparado quando um lead muda de estágio no funil', '{"event_type":"lead_stage_changed","lead":{"id":"..."},"old_stage":"novo","new_stage":"contato"}'::jsonb, 'crm', true),
  ('lead_converted', 'Lead Convertido', 'Disparado quando um lead vira cliente pagante', '{"event_type":"lead_converted","lead":{"id":"..."},"client_id":"..."}'::jsonb, 'crm', true),
  ('payment_received', 'Pagamento Recebido', 'Disparado quando um pagamento é confirmado', '{"event_type":"payment_received","payment":{"id":"...","valor":0}}'::jsonb, 'financial', true),
  ('collaborator_created', 'Colaborador Cadastrado', 'Disparado quando novo colaborador é adicionado', '{"event_type":"collaborator_created","collaborator":{"id":"..."}}'::jsonb, 'collaborators', true),
  ('collaborator_updated', 'Colaborador Atualizado', 'Disparado quando dados do colaborador são modificados', '{"event_type":"collaborator_updated","collaborator":{"id":"..."}}'::jsonb, 'collaborators', true),
  ('product_created', 'Produto/Serviço Criado', 'Disparado quando um item é criado', '{"event_type":"product_created","product":{"id":"..."}}'::jsonb, 'products', true),
  ('product_updated', 'Produto/Serviço Atualizado', 'Disparado quando um item é modificado', '{"event_type":"product_updated","product":{"id":"..."}}'::jsonb, 'products', true)
on conflict (event_type) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  example_payload = excluded.example_payload,
  category = excluded.category,
  is_active = excluded.is_active;


-- 2) Triggers and functions per event

-- Appointments: Updated (fields other than status changes)
create or replace function public.webhook_trigger_appointment_updated()
returns trigger
language plpgsql
as $$
begin
  if (
    old.datetime is distinct from new.datetime or
    old.client_id is distinct from new.client_id or
    old.collaborator_id is distinct from new.collaborator_id or
    old.tipo is distinct from new.tipo or
    old.anotacoes is distinct from new.anotacoes or
    coalesce(old.title, '') is distinct from coalesce(new.title, '')
  ) then
    perform public.trigger_webhook_event(
      new.organization_id,
      'appointment_updated',
      jsonb_build_object(
        'appointment', row_to_json(new),
        'timestamp', now()
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists automation_appointment_updated on public.appointments;
create trigger automation_appointment_updated
  after update on public.appointments
  for each row execute function public.webhook_trigger_appointment_updated();


-- Clients: Created/Updated
create or replace function public.webhook_trigger_client_updated()
returns trigger
language plpgsql
as $$
begin
  perform public.trigger_webhook_event(
    new.organization_id,
    'client_updated',
    jsonb_build_object('client', row_to_json(new), 'timestamp', now())
  );
  return new;
end;
$$;

drop trigger if exists automation_client_updated on public.clients;
create trigger automation_client_updated
  after update on public.clients
  for each row execute function public.webhook_trigger_client_updated();


-- Leads: Created/Updated/Stage Changed/Converted
create or replace function public.webhook_trigger_lead_created()
returns trigger
language plpgsql
as $$
begin
  perform public.trigger_webhook_event(
    new.organization_id,
    'lead_created',
    jsonb_build_object('lead', row_to_json(new), 'timestamp', now())
  );
  return new;
end;
$$;

create or replace function public.webhook_trigger_lead_updated()
returns trigger
language plpgsql
as $$
begin
  perform public.trigger_webhook_event(
    new.organization_id,
    'lead_updated',
    jsonb_build_object('lead', row_to_json(new), 'timestamp', now())
  );
  return new;
end;
$$;

create or replace function public.webhook_trigger_lead_stage_changed()
returns trigger
language plpgsql
as $$
begin
  if old.stage is distinct from new.stage then
    perform public.trigger_webhook_event(
      new.organization_id,
      'lead_stage_changed',
      jsonb_build_object('lead', row_to_json(new), 'old_stage', old.stage, 'new_stage', new.stage, 'timestamp', now())
    );
  end if;
  return new;
end;
$$;

create or replace function public.webhook_trigger_lead_converted()
returns trigger
language plpgsql
as $$
begin
  if old.converted_client_id is null and new.converted_client_id is not null then
    perform public.trigger_webhook_event(
      new.organization_id,
      'lead_converted',
      jsonb_build_object('lead', row_to_json(new), 'client_id', new.converted_client_id, 'timestamp', now())
    );
  end if;
  return new;
end;
$$;

drop trigger if exists automation_lead_created on public.crm_leads;
create trigger automation_lead_created
  after insert on public.crm_leads
  for each row execute function public.webhook_trigger_lead_created();

drop trigger if exists automation_lead_updated on public.crm_leads;
create trigger automation_lead_updated
  after update on public.crm_leads
  for each row execute function public.webhook_trigger_lead_updated();

drop trigger if exists automation_lead_stage_changed on public.crm_leads;
create trigger automation_lead_stage_changed
  after update on public.crm_leads
  for each row execute function public.webhook_trigger_lead_stage_changed();

drop trigger if exists automation_lead_converted on public.crm_leads;
create trigger automation_lead_converted
  after update on public.crm_leads
  for each row execute function public.webhook_trigger_lead_converted();


-- Payments: Received (on insert or status change to confirmado)
create or replace function public.webhook_trigger_payment_received()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT' and new.status = 'confirmado') or (tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'confirmado') then
    perform public.trigger_webhook_event(
      new.organization_id,
      'payment_received',
      jsonb_build_object('payment', row_to_json(new), 'timestamp', now())
    );
  end if;
  return new;
end;
$$;

drop trigger if exists automation_payment_received_ins on public.pagamentos;
create trigger automation_payment_received_ins
  after insert on public.pagamentos
  for each row execute function public.webhook_trigger_payment_received();

drop trigger if exists automation_payment_received_upd on public.pagamentos;
create trigger automation_payment_received_upd
  after update on public.pagamentos
  for each row execute function public.webhook_trigger_payment_received();


-- Collaborators: Created/Updated
create or replace function public.webhook_trigger_collaborator_created()
returns trigger
language plpgsql
as $$
begin
  perform public.trigger_webhook_event(
    new.organization_id,
    'collaborator_created',
    jsonb_build_object('collaborator', row_to_json(new), 'timestamp', now())
  );
  return new;
end;
$$;

create or replace function public.webhook_trigger_collaborator_updated()
returns trigger
language plpgsql
as $$
begin
  perform public.trigger_webhook_event(
    new.organization_id,
    'collaborator_updated',
    jsonb_build_object('collaborator', row_to_json(new), 'timestamp', now())
  );
  return new;
end;
$$;

drop trigger if exists automation_collaborator_created on public.collaborators;
create trigger automation_collaborator_created
  after insert on public.collaborators
  for each row execute function public.webhook_trigger_collaborator_created();

drop trigger if exists automation_collaborator_updated on public.collaborators;
create trigger automation_collaborator_updated
  after update on public.collaborators
  for each row execute function public.webhook_trigger_collaborator_updated();


-- Products/Services: Created/Updated
create or replace function public.webhook_trigger_product_created()
returns trigger
language plpgsql
as $$
begin
  perform public.trigger_webhook_event(
    new.organization_id,
    'product_created',
    jsonb_build_object('product', row_to_json(new), 'timestamp', now())
  );
  return new;
end;
$$;

create or replace function public.webhook_trigger_product_updated()
returns trigger
language plpgsql
as $$
begin
  perform public.trigger_webhook_event(
    new.organization_id,
    'product_updated',
    jsonb_build_object('product', row_to_json(new), 'timestamp', now())
  );
  return new;
end;
$$;

drop trigger if exists automation_product_created on public.produtos_servicos;
create trigger automation_product_created
  after insert on public.produtos_servicos
  for each row execute function public.webhook_trigger_product_created();

drop trigger if exists automation_product_updated on public.produtos_servicos;
create trigger automation_product_updated
  after update on public.produtos_servicos
  for each row execute function public.webhook_trigger_product_updated();


-- 3) Drop consultation/professional events (requested removal)
drop trigger if exists automation_consultation_completed on public.consultations;
-- No explicit professionals triggers are created in our migrations; if any exist, they can be dropped similarly.



-- v5 - Lista de Leads Adicionado (aliases, function, trigger, backfill)
insert into public.app_migrations (version, applied_at)
values ('5', now())
on conflict (version) do nothing;