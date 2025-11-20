# Master x Client Supabase — Guia

## Visão
- **Master Supabase**: autenticação SaaS, planos/assinaturas (Stripe), armazenamento seguro das credenciais do Client (hoje Base64; roadmap KMS/Secrets), RPC utilitárias.
- **Client Supabase**: dados da organização do cliente (CRM/Agenda/Financeiro). Multi-tenant por `organization_id` + RLS.

## Fluxos
1. **Sign up/login (Master)** → cria usuário em `auth.users` (Master) e linha em `saas_users`.
2. **Conectar Client** → usuário fornece `supabase_url` + `anon_key` → `supabaseManager` valida, testa, salva no Master (`saas_users.supabase_url` + `supabase_key_encrypted`).
3. **Selecionar organização** → define `organization_id` ativo; inicializa dados padrão (estágios, serviços) se necessário.
4. **Uso diário** → front chama Client via `supabaseManager.getClientSupabase()`; queries com filtro `organization_id`.
5. **Billing** → `create-checkout-session` (Edge) → Stripe → `stripe-webhook` atualiza `saas_subscriptions`/`saas_users`.

## Tabelas
- Master: `saas_users`, `saas_organizations`, `saas_plans`, `saas_subscriptions`.
- Client: `crm_leads`, `crm_stages`, `appointments`, `clients`, `collaborators`, `entradas`, `saidas`, `produtos_servicos`, `notifications`, `user_preferences`.

## Regras e boas práticas
- Sempre filtrar por `organization_id` no Client (RLS reforça, mas o front também deve filtrar).
- Nunca expor a `service_role` do Master no front. Edge Functions usam a service role.
- Evitar logs de credenciais/keys. Mascarar em UI.
- Chave do Client hoje em Base64 (btoa/atob). Roadmap: KMS/Secrets + rotação e migração assistida.

## Checklists
- Onboarding
  - [ ] Teste de conexão do Client OK
  - [ ] `setup_completed=true` no `saas_users`
  - [ ] Organização selecionada e `supabaseManager` reconectado
- Segurança
  - [ ] RLS ativa nas tabelas sensíveis do Client
  - [ ] Edge Functions com CORS/headers corretos
- Dados
  - [ ] Estágios do CRM existentes
  - [ ] Serviços padrão criados quando vazio
