# Database Schema Doctrine Audit Report

> **Data:** Novembro 2025  
> **Auditor:** AI Code Review Team  
> **Escopo:** Frontend (src/), Backend (apps/tenant-gateway/), Edge Functions (supabase/functions/)

---

## Resumo Executivo

A auditoria verificou a conformidade do código com as 4 regras absolutas definidas na [Database Schema Doctrine](./database-schema-doctrine.md). O resultado geral é **POSITIVO** com algumas **áreas de atenção** que precisam de correção.

### Resultado por Regra

| Regra | Status | Observações |
|-------|--------|-------------|
| Regra 1: Uso de `client_org_id` | ⚠️ **ATENÇÃO** | Potencial uso ambíguo em alguns hooks |
| Regra 2: Fonte de credenciais | ✅ **CONFORME** | Backend usa `saas_organizations` corretamente |
| Regra 3: Filtros de ownership | ✅ **CONFORME** | Queries filtram por `owner_id`/`owner_user_id` |
| Regra 4: Verificação de permissões | ✅ **CONFORME** | Sistema de membership bem implementado |

---

## Violações Identificadas

### CRÍTICO: Nenhuma violação crítica encontrada

O código não apresenta violações críticas que exponham dados de uma organização para outra.

---

### WARNING: Áreas de Atenção

#### W1. Uso ambíguo de `user.organization_id` no hook `useOrganization.ts`

**Arquivo:** `src/hooks/useOrganization.ts`  
**Linhas:** 36-40

```typescript
// ⚠️ ATENÇÃO: user.organization_id pode conter o ID do Master OU do Client
const { data, error } = await supabase
  .from('saas_organizations')
  .select('*')
  .eq('id', user.organization_id)  // Potencialmente ambíguo
  .single()
```

**Problema:** O `user.organization_id` do `saas_users` pode conter tanto o `saas_organizations.id` (Master) quanto o `client_org_id` (Client), dependendo do fluxo de criação. Embora o código funcione porque a query é feita no Client Supabase onde a tabela `saas_organizations` usa o `client_org_id` como ID, isso cria dependência de comportamento implícito.

**Recomendação:** Usar explicitamente `client_org_id` quando disponível:

```typescript
// ✅ CORRETO - Mais explícito
const effectiveOrgId = (user.organization as any)?.client_org_id || user.organization_id
const { data, error } = await supabase
  .from('saas_organizations')
  .select('*')
  .eq('id', effectiveOrgId)
  .single()
```

---

#### W2. Referência a `user?.supabase_url` em dependência de useEffect

**Arquivo:** `src/components/features/Auth/SwitchSupabaseModal.tsx`  
**Linha:** 87

```typescript
}, [isOpen, user?.supabase_url, refetchConnections, tenantConnections])
```

**Problema:** O comentário no código (linha 36-38) diz para não usar `supabase_url` de `saas_users`, mas a dependência do `useEffect` ainda referencia `user?.supabase_url`. Isso é inconsistente e pode causar re-renders desnecessários.

**Recomendação:** Remover a dependência:

```typescript
}, [isOpen, refetchConnections, tenantConnections])
```

---

#### W3. Query a `saas_users` no Client Supabase em `useOrganization.ts`

**Arquivo:** `src/hooks/useOrganization.ts`  
**Linhas:** 197-201

```typescript
const [
  { count: usersCount }
] = await Promise.all([
  supabase
    .from('saas_users')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organization.id)
])
```

**Problema:** A query é feita no Client Supabase, mas `saas_users` é uma tabela do Master. Isso sugere que ou:
1. A query nunca é executada (código morto), ou
2. Existe uma tabela `saas_users` duplicada no Client (anti-pattern)

**Recomendação:** Remover ou corrigir para usar o Master Supabase se necessário.

---

## Conformidades Identificadas

### C1. Tenant Gateway - Uso correto de `client_org_id`

O backend em `apps/tenant-gateway/src/` segue a doutrina corretamente:

**Arquivo:** `apps/tenant-gateway/src/services/supabase.ts`

