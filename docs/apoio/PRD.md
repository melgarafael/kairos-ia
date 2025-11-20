## TomikCRM — PRD v2 (BYO Supabase + Toolkit do Gestor de Automação)

### Resumo executivo
- **O que é**: Hub de ferramentas para gestores de automação rodarem CRM, Agenda e Financeiro rapidamente, conectando o próprio Supabase (BYO Supabase) para manter controle e privacidade dos dados.
- **Por que agora**: Profissionais de automação precisam integrar CRM/agenda/finanças com n8n e agentes de IA sem fricção (sem retrabalho de APIs/HTTP). O TomikCRM entrega UI pronta, nodes/templates de Supabase e webhooks de eventos do app.
- **Público**: gestores de automação, squads de operações e backoffice financeiro de negócios de serviços.
- **Mudança**: terminologia universal — Pacientes/Profissionais foram substituídos por Clientes/Colaboradores.

### Objetivos e métricas
- **Ativação**: concluir conexão do Supabase do cliente + setup inicial em < 10 min.
- **Adoção**: ≥ 60% das organizações ativas usando ≥ 1 template n8n e ≥ 1 webhook/semana.
- **Valor**: montar uma automação que cria agendamentos/entradas em < 15 min.
- **Receita**: 25% conversão Trial→Pago; churn < 4%/mês.
- **North Star**: compromissos (appointments) criados/semana por organização.

### Personas
- **Gestor de Automação**: orquestra fluxos (n8n, agentes), quer velocidade e segurança.
- **Operações**: usa CRM/Agenda/Clientes/Colaboradores no dia a dia.
- **Backoffice/Financeiro**: registra entradas/saídas, consulta KPIs e relatórios.

### Proposta de valor
- **BYO Supabase**: dados ficam no projeto do usuário (privacidade, compliance, fácil integração com ferramentas existentes).
- **Toolkit de automação**: biblioteca de templates/nodes Supabase prontos (CRUD de leads, clientes, agendamentos, entradas/saídas, produtos/serviços) + mini prompts/contexts para agentes.
- **Eventos e webhooks**: dispare n8n/integrações a partir de ações no app.
- **Assistente de IA**: navegação guiada e consultas estruturadas ao Client Supabase (read-only na v2).

## Escopo de produto (v2)

### Módulos principais
- **Conexão do Supabase (BYO)**
  - Inserir URL e anon/public key do Client Supabase.
  - Testar conexão, salvar de forma segura e reconectar.
  - Inicializar dados padrão (estágios do CRM, serviços) sob `organization_id` do usuário.
- **CRM**
  - Leads Kanban (estágios, arrastar/soltar, destaque, notas, histórico).
  - Lista de leads com filtros, bulk actions e export CSV.
  - Conversão de lead → cliente (RPC `convert_lead_to_client`).
  - Funil de métricas: conversão, estimado x faturado, por estágio.
- **Agenda**
  - Agendamentos com `client_id` OU `lead_id` (restrição XOR), tipos e status.
  - Checagem de conflito por colaborador (antes de criar/alterar horário).
- **Diretórios**
  - Clientes (substitui Pacientes): CRUD, busca e vínculo com agenda/financeiro.
  - Colaboradores (substitui Profissionais): cadastro e associação nos compromissos.
- **Financeiro**
  - Entradas/saídas com filtros (período, categoria, método, tipo).
  - KPIs (entradas, saídas, lucro líquido, margem, ticket médio), fluxo de caixa acumulado.
  - Produtos/Serviços: tipos de cobrança, estoque, ativo/inativo.
- **Automação n8n**
  - Webhook Manager: eventos do app (agendamento criado/atualizado, lembrete, mudança de status; cliente criado/atualizado; mudança de estágio; pagamento recebido), autenticação, timeout, retries, rate limit e teste de chamada.
  - Templates: biblioteca de nodes Supabase (adicionar/atualizar/remover/listar lead, cliente, agendamento, entrada, saída, produto/serviço etc.).
  - Manual para agentes: mini contextos e exemplos (sempre incluir `organization_id`, datas ISO, validação de tipos).
- **Assistente de IA**
  - Intenções de navegação com deep-link.
  - Consultas read-only a tabelas permitidas (`crm_leads`, `appointments`, `clients`, `collaborators`, `entradas`, `saidas`, `produtos_servicos`, `notifications`, `webhook_configurations`, `crm_stages`).
  - Follow-ups com sugestões de filtros e próximos passos.
- **Notificações**: listagem e badge (mvp).
- **Relatórios (Funil de Métricas)**: painel básico (funil e financeiros) e exportações iniciais.
- **Billing**: Stripe checkout (Basic/Professional), webhook de assinatura e status de plano.

### Fora de escopo (v2)
- Execução de workflows nativa (engine orquestrado) — hoje via webhooks+n8n.
- Ações de escrita pelo Assistente — entrar no roadmap com validação forte e auditoria.
- Criptografia avançada KMS/Secrets (Base64 atual) — priorizada no roadmap de segurança.

## Fluxos críticos
- **Onboarding**: cadastro (Master Supabase) → login → conectar Client Supabase → selecionar organização → inicializar dados default → acessar módulos.
- **Checkout**: selecionar plano → edge `create-checkout-session` → Stripe → webhook atualiza `saas_subscriptions`/`saas_users`.
- **Automação**: escolher evento (webhook) OU template n8n → colar JSON → ajustar `organization_id`/campos → testar → ativar.
- **Assistente**: pergunta → detectar intenção (navegação/consulta) → consulta com tools (limit/paginação) → follow-up → opção de navegar.

