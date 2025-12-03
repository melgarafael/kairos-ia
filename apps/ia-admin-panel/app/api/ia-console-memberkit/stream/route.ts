/**
 * IA Console Memberkit - Streaming API Route
 * 
 * Implementa streaming em tempo real com agentic loop para tool calling.
 * Integração direta com API Memberkit para gestão de acessos.
 * 
 * MODELO: gpt-5.1 (mais recente)
 * 
 * Features:
 * - Streaming de texto em tempo real
 * - Agentic loop com tool calling
 * - 26 tools para gestão Memberkit
 * - Eventos detalhados para UI
 * 
 * Eventos SSE:
 * - init: Início do stream com traceId
 * - thinking: Status do que o agente está fazendo
 * - loop_start: Início de uma iteração do loop
 * - model_call: Chamada ao modelo
 * - t: Delta de texto (streaming)
 * - tools_start: Início de execução de tools
 * - tool_executing: Tool em execução
 * - tool_result: Resultado de uma tool
 * - tool_error: Erro em uma tool
 * - tools_end: Fim de execução de tools
 * - usage: Uso de tokens
 * - done: Stream finalizado
 * - err: Erro geral
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireStaffSession } from '@/lib/auth/guards';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { auditAgentEvent } from '@/lib/observability/audit';
import { MEMBERKIT_MCP_TOOLS, getMemberkitToolCategory } from '@/lib/ai/memberkit-mcp-tools';
import { getMemberkitSystemPrompt } from '@/lib/prompts/memberkit-agent';
import { MemberkitClient } from '@/lib/memberkit/client';

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
  adminUserId?: string;
}

// Config - GPT-5.1 é o modelo mais recente
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = 'gpt-5.1'; // Modelo mais recente da OpenAI
const MAX_AGENTIC_LOOPS = 5;

// Initialize OpenAI
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// Convert MCP tools to OpenAI Responses API format
const RESPONSES_TOOLS = MEMBERKIT_MCP_TOOLS.map(tool => ({
  type: 'function' as const,
  name: tool.name,
  description: tool.description,
  parameters: tool.parameters,
  strict: false
}));

/**
 * Execute a Memberkit tool
 */
