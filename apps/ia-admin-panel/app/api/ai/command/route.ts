import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import OpenAI from "openai";
import { requireStaffSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getKairosSystemPrompt } from "@/lib/ai/prompts/kairos-system-prompt";
import { KAIROS_MCP_TOOLS } from "@/lib/ai/kairos-mcp-tools";
import { executeKairosTool } from "@/lib/ai/kairos-tool-handlers";
import { createAiMemory } from "@/lib/kairos/ai-memories";

type UiMessage = {
  role: "user" | "assistant";
  content: string;
};

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const ratelimit =
  redisUrl && redisToken
    ? new Ratelimit({
        redis: new Redis({ url: redisUrl, token: redisToken }),
        limiter: Ratelimit.slidingWindow(10, "60 s"),
      })
    : null;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE,
});

export const maxDuration = 180; // 3 minutes

// Maximum tool execution loops to prevent infinite loops
const MAX_TOOL_LOOPS = 5;

export async function POST(req: Request) {
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

  const body = (await req.json()) as { messages: UiMessage[]; sessionId?: string };
  const messages = body?.messages ?? [];
  let sessionId = body.sessionId;

  const supabase = await createSupabaseServerClient();

  // Create or update session
  if (!sessionId) {
    const firstUserMsg =
      messages.find((m) => m.role === "user")?.content ?? "Nova conversa";
    const title = firstUserMsg.slice(0, 50) + (firstUserMsg.length > 50 ? "..." : "");

    const { data: newSession, error: sessionError } = await supabase
      .from("ai_sessions")
      .insert({
        user_id: session.user.id,
        title,
      })
      .select("id")
      .single();

    if (sessionError || !newSession) {
      console.error("[ai-command] Error creating session:", sessionError);
      return NextResponse.json(
        { error: "Erro ao criar sessão de chat." },
        { status: 500 }
      );
    }
    sessionId = newSession.id;
  } else {
    await supabase
      .from("ai_sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", sessionId);
  }

  // Save user message
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (lastUserMessage && sessionId) {
    await supabase.from("ai_messages").insert({
      session_id: sessionId,
      user_id: session.user.id,
      role: "user",
      content: lastUserMessage.content,
    });
  }

  try {
    const systemPrompt = getKairosSystemPrompt();

    // Build messages for OpenAI
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    // Convert tools to OpenAI format
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = KAIROS_MCP_TOOLS.map(
      (tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })
    );

    let finalReply = "";
    let toolLoops = 0;

    // Agentic loop: keep calling model until no more tool calls
    while (toolLoops < MAX_TOOL_LOOPS) {
      toolLoops++;

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: openaiMessages,
        tools,
        tool_choice: "auto",
        temperature: 0.4,
        max_tokens: 1500,
      });

      const choice = completion.choices[0];

      if (!choice) {
        finalReply = "Não consegui gerar uma resposta agora.";
        break;
      }

      const assistantMessage = choice.message;

      // Check if there are tool calls
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Add assistant message with tool calls to history
        openaiMessages.push({
          role: "assistant",
          content: assistantMessage.content || null,
          tool_calls: assistantMessage.tool_calls,
        });

        // Execute each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown> = {};

          try {
            toolArgs = JSON.parse(toolCall.function.arguments || "{}");
          } catch {
            toolArgs = {};
          }

          console.log(`[ai-command] Executing tool: ${toolName}`, toolArgs);

          // Execute the tool with user_id
          const result = await executeKairosTool(
            toolName,
            toolArgs,
            session.user.id
          );

          // Add tool result to messages
          openaiMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }

        // Continue the loop to let the model process tool results
        continue;
      }

      // No tool calls, we have the final response
      finalReply = assistantMessage.content?.trim() || "Não consegui gerar uma resposta agora.";
      break;
    }

    // If we hit max loops, add a note
    if (toolLoops >= MAX_TOOL_LOOPS && !finalReply) {
      finalReply =
        "Desculpe, precisei processar muitas informações. Tente reformular sua pergunta.";
    }

    // Save assistant message
    if (sessionId) {
      await supabase.from("ai_messages").insert({
        session_id: sessionId,
        user_id: session.user.id,
        role: "assistant",
        content: finalReply,
      });

      await supabase
        .from("ai_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", sessionId);
    }

    // Create a memory of the conversation (summarized)
    // Only if the conversation seems meaningful (not just greetings)
    if (
      finalReply.length > 100 &&
      lastUserMessage &&
      lastUserMessage.content.length > 20
    ) {
      try {
        await createAiMemory(session.user.id, {
          source_type: "chat",
          source_id: sessionId,
          content: finalReply.slice(0, 500),
          tags: ["chat", "resposta-ia"],
        });
      } catch (memoryError) {
        // Don't fail the request if memory creation fails
        console.warn("[ai-command] Failed to create memory:", memoryError);
      }
    }

    return NextResponse.json({ reply: finalReply, sessionId, traceId });
  } catch (error: unknown) {
    console.error("[ai-command]", error);
    const errorMessage = error instanceof Error ? error.message : "Erro inesperado.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
