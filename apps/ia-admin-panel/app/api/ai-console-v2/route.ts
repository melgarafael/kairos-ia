import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { auditAgentEvent } from "@/lib/observability/audit";
import {
  cacheSet,
  isLangCacheEnabled,
  consumeRateLimit
} from "@/lib/cache/langcache";

type UiMessage = {
  role: "user" | "assistant";
  content: string;
};

type ConsoleRequestBody = {
  messages: UiMessage[];
  sessionId?: string;
  options?: {
    model?: string;
    temperature?: number;
  };
};

const REQUEST_KEY_PREFIX = "ia-console:v2:request";
const REQUEST_TTL_SECONDS = 60 * 5;
const SESSION_CACHE_PREFIX = "ia-console:v2:session";
const SESSION_CACHE_TTL_SECONDS = 60 * 60 * 24;
const FEATURE_FLAG_ENABLED =
  (process.env.FEATURE_IA_CONSOLE_V2 ?? process.env.NEXT_PUBLIC_FEATURE_IA_CONSOLE_V2) === "true";

export async function POST(req: Request) {
  if (!FEATURE_FLAG_ENABLED) {
    return NextResponse.json(
      { error: "IA Console V2 desabilitado neste ambiente." },
      { status: 403 }
    );
  }

  if (!isLangCacheEnabled()) {
    return NextResponse.json(
      { error: "LangCache não configurado. Defina LANGCACHE_* no ambiente." },
      { status: 500 }
    );
  }

  const session = await requireStaffSession({ redirectOnFail: false }).catch(() => null);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const rateLimit = await consumeRateLimit(session.user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Muitas requisições. Aguarde alguns segundos."
      },
      {
        status: 429,
        headers: {
          "Retry-After": `${Math.ceil((rateLimit.resetAt - Date.now()) / 1000)}`
        }
      }
    );
  }

  const body = (await req.json().catch(() => null)) as ConsoleRequestBody | null;
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const messages = normalizeMessages(body.messages);
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

  if (!lastUserMessage) {
    return NextResponse.json({ error: "Mensagem do usuário não encontrada." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  let sessionId = body.sessionId;
  let openaiConversationId: string | null = null;
  let lastResponseId: string | null = null;

  if (sessionId) {
    const { data, error } = await supabase
      .from("admin_chat_sessions")
      .select("id, openai_conversation_id, last_response_id")
      .eq("id", sessionId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Sessão não encontrada ou acesso negado." }, { status: 404 });
    }

    openaiConversationId = data.openai_conversation_id ?? null;
    lastResponseId = data.last_response_id ?? null;
  } else {
    const role =
      (session.user.user_metadata?.role as string | undefined) ??
      (session.user.app_metadata?.role as string | undefined) ??
      "staff";
    const titleBase = lastUserMessage.content.trim() || "Nova conversa";
    const title = titleBase.slice(0, 80) + (titleBase.length > 80 ? "..." : "");

    const { data, error } = await supabase
      .from("admin_chat_sessions")
      .insert({
        user_id: session.user.id,
        user_email: session.user.email,
        user_role: role,
        title,
        metadata: {
          created_by_console: "v2",
          created_at_epoch: Date.now()
        }
      })
      .select("id, openai_conversation_id, last_response_id")
      .single();

    if (error || !data) {
      console.error("[ia-console-v2] Falha ao criar sessão:", error);
      return NextResponse.json({ error: "Erro ao criar sessão." }, { status: 500 });
    }

    sessionId = data.id;
    openaiConversationId = data.openai_conversation_id ?? null;
    lastResponseId = data.last_response_id ?? null;
  }

  // Persistir mensagem do usuário
  const { error: messageError } = await supabase.from("admin_chat_messages").insert({
    session_id: sessionId,
    role: "user",
    content: lastUserMessage.content,
    metadata: {
      source: "ia-console-v2",
      created_at_epoch: Date.now()
    }
  });

  if (messageError) {
    console.error("[ia-console-v2] Erro ao salvar mensagem:", messageError);
    return NextResponse.json({ error: "Erro ao salvar mensagem." }, { status: 500 });
  }

  await supabase
    .from("admin_chat_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  await cacheSet(
    `${SESSION_CACHE_PREFIX}:${sessionId}`,
    {
      conversationId: openaiConversationId,
      lastResponseId,
      updatedAt: Date.now()
    },
    SESSION_CACHE_TTL_SECONDS
  );

  const requestId = crypto.randomUUID();
  const requestPayload = {
    sessionId,
    userId: session.user.id,
    userEmail: session.user.email,
    userRole:
      (session.user.user_metadata?.role as string | undefined) ??
      (session.user.app_metadata?.role as string | undefined) ??
      "staff",
    conversationId: openaiConversationId,
    previousResponseId: lastResponseId,
    userMessage: lastUserMessage.content,
    messages,
    options: body.options ?? {},
    createdAt: Date.now()
  };

  await cacheSet(`${REQUEST_KEY_PREFIX}:${requestId}`, requestPayload, REQUEST_TTL_SECONDS);

  await auditAgentEvent({
    user_id: session.user.id,
    event: "ia_console_v2.request",
    metadata: {
      sessionId,
      requestId,
      cachedConversation: Boolean(openaiConversationId),
      hasPreviousResponse: Boolean(lastResponseId)
    }
  });

  return NextResponse.json({
    sessionId,
    requestId
  });
}

function normalizeMessages(messages: UiMessage[]): UiMessage[] {
  const trimmed = messages.slice(-20);
  return trimmed.map((msg) => ({
    role: msg.role,
    content: msg.content?.toString() ?? ""
  }));
}


