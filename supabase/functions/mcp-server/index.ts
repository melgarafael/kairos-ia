/// <reference lib="deno.ns" />

import { serve } from "std/http/server.ts";
import { createClient } from '@supabase/supabase-js';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// Configuração do Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Secret para bypass de auth na admin-analytics (opcional, se configurado lá)
const adminAnalyticsSecret = Deno.env.get('ADMIN_ANALYTICS_SECRET') || '';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper robusto para chamar admin-analytics
async function callAdminAnalytics(action: string, params: any = {}, method: 'GET' | 'POST' = 'GET') {
  // Para chamadas internas, podemos usar o cliente admin diretamente se preferirmos,
  // mas chamar a Edge Function garante que usamos a mesma lógica de negócio.
  
  const functionUrl = `${supabaseUrl}/functions/v1/admin-analytics`;
  let url = functionUrl;
  let body: BodyInit | undefined = undefined;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${serviceRoleKey}`, // Usar service role para admin access
    'Content-Type': 'application/json',
  };

  if (adminAnalyticsSecret) {
    headers['x-admin-secret'] = adminAnalyticsSecret;
  }

  if (method === 'GET') {
    const query = new URLSearchParams({ action, ...params });
    url = `${functionUrl}?${query.toString()}`;
  } else {
    // Para POST, action pode ir na URL ou body, mas admin-analytics checa URL primeiro
    const query = new URLSearchParams({ action });
    url = `${functionUrl}?${query.toString()}`;
    body = JSON.stringify(params);
  }

  console.log(`[MCP] Calling ${method} ${url}`);
  
  const res = await fetch(url, { method, headers, body });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro admin-analytics (${res.status}): ${text}`);
  }

  return await res.json();
}

