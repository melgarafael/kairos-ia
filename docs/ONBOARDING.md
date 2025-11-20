# Onboarding técnico — TomikCRM

## Requisitos
- Node 18+
- Conta Supabase (projeto Master + projeto Client para testes)
- Chaves Stripe (teste) e OpenAI para Edge Functions

## Setup local
1. Clone e instale deps: `npm i`
2. Crie `.env` (use `.env.example` se existir):
```
VITE_MASTER_SUPABASE_URL=
VITE_MASTER_SUPABASE_ANON_KEY=
VITE_MASTER_SUPABASE_SERVICE_KEY=
VITE_SUPABASE_EDGE_URL=
```
3. Rode: `npm run dev`
4. Abra `http://localhost:5173`

## Edge Functions (prod/preview)
- Deploy via Supabase CLI (fora do escopo local). Garantir envs no projeto Supabase:
  - `OPENAI_API_KEY`, `MASTER_SUPABASE_URL`, `MASTER_SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CORS_ORIGINS`.

## Fluxos para validar
- Signup (Master) → Login → Conectar Client (URL/anon) → Selecionar organização.
- CRM: criar/mover lead; converter lead em cliente; export CSV.
- Agenda: criar agendamento (sem conflito) e atualizar status.
- Financeiro: criar entradas/saídas; ver KPIs e fluxo de caixa.
- Automação: criar webhook e testar; importar um template n8n e executar.
- Assistente: listar dados (read-only) e navegar por abas.

## Troubleshooting
- Conexão Client falha: ver console de `supabaseManager` (formatos de URL/JWT), RLS e CORS.
- Stripe webhook: conferir secrets e logs da function.
- Assistente: checar CORS, envs e tabelas permitidas em `assistant-chat-tools`.
