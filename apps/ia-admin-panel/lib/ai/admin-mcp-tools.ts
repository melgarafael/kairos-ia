/**
 * Admin MCP Tools - Definições de ferramentas para OpenAI Function Calling
 * 
 * 26+ ferramentas administrativas do TomikOS para:
 * - Gestão de usuários e conexões
 * - Gestão de tokens e planos
 * - Gestão de organizações
 * - Analytics e KPIs
 * - Suporte técnico
 */

// Tool definition for OpenAI Responses API
export interface AdminTool {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolProperty>;
    required?: string[];
  };
  strict?: boolean;
}

interface ToolProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: ToolProperty;
}

// Plan IDs - Used by the agent to issue tokens
export const PLAN_IDS = {
  PRO: 'd4836a79-186f-4905-bfac-77ec52fa1dde',
  STARTER: '8b5a1000-957c-4eaf-beca-954a78187337',
  TRIAL: '4663da1a-b552-4127-b1af-4bc30c681682',
} as const;

// Trail IDs - Used by the agent to manage user trails
export const TRAIL_IDS = {
  MONETIZATION: '8b5e0e5e-1f9e-4db4-a1b1-1a3b9f63f0e1',
  MULTI_AGENTS: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  SALES_SCRIPT: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  N8N: 'e2f97c48-8f4a-4fcd-91e8-5b3f471e2cc0',
  LOGIC: 'b3e05412-90c0-4f4e-bd7a-2ea53a748f34',
} as const;

/**
 * Complete list of Admin MCP Tools
 */
