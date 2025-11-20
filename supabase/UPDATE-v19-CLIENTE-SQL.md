-- Ensure webhook_event_types exists and is populated with a complete catalog
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


-- 5) Marcar versão
insert into public.app_migrations (version, applied_at)
values ('19', now())
on conflict (version) do nothing;