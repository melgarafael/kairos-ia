# IA Console v3 - Database Schema Doctrine Audit Report

> **Data:** Dezembro 2025  
> **Auditor:** AI Code Review Team  
> **Escopo:** IA Admin Panel (apps/ia-admin-panel/), Edge Functions relacionadas

---

## Resumo Executivo

A auditoria verificou a conformidade do IA Console v3 com as regras definidas na [Database Schema Doctrine](./database-schema-doctrine.md). O resultado geral é **POSITIVO COM VIOLAÇÕES CRÍTICAS** que precisam de correção imediata.

### Resultado por Regra

| Regra | Status | Observações |
|-------|--------|-------------|
| Regra 1: Uso de `client_org_id` | ✅ **CONFORME** | Usa corretamente `client_org_id` |
| Regra 2: Fonte de credenciais | ✅ **CONFORME** | Prioriza `saas_organizations` |
| Regra 2.1: Validação de Service Role Key | 🔴 **VIOLAÇÃO CRÍTICA** | Falta validação `key.ref === url.ref` |
| Regra 3: Filtros de ownership | ✅ **CONFORME** | Filtros aplicados corretamente |
| Regra 4: Verificação de permissões | ✅ **CONFORME** | Guards e autenticação funcionais |

---

## 🔴 VIOLAÇÕES CRÍTICAS

### V1. DOCTRINE-006: Falta validação de Service Role Key

