/**
 * Kairos IA - Streaming API Route
 * 
 * Implementa streaming em tempo real com agentic loop para tool calling.
 * Mentora de Human Design com experiência mágica de streaming.
 * 
 * MODELO: gpt-5.1 (mais recente)
 * 
 * Features:
 * - Streaming de texto em tempo real
 * - Reasoning summary (pensamento da IA visível)
 * - Agentic loop com tool calling
 * - Status humanizados para cada tool
 * - Eventos detalhados para UI mágica
 * 
 * Eventos SSE:
 * - init: Início do stream com traceId
 * - thinking: Status humanizado ("Conectando com seu design...")
 * - reasoning: Pensamento da IA (reasoning summary)
 * - loop_start: Início de uma iteração do loop
 * - model_call: Chamada ao modelo
 * - t: Delta de texto (streaming)
 * - tool_executing: Tool em execução
 * - tool_result: Resultado de uma tool
 * - tool_error: Erro em uma tool
 * - usage: Uso de tokens
 * - done: Stream finalizado
 * - err: Erro geral
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireStaffSession } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { KAIROS_MCP_TOOLS, getKairosToolCategory } from '@/lib/ai/kairos-mcp-tools';
import { executeKairosTool } from '@/lib/ai/kairos-tool-handlers';
import { getKairosSystemPrompt } from '@/lib/ai/prompts/kairos-system-prompt';

// Types
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ToolCall {
  name: string;
  call_id: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

interface StreamRequest {
  messages: ChatMessage[];
  sessionId?: string;
}

// Config - GPT-5.1 é o modelo mais recente
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = 'gpt-5.1'; // Modelo mais recente da OpenAI
const MAX_AGENTIC_LOOPS = 3; // Reduzido de 5 para 3 para evitar loops infinitos

// Initialize OpenAI
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// Convert MCP tools to OpenAI Responses API format
const RESPONSES_TOOLS = KAIROS_MCP_TOOLS.map(tool => ({
  type: 'function' as const,
  name: tool.name,
  description: tool.description,
  parameters: tool.parameters,
  strict: false
}));

/**
 * Get humanized thinking message based on tool name
 * Creates a magical experience by describing what Kairos is doing
 */
function getHumanizedThinkingMessage(toolName: string): string {
  const messages: Record<string, string> = {
    kairos_getHumanDesignProfile: '✨ Conectando com seu Human Design...',
    kairos_getDailyLogs: '📅 Acessando seus registros recentes...',
    kairos_createDailyLog: '📝 Registrando seu check-in do dia...',
    kairos_getMemories: '🧠 Buscando memórias de nossas conversas...',
    kairos_createMemory: '💫 Guardando este insight para o futuro...',
    kairos_searchHdLibrary: '📚 Consultando a biblioteca de Human Design...',
    kairos_getSessionMessages: '💬 Recuperando contexto de conversas anteriores...'
  };

  return messages[toolName] || `🔧 Processando ${toolName}...`;
}

/**
 * Build conversation input from messages
 */
function buildConversationInput(messages: ChatMessage[]): string {
  const parts: string[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      parts.push(`Usuário: ${msg.content}`);
    } else if (msg.role === 'assistant') {
      parts.push(`Kairos: ${msg.content}`);
    }
  }

  return parts.join('\n\n');
}

/**
 * Save message to database
 */
async function saveMessage(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  sessionId: string,
  userId: string,
  role: string,
  content: string,
  metadata?: { tool_calls?: ToolCall[] }
) {
  try {
    console.log(`[kairos-stream] Saving ${role} message to session ${sessionId}`);
    
    // First try with metadata (if column exists)
    const insertData: Record<string, unknown> = {
      session_id: sessionId,
      user_id: userId,
      role,
      content
    };
    
    // Only add metadata if provided (column may not exist in older schemas)
    if (metadata) {
      insertData.metadata = metadata;
    }
    
    let result = await supabase.from('ai_messages').insert(insertData).select('id').single();

    // If metadata column doesn't exist, retry without it
    if (result.error?.code === 'PGRST204' && result.error?.message?.includes('metadata')) {
      console.log('[kairos-stream] Retrying without metadata column...');
      const { metadata: _, ...insertWithoutMetadata } = insertData;
      result = await supabase.from('ai_messages').insert({
        session_id: sessionId,
        user_id: userId,
        role,
        content
      }).select('id').single();
    }

    if (result.error) {
      console.error('[kairos-stream] Supabase error saving message:', result.error);
      return null;
    }
    
    console.log(`[kairos-stream] Message saved successfully: ${result.data?.id}`);
    return result.data?.id;
  } catch (err) {
    console.error('[kairos-stream] Exception saving message:', err);
    return null;
  }
}

