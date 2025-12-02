import { createClient } from '@supabase/supabase-js';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

// Configuração do Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Secret para bypass de auth na admin-analytics (opcional, se configurado lá)
const adminAnalyticsSecret = Deno.env.get('ADMIN_ANALYTICS_SECRET') || '';
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type TrailIdentifier = { id: string; slug: string | null };

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
  let body: string | undefined = undefined;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${serviceRoleKey}`, // Usar service role para admin access
    'Content-Type': 'application/json',
  };

  if (adminAnalyticsSecret) {
    headers['x-admin-secret'] = adminAnalyticsSecret;
  }

  const cleanParams = Object.fromEntries(
    Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

  if (method === 'GET') {
    const query = new URLSearchParams({ action, ...cleanParams });
    url = `${functionUrl}?${query.toString()}`;
  } else {
    // Para POST, action pode ir na URL ou body, mas admin-analytics checa URL primeiro
    const query = new URLSearchParams({ action });
    url = `${functionUrl}?${query.toString()}`;
    body = JSON.stringify(cleanParams);
  }

  console.log(`[MCP] Calling ${method} ${url}`);
  
  const res = await fetch(url, { method, headers, body });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro admin-analytics (${res.status}): ${text}`);
  }

  return await res.json();
}

async function resolveUserId(userId?: string, email?: string) {
  const trimmedId = (userId || '').trim();
  if (trimmedId && uuidRegex.test(trimmedId)) {
    return trimmedId;
  }
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Informe user_id ou email para identificar o usuário.');
  }
  const { data, error } = await supabaseAdmin
    .from('saas_users')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();
  if (error) throw new Error(`Erro ao buscar usuário por email: ${error.message}`);
  if (!data?.id) throw new Error(`Usuário não encontrado para o email ${normalizedEmail}.`);
  return data.id;
}

const planSlugCache = new Map<string, string>();
async function getPlanIdBySlug(slug: string) {
  const normalized = (slug || '').trim().toLowerCase();
  if (!normalized) throw new Error('Slug de plano inválido.');
  if (planSlugCache.has(normalized)) return planSlugCache.get(normalized)!;
  const { data, error } = await supabaseAdmin
    .from('saas_plans')
    .select('id')
    .eq('slug', normalized)
    .maybeSingle();
  if (error) throw new Error(`Erro ao buscar plano ${normalized}: ${error.message}`);
  if (!data?.id) throw new Error(`Plano com slug ${normalized} não encontrado.`);
  planSlugCache.set(normalized, data.id);
  return data.id;
}

let trailCatalogCache: { expiresAt: number; items: any[] } | null = null;
async function getTrailCatalog() {
  if (trailCatalogCache && trailCatalogCache.expiresAt > Date.now()) {
    return trailCatalogCache.items;
  }
  const res = await callAdminAnalytics('list_trail_products', {}, 'GET');
  const items = res?.products || [];
  trailCatalogCache = { expiresAt: Date.now() + 5 * 60 * 1000, items };
  return items;
}

async function resolveTrailIdentifier(input: string): Promise<TrailIdentifier> {
  const value = (input || '').trim();
  if (!value) throw new Error('Identificador de trilha vazio.');
  const catalog = await getTrailCatalog();
  const lowerValue = value.toLowerCase();
  const bySlug = catalog.find((item: any) => (item.slug || '').toLowerCase() === lowerValue);
  if (bySlug) return { id: bySlug.id, slug: bySlug.slug };
  if (uuidRegex.test(value)) {
    const byId = catalog.find((item: any) => item.id === value);
    return { id: byId?.id || value, slug: byId?.slug || null };
  }
  throw new Error(`Trilha não encontrada: ${value}`);
}

async function resolveTrailIds(list?: string[]) {
  if (!Array.isArray(list) || !list.length) return [];
  const resolved: TrailIdentifier[] = [];
  for (const item of list) {
    const data = await resolveTrailIdentifier(item);
    resolved.push(data);
  }
  return resolved;
}

async function fetchUserTokensWithFilters(params: Record<string, string | undefined>) {
  const res = await callAdminAnalytics('user_tokens', params, 'GET');
  const tokens = res?.tokens || [];
  return tokens.map((token: any) => ({
    ...token,
    owner_user_id: token.owner_user_id || params.user_id
  }));
}

