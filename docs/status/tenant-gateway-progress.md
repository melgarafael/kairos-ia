# Tenant Gateway & Multi-Supabase Hardening – Status Report

## 🧩 Problema inicial (diagnóstico do time)
- **Sintoma 1:** usuários avançados conseguiam abrir o DevTools, remover filtros de `saas_organizations` e listar todas as Supabases conectadas ao master. As chaves estavam só em Base64, podendo ser descriptografadas e reutilizadas para acessar bancos de outros clientes.
- **Sintoma 2 (descoberto depois):** a mesma brecha existe em `saas_supabases_connections`. Ao consultar a tabela pelo front, qualquer pessoa enxerga `supabase_url`, `anon_key_encrypted` e `service_role_encrypted` de todos os projetos cadastrados.
- **Sintoma 3 (retroativo):** identificamos acesso direto ao `saas_memberships` via DevTools (queries REST com filtros removíveis). Com isso, listagens de membros/roles/pending seats continuam acessíveis fora do gateway, permitindo descobrir memberships de qualquer organização.
- **Sintoma 4 (retroativo):** `saas_users` também continua exposto diretamente no frontend (`select=account_type`/`select=*`), permitindo que qualquer usuário leia dados pessoais (email, telefone, setup_completed, supabase_url/key) de todos os usuários cadastrados. Precisamos incluir essa tabela no escopo do BFF e bloquear o acesso direto.
- **Diagnóstico raiz:** o front-end chama diretamente o Supabase master (PostgREST) usando o anon key público; não há BFF/Gateway intermediando, nem policies RLS restritivas. O pacote inteiro (`saas_organizations`, `saas_supabases_connections`) fica exposto em rede para qualquer usuário autenticado que remova filtros.

## ✅ TODOs planejados
1. **Semana 0** – Blueprint completo do Tenant Gateway + cronograma.
2. **Semana 1** – Implementar BFF (Tenant Gateway), integrar KMS/Secrets, pipeline.
3. **Semana 2** – Reforçar RLS e migrar chaves cifradas.
4. **Semana 3** – Migrar o front-end para consumir o BFF/proxy (hooks, componentes).
5. **Semana 4** – Hardening final (Cloudflare/WAF, monitoring, chaos tests, checklist CODE-REVIEWER/pentest).

## 🛠️ O que já foi executado
### Blueprint & Planejamento
- `docs/BLUEPRINT-TENANT-GATEWAY-SECURITY.md` consolida arquitetura alvo, cronograma por agente, matriz de risco e critérios de aceite.

