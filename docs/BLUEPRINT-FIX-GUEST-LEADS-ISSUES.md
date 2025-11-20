# 🔧 Blueprint: Correção de Problemas Críticos - Acesso de Convidados e Leads

**Data:** 2025-01-XX  
**Status:** Em Planejamento  
**Prioridade:** Alta

---

## 📋 Problemas Identificados

### 1. Acesso Limitado para Convidados
**Sintoma:** Convidados não conseguem acessar os CRMs; dados não carregam, interface parece vazia.

**Causa Raiz:**
- `DataContext.tsx` linha 1446-1453: Verificação `allowWithoutSetup` pode estar bloqueando convidados
- `fetchLeads` não verifica permissões de visualização antes de buscar dados
- Convidados podem ter `setup_completed = false` mas devem poder visualizar dados se têm membership ativa

**Impacto:** Convidados não conseguem usar o sistema, mesmo com permissões de visualização válidas.

---

### 2. Dificuldade na Ordenação de Leads
**Sintoma:** Não consigo organizar os leads na ordem desejada; ordenação parece ser automática alfabética.

**Causa Raiz:**
- `DataContext.tsx` linha 349: Ordenação usa apenas `stage_order` e `created_at`
- Lista de leads (`Leads.tsx`) não respeita `stage_order` dentro de cada estágio
- Não há funcionalidade de drag-and-drop na lista de leads (apenas no Kanban)
- Ordenação alfabética pode estar vindo do frontend após o fetch

**Impacto:** Usuários não conseguem organizar leads manualmente na visualização de lista.

---

### 3. Duplicação de Informações ao Criar Lead
**Sintoma:** Ao adicionar novo lead, campos são preenchidos automaticamente com dados do lead anterior.

**Causa Raiz:**
- `KanbanNewLeadModal.tsx`: Sistema de draft no localStorage persiste dados entre aberturas
- Draft é salvo ao fechar modal (linha 369) mas só é limpo após salvar com sucesso (linha 356)
- Se usuário fecha sem salvar, draft permanece e é carregado na próxima abertura
- `Leads.tsx` não usa sistema de draft, mas pode ter estado não limpo

**Impacto:** Confusão e risco de erros ao criar leads com dados incorretos.

---

## 🎯 Soluções Propostas

### Solução 1: Corrigir Acesso de Convidados

**Arquivos Afetados:**
- `src/context/DataContext.tsx`
- `src/hooks/useMemberPermissions.ts` (verificação)

**Mudanças:**

1. **Ajustar verificação de carregamento inicial:**
```typescript
// Permitir convidados carregarem dados se têm membership ativa
const allowWithoutSetup = memberPermissions.isOwner || 
  (!memberPermissions.loading && memberPermissions.role !== null && 
   Object.keys(memberPermissions.permissions.view).length > 0)
```

2. **Adicionar verificação de permissão de visualização em fetchLeads:**
```typescript
const fetchLeads = async () => {
  if (!user?.organization_id) return
  
  // Verificar permissão de visualização antes de buscar
  if (!memberPermissions.isOwner && !memberPermissions.canView('crm_leads') && !memberPermissions.canView('leads_list')) {
    devLog.log('⚠️ [DATA] User does not have permission to view leads')
    setState(prev => ({ ...prev, loading: { ...prev.loading, leads: false } }))
    return
  }
  
  // ... resto do código
}
```

3. **Garantir que convidados vejam mensagem apropriada:**
- Se não têm permissão: mostrar mensagem "Você não tem permissão para visualizar leads"
- Se têm permissão mas dados não carregam: investigar conexão Supabase

---

### Solução 2: Implementar Ordenação Manual de Leads

**Arquivos Afetados:**
- `src/context/DataContext.tsx` (fetchLeads)
- `src/components/features/Leads/Leads.tsx` (UI de ordenação)
- `supabase/migrations/` (se necessário ajustar RPC)

**Mudanças:**

1. **Garantir ordenação por stage_order na lista:**
```typescript
// Em fetchLeads, ordenar por stage e stage_order
.order('stage', { ascending: true })
.order('stage_order', { ascending: true, nullsFirst: false })
.order('created_at', { ascending: false })
```

2. **Adicionar funcionalidade de reordenação na lista:**
- Opção 1: Botões "Mover para cima/baixo" em cada linha
- Opção 2: Drag-and-drop na lista (usando react-beautiful-dnd ou similar)
- Opção 3: Campo numérico para definir ordem manualmente

