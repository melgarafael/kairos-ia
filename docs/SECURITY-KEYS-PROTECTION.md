# 🛡️ Proteção de Chaves Sensíveis do Supabase

## Problema Identificado

As chaves do Supabase master (incluindo `client_service_key_encrypted` e `client_anon_key_encrypted`) estavam sendo expostas diretamente no navegador através de queries RLS do frontend. Qualquer usuário autenticado podia ver essas chaves no DevTools do navegador.

## Solução Implementada

### 1. Migração SQL de Segurança (`20250115000000_block_sensitive_keys_exposure.sql`)

- **View Segura**: Criada `saas_organizations_safe` que nunca expõe chaves sensíveis
- **RLS Restritivo**: Políticas RLS atualizadas para bloquear acesso direto aos campos de chaves
- **Funções Seguras**: 
  - `get_organizations_safe()`: Retorna organizações sem expor chaves
  - `get_organization_credentials()`: Função interna para uso apenas via Edge Function

### 2. Edge Function Atualizada (`saas-orgs`)

- **Ação `list`**: Lista organizações sem expor chaves sensíveis
- **Ação `get_credentials`**: Obtém credenciais de forma segura (requer ownership)

### 3. API Helper Segura (`src/lib/saas-orgs-api.ts`)

- `listOrganizationsSafe()`: Lista organizações sem expor chaves
- `getOrganizationCredentials()`: Obtém credenciais (apenas para uso interno)

### 4. Frontend Atualizado

Componentes atualizados para usar Edge Function ao invés de queries diretas:
- `SupabasesManager.tsx`
- `SupabaseAutoUpdater.tsx`
- `App.tsx`

## Como Usar

### Listar Organizações (Frontend)

```typescript
import { listOrganizationsSafe } from '@/lib/saas-orgs-api'

const orgs = await listOrganizationsSafe()
// Retorna organizações SEM campos de chaves sensíveis
```

### Obter Credenciais (Apenas Backend/Edge Functions)

```typescript
import { getOrganizationCredentials } from '@/lib/saas-orgs-api'

// ⚠️ ATENÇÃO: Esta função retorna chaves criptografadas (base64)
// Use APENAS no backend ou Edge Functions
const creds = await getOrganizationCredentials(organizationId)
```

## Segurança

### ✅ O que está protegido:

1. **RLS Policies**: Bloqueiam acesso direto aos campos de chaves
2. **View Segura**: `saas_organizations_safe` nunca expõe chaves
3. **Edge Function**: Intermedia todas as requisições sensíveis
4. **Frontend**: Usa apenas APIs seguras

### ⚠️ Importante:

- **NUNCA** faça queries diretas do frontend para `saas_organizations` incluindo campos de chaves
- **SEMPRE** use a Edge Function `saas-orgs` para operações sensíveis
- Chaves retornadas pela Edge Function são base64, mas ainda devem ser tratadas como sensíveis
- Service Role keys devem ser usadas APENAS no backend/Edge Functions

## Migração

Para aplicar a proteção:

1. Execute a migração SQL: `supabase/migrations/20250115000000_block_sensitive_keys_exposure.sql`
2. Deploy da Edge Function atualizada: `supabase/functions/saas-orgs`
3. Frontend já está atualizado para usar as APIs seguras

## Verificação

Para verificar se as chaves não estão sendo expostas:

1. Abra o DevTools do navegador
2. Vá para a aba "Network"
3. Filtre por "saas_organizations"
4. Verifique que as respostas NÃO contêm `client_service_key_encrypted` ou `client_anon_key_encrypted`

## Rollback (se necessário)

Se precisar reverter temporariamente:

```sql
-- Remover política restritiva (NÃO RECOMENDADO)
DROP POLICY IF EXISTS "Block sensitive keys access" ON public.saas_organizations;

-- Recriar política permissiva (NÃO RECOMENDADO)
CREATE POLICY "Users can view own organization" ON saas_organizations
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());
```

**⚠️ AVISO**: Rollback expõe chaves novamente. Use apenas em emergências e corrija imediatamente.

