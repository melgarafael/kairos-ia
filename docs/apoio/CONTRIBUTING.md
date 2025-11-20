# Contribuindo para o TomikCRM

## Fluxo de trabalho
- Crie branch a partir de `main`: `feat/*`, `fix/*`, `docs/*`.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`...).
- Pull Request: descrição clara, screenshots/gifs quando UI, itens de verificação:
  - [ ] Build local passou
  - [ ] Sem linter errors
  - [ ] Testou fluxos críticos afetados
  - [ ] Atualizou docs quando necessário

## Padrões de código
- Typescript: tipos explícitos em APIs públicas, evitar `any`.
- Nomeação clara (Clean Code): funções verbos; variáveis substantivos.
- Controle de fluxo: early return, tratar erros; evitar nesting profundo.
- Comentários só quando necessário (o código deve se explicar).

## UI/UX
- Seguir o design atual (Tailwind); responsividade e acessibilidade básicas.
- Não reformatar arquivos inteiros sem motivo.

## Segurança
- Nunca expor chaves/segredos em commits.
- Não logar credenciais de Supabase.
- Respeitar `organization_id` nas queries.

## Revisão
- PR pequeno e objetivo é mais fácil de revisar.
- Mencione quais módulos foram impactados e como reproduzir.