## Arquitetura (alto nível)
- **Front-end**: React + Vite + Tailwind; roteamento por hash; UI modular por features.
- **Master Supabase**: autenticação/billing/credenciais (tabelas `saas_users`, `saas_organizations`, `saas_plans`, `saas_subscriptions`).
- **Client Supabase**: dados de CRM/Agenda/Financeiro do cliente (multi-tenant por `organization_id`).
- **Conexões**: `supabaseManager` gerencia múltiplas conexões (testes, cache, init de dados, realtime).
- **Edge Functions**: `assistant-chat`, `assistant-chat-stream`, `assistant-chat-tools`, `assistant-prepare-attachments`, `assistant-transcribe`, `create-checkout-session`, `stripe-webhook`.
- **Realtime**: canais por tabela/`organization_id` (CRM e Financeiro) + polling de segurança em Kanban.

## Modelo de dados (essencial — Client Supabase)
- **CRM**: `crm_leads`, `crm_stages`, `crm_lead_notes`, `crm_lead_activities`.
- **Agenda**: `appointments` (colunas: `client_id` XOR `lead_id`, `collaborator_id`, `datetime`, `duration_minutes`, `tipo`, `status`).
- **Diretórios**: `clients` (Clientes), `collaborators` (Colaboradores).
- **Financeiro**: `entradas`, `saidas`, `produtos_servicos` (com `cobranca_tipo`, `tem_estoque`, `estoque_quantidade`).
- **Outros**: `notifications`, `user_preferences`.
- **RPC**: `convert_lead_to_client(p_lead_id uuid)` atualiza `clients` e marca lead convertido.

## Integrações
- **Stripe**: Checkout Session (planos com `stripe_price_id_*`), Webhook (`checkout.session.completed`, `subscription.updated/deleted`).
- **OpenAI**: Chat/Responses API nas functions do assistente (com CORS e streaming).
- **n8n**: uso dos templates/nodes Supabase e dos webhooks de eventos do app.

## Requisitos não funcionais
- **Segurança**
  - Multi-tenant por `organization_id` (RLS revisada para produção).
  - Guardar credenciais do Client hoje em Base64 (migração para KMS/Secrets no roadmap).
  - Chaves sensíveis apenas nas Edge Functions (Stripe, OpenAI, Service Role).
- **Performance**
  - Consultas com paginação/limites e índices em colunas de filtro.
  - Realtime + polling de segurança onde crítico (Kanban).
- **Confiabilidade**
  - Tratamento de erros com feedback ao usuário; retries em webhooks (quando aplicável).
- **Privacidade/Compliance**
  - Dados permanecem no Client Supabase do usuário; documentar responsabilidades (LGPD).

## Métricas e analytics
- Ativação (tempo para conectar Supabase; completion de setup).
- Adoção (nº de templates importados/executados; nº de webhooks ativos; uso da agenda/CRM/financeiro).
- Valor (transações financeiras registradas; conversões de funil).
- Receita (assinaturas ativas; upgrades/downgrades).

## Roadmap (90–180 dias)
- **P0 Segurança**: KMS/Secrets (armazenamento e rotação), masking de logs, endurecer RLS; auditoria de queries e RPCs.
- **P1 Automação**: backend para persistência e execução de Workflows/Webhooks (logs, retries, versionamento, permissões); “um clique” para aplicar templates.
- **P1 Assistente**: tools de escrita com validação de schema, dry-run e auditoria; limites por plano.
- **P1 Produto**: relatórios avançados e export; Agenda com vistas Dia/Semana/Mês e DnD em tempo real; Financeiro com centros de custo/categorias custom.
- **P2 Ecossistema**: marketplace de templates e SDK leve para agentes/automations.

## Critérios de aceite (release v2)
- Conectar Supabase do cliente, testar e salvar credenciais; reconectar automática.
- UI e textos atualizados para **Clientes** e **Colaboradores**.
- Templates executam CRUDs principais sem erro (com `organization_id`).
- Webhooks disparam e passam no teste no UI; logs básicos presentes.
- Assistente executa consultas às tabelas permitidas e sugere filtros; deep-link funcional.
- Stripe checkout e webhook atualizam corretamente plano/assinatura.

## Riscos e mitigações
- **Base64 para chave do Client** → migrar para KMS/Secrets, remover prints/logs e mascarar UI.
- **RLS permissiva (dev)** → revisar políticas, testes de acesso, consultoria de segurança.
- **Dependência de terceiros (Stripe/OpenAI)** → timeouts, retries e fallback de mensagens.
- **Alucinação do assistente** → tools restritas (read-only), mensagens de segurança e validação de schema antes de ações de escrita (quando ativadas).

## Anexos e referências (código)
- App/fluxo principal: `src/App.tsx`
- Auth SaaS/Conexões: `src/context/SaasAuthContext.tsx`, `src/lib/supabase-master.ts`, `src/lib/supabase-manager.ts`
- Assistente IA: `src/components/features/Dashboard/AssistantHome.tsx`, `supabase/functions/assistant-chat*/`
- Stripe: `supabase/functions/create-checkout-session/index.ts`, `supabase/functions/stripe-webhook/index.ts`
- CRM/Agenda: `src/hooks/useKanbanLeads.ts`, `src/hooks/useAppointments.ts`, `src/types/kanban.ts`
- Financeiro: `src/hooks/useFinancialNew.ts`, `src/types/financial-new.ts`
- Automação: `src/components/features/Automation/*`
- Migrações/Updates: `supabase/migrations/*`, `supabase/UPDATE-v5-CLIENT-SQL.md`
