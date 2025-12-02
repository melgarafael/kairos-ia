import { requireStaffSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { auditAgentEvent } from "@/lib/observability/audit";
import {
  cacheGet,
  cacheSet,
  cacheDelete,
  isLangCacheEnabled
} from "@/lib/cache/langcache";

type UiMessage = {
  role: "user" | "assistant";
  content: string;
};

type StoredRequest = {
  sessionId: string;
  userId: string;
  userEmail: string | null;
  userRole: string;
  conversationId: string | null;
  previousResponseId: string | null;
  userMessage: string;
  messages: UiMessage[];
  options?: {
    model?: string;
    temperature?: number;
  };
  createdAt: number;
};

type ToolLogEntry = {
  type: string;
  data: Record<string, unknown>;
  at: number;
};

const REQUEST_KEY_PREFIX = "ia-console:v2:request";
const SESSION_CACHE_PREFIX = "ia-console:v2:session";
const SESSION_CACHE_TTL_SECONDS = 60 * 60 * 24;
const FEATURE_FLAG_ENABLED =
  (process.env.FEATURE_IA_CONSOLE_V2 ?? process.env.NEXT_PUBLIC_FEATURE_IA_CONSOLE_V2) === "true";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_RESPONSES_MODEL = process.env.OPENAI_RESPONSES_MODEL ?? "gpt-5.1";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_CONVERSATIONS_URL = "https://api.openai.com/v1/conversations";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const DEFAULT_MCP_SERVER_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/mcp-server` : "";
const MCP_SERVER_URL = process.env.MCP_SERVER_URL ?? DEFAULT_MCP_SERVER_URL;
const MCP_SSE_URL = MCP_SERVER_URL ? `${MCP_SERVER_URL}?transport=sse` : "";
const MCP_AUTH_TOKEN =
  process.env.MCP_SERVICE_ROLE_JWT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const MCP_ADMIN_SECRET = process.env.ADMIN_ANALYTICS_SECRET ?? "";

const SYSTEM_PROMPT = `
Você é o IA Console V2 (admin-copilot) responsável por diagnosticar e executar ações
em usuários e organizações do Tomik. Priorize:
1. Confirmar contexto antes de agir.
2. Explicar ações e checagens.
3. Registrar toda execução de tools.
4. Pedir confirmação quando houver risco (ex: update_user).
Responda em português, com tom profissional, e sempre cite dados relevantes retornados pelas tools.
`.trim();

if (!OPENAI_API_KEY) {
  console.warn("[ia-console-v2][stream] OPENAI_API_KEY não configurada.");
}

export async function GET(req: Request) {
  if (!isLangCacheEnabled()) {
    return new Response("LangCache não configurado.", { status: 500 });
  }

  if (!FEATURE_FLAG_ENABLED) {
    return new Response("IA Console V2 desabilitado neste ambiente.", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get("requestId");

  if (!requestId) {
    return new Response("requestId obrigatório.", { status: 400 });
  }

  const session = await requireStaffSession({ redirectOnFail: false }).catch(() => null);
  if (!session) {
    return new Response("Não autorizado.", { status: 401 });
  }

  const requestCache = await cacheGet<StoredRequest>(`${REQUEST_KEY_PREFIX}:${requestId}`);
  if (!requestCache) {
    return new Response("Requisição expirada.", { status: 410 });
  }

  if (requestCache.userId !== session.user.id) {
    return new Response("Proibido.", { status: 403 });
  }

  const supabase = await createSupabaseServerClient();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (type: string, payload: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${type}\ndata: ${JSON.stringify(payload ?? {})}\n\n`)
        );
      };

        if (!OPENAI_API_KEY) {
          send("error", { message: "OPENAI_API_KEY ausente." });
          await cacheDelete(`${REQUEST_KEY_PREFIX}:${requestId}`);
          controller.close();
          return;
        }

      let assistantText = "";
      let responseId: string | null = requestCache.previousResponseId ?? null;
      let conversationId = requestCache.conversationId ?? null;
      const toolLogs: ToolLogEntry[] = [];
      const abortController = new AbortController();

      try {
        send("start", {
          sessionId: requestCache.sessionId,
          requestId
        });

        if (!conversationId) {
          conversationId = await createConversation({
            sessionId: requestCache.sessionId,
            userId: requestCache.userId,
            userEmail: requestCache.userEmail
          });

          await supabase
            .from("admin_chat_sessions")
            .update({ openai_conversation_id: conversationId })
            .eq("id", requestCache.sessionId);
        }

        await cacheSet(
          `${SESSION_CACHE_PREFIX}:${requestCache.sessionId}`,
          {
            conversationId,
            lastResponseId: responseId,
            updatedAt: Date.now()
          },
          SESSION_CACHE_TTL_SECONDS
        );

        const payload = buildResponsesPayload({
          conversationId,
          userMessage: requestCache.userMessage,
          sessionId: requestCache.sessionId,
          userId: requestCache.userId,
          model: requestCache.options?.model ?? OPENAI_RESPONSES_MODEL,
          temperature: clampTemperature(requestCache.options?.temperature)
        });

        const openAiResponse = await fetch(OPENAI_RESPONSES_URL, {
          method: "POST",
          headers: buildOpenAiHeaders(),
          body: JSON.stringify(payload),
          signal: abortController.signal
        });

        if (!openAiResponse.ok || !openAiResponse.body) {
          const detail = await openAiResponse.text().catch(() => "");
          send("error", { message: "Erro ao chamar OpenAI Responses API.", detail });
          return;
        }

        const reader = openAiResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const normalized = buffer.replace(/\r\n/g, "\n");
          const { events, pending } = extractEvents(normalized);
          buffer = pending;

          for (const evt of events) {
            if (!evt.data) continue;
            const parsedData = parseJson(evt.data);
            send(evt.type || "message", parsedData ?? { raw: evt.data });
            handleOpenAiEvent(evt.type, parsedData, {
              appendText: (delta) => {
                assistantText += delta;
              },
              setFullText: (text) => {
                assistantText = text ?? assistantText;
              },
              setResponseId: (id) => {
                if (id) responseId = id;
              },
              pushToolLog: (entry) => {
                toolLogs.push({
                  type: entry.type,
                  data: entry.data ?? {},
                  at: Date.now()
                });
              }
            });
          }
        }

        await persistAssistantMessage({
          supabase,
          sessionId: requestCache.sessionId,
          responseId,
          content: assistantText.trim(),
          toolLogs
        });

        await cacheSet(
          `${SESSION_CACHE_PREFIX}:${requestCache.sessionId}`,
          {
            conversationId,
            lastResponseId: responseId,
            updatedAt: Date.now()
          },
          SESSION_CACHE_TTL_SECONDS
        );

        await auditAgentEvent({
          user_id: session.user.id,
          event: "ia_console_v2.response",
          metadata: {
            sessionId: requestCache.sessionId,
            requestId,
            responseId,
            toolLogsCount: toolLogs.length
          }
        });

        send("done", {
          sessionId: requestCache.sessionId,
          responseId
        });
      } catch (error) {
        console.error("[ia-console-v2][stream] Error detail:", error);
        send("error", { message: (error as Error).message });
      } finally {
        abortController.abort();
        await cacheDelete(`${REQUEST_KEY_PREFIX}:${requestId}`);
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

function clampTemperature(value?: number) {
  if (typeof value !== "number") return 0.2;
  if (value < 0) return 0;
  if (value > 2) return 2;
  return value;
}

function buildOpenAiHeaders(): HeadersInit {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não configurada.");
  }
  return {
    Authorization: `Bearer ${OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  };
}

async function createConversation(params: {
  sessionId: string;
  userId: string;
  userEmail: string | null;
}) {
  const res = await fetch(OPENAI_CONVERSATIONS_URL, {
    method: "POST",
    headers: buildOpenAiHeaders(),
    body: JSON.stringify({
      metadata: {
        session_id: params.sessionId,
        user_id: params.userId,
        user_email: params.userEmail ?? undefined
      }
    })
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Erro ao criar conversa OpenAI: ${detail}`);
  }

  const data = await res.json();
  return data.id as string;
}

