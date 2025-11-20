# Mapeamento de Features ↔ Tabelas (Client Supabase)

> Importante: o TomikCRM usa o **Client Supabase** do usuário. Sempre filtrar por `organization_id` nas consultas.

## CRM
- Leads Kanban / Leads Lista
  - `crm_leads` (id, name, whatsapp, email, stage, value, priority, source, canal, created_at, organization_id)
  - `crm_stages` (id, name, order_index, color, organization_id)
  - Notas / histórico: `crm_lead_notes`, `crm_lead_activities`
- Conversão lead→cliente
  - RPC `convert_lead_to_client(p_lead_id uuid)`
  - Toca `clients` e atualiza `crm_leads.converted_*`

## Agenda
- Agendamentos
  - `appointments` (id, organization_id, client_id XOR lead_id, collaborator_id, datetime, duration_minutes, tipo, status, anotacoes)
  - Regra: `client_id` e `lead_id` são mutuamente exclusivos (constraint)
  - Conflitos: verificação por `collaborator_id` + intervalo de horário

## Diretórios
- Clientes
  - `clients` (id, organization_id, nome, telefone, email?, nascimento?, ...)
- Colaboradores
  - `collaborators` (id, user_id?, organization_id, name/position/email/phone, ...)

## Financeiro
- Entradas
  - `entradas` (id, organization_id, descricao, valor, categoria, data_entrada, metodo_pagamento, cliente_id?, produto_servico_id?)
- Saídas
  - `saidas` (id, organization_id, descricao, valor, categoria, data_saida, metodo_pagamento, fornecedor?)
- Produtos/Serviços
  - `produtos_servicos` (id, organization_id, nome, tipo, categoria, preco_base, cobranca_tipo, tem_estoque, estoque_quantidade, ativo)

## Notificações e Preferências
- `notifications`, `user_preferences`

## Assistente (read-only)
- Tabelas permitidas nas tools: `crm_leads`, `appointments`, `clients`, `collaborators`, `entradas`, `saidas`, `produtos_servicos`, `notifications`, `webhook_configurations`, `crm_stages`.

## Legado (não usar)
- Antigos nomes: **patients** e **professionals** — não são usados nas novas telas e fluxo; toda funcionalidade foi migrada para **clients** e **collaborators**.

## Limites e validações
- Sempre enviar `organization_id` nos inserts/updates.
- Datas em ISO 8601; validar tipos (número, boolean etc.).
- Antes de excluir `produtos_servicos`, verificar uso em `entradas`.
