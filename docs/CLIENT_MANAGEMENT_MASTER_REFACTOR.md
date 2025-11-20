# 🔄 Refatoração MASTER - Guia Completo de Execução

## 🎯 Objetivo

Migrar **Gestão de Clientes** do Client Supabase para o Master Supabase, tornando os dados **pessoais do usuário** (não da organização).

---

## 📋 Checklist de Execução

### 1. ✅ Migrations no Master (FEITO!)
- [x] `MASTER-migrations/20251107000000_client_management_master.sql` - 8 tabelas
- [x] `MASTER-migrations/20251107000001_client_management_rpcs_master.sql` - RPCs simplificadas

### 2. 🔄 Refatorar Componentes

#### ClientsTab.tsx
**Mudanças:**
```typescript
// Props: REMOVER organizationId
interface ClientsTabProps {}  // Sem props!

// loadData():
- const client = supabaseManager.getClientSupabase()
+ const master = supabaseManager.getMasterSupabase()

- await client.rpc('automation_clients_list', { p_organization_id: organizationId })
+ await master.rpc('automation_clients_list')  // Sem parâmetros!

// handleSaveClient():
- await client.rpc('automation_client_upsert', {
-   p_organization_id: organizationId,
-   p_id: ...,
+ await master.rpc('automation_client_upsert', {
+   p_id: ...,  // Sem p_organization_id!

// handleDeleteClient():
- await client.rpc('automation_client_delete', {
-   p_organization_id: organizationId,
+ await master.rpc('automation_client_delete', {
```

#### ContractsTab.tsx
**Mudanças idênticas:** Client → Master, remover `p_organization_id`

#### ClientBankTab.tsx
**Mudanças idênticas:** Client → Master, remover `p_organization_id`

#### AppointmentsTab.tsx
**Mudanças idênticas:** Client → Master, remover `p_organization_id`

#### ProcessesKanban.tsx
**Mudanças idênticas:** Client → Master, remover `p_organization_id`

#### ClientManagement.tsx
**Mudanças:**
```typescript
// Remover organizationId das props dos componentes filhos
- <ClientsTab organizationId={selectedOrg.id} />
+ <ClientsTab />

- <ContractsTab organizationId={selectedOrg.id} />
+ <ContractsTab />

// loadStats(): Master em vez de Client
- const client = supabaseManager.getClientSupabase()
+ const master = supabaseManager.getMasterSupabase()

// Pode até remover seleção de org (dados são do usuário agora!)
// MAS manter para Trilhas (contexto de estudo)
```

---

## ⚡ Script de Refatoração Rápida

### Pattern Find & Replace

**1. getClientSupabase → getMasterSupabase**
```
Find: const client = supabaseManager.getClientSupabase()
Replace: const master = supabaseManager.getMasterSupabase()
```

**2. Remover p_organization_id de TODAS as chamadas RPC**
```
Find: p_organization_id: organizationId,
Replace: (deletar linha)
```

**3. Atualizar referências de 'client' para 'master'**
```
Find: await client.rpc(
Replace: await master.rpc(
```

**4. Remover prop organizationId**
```
Find: interface XTabProps { organizationId: string }
Replace: interface XTabProps {}
```

---

## 🗑️ Migrations Antigas para Deletar

### Client Supabase (não usar mais!)
- `supabase/migrations/20251107000000_client_management_system.sql`
- `supabase/migrations/20251107000001_client_management_rpcs.sql`
- `supabase/migrations/20251107000002_processes_kanban_enhancements.sql`

**NOTA:** Não deletar ainda, apenas documentar que não devem ser aplicadas.

---

## ✅ Vantagens da Nova Arquitetura

### 1. Simplicidade
- RPCs sem `p_organization_id`
- Componentes sem prop `organizationId`
- Código mais limpo

### 2. Segurança
- `auth.uid()` do JWT (impossível falsificar)
- RLS automático
- Sem contexto manual

### 3. Lógica de Negócio
- Gestão de Clientes é **pessoal**
- Não depende da org do CRM
- Gestor tem seus clientes em qualquer org

### 4. Performance
- Master é centralizado
- Menos queries cross-database
- Mais rápido

---

## 🚀 Ordem de Execução

### Passo 1: Aplicar Migrations no Master ✅
```sql
-- Rodar no Master Supabase (SQL Editor)
-- 1. Tabelas (20251107000000)
-- 2. RPCs (20251107000001)
```

### Passo 2: Refatorar Componentes
1. ClientsTab
2. ContractsTab
3. ProcessesKanban
4. ClientBankTab
5. AppointmentsTab
6. ClientManagement

### Passo 3: Testar
- Criar cliente → deve salvar no Master
- Listar clientes → deve buscar do Master
- Trocar de org → dados permanecem (são do usuário!)

### Passo 4: Limpar
- Marcar migrations antigas como deprecated
- Atualizar documentação

---

## 📊 Status

- [x] Migrations Master criadas
- [x] RPCs Master criadas  
- [ ] Componentes refatorados (em progresso)
- [ ] Testado
- [ ] Documentado

---

**Próximo:** Refatorar todos os componentes! 🚀

