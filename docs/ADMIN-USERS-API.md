# API de Gerenciamento de Usuários (admin-users)

Edge Function para gerenciar usuários, organizações e tokens no Master Supabase.

## Base URL

```
https://{seu-projeto}.functions.supabase.co/admin-users
```

## Autenticação

Todas as requisições requerem **Service Role Key** no header:

```
Authorization: Bearer {MASTER_SUPABASE_SERVICE_ROLE_KEY}
apikey: {MASTER_SUPABASE_SERVICE_ROLE_KEY}
```

## Endpoints

### 1. Upsert Organization (Atualizar plano da organização)

**Endpoint:** `POST /admin-users?action=upsert_organization`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {SERVICE_ROLE_KEY}
apikey: {SERVICE_ROLE_KEY}
```

**Body:**
```json
{
  "organization_id": "uuid-da-organizacao",
  "plan_id": "uuid-do-plano"
}
```

**Exemplo:**
```bash
curl -X POST \
  'https://qckjiolragbvvpqvfhrj.functions.supabase.co/admin-users?action=upsert_organization' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer {SERVICE_ROLE_KEY}' \
  -H 'apikey: {SERVICE_ROLE_KEY}' \
  -d '{
    "organization_id": "123e4567-e89b-12d3-a456-426614174000",
    "plan_id": "d4836a79-186f-4905-bfac-77ec52fa1dde"
  }'
```

**Resposta de Sucesso:**
```json
{
  "ok": true,
  "organization": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "plan_id": "d4836a79-186f-4905-bfac-77ec52fa1dde",
    "name": "Nome da Organização",
    "updated_at": "2025-01-30T12:00:00Z"
  }
}
```

**Erros:**
- `400`: organization_id ou plan_id não fornecidos
- `404`: organização ou plano não encontrado

---

### 2. Upsert User (Atualizar account_type e/ou trail_product_ids)

**Endpoint:** `POST /admin-users?action=upsert_user`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {SERVICE_ROLE_KEY}
apikey: {SERVICE_ROLE_KEY}
```

**Body:**
```json
{
  "user_id": "uuid-do-usuario",
  "account_type": "profissional" | "agencia" | "usuario" | "empresa" | "estudante" | null,
  "trail_product_ids": "uuid1,uuid2,uuid3" | null
}
```

**Campos:**
- `user_id` (obrigatório): UUID do usuário
- `account_type` (opcional): Tipo de conta. Valores válidos: `profissional`, `agencia`, `usuario`, `empresa`, `estudante`, ou `null` para remover
- `trail_product_ids` (opcional): Lista de UUIDs separados por vírgula (ex: `"uuid1,uuid2,uuid3"`) ou `null` para remover

**Exemplo 1 - Atualizar account_type:**
```bash
curl -X POST \
  'https://qckjiolragbvvpqvfhrj.functions.supabase.co/admin-users?action=upsert_user' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer {SERVICE_ROLE_KEY}' \
  -H 'apikey: {SERVICE_ROLE_KEY}' \
  -d '{
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "account_type": "profissional"
  }'
```

**Exemplo 2 - Atualizar trail_product_ids:**
```bash
curl -X POST \
  'https://qckjiolragbvvpqvfhrj.functions.supabase.co/admin-users?action=upsert_user' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer {SERVICE_ROLE_KEY}' \
  -H 'apikey: {SERVICE_ROLE_KEY}' \
  -d '{
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "trail_product_ids": "8b5e0e5e-1f9e-4db4-a1b1-1a3b9f63f0e1,outro-uuid-aqui"
  }'
```

**Exemplo 3 - Atualizar ambos:**
```bash
curl -X POST \
  'https://qckjiolragbvvpqvfhrj.functions.supabase.co/admin-users?action=upsert_user' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer {SERVICE_ROLE_KEY}' \
  -H 'apikey: {SERVICE_ROLE_KEY}' \
  -d '{
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "account_type": "agencia",
    "trail_product_ids": "8b5e0e5e-1f9e-4db4-a1b1-1a3b9f63f0e1"
  }'
```

**Exemplo 4 - Remover account_type (definir como null):**
```bash
curl -X POST \
  'https://qckjiolragbvvpqvfhrj.functions.supabase.co/admin-users?action=upsert_user' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer {SERVICE_ROLE_KEY}' \
  -H 'apikey: {SERVICE_ROLE_KEY}' \
  -d '{
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "account_type": null
  }'
```