async function fetchTokensByIds(tokenIds: string[]) {
  if (!tokenIds.length) return [];
  const { data, error } = await supabaseAdmin
    .from('saas_plan_tokens')
    .select(`
      id,
      owner_user_id,
      plan_id,
      status,
      purchased_at,
      valid_until,
      gateway,
      applied_organization_id,
      saas_organizations!saas_plan_tokens_applied_organization_id_fkey(id, name, slug)
    `)
    .in('id', tokenIds);
  if (error) throw new Error(`Erro ao buscar tokens: ${error.message}`);
  return data || [];
}

// Definição das Tools
const TOOLS = [
  // --- USERS ---
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
    name: "admin_get_user_connections",
    description: "Lista as conexões Supabase configuradas para um usuário (URL, Keys).",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" }
      },
      required: ["user_id"]
    }
  },
  {
    name: "admin_update_connection",
    description: "Atualiza URL ou Chaves de uma conexão Supabase existente.",
    inputSchema: {
      type: "object",
      properties: {
        connection_id: { type: "string", description: "ID da conexão (obtido via admin_get_user_connections)" },
        supabase_url: { type: "string", description: "Nova URL (deve começar com https://)" },
        anon_key: { type: "string", description: "Nova chave Anon/Public" },
        service_key: { type: "string", description: "Nova chave Service Role (opcional)" }
      },
      required: ["connection_id"]
    }
  },
  {
    name: "admin_generate_magic_link",
    description: "Gera um link mágico/recovery/signup para um usuário existente. Pode opcionalmente enviar email via Resend.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Email do usuário" },
        redirect_url: { type: "string", description: "URL de redirecionamento personalizado" },
        flow_type: { type: "string", enum: ["magiclink", "signup", "recovery", "otp"], description: "Default: magiclink" },
        send_email: { type: "boolean", description: "Se true, envia email via Resend" }
      },
      required: ["email"]
    }
  },
  {
    name: "admin_create_user",
    description: "Cria um usuário no Auth do Supabase. Pode gerar senha aleatória, usar uma senha específica ou enviar link de recuperação.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Email do novo usuário" },
        name: { type: "string" },
        account_type: { type: "string", enum: ["padrao", "profissional", "estudante"] },
        member_seats_extra: { type: "number" },
        redirect_url: { type: "string", description: "URL customizada para completar o fluxo de recuperação" },
        password_strategy: { type: "string", enum: ["recovery_link", "custom", "random"], description: "Default: recovery_link" },
        password: { type: "string", description: "Obrigatório quando password_strategy=custom" },
        password_length: { type: "number", description: "Comprimento da senha quando password_strategy=random. Default 16." },
        send_recovery_email: { type: "boolean", description: "Apenas para recovery_link. Se false, retorna link para compartilhamento manual." }
      },
      required: ["email"]
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
        is_frozen: { type: "boolean", default: false },
        issuer_user_id: { type: "string", description: "ID do admin que está executando a ação (você)" }
      },
      required: ["user_id", "plan_id", "issuer_user_id"]
    }
  },
  {
    name: "admin_bulk_issue_tokens",
    description: "Emite tokens em massa para múltiplos usuários de uma vez.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              email: { type: "string" },
              plan_id: { type: "string" },
              quantity: { type: "number", default: 1 },
              valid_days: { type: "number", default: 30 },
              is_frozen: { type: "boolean", default: false }
            },
            required: ["email", "plan_id"]
          }
        },
        issuer_user_id: { type: "string" }
      },
      required: ["items", "issuer_user_id"]
    }
  },
  {
    name: "admin_user_tokens",
    description: "Lista tokens de um usuário específico com filtros opcionais de data, status e gateway.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        email: { type: "string", description: "Usado se user_id não estiver disponível" },
        purchased_on: { type: "string", description: "Data específica (YYYY-MM-DD)" },
        purchased_at_from: { type: "string", description: "ISO date inicial" },
        purchased_at_to: { type: "string", description: "ISO date final" },
        status: { type: "string" },
        gateway: { type: "string" }
      }
    }
  },
  {
    name: "admin_refund_tokens",
    description: "Remove tokens de um usuário (por lista ou filtro) e rebaixa as organizações impactadas para o plano informado.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        email: { type: "string" },
        token_ids: {
          type: "array",
          items: { type: "string" },
          description: "IDs específicos dos tokens que devem ser removidos"
        },
        purchased_on: { type: "string" },
        purchased_at_from: { type: "string" },
        purchased_at_to: { type: "string" },
        status: { type: "string", description: "Default: available" },
        gateway: { type: "string" },
        downgrade_plan_id: { type: "string" },
        downgrade_plan_slug: { type: "string", description: "Default: trial_expired" }
      }
    }
  },
  {
    name: "admin_update_user_trails",
    description: "Gerencia trilhas (trail_product_ids) de um usuário (adiciona, remove ou substitui).",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        email: { type: "string" },
        add: {
          type: "array",
          items: { type: "string" },
          description: "Lista de IDs ou slugs para adicionar"
        },
        remove: {
          type: "array",
          items: { type: "string" },
          description: "Lista de IDs ou slugs para remover"
        },
        replace: {
          type: "array",
          items: { type: "string" },
          description: "Se informado, substitui toda a lista de trilhas"
        }
      }
    }
  },
  {
    name: "admin_create_org_with_connection",
    description: "Cria uma organização já integrada ao Supabase do usuário (requer conexão ativa).",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        email: { type: "string" },
        org_name: { type: "string" },
        org_slug: { type: "string", description: "Slug em minúsculas, sem espaços" },
        connection_id: { type: "string", description: "Opcional: força o uso de uma conexão específica" }
      },
      required: ["org_name", "org_slug"]
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
  {
    name: "admin_delete_organization",
    description: "Deleta uma organização do sistema. AÇÃO DESTRUTIVA: requer confirmação explícita com confirm_text='deletar'. Cascade remove registros relacionados (memberships, audit, etc).",
    inputSchema: {
      type: "object",
      properties: {
        organization_id: { type: "string", description: "ID UUID da organização a ser deletada" },
        confirm_text: { type: "string", description: "Deve ser exatamente 'deletar' para confirmar a exclusão" }
      },
      required: ["organization_id", "confirm_text"]
    }
  },
  {
    name: "admin_bulk_delete_organizations",
    description: "Deleta múltiplas organizações de uma vez. AÇÃO DESTRUTIVA: cada item requer confirmação com confirm_text='deletar'. Útil para limpar orgs de teste.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              organization_id: { type: "string", description: "ID da organização" },
              confirm_text: { type: "string", description: "Deve ser 'deletar'" }
            },
            required: ["organization_id", "confirm_text"]
          },
          description: "Lista de organizações para deletar"
        }
      },
      required: ["items"]
    }
  },

  // --- ANALYTICS & METRICS ---
  {
    name: "admin_get_connection_stats",
    description: "Estatísticas gerais de usuários e conexões Supabase.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "admin_get_survey_metrics",
    description: "Obtém dados agregados das pesquisas (ranking de leads, perfil de público).",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "admin_get_trail_feedback_analytics",
    description: "Métricas de satisfação e feedback das trilhas de estudo.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "admin_get_feature_catalog",
    description: "Lista todas as features disponíveis no sistema.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "admin_get_system_kpis",
    description: "Obtém KPIs em tempo real (DAU/WAU/MAU, sessões online, ranking de features).",
    inputSchema: {
      type: "object",
      properties: {
        feature_filter: { type: "string", description: "Filtrar uso por feature específica" },
        date_from: { type: "string" },
        date_to: { type: "string" }
      }
    }
  },

  // --- SYSTEM ---
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

