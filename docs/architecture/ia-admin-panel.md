# IA Admin Panel – Arquitetura e Segurança

## 1. Visão Geral
- **Stack**: Next.js 15 (App Router) + React 19 + TypeScript estrito.
- **Pastas**:
  - `apps/ia-admin-panel/` – aplicação web.
  - `supabase/functions/mcp-server/` – Edge Function com tools MCP.
  - `docs/architecture/ia-admin-panel.md` – referência viva do fluxo.
- **Módulos principais**:
  1. **Auth Gateway** – login Supabase + guarda de rota `/admin`.
  2. **Command Center** – dashboard com métricas e atalhos.
  3. **AI Command Console** – chat GPT/Claude-style com Responses API + MCP tools.

## 2. Fluxo de Autenticação
1. UI apresenta formulário minimalista (email + senha, com link magic opcional).
2. Submit chama `app/(marketing)/login/actions.ts`:
   - Usa `createServerClient` (`@supabase/ssr`) com `SUPABASE_URL` + `SUPABASE_ANON_KEY`.
   - `signInWithPassword` (ou `resendPasswordless`) → tokens persistidos via cookies.
3. Layout protegido (`app/(admin)/layout.tsx`) verifica sessão com `getServerSession()`:
   - Se ausente, redireciona para `/login`.
   - Se presente, busca `user_metadata.roles`.
4. Middleware em `middleware.ts` bloqueia acesso a `/admin` para usuários sem `role === 'staff'`.
5. Refresh tokens e logout tratados via `api/auth/logout/route.ts`.

## 3. Chat IA + MCP
```
Client (Chat UI) ──POST /api/ai/command ─► Server Action
                                   │
                                   ├─ call OpenAI Responses API (gpt-5.1)
                                   │    - JSON mode + tool_choice="auto"
                                   │
                                   └─ tool call ► MCP HTTP endpoint
                                         (Supabase Edge Function mcp-server/index.ts)
```
- **Server Action** (`app/api/ai/command/route.ts`):
  - Recebe histórico (mensagens e tool_outputs), limita a 50.
  - Injeta `systemPrompt` com conteúdo de `docs/agentes-mcp/AGENTE-GESTÃO-USER.md`.
  - Passa `tools` com definição `mcp_admin_bridge` (bridge HTTP).
  - Processa streaming SSE → envia chunks para UI via `ReadableStream`.
  - Registra auditoria em `supabase.from('admin_ai_audit')`.
- **MCP Bridge**:
  - Tool call dispara `POST` para `supabaseUrl/functions/v1/mcp-server`.
  - Propaga headers `Authorization: Bearer serviceRole`.
  - Respostas convertidas em `tool_result`.
  - Erros são encapsulados em mensagens amigáveis, preservando logs.

## 4. Segurança
- Todas as variáveis sensíveis em `.env.local` + `supabase/.env`.
- Chat só opera para usuários autenticados com `role in ('staff','founder')`.
- Rate limit `POST /api/ai/command` (5 req/min) usando `@upstash/ratelimit`.
- Logs de tool-calls armazenados com `user_id`, `organization_id`, `timestamp`.
- CORS fechado para domínios internos; deployment via Vercel com proteção de IP (opcional).

## 5. UI Jobsiana
- Diretrizes `docs/marketing/MANUAL-*` + `docs/apoio/IDENTIDADE_VISUAL.md`.
- Layout:
  - **Login**: fundo dark suave, card central com copy “Hoje reinventamos o suporte”.
  - **Dashboard**: regra de 3 cards (Status, Quick Actions, Intelligence).
  - **Chat**: colunas com bolhas em cartões translúcidos, Inter font, motion 180ms.
- Estados obrigatórios: vazio (apresenta frase icônica), erro (linguagem humana), sucesso (CTA pro próximo passo).

## 6. Deploy & Observabilidade
- **Build**: `npm run lint && npm run test && npm run build`.
- **Telemetry**: PostHog + Supabase logs para tool calls.
- **Checklist Jobsiano**: script `pnpm run checklist` valida estados, copy e acessibilidade básica.