function buildResponsesPayload(args: {
  conversationId: string;
  userMessage: string;
  sessionId: string;
  userId: string;
  model: string;
  temperature: number;
}) {
  const mcpTool = MCP_SERVER_URL
    ? {
        type: "mcp",
        name: "tomik-admin-mcp",
        server: {
          url: MCP_SERVER_URL,
          sse_url: MCP_SSE_URL,
          headers: {
            Authorization: MCP_AUTH_TOKEN ? `Bearer ${MCP_AUTH_TOKEN}` : undefined,
            "x-admin-secret": MCP_ADMIN_SECRET || undefined
          }
        }
      }
    : null;

  return {
    model: args.model,
    stream: true,
    parallel_tool_calls: true,
    conversation: args.conversationId,
    instructions: SYSTEM_PROMPT,
    input: [
      {
        role: "user",
        content: args.userMessage
      }
    ],
    metadata: {
      session_id: args.sessionId,
      user_id: args.userId
    },
    temperature: args.temperature,
    tools: mcpTool ? [mcpTool] : [],
    text: {
      format: {
        type: "text"
      }
    }
  };
}

function extractEvents(buffer: string) {
  const events: Array<{ type: string; data: string }> = [];
  let remaining = buffer;

  while (true) {
    const idx = remaining.indexOf("\n\n");
    if (idx === -1) break;

    const block = remaining.slice(0, idx);
    remaining = remaining.slice(idx + 2);

    const parsed = parseEventBlock(block);
    if (parsed) {
      events.push(parsed);
    }
  }

  return { events, pending: remaining };
}

