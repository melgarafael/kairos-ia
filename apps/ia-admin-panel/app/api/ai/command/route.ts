import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { requireStaffSession } from "@/lib/auth/guards";
import { auditAgentEvent, auditMcpToolCallsBatch, type McpToolAuditPayload } from "@/lib/observability/audit";

type UiMessage = {
  role: "user" | "assistant";
  content: string;
};

const N8N_WEBHOOK_URL = "https://automatiklabs.app.n8n.cloud/webhook/mcp-tomik-agent-manager";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const ratelimit =
  redisUrl && redisToken
    ? new Ratelimit({
      redis: new Redis({ url: redisUrl, token: redisToken }),
      limiter: Ratelimit.slidingWindow(5, "60 s")
    })
    : null;

import { createSupabaseServerClient } from "@/lib/supabase/server";


export const maxDuration = 180; // 3 minutes

export async function POST(req: Request) {
  // Generate trace ID for this request
  const traceId = crypto.randomUUID();
  
  let session;
  try {
    session = await requireStaffSession({ redirectOnFail: false });
  } catch {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (ratelimit) {
    const limit = await ratelimit.limit(session.user.id);
    if (!limit.success) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde alguns segundos." },
        { status: 429 }
      );
    }
  }

  const body = (await req.json()) as { messages: UiMessage[]; sessionId?: string; attachment?: any };
  const messages = body?.messages ?? [];
  let sessionId = body.sessionId;
  const attachment = body.attachment;

  // Prepare database interaction
  const supabase = await createSupabaseServerClient();

  // Ensure session exists or create one
  if (!sessionId) {
    const role =
      (session.user.user_metadata?.role as string) ??
      session.user.app_metadata?.role ??
      "staff";

    // Create a title from the first user message (truncate to 50 chars)
    const firstUserMsg = messages.find((m) => m.role === "user")?.content ?? "Nova conversa";
    const title = firstUserMsg.slice(0, 50) + (firstUserMsg.length > 50 ? "..." : "");

    const { data: newSession, error: sessionError } = await supabase
      .from("admin_chat_sessions")
      .insert({
        user_id: session.user.id,
        user_email: session.user.email,
        user_role: role,
        title: title
      })
      .select("id")
      .single();

    if (sessionError) {
      console.error("[ai-command] Error creating session:", sessionError);
      return NextResponse.json({ error: "Erro ao criar sessão de chat." }, { status: 500 });
    }
    sessionId = newSession.id;
  }

  // Get the latest user message to save
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

  if (lastUserMessage) {
    await supabase.from("admin_chat_messages").insert({
      session_id: sessionId,
      role: "user",
      content: lastUserMessage.content
    });
  }

  try {
    const result = await callN8nWebhook({
      messages,
      userId: session.user.id,
      attachment,
      sessionId
    });

    // Save assistant response
    if (sessionId) {
      await supabase.from("admin_chat_messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: result.reply
      });
      
      // Update session timestamp
      await supabase
        .from("admin_chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", sessionId);
    }

    await auditAgentEvent({
      user_id: session.user.id,
      event: "ai_command",
      metadata: {
        toolLogs: result.toolLogs ?? [],
        sessionId,
        traceId
      }
    });

    // Log granular MCP tool calls to admin_mcp_audit table
    if (result.toolLogs && result.toolLogs.length > 0) {
      const mcpAuditPayloads: McpToolAuditPayload[] = result.toolLogs.map((log) => ({
        user_id: session.user.id,
        session_id: sessionId,
        tool_name: log.tool || "unknown",
        arguments: log.args || {},
        result: typeof log.output === "string" ? { output: log.output } : (log.output || {}),
        success: !log.error,
        error: log.error || undefined,
        source: "api" as const,
        trace_id: traceId
      }));
      
      auditMcpToolCallsBatch(mcpAuditPayloads).catch(console.error);
    }

    return NextResponse.json({ ...result, sessionId, traceId });
  } catch (error: any) {
    console.error("[ai-command]", error);
    return NextResponse.json(
      { error: error?.message ?? "Erro inesperado." },
      { status: 500 }
    );
  }
}

async function callN8nWebhook({
  messages,
  userId,
  attachment,
  sessionId
}: {
  messages: UiMessage[];
  userId: string;
  attachment?: any;
  sessionId?: string;
}) {
  // Pegar apenas a última mensagem do usuário (a mais recente)
  const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
  const userMessage = lastUserMessage?.content || "";

  if (!userMessage) {
    throw new Error("Nenhuma mensagem do usuário encontrada.");
  }

  // Limpar o base64 do anexo se existir
  if (attachment && attachment.content && typeof attachment.content === "string") {
    // Remove o prefixo data:image/png;base64, ou data:text/csv;base64, etc
    // Para que o n8n receba apenas o raw base64
    const base64Data = attachment.content.replace(/^data:([A-Za-z-+/]+);base64,/, "");
    attachment.content = base64Data;
  }

  console.log(`[ai-command] Calling n8n webhook with message:`, userMessage);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: userMessage,
        userId,
        sessionId,
        conversationHistory: messages.slice(-10), // Enviar últimas 10 mensagens para contexto
        attachment
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      if (response.status === 524) {
        console.error(`[ai-command] n8n webhook timeout (524)`);
        throw new Error("O agente demorou muito para responder (Timeout). Tente simplificar a solicitação ou tente novamente mais tarde.");
      }
      const errorText = await response.text();
      console.error(`[ai-command] n8n webhook error:`, response.status, errorText);
      throw new Error(`Erro ao chamar webhook n8n: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[ai-command] n8n webhook response:`, JSON.stringify(data, null, 2).substring(0, 500));

    // Processar resposta do n8n
    // O n8n pode retornar em diferentes formatos, vamos tentar os mais comuns
    let reply = "";
    let toolLogs: Array<{
      tool: string;
      args: Record<string, any>;
      output: string | Record<string, any>;
      error?: string;
    }> = [];

    // Função auxiliar para extrair texto de uma string que pode ser JSON
    function extractText(value: any): string {
      if (typeof value === "string") {
        // Se for uma string que parece JSON, tenta fazer parse
        const trimmed = value.trim();
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
          try {
            const parsed = JSON.parse(trimmed);
            // Se parseou, tenta extrair campos comuns
            if (typeof parsed === "object" && parsed !== null) {
              return parsed.output || parsed.reply || parsed.response || parsed.message || parsed.text || value;
            }
          } catch {
            // Se não conseguiu fazer parse, retorna a string original
            return value;
          }
        }
        return value;
      }
      return String(value);
    }

    // Se a resposta for uma string simples
    if (typeof data === "string") {
      reply = extractText(data);
    }
    // Se for um objeto com 'reply', 'response', 'message', 'text' ou 'output'
    else if (typeof data === "object" && data !== null) {
      const possibleReply = data.output || data.reply || data.response || data.message || data.text;
      
      if (possibleReply) {
        reply = extractText(possibleReply);
      } else {
        // Se não encontrou nenhum campo conhecido, tenta stringify mas com fallback melhor
        reply = JSON.stringify(data);
      }
      
      // Se houver toolLogs na resposta
      if (data.toolLogs && Array.isArray(data.toolLogs)) {
        toolLogs = data.toolLogs;
      }
    }
    // Fallback
    else {
      reply = extractText(String(data));
    }

    return {
      reply: reply.trim() || "Não recebi uma resposta válida do agente.",
      toolLogs
    };
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("O agente demorou mais de 3 minutos para responder.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

