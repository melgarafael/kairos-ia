# Segurança

## Segredos e chaves
- Master Supabase: `ANON_KEY` no front; `SERVICE_ROLE_KEY` apenas nas Edge Functions.
- Client Supabase: armazenado hoje em Base64 (`btoa/atob`) no Master — NÃO logar, mascarar em UI. Roadmap: KMS/Secrets + rotação.
- OpenAI/Stripe: somente nas Edge Functions.

## RLS / Multi-tenant
- Todas as tabelas de dados no Client devem aplicar política por `organization_id`.
- O front ainda filtra por `organization_id` para reduzir exposição.

## CORS e headers
- Edge Functions definem `CORS_ORIGINS`. Não usar `*` em produção quando possível.

## Roadmap de hardening
- Migrar Base64 para KMS/Secrets (armazenamento/rotação/auditoria).
- Revisão de RLS e testes de acesso por tabela.
- Observabilidade de segurança (logs e alertas para erros de auth).
- Playbooks de incidente e revogação de chaves.
