# ✅ Correção: Reordenação de Leads no Kanban

**Data:** 2025-01-XX  
**Status:** ✅ Concluído

---

## 🔍 Problema Identificado

Quando um lead era movido para uma nova posição no Kanban:
- Apenas o `stage_order` do lead movido era atualizado
- Os outros leads no mesmo estágio **não** tinham seus `stage_order` ajustados
- Isso causava **conflitos** e a ordenação ficava bagunçada
- Após refresh, os leads voltavam para uma ordem incorreta

**Exemplo do problema:**
- Leads com stage_order: [0, 1, 2, 3, 4]
- Mover lead com stage_order=4 para posição 1
- Apenas esse lead era atualizado para stage_order=1
- O lead que estava na posição 1 continuava com stage_order=1
- **Conflito!** Dois leads com o mesmo stage_order

---

## ✅ Solução Implementada

### 1. RPC para Reordenar Leads (`crm_leads_reorder_stage`)

Criada uma função SQL que:
- Recebe um array de IDs de leads na ordem desejada
- Atualiza `stage_order` sequencialmente (0, 1, 2, 3...) para cada lead
- Garante que não há conflitos
- Valida que todos os leads pertencem à organização e estágio

**Arquivo:** `supabase/migrations/20250115000000_crm_leads_reorder_rpc.sql`

### 2. Lógica de Reordenação em `moveLead`

Modificada a função `moveLead` em `DataContext.tsx` para:

1. **Buscar todos os leads do estágio de destino**
2. **Construir array de IDs na ordem correta** baseada no índice do drag-and-drop
3. **Atualizar o lead movido** (mudar estágio se necessário)
4. **Reordenar todos os leads do estágio** usando a RPC `crm_leads_reorder_stage`
5. **Reordenar o estágio antigo** (se mudou de estágio)
6. **Atualizar estado local** com a nova ordem

**Arquivo:** `src/context/DataContext.tsx` (linhas 1338-1521)

### 3. Fallback para Compatibilidade

Se a RPC não existir ainda (migration não aplicada):
- Faz update manual sequencial de cada lead
- Loga aviso mas não quebra o fluxo
- Permite que funcione mesmo sem a migration

---

## 🔄 Fluxo de Reordenação

```
1. Usuário arrasta lead para nova posição
   ↓
2. handleDragEnd calcula newOrder (índice do drop)
   ↓
3. moveLead é chamado com id, newStage, oldStage, newOrder
   ↓
4. Busca todos os leads do estágio de destino
   ↓
5. Remove o lead movido da lista (se já está no estágio)
   ↓
6. Insere o lead na posição correta (baseado em newOrder)
   ↓
7. Atualiza o lead movido (muda estágio se necessário)
   ↓
8. Chama RPC crm_leads_reorder_stage com array de IDs ordenado
   ↓
9. RPC atualiza stage_order sequencialmente (0, 1, 2, 3...)
   ↓
10. Se mudou de estágio, reordena o estágio antigo também
   ↓
11. Atualiza estado local com nova ordem
   ↓
12. UI reflete a nova ordem imediatamente
```

---

## 📊 Benefícios

1. **Sem Conflitos:** Todos os leads têm `stage_order` único e sequencial
2. **Ordem Persistente:** Ordenação é mantida após refresh
3. **Performance:** RPC faz tudo em uma transação SQL
4. **Compatibilidade:** Fallback funciona mesmo sem migration aplicada
5. **Consistência:** Estado local e banco sempre sincronizados

---

## 🧪 Testes Necessários

1. **Mover lead dentro do mesmo estágio:**
   - Arrastar lead da posição 0 para posição 2
   - Verificar que todos os leads são reordenados corretamente
   - Verificar que ordem persiste após refresh

2. **Mover lead entre estágios:**
   - Arrastar lead do estágio A para estágio B
   - Verificar que lead é removido do estágio A
   - Verificar que lead é inserido no estágio B na posição correta
   - Verificar que ambos os estágios são reordenados

3. **Mover lead para o final:**
   - Arrastar lead para última posição
   - Verificar que stage_order é maior que todos os outros

4. **Múltiplos movimentos rápidos:**
   - Mover vários leads rapidamente
   - Verificar que não há conflitos ou erros

---

## 📝 Arquivos Modificados

1. **`supabase/migrations/20250115000000_crm_leads_reorder_rpc.sql`**
   - Nova RPC para reordenar leads

2. **`src/context/DataContext.tsx`**
   - Função `moveLead` completamente reescrita
   - Lógica de reordenação completa

---

## ⚠️ Notas Importantes

- A migration `20250115000000_crm_leads_reorder_rpc.sql` precisa ser aplicada no banco do cliente
- Se a RPC não existir, o sistema usa fallback manual (mais lento mas funcional)
- A ordenação é baseada no **índice do drag-and-drop**, não no `stage_order` atual
- Todos os leads do estágio são reordenados, não apenas o movido

---

## 🔗 Referências

- `supabase/UPDATE-v79-CLIENTE-SQL.md` - Migration original de stage_order
- `src/components/features/Kanban/KanbanBoard.tsx` - Lógica de drag-and-drop
- `src/hooks/useKanbanLeads.ts` - Hook que chama moveLead

