# Toolkit de Automação

## Templates (n8n / Supabase Nodes)
- Biblioteca com JSONs prontos: criar/atualizar/remover/listar `lead`, `client`, `appointment`, `entrada`, `saida`, `produto_servico`.
- Passos gerais:
  1) Copie o JSON do template na aba Templates.
  2) Ajuste `organization_id` e campos obrigatórios.
  3) Cole no n8n (HTTP Request / Supabase node) e conecte ao seu fluxo.

## Webhooks de eventos do app
- Eventos suportados (exemplos):
  - Agendamento criado/atualizado, lembretes
  - Cliente criado/atualizado
  - Lead mudou de estágio
  - Pagamento/entrada registrada
- Configurações: método, autenticação (API Key/Bearer), retries, rate limit e timeout.
- Teste integrado: envie payload de teste e verifique resposta.

## Agentes de IA — mini contexto
- Regras:
  - Sempre incluir `organization_id` nas operações.
  - Datas em ISO 8601.
  - Não inventar IDs — buscar/filtrar e usar o ID retornado.
- Exemplo de instrução curta:
```
Você controla operações no TomikCRM usando nodes Supabase. Ao criar um agendamento, envie:
{
  organization_id, client_id OU lead_id (nunca ambos), collaborator_id,
  datetime (ISO), duration_minutes, tipo, status
}
Valide campos obrigatórios antes de chamar. Nunca exponha chaves.
```

## Boas práticas
- Versione seus templates e documente dependências.
- Use filtros por período/estágio/colaborador para limitar carga.
- Faça dry-run em ambiente de teste antes de produção.
e func