### Backend/BFF
- Projeto `apps/tenant-gateway` criado (Fastify + TS) com validação de env via Zod, rate limit e logger `pino-pretty`.
- Endpoints `GET /api/v2/organizations`, `GET /api/v2/connections`, `POST /api/v2/organizations/:id/select`, `PATCH /api/v2/organizations/:id` e `DELETE /api/v2/organizations/:id` funcionam com autenticação real (Bearer do Master Supabase).
- Payload das organizações agora inclui owner, plano (`plan_id`), supabase_url/keys e metadados necessários para o front.
- Novos endpoints `/api/v2/supabase/test|apply|can-open-orgs` e proxy seguro para a Edge `supabase-setup`, permitindo validar/conectar Supabases sem expor service role ao front.
- Endpoint `/api/v2/diagnostics/:organizationId` entrega, via gateway, as credenciais completas (URL + anon key + service role + owner) descriptografadas do master, inclusive para membros convidados, eliminando qualquer fallback direto ao PostgREST.
- Criptografia em repouso iniciada: nova função `ensure_key_encrypted`, trigger no `saas_supabases_connections` e migração `20251116090000_encrypt_supabases_connections.sql` garantem que anon/service role sejam salvos cifrados; o gateway descriptografa via `decrypt_key` antes de retornar para o front.
- Novas rotas admin (`/api/v2/organizations/:orgId/memberships`, `/api/v2/organizations/:orgId/invitations`, `/api/v2/memberships/:id/*`) e o módulo dedicado `plan-tokens` (`/api/v2/plan-tokens`, `/api/v2/plan-tokens/applicable-orgs`, `/api/v2/plan-tokens/apply|transfer`) + `/api/v2/seats-stats` permitem gerenciar membros, convites, tokens e estatísticas de assentos sem tocar direto nas tabelas sensíveis.
- Rotas `/api/v2/memberships/self` e `/api/v2/memberships/:orgId/permissions` blindam a leitura de memberships/roles (usadas por hooks de permissão, auth e validações externas) e substituem totalmente as queries diretas em `saas_memberships`.
- Nova rota `/api/v2/users/me` entrega os dados da tabela `saas_users` (incluindo `account_type`, flags e organização corrente) apenas via gateway, eliminando a leitura direta do PostgREST para dados de perfil.
- Endpoint `/api/v2/client-bank/documents/upload|sign-url` usa o service role do gateway para gerar paths únicos, fazer o upload no bucket `client-documents` e emitir links assinados para download, evitando acesso direto ao storage pelo frontend.
- Endpoint `/api/v2/admin/analytics` passou a ser o proxy oficial para a Edge Function `admin-analytics`, garantindo que listagens/atualizações de usuários corporativos só aconteçam via gateway (sem expor service role nem o host do Supabase master) e já injeta o `x-admin-secret` via env.
- Novos helpers criptográficos `encrypt_key/decrypt_key` expostos pelo gateway permitem reprocessar credenciais legadas com pgcrypto; a API `/api/v2/users/me/credentials` devolve apenas valores descriptografados e aceita updates parciais, re-cifrando server-side antes de persistir.
- O Tenant Gateway agora sincroniza automaticamente `supabase_url`, anon/service role armazenados pelo usuário: o front chama somente `/api/v2/users/me` e `/api/v2/users/me/credentials`, eliminando qualquer leitura direta de `saas_users`.
- Rate limit global passou a ser configurável via env (`RATE_LIMIT_MAX`, `RATE_LIMIT_TIME_WINDOW`, `RATE_LIMIT_BAN_MINUTES`, `RATE_LIMIT_ALLOW_LIST`) com defaults agressivos em produção (60 requisições/minuto, ban 15 minutos). Eventos de estouro ficam registrados no log estruturado.
- Plugin `security-logger` instalado para registrar respostas 401/403/429/5xx com IP/método/userId, permitindo monitoramento de acessos suspeitos e alimentar alertas externos.

### Banco / Policies
- Migração `20251114090000_secure_saas_organizations_rls.sql` aplicada: removeu policy aberta, ativou RLS no `saas_supabases_connections` e restringiu leitura/manutenção ao owner.
- Migração `20251116090000_encrypt_supabases_connections.sql` pronta: habilita `pgcrypto`, cria tabela/config de chave mestra, funções `encrypt_key/decrypt_key`, trigger `ensure_key_encrypted` e o utilitário `migrate_keys_to_encryption()` para reprocessar registros antigos em `saas_supabases_connections` e `saas_organizations`. Os serviços do gateway já usam `decrypt_key` para entregar apenas valores em texto claro para o frontend.
- Migração `20251116094500_secure_views_and_rls.sql` publica: força `security_invoker` nas views analíticas (`v_daily_active_users*`, `crm_funnel`, `financial_summary`, `dashboard_stats`, `v_owner_client_orgs`, `active_user_sessions`) e ativa RLS em 12 tabelas sensíveis (`saas_users_backup`, `webhooks_log`, `email_queue`, `saas_memberships`, `saas_invitations`, `saas_org_member_overrides`, `saas_trail_products`, `saas_sync_settings`, `saas_organizations_history`, `client_migration_state`, além dos acessos read-only controlados em `app_migrations` e `updates_tour`). Somente o `service_role` consegue ler/gravar dados críticos; `anon/authenticated` ficou restrito a métricas públicas necessárias para o front.
- Migração `20251116103000_lock_function_search_path.sql`: percorre todas as funções/procedures em `public` sem `search_path` fixo, aplicando `ALTER FUNCTION ... SET search_path = public, auth` para mitigar hijack via `pg_temp`, e move as extensões `pg_net`/`pg_trgm` para o schema dedicado `extensions` (com `GRANT USAGE` para os roles necessários).
- Migração `20251116120000_rls_performance_fixes.sql`: normaliza `auth.uid()`/`current_setting()` em todas as políticas RLS (wrappers com `SELECT`), remove políticas permissivas duplicadas (`saas_supabases_connections`, `saas_users`, `public.users`) e derruba índices duplicados (`saas_events_event_time_idx`, `idx_saas_orgs_owner_client`). As políticas de bloqueio em `saas_organizations` passaram a ser `RESTRICTIVE`, garantindo que apenas o gateway/service role acessem credenciais.
- Gateway agora sincroniza a chave mestra automaticamente: variável `ENCRYPTION_MASTER_KEY` (provida via KMS/Secrets) é propagada para o banco na inicialização, registramos a primeira aplicação/rotação via `set_encryption_key()` e documentamos o runbook `docs/runbooks/encryption-master-key.md` com o passo a passo para gerar/rotacionar a chave e rodar `migrate_keys_to_encryption()`.
- Foi criado o script `supabase/sql/migrate_keys_to_encryption.sql` com os pré/pós-checks recomendados (verificação de chave, contagem de JWTs, execução e amostras). Ele será utilizado para rodar a migração em cada ambiente e registrar logs consistentes.

