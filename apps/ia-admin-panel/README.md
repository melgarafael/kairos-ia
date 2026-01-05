# Kairos IA Panel

Painel pessoal de Human Design com Supabase + OpenAI. Fluxos: cadastro de design, diário, mentora IA e memórias.

## Stack
- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind (tokens em `app/globals.css`)
- Supabase Auth/DB (`@supabase/ssr`)
- OpenAI Chat Completions (mentora Kairos)

## Scripts
```bash
pnpm install
pnpm dev                     # Porta 4321
pnpm --filter ia-admin-panel build
pnpm --filter ia-admin-panel lint
pnpm --filter ia-admin-panel test
```

## Rotas principais
- `/app` — dashboard com resumo do design, memórias e check-ins.
- `/meu-design` — formulário para registrar/editar Human Design + placeholder de bodygraph.
- `/diario` — check-ins diários usados como contexto.
- `/ia` — chat com a mentora Kairos (usa HD + memórias).
- Legado: consoles em `/ia-console/*` (mantidos sob flags).

## Variáveis de ambiente
Veja `apps/ia-admin-panel/.env.example` (Supabase Kairos, OpenAI, Posthog, flags das consoles).

## Supabase (novo projeto)
Tabelas/RLS criadas em `supabase/migrations/20251206120000_kairos_schema.sql`:
- `profiles` — prefs do usuário.
- `human_design_profiles` — dados normalizados + `raw_data`.
- `daily_logs` — check-ins.
- `ai_memories` — memórias sintéticas.
- `ai_sessions` / `ai_messages` — histórico de chat.
- `hd_library_entries` — placeholder para conteúdo HD.
RLS: usuário só enxerga os próprios registros; `service_role` tem acesso total.

## IA
- Prompt em `lib/prompts/kairos-mentor.ts`.
- Endpoint: `app/api/ai/command/route.ts` (usa HD + memórias + diários para contexto).
- Memórias gravadas em `ai_memories` a cada resposta.

## Integração Human Design (stub)
- Cliente mock: `lib/hd-client`.
- Endpoints: `POST /api/human-design/fetch` e `/refresh` salvam o payload mock em `human_design_profiles`.
- Substituir pelo MCP/API real quando disponível.