async function executeToolDirectly(
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // ACADEMY
    // ═══════════════════════════════════════════════════════════════════════════
    if (toolName === 'memberkit_get_academy') {
      return await MemberkitClient.getAcademy();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // COURSES
    // ═══════════════════════════════════════════════════════════════════════════
    if (toolName === 'memberkit_list_courses') {
      return await MemberkitClient.listCourses(args.page as number);
    }

    if (toolName === 'memberkit_get_course') {
      if (!args.course_id) throw new Error('course_id é obrigatório');
      return await MemberkitClient.getCourse(args.course_id as number);
    }

    if (toolName === 'memberkit_get_lesson') {
      if (!args.course_id || !args.lesson_id) {
        throw new Error('course_id e lesson_id são obrigatórios');
      }
      return await MemberkitClient.getLesson(
        args.course_id as number,
        args.lesson_id as number
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CLASSROOMS
    // ═══════════════════════════════════════════════════════════════════════════
    if (toolName === 'memberkit_list_classrooms') {
      return await MemberkitClient.listClassrooms(args.page as number);
    }

    if (toolName === 'memberkit_get_classroom') {
      if (!args.classroom_id) throw new Error('classroom_id é obrigatório');
      return await MemberkitClient.getClassroom(args.classroom_id as number);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MEMBERSHIPS
    // ═══════════════════════════════════════════════════════════════════════════
    if (toolName === 'memberkit_list_membership_levels') {
      return await MemberkitClient.listMembershipLevels(args.page as number);
    }

    if (toolName === 'memberkit_list_memberships') {
      return await MemberkitClient.listMemberships({
        user_id: args.user_id as number,
        membership_level_id: args.membership_level_id as number,
        status: args.status as string,
        page: args.page as number,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // USERS
    // ═══════════════════════════════════════════════════════════════════════════
    if (toolName === 'memberkit_list_users') {
      return await MemberkitClient.listUsers({
        email: args.email as string,
        name: args.name as string,
        status: args.status as string,
        membership_level_id: args.membership_level_id as number,
        classroom_id: args.classroom_id as number,
        page: args.page as number,
      });
    }

    if (toolName === 'memberkit_get_user') {
      if (!args.user_id) throw new Error('user_id é obrigatório');
      return await MemberkitClient.getUser(args.user_id as number);
    }

    if (toolName === 'memberkit_create_user') {
      if (!args.email) throw new Error('email é obrigatório');
      return await MemberkitClient.createUser({
        email: args.email as string,
        name: args.name as string,
        password: args.password as string,
        membership_level_id: args.membership_level_id as number,
        classroom_id: args.classroom_id as number,
        expires_at: args.expires_at as string,
        custom_fields: args.custom_fields as Record<string, unknown>,
      });
    }

    if (toolName === 'memberkit_update_user') {
      if (!args.user_id) throw new Error('user_id é obrigatório');
      return await MemberkitClient.updateUser(args.user_id as number, {
        email: args.email as string,
        name: args.name as string,
        membership_level_id: args.membership_level_id as number,
        classroom_id: args.classroom_id as number,
        expires_at: args.expires_at as string,
        blocked: args.blocked as boolean,
        custom_fields: args.custom_fields as Record<string, unknown>,
      });
    }

    if (toolName === 'memberkit_archive_user') {
      if (!args.user_id) throw new Error('user_id é obrigatório');
      await MemberkitClient.archiveUser(args.user_id as number);
      return { success: true, message: 'Usuário arquivado com sucesso.' };
    }

    if (toolName === 'memberkit_get_user_activities') {
      if (!args.user_id) throw new Error('user_id é obrigatório');
      return await MemberkitClient.getUserActivities(args.user_id as number, {
        page: args.page as number,
        per_page: args.per_page as number,
      });
    }

    if (toolName === 'memberkit_generate_magic_link') {
      if (!args.user_id) throw new Error('user_id é obrigatório');
      return await MemberkitClient.generateMagicLink(
        args.user_id as number,
        args.expires_in as number
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RANKINGS
    // ═══════════════════════════════════════════════════════════════════════════
    if (toolName === 'memberkit_list_rankings') {
      return await MemberkitClient.listRankings(args.page as number);
    }

    if (toolName === 'memberkit_get_user_ranking') {
      if (!args.ranking_id) throw new Error('ranking_id é obrigatório');
      return await MemberkitClient.getUserRanking(
        args.ranking_id as number,
        args.user_id as number
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SCORES
    // ═══════════════════════════════════════════════════════════════════════════
    if (toolName === 'memberkit_create_score') {
      if (!args.user_id || args.points === undefined) {
        throw new Error('user_id e points são obrigatórios');
      }
      return await MemberkitClient.createScore({
        user_id: args.user_id as number,
        points: args.points as number,
        description: args.description as string,
        ranking_id: args.ranking_id as number,
      });
    }

    if (toolName === 'memberkit_delete_score') {
      if (!args.score_id) throw new Error('score_id é obrigatório');
      await MemberkitClient.deleteScore(args.score_id as number);
      return { success: true, message: 'Pontuação removida com sucesso.' };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // QUIZZES
    // ═══════════════════════════════════════════════════════════════════════════
    if (toolName === 'memberkit_list_quiz_submissions') {
      return await MemberkitClient.listQuizSubmissions({
        user_id: args.user_id as number,
        quiz_id: args.quiz_id as number,
        page: args.page as number,
      });
    }

    if (toolName === 'memberkit_get_quiz_submission') {
      if (!args.submission_id) throw new Error('submission_id é obrigatório');
      return await MemberkitClient.getQuizSubmission(args.submission_id as number);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // COMMENTS
    // ═══════════════════════════════════════════════════════════════════════════
    if (toolName === 'memberkit_list_comments') {
      return await MemberkitClient.listComments({
        lesson_id: args.lesson_id as number,
        user_id: args.user_id as number,
        status: args.status as string,
        page: args.page as number,
      });
    }

    if (toolName === 'memberkit_get_comment') {
      if (!args.comment_id) throw new Error('comment_id é obrigatório');
      return await MemberkitClient.getComment(args.comment_id as number);
    }

    if (toolName === 'memberkit_create_comment') {
      if (!args.lesson_id || !args.user_id || !args.content) {
        throw new Error('lesson_id, user_id e content são obrigatórios');
      }
      return await MemberkitClient.createComment({
        lesson_id: args.lesson_id as number,
        user_id: args.user_id as number,
        content: args.content as string,
        parent_id: args.parent_id as number,
      });
    }

    if (toolName === 'memberkit_delete_comment') {
      if (!args.comment_id) throw new Error('comment_id é obrigatório');
      await MemberkitClient.deleteComment(args.comment_id as number);
      return { success: true, message: 'Comentário removido com sucesso.' };
    }

    if (toolName === 'memberkit_approve_comment') {
      if (!args.comment_id) throw new Error('comment_id é obrigatório');
      return await MemberkitClient.approveComment(args.comment_id as number);
    }

    if (toolName === 'memberkit_reject_comment') {
      if (!args.comment_id) throw new Error('comment_id é obrigatório');
      return await MemberkitClient.rejectComment(args.comment_id as number);
    }

    throw new Error(`Tool desconhecida: ${toolName}`);
  } catch (error) {
    console.error(`[ia-console-memberkit] Tool error (${toolName}):`, error);
    return { 
      error: true, 
      message: `Erro ao executar ${toolName}: ${(error as Error).message}` 
    };
  }
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
      parts.push(`Assistente: ${msg.content}`);
    }
  }

  return parts.join('\n\n');
}

/**
 * Save message to database
 */
async function saveMessage(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  sessionId: string,
  role: string,
  content: string,
  metadata?: { tool_calls?: ToolCall[] }
) {
  try {
    await supabase.from('admin_chat_messages').insert({
      session_id: sessionId,
      role,
      content,
      metadata: metadata || null
    });
  } catch (err) {
    console.error('[ia-console-memberkit] Failed to save message:', err);
  }
}

/**
 * Create or get session
 */
async function ensureSession(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  existingSessionId?: string
): Promise<string> {
  if (existingSessionId) {
    return existingSessionId;
  }

  const { data, error } = await supabase
    .from('admin_chat_sessions')
    .insert({
      user_id: userId,
      user_role: 'staff',
      title: 'Nova conversa Memberkit',
      metadata: { version: 'memberkit', model: OPENAI_MODEL }
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
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  sessionId: string,
  firstMessage: string
) {
  const title = firstMessage.length > 50 ? firstMessage.slice(0, 47) + '...' : firstMessage;
  await supabase.from('admin_chat_sessions').update({ title }).eq('id', sessionId);
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

  // Check feature flag
  const featureEnabled = process.env.FEATURE_IA_CONSOLE_MEMBERKIT === 'true' || 
                         process.env.NEXT_PUBLIC_FEATURE_IA_CONSOLE_MEMBERKIT === 'true';
  
  if (!featureEnabled) {
    return NextResponse.json(
      { error: 'IA Console Memberkit desabilitado neste ambiente.' },
      { status: 403, headers: { 'x-trace-id': traceId } }
    );
  }

  if (!openai) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY não configurada.' },
      { status: 500, headers: { 'x-trace-id': traceId } }
    );
  }

  // Check Memberkit API Key
  if (!process.env.MEMBERKIT_API_KEY) {
    return NextResponse.json(
      { error: 'MEMBERKIT_API_KEY não configurada.' },
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

    const supabase = createSupabaseAdminClient();
    const body: StreamRequest = await request.json();
    const { messages = [], sessionId: existingSessionId, adminUserId } = body;

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
    if (lastUserMessage) {
      await saveMessage(supabase, sessionId, 'user', lastUserMessage.content);
    }

    // Build conversation input
    const conversationInput = buildConversationInput(messages);
    const systemPrompt = getMemberkitSystemPrompt(adminUserId || session.user.id);

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

          // Agentic Loop State
          let fullContent = '';
          const allToolCalls: ToolCall[] = [];
          let loopCount = 0;
          let currentInput: string = conversationInput;

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
            const response = await openai.responses.create({
              model: OPENAI_MODEL,
              instructions: systemPrompt,
              input: currentInput,
              tools: RESPONSES_TOOLS,
              stream: true
            });

            // Process stream events
            for await (const event of response) {
              const eventType = (event as unknown as { type: string }).type;

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
                    console.error('[ia-console-memberkit] Failed to parse tool args:', pending.arguments);
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

            // Execute all tool calls for this iteration
            controller.enqueue(encoder.encode(JSON.stringify({ k: 'tools_start' }) + '\n'));

            const toolResultsForNextCall: string[] = [];

            for (const toolCall of iterationToolCalls) {
              const category = getMemberkitToolCategory(toolCall.name);
              const toolStartTime = Date.now();

              // Send tool execution indicator
              controller.enqueue(encoder.encode(JSON.stringify({
                k: 'tool_executing',
                name: toolCall.name,
                category,
                args: toolCall.arguments
              }) + '\n'));

              try {
                // Execute tool directly
                console.log(`[ia-console-memberkit] Calling tool: ${toolCall.name}`, JSON.stringify(toolCall.arguments).slice(0, 200));
                const result = await executeToolDirectly(toolCall.name, toolCall.arguments);
                const executionTimeMs = Date.now() - toolStartTime;
                console.log(`[ia-console-memberkit] Tool result for ${toolCall.name} (${executionTimeMs}ms):`, JSON.stringify(result).slice(0, 500));

                // Store result
                toolCall.result = result;
                allToolCalls.push(toolCall);

                // Send result to frontend
                controller.enqueue(encoder.encode(JSON.stringify({
                  k: 'tool_result',
                  name: toolCall.name,
                  category,
                  result
                }) + '\n'));

                // Build tool result for next API call
                toolResultsForNextCall.push(
                  `[Tool: ${toolCall.name}]\nArgumentos: ${JSON.stringify(toolCall.arguments)}\nResultado: ${JSON.stringify(result)}`
                );
              } catch (err) {
                const executionTimeMs = Date.now() - toolStartTime;
                console.error('[ia-console-memberkit] Tool error:', toolCall.name, err);
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

            controller.enqueue(encoder.encode(JSON.stringify({ k: 'tools_end' }) + '\n'));

            // Build new input with tool results for next iteration
            currentInput = `${conversationInput}

---
HISTÓRICO DE TOOLS EXECUTADAS:

${toolResultsForNextCall.join('\n\n')}

---

Com base nos resultados das tools acima, continue a conversa de forma natural.
Se você tem todas as informações necessárias, gere a resposta completa.
Se precisar de mais dados, use as tools apropriadas.`;
          }

          // Save assistant message with all tool calls
          if (fullContent) {
            await saveMessage(
              supabase,
              sessionId,
              'assistant',
              fullContent,
              allToolCalls.length > 0 ? { tool_calls: allToolCalls } : undefined
            );
          }

          // Audit log
          await auditAgentEvent({
            user_id: session.user.id,
            event: 'ia_console_memberkit.response',
            metadata: {
              sessionId,
              traceId,
              model: OPENAI_MODEL,
              toolCallsCount: allToolCalls.length,
              loopsUsed: loopCount
            }
          }).catch(console.error);

          // Send done event
          controller.enqueue(encoder.encode(JSON.stringify({
            k: 'done',
            full: fullContent,
            sessionId,
            toolCalls: allToolCalls.length,
            model: OPENAI_MODEL
          }) + '\n'));

          controller.close();

        } catch (error) {
          console.error('[ia-console-memberkit] Stream error:', error);
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
    console.error('[ia-console-memberkit] Request error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { 
        status: error instanceof Error && error.message.includes('autenticação') ? 401 : 500,
        headers: { 'x-trace-id': traceId }
      }
    );
  }
}