3. **Criar RPC para atualizar stage_order:**
```sql
CREATE OR REPLACE FUNCTION crm_leads_reorder(
  p_organization_id uuid,
  p_lead_id uuid,
  p_new_order integer
) RETURNS boolean AS $$
-- Atualizar stage_order do lead e ajustar outros leads no mesmo estágio
$$;
```

**Recomendação:** Implementar Opção 1 primeiro (botões simples), depois evoluir para drag-and-drop se necessário.

---

### Solução 3: Corrigir Duplicação de Dados no Formulário

**Arquivos Afetados:**
- `src/components/features/Kanban/KanbanNewLeadModal.tsx`
- `src/components/features/Leads/Leads.tsx` (se necessário)

**Mudanças:**

1. **Limpar draft ao fechar modal após salvar com sucesso:**
```typescript
const handleClose = () => {
  // Se salvou com sucesso, draft já foi limpo em handleSubmit
  // Se não salvou, manter draft para próxima vez
  setErrors({})
  onClose()
}
```

2. **Adicionar opção de limpar formulário manualmente:**
- Botão "Limpar formulário" no modal
- Ou limpar automaticamente após X segundos de inatividade

3. **Melhorar lógica de reset:**
```typescript
// Ao abrir modal, verificar se deve carregar draft ou resetar
useEffect(() => {
  if (!isOpen) return
  
  // Se acabou de salvar um lead, não carregar draft
  const justSaved = sessionStorage.getItem('tomik_lead_just_saved')
  if (justSaved === 'true') {
    sessionStorage.removeItem('tomik_lead_just_saved')
    // Resetar formulário sem carregar draft
    resetForm()
    return
  }
  
  // Caso contrário, carregar draft se existir
  const draft = loadDraft()
  // ... resto do código
}, [isOpen])
```

4. **Marcar quando lead é salvo com sucesso:**
```typescript
// Em handleSubmit, após salvar:
sessionStorage.setItem('tomik_lead_just_saved', 'true')
clearDraft()
```

---

## 📊 Critérios de Sucesso

### Problema 1: Acesso de Convidados
- [ ] Convidados com membership ativa conseguem visualizar leads
- [ ] Mensagem apropriada é exibida se não têm permissão
- [ ] Dados carregam corretamente para convidados com permissões de visualização

### Problema 2: Ordenação de Leads
- [ ] Leads são ordenados por `stage_order` dentro de cada estágio
- [ ] Usuários podem reordenar leads manualmente (botões ou drag-and-drop)
- [ ] Ordenação é persistida no banco de dados

### Problema 3: Duplicação de Dados
- [ ] Formulário é limpo após salvar lead com sucesso
- [ ] Draft não interfere na criação de novos leads após salvar
- [ ] Usuário pode limpar formulário manualmente se desejar

---

## 🔄 Plano de Execução

### Fase 1: Correções Críticas (Prioridade Alta)
1. ✅ Corrigir acesso de convidados
2. ✅ Corrigir duplicação de dados no formulário

### Fase 2: Melhorias de UX (Prioridade Média)
3. ✅ Implementar ordenação manual de leads

---

## 🧪 Testes Necessários

1. **Teste de Acesso de Convidados:**
   - Criar usuário convidado com membership ativa
   - Verificar se dados carregam corretamente
   - Verificar mensagens de erro apropriadas

2. **Teste de Ordenação:**
   - Criar múltiplos leads no mesmo estágio
   - Reordenar manualmente
   - Verificar persistência após refresh

3. **Teste de Formulário:**
   - Criar lead e salvar
   - Abrir modal novamente - deve estar vazio
   - Preencher formulário, fechar sem salvar, abrir novamente - deve ter draft
   - Salvar lead - draft deve ser limpo

---

## 📝 Notas Técnicas

- Verificar se RPC `crm_leads_upsert` já existe e suporta `stage_order`
- Considerar adicionar índice em `(organization_id, stage, stage_order)` para performance
- Draft no localStorage pode ser útil, mas precisa ser gerenciado corretamente
- Verificar se há outras telas com problemas similares de acesso de convidados

---

## 🔗 Referências

- `src/context/DataContext.tsx` - Gerenciamento de dados e permissões
- `src/hooks/useMemberPermissions.ts` - Hook de permissões
- `src/components/features/Kanban/KanbanNewLeadModal.tsx` - Modal de criação
- `supabase/UPDATE-v79-CLIENTE-SQL.md` - Migração de stage_order

