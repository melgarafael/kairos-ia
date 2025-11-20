# Fix: Erro "Unknown response for startup: N" no client-schema-updater-proxy

## Problema

Alguns usuários estão recebendo o erro:
```
{ok: false, error: "Unknown response for startup: N"}
```

Este erro ocorre quando a função `client-schema-updater-proxy` tenta executar SQL no Supabase do cliente através do endpoint `/postgres/v1/query`, mas recebe uma resposta inesperada (provavelmente binária do protocolo PostgreSQL) em vez de JSON.

## Causa Raiz

O erro "Unknown response for startup: N" indica que:

1. **O endpoint `/postgres/v1/query` pode não estar habilitado** no projeto Supabase do cliente
2. **A service role key pode estar incorreta ou inválida**
3. **O endpoint pode estar retornando uma resposta binária** (protocolo PostgreSQL) em vez de JSON

O endpoint `/postgres/v1/query` é um endpoint interno do Supabase usado pelo Supabase Studio para executar SQL via HTTP. Ele pode não estar disponível em todos os projetos ou pode estar desabilitado por padrão.

## Solução

### 1. Verificar a Service Role Key

Certifique-se de que a service role key configurada está correta:

1. No Supabase do cliente, vá em **Settings** → **API**
2. Copie a **service_role** key (não a anon key)
3. Verifique se ela está corretamente configurada na organização ou nas conexões

### 2. Verificar se o Endpoint está Acessível

O endpoint `/postgres/v1/query` deve estar acessível. Você pode testar manualmente:

```bash
curl -X POST "https://<project-ref>.supabase.co/postgres/v1/query" \
  -H "Content-Type: application/json" \
  -H "apikey: <service-role-key>" \
  -H "Authorization: Bearer <service-role-key>" \
  -d '{"query": "SELECT 1"}'
```

Se retornar JSON, o endpoint está funcionando. Se retornar erro ou resposta binária, há um problema de configuração.

### 3. Alternativa: Usar Edge Function no Cliente

Se o endpoint `/postgres/v1/query` não estiver disponível, você pode usar a abordagem alternativa com Edge Function:

1. Crie a Edge Function `client-schema-updater` no projeto do cliente
2. Configure a secret `DATABASE_URL` ou `SUPABASE_DB_URL`
3. A função `client-schema-updater-proxy` tentará usar a Edge Function como fallback

### 4. Verificar Configurações do Projeto

Algumas configurações podem afetar a disponibilidade do endpoint:

- **Network Restrictions**: Verifique se há restrições de rede que bloqueiam o endpoint
- **Project Status**: Certifique-se de que o projeto está ativo e não pausado
- **API Settings**: Verifique as configurações de API no dashboard do Supabase

## Melhorias Implementadas

A função `client-schema-updater-proxy` foi atualizada para:

1. **Detectar respostas não-JSON** antes de tentar fazer parse
2. **Capturar o content-type** da resposta para debug
3. **Fornecer mensagens de erro mais descritivas** que explicam o problema
4. **Detectar especificamente o erro "Unknown response for startup: N"** e fornecer orientações

## Mensagens de Erro Melhoradas

Agora, quando o erro ocorrer, você receberá uma mensagem mais útil como:

```
PostgreSQL protocol error detected. The /postgres/v1/query endpoint may not be enabled in this Supabase project, or the service role key is invalid. Please verify: 1) The endpoint is enabled in your Supabase project settings, 2) The service role key is correct and has proper permissions.
```

## Próximos Passos

Se o problema persistir após verificar a service role key:

1. Entre em contato com o suporte do Supabase para verificar se o endpoint está habilitado no projeto
2. Considere usar a abordagem alternativa com Edge Function (`client-schema-updater`)
3. Verifique os logs do Supabase para mais detalhes sobre o erro

## Referências

- [Supabase API Documentation](https://supabase.com/docs/reference/api)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)














