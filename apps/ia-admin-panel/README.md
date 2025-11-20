# TomikOS IA Admin Panel

Painel interno Jobsiano com login Supabase + IA (OpenAI Responses API + MCP).

## Stack
- Next.js 15 (App Router) + React 19 + TypeScript estrito
- Tailwind CSS + design tokens (`app/globals.css`)
- Supabase Auth (`@supabase/ssr` + middleware guard)
- OpenAI Responses API (`app/api/ai/command/route.ts`)
- MCP Edge Function (`supabase/functions/mcp-server/index.ts`)
- Audit logs (`lib/observability/audit.ts`)

## Scripts
```bash
pnpm install
pnpm dev                     # Porta 4321
pnpm --filter ia-admin-panel build
pnpm --filter ia-admin-panel lint
pnpm --filter ia-admin-panel test
```

## Env
Veja `apps/ia-admin-panel/env.example`.

## Fluxos
1. Login (`/login`) → Supabase session guard.
2. Dashboard (`/admin`) → visão Jobsiana dos pilares.
3. IA Console (`/admin/chat`) → GPT-5.1 mini + MCP (tool `call_mcp_tool`).
4. Auditoria (`/admin/security`) + logs automáticos.