Deno.serve(async (req) => {
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
            serverInfo: { name: "tomik-admin-mcp", version: "2.3.0" }
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
            if (args.search) {
              const res = await callAdminAnalytics('search_users_for_email', {
                search: args.search,
                limit: args.page_size || 20
              }, 'GET');
              resultContent = JSON.stringify({ users: res.users || [] });
            } else {
              const res = await callAdminAnalytics('list_users', {
                page: args.page,
                page_size: args.page_size
              }, 'GET');
              resultContent = JSON.stringify(res);
            }
          }
          
          else if (name === 'admin_get_user_details') {
            const res = await callAdminAnalytics('user_details', { user_id: args.user_id }, 'GET');
            resultContent = JSON.stringify(res);
          }

          else if (name === 'admin_get_user_organizations') {
            const res = await callAdminAnalytics('user_organizations', { user_id: args.user_id }, 'GET');
            resultContent = JSON.stringify(res);
          }

          else if (name === 'admin_update_user') {
            if (args.account_type) {
              await callAdminAnalytics('update_account_type', { user_id: args.user_id, account_type: args.account_type }, 'POST');
            }
            if (args.member_seats_extra !== undefined) {
              await callAdminAnalytics('update_member_seats_extra', { user_id: args.user_id, member_seats_extra: args.member_seats_extra }, 'POST');
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

          else if (name === 'admin_get_user_connections') {
            const res = await callAdminAnalytics('user_supabase_connections', {
              user_id: args.user_id
            }, 'GET');
            resultContent = JSON.stringify(res);
          }

          else if (name === 'admin_update_connection') {
            // Validação básica de URL
            if (args.supabase_url && !args.supabase_url.startsWith('https://')) {
              throw new Error("URL inválida. Deve começar com https://");
            }
            const res = await callAdminAnalytics('update_supabase_connection', {
              connection_id: args.connection_id,
              supabase_url: args.supabase_url,
              anon_key: args.anon_key,
              service_key: args.service_key
            }, 'POST');
            resultContent = "Conexão atualizada com sucesso.";
          }

        else if (name === 'admin_generate_magic_link') {
          if (!args.email) {
            throw new Error("email é obrigatório");
          }
          const payload = Object.fromEntries(
            Object.entries({
              email: (args.email || '').trim().toLowerCase(),
              redirect_url: args.redirect_url,
              flow_type: args.flow_type,
              send_email: args.send_email
            }).filter(([, value]) => value !== undefined && value !== null && value !== '')
          );
          const res = await callAdminAnalytics('generate_magic_link', payload, 'POST');
          resultContent = JSON.stringify(res);
        }

        else if (name === 'admin_create_user') {
          if (!args.email) {
            throw new Error("email é obrigatório");
          }
          const payload = Object.fromEntries(
            Object.entries({
              email: (args.email || '').trim().toLowerCase(),
              name: args.name,
              account_type: args.account_type,
              member_seats_extra: args.member_seats_extra,
              redirect_url: args.redirect_url,
              password_strategy: args.password_strategy,
              password: args.password,
              password_length: args.password_length,
              send_recovery_email: args.send_recovery_email
            }).filter(([, value]) => value !== undefined && value !== null && value !== '')
          );
          const res = await callAdminAnalytics('create_user', payload, 'POST');
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
            const res = await callAdminAnalytics('list_tokens', { search: args.search, status: args.status }, 'GET');
            resultContent = JSON.stringify(res);
          }

          else if (name === 'admin_issue_tokens') {
            const supabase = createClient(supabaseUrl, serviceRoleKey);
            
            // Validação básica de UUID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(args.user_id)) throw new Error("user_id inválido");
            if (!uuidRegex.test(args.plan_id)) throw new Error("plan_id inválido");
            
            // ID do emissor: usa o fornecido ou assume um ID de sistema se for "service" ou inválido
            // ATENÇÃO: Se o issuer_user_id for inválido, usaremos o ID do super admin padrão ou null se permitido
            let issuer = args.issuer_user_id;
            if (!issuer || !uuidRegex.test(issuer)) {
               // Fallback para um ID de sistema conhecido ou null (se a coluna permitir)
               // Como não temos o ID do admin hardcoded aqui, vamos tentar passar null se a coluna for nullable
               // Ou, melhor: inserir diretamente na tabela saas_plan_tokens para ter controle total
               issuer = '1726f3a7-a8ec-479e-b8a6-d079fbf94e2a'; // ID do super admin (fallback seguro)
            }

            const quantity = Math.max(1, Number(args.quantity || 1));
            const validDays = Math.max(1, Number(args.valid_days || 30));
            const isFrozen = Boolean(args.is_frozen);
            
            const nowIso = new Date().toISOString();
            const validUntil = new Date(Date.now() + validDays * 24 * 3600 * 1000).toISOString();
            
            // Construir rows para inserção
            const rows = Array.from({ length: quantity }).map(() => ({
              owner_user_id: args.user_id,
              plan_id: args.plan_id,
              status: 'available',
              purchased_at: nowIso,
              valid_until: isFrozen ? null : validUntil,
              is_frozen: isFrozen,
              license_duration_days: isFrozen ? validDays : null,
              issued_by: 'admin',
              issued_by_user_id: issuer,
              gateway: 'mcp-admin'
            }));

            const { data, error } = await supabase.from('saas_plan_tokens').insert(rows).select('id');
            
            if (error) throw new Error(error.message);
            
            resultContent = `Tokens emitidos com sucesso. Qtd: ${quantity}. IDs: ${(data || []).map((t:any) => t.id).join(', ')}`;
          }

          else if (name === 'admin_bulk_issue_tokens') {
            const supabase = createClient(supabaseUrl, serviceRoleKey);
            const items = args.items || [];
            const issuer = args.issuer_user_id || '1726f3a7-a8ec-479e-b8a6-d079fbf94e2a';
            const results: any[] = [];
            
            // Buscar todos os users de uma vez para otimizar
            const emails = items.map((i: any) => i.email);
            const { data: users } = await supabase.from('saas_users').select('id, email').in('email', emails);
            const userMap = new Map((users || []).map((u: any) => [u.email, u.id]));

            for (const item of items) {
              try {
                const userId = userMap.get(item.email);
                if (!userId) {
                  results.push({ email: item.email, ok: false, error: "Usuário não encontrado" });
                  continue;
                }

                const quantity = Math.max(1, Number(item.quantity || 1));
                const validDays = Math.max(1, Number(item.valid_days || 30));
                const isFrozen = Boolean(item.is_frozen);
                const nowIso = new Date().toISOString();
                const validUntil = new Date(Date.now() + validDays * 24 * 3600 * 1000).toISOString();

                const rows = Array.from({ length: quantity }).map(() => ({
                  owner_user_id: userId,
                  plan_id: item.plan_id,
                  status: 'available',
                  purchased_at: nowIso,
                  valid_until: isFrozen ? null : validUntil,
                  is_frozen: isFrozen,
                  license_duration_days: isFrozen ? validDays : null,
                  issued_by: 'admin',
                  issued_by_user_id: issuer,
                  gateway: 'mcp-admin-bulk'
                }));

                await supabase.from('saas_plan_tokens').insert(rows);
                results.push({ email: item.email, ok: true, quantity });
              } catch (err: any) {
                results.push({ email: item.email, ok: false, error: err.message });
              }
            }
            
            const success = results.filter(r => r.ok).length;
            resultContent = `Processado em massa: ${success}/${items.length} sucessos.`;
          }

          else if (name === 'admin_user_tokens') {
            const userId = await resolveUserId(args.user_id, args.email);
            const tokens = await fetchUserTokensWithFilters({
              user_id: userId,
              purchased_on: args.purchased_on,
              purchased_at_from: args.purchased_at_from,
              purchased_at_to: args.purchased_at_to,
              status: args.status,
              gateway: args.gateway
            });
            resultContent = JSON.stringify({ user_id: userId, count: tokens.length, tokens });
          }

          else if (name === 'admin_refund_tokens') {
            const userId = await resolveUserId(args.user_id, args.email);
            const tokenIds = Array.isArray(args.token_ids) ? args.token_ids.filter((id: string) => !!id) : [];
            let tokens: any[] = [];
            if (tokenIds.length) {
              tokens = await fetchTokensByIds(tokenIds);
            } else {
              const statusFilter = args.status ?? 'available';
              tokens = await fetchUserTokensWithFilters({
                user_id: userId,
                purchased_on: args.purchased_on,
                purchased_at_from: args.purchased_at_from,
                purchased_at_to: args.purchased_at_to,
                status: statusFilter,
                gateway: args.gateway
              });
            }

            tokens = (tokens || []).filter((token: any) => {
              if (!token.owner_user_id) return true;
              return token.owner_user_id === userId;
            });

            if (!tokens.length) {
              resultContent = JSON.stringify({ user_id: userId, removed: 0, message: 'Nenhum token encontrado para remover.' });
            } else {
              const downgradePlanId = args.downgrade_plan_id
                || (args.downgrade_plan_slug ? await getPlanIdBySlug(args.downgrade_plan_slug) : await getPlanIdBySlug('trial_expired'));

              const successes: any[] = [];
              const failures: any[] = [];

              for (const token of tokens) {
                const entry: any = {
                  token_id: token.id,
                  applied_organization_id: token.applied_organization_id || null,
                  applied_organization_name: token.applied_organization_name || null,
                  actions: []
                };
                try {
                  if (token.applied_organization_id) {
                    await callAdminAnalytics('update_org_plan', {
                      organization_id: token.applied_organization_id,
                      plan_id: downgradePlanId
                    }, 'POST');
                    entry.actions.push('org_plan_updated');
                    await callAdminAnalytics('unassign_token', { token_id: token.id }, 'POST');
                    entry.actions.push('token_unassigned');
                  }
                  await callAdminAnalytics('delete_token', { token_id: token.id }, 'POST');
                  entry.actions.push('token_deleted');
                  successes.push(entry);
                } catch (err: any) {
                  entry.error = err.message;
                  failures.push(entry);
                }
              }

              resultContent = JSON.stringify({
                user_id: userId,
                total_tokens: tokens.length,
                removed: successes.length,
                failed: failures.length,
                successes,
                failures
              });
            }
          }

          else if (name === 'admin_update_user_trails') {
            const userId = await resolveUserId(args.user_id, args.email);
            const summary: { user_id: string; added: TrailIdentifier[]; removed: TrailIdentifier[]; replaced: boolean } = {
              user_id: userId,
              added: [],
              removed: [],
              replaced: false
            };

            if (Array.isArray(args.replace) && args.replace.length) {
              const resolved = await resolveTrailIds(args.replace);
              const csv = resolved.map((item: any) => item.id).join(',');
              await callAdminAnalytics('update_user_trails', {
                user_id: userId,
                trail_product_ids: csv
              }, 'POST');
              summary.replaced = true;
            }

            if (Array.isArray(args.add) && args.add.length) {
              for (const value of args.add) {
                const trail = await resolveTrailIdentifier(value);
                const slug = trail.slug ?? value ?? null;
                await callAdminAnalytics('add_user_trail', {
                  user_id: userId,
                  trail_id: trail.id
                }, 'POST');
                summary.added.push({ id: trail.id, slug });
              }
            }

            if (Array.isArray(args.remove) && args.remove.length) {
              for (const value of args.remove) {
                const trail = await resolveTrailIdentifier(value);
                const slug = trail.slug ?? value ?? null;
                await callAdminAnalytics('remove_user_trail', {
                  user_id: userId,
                  trail_id: trail.id
                }, 'POST');
                summary.removed.push({ id: trail.id, slug });
              }
            }

            if (!summary.replaced && !summary.added.length && !summary.removed.length) {
              throw new Error('Informe ao menos um add, remove ou replace.');
            }

            resultContent = JSON.stringify(summary);
          }

          else if (name === 'admin_create_org_with_connection') {
            const userId = await resolveUserId(args.user_id, args.email);
            const orgName = (args.org_name || '').trim();
            const orgSlugRaw = (args.org_slug || '').trim().toLowerCase();
            if (!orgName) throw new Error('org_name é obrigatório.');
            if (!orgSlugRaw) throw new Error('org_slug é obrigatório.');
            if (!/^[a-z0-9-]{3,}$/.test(orgSlugRaw)) {
              throw new Error('org_slug inválido. Use apenas letras minúsculas, números e hífens (mínimo 3 caracteres).');
            }

            const connectionsRes = await callAdminAnalytics('user_supabase_connections', { user_id: userId }, 'GET');
            const connections = connectionsRes?.connections || [];
            if (!connections.length) {
              throw new Error('Usuário não possui conexão Supabase ativa.');
            }

            if (args.connection_id) {
              const match = connections.find((conn: any) => conn.id === args.connection_id);
              if (!match) throw new Error('connection_id informado não pertence ao usuário.');
              if (match.is_active === false) throw new Error('connection_id informado está inativo.');
            }

            const org = await callAdminAnalytics('create_org_for_user', {
              user_id: userId,
              org_name: orgName,
              org_slug: orgSlugRaw
            }, 'POST');

            resultContent = JSON.stringify({
              user_id: userId,
              org
            });
          }

          // --- ORGS ---
          else if (name === 'admin_list_organizations') {
            const res = await callAdminAnalytics('list_organizations', { search: args.search }, 'GET');
            resultContent = JSON.stringify(res);
          }

          else if (name === 'admin_delete_organization') {
            const orgId = (args.organization_id || '').trim();
            const confirmText = (args.confirm_text || '').trim();
            
            if (!orgId) throw new Error('organization_id é obrigatório.');
            if (!uuidRegex.test(orgId)) throw new Error('organization_id inválido (deve ser UUID).');
            if (confirmText !== 'deletar') {
              throw new Error('Para confirmar a exclusão, confirm_text deve ser exatamente "deletar".');
            }

            // Buscar detalhes da org antes de deletar (para o log)
            const { data: orgDetails } = await supabaseAdmin
              .from('saas_organizations')
              .select('id, name, slug, owner_id')
              .eq('id', orgId)
              .maybeSingle();

            if (!orgDetails) {
              throw new Error(`Organização não encontrada: ${orgId}`);
            }

            // Chamar admin-analytics para deletar
            const res = await callAdminAnalytics('delete_organization', {
              organization_id: orgId,
              confirm_text: confirmText
            }, 'POST');

            resultContent = JSON.stringify({
              success: true,
              deleted_organization: {
                id: orgDetails.id,
                name: orgDetails.name,
                slug: orgDetails.slug
              },
              message: `Organização "${orgDetails.name}" (${orgDetails.slug}) deletada com sucesso.`
            });
          }

          else if (name === 'admin_bulk_delete_organizations') {
            const items = args.items || [];
            if (!Array.isArray(items) || items.length === 0) {
              throw new Error('items é obrigatório e deve conter ao menos uma organização.');
            }

            const results: { organization_id: string; name?: string; slug?: string; success: boolean; error?: string }[] = [];

            for (const item of items) {
              const orgId = (item.organization_id || '').trim();
              const confirmText = (item.confirm_text || '').trim();

              if (!orgId) {
                results.push({ organization_id: orgId, success: false, error: 'organization_id ausente' });
                continue;
              }
              if (!uuidRegex.test(orgId)) {
                results.push({ organization_id: orgId, success: false, error: 'UUID inválido' });
                continue;
              }
              if (confirmText !== 'deletar') {
                results.push({ organization_id: orgId, success: false, error: 'confirm_text deve ser "deletar"' });
                continue;
              }

              try {
                // Buscar detalhes da org antes de deletar
                const { data: orgDetails } = await supabaseAdmin
                  .from('saas_organizations')
                  .select('id, name, slug')
                  .eq('id', orgId)
                  .maybeSingle();

                if (!orgDetails) {
                  results.push({ organization_id: orgId, success: false, error: 'Organização não encontrada' });
                  continue;
                }

                // Deletar via admin-analytics
                await callAdminAnalytics('delete_organization', {
                  organization_id: orgId,
                  confirm_text: confirmText
                }, 'POST');

                results.push({
                  organization_id: orgId,
                  name: orgDetails.name,
                  slug: orgDetails.slug,
                  success: true
                });
              } catch (err: any) {
                results.push({ organization_id: orgId, success: false, error: err.message });
              }
            }

            const successCount = results.filter(r => r.success).length;
            const failedCount = results.filter(r => !r.success).length;

            resultContent = JSON.stringify({
              total: items.length,
              success_count: successCount,
              failed_count: failedCount,
              results,
              message: `${successCount} organização(ões) deletada(s) com sucesso. ${failedCount} falha(s).`
            });
          }

          // --- ANALYTICS ---
          else if (name === 'admin_get_connection_stats') {
            const res = await callAdminAnalytics('supabase_connections', {}, 'GET');
            resultContent = JSON.stringify(res);
          }

          else if (name === 'admin_get_survey_metrics') {
            const audience = await callAdminAnalytics('survey_audience', {}, 'GET');
            const rank = await callAdminAnalytics('survey_rank', {}, 'GET');
            resultContent = JSON.stringify({ audience, rank });
          }

          else if (name === 'admin_get_trail_feedback_analytics') {
            const res = await callAdminAnalytics('trail_feedback_analytics', {}, 'GET');
            resultContent = JSON.stringify(res);
          }

          else if (name === 'admin_get_feature_catalog') {
            const res = await callAdminAnalytics('list_features', {}, 'GET');
            resultContent = JSON.stringify(res);
          }

          else if (name === 'admin_get_system_kpis') {
            const res = await callAdminAnalytics('metrics', {
              feature: args.feature_filter,
              date_from: args.date_from,
              date_to: args.date_to
            }, 'GET');
            // metrics retorna { kpis: {...}, feature_rank: [...], dau_series: [...] }
            // Retornamos um resumo para não estourar o contexto
            resultContent = JSON.stringify({
              kpis: res.kpis,
              top_features: (res.feature_rank || []).slice(0, 10),
              active_users_today: res.kpis?.dau
            });
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
