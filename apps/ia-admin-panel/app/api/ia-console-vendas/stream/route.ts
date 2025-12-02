/**
 * IA Console Vendas - Streaming API Route
 * 
 * Implementa streaming em tempo real com agentic loop para tool calling.
 * Integrado com as APIs Ticto e Hotmart para consultas de vendas e assinaturas.
 * 
 * MODELO: gpt-5.1 (mais recente)
 * 
 * Features:
 * - Streaming de texto em tempo real
 * - Agentic loop com tool calling
 * - Integração DUAL: Ticto API + Hotmart API
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
import { TICTO_MCP_TOOLS, getTictoToolCategory } from '@/lib/ai/ticto-mcp-tools';
import { HOTMART_MCP_TOOLS, getHotmartToolCategory, dateToHotmartTimestamp } from '@/lib/ai/hotmart-mcp-tools';
import { getVendasSystemPrompt } from '@/lib/prompts/vendas-agent';
import { tictoClient } from '@/lib/ticto/client';
import { hotmartClient } from '@/lib/hotmart/client';

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
  platform?: 'ticto' | 'hotmart';
}

interface StreamRequest {
  messages: ChatMessage[];
  sessionId?: string;
}

// Config
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = 'gpt-5.1'; // Modelo mais recente
const MAX_AGENTIC_LOOPS = 5;

// Initialize OpenAI
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// Combine MCP tools from both platforms
const ALL_MCP_TOOLS = [...TICTO_MCP_TOOLS, ...HOTMART_MCP_TOOLS];

// Convert MCP tools to OpenAI Responses API format
const RESPONSES_TOOLS = ALL_MCP_TOOLS.map(tool => ({
  type: 'function' as const,
  name: tool.name,
  description: tool.description,
  parameters: tool.parameters,
  strict: false
}));

/**
 * Determine which platform a tool belongs to
 */
function getToolPlatform(toolName: string): 'ticto' | 'hotmart' | 'unknown' {
  if (toolName.startsWith('ticto_')) return 'ticto';
  if (toolName.startsWith('hotmart_')) return 'hotmart';
  return 'unknown';
}

/**
 * Get tool category for UI display (unified across platforms)
 */
function getToolCategory(toolName: string): string {
  const platform = getToolPlatform(toolName);
  if (platform === 'ticto') {
    return getTictoToolCategory(toolName);
  }
  if (platform === 'hotmart') {
    return getHotmartToolCategory(toolName);
  }
  return 'unknown';
}

/**
 * Execute a Ticto tool
 */
