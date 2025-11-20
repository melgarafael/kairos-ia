# ✅ Correção v2: Reordenação de Leads no Kanban

**Data:** 2025-01-XX  
**Status:** 🔄 Em correção

---

## 🔍 Problema Identificado

Mesmo após aplicar a migration v85 com a RPC `crm_leads_reorder_stage`, os leads ainda não estão sendo reordenados corretamente - eles permanecem na posição original.

---

## 🔧 Correções Aplicadas

### 1. Correção no `KanbanBoard.tsx`

**Problema:** `newOrder` estava sendo calculado usando `stage_order` antigo em vez do índice do drag-and-drop.

**Solução:** Usar diretamente `newIndex` como `newOrder`, que representa a posição de destino (0, 1, 2, 3...).

```typescript
// ANTES: Tentava usar stage_order antigo
newOrder = targetLead.stage_order ?? newIndex

// DEPOIS: Usa diretamente o índice do drag-and-drop
const newOrder = newIndex
```

### 2. Correção na Lógica de Construção do Array `leadIds`

**Problema:** A lógica de inserção do lead na posição correta estava incorreta quando `newOrder` era maior que o tamanho da lista.

**Solução:** Usar `Math.min(newOrder, finalLeads.length)` para garantir que o índice nunca exceda o tamanho da lista.

```typescript
const insertIndex = Math.min(newOrder, finalLeads.length)
finalLeads.splice(insertIndex, 0, { id } as any)
```

### 3. Recarregamento dos Dados Após Reordenação

**Problema:** O estado local não estava sendo sincronizado com o banco após a reordenação.

**Solução:** Chamar `fetchLeads()` após a reordenação para garantir que os dados estão sincronizados.

```typescript
// 7. Recarregar leads do banco para garantir ordem correta
devLog.log('🔄 [MOVE] Reloading leads to sync with database...')
await fetchLeads()
```

### 4. Logs Melhorados

Adicionados logs detalhados para debug:
- Lista de `leadIds` que será enviada para a RPC
- Se o lead já está no estágio ou está vindo de outro
- Contagem de leads antes e depois da reordenação

---

## 🧪 Como Testar

1. **Mover lead dentro do mesmo estágio:**
   - Arrastar lead da posição 0 para posição 2
   - Verificar no console os logs `🔄 [MOVE] Reordering leads:`
   - Verificar se `leadIds` contém os IDs na ordem correta
   - Verificar se após mover, os leads são recarregados

2. **Mover lead entre estágios:**
   - Arrastar lead do estágio A para estágio B na posição 1
   - Verificar se o lead é removido do estágio A
   - Verificar se o lead é inserido no estágio B na posição correta
   - Verificar se ambos os estágios são reordenados

3. **Verificar logs no console:**
   - `🎯 [MOVE] Moving lead:` - mostra parâmetros iniciais
   - `🔄 [MOVE] Reordering leads:` - mostra array de IDs que será enviado para RPC
   - `🔄 [MOVE] Reloading leads to sync with database...` - confirma recarregamento
   - `✅ [MOVE] Backend update successful and data reloaded` - confirma sucesso

---

## 🔍 Debugging

Se ainda não funcionar, verificar:

1. **A RPC existe no banco?**
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'crm_leads_reorder_stage';
   ```

2. **A migration v85 foi aplicada?**
   ```sql
   SELECT version FROM app_migrations WHERE version = '85';
   ```

3. **Verificar logs do console:**
   - Procurar por erros da RPC
   - Verificar se `leadIds` está correto
   - Verificar se `fetchLeads()` está sendo chamado

4. **Verificar se há erros de permissão:**
   - A RPC precisa de `GRANT EXECUTE` para `authenticated` e `anon`
   - Verificar se o usuário tem permissão para atualizar `crm_leads`

---

## 📝 Próximos Passos

Se ainda não funcionar após essas correções:

1. Verificar se a RPC está sendo chamada corretamente (adicionar try/catch mais detalhado)
2. Verificar se há algum trigger ou constraint que está interferindo
3. Verificar se o `fetchLeads()` está respeitando a ordenação por `stage_order`
4. Considerar usar transação explícita para garantir atomicidade