/**
 * Create or get session
 */
async function ensureSession(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  existingSessionId?: string
): Promise<string> {
  if (existingSessionId) {
    // Update session timestamp
    await supabase
      .from('ai_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', existingSessionId);
    return existingSessionId;
  }

  const { data, error } = await supabase
    .from('ai_sessions')
    .insert({
      user_id: userId,
      title: 'Nova conversa com Kairos'
    })
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar sessão: ${error.message}`);
  return data.id;
}

/**
 * Update session title based on first message
 */
async function updateSessionTitle(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  sessionId: string,
  firstMessage: string
) {
  const title = firstMessage.length > 50 ? firstMessage.slice(0, 47) + '...' : firstMessage;
  await supabase.from('ai_sessions').update({ title }).eq('id', sessionId);
}

// CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Main POST handler
export async function POST(request: NextRequest) {
  const traceId = crypto.randomUUID();

  if (!openai) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY não configurada.' },
      { status: 500, headers: { 'x-trace-id': traceId } }
    );
  }

  try {
    // Authenticate user
    const session = await requireStaffSession({ redirectOnFail: false }).catch(() => null);
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado.' },
        { status: 401, headers: { 'x-trace-id': traceId } }
      );
    }

    const supabase = await createSupabaseServerClient();
    const body: StreamRequest = await request.json();
    const { messages = [], sessionId: existingSessionId } = body;

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'messages required' },
        { status: 400, headers: { 'x-trace-id': traceId } }
      );
    }

    // Ensure session exists
    const sessionId = await ensureSession(supabase, session.user.id, existingSessionId);

    // Update title if new session
    if (!existingSessionId) {
      const firstUserMessage = messages.find(m => m.role === 'user');
      if (firstUserMessage) {
        await updateSessionTitle(supabase, sessionId, firstUserMessage.content);
      }
    }

    // Save user message
    const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0];
    if (lastUserMessage && lastUserMessage.content) {
      await saveMessage(
        supabase, 
        sessionId, 
        session.user.id,
        'user', 
        lastUserMessage.content
      );
    }

    // Build conversation input
    const conversationInput = buildConversationInput(messages);
    const systemPrompt = getKairosSystemPrompt();

    // Create streaming response
    const encoder = new TextEncoder();
    
    const streamResponse = new ReadableStream({
      async start(controller) {
        try {
          // Send init event
          controller.enqueue(encoder.encode(JSON.stringify({ 
            k: 'init', 
            traceId, 
            sessionId,
            model: OPENAI_MODEL
          }) + '\n'));

          // Send initial thinking message
          controller.enqueue(encoder.encode(JSON.stringify({ 
            k: 'thinking',
            thinking: '✨ Sintonizando com sua energia...'
          }) + '\n'));

          // Agentic Loop State
          let fullContent = '';
          const allToolCalls: ToolCall[] = [];
          let loopCount = 0;
          let currentInput: string = conversationInput;
          let reasoningSummary = '';
          
          // Track executed tools to prevent duplicates (anti-loop protection)
          const executedToolNames = new Set<string>();

          // Agentic Loop - continues until no more tool calls or max iterations
          while (loopCount < MAX_AGENTIC_LOOPS) {
            loopCount++;
            
            // Send loop start event
            controller.enqueue(encoder.encode(JSON.stringify({ 
              k: 'loop_start', 
              loop: loopCount,
              totalLoops: MAX_AGENTIC_LOOPS
            }) + '\n'));

            // Track pending function calls for this iteration
            const pendingCalls: Map<number, { name: string; call_id: string; arguments: string }> = new Map();
            const iterationToolCalls: ToolCall[] = [];
            let iterationContent = '';

            // Send model call event
            controller.enqueue(encoder.encode(JSON.stringify({ 
              k: 'model_call',
              model: OPENAI_MODEL
            }) + '\n'));

            // Create streaming response with GPT-5.1
            // Request reasoning summary for the magical "thinking" experience
            const response = await openai.responses.create({
              model: OPENAI_MODEL,
              instructions: systemPrompt,
              input: currentInput,
              tools: RESPONSES_TOOLS,
              stream: true,
              // Enable reasoning for GPT-5.1 to show thinking
              reasoning: {
                effort: 'medium',
                summary: 'auto'
              }
            });

            // Process stream events
            for await (const event of response) {
              const eventType = (event as unknown as { type: string }).type;

              // Stream reasoning summary (IA thinking)
              if (eventType === 'response.reasoning_summary_text.delta') {
                const delta = (event as unknown as { delta?: string }).delta || '';
                reasoningSummary += delta;
                controller.enqueue(encoder.encode(JSON.stringify({ 
                  k: 'reasoning', 
                  d: delta 
                }) + '\n'));
              }

              // Stream text deltas immediately to frontend
              if (eventType === 'response.output_text.delta') {
                const delta = (event as unknown as { delta?: string }).delta || '';
                iterationContent += delta;
                controller.enqueue(encoder.encode(JSON.stringify({ k: 't', d: delta }) + '\n'));
              }

              // Track function call start
              if (eventType === 'response.output_item.added') {
                const item = (event as unknown as { item?: { type: string; name?: string; call_id?: string } }).item;
                if (item?.type === 'function_call' && item?.name) {
                  const outputIndex = (event as unknown as { output_index?: number }).output_index ?? 0;
                  const callId = item.call_id || `call_${crypto.randomUUID()}`;
                  pendingCalls.set(outputIndex, {
                    name: item.name,
                    call_id: callId,
                    arguments: ''
                  });

                  // Send humanized thinking message for this tool
                  const thinkingMsg = getHumanizedThinkingMessage(item.name);
                  controller.enqueue(encoder.encode(JSON.stringify({ 
                    k: 'thinking',
                    thinking: thinkingMsg
                  }) + '\n'));
                }
              }

              // Accumulate function call arguments
              if (eventType === 'response.function_call_arguments.delta') {
                const outputIndex = (event as unknown as { output_index?: number }).output_index ?? 0;
                const pending = pendingCalls.get(outputIndex);
                if (pending) {
                  pending.arguments += (event as unknown as { delta?: string }).delta || '';
                }
              }

              // Function call complete - collect it
              if (eventType === 'response.function_call_arguments.done') {
                const outputIndex = (event as unknown as { output_index?: number }).output_index ?? 0;
                const pending = pendingCalls.get(outputIndex);

                if (pending?.name) {
                  let parsedArgs: Record<string, unknown> = {};
                  try {
                    parsedArgs = JSON.parse(pending.arguments || '{}');
                  } catch {
                    console.error('[kairos-stream] Failed to parse tool args:', pending.arguments);
                  }

                  iterationToolCalls.push({
                    name: pending.name,
                    call_id: pending.call_id,
                    arguments: parsedArgs
                  });
                }
              }

              // Capture usage info
              if (eventType === 'response.completed') {
                const usage = (event as unknown as { response?: { usage?: { input_tokens?: number; output_tokens?: number } } }).response?.usage;
                if (usage) {
                  controller.enqueue(encoder.encode(JSON.stringify({ 
                    k: 'usage',
                    inputTokens: usage.input_tokens,
                    outputTokens: usage.output_tokens
                  }) + '\n'));
                }
              }
            }

            // Add iteration content to full content
            fullContent += iterationContent;

            // If no tool calls, we're done - break the loop
            if (iterationToolCalls.length === 0) {
              break;
            }

            // ANTI-LOOP: Filter out duplicate tool calls (GET tools only, allow CREATE tools)
            const getToolsPattern = /^kairos_(get|search)/;
            const filteredToolCalls = iterationToolCalls.filter(tc => {
              // Always allow create/update tools (they create new data)
              if (!getToolsPattern.test(tc.name)) {
                return true;
              }
              // For GET tools, only allow if not already executed
              if (executedToolNames.has(tc.name)) {
                console.log(`[kairos-stream] ANTI-LOOP: Blocking duplicate call to ${tc.name}`);
                return false;
              }
              return true;
            });

            // If all tools were filtered out as duplicates, force break the loop
            if (filteredToolCalls.length === 0 && iterationToolCalls.length > 0) {
              console.log('[kairos-stream] ANTI-LOOP: All tools were duplicates, forcing response generation');
              break;
            }

            // Execute all tool calls for this iteration
            const toolResultsForNextCall: string[] = [];

            for (const toolCall of filteredToolCalls) {
              const category = getKairosToolCategory(toolCall.name);
              const toolStartTime = Date.now();

              // Send tool execution indicator with humanized message
              controller.enqueue(encoder.encode(JSON.stringify({
                k: 'tool_executing',
                name: toolCall.name,
                category,
                args: toolCall.arguments,
                humanized: getHumanizedThinkingMessage(toolCall.name)
              }) + '\n'));

              try {
                // Execute tool (uses Kairos tool handlers)
                console.log(`[kairos-stream] Calling tool: ${toolCall.name}`, JSON.stringify(toolCall.arguments).slice(0, 200));
                const result = await executeKairosTool(toolCall.name, toolCall.arguments, session.user.id);
                const executionTimeMs = Date.now() - toolStartTime;
                console.log(`[kairos-stream] Tool result for ${toolCall.name} (${executionTimeMs}ms):`, JSON.stringify(result).slice(0, 500));

                // Mark tool as executed (for anti-loop protection)
                executedToolNames.add(toolCall.name);

                // Store result
                toolCall.result = result;
                allToolCalls.push(toolCall);

                // Send result to frontend
                controller.enqueue(encoder.encode(JSON.stringify({
                  k: 'tool_result',
                  name: toolCall.name,
                  category,
                  result,
                  humanized: `✓ ${getHumanizedThinkingMessage(toolCall.name).replace(/[✨📅📝🧠💫📚💬🔧]/g, '').trim()}`
                }) + '\n'));

                // Build tool result for next API call
                toolResultsForNextCall.push(
                  `[Tool: ${toolCall.name}]\nArgumentos: ${JSON.stringify(toolCall.arguments)}\nResultado: ${JSON.stringify(result)}`
                );
              } catch (err) {
                const executionTimeMs = Date.now() - toolStartTime;
                console.error('[kairos-stream] Tool error:', toolCall.name, err);
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                toolCall.error = errorMessage;
                allToolCalls.push(toolCall);

                controller.enqueue(encoder.encode(JSON.stringify({
                  k: 'tool_error',
                  name: toolCall.name,
                  category,
                  error: errorMessage
                }) + '\n'));

                toolResultsForNextCall.push(
                  `[Tool: ${toolCall.name}]\nErro: ${errorMessage}`
                );
              }
            }

            // Build new input with tool results for next iteration
            // IMPORTANTE: Instruções claras e enfáticas para NÃO repetir tools já executadas
            const toolsExecuted = toolResultsForNextCall.map(t => t.match(/\[Tool: (.+?)\]/)?.[1]).filter(Boolean);
            
            currentInput = `${conversationInput}

===================================================================
🚨🚨🚨 ATENÇÃO CRÍTICA - LEIA ANTES DE CONTINUAR 🚨🚨🚨
===================================================================

TOOLS JÁ EXECUTADAS (NÃO CHAMAR NOVAMENTE!):
${toolsExecuted.map(t => `❌ ${t} - JÁ EXECUTADO`).join('\n')}

RESULTADOS DISPONÍVEIS:

${toolResultsForNextCall.join('\n\n')}

===================================================================
🎯 INSTRUÇÕES OBRIGATÓRIAS:
===================================================================

1. ❌ NÃO CHAME: ${toolsExecuted.join(', ')} - ESSES TOOLS JÁ FORAM EXECUTADOS!
2. ✅ VOCÊ JÁ TEM TODOS OS DADOS QUE PRECISA ACIMA
3. ✅ GERE AGORA A RESPOSTA FINAL PARA O USUÁRIO
4. ✅ Use os dados já coletados para uma resposta acolhedora e personalizada
5. ⚠️ SOMENTE use tools se precisar CRIAR algo novo (createMemory, createDailyLog)

🚨 SE VOCÊ CHAMAR UM TOOL QUE JÁ FOI EXECUTADO, ESTARÁ EM LOOP!
🚨 PRIORIZE: RESPONDER AO USUÁRIO > BUSCAR MAIS DADOS

===================================================================`;
          }

          // Save assistant message with all tool calls
          if (fullContent) {
            await saveMessage(
              supabase,
              sessionId,
              session.user.id,
              'assistant',
              fullContent,
              allToolCalls.length > 0 ? { tool_calls: allToolCalls } : undefined
            );
          }

          // Update session timestamp
          await supabase
            .from('ai_sessions')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', sessionId);

          // Send done event
          controller.enqueue(encoder.encode(JSON.stringify({
            k: 'done',
            full: fullContent,
            sessionId,
            toolCalls: allToolCalls.length,
            model: OPENAI_MODEL,
            reasoning: reasoningSummary || undefined
          }) + '\n'));

          controller.close();

        } catch (error) {
          console.error('[kairos-stream] Stream error:', error);
          controller.enqueue(encoder.encode(JSON.stringify({
            k: 'err',
            d: error instanceof Error ? error.message : 'Unknown error'
          }) + '\n'));
          controller.close();
        }
      }
    });

    return new Response(streamResponse, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'x-trace-id': traceId,
        'x-session-id': sessionId,
        'x-model': OPENAI_MODEL,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'x-trace-id, x-session-id, x-model'
      }
    });

  } catch (error) {
    console.error('[kairos-stream] Request error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { 
        status: error instanceof Error && error.message.includes('autenticação') ? 401 : 500,
        headers: { 'x-trace-id': traceId }
      }
    );
  }
}