**Severidade:** 🔴 CRÍTICA  
**Status:** PRECISA CORREÇÃO IMEDIATA  
**Referência:** [Seção 6.4 - Fluxo de Salvamento de Service Role Key](./database-schema-doctrine.md#64-fluxo-de-salvamento-de-service-role-key-crítico)

#### Arquivos afetados:

##### 1. `supabase/functions/admin-analytics/index.ts` - `update_supabase_connection`
**Linhas:** 4854-4891

```typescript
// ❌ VIOLAÇÃO: Salva service_key sem validar se pertence ao projeto
if (serviceKey) {
  updateData.service_role_encrypted = serviceKey  // SEM VALIDAÇÃO!
}
```

**Problema:** Salva a service key diretamente sem verificar se `key.ref === url.ref`.

##### 2. `supabase/functions/admin-analytics/index.ts` - `update_org_supabase_credentials`
**Linhas:** 4893-4933

```typescript
// ❌ VIOLAÇÃO: Criptografa e salva sem validar projeto
if (serviceKey) {
  updateData.client_service_key_encrypted = await encryptKeyWithRpc(supabase, serviceKey)  // SEM VALIDAÇÃO!
}
```

**Problema:** Criptografa e salva sem verificar se a key pertence ao projeto correto.

##### 3. `supabase/functions/saas-orgs/index.ts` - `update_service_role`
**Linhas:** 458-523

```typescript
// ❌ VIOLAÇÃO: Valida formato JWT mas não valida projeto
const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/
if (!jwtRegex.test(service_role_key)) { ... }  // Apenas formato!

// Depois sincroniza para saas_organizations SEM VALIDAR PROJETO
await master
  .from('saas_organizations')
  .update({ client_service_key_encrypted: encrypted, ... })
```

**Problema:** Sincroniza a key para `saas_organizations` sem validar se a key pertence à URL do projeto. Este é exatamente o cenário que causou o bug de novembro/2025!

#### Correção Necessária:

Implementar validação em todas as 3 funções antes de salvar/criptografar:

```typescript
// ✅ CORREÇÃO: Validar ANTES de salvar
function extractProjectRefFromJwt(jwt: string): string | null {
  try {
    const payloadB64 = jwt.split('.')[1]
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))
    return payload?.ref || null
  } catch {
    return null
  }
}

function extractProjectRefFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname
    return hostname.split('.')[0]
  } catch {
    return null
  }
}

// Antes de salvar
const keyRef = extractProjectRefFromJwt(serviceKey)
const urlRef = extractProjectRefFromUrl(supabaseUrl)

if (keyRef && urlRef && keyRef !== urlRef) {
  return new Response(
    JSON.stringify({ 
      ok: false, 
      error: `Key mismatch: Esta key é do projeto "${keyRef}" mas a URL é do projeto "${urlRef}". Use a key correta.` 
    }), 
    { status: 400, headers: getCorsHeaders(req) }
  )
}
```

---

## ✅ Conformidades Identificadas

### C1. Uso correto de `client_org_id`

**Arquivo:** `apps/ia-admin-panel/apps/ia-admin-panel/prompt-creator-api/src/lib/supabase.ts`

```typescript
// ✅ CORRETO - Busca usando AMBOS os IDs
.or(`id.eq.${organizationId},client_org_id.eq.${organizationId}`)

// ✅ CORRETO - Usa client_org_id para o Client Supabase
const clientOrgId = orgData.client_org_id || organizationId
```

### C2. Credenciais lidas de `saas_organizations` (fonte primária)

**Arquivo:** `apps/ia-admin-panel/apps/ia-admin-panel/prompt-creator-api/src/lib/supabase.ts`

```typescript
// ✅ CORRETO - Prioriza saas_organizations conforme doutrina
// STEP 1: Try saas_organizations (primary source)
const { data: byId } = await supabase
  .from('saas_organizations')
  .select('id, client_supabase_url, client_service_key_encrypted, client_org_id')
  .eq('id', organizationId)
  .maybeSingle()
```

### C3. Filtros de ownership aplicados corretamente

**Arquivo:** `apps/ia-admin-panel/app/api/admin/status/route.ts`

```typescript
// ✅ CORRETO - Filtra por owner_id
const { data: recentConnections } = await supabase
  .from('saas_supabases_connections')
  .select(`id, owner_id, supabase_url, ...`)
```

### C4. Não há acesso a campos deprecados de saas_users

A busca por padrões como `saas_users.supabase_url`, `saas_users.supabase_key`, `saas_users.service_role` **não retornou resultados** no ia-admin-panel.

✅ **CONFORME** - O código não usa campos deprecados.

### C5. Guards de autenticação implementados

**Arquivo:** `apps/ia-admin-panel/lib/auth/guards.ts`

```typescript
// ✅ CORRETO - Verifica role antes de permitir acesso
const ALLOWED_ROLES = new Set(["staff", "founder", "admin"]);

export async function requireStaffSession(options: GuardOptions = {}) {
  const session = await getSession();
  // Valida role...
  if (role && ALLOWED_ROLES.has(role)) {
    return session;
  }
  redirect("/login?reason=not_authorized");
}
```

### C6. Chamadas centralizadas via `callAdminAnalytics`

**Arquivo:** `apps/ia-admin-panel/app/api/ia-console-v3/stream/route.ts`

```typescript
// ✅ CORRETO - Centraliza todas as chamadas ao backend
async function callAdminAnalytics(
  action: string,
  params: Record<string, unknown> = {},
  method: 'GET' | 'POST' = 'GET'
): Promise<unknown> {
  // Implementação segura com autenticação
}
```

---

## Correção Recente Aplicada

### Bug Corrigido: `owner_user_id` vs `user_id`

Durante esta auditoria, foi identificado e corrigido um bug onde o handler MCP enviava `owner_user_id` mas o backend esperava `user_id`:

**Arquivos corrigidos:**
- `apps/ia-admin-panel/app/api/ia-console-v3/stream/route.ts`
- `apps/ia-admin-panel/app/api/mcp-admin/route.ts`
- `apps/ia-admin-panel/lib/ai/admin-mcp-tools.ts`

**Melhoria adicional:** A ferramenta `admin_issue_tokens` agora aceita tanto `user_id` quanto `email` como parâmetro.

---

## Checklist de Ações Pendentes

### Ações Críticas (Fazer Imediatamente)

- [ ] **V1.1**: Adicionar validação `key.ref === url.ref` em `admin-analytics/update_supabase_connection`
- [ ] **V1.2**: Adicionar validação `key.ref === url.ref` em `admin-analytics/update_org_supabase_credentials`
- [ ] **V1.3**: Adicionar validação `key.ref === url.ref` em `saas-orgs/update_service_role`

### Ações de Melhoria (Próximo Sprint)

- [ ] Criar helper centralizado `validateKeyBelongsToProject()` reutilizável
- [ ] Adicionar logging de tentativas de salvamento com mismatch (auditoria)
- [ ] Incluir mensagem de erro clara para o usuário: "Esta key é do projeto X, mas você está no projeto Y"

---

## Comparação com Auditoria Anterior

| Área | Auditoria Nov/2025 | Auditoria Dez/2025 | Status |
|------|-------------------|-------------------|--------|
| Uso de `client_org_id` | ⚠️ Warning (W1) | ✅ Resolvido | Melhorado |
| Validação DOCTRINE-006 | N/A (Nova regra) | 🔴 Violação | Precisa correção |
| Fonte de credenciais | ✅ Conforme | ✅ Conforme | Mantido |
| Ownership filters | ✅ Conforme | ✅ Conforme | Mantido |

---

## Conclusão

O IA Console v3 está **majoritariamente em conformidade** com a Database Schema Doctrine, porém há **violações críticas da DOCTRINE-006** (validação de Service Role Key) que devem ser corrigidas imediatamente para evitar o bug de keys misturadas que ocorreu em novembro/2025.

**Prioridade 1 - Crítico:**
1. 🔴 Implementar validação `key.ref === url.ref` nas 3 funções identificadas

**Prioridade 2 - Melhoria:**
1. ⚠️ Centralizar lógica de validação em helper reutilizável
2. ⚠️ Adicionar logging de auditoria

---

**Mantido por:** Engineering Team  
**Classificação:** Relatório de Auditoria — Documento de referência para correções

