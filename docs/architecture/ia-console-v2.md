# IA Console V2 – Arquitetura

## Objetivo
Disponibilizar um “IA Console V2” para o painel admin capaz de:

- conversar via OpenAI **Responses API** com `stream: true`;
- executar tools MCP expostas pelo `tomik-admin-mcp` já hospedado em Supabase Functions;
- cachear estado quente no **Redis** (Upstash) e persistir histórico em `admin_chat_sessions` + `admin_chat_messages`;
- oferecer governança (auditoria, quotas, telemetria) e UX de streaming no frontend.

## Componentes

| Camada | Responsabilidade | Principais artefatos |
| --- | --- | --- |
| UI (Next.js App Router) | Página `apps/ia-admin-panel/app/(dashboard)/ia-console/v2/page.tsx` reutilizando `ChatClient` + hooks específicos (`useIaConsoleV2`) | Renderização, EventSource para `/api/ai-console-v2/stream`, UI de tool logs |
| API Route Handler | `apps/ia-admin-panel/app/api/ai-console-v2/route.ts` (POST JSON) + `/stream` (GET SSE) | Validação de sessão (`requireStaffSession`), orquestração SSE, escrita Supabase, auditoria |
| Serviços | OpenAI Responses API, Supabase (auth + tables), Upstash Redis, Supabase MCP server (`/functions/v1/mcp-server`) | LLM + tools, storage, cache, tool backend |

## Fluxo de alto nível

1. **UI envia prompt** para `POST /api/ai-console-v2` contendo:
   - `sessionId` opcional (UUID de `admin_chat_sessions`);
   - `messages` visíveis na UI (para fallback caso conversa não tenha `openai_conversation_id`);
   - toggles (ex.: `toolingEnabled`, `useCache`).
2. **Handler**:
   - valida sessão (`requireStaffSession`, `auditAgentEvent`);
   - cria/atualiza registro em `admin_chat_sessions`, escreve mensagem do usuário em `admin_chat_messages`;
   - resolve `openai_conversation_id`:
     - se já existe na sessão → reutiliza no payload Responses API;
     - se não existe → cria conversa via `POST /v1/conversations`, salva `openai_conversation_id` na sessão;
   - gera `response_id` anterior (último `assistant` salvo) para `previous_response_id` quando adequado;
   - grava snapshot no Redis (`ia-console:v2:session:{sessionId}`) com:
     ```json
     {
       "conversationId": "conv_x",
       "previousResponseId": "resp_y",
       "lastToolRun": {...},
       "updatedAt": 1732138123
     }
     ```
     TTL padrão 24h (configurável).
3. **Streaming**:
   - endpoint GET `/api/ai-console-v2/stream?sessionId=X&requestId=Y`;
   - abre ponte SSE com o Responses API (ver seção Streaming) e repassa eventos normalizados (`response.created`, `output_text.delta`, `response.mcp_call_arguments.delta`, etc.);
   - update incremental no Redis (`lastChunk`, `toolState`) e flush final em Supabase (`admin_chat_messages` para assistant, `sessions.updated_at`);
4. **Frontend** consome SSE, atualiza `ChatClient`, mostra tool telemetry (ex.: “Executando `admin_list_users`…”).

## Configuração do payload Responses API

```ts
const payload = {
  model: process.env.OPENAI_RESPONSES_MODEL ?? "gpt-4.1-mini",
  stream: true,
  parallel_tool_calls: true,
  conversation: conversationId,          // opcional (string)
  previous_response_id: prevResponseId,  // opcional
  instructions: systemPrompt,            // inclui governança / papéis
  input: [{ role: "user", content: userMessage }],
  tools: [
    {
      type: "mcp",
      name: "tomik-admin-mcp",
      server: {
        url: `${SUPABASE_FUNCTION_URL}/mcp-server`,
        sse_url: `${SUPABASE_FUNCTION_URL}/mcp-server?transport=sse`,
        headers: {
          Authorization: `Bearer ${process.env.MCP_SERVICE_ROLE_JWT}`,
          "x-admin-secret": process.env.ADMIN_ANALYTICS_SECRET
        }
      }
    }
  ],
  text: { format: { type: "text" } },
  metadata: {
    session_id: sessionId,
    user_id: staffId
  }
};
```

> Observação: `sse_url` atende a novos deltas de tool; se omitido, o Responses API usa `server.url` diretamente (suportado, porém o canal SSE evita polling).

## Redis & Persistência

| Chave | TTL | Conteúdo |
| --- | --- | --- |
| `ia-console:v2:session:{sessionId}` | 24h | JSON com `conversationId`, `previousResponseId`, `lastToolRun`, `thinkingCache` |
| `ia-console:v2:chunks:{requestId}` | 5 min | Buffer dos últimos deltas (útil para reconectar SSE) |

Persistência longa permanece em Supabase:

- `admin_chat_sessions` ganha colunas extras (nova migration):
  - `openai_conversation_id text`;
  - `last_response_id text`;
  - `metadata jsonb default '{}'::jsonb` (logs adicionais).
- `admin_chat_messages` registra cada delta consolidado (um row por mensagem completa). Tool telemetry granular fica em `metadata->tool_logs`.

## Streaming (proxy SSE)

1. Backend cria `AbortController` e requisita `https://api.openai.com/v1/responses/{id}?stream=true`.
2. Usa `ReadableStream` + `TextDecoder` para ler eventos.
3. Para cada evento:
   - normaliza para formato interno `{ type, data }`;
   - envia via `controller.enqueue(encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`))`;
   - atualiza caches (redis + in-memory buffer para persistência final).
4. Tratamento:
   - `response.completed`: salva mensagem final em Supabase.
   - `response.mcp_call.*`: agrega tool logs em `metadata`.
   - `error` ou `response.failed`: envia SSE `event: error`.

## Segurança & Governança

- Apenas sessões autenticadas via `requireStaffSession`.
- Headers MCP incluem `MCP_SERVICE_ROLE_JWT` + `ADMIN_ANALYTICS_SECRET`.
- Limiter Upstash (5 req/60s por usuário) compartilhado com rota atual.
- Auditoria (`auditAgentEvent`) recebe: prompt, sessionId, lista de tools e outputs.
- Feature flag (PostHog) opcional `ia-console-v2-enabled`.

## Próximos Passos

1. Implementar migrations extras (colunas OpenAI em `admin_chat_sessions`).
2. Criar handlers Next (`POST` e `GET` streaming) conforme especificado.
3. Atualizar `ChatClient` com novo modo + hook SSE.
4. Conectar telemetria/logs e fallback para Redis em caso de reconexão.



