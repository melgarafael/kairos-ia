# Kanban Refactor Log

Data: 2025-10-31

## Alterações nesta etapa

- Comparador de `React.memo` em `KanbanColumn` revisado para re-render por referência de lista (corrige não-atualização visual após mover card).
- Botão "Carregar mais" reintroduzido também no caminho virtualizado.
- Infinite scroll por coluna (carrega próxima página ao aproximar do fundo).
- Total no cabeçalho, em modo paginado, usa a contagem exata do banco.
- Virtualização migrada para TanStack Virtual (padding mode compatível com DnD) e adicionado IntersectionObserver como sentinela de paginação.
- Realtime incremental dedicado ao Kanban paginado: `KanbanRealtimeService` + `useKanbanSync` integram eventos do Supabase diretamente no store por estágio (Zustand), atualizando apenas as colunas afetadas.

## Impacto esperado

- UI reflete imediatamente movimentos de cards, sem refresh.
- Com grandes volumes, o carregamento incremental por coluna permanece acessível (botão e scroll automático), sem sumiço de leads.
- Contagens exibidas consistentes com o banco.
- Scroll mais suave e estável em colunas com milhares de cards.
- Realtime não re-renderiza o board inteiro; apenas buckets (estágios) tocados pelo evento.

## Métricas a coletar (pós-merge)

- Tempo médio para `onDragEnd` refletir UI: < 50ms.
- FPS durante scroll em colunas grandes: >= 55.
- Re-renders por movimento: apenas 2 colunas (origem/destino).