async function executeTictoTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  // Check if Ticto is configured
  if (!tictoClient.isConfigured()) {
    return {
      error: true,
      message: 'API Ticto não configurada. Defina TICTO_CLIENT_ID e TICTO_CLIENT_SECRET no ambiente.'
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ORDERS
  // ═══════════════════════════════════════════════════════════════════════════
  if (toolName === 'ticto_get_orders_summary') {
    const result = await tictoClient.getOrdersSummary();
    return result;
  }

  if (toolName === 'ticto_search_orders') {
    // When searching by email or document, don't use date filters to get ALL results
    // The Ticto API seems to use OR logic when date filters are combined with other filters
    const hasCustomerFilter = args.email || args.document;
    const useAllTime = args.all_time === true;
    
    let dateFrom = args.date_from as string | undefined;
    let dateTo = args.date_to as string | undefined;
    
    // Only use date filters if explicitly provided AND not searching by customer
    // OR if all_time is true but no customer filter (general date range search)
    if (useAllTime && !hasCustomerFilter) {
      dateFrom = '2020-01-01';
      dateTo = new Date().toISOString().split('T')[0];
    } else if (hasCustomerFilter && useAllTime) {
      // When searching by customer with all_time, don't set date filters
      // Let the API return all records for that customer
      dateFrom = undefined;
      dateTo = undefined;
    }
    
    const result = await tictoClient.searchOrders({
      email: args.email as string | undefined,
      status: args.status as string | undefined,
      order_id: args.order_id as string | undefined,
      product_id: args.product_id as string | undefined,
      product_name: args.product_name as string | undefined,
      document: args.document as string | undefined,
      date_from: dateFrom,
      date_to: dateTo,
      page: args.page as number | undefined,
      limit: args.limit ? Math.min(args.limit as number, 100) : (hasCustomerFilter ? 100 : 20),
    });
    return result;
  }

  if (toolName === 'ticto_get_order_by_id') {
    const orderId = args.order_id as string;
    if (!orderId) {
      return { error: true, message: 'order_id é obrigatório' };
    }
    const result = await tictoClient.getOrderById(orderId);
    if (!result) {
      return { error: true, message: `Pedido ${orderId} não encontrado` };
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  if (toolName === 'ticto_get_subscriptions_summary') {
    const result = await tictoClient.getSubscriptionsSummary();
    return result;
  }

  if (toolName === 'ticto_search_subscriptions') {
    // When searching by email or document, don't use date filters to get ALL results
    const hasCustomerFilter = args.email || args.document;
    const useAllTime = args.all_time === true;
    
    let dateFrom = args.date_from as string | undefined;
    let dateTo = args.date_to as string | undefined;
    
    if (useAllTime && !hasCustomerFilter) {
      dateFrom = '2020-01-01';
      dateTo = new Date().toISOString().split('T')[0];
    } else if (hasCustomerFilter && useAllTime) {
      dateFrom = undefined;
      dateTo = undefined;
    }
    
    const result = await tictoClient.searchSubscriptions({
      email: args.email as string | undefined,
      status: args.status as string | undefined,
      product_id: args.product_id as string | undefined,
      product_name: args.product_name as string | undefined,
      document: args.document as string | undefined,
      date_from: dateFrom,
      date_to: dateTo,
      page: args.page as number | undefined,
      limit: args.limit ? Math.min(args.limit as number, 100) : (hasCustomerFilter ? 100 : 20),
    });
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMER
  // ═══════════════════════════════════════════════════════════════════════════
  if (toolName === 'ticto_search_customer') {
    const email = args.email as string | undefined;
    const document = args.document as string | undefined;
    
    if (!email && !document) {
      return { error: true, message: 'Informe email ou document para buscar o cliente' };
    }
    
    const result = await tictoClient.searchCustomer({ email, document });
    return result;
  }

  throw new Error(`Tool Ticto desconhecida: ${toolName}`);
}

/**
 * Execute a Hotmart tool
 */
async function executeHotmartTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  // Check if Hotmart is configured
  if (!hotmartClient.isConfigured()) {
    return {
      error: true,
      message: 'API Hotmart não configurada. Defina HOTMART_CLIENT_ID e HOTMART_CLIENT_SECRET (ou HOTMART_BASIC_AUTH) no ambiente.'
    };
  }

  // Helper to convert date strings to timestamps
  const getTimestamps = (args: Record<string, unknown>, useAllTime: boolean) => {
    if (useAllTime) {
      return {
        start_date: dateToHotmartTimestamp('2015-01-01'),
        end_date: Date.now()
      };
    }
    return {
      start_date: args.start_date ? dateToHotmartTimestamp(args.start_date as string) : undefined,
      end_date: args.end_date ? dateToHotmartTimestamp(args.end_date as string) : undefined
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SALES
  // ═══════════════════════════════════════════════════════════════════════════
  if (toolName === 'hotmart_get_sales_summary') {
    const timestamps = getTimestamps(args, false);
    const result = await hotmartClient.getSalesSummary({
      start_date: timestamps.start_date,
      end_date: timestamps.end_date,
      transaction_status: args.transaction_status as string | undefined,
    });
    return result;
  }

  if (toolName === 'hotmart_search_sales') {
    const hasCustomerFilter = args.buyer_email || args.buyer_name;
    const useAllTime = args.all_time === true;
    const timestamps = getTimestamps(args, useAllTime && !!hasCustomerFilter);
    
    const result = await hotmartClient.searchSales({
      buyer_email: args.buyer_email as string | undefined,
      buyer_name: args.buyer_name as string | undefined,
      transaction_status: args.transaction_status as string | undefined,
      transaction: args.transaction as string | undefined,
      product_id: args.product_id as number | undefined,
      payment_type: args.payment_type as string | undefined,
      offer_code: args.offer_code as string | undefined,
      commission_as: args.commission_as as string | undefined,
      start_date: timestamps.start_date,
      end_date: timestamps.end_date,
      max_results: args.max_results ? Math.min(args.max_results as number, 100) : (hasCustomerFilter ? 100 : 50),
      page_token: args.page_token as string | undefined,
    });
    return result;
  }

  if (toolName === 'hotmart_get_sale_by_transaction') {
    const transaction = args.transaction as string;
    if (!transaction) {
      return { error: true, message: 'transaction é obrigatório' };
    }
    const result = await hotmartClient.getSaleByTransaction(transaction);
    if (!result) {
      return { error: true, message: `Transação ${transaction} não encontrada na Hotmart` };
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  if (toolName === 'hotmart_get_subscriptions_summary') {
    const result = await hotmartClient.getSubscriptionsSummary({
      product_id: args.product_id as number | undefined,
      status: args.status as string | undefined,
    });
    return result;
  }

  if (toolName === 'hotmart_search_subscriptions') {
    const result = await hotmartClient.getSubscriptions({
      subscriber_code: args.subscriber_code as string | undefined,
      status: args.status as string | undefined,
      product_id: args.product_id as number | undefined,
      plan_id: args.plan_id as number | undefined,
      max_results: args.max_results ? Math.min(args.max_results as number, 100) : 50,
      page_token: args.page_token as string | undefined,
    });
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMER
  // ═══════════════════════════════════════════════════════════════════════════
  if (toolName === 'hotmart_search_customer') {
    const email = args.email as string | undefined;
    const name = args.name as string | undefined;
    
    if (!email && !name) {
      return { error: true, message: 'Informe email ou nome para buscar o cliente na Hotmart' };
    }
    
    const result = await hotmartClient.searchCustomer({ email, name });
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTS
  // ═══════════════════════════════════════════════════════════════════════════
  if (toolName === 'hotmart_get_products') {
    const result = await hotmartClient.getProducts({
      max_results: args.max_results as number | undefined,
      page_token: args.page_token as string | undefined,
    });
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMISSIONS
  // ═══════════════════════════════════════════════════════════════════════════
  if (toolName === 'hotmart_get_commissions') {
    const timestamps = getTimestamps(args, false);
    const result = await hotmartClient.getSalesCommissions({
      product_id: args.product_id as number | undefined,
      transaction_status: args.transaction_status as string | undefined,
      commission_as: args.commission_as as string | undefined,
      start_date: timestamps.start_date,
      end_date: timestamps.end_date,
      max_results: args.max_results as number | undefined,
    });
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REFUNDS
  // ═══════════════════════════════════════════════════════════════════════════
  if (toolName === 'hotmart_get_refunds') {
    const timestamps = getTimestamps(args, false);
    // Search for refunded/partially refunded transactions
    const result = await hotmartClient.searchSales({
      buyer_email: args.buyer_email as string | undefined,
      product_id: args.product_id as number | undefined,
      transaction_status: 'REFUNDED',
      start_date: timestamps.start_date,
      end_date: timestamps.end_date,
      max_results: args.max_results as number | undefined,
    });
    return result;
  }

  throw new Error(`Tool Hotmart desconhecida: ${toolName}`);
}

/**
 * Execute a tool (routes to correct platform)
 */
async function executeToolDirectly(
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  try {
    const platform = getToolPlatform(toolName);
    
    if (platform === 'ticto') {
      return await executeTictoTool(toolName, args);
    }
    
    if (platform === 'hotmart') {
      return await executeHotmartTool(toolName, args);
    }
    
    throw new Error(`Plataforma desconhecida para tool: ${toolName}`);
  } catch (error) {
    console.error(`[ia-console-vendas] Tool error (${toolName}):`, error);
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
    console.error('[ia-console-vendas] Failed to save message:', err);
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
      title: 'Nova conversa - Vendas',
      metadata: { version: 'vendas', model: OPENAI_MODEL, integration: ['ticto', 'hotmart'] }
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
  const featureEnabled = process.env.FEATURE_IA_CONSOLE_VENDAS === 'true' || 
                         process.env.NEXT_PUBLIC_FEATURE_IA_CONSOLE_VENDAS === 'true';
  
  if (!featureEnabled) {
    return NextResponse.json(
      { error: 'IA Console Vendas desabilitado neste ambiente.' },
      { status: 403, headers: { 'x-trace-id': traceId } }
    );
  }

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

    const supabase = createSupabaseAdminClient();
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
    if (lastUserMessage) {
      await saveMessage(supabase, sessionId, 'user', lastUserMessage.content);
    }

    // Build conversation input
    const conversationInput = buildConversationInput(messages);
    const systemPrompt = getVendasSystemPrompt();

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
            model: OPENAI_MODEL,
            platforms: ['ticto', 'hotmart']
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

            // Create streaming response
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
                    console.error('[ia-console-vendas] Failed to parse tool args:', pending.arguments);
                  }

                  const platform = getToolPlatform(pending.name);
                  iterationToolCalls.push({
                    name: pending.name,
                    call_id: pending.call_id,
                    arguments: parsedArgs,
                    platform: platform !== 'unknown' ? platform : undefined
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
              const category = getToolCategory(toolCall.name);
              const platform = toolCall.platform || 'unknown';

              // Send tool execution indicator
              controller.enqueue(encoder.encode(JSON.stringify({
                k: 'tool_executing',
                name: toolCall.name,
                category,
                platform,
                args: toolCall.arguments
              }) + '\n'));

              try {
                // Execute tool
                console.log(`[ia-console-vendas] Calling ${platform} tool: ${toolCall.name}`, JSON.stringify(toolCall.arguments).slice(0, 200));
                const result = await executeToolDirectly(toolCall.name, toolCall.arguments);
                console.log(`[ia-console-vendas] Tool result for ${toolCall.name}:`, JSON.stringify(result).slice(0, 500));

                // Store result
                toolCall.result = result;
                allToolCalls.push(toolCall);

                // Send result to frontend
                controller.enqueue(encoder.encode(JSON.stringify({
                  k: 'tool_result',
                  name: toolCall.name,
                  category,
                  platform,
                  result
                }) + '\n'));

                // Build tool result for next API call
                toolResultsForNextCall.push(
                  `[Tool: ${toolCall.name} (${platform.toUpperCase()})]\nArgumentos: ${JSON.stringify(toolCall.arguments)}\nResultado: ${JSON.stringify(result)}`
                );
              } catch (err) {
                console.error('[ia-console-vendas] Tool error:', toolCall.name, err);
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                toolCall.error = errorMessage;
                allToolCalls.push(toolCall);

                controller.enqueue(encoder.encode(JSON.stringify({
                  k: 'tool_error',
                  name: toolCall.name,
                  category,
                  platform,
                  error: errorMessage
                }) + '\n'));

                toolResultsForNextCall.push(
                  `[Tool: ${toolCall.name} (${platform.toUpperCase()})]\nErro: ${errorMessage}`
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
Se precisar de mais dados, use as tools apropriadas.
LEMBRE-SE: Ticto e Hotmart são plataformas DIFERENTES. Apresente os resultados indicando claramente de qual plataforma vieram.`;
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

          // Count tools by platform
          const tictoToolsCount = allToolCalls.filter(t => t.platform === 'ticto').length;
          const hotmartToolsCount = allToolCalls.filter(t => t.platform === 'hotmart').length;

          // Audit log
          await auditAgentEvent({
            user_id: session.user.id,
            event: 'ia_console_vendas.response',
            metadata: {
              sessionId,
              traceId,
              model: OPENAI_MODEL,
              toolCallsCount: allToolCalls.length,
              tictoToolsCount,
              hotmartToolsCount,
              loopsUsed: loopCount,
              integration: ['ticto', 'hotmart']
            }
          }).catch(console.error);

          // Send done event
          controller.enqueue(encoder.encode(JSON.stringify({
            k: 'done',
            full: fullContent,
            sessionId,
            toolCalls: allToolCalls.length,
            tictoToolCalls: tictoToolsCount,
            hotmartToolCalls: hotmartToolsCount,
            model: OPENAI_MODEL
          }) + '\n'));

          controller.close();

        } catch (error) {
          console.error('[ia-console-vendas] Stream error:', error);
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
    console.error('[ia-console-vendas] Request error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { 
        status: error instanceof Error && error.message.includes('autenticação') ? 401 : 500,
        headers: { 'x-trace-id': traceId }
      }
    );
  }
}
