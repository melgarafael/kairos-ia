# Performance Report — Kanban

## Baseline (antes)
- Flickering em drag.
- Carregar muitos leads tornava a UI lenta.
- Em modo paginado, o total no cabeçalho refletia apenas leads carregados.
- Ausência de botão "Mostrar mais" quando a lista entrava em modo virtualizado.

## Depois (esta etapa)
- Re-render previsível das colunas nos movimentos de cards.
- Botão "Carregar mais" sempre visível (inclusive em virtualização) + infinite scroll.
- Total do cabeçalho em modo paginado usa contagem do banco.

## Métricas a coletar
- FPS médio em scroll (React Profiler / Sentry Performance).
- Commit time médio de renders.
- Tempo entre drop e UI estável.

## Próximos passos
- Migrar virtualização para `@tanstack/react-virtual`.
- Separar estado por estágio (store granular) e reconciliador de realtime dedicado.