// Definição das Tools
const TOOLS = [
  // --- USERS ---
  {
    name: "admin_list_users",
    description: "Lista usuários do SaaS. Use para encontrar IDs por email/nome.",
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
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" }
      },
      required: ["user_id"]
    }
  },
  {
    name: "admin_get_user_organizations",
    description: "Lista as organizações onde o usuário é dono (owner).",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" }
      },
      required: ["user_id"]
    }
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
      properties: {
        user_id: { type: "string" },
        new_email: { type: "string" }
      },
      required: ["user_id", "new_email"]
    }
  },

  {
    name: "admin_send_bulk_emails",
    description: "Envia emails em massa para uma lista de usuários usando a API do Resend.",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Assunto do email" },
        html_content: { type: "string", description: "Conteúdo HTML do email. Suporta variáveis {nome} e {email}" },
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              email: { type: "string" },
              name: { type: "string" }
            },
            required: ["email"]
          },
          description: "Lista de usuários destinatários"
        }
      },
      required: ["subject", "html_content", "users"]
    }
  },

  // --- TOKENS & PLANS ---
  {
    name: "admin_list_tokens",
    description: "Lista tokens de licença.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Busca por email do dono" },
        status: { type: "string" }
      }
    }
  },
  {
    name: "admin_issue_tokens",
    description: "Emite novos tokens de licença.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        plan_id: { type: "string" },
        quantity: { type: "number", default: 1 },
        valid_days: { type: "number", default: 30 },
        is_frozen: { type: "boolean", default: false }
      },
      required: ["user_id", "plan_id"]
    }
  },

  // --- ORGANIZATIONS ---
  {
    name: "admin_list_organizations",
    description: "Lista organizações.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Nome ou slug" }
      }
    }
  },

  // --- SYSTEM ---
  {
    name: "admin_get_connection_stats",
    description: "Estatísticas de conexão Supabase.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "search_documentation",
    description: "Busca nos manuais técnicos.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"]
    }
  }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // Handshake SSE (compatibilidade n8n)
  if (req.method === 'GET' && url.searchParams.get('transport') === 'sse') {
    const body = new ReadableStream({
      start(controller) {
        const endpointEvent = `event: endpoint\ndata: /mcp-server?transport=post\n\n`;
        controller.enqueue(new TextEncoder().encode(endpointEvent));
      },
      cancel() { console.log("Conexão SSE fechada"); }
    });
    return new Response(body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }
    });
  }

  if (req.method === 'POST') {
    try {
      const request = await req.json();
      
      // Inicialização
      if (request.method === 'initialize') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: "tomik-admin-mcp", version: "2.1.0" }
          }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      // Listar Tools
      if (request.method === 'tools/list') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          result: { tools: TOOLS }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Executar Tool
      if (request.method === 'tools/call') {
        const { name, arguments: args } = request.params;
        let resultContent = "";

        try {
          // --- USERS ---
          if (name === 'admin_list_users') {
            // Mapeia params do MCP para params do admin-analytics
            const res = await callAdminAnalytics('list_users', {
              search: args.search,
              page: args.page,
              page_size: args.page_size
            }, 'GET');
            resultContent = JSON.stringify(res);
          }
          
          else if (name === 'admin_get_user_details') {
            const res = await callAdminAnalytics('user_details', { user_id: args.user_id }, 'GET');
            resultContent = JSON.stringify(res);
          }

          else if (name === 'admin_get_user_organizations') {
            const res = await callAdminAnalytics('user_organizations', { user_id: args.user_id }, 'GET');
            // O endpoint retorna { organizations: [] }
            resultContent = JSON.stringify(res);
          }

          else if (name === 'admin_update_user') {
            // Atualiza account_type se fornecido
            if (args.account_type) {
              await callAdminAnalytics('update_account_type', { 
                user_id: args.user_id, 
                account_type: args.account_type 
              }, 'POST');
            }
            // Atualiza seats se fornecido
            if (args.member_seats_extra !== undefined) {
              await callAdminAnalytics('update_member_seats_extra', { 
                user_id: args.user_id, 
                member_seats_extra: args.member_seats_extra 
              }, 'POST');
            }
            resultContent = "Usuário atualizado.";
          }

          else if (name === 'admin_update_user_email') {
            const res = await callAdminAnalytics('update_email', {
              user_id: args.user_id,
              new_email: args.new_email
            }, 'POST');
            resultContent = JSON.stringify(res);
          }

          else if (name === 'admin_send_bulk_emails') {
            const res = await callAdminAnalytics('bulk_send_emails', {
              subject: args.subject,
              html_content: args.html_content,
              users: args.users
            }, 'POST');
            resultContent = `Envio processado: ${res.success_count} sucessos, ${res.error_count} erros.`;
          }

          // --- TOKENS ---
          else if (name === 'admin_list_tokens') {
            const res = await callAdminAnalytics('list_tokens', { 
              search: args.search,
              status: args.status
            }, 'GET');
            resultContent = JSON.stringify(res);
          }

          else if (name === 'admin_issue_tokens') {
            const res = await callAdminAnalytics('issue_tokens', args, 'POST');
            resultContent = `Tokens emitidos. ID: ${res?.id || 'OK'}`;
          }

          // --- ORGS ---
          else if (name === 'admin_list_organizations') {
            const res = await callAdminAnalytics('list_organizations', { search: args.search }, 'GET');
            resultContent = JSON.stringify(res);
          }

          // --- STATS ---
          else if (name === 'admin_get_connection_stats') {
            const res = await callAdminAnalytics('supabase_connections', {}, 'GET');
            resultContent = JSON.stringify(res);
          }

          // --- DOCS ---
          else if (name === 'search_documentation') {
            const supabase = createClient(supabaseUrl, serviceRoleKey);
            const { data, error } = await supabase.rpc('match_page_sections', {
              query_text: args.query,
              match_threshold: 0.7,
              match_count: 3
            });
            resultContent = error ? "Erro busca." : (data?.map((d: any) => d.content).join('\n---\n') || "Nada encontrado.");
          }

          else {
            throw new Error(`Tool desconhecida: ${name}`);
          }

          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id: request.id,
            result: { content: [{ type: "text", text: resultContent }] }
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } catch (toolErr: any) {
          console.error(`Erro na tool ${name}:`, toolErr);
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id: request.id,
            result: { content: [{ type: "text", text: `Erro ao executar ${name}: ${toolErr.message}` }] }
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {} }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: error.message }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  return new Response("Tomik Admin MCP Active", { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
});