```typescript
// ✅ CORRETO - Busca usando OR para suportar ambos os IDs
.or(`id.eq.${orgId},client_org_id.eq.${orgId}`)

// ✅ CORRETO - Retorna clientOrgId para uso no Client
clientOrgId: orgRow.client_org_id || orgRow.id
```

---

### C2. Ownership corretamente verificado

**Arquivo:** `apps/tenant-gateway/src/routes/org-admin.ts`

```typescript
// ✅ CORRETO - Verifica ownership antes de operações
async function ensureOrgOwnership(supabase, userId: string, orgId: string) {
  const { data: orgRow } = await supabase
    .from('saas_organizations')
    .select('id, owner_id, client_org_id')
    .or(`id.eq.${orgId},client_org_id.eq.${orgId}`)
    .maybeSingle()

  if (!orgRow || orgRow.owner_id !== userId) {
    throw new Error('NOT_ALLOWED')
  }
  // ...
}
```

---

### C3. Credenciais lidas de `saas_organizations` (não de `saas_users`)

**Arquivo:** `apps/tenant-gateway/src/routes/users.ts`

```typescript
// ✅ CORRETO - Prioriza credenciais de saas_organizations (§2.11 da doutrina)
if (userData.organization_id) {
  const { data: org } = await supabase
    .from('saas_organizations')
    .select('client_supabase_url, client_anon_key_encrypted, client_service_key_encrypted')
    .or(`client_org_id.eq.${userData.organization_id},id.eq.${userData.organization_id}`)
    .maybeSingle()
  
  orgData = org
}

// Merge: saas_organizations takes priority
const mergedSupabaseUrl = orgData?.client_supabase_url || userData.supabase_url || null
```

---

### C4. Sistema de permissões bem implementado

**Arquivo:** `src/hooks/useMemberPermissions.ts`

O hook implementa corretamente:
- Fast-path para owners (evita latência)
- Cache de permissões com TTL
- Verificação de membership antes de permitir ações
- Funções `canView()` e `canAction()` que bloqueiam por padrão até carregar permissões

---

### C5. Edge Functions usam `client_org_id` corretamente

**Arquivo:** `supabase/functions/tenant-mcp/index.ts`

```typescript
// ✅ CORRETO - Usa client_org_id para queries no Client Supabase
const clientOrgId = orgData.client_org_id || organizationIdParam

const context: TenantContext = {
  tenantClient,
  organizationId: clientOrgId,  // Passa o ID correto do Client
  supabaseUrl: orgData.client_supabase_url
}
```

---

## Recomendações de Melhoria

### 1. Padronizar acesso ao `organization_id`

Criar um helper centralizado para resolver o ID correto da organização:

```typescript
// src/lib/organization-resolver.ts
export function getClientOrganizationId(user: SaasUser): string | null {
  return (user.organization as any)?.client_org_id || user.organization_id || null
}
```

### 2. Adicionar type safety para `client_org_id`

Atualizar o tipo `SaasUser` para incluir `client_org_id`:

```typescript
// src/types/saas.ts
interface SaasOrganization {
  id: string
  name: string
  slug: string | null
  owner_id: string | null
  client_org_id: string | null  // Adicionar tipagem explícita
  // ...
}
```

### 3. Deprecar campos legados

Considerar uma migration para remover completamente os campos deprecados de `saas_users`:
- `supabase_url`
- `supabase_key_encrypted`
- `service_role_encrypted`

---

## Conclusão

O código do Tomik CRM está **majoritariamente em conformidade** com a Database Schema Doctrine. As violações encontradas são de baixa severidade e relacionadas a código potencialmente não executado ou dependências de useEffect incorretas.

**Ações recomendadas:**
1. ⚠️ Corrigir o warning W1 em `useOrganization.ts`
2. ⚠️ Corrigir o warning W2 em `SwitchSupabaseModal.tsx`
3. ⚠️ Investigar e remover o código morto em W3

**Próximos passos:**
1. Criar tasks no backlog para as correções identificadas
2. Adicionar testes automatizados para validar conformidade com a doutrina
3. Incluir validação de doutrina no processo de code review

---

**Mantido por:** Engineering Team  
**Classificação:** Relatório de Auditoria — Documento de referência para correções

