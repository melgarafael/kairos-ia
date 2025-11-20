# 🔄 Migração Master - Gestão de Clientes

## 🎯 Mudança Arquitetural

### ANTES ❌
- Dados no **Client Supabase**
- Isolados por `organization_id`
- RPC com `set_config('app.organization_id', ...)`
- Gestão de Clientes = dados da organização

### DEPOIS ✅
- Dados no **Master Supabase**
- Isolados por `user_id` (saas_users)
- RPC com `auth.uid()` automático
- Gestão de Clientes = dados pessoais do gestor

---

## 📊 Mudanças nas RPCs

### ANTES (Client)
```typescript
// Passar organization_id sempre
await client.rpc('automation_clients_list', { 
  p_organization_id: organizationId 
})

await client.rpc('automation_client_upsert', {
  p_organization_id: organizationId,
  p_company_name: 'Acme',
  // ...
})
```

### DEPOIS (Master)
```typescript
// SEM parâmetros de autenticação! auth.uid() automático
await master.rpc('automation_clients_list')

await master.rpc('automation_client_upsert', {
  p_company_name: 'Acme',
  // ... (sem p_organization_id!)
})
```

---

## 🔧 Mudanças nos Componentes

### Pattern de Substituição

**ANTES:**
```typescript
const client = supabaseManager.getClientSupabase()
const { data } = await client.rpc('automation_clients_list', { 
  p_organization_id: organizationId 
})
```

**DEPOIS:**
```typescript
const master = supabaseManager.getMasterSupabase()
const { data } = await master.rpc('automation_clients_list')
// Sem organization_id!
```

---

## 📝 Checklist de Refatoração

### Componentes para Atualizar
- [ ] ClientsTab.tsx
- [ ] ContractsTab.tsx
- [ ] ClientBankTab.tsx
- [ ] AppointmentsTab.tsx
- [ ] ProcessesKanban.tsx
- [ ] ClientManagement.tsx (stats)

### Em Cada Componente
1. Substituir `getClientSupabase()` → `getMasterSupabase()`
2. Remover parâmetro `p_organization_id` de TODAS as RPCs
3. Remover `organizationId` das props (não é mais necessário!)

---

## ✅ Vantagens da Nova Arquitetura

1. **Dados Pessoais** - Cada gestor tem seus clientes
2. **Simplicidade** - Sem organization_id para passar
3. **Segurança** - auth.uid() automático do JWT
4. **Performance** - Master é mais rápido
5. **Manutenção** - Código mais limpo

---

**Status:** Migrations criadas, componentes sendo atualizados...

