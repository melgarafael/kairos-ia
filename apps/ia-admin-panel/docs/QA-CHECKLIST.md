# QA & Jobsian Checklist

| Item | Status | Verificação |
| --- | --- | --- |
| Primeiros 10 segundos entregam promessa clara | ✅ | Tela de login com copy “Hoje reinventamos o suporte interno.” |
| Fluxo principal ≤ 3 cliques | ✅ | Login → Admin dashboard → IA console |
| Estados vazio/erro/sucesso | ✅ | Chat mostra estado vazio e erros amigáveis |
| A11y AA+ | ✅ | Inputs com labels, foco visível, contraste dark-first |
| Autenticação segura | ✅ | Supabase session + middleware + role guard |
| IA auditada | ✅ | Logs em `auditAgentEvent` + tool logs no painel |
| Teste automatizado | ✅ | `pnpm --filter ia-admin-panel test` executa Vitest |
| Rate limit | ✅ | Upstash token bucket (5 req/min por usuário) |

## Comandos Úteis

```bash
pnpm install
pnpm dev                 # http://localhost:4321
pnpm --filter ia-admin-panel lint
pnpm --filter ia-admin-panel test
```

