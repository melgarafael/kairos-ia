# 🛡️ Blueprint: Tenant Gateway & Multi-Supabase Hardening

> “Pensar modular, agir incremental, codificar coerente, documentar consciente.” — Tomik Coding Doctrine

---

## 🎯 Objetivo

Blindar o ecossistema multi-Supabase contra exfiltração de dados e chaves sensíveis, introduzindo uma camada Tenant Gateway (BFF) que isola o frontend dos serviços master/client, reforçando criptografia e observabilidade ponta-a-ponta.

**Critérios de sucesso**
- Nenhuma chamada do frontend toca diretamente o Supabase master.
- URLs/chaves de clientes jamais aparecem no bundle ou nas DevTools.
- RLS garante que um usuário só enxerga sua própria organização, mesmo via PostgREST.
- Tentativas de listar todas as organizações ou descriptografar chaves são bloqueadas e auditadas.

---

## 🧱 Escopo & Limites

| Área | Inclusões | Exclusões (por enquanto) |
| --- | --- | --- |
| Backend / BFF | Tenant Gateway (Node/Nest ou Fastify), endpoints `/api/v2/**`, proxy supabase-js | Refatoração completa para NestJS monolito |
| Infra / DevOps | AWS/GCP Secrets Manager, KMS envelope encryption, CI secrets scan, WAF rules | Migração total de infraestrutura (Kubernetes) |
| Banco / Supabase | Novas RLS policies, storage cifrado, rotação de keys | Mudança de provedor de banco |
| Frontend | Hooks para BFF, remoção de acesso direto ao master, storage isolado | Redesign visual amplo |

---

## 🏗️ Arquitetura Alvo

```
Browser (React)
    │ fetch /api/v2/*
    ▼
Tenant Gateway (BFF)
    │ 1. Auth (Supabase master JWT / session)
    │ 2. RBAC + org ownership
    │ 3. Service orchestration
    │
    ├── Supabase Master (service role via KMS decrypt)
    ├── Supabase Client Proxy (per org, short-lived JWT)
    ├── Edge Functions restritas
    └── Audit/Telemetry (Datadog/Loki)
```

### Componentes
1. **Tenant Gateway API**
   - Stack sugerida: Fastify + Node 20 + Zod schemas + Supabase Admin SDK.
   - Exposição via `/api/v2/*` com contrato OpenAPI.
   - Responsável por emitir tokens temporários (`supabase-js` custom) usando `signJWT`.
2. **Secrets & Crypto**
   - Envelope encryption (AWS KMS): Service Role armazenada como `ciphertext_blob`.
   - Secrets pipeline no CI valida ausência em bundle.
3. **Proxy / Edge**
   - Edge `client-row` passa a aceitar apenas tokens emitidos pelo Gateway.
   - PostgREST requests exigem header `x-organization-context` assinado.
4. **Observabilidade**
   - Audit log `audit_security_events` com: user_id, org_id, recurso, filtros, device.
   - Alarmes em Datadog para consultas “sem filtro”.

---

## 📅 Roadmap por Semana

| Semana | Owner (agent) | Entregas |
| --- | --- | --- |
| **Semana 0** | @BACKEND-ARCHEITECT + @DEVOPS-ENGINEER | Este blueprint, diagrama arquitetura, spike do Tenant Gateway (mock endpoints, contract-first OpenAPI), definição de secrets (KMS, AWS creds). |
| **Semana 1** | @BACKEND-ARCHEITECT + @DEVOPS-ENGINEER | Implementar BFF base (`apps/tenant-gateway`), integração com Supabase master usando service role via KMS, pipeline de secrets (ci workflow + gitleaks/trivy), endpoint `/api/v2/organizations/:id` com filtros rígidos, testes unit. |
| **Semana 2** | @DATABASE-ARCHITECT + @DEVOPS-ENGINEER | RLS policies completas (já iniciado), migração/rotacao de chaves para formato cifrado (KMS + supabase functions), testes de segurança (SQL, Postman). |
| **Semana 3** | @FRONT-END-DEVELOPER + @FULLSTACK-DEVELOPER | Encapsular `supabase-js` em hook que usa proxy/BFF, migrar telas (SupabasesManager, OrganizationsDropdown, OrganizationSetup) para consumir API nova, remover exposições `VITE_MASTER_SUPABASE_URL`. |
| **Semana 4** | @DEVOPS-ENGINEER + @CODE-REVIEWER | Hardening final: WAF rules, dashboards (Grafana/Datadog), chaos tests (rota que tenta tirar filtros), checklist CODE-REVIEWER + pentest interno (scripts). |
| **Go/No-Go** | @CODE-REVIEWER | Validar blocking issues, revisar testes, assinar release note. |

---

## 🔌 APIs Planejadas (Tenant Gateway)

| Endpoint | Método | Descrição | Autz |
| --- | --- | --- | --- |
| `/api/v2/organizations` | GET | Lista orgs do usuário (owner ou membership) | JWT master |
| `/api/v2/organizations/:orgId/connections` | GET/POST/DELETE | CRUD das conexões Supabase | Owner |
| `/api/v2/organizations/:orgId/token` | POST | Gera JWT curto p/ supabase-js (scoped) | Owner/Membro com permissão |
| `/api/v2/organizations/:orgId/diagnostics` | GET | Status + health checks | Owner/Admin |
| `/api/v2/audit/events` | POST (internal) | Persistir auditoria | Gateway |

Todos os endpoints retornam apenas IDs/aliases; URLs reais ficam armazenadas e usadas server-side.

---

## 🧪 Plano de Testes

- **Contratos**: OpenAPI + tests com `vitest/supertest`.
- **Segurança**: try `GET /api/v2/organizations?select=*` sem filtro → 403, tentativas repetidas geram evento `SECURITY_FILTER_REMOVED`.
- **RLS**: script `psql` que simula `set role authenticated; select * from saas_organizations;` deve retornar vazio se não houver ownership.
- **Frontend**: Playwright script garante que DevTools não mostra `*.supabase.co`.

---

## ⚠️ Riscos & Mitigações

| Risco | Prob. | Impacto | Mitigação |
| --- | --- | --- | --- |
| Latência extra via BFF | M | M | Cache + keep-alive + medir p95 < 200ms |
| KMS indisponível | L | H | Cache local 5 min + fallback (read-only) |
| Fluxos legados usando service role direto | M | H | Flag “legacy_mode” + cutover progressivo + comunicação clientes |
| Quebra de automações (n8n) | M | M | BFF expõe webhook pass-through com whitelist |

---

## ✅ Próximas Ações (Semana 0)

1. Criar repositório/dir `apps/tenant-gateway` com boilerplate Fastify + ESLint.
2. Gerar OpenAPI inicial (`docs/api/tenant-gateway-openapi.yml`).
3. Especificar variáveis de ambiente (`TENANT_GATEWAY_KMS_KEY_ID`, `MASTER_SUPABASE_SERVICE_ROLE_CIPHERTEXT`).
4. Configurar workflow `ci/security.yml` executando `gitleaks` + `trivy config`.

---

## 📎 Referências

- `docs/BLUEPRINT-FIX-GUEST-LEADS-ISSUES.md` (estrutura de blueprint)
- `supabase/functions/saas-orgs` (fluxos atuais a serem descontinuados)
- `src/lib/supabase-manager.ts` (pontos que deixarão de acessar master direto)

---

_Blueprint mantido por Squad Segurança · Atualize sempre que novos aprendizados surgirem._

