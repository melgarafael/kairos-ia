/**
 * IA Console V3 - Streaming API Route
 * 
 * Implementa streaming em tempo real com agentic loop para tool calling.
 * Chama admin-analytics diretamente (sem passar por /api/mcp-admin).
 * 
 * MODELO: gpt-5.1 (mais recente)
 * 
 * Features:
 * - Streaming de texto em tempo real
 * - Agentic loop com tool calling
 * - Suporte a anexos (CSV, TXT, MD, DOCX, XLSX)
 * - Visão (análise de imagens)
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
import { auditAgentEvent, auditMcpToolCall, type McpToolAuditPayload } from '@/lib/observability/audit';
import { ADMIN_MCP_TOOLS, getToolCategory } from '@/lib/ai/admin-mcp-tools';
import { getAdminSystemPrompt } from '@/lib/prompts/admin-agent-v3';

// Types
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface FileAttachment {
  name: string;
  type: string;
  content: string; // base64 or text
  isImage: boolean;
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
  attachments?: FileAttachment[];
}

// Config - GPT-5.1 é o modelo mais recente
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = 'gpt-5.1'; // Modelo mais recente da OpenAI
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ADMIN_ANALYTICS_SECRET = process.env.ADMIN_ANALYTICS_SECRET ?? '';
const MAX_AGENTIC_LOOPS = 5;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_ADMIN_ID = '1726f3a7-a8ec-479e-b8a6-d079fbf94e2a';

// Initialize OpenAI
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// Convert MCP tools to OpenAI Responses API format
const RESPONSES_TOOLS = ADMIN_MCP_TOOLS.map(tool => ({
  type: 'function' as const,
  name: tool.name,
  description: tool.description,
  parameters: tool.parameters,
  strict: false
}));

/**
 * Call admin-analytics Edge Function directly (same pattern as mcp-server)
 */
