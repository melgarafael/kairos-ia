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