function parseEventBlock(block: string) {
  const lines = block.split("\n");
  let type = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.startsWith("event:")) {
      type = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (!dataLines.length) return null;
  return { type, data: dataLines.join("\n") };
}

function parseJson(payload: string) {
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function handleOpenAiEvent(
  type: string | undefined,
  data: any,
  handlers: {
    appendText: (delta: string) => void;
    setFullText: (text?: string) => void;
    setResponseId: (id?: string) => void;
    pushToolLog: (entry: { type: string; data: any }) => void;
  }
) {
  if (!type) return;

  switch (type) {
    case "response.created":
    case "response.in_progress":
      handlers.setResponseId(data?.response?.id);
      break;
    case "response.completed":
      handlers.setResponseId(data?.response?.id);
      break;
    case "response.output_text.delta":
      if (typeof data?.delta === "string") {
        handlers.appendText(data.delta);
      } else if (typeof data?.text === "string") {
        handlers.appendText(data.text);
      }
      break;
    case "response.output_text.done":
      if (typeof data?.text === "string") {
        handlers.setFullText(data.text);
      }
      break;
    default:
      if (type.startsWith("response.mcp_call")) {
        handlers.pushToolLog({ type, data });
      }
      break;
  }
}

async function persistAssistantMessage(args: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  sessionId: string;
  responseId: string | null;
  content: string;
  toolLogs: ToolLogEntry[];
}) {
  if (args.content) {
    const { error } = await args.supabase.from("admin_chat_messages").insert({
      session_id: args.sessionId,
      role: "assistant",
      content: args.content,
      metadata: {
        source: "ia-console-v2",
        tool_logs: args.toolLogs
      }
    });
    if (error) {
      console.error("[ia-console-v2] Erro ao salvar resposta:", error);
    }
  }

  const { error: sessionError } = await args.supabase
    .from("admin_chat_sessions")
    .update({
      updated_at: new Date().toISOString(),
      last_response_id: args.responseId
    })
    .eq("id", args.sessionId);

  if (sessionError) {
    console.error("[ia-console-v2] Erro ao atualizar sessão:", sessionError);
  }
}


