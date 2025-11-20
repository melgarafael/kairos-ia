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


