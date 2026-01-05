## Kairos IA Migration – Discovery Notes

### Current architecture (Tomik base)
- Next.js App Router in `app/` with `(admin)` and `(marketing)` segments; middleware protects `/admin` and `/api/ai/**`.
- Auth via Supabase SSR helpers; `requireStaffSession` enforces roles `staff|founder|admin`.
- Sidebar/nav defined in `components/layout/sidebar.tsx` with feature flags for IA consoles (v2, v3, vendas, memberkit) and links to `status`, `audit`, `security`.
- Dashboard copy and login page branded as TomikOS; pillars point to status, chat, security.
- AI/MCP: prompts in `lib/prompts/*`, main `getAgentPrompt` reads `docs/agentes-mcp/AGENTE-GESTÃO-USER.md`; admin agent v3 prompt hardcodes TomikOS context; MCP invocation via `lib/ai/mcp.ts` to Supabase edge function.
- Supabase config in `lib/supabase/config.ts` reads generic `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` plus `SUPABASE_SERVICE_ROLE_KEY`.
- Observability: audit routes (`app/api/admin/mcp-audit`, `app/(admin)/audit`) and components in `components/audit/*`.
- IA consoles routes under `app/(admin)/ia-console/*` and `app/(admin)/chat`.

### Coupling/rename hot spots
- Brand strings: “TomikOS”, “Command Center”, “Agente Admin”, pillars copy, sidebar labels (IA TomikOS, etc.), login metadata title.
- Role guard: `requireStaffSession` and middleware restrict to staff-like roles; needs relaxing to general Kairos users while keeping auth.
- Feature flags: `NEXT_PUBLIC_FEATURE_IA_CONSOLE_*` gate consoles; decide default visibility for Kairos.
- MCP endpoint/key: `lib/ai/mcp.ts` uses existing Supabase function and `ADMIN_ANALYTICS_SECRET`; needs Kairos endpoint/keys.
- Prompt content: `lib/prompts/admin-agent-v3.ts` and shared `agent.ts` reference Tomik OS and admin tooling.

### Data gaps for Kairos
- No tables for human_design_profiles, daily_logs, ai_memories, ai_sessions.
- No HD client/integration layer; no HD-specific UI components.
- No Kairos-specific env template (.env.example missing).

### Planned Kairos additions (from brief)
- New branding and navigation for personal Kairos IA.
- Supabase env names scoped to Kairos.
- Schema with RLS per user for HD data, daily logs, AI memories; optional sessions and HD library seed.
- New pages: dashboard (`/app` or similar), design view/editor (`/meu-design`), diary (`/diario`), chat (`/ia`) reusing console infra.
- AI mentor prompt specialized in Human Design with memory loop writing to `ai_memories`.
- MCP/API stub for Human Design (bodygraph.com docs) with fetch/refresh endpoints and HD client.

### Risks/notes
- Relaxing staff-only guard must keep session protection; ensure legacy admin routes remain usable.
- MCP endpoint/keys need separation from Tomik project; keep placeholders until real infra exists.
- Keep existing consoles accessible but rebranded to avoid breaking workflows while Kairos pages ship.