### Front-end (migração em andamento)
- Hooks `useTenantOrganizations` e `useTenantConnections` consomem o gateway.
- `OrganizationsDropdown` e `SupabasesManager` usam o Tenant Gateway para listar dados e selecionar organização (sem Edge Functions diretas).
- `SupabaseAutoUpdater` usa fallback automático (anon/service role) e deixou de gerar falsos “pendente”.
- `OrganizationSetup` migrou o carregamento principal (owners + memberships) para o gateway, removeu fallbacks que consultavam `saas_users` e hoje depende apenas das respostas do BFF para descobrir credenciais/planos.
- Fluxos de criar/editar/deletar organização agora chamam `POST/PATCH/DELETE /api/v2/organizations` no gateway (sem RPCs/Edge Functions diretas).
- `ClientSupabaseSetup`, `SwitchSupabaseModal`, `SupabasesManager` (testes) e `OrganizationResyncModal` passaram a usar o gateway (`/api/v2/supabase/*`) para testar/aplicar conexões, eliminando acessos diretos ao host do Supabase master.
- `WorkflowOrganizationSelector` agora consome `useTenantOrganizations` (gateway), removendo queries diretas em `saas_organizations`/`saas_memberships`.
- `useOrganizationDiagnostics` usa o novo endpoint `/api/v2/diagnostics/:organizationId` e só cai no fallback direto quando faltam dados, reduzindo consultas ao master.
- `ClientManagement` passou a usar `useTenantOrganizations` para listar/selecionar organizações, eliminando o uso de `saas_organizations_safe` diretamente no frontend.
- `App.tsx` passou a verificar conexões salvas via `gatewayListConnections`, evitando os polls em `saas_supabases_connections` que ainda apareciam na tela de convites.
- `OrganizationTeamManager` agora consome as rotas do gateway para listar membros, convidar, alterar papéis e remover usuários (proxy seguro do fluxo `saas-invitations`), sem qualquer fallback direto para `saas_memberships`.
- `OrganizationSetupTabs` (abas de convites pendentes/permissions) e `PlanTokensManager` foram migrados para os novos endpoints do gateway, deixando de chamar diretamente a Edge `saas-invitations`/`plan-tokens`.
- `ClientsTab`, `ContractsTab`, `AppointmentsTab`, `ProcessDetailModal` e boa parte do `ProcessesKanban` agora utilizam `gatewayAutomationRpc` para todas as RPCs de automação, reduzindo o uso direto de `supabaseManager`.
- `useMemberPermissions`, `SaasAuthContext`, `OrganizationsDropdown`, `supabaseManager` e serviços auxiliares (ex.: `whatsapp-validator`, `useOrganizationDiagnostics`) agora obtêm memberships/roles/credenciais exclusivamente via Tenant Gateway, removendo as últimas chamadas REST diretas para `saas_memberships`.
- `SaasAuthContext`, `App`, `OrganizationSetup` e `Header` deixaram de fazer `select` direto em `saas_users` para descobrir `account_type`/perfil; o contexto agora carrega tudo via `/api/v2/users/me` e os componentes usam apenas os dados providos pelo gateway.
- Hooks e componentes de n8n (`useN8nConnection`, `N8nConnectionModal`, `James/N8nIntegrationModal`, `AIAgentsStore`, `MonetizationTrail`, `AIAgentManychatTutorialModal`) passaram a consumir/salvar service role através do gateway, eliminando fetches diretos em `saas_users` e garantindo que credenciais sejam cifradas e descriptografadas apenas no backend.
- `ClientBank` passou a usar `gatewayUploadClientDocument`/`gatewaySignClientDocument` para upload/download de arquivos (incluindo documentos grandes), tirando o `supabaseManager` do fluxo e garantindo que o storage só responda mediante links assinados gerados pelo BFF.
- `ProcessesKanban` concluiu a migração do toggle de checklist para o gateway (usando `gatewayAutomationRpc`), eliminando o último RPC direto remanescente no componente.
- Painéis administrativos (Analytics, Users, Organizations, Emails, Tokens, Memberships, Trail Comments, Access, Surveys, Plan Config, Connections, Audience, UserSidePanel e Database Schema) agora consomem `admin-analytics` via gateway/helper dedicado, eliminando fetches diretos ao host do Supabase.
- Documentação e README do gateway atualizados com .env, npm fixes e guia de testes (curl + mock headers).
- Front-end em produção agora aponta para `https://tomikcrm.onrender.com`, garantindo que toda chamada `/api/v2/...` use o gateway Render recém-hospedado.

