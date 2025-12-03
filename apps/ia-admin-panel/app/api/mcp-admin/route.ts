/**
 * MCP Admin Server - Next.js API Route
 * 
 * Implementa o protocolo JSON-RPC 2.0 para MCP (Model Context Protocol)
 * com todas as 26+ ferramentas administrativas do TomikOS.
 * 
 * Endpoints:
 * - POST: JSON-RPC (initialize, tools/list, tools/call)
 * - GET: Health check
 */

import { NextRequest, NextResponse } from 'next/server';

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ADMIN_ANALYTICS_SECRET = process.env.ADMIN_ANALYTICS_SECRET ?? '';

// UUID regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Default admin ID for fallback
const DEFAULT_ADMIN_ID = '1726f3a7-a8ec-479e-b8a6-d079fbf94e2a';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/**
 * Call admin-analytics Edge Function
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

  console.log(`[MCP-Admin] Calling ${method} ${url.replace(SUPABASE_URL, '[SUPABASE]')}`);

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

  // Use admin-analytics to find user by email
  const result = await callAdminAnalytics('search_users_for_email', { search: normalizedEmail, limit: 1 }, 'GET') as { users?: Array<{ id: string }> };
  
  if (!result.users?.[0]?.id) {
    throw new Error(`Usuário não encontrado para o email ${normalizedEmail}.`);
  }

  return result.users[0].id;
}

// Tool definitions for tools/list response
const TOOLS = [
  // USERS
  {
    name: "admin_list_users",
    description: "Lista usuários do SaaS. Retorna lista com {id, name, email}. Use SEMPRE para encontrar o UUID do usuário antes de emitir tokens.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Termo de busca (email ou nome)" },
        page: { type: "number", default: 1 },
        page_size: { type: "number", default: 20 }
      }
    }
  },
  {
    name: "admin_get_user_details",
    description: "Obtém detalhes completos de um usuário (plano, limites, datas).",
    inputSchema: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] }
  },
  {
    name: "admin_get_user_organizations",
    description: "Lista as organizações onde o usuário é dono (owner).",
    inputSchema: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] }
  },
  {
    name: "admin_update_user",
    description: "Atualiza dados do usuário (tipo conta, assentos).",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        account_type: { type: "string", enum: ["padrao", "profissional", "estudante"] },
        member_seats_extra: { type: "number" }
      },
      required: ["user_id"]
    }
  },
  {
    name: "admin_update_user_email",
    description: "Atualiza o e-mail de um usuário.",
    inputSchema: {
      type: "object",
      properties: { user_id: { type: "string" }, new_email: { type: "string" } },
      required: ["user_id", "new_email"]
    }
  },
  {
    name: "admin_get_user_connections",
    description: "Lista as conexões Supabase configuradas para um usuário (URL, Keys).",
    inputSchema: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] }
  },
  {
    name: "admin_update_connection",
    description: "Atualiza URL ou Chaves de uma conexão Supabase existente.",
    inputSchema: {
      type: "object",
      properties: {
        connection_id: { type: "string" },
        supabase_url: { type: "string" },
        anon_key: { type: "string" },
        service_key: { type: "string" }
      },
      required: ["connection_id"]
    }
  },
  {
    name: "admin_generate_magic_link",
    description: "Gera um link mágico/recovery/signup para um usuário existente.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string" },
        redirect_url: { type: "string" },
        flow_type: { type: "string", enum: ["magiclink", "signup", "recovery", "otp"] },
        send_email: { type: "boolean" }
      },
      required: ["email"]
    }
  },
  {
    name: "admin_create_user",
    description: "Cria um usuário no Auth do Supabase.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string" },
        name: { type: "string" },
        account_type: { type: "string" },
        password_strategy: { type: "string", enum: ["recovery_link", "custom", "random"] },
        password: { type: "string" },
        send_recovery_email: { type: "boolean" }
      },
      required: ["email"]
    }
  },
  {
    name: "admin_send_bulk_emails",
    description: "Envia emails em massa via Resend.",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string" },
        html_content: { type: "string" },
        users: { type: "array", items: { type: "object" } }
      },
      required: ["subject", "html_content", "users"]
    }
  },
  // TOKENS
  {
    name: "admin_list_tokens",
    description: "Lista tokens de licença.",
    inputSchema: { type: "object", properties: { search: { type: "string" }, status: { type: "string" } } }
  },
  {
    name: "admin_issue_tokens",
    description: "Emite novos tokens de licença. Aceita user_id OU email.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "UUID do usuário (opcional se email fornecido)" },
        email: { type: "string", description: "Email do usuário (alternativa ao user_id)" },
        plan_id: { type: "string" },
        quantity: { type: "number" },
        valid_days: { type: "number" },
        is_frozen: { type: "boolean" },
        issuer_user_id: { type: "string" }
      },
      required: ["plan_id"]
    }
  },
  {
    name: "admin_bulk_issue_tokens",
    description: "Emite tokens em massa.",
    inputSchema: {
      type: "object",
      properties: {
        items: { type: "array" },
        issuer_user_id: { type: "string" }
      },
      required: ["items", "issuer_user_id"]
    }
  },
  {
    name: "admin_user_tokens",
    description: "Lista tokens de um usuário específico.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        email: { type: "string" },
        status: { type: "string" },
        gateway: { type: "string" }
      }
    }
  },
  {
    name: "admin_refund_tokens",
    description: "Remove tokens e rebaixa organizações.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        email: { type: "string" },
        token_ids: { type: "array" },
        downgrade_plan_slug: { type: "string" }
      }
    }
  },
  {
    name: "admin_update_user_trails",
    description: "Gerencia trilhas de um usuário.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        email: { type: "string" },
        add: { type: "array" },
        remove: { type: "array" },
        replace: { type: "array" }
      }
    }
  },
  // ORGANIZATIONS
  {
    name: "admin_list_organizations",
    description: "Lista organizações.",
    inputSchema: { type: "object", properties: { search: { type: "string" } } }
  },
  {
    name: "admin_delete_organization",
    description: "Deleta uma organização (DESTRUTIVO).",
    inputSchema: {
      type: "object",
      properties: {
        organization_id: { type: "string" },
        confirm_text: { type: "string" }
      },
      required: ["organization_id", "confirm_text"]
    }
  },
  {
    name: "admin_bulk_delete_organizations",
    description: "Deleta múltiplas organizações.",
    inputSchema: {
      type: "object",
      properties: { items: { type: "array" } },
      required: ["items"]
    }
  },
  // ANALYTICS
  {
    name: "admin_get_connection_stats",
    description: "Estatísticas de conexões Supabase.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "admin_get_survey_metrics",
    description: "Métricas de pesquisas.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "admin_get_trail_feedback_analytics",
    description: "Feedback das trilhas.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "admin_get_feature_catalog",
    description: "Catálogo de features.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "admin_get_system_kpis",
    description: "KPIs em tempo real.",
    inputSchema: {
      type: "object",
      properties: {
        feature_filter: { type: "string" },
        date_from: { type: "string" },
        date_to: { type: "string" }
      }
    }
  },
  // DOCS
  {
    name: "search_documentation",
    description: "Busca nos manuais técnicos.",
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
  }
];

/**
 * Execute a tool call
 */