export const ADMIN_MCP_TOOLS: AdminTool[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // USERS - Gestão de Usuários
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'admin_list_users',
    description: 'Lista usuários do SaaS. Retorna lista com {id, name, email}. Use SEMPRE para encontrar o UUID do usuário antes de executar outras ações.',
    parameters: {
      type: 'object',
      properties: {
        search: { 
          type: 'string', 
          description: 'Termo de busca (email ou nome)' 
        },
        page: { 
          type: 'number', 
          default: 1,
          description: 'Página para paginação'
        },
        page_size: { 
          type: 'number', 
          default: 20,
          description: 'Quantidade de resultados por página'
        }
      }
    }
  },
  {
    type: 'function',
    name: 'admin_get_user_details',
    description: 'Obtém detalhes completos de um usuário: plano atual, limites, organizações, datas importantes e configurações.',
    parameters: {
      type: 'object',
      properties: {
        user_id: { 
          type: 'string',
          description: 'UUID do usuário (obrigatório)'
        }
      },
      required: ['user_id']
    }
  },
  {
    type: 'function',
    name: 'admin_get_user_organizations',
    description: 'Lista todas as organizações onde o usuário é dono (owner). Retorna ID, nome, slug e plano de cada org.',
    parameters: {
      type: 'object',
      properties: {
        user_id: { 
          type: 'string',
          description: 'UUID do usuário (obrigatório)'
        }
      },
      required: ['user_id']
    }
  },
  {
    type: 'function',
    name: 'admin_update_user',
    description: 'Atualiza dados do usuário: tipo de conta (padrao/profissional/estudante) e assentos extras.',
    parameters: {
      type: 'object',
      properties: {
        user_id: { 
          type: 'string',
          description: 'UUID do usuário'
        },
        account_type: { 
          type: 'string', 
          enum: ['padrao', 'profissional', 'estudante'],
          description: 'Tipo de conta do usuário'
        },
        member_seats_extra: { 
          type: 'number',
          description: 'Quantidade de assentos extras para membros'
        }
      },
      required: ['user_id']
    }
  },
  {
    type: 'function',
    name: 'admin_update_user_email',
    description: 'Atualiza o e-mail de um usuário. Requer confirmação antes de executar.',
    parameters: {
      type: 'object',
      properties: {
        user_id: { 
          type: 'string',
          description: 'UUID do usuário'
        },
        new_email: { 
          type: 'string',
          description: 'Novo endereço de e-mail'
        }
      },
      required: ['user_id', 'new_email']
    }
  },
  {
    type: 'function',
    name: 'admin_get_user_connections',
    description: 'Lista as conexões Supabase configuradas para um usuário (URL, Keys). Útil para debug de conexão.',
    parameters: {
      type: 'object',
      properties: {
        user_id: { 
          type: 'string',
          description: 'UUID do usuário'
        }
      },
      required: ['user_id']
    }
  },
  {
    type: 'function',
    name: 'admin_update_connection',
    description: 'Atualiza URL ou Chaves de uma conexão Supabase existente. URL deve começar com https://.',
    parameters: {
      type: 'object',
      properties: {
        connection_id: { 
          type: 'string', 
          description: 'ID da conexão (obtido via admin_get_user_connections)' 
        },
        supabase_url: { 
          type: 'string', 
          description: 'Nova URL (deve começar com https://)' 
        },
        anon_key: { 
          type: 'string', 
          description: 'Nova chave Anon/Public' 
        },
        service_key: { 
          type: 'string', 
          description: 'Nova chave Service Role (opcional)' 
        }
      },
      required: ['connection_id']
    }
  },
  {
    type: 'function',
    name: 'admin_generate_magic_link',
    description: 'Gera um link mágico/recovery/signup para um usuário existente. Pode opcionalmente enviar email via Resend.',
    parameters: {
      type: 'object',
      properties: {
        email: { 
          type: 'string', 
          description: 'Email do usuário' 
        },
        redirect_url: { 
          type: 'string', 
          description: 'URL de redirecionamento personalizado' 
        },
        flow_type: { 
          type: 'string', 
          enum: ['magiclink', 'signup', 'recovery', 'otp'], 
          description: 'Tipo de link: magiclink (login), recovery (senha), signup (confirmação)' 
        },
        send_email: { 
          type: 'boolean', 
          description: 'Se true, envia email via Resend automaticamente' 
        }
      },
      required: ['email']
    }
  },
  {
    type: 'function',
    name: 'admin_create_user',
    description: 'Cria um usuário no Auth do Supabase. Pode gerar senha aleatória, usar senha específica ou enviar link de recuperação.',
    parameters: {
      type: 'object',
      properties: {
        email: { 
          type: 'string', 
          description: 'Email do novo usuário' 
        },
        name: { 
          type: 'string',
          description: 'Nome do usuário'
        },
        account_type: { 
          type: 'string', 
          enum: ['padrao', 'profissional', 'estudante'],
          description: 'Tipo de conta'
        },
        member_seats_extra: { 
          type: 'number',
          description: 'Assentos extras'
        },
        redirect_url: { 
          type: 'string', 
          description: 'URL customizada para completar o fluxo de recuperação' 
        },
        password_strategy: { 
          type: 'string', 
          enum: ['recovery_link', 'custom', 'random'], 
          description: 'Estratégia de senha: recovery_link (envia link), custom (senha definida), random (gera aleatória)' 
        },
        password: { 
          type: 'string', 
          description: 'Senha customizada (obrigatório se password_strategy=custom)' 
        },
        password_length: { 
          type: 'number', 
          description: 'Comprimento da senha aleatória (default: 16)' 
        },
        send_recovery_email: { 
          type: 'boolean', 
          description: 'Se false em recovery_link, retorna link para compartilhamento manual' 
        }
      },
      required: ['email']
    }
  },
  {
    type: 'function',
    name: 'admin_send_bulk_emails',
    description: 'Envia emails em massa para uma lista de usuários usando a API do Resend. Suporta variáveis {nome} e {email} no HTML.',
    parameters: {
      type: 'object',
      properties: {
        subject: { 
          type: 'string', 
          description: 'Assunto do email' 
        },
        html_content: { 
          type: 'string', 
          description: 'Conteúdo HTML do email. Variáveis: {nome}, {email}' 
        },
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              name: { type: 'string' }
            }
          },
          description: 'Lista de usuários destinatários: [{email, name}]'
        }
      },
      required: ['subject', 'html_content', 'users']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TOKENS & PLANS - Gestão de Licenças
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'admin_list_tokens',
    description: 'Lista tokens de licença do sistema. Permite filtrar por email do dono e status.',
    parameters: {
      type: 'object',
      properties: {
        search: { 
          type: 'string', 
          description: 'Busca por email do dono do token' 
        },
        status: { 
          type: 'string',
          description: 'Status do token (available, used, expired)' 
        }
      }
    }
  },
  {
    type: 'function',
    name: 'admin_issue_tokens',
    description: 'Emite novos tokens de licença para um usuário. Requer IDs de plano: PRO=d4836a79..., Starter=8b5a1000..., Trial=4663da1a...',
    parameters: {
      type: 'object',
      properties: {
        user_id: { 
          type: 'string',
          description: 'UUID do usuário que receberá os tokens'
        },
        plan_id: { 
          type: 'string',
          description: 'ID do plano (PRO, Starter ou Trial UUID)'
        },
        quantity: { 
          type: 'number', 
          default: 1,
          description: 'Quantidade de tokens a emitir'
        },
        valid_days: { 
          type: 'number', 
          default: 30,
          description: 'Validade em dias'
        },
        is_frozen: { 
          type: 'boolean', 
          default: false,
          description: 'Se true, token não expira até ser ativado'
        },
        issuer_user_id: { 
          type: 'string', 
          description: 'UUID do admin que está emitindo (você)' 
        }
      },
      required: ['user_id', 'plan_id', 'issuer_user_id']
    }
  },
  {
    type: 'function',
    name: 'admin_bulk_issue_tokens',
    description: 'Emite tokens em massa para múltiplos usuários de uma vez. Ideal para campanhas.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              plan_id: { type: 'string' },
              quantity: { type: 'number', default: 1 },
              valid_days: { type: 'number', default: 30 },
              is_frozen: { type: 'boolean', default: false }
            }
          },
          description: 'Lista de emissões: [{email, plan_id, quantity, valid_days}]'
        },
        issuer_user_id: { 
          type: 'string',
          description: 'UUID do admin emissor'
        }
      },
      required: ['items', 'issuer_user_id']
    }
  },
  {
    type: 'function',
    name: 'admin_user_tokens',
    description: 'Lista tokens de um usuário específico com filtros avançados de data, status e gateway.',
    parameters: {
      type: 'object',
      properties: {
        user_id: { 
          type: 'string',
          description: 'UUID do usuário'
        },
        email: { 
          type: 'string', 
          description: 'Email (alternativa ao user_id)' 
        },
        purchased_on: { 
          type: 'string', 
          description: 'Data específica (YYYY-MM-DD)' 
        },
        purchased_at_from: { 
          type: 'string', 
          description: 'Data inicial ISO' 
        },
        purchased_at_to: { 
          type: 'string', 
          description: 'Data final ISO' 
        },
        status: { 
          type: 'string',
          description: 'Status do token'
        },
        gateway: { 
          type: 'string',
          description: 'Gateway de pagamento (stripe, manual, etc)'
        }
      }
    }
  },
  {
    type: 'function',
    name: 'admin_refund_tokens',
    description: 'Remove tokens de um usuário (por lista ou filtro) e rebaixa organizações impactadas para trial_expired.',
    parameters: {
      type: 'object',
      properties: {
        user_id: { 
          type: 'string',
          description: 'UUID do usuário'
        },
        email: { 
          type: 'string',
          description: 'Email (alternativa)'
        },
        token_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs específicos dos tokens a remover'
        },
        purchased_on: { type: 'string' },
        purchased_at_from: { type: 'string' },
        purchased_at_to: { type: 'string' },
        status: { 
          type: 'string', 
          description: 'Filtro de status (default: available)' 
        },
        gateway: { type: 'string' },
        downgrade_plan_id: { type: 'string' },
        downgrade_plan_slug: { 
          type: 'string', 
          description: 'Plano de destino (default: trial_expired)' 
        }
      }
    }
  },
  {
    type: 'function',
    name: 'admin_update_user_trails',
    description: 'Gerencia trilhas de estudo do usuário. Pode adicionar, remover ou substituir trilhas.',
    parameters: {
      type: 'object',
      properties: {
        user_id: { 
          type: 'string',
          description: 'UUID do usuário'
        },
        email: { 
          type: 'string',
          description: 'Email (alternativa)'
        },
        add: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs ou slugs de trilhas para adicionar'
        },
        remove: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs ou slugs de trilhas para remover'
        },
        replace: {
          type: 'array',
          items: { type: 'string' },
          description: 'Se informado, substitui toda a lista de trilhas'
        }
      }
    }
  },
  {
    type: 'function',
    name: 'admin_create_org_with_connection',
    description: 'Cria uma organização já integrada ao Supabase do usuário. Requer conexão Supabase ativa.',
    parameters: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        email: { type: 'string' },
        org_name: { 
          type: 'string',
          description: 'Nome da organização'
        },
        org_slug: { 
          type: 'string', 
          description: 'Slug em minúsculas, sem espaços (mínimo 3 caracteres)' 
        },
        connection_id: { 
          type: 'string', 
          description: 'ID de conexão específica (opcional)' 
        }
      },
      required: ['org_name', 'org_slug']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ORGANIZATIONS - Gestão de Organizações
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'admin_list_organizations',
    description: 'Lista organizações do sistema. Permite buscar por nome ou slug.',
    parameters: {
      type: 'object',
      properties: {
        search: { 
          type: 'string', 
          description: 'Busca por nome ou slug da organização' 
        }
      }
    }
  },
  {
    type: 'function',
    name: 'admin_delete_organization',
    description: 'Deleta uma organização do sistema. AÇÃO DESTRUTIVA e IRREVERSÍVEL. Remove membros, audits, etc em cascade.',
    parameters: {
      type: 'object',
      properties: {
        organization_id: { 
          type: 'string', 
          description: 'UUID da organização a ser deletada' 
        },
        confirm_text: { 
          type: 'string', 
          description: 'Deve ser exatamente "deletar" para confirmar' 
        }
      },
      required: ['organization_id', 'confirm_text']
    }
  },
  {
    type: 'function',
    name: 'admin_bulk_delete_organizations',
    description: 'Deleta múltiplas organizações de uma vez. Cada item requer confirm_text="deletar".',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              organization_id: { type: 'string' },
              confirm_text: { type: 'string' }
            }
          },
          description: 'Lista: [{organization_id, confirm_text: "deletar"}]'
        }
      },
      required: ['items']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS & METRICS - Inteligência de Negócio
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'admin_get_connection_stats',
    description: 'Estatísticas gerais do funil de conexão: Total de usuários vs Conectados ao Supabase.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    type: 'function',
    name: 'admin_get_survey_metrics',
    description: 'Dados agregados das pesquisas: ranking de leads por score e perfil de público (segmento, cargo).',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    type: 'function',
    name: 'admin_get_trail_feedback_analytics',
    description: 'Métricas de satisfação e feedback das trilhas de estudo: NPS, avaliações, comentários.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    type: 'function',
    name: 'admin_get_feature_catalog',
    description: 'Lista todas as features disponíveis no sistema com suas configurações.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    type: 'function',
    name: 'admin_get_system_kpis',
    description: 'KPIs em tempo real: DAU/WAU/MAU, sessões online, ranking de features mais usadas.',
    parameters: {
      type: 'object',
      properties: {
        feature_filter: { 
          type: 'string', 
          description: 'Filtrar uso por feature específica' 
        },
        date_from: { 
          type: 'string',
          description: 'Data inicial ISO'
        },
        date_to: { 
          type: 'string',
          description: 'Data final ISO'
        }
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM - Documentação e Suporte
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'search_documentation',
    description: 'Busca semântica nos manuais técnicos do TomikOS. Útil para responder dúvidas como "Como configuro X?".',
    parameters: {
      type: 'object',
      properties: {
        query: { 
          type: 'string',
          description: 'Termo ou pergunta para buscar na documentação'
        }
      },
      required: ['query']
    }
  }
];

/**
 * Map tool name to its category for UI display
 */
export function getToolCategory(toolName: string): string {
  if (toolName.includes('user') || toolName.includes('connection') || toolName.includes('magic') || toolName.includes('create_user') || toolName.includes('bulk_email')) {
    return 'users';
  }
  if (toolName.includes('token') || toolName.includes('trail') || toolName.includes('refund')) {
    return 'tokens';
  }
  if (toolName.includes('org')) {
    return 'orgs';
  }
  if (toolName.includes('kpi') || toolName.includes('stats') || toolName.includes('survey') || toolName.includes('feedback') || toolName.includes('feature') || toolName.includes('analytics')) {
    return 'analytics';
  }
  if (toolName.includes('doc')) {
    return 'docs';
  }
  return 'system';
}

/**
 * Get icon name for tool category
 */
export function getToolIcon(category: string): string {
  const icons: Record<string, string> = {
    users: 'Users',
    tokens: 'Ticket',
    orgs: 'Building2',
    analytics: 'BarChart3',
    docs: 'BookOpen',
    system: 'Settings',
  };
  return icons[category] || 'Wrench';
}

