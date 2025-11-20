# Kanban Performance Blueprint

Este blueprint define a estratégia de refatoração para tornar o Kanban do TomikCRM fluido com milhares de leads, eliminando flickering, lags e re-renders desnecessários, seguindo a Tomik Coding Doctrine (modularidade, blueprint antes do código, documentação viva e design system).

## Objetivos

- UI responsiva com milhares de leads por coluna.
- Drag & drop instantâneo com update otimista e sync em background.
- Nenhum re-render global quando 1 card muda; somente o item afetado.
- Carregamento incremental com cache e realtime confiáveis.
- FPS estável (~60) e tempo de render por frame < 16ms.

## Diagnóstico (estado atual)

- Renderização de listas grandes causa lags; virtualização manual cobre parte dos casos e esconde o botão "Mostrar mais" quando há paginação por estágio.
- Estatísticas em modo paginado usam apenas leads carregados (subestima o total).
- Reatividade: realtime OK no `DataContext`, mas o memo de coluna era frágil (já corrigido). 
- Fonte de dados: modo paginado por estágio existe, porém sem integração perfeita com virtualização (ausência de carregamento incremental visível/infinito).

## Arquitetura alvo

```
src/features/kanban/
├─ components/
│  ├─ KanbanBoard.tsx
│  ├─ KanbanColumn.tsx
│  └─ KanbanCard.tsx
├─ hooks/
│  ├─ useKanbanLeads.ts           (modo tradicional)
│  ├─ useKanbanLeadsPaginated.ts  (modo paginado por estágio)
│  ├─ useKanbanSync.ts            (realtime + reconciliação)
│  └─ useVirtualScroll.ts         (virtualização desacoplada)
├─ services/
│  ├─ KanbanDataService.ts        (fetch/cache granular)
│  └─ KanbanRealtimeService.ts    (canais Supabase)
└─ types.ts
```

### Pilares técnicos

1. Virtualização de listas
   - Adotar `@tanstack/react-virtual` (ou `react-window`) em `KanbanColumn` para janelas estáveis, medição mais eficiente e API simples.
   - Sentinela de carregamento no final da coluna (infinite scroll) aciona `loadMore(stage)` quando o usuário se aproxima do fundo.

2. Estado granular e cache
   - Manter dados por estágio em um store fino (Zustand) ou Camada de Serviço com TanStack Query.
   - Cada coluna observa apenas seu estágio; mover 1 card atualiza somente 2 colunas (origem/destino).

3. Drag & Drop performático
   - `onDragEnd` aplica update otimista e agenda persistência assíncrona.
   - Nenhum cálculo caro em `onDragUpdate`; usar refs estáveis para functions (já aplicado).

4. Realtime supabase
   - Incremental, por tabela, reconciliando sem refresh global (já no `DataContext`).
   - Serviços dedicados para inscrição e limpeza previsíveis.

5. Métricas e UX
   - Skeletons para carregamentos longos.
   - Cabeçalho usa contagem remota exata no modo paginado.
   - Telemetria: React Profiler + Sentry Performance.

## Plano de entrega (fases)

1) Correções imediatas (esta PR)
   - Mostrar "Mostrar mais" também em lista virtualizada e habilitar infinite scroll.
   - Corrigir estatística de total em modo paginado para usar a contagem do banco.

2) Virtualização robusta
   - Introduzir `@tanstack/react-virtual` em `KanbanColumn` (substituir virtualização manual).
   - Sentinela/intersection observer para `loadMore` por estágio.

3) Granularização de estado
   - Extrair cache por estágio para `KanbanDataService` + (opcional) Zustand/TanStack Query; cada coluna assina apenas seu estágio.

4) Refino de realtime e reconciliador
   - `KanbanRealtimeService` com canais dedicados e reconciliação por id (UPDATE/DELETE/INSERT) por estágio.

5) Observabilidade e documentação
   - Adicionar medições (FPS, tempo de render, memória) e relatório antes/depois.

## Critérios de sucesso

- Drag: atualização visual < 50ms; sem flicker.
- Scroll: 60 FPS em colunas com 10k cards (virtualizados).
- Re-renders: somente colunas afetadas; cards estáveis.
- Estatísticas consistentes com o banco.

## Métricas (como medir)

- React Profiler: commit time e wasted renders.
- Sentry Performance: TTFB, Slow Transactions, Long Tasks.
- Contadores de re-render por componente em dev.

## Notas de compatibilidade

- Backward compatible com Supabase atual; `show_in_kanban` é opcional.
- `stage_order` tratado com fallback quando coluna ainda não existe (já implementado).