async function callAdminAnalytics(
  action: string,
  params: Record<string, unknown> = {},
  method: 'GET' | 'POST' = 'GET'
): Promise<unknown> {
  const functionUrl = `${SUPABASE_URL}/functions/v1/admin-analytics`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };

  if (ADMIN_ANALYTICS_SECRET) {
    headers['x-admin-secret'] = ADMIN_ANALYTICS_SECRET;
  }

  // Clean null/undefined/empty params
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

  let url = functionUrl;
  let body: string | undefined;

  if (method === 'GET') {
    const queryParams = new URLSearchParams({ action, ...cleanParams as Record<string, string> });
    url = `${functionUrl}?${queryParams.toString()}`;
  } else {
    const queryParams = new URLSearchParams({ action });
    url = `${functionUrl}?${queryParams.toString()}`;
    body = JSON.stringify(cleanParams);
  }

  console.log(`[ia-console-v3] Calling ${method} admin-analytics: ${action}`);

  const response = await fetch(url, { method, headers, body });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`admin-analytics error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Resolve user ID from user_id or email
 */
async function resolveUserId(userId?: string, email?: string): Promise<string> {
  const trimmedId = (userId || '').trim();
  
  if (trimmedId && UUID_REGEX.test(trimmedId)) {
    return trimmedId;
  }

  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Informe user_id ou email para identificar o usuário.');
  }

  const result = await callAdminAnalytics('search_users_for_email', { search: normalizedEmail, limit: 1 }, 'GET') as { users?: Array<{ id: string }> };
  
  if (!result.users?.[0]?.id) {
    throw new Error(`Usuário não encontrado para o email ${normalizedEmail}.`);
  }

  return result.users[0].id;
}

/**
 * Execute a tool - calls admin-analytics directly (same as mcp-server/index.ts)
 */
async function executeToolDirectly(
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // USERS
    // ═══════════════════════════════════════════════════════════════════════════
    if (toolName === 'admin_list_users') {
      if (args.search) {
        const res = await callAdminAnalytics('search_users_for_email', {
          search: args.search,
          limit: args.page_size || 20
        }, 'GET') as { users?: unknown[] };
        return { users: res.users || [] };
      } else {
        return await callAdminAnalytics('list_users', {
          page: args.page,
          page_size: args.page_size
        }, 'GET');
      }
    }

    if (toolName === 'admin_get_user_details') {
      return await callAdminAnalytics('user_details', { user_id: args.user_id }, 'GET');
    }

    if (toolName === 'admin_get_user_organizations') {
      return await callAdminAnalytics('user_organizations', { user_id: args.user_id }, 'GET');
    }

    if (toolName === 'admin_update_user') {
      if (args.account_type) {
        await callAdminAnalytics('update_account_type', { user_id: args.user_id, account_type: args.account_type }, 'POST');
      }
      if (args.member_seats_extra !== undefined) {
        await callAdminAnalytics('update_member_seats_extra', { user_id: args.user_id, member_seats_extra: args.member_seats_extra }, 'POST');
      }
      return { success: true, message: 'Usuário atualizado.' };
    }

    if (toolName === 'admin_update_user_email') {
      return await callAdminAnalytics('update_email', {
        user_id: args.user_id,
        new_email: args.new_email
      }, 'POST');
    }

    if (toolName === 'admin_get_user_connections') {
      return await callAdminAnalytics('user_supabase_connections', { user_id: args.user_id }, 'GET');
    }

    if (toolName === 'admin_update_connection') {
      if (args.supabase_url && !String(args.supabase_url).startsWith('https://')) {
        throw new Error("URL inválida. Deve começar com https://");
      }
      await callAdminAnalytics('update_supabase_connection', {
        connection_id: args.connection_id,
        supabase_url: args.supabase_url,
        anon_key: args.anon_key,
        service_key: args.service_key
      }, 'POST');
      return { success: true, message: 'Conexão atualizada.' };
    }

    if (toolName === 'admin_generate_magic_link') {
      if (!args.email) throw new Error("email é obrigatório");
      return await callAdminAnalytics('generate_magic_link', {
        email: String(args.email).trim().toLowerCase(),
        redirect_url: args.redirect_url,
        flow_type: args.flow_type,
        send_email: args.send_email
      }, 'POST');
    }

    if (toolName === 'admin_create_user') {
      if (!args.email) throw new Error("email é obrigatório");
      return await callAdminAnalytics('create_user', {
        email: String(args.email).trim().toLowerCase(),
        name: args.name,
        account_type: args.account_type,
        member_seats_extra: args.member_seats_extra,
        redirect_url: args.redirect_url,
        password_strategy: args.password_strategy,
        password: args.password,
        password_length: args.password_length,
        send_recovery_email: args.send_recovery_email
      }, 'POST');
    }

    if (toolName === 'admin_send_bulk_emails') {
      const res = await callAdminAnalytics('bulk_send_emails', {
        subject: args.subject,
        html_content: args.html_content,
        users: args.users
      }, 'POST') as { success_count?: number; error_count?: number };
      return { 
        success: true, 
        message: `Envio processado: ${res.success_count || 0} sucessos, ${res.error_count || 0} erros.` 
      };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TOKENS
    // ═══════════════════════════════════════════════════════════════════════════
    if (toolName === 'admin_list_tokens') {
      return await callAdminAnalytics('list_tokens', { search: args.search, status: args.status }, 'GET');
    }

    if (toolName === 'admin_issue_tokens') {
      const userId = String(args.user_id || '').trim();
      const email = String(args.email || '').trim().toLowerCase();
      
      // Aceita user_id OU email (um dos dois é obrigatório)
      const hasUserId = UUID_REGEX.test(userId);
      const hasEmail = email.includes('@');
      
      if (!hasUserId && !hasEmail) {
        throw new Error("Forneça user_id (UUID) ou email válido");
      }
      
      if (!UUID_REGEX.test(String(args.plan_id))) throw new Error("plan_id inválido");

      let issuer = String(args.issuer_user_id || '');
      if (!issuer || !UUID_REGEX.test(issuer)) {
        issuer = DEFAULT_ADMIN_ID;
      }

      const quantity = Math.max(1, Number(args.quantity || 1));
      const validDays = Math.max(1, Number(args.valid_days || 30));
      const isFrozen = Boolean(args.is_frozen);

      // Envia user_id e/ou email - o backend resolve
      const res = await callAdminAnalytics('issue_tokens', {
        ...(hasUserId ? { user_id: userId } : {}),
        ...(hasEmail ? { email } : {}),
        plan_id: args.plan_id,
        quantity,
        valid_days: validDays,
        is_frozen: isFrozen,
        issuer_user_id: issuer
      }, 'POST');

      return { 
        success: true, 
        message: `${quantity} token(s) emitido(s) com sucesso.`,
        ...res as object
      };
    }

    if (toolName === 'admin_bulk_issue_tokens') {
      const items = (args.items as Array<{ email: string; plan_id: string; quantity?: number; valid_days?: number }>) || [];
      const issuer = String(args.issuer_user_id || DEFAULT_ADMIN_ID);
      
      const results: Array<{ email: string; ok: boolean; error?: string }> = [];

      for (const item of items) {
        try {
          const userId = await resolveUserId(undefined, item.email);
          await callAdminAnalytics('issue_tokens', {
            user_id: userId,
            plan_id: item.plan_id,
            quantity: item.quantity || 1,
            valid_days: item.valid_days || 30,
            issuer_user_id: issuer
          }, 'POST');
          results.push({ email: item.email, ok: true });
        } catch (err) {
          results.push({ email: item.email, ok: false, error: (err as Error).message });
        }
      }

      const successCount = results.filter(r => r.ok).length;
      return { 
        success: true, 
        message: `Processado em massa: ${successCount}/${items.length} sucessos.`,
        results
      };
    }

    if (toolName === 'admin_user_tokens') {
      const userId = await resolveUserId(args.user_id as string, args.email as string);
      return await callAdminAnalytics('user_tokens', {
        user_id: userId,
        status: args.status,
        gateway: args.gateway
      }, 'GET');
    }

    if (toolName === 'admin_refund_tokens') {
      const userId = await resolveUserId(args.user_id as string, args.email as string);
      return await callAdminAnalytics('refund_tokens', {
        user_id: userId,
        token_ids: args.token_ids,
        downgrade_plan_slug: args.downgrade_plan_slug || 'trial_expired'
      }, 'POST');
    }

    if (toolName === 'admin_update_user_trails') {
      const userId = await resolveUserId(args.user_id as string, args.email as string);
      
      if (args.add && Array.isArray(args.add)) {
        for (const trailId of args.add) {
          await callAdminAnalytics('add_user_trail', { user_id: userId, trail_id: trailId }, 'POST');
        }
      }
      
      if (args.remove && Array.isArray(args.remove)) {
        for (const trailId of args.remove) {
          await callAdminAnalytics('remove_user_trail', { user_id: userId, trail_id: trailId }, 'POST');
        }
      }
      
      if (args.replace && Array.isArray(args.replace)) {
        const csv = (args.replace as string[]).join(',');
        await callAdminAnalytics('update_user_trails', { user_id: userId, trail_product_ids: csv }, 'POST');
      }

      return { success: true, message: 'Trilhas atualizadas.' };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ORGANIZATIONS
    // ═══════════════════════════════════════════════════════════════════════════
    if (toolName === 'admin_list_organizations') {
      return await callAdminAnalytics('list_organizations', { search: args.search }, 'GET');
    }

    if (toolName === 'admin_delete_organization') {
      const orgId = String(args.organization_id || '').trim();
      const confirmText = String(args.confirm_text || '').trim();

      if (!orgId) throw new Error('organization_id é obrigatório.');
      if (!UUID_REGEX.test(orgId)) throw new Error('organization_id inválido (deve ser UUID).');
      if (confirmText !== 'deletar') {
        throw new Error('Para confirmar a exclusão, confirm_text deve ser exatamente "deletar".');
      }

      const res = await callAdminAnalytics('delete_organization', {
        organization_id: orgId,
        confirm_text: confirmText
      }, 'POST');

      return { success: true, message: 'Organização deletada com sucesso.', ...res as object };
    }

    if (toolName === 'admin_bulk_delete_organizations') {
      const items = (args.items as Array<{ organization_id: string; confirm_text: string }>) || [];
      const results: Array<{ organization_id: string; success: boolean; error?: string }> = [];

      for (const item of items) {
        if (item.confirm_text !== 'deletar') {
          results.push({ organization_id: item.organization_id, success: false, error: 'confirm_text deve ser "deletar"' });
          continue;
        }

        try {
          await callAdminAnalytics('delete_organization', {
            organization_id: item.organization_id,
            confirm_text: item.confirm_text
          }, 'POST');
          results.push({ organization_id: item.organization_id, success: true });
        } catch (err) {
          results.push({ organization_id: item.organization_id, success: false, error: (err as Error).message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      return { 
        success: true, 
        message: `${successCount} organização(ões) deletada(s).`,
        results
      };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ANALYTICS
    // ═══════════════════════════════════════════════════════════════════════════
    if (toolName === 'admin_get_connection_stats') {
      return await callAdminAnalytics('supabase_connections', {}, 'GET');
    }

    if (toolName === 'admin_get_survey_metrics') {
      const audience = await callAdminAnalytics('survey_audience', {}, 'GET');
      const rank = await callAdminAnalytics('survey_rank', {}, 'GET');
      return { audience, rank };
    }

    if (toolName === 'admin_get_trail_feedback_analytics') {
      return await callAdminAnalytics('trail_feedback_analytics', {}, 'GET');
    }

    if (toolName === 'admin_get_feature_catalog') {
      return await callAdminAnalytics('list_features', {}, 'GET');
    }

    if (toolName === 'admin_get_system_kpis') {
      const res = await callAdminAnalytics('metrics', {
        feature: args.feature_filter,
        date_from: args.date_from,
        date_to: args.date_to
      }, 'GET') as { kpis?: unknown; feature_rank?: unknown[] };
      
      return {
        kpis: res.kpis,
        top_features: (res.feature_rank || []).slice(0, 10)
      };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DOCS
    // ═══════════════════════════════════════════════════════════════════════════
    if (toolName === 'search_documentation') {
      // Placeholder - in production this would call vector search
      return { 
        message: 'Busca na documentação não implementada nesta versão.',
        query: args.query 
      };
    }

    throw new Error(`Tool desconhecida: ${toolName}`);
  } catch (error) {
    console.error(`[ia-console-v3] Tool error (${toolName}):`, error);
    return { 
      error: true, 
      message: `Erro ao executar ${toolName}: ${(error as Error).message}` 
    };
  }
}

/**
 * Process file attachments and extract content
 */
function processAttachments(attachments: FileAttachment[]): string {
  if (!attachments || attachments.length === 0) return '';

  const parts: string[] = [];

  for (const att of attachments) {
    if (att.isImage) {
      // Images will be sent as vision content, not text
      continue;
    }

    // Text-based files
    let content = att.content;
    
    // If it's base64, it might be a document that needs extraction
    if (content.startsWith('data:')) {
      // For now, just note that it's a binary file
      // In production, you'd use a library to extract DOCX/XLSX content
      parts.push(`[Arquivo: ${att.name}]\nTipo: ${att.type}\n(Conteúdo binário - processamento avançado necessário)`);
    } else {
      // Plain text content
      const truncated = content.length > 50000 ? content.slice(0, 50000) + '\n...(truncado)' : content;
      parts.push(`[Arquivo: ${att.name}]\nConteúdo:\n${truncated}`);
    }
  }

  return parts.length > 0 
    ? '\n\n---\nARQUIVOS ANEXADOS:\n' + parts.join('\n\n') + '\n---\n'
    : '';
}

/**
 * Build input for OpenAI Responses API
 * 
 * Note: For vision (images), we need to use a direct API call since
 * the Node.js SDK streaming doesn't fully support multimodal input yet.
 * 
 * When images are present, we'll describe them in text and optionally
 * make a separate vision call.
 */
function buildInputForResponses(
  conversationInput: string,
  attachments?: FileAttachment[]
): string {
  const imageAttachments = attachments?.filter(a => a.isImage) || [];
  
  if (imageAttachments.length === 0) {
    return conversationInput;
  }

  // Add image context to the conversation
  const imageDescriptions = imageAttachments.map((img, i) => 
    `[Imagem ${i + 1}: ${img.name}]`
  ).join('\n');

  return `${conversationInput}\n\n📷 IMAGENS ANEXADAS:\n${imageDescriptions}\n\n(Analisando imagens...)`;
}

/**
 * Analyze images using Chat Completions API (supports vision)
 * Returns a description of the images that can be included in the context
 */
async function analyzeImagesWithVision(
  openaiClient: OpenAI,
  prompt: string,
  attachments: FileAttachment[]
): Promise<string | null> {
  const imageAttachments = attachments.filter(a => a.isImage);
  
  if (imageAttachments.length === 0) {
    return null;
  }

  try {
    // Build content array for Chat Completions API (supports vision)
    const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
      { type: 'text', text: `Analise as imagens a seguir e descreva o que você vê de forma detalhada. Contexto do usuário: "${prompt}"` }
    ];

    for (const img of imageAttachments) {
      content.push({
        type: 'image_url',
        image_url: { url: img.content }
      });
    }

    // Use Chat Completions API for vision (it supports images)
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o', // Vision model
      messages: [
        {
          role: 'user',
          content
        }
      ],
      max_tokens: 1000
    });

    return response.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('[ia-console-v3] Vision analysis error:', error);
    return `(Erro ao analisar imagens: ${(error as Error).message})`;
  }
}

/**
 * Build conversation input from messages
 */
function buildConversationInput(messages: ChatMessage[], attachments?: FileAttachment[]): string {
  const parts: string[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      parts.push(`Usuário: ${msg.content}`);
    } else if (msg.role === 'assistant') {
      parts.push(`Assistente: ${msg.content}`);
    }
  }

  // Add file attachments content
  const fileContent = processAttachments(attachments || []);

  return parts.join('\n\n') + fileContent;
}

/**
 * Save message to database
 */
async function saveMessage(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  sessionId: string,
  role: string,
  content: string,
  metadata?: { tool_calls?: ToolCall[]; attachments?: FileAttachment[] }
) {
  try {
    await supabase.from('admin_chat_messages').insert({
      session_id: sessionId,
      role,
      content,
      metadata: metadata || null
    });
  } catch (err) {
    console.error('[ia-console-v3] Failed to save message:', err);
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
      title: 'Nova conversa',
      metadata: { version: 'v3', model: OPENAI_MODEL }
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
  const featureEnabled = process.env.FEATURE_IA_CONSOLE_V3 === 'true' || 
                         process.env.NEXT_PUBLIC_FEATURE_IA_CONSOLE_V3 === 'true';
  
  if (!featureEnabled) {
    return NextResponse.json(
      { error: 'IA Console V3 desabilitado neste ambiente.' },
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
    const { messages = [], sessionId: existingSessionId, adminUserId, attachments } = body;

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

    // Save user message with attachments
    const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0];
    if (lastUserMessage) {
      await saveMessage(
        supabase, 
        sessionId, 
        'user', 
        lastUserMessage.content,
        attachments?.length ? { attachments } : undefined
      );
    }

    // Build conversation input with file content
    const conversationInput = buildConversationInput(messages, attachments);
    const systemPrompt = getAdminSystemPrompt(adminUserId || session.user.id);

    // Check for images and analyze them if present
    const imageAttachments = attachments?.filter(a => a.isImage) || [];
    let imageAnalysis: string | null = null;

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

          // If there are images, analyze them first using vision model
          if (imageAttachments.length > 0 && openai) {
            controller.enqueue(encoder.encode(JSON.stringify({ 
              k: 'thinking',
              thinking: `Analisando ${imageAttachments.length} imagem(ns)...`
            }) + '\n'));

            const userPrompt = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
            imageAnalysis = await analyzeImagesWithVision(openai, userPrompt, attachments || []);
            
            if (imageAnalysis) {
              controller.enqueue(encoder.encode(JSON.stringify({ 
                k: 't',
                d: `\n\n📷 **Análise das Imagens:**\n${imageAnalysis}\n\n`
              }) + '\n'));
            }
          }

          // Build input with image analysis if available
          let apiInput = buildInputForResponses(conversationInput, attachments);
          if (imageAnalysis) {
            apiInput = `${conversationInput}\n\n---\nANÁLISE DAS IMAGENS ANEXADAS:\n${imageAnalysis}\n---\n`;
          }

          // Agentic Loop State
          let fullContent = imageAnalysis ? `\n\n📷 **Análise das Imagens:**\n${imageAnalysis}\n\n` : '';
          const allToolCalls: ToolCall[] = [];
          let loopCount = 0;
          let currentInput: string = apiInput;

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
                    console.error('[ia-console-v3] Failed to parse tool args:', pending.arguments);
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
              const category = getToolCategory(toolCall.name);
              const toolStartTime = Date.now();

              // Send tool execution indicator
              controller.enqueue(encoder.encode(JSON.stringify({
                k: 'tool_executing',
                name: toolCall.name,
                category,
                args: toolCall.arguments
              }) + '\n'));

              try {
                // Execute tool directly (calls admin-analytics)
                console.log(`[ia-console-v3] Calling tool: ${toolCall.name}`, JSON.stringify(toolCall.arguments).slice(0, 200));
                const result = await executeToolDirectly(toolCall.name, toolCall.arguments);
                const executionTimeMs = Date.now() - toolStartTime;
                console.log(`[ia-console-v3] Tool result for ${toolCall.name} (${executionTimeMs}ms):`, JSON.stringify(result).slice(0, 500));

                // Store result
                toolCall.result = result;
                allToolCalls.push(toolCall);

                // Audit MCP tool call (async, non-blocking)
                auditMcpToolCall({
                  user_id: session.user.id,
                  session_id: sessionId,
                  tool_name: toolCall.name,
                  tool_category: category,
                  arguments: toolCall.arguments,
                  result: result as Record<string, unknown>,
                  success: true,
                  execution_time_ms: executionTimeMs,
                  source: 'ia-console-v3',
                  trace_id: traceId
                }).catch(console.error);

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
                console.error('[ia-console-v3] Tool error:', toolCall.name, err);
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                toolCall.error = errorMessage;
                allToolCalls.push(toolCall);

                // Audit MCP tool call error (async, non-blocking)
                auditMcpToolCall({
                  user_id: session.user.id,
                  session_id: sessionId,
                  tool_name: toolCall.name,
                  tool_category: category,
                  arguments: toolCall.arguments,
                  error: errorMessage,
                  success: false,
                  execution_time_ms: executionTimeMs,
                  source: 'ia-console-v3',
                  trace_id: traceId
                }).catch(console.error);

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
            currentInput = `${apiInput}

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
            event: 'ia_console_v3.response',
            metadata: {
              sessionId,
              traceId,
              model: OPENAI_MODEL,
              toolCallsCount: allToolCalls.length,
              loopsUsed: loopCount,
              hasAttachments: (attachments?.length || 0) > 0
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
          console.error('[ia-console-v3] Stream error:', error);
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
    console.error('[ia-console-v3] Request error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { 
        status: error instanceof Error && error.message.includes('autenticação') ? 401 : 500,
        headers: { 'x-trace-id': traceId }
      }
    );
  }
}