async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    // USERS
    if (name === 'admin_list_users') {
      if (args.search) {
        const res = await callAdminAnalytics('search_users_for_email', {
          search: args.search,
          limit: args.page_size || 20
        }, 'GET') as { users?: unknown[] };
        return JSON.stringify({ users: res.users || [] });
      } else {
        const res = await callAdminAnalytics('list_users', {
          page: args.page,
          page_size: args.page_size
        }, 'GET');
        return JSON.stringify(res);
      }
    }

    if (name === 'admin_get_user_details') {
      const res = await callAdminAnalytics('user_details', { user_id: args.user_id }, 'GET');
      return JSON.stringify(res);
    }

    if (name === 'admin_get_user_organizations') {
      const res = await callAdminAnalytics('user_organizations', { user_id: args.user_id }, 'GET');
      return JSON.stringify(res);
    }

    if (name === 'admin_update_user') {
      if (args.account_type) {
        await callAdminAnalytics('update_account_type', { user_id: args.user_id, account_type: args.account_type }, 'POST');
      }
      if (args.member_seats_extra !== undefined) {
        await callAdminAnalytics('update_member_seats_extra', { user_id: args.user_id, member_seats_extra: args.member_seats_extra }, 'POST');
      }
      return JSON.stringify({ success: true, message: 'Usuário atualizado.' });
    }

    if (name === 'admin_update_user_email') {
      const res = await callAdminAnalytics('update_email', {
        user_id: args.user_id,
        new_email: args.new_email
      }, 'POST');
      return JSON.stringify(res);
    }

    if (name === 'admin_get_user_connections') {
      const res = await callAdminAnalytics('user_supabase_connections', { user_id: args.user_id }, 'GET');
      return JSON.stringify(res);
    }

    if (name === 'admin_update_connection') {
      if (args.supabase_url && !String(args.supabase_url).startsWith('https://')) {
        throw new Error("URL inválida. Deve começar com https://");
      }
      await callAdminAnalytics('update_supabase_connection', {
        connection_id: args.connection_id,
        supabase_url: args.supabase_url,
        anon_key: args.anon_key,
        service_key: args.service_key
      }, 'POST');
      return JSON.stringify({ success: true, message: 'Conexão atualizada.' });
    }

    if (name === 'admin_generate_magic_link') {
      if (!args.email) throw new Error("email é obrigatório");
      const res = await callAdminAnalytics('generate_magic_link', {
        email: String(args.email).trim().toLowerCase(),
        redirect_url: args.redirect_url,
        flow_type: args.flow_type,
        send_email: args.send_email
      }, 'POST');
      return JSON.stringify(res);
    }

    if (name === 'admin_create_user') {
      if (!args.email) throw new Error("email é obrigatório");
      const res = await callAdminAnalytics('create_user', {
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
      return JSON.stringify(res);
    }

    if (name === 'admin_send_bulk_emails') {
      const res = await callAdminAnalytics('bulk_send_emails', {
        subject: args.subject,
        html_content: args.html_content,
        users: args.users
      }, 'POST') as { success_count?: number; error_count?: number };
      return JSON.stringify({ 
        success: true, 
        message: `Envio processado: ${res.success_count || 0} sucessos, ${res.error_count || 0} erros.` 
      });
    }

    // TOKENS
    if (name === 'admin_list_tokens') {
      const res = await callAdminAnalytics('list_tokens', { search: args.search, status: args.status }, 'GET');
      return JSON.stringify(res);
    }

    if (name === 'admin_issue_tokens') {
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

      // Call admin-analytics to issue tokens
      const res = await callAdminAnalytics('issue_tokens', {
        ...(hasUserId ? { user_id: userId } : {}),
        ...(hasEmail ? { email } : {}),
        plan_id: args.plan_id,
        quantity,
        valid_days: validDays,
        is_frozen: isFrozen,
        issuer_user_id: issuer
      }, 'POST');

      return JSON.stringify({ 
        success: true, 
        message: `${quantity} token(s) emitido(s) com sucesso.`,
        ...(res as Record<string, unknown>)
      });
    }

    if (name === 'admin_bulk_issue_tokens') {
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
      return JSON.stringify({ 
        success: true, 
        message: `Processado em massa: ${successCount}/${items.length} sucessos.`,
        results
      });
    }

    if (name === 'admin_user_tokens') {
      const userId = await resolveUserId(args.user_id as string, args.email as string);
      const res = await callAdminAnalytics('user_tokens', {
        user_id: userId,
        status: args.status,
        gateway: args.gateway
      }, 'GET');
      return JSON.stringify(res);
    }

    if (name === 'admin_refund_tokens') {
      const userId = await resolveUserId(args.user_id as string, args.email as string);
      // Simplified refund - just call admin-analytics
      const res = await callAdminAnalytics('refund_tokens', {
        user_id: userId,
        token_ids: args.token_ids,
        downgrade_plan_slug: args.downgrade_plan_slug || 'trial_expired'
      }, 'POST');
      return JSON.stringify(res);
    }

    if (name === 'admin_update_user_trails') {
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

      return JSON.stringify({ success: true, message: 'Trilhas atualizadas.' });
    }

    // ORGANIZATIONS
    if (name === 'admin_list_organizations') {
      const res = await callAdminAnalytics('list_organizations', { search: args.search }, 'GET');
      return JSON.stringify(res);
    }

    if (name === 'admin_delete_organization') {
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

      return JSON.stringify({ success: true, message: 'Organização deletada com sucesso.', ...(res as Record<string, unknown>) });
    }

    if (name === 'admin_bulk_delete_organizations') {
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
      return JSON.stringify({ 
        success: true, 
        message: `${successCount} organização(ões) deletada(s).`,
        results
      });
    }

    // ANALYTICS
    if (name === 'admin_get_connection_stats') {
      const res = await callAdminAnalytics('supabase_connections', {}, 'GET');
      return JSON.stringify(res);
    }

    if (name === 'admin_get_survey_metrics') {
      const audience = await callAdminAnalytics('survey_audience', {}, 'GET');
      const rank = await callAdminAnalytics('survey_rank', {}, 'GET');
      return JSON.stringify({ audience, rank });
    }

    if (name === 'admin_get_trail_feedback_analytics') {
      const res = await callAdminAnalytics('trail_feedback_analytics', {}, 'GET');
      return JSON.stringify(res);
    }

    if (name === 'admin_get_feature_catalog') {
      const res = await callAdminAnalytics('list_features', {}, 'GET');
      return JSON.stringify(res);
    }

    if (name === 'admin_get_system_kpis') {
      const res = await callAdminAnalytics('metrics', {
        feature: args.feature_filter,
        date_from: args.date_from,
        date_to: args.date_to
      }, 'GET') as { kpis?: unknown; feature_rank?: unknown[] };
      
      return JSON.stringify({
        kpis: res.kpis,
        top_features: (res.feature_rank || []).slice(0, 10)
      });
    }

    // DOCS
    if (name === 'search_documentation') {
      // For now, return a placeholder - in production this would call a vector search
      return JSON.stringify({ 
        message: 'Busca na documentação não implementada nesta versão.',
        query: args.query 
      });
    }

    throw new Error(`Tool desconhecida: ${name}`);
  } catch (error) {
    console.error(`[MCP-Admin] Tool error (${name}):`, error);
    return JSON.stringify({ 
      error: true, 
      message: `Erro ao executar ${name}: ${(error as Error).message}` 
    });
  }
}

// OPTIONS - CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// GET - Health check
export async function GET() {
  return NextResponse.json(
    { 
      status: 'ok', 
      server: 'tomik-admin-mcp', 
      version: '3.0.0',
      tools_count: TOOLS.length
    },
    { headers: corsHeaders }
  );
}

// POST - JSON-RPC handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { method, id, params } = body;

    // Initialize
    if (method === 'initialize') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'tomik-admin-mcp', version: '3.0.0' }
        }
      }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // List Tools
    if (method === 'tools/list') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS }
      }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Execute Tool
    if (method === 'tools/call') {
      const { name, arguments: args } = params || {};
      
      if (!name) {
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: 'Tool name is required' }
        }, { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const result = await executeTool(name, args || {});

      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: { 
          content: [{ type: 'text', text: result }] 
        }
      }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Unknown method
    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` }
    }, { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[MCP-Admin] Request error:', error);
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32603, message: (error as Error).message }
    }, { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