**Resposta de Sucesso:**
```json
{
  "ok": true,
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "usuario@example.com",
    "account_type": "profissional",
    "trail_product_ids": "8b5e0e5e-1f9e-4db4-a1b1-1a3b9f63f0e1",
    "updated_at": "2025-01-30T12:00:00Z"
  }
}
```

**Erros:**
- `400`: user_id não fornecido ou account_type inválido
- `404`: usuário não encontrado

---

### 3. Delete Token (Deletar token de plano)

**Endpoint:** `POST /admin-users?action=delete_token` ou `DELETE /admin-users?action=delete_token`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {SERVICE_ROLE_KEY}
apikey: {SERVICE_ROLE_KEY}
```

**Body:**
```json
{
  "token_id": "uuid-do-token"
}
```

**Exemplo:**
```bash
curl -X POST \
  'https://qckjiolragbvvpqvfhrj.functions.supabase.co/admin-users?action=delete_token' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer {SERVICE_ROLE_KEY}' \
  -H 'apikey: {SERVICE_ROLE_KEY}' \
  -d '{
    "token_id": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

**Resposta de Sucesso:**
```json
{
  "ok": true,
  "deleted_token_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Erros:**
- `400`: token_id não fornecido
- `404`: token não encontrado

---

### 4. Get User by Email (Buscar usuário por email)

**Endpoint:** `GET /admin-users?action=get_user_by_email&email={email}`

**Headers:**
```
Authorization: Bearer {SERVICE_ROLE_KEY}
apikey: {SERVICE_ROLE_KEY}
```

**Query Parameters:**
- `email` (obrigatório): Email do usuário (case-insensitive)

**Exemplo:**
```bash
curl -X GET \
  'https://qckjiolragbvvpqvfhrj.functions.supabase.co/admin-users?action=get_user_by_email&email=usuario@example.com' \
  -H 'Authorization: Bearer {SERVICE_ROLE_KEY}' \
  -H 'apikey: {SERVICE_ROLE_KEY}'
```

**Resposta de Sucesso:**
```json
{
  "ok": true,
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "usuario@example.com",
    "name": "Nome do Usuário",
    "account_type": "profissional",
    "plan_id": "d4836a79-186f-4905-bfac-77ec52fa1dde",
    "trail_product_ids": "8b5e0e5e-1f9e-4db4-a1b1-1a3b9f63f0e1",
    "member_seats_extra": 0,
    "organization_id": null,
    "supabase_url": "https://...",
    "supabase_key_encrypted": "...",
    "setup_completed": true,
    "active": true,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-30T12:00:00Z"
  }
}
```

**Erros:**
- `400`: email não fornecido
- `404`: usuário não encontrado

---

### 5. Get Organizations by Owner (Listar organizações por owner_id)

**Endpoint:** `GET /admin-users?action=get_organizations_by_owner&owner_id={owner_id}`

**Headers:**
```
Authorization: Bearer {SERVICE_ROLE_KEY}
apikey: {SERVICE_ROLE_KEY}
```

**Query Parameters:**
- `owner_id` (obrigatório): UUID do usuário owner (id primário em saas_users)

**Exemplo:**
```bash
curl -X GET \
  'https://qckjiolragbvvpqvfhrj.functions.supabase.co/admin-users?action=get_organizations_by_owner&owner_id=123e4567-e89b-12d3-a456-426614174000' \
  -H 'Authorization: Bearer {SERVICE_ROLE_KEY}' \
  -H 'apikey: {SERVICE_ROLE_KEY}'