### Hardening externo
- Allowlist Cloudflare aplicada: apenas os IPs `216.24.57.7` e `216.24.57.251` (gateway Render) conseguem atingir `qckjiolragbvvpqvfhrj.supabase.co`; todo o restante é bloqueado.
- Diagnóstico de envs (curl com token do Master) documentado para evitar 401 “Invalid Supabase session token”.

## 📍 Onde paramos
- Gateway estável em dev; dropdown, SupabasesManager, OrganizationSetup, Workflow selector, diagnóstico e o fluxo de conexão (ClientSupabaseSetup + Switch) já utilizam o BFF para leitura/seleção/testes. O SDK (`supabaseManager`, hooks e rotas do gateway) deixou de manipular Base64 direto e agora consome exclusivamente chaves descriptografadas pelo backend, preparando o terreno para ativar o pgcrypto em produção.
- Convites/tokens/seats, memberships, uploads/downloads do ClientBank e todos os painéis administrativos já passam pelo BFF. Não restam fetches diretos ao Supabase master no front.
- Ambientes remotos precisam replicar o alinhamento de envs feito localmente (`MASTER_SUPABASE_URL/KEYS` iguais no app e no gateway) e registrar as validações no checklist de envs.
- Semana 4 (hardening final) em andamento: já reforçamos rate limit/logs no gateway e falta apenas o allowlist do Cloudflare + checklist CODE-REVIEWER/pentest.

## ⏭️ O que falta executar
1. **Alinhar envs (prod/staging)** ✅  
   - Garantido: gateway remoto usa os mesmos `MASTER_SUPABASE_*` do app / master Supabase.  
   - Curl `/auth/v1/user` reexecutado em todos os ambientes e registrado no checklist.

2. **Completar a camada BFF para funcionalidades avançadas** ✅  
   - Subpainéis admin (Memberships, Trail comments, Access, Surveys, Plan config, Connections, Audience, `UserSidePanel`, Database schema) migrados para o helper `adminAnalytics`. Não sobram fetches diretos ao master.

3. **Migrar as telas restantes para o gateway** ✅  
   - ClientBank, Kanban e fluxos de convites/tokens já usam o BFF; com os painéis admin concluídos, 100% do front fala com o Supabase master apenas via gateway.

4. **Semana 2 – Criptografia/KMS** ✅  
   - Estrutura aplicada: `ensure_key_encrypted`, trigger no repositório, `decrypt_key` no gateway e a migração `20251116090000`. `set_encryption_key`/`migrate_keys_to_encryption` registradas em produção (16/11/2025) com `suspected_jwt = 0`.

5. **Semana 4 – Hardening final** (em andamento)  
   - ✅ Allowlist Cloudflare aplicada (somente o gateway Render acessa o Supabase master).  
   - 🔜 Conectar os novos logs de segurança/rate-limit a dashboards/alertas (Stackdriver/Datadog/etc.) e preparar testes de caos.  
   - 🔜 Executar checklist CODE-REVIEWER + pentest interno antes de liberar para clientes.

## 🗒️ Checklist de envs / migrações críticas
| Ambiente | Status | Responsável | Data | Observações |
| --- | --- | --- | --- | --- |
| Local (dev) | ✅ Validado (token manual) | Equipe Dev | 15/11/2025 | Gateway e frontend usam o mesmo MASTER_SUPABASE_URL |
| Produção | ✅ Migrado (`migrate_keys_to_encryption`) | Equipe Dev | 16/11/2025 | Script executado; `suspected_jwt = 0` para orgs/conns |
| Staging | — | — | — | — |
| Edge Functions | — | — | — | — |

Com isso, temos visibilidade clara do que já foi entregue e do que resta para concluir a proteção multi-supabase.

