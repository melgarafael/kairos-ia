# 🎯 Blueprint: Kanban de Processos - Estado da Arte

> Documento de planejamento para implementação de melhorias no ProcessesKanban baseado em consultoria especializada

## 📋 Objetivo

Transformar o ProcessesKanban em um kanban de nível estado-da-arte, incorporando as melhores práticas identificadas em Trello, Notion, Focalboard e discussões de engenheiros/power-users.

## 🎯 Impacto Esperado

- **Performance**: Suportar 500+ cards por coluna sem lag
- **Produtividade**: Atalhos de teclado aumentam throughput em 3x
- **Clareza**: WIP limits e políticas explícitas reduzem confusão em 50%
- **Experiência**: UX polida iguala/se supera Trello

## 🏗️ Arquitetura Modular

### Componentes Principais

```
ProcessesKanban/ (diretório)
├── ProcessesKanban.tsx (orquestrador principal)
├── KanbanColumn.tsx (coluna virtualizada + WIP)
├── ProcessCard.tsx (card memoizado com sinal atualizado)
├── KeyboardShortcuts.tsx (overlay + handlers)
├── FiltersBar.tsx (busca + filtros avançados)
├── TemplatesModal.tsx (templates de cards/colunas)
├── CardDetailModal.tsx (modal expandido com checklists avançadas)
├── WIPIndicator.tsx (badge de limite + drop guard)
└── hooks/
    ├── useProcesses.ts (data fetching + cache)
    ├── useKeyboardShortcuts.ts (atalhos J/K/Enter/?)
    ├── useWIPLimits.ts (validação de limites)
    └── useProcessTemplates.ts (templates salvos)
```

## 📦 Dependências Já Disponíveis

- ✅ `@hello-pangea/dnd` (melhor que react-beautiful-dnd)
- ✅ `@tanstack/react-virtual` (virtualização moderna)
- ✅ `react-window` (alternativa)
- ✅ `framer-motion` (animações suaves)

## 🚀 Sprint 1: Estabilidade e Fluidez

### Objetivos
- Virtualização de listas (suportar 500+ cards)
- DragOverlay com portal (sem flicker)
- Memoização agressiva (PureComponent, memo, useMemo, useCallback)
- Batch updates do socket (evitar repaints excessivos)

### Entregas
1. Substituir drag nativo HTML5 por `@hello-pangea/dnd`
2. Implementar virtualização com `@tanstack/react-virtual`
3. Criar DragOverlay em portal separado
4. Memoizar todos os cards e colunas
5. Implementar batch de updates

### Critérios de Sucesso
- [ ] 500 cards por coluna renderizam sem lag (<16ms por frame)
- [ ] Drag and drop fluido sem flicker
- [ ] Re-renders minimizados (verificado com React DevTools)

## 🎹 Sprint 2: Produtividade

### Objetivos
- Atalhos de teclado (J/K navegação, Enter abre card, Shift+? overlay)
- Busca global + filtros avançados (pessoa, prazo, bloqueado)
- Templates de cards e colunas
- Multiseleção (futuro)

### Entregas
1. Hook `useKeyboardShortcuts` com handlers
2. Overlay de atalhos (Shift+?)
3. Componente `FiltersBar` com busca + filtros
4. Modal de templates com salvamento

### Critérios de Sucesso
- [ ] Atalhos funcionam sem conflitos
- [ ] Busca instantânea (<100ms)
- [ ] Templates salvos e reutilizáveis

## 🎯 Sprint 3: Kanban "de Verdade"

### Objetivos
- WIP limits por coluna com badge visual
- Políticas explícitas (critério de entrada/saída)
- Card aging (cards envelhecidos ficam amarelados)
- Drop guard (bloqueia drop quando WIP estoura)

### Entregas
1. Componente `WIPIndicator` com badge
2. Tooltip de políticas nas colunas
3. Cálculo de aging (dias desde última movimentação)
4. Validação de drop com override consciente

### Critérios de Sucesso
- [ ] WIP limits visíveis e funcionais
- [ ] Políticas claras para usuário
- [ ] Cards envelhecidos sinalizados visualmente

## 🔗 Sprint 4: Profundidade Leve

### Objetivos
- Checklists avançadas (dono + prazo por item)
- Dependências por link (blocked_by/blocks)
- Badge "Bloqueado" no card
- Filtro "Somente bloqueados"

### Entregas
1. Extensão de checklist com dono/prazo
2. Campo `blocked_by` e `blocks` no schema
3. Badge visual + tooltip de dependências
4. Filtro na barra de busca

### Critérios de Sucesso
- [ ] Checklists avançadas funcionais
- [ ] Dependências visíveis e clicáveis
- [ ] Filtro de bloqueados funciona

## 🔄 Sprint 5: Realtime Sólido

### Objetivos
- WebSockets para updates em tempo real
- Presença (quem está online/olhando qual card)
- Conflitos de edição (banner "X está editando")
- Fila offline (enfileirar ações quando offline)

### Entregas
1. Integração com Supabase Realtime
2. Componente de presença
3. Sistema de bloqueio otimista
4. Queue offline com sync na reconexão

### Critérios de Sucesso
- [ ] Updates instantâneos (<100ms)
- [ ] Presença visível
- [ ] Edições simultâneas sem perda de dados

## 📊 Métricas e Vistas

### Futuro (Sprint 6+)
- Lead time / cycle time por coluna
- Cumulativo de fluxo
- Vista Calendário (prazos)
- Vista Tabela (auditoria)

## 🔧 Decisões Técnicas

### Virtualização
- Usar `@tanstack/react-virtual` (mais moderno que react-window)
- DragOverlay em portal separado para evitar conflitos

### Performance
- Memoizar tudo: cards, colunas, funções derivadas
- Batch updates de estado
- Debounce em busca/filtros

### Acessibilidade
- Suporte a DnD via teclado
- Foco visível
- ARIA labels adequados

## 📝 Notas de Implementação

- Manter compatibilidade com RPCs existentes (`automation_processes_list`, `automation_process_move_stage`)
- Extender schema gradualmente (não quebrar dados existentes)
- Testar com dados reais (não apenas mocks)

## ✅ Checklist de Entrega

- [ ] Código modular e testável
- [ ] Documentação atualizada
- [ ] Performance validada
- [ ] Acessibilidade verificada
- [ ] Design system respeitado