```

**Resposta de Sucesso:**
```json
{
  "ok": true,
  "owner_id": "123e4567-e89b-12d3-a456-426614174000",
  "count": 2,
  "organizations": [
    {
      "id": "org-uuid-1",
      "name": "Organização 1",
      "slug": "organizacao-1",
      "owner_id": "123e4567-e89b-12d3-a456-426614174000",
      "plan_id": "d4836a79-186f-4905-bfac-77ec52fa1dde",
      "client_supabase_url": "https://...",
      "client_anon_key_encrypted": "...",
      "client_service_key_encrypted": "...",
      "setup_completed": true,
      "active": true,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-30T12:00:00Z"
    },
    {
      "id": "org-uuid-2",
      "name": "Organização 2",
      "slug": "organizacao-2",
      "owner_id": "123e4567-e89b-12d3-a456-426614174000",
      "plan_id": "8b5a1000-957c-4eaf-beca-954a78187337",
      "client_supabase_url": "https://...",
      "client_anon_key_encrypted": "...",
      "client_service_key_encrypted": "...",
      "setup_completed": true,
      "active": true,
      "created_at": "2025-01-15T00:00:00Z",
      "updated_at": "2025-01-20T12:00:00Z"
    }
  ]
}
```

**Resposta quando não há organizações:**
```json
{
  "ok": true,
  "owner_id": "123e4567-e89b-12d3-a456-426614174000",
  "count": 0,
  "organizations": []
}
```

**Erros:**
- `400`: owner_id não fornecido

**Nota:** As organizações são retornadas ordenadas por `created_at` (mais recentes primeiro).

---

## Exemplos em JavaScript/TypeScript

### Usando fetch

```typescript
const SERVICE_ROLE_KEY = 'sua-service-role-key'
const EDGE_BASE = 'https://qckjiolragbvvpqvfhrj.functions.supabase.co'

// Atualizar plano da organização
async function updateOrganizationPlan(orgId: string, planId: string) {
  const res = await fetch(`${EDGE_BASE}/admin-users?action=upsert_organization`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY
    },
    body: JSON.stringify({
      organization_id: orgId,
      plan_id: planId
    })
  })
  return await res.json()
}

// Atualizar account_type do usuário
async function updateUserAccountType(userId: string, accountType: string | null) {
  const res = await fetch(`${EDGE_BASE}/admin-users?action=upsert_user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY
    },
    body: JSON.stringify({
      user_id: userId,
      account_type: accountType
    })
  })
  return await res.json()
}

// Atualizar trail_product_ids do usuário
async function updateUserTrailProducts(userId: string, trailIds: string | null) {
  const res = await fetch(`${EDGE_BASE}/admin-users?action=upsert_user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY
    },
    body: JSON.stringify({
      user_id: userId,
      trail_product_ids: trailIds
    })
  })
  return await res.json()
}

// Deletar token
async function deleteToken(tokenId: string) {
  const res = await fetch(`${EDGE_BASE}/admin-users?action=delete_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY
    },
    body: JSON.stringify({
      token_id: tokenId
    })
  })
  return await res.json()
}

// Buscar usuário por email
async function getUserByEmail(email: string) {
  const res = await fetch(`${EDGE_BASE}/admin-users?action=get_user_by_email&email=${encodeURIComponent(email)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY
    }
  })
  return await res.json()
}

// Listar organizações por owner_id
async function getOrganizationsByOwner(ownerId: string) {
  const res = await fetch(`${EDGE_BASE}/admin-users?action=get_organizations_by_owner&owner_id=${encodeURIComponent(ownerId)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY
    }
  })
  return await res.json()
}
```

---

## IDs de Planos Comuns

Para referência, alguns IDs de planos comuns:

- **Trial**: `4663da1a-b552-4127-b1af-4bc30c681682`
- **Starter**: `8b5a1000-957c-4eaf-beca-954a78187337`
- **Pro**: `d4836a79-186f-4905-bfac-77ec52fa1dde`

Para obter a lista completa de planos, consulte a tabela `saas_plans` no Master Supabase.

---

## IDs de Trilhas Comuns

- **Trilha de Monetização**: `8b5e0e5e-1f9e-4db4-a1b1-1a3b9f63f0e1`

Para obter a lista completa de trilhas, consulte a tabela `trail_products` no Master Supabase.

---

## Notas Importantes

1. **Segurança**: Esta API usa Service Role Key e bypassa RLS. Use apenas em ambientes seguros e com controle de acesso adequado.

2. **Validação**: 
   - `account_type` deve ser um dos valores válidos ou `null`
   - `trail_product_ids` deve ser uma string com UUIDs separados por vírgula ou `null`
   - Todos os UUIDs devem existir nas respectivas tabelas

3. **Atualização Parcial**: Você pode atualizar apenas `account_type` ou apenas `trail_product_ids` - não precisa fornecer ambos.

4. **Deleção de Tokens**: A deleção de tokens é permanente e não pode ser desfeita. Certifique-se de que o token não está sendo usado antes de deletar.

