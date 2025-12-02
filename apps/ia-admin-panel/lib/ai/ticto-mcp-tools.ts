/**
 * Ticto MCP Tools - Definições de ferramentas para OpenAI Function Calling
 * 
 * 6 ferramentas para integração com a API Ticto:
 * - Resumo de vendas (orders)
 * - Busca de pedidos
 * - Detalhes de pedido
 * - Resumo de assinaturas
 * - Busca de assinaturas
 * - Busca de cliente
 */

// Tool definition for OpenAI Responses API
export interface TictoTool {
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

/**
 * Status possíveis de pedidos na Ticto
 */
export const ORDER_STATUS = {
  PAID: 'paid',
  PENDING: 'pending',
  CANCELED: 'canceled',
  REFUNDED: 'refunded',
  EXPIRED: 'expired',
  WAITING_PAYMENT: 'waiting_payment',
} as const;

/**
 * Status possíveis de assinaturas na Ticto
 */
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  PAST_DUE: 'past_due',
  UNPAID: 'unpaid',
  TRIALING: 'trialing',
} as const;

/**
 * Complete list of Ticto MCP Tools
 */
export const TICTO_MCP_TOOLS: TictoTool[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // ORDERS - Gestão de Pedidos/Vendas
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'ticto_get_orders_summary',
    description: 'Obtém o resumo geral de vendas (orders) da Ticto. Retorna totalizadores como total de pedidos, receita total e comissões. Use para ter uma visão geral do desempenho de vendas.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    type: 'function',
    name: 'ticto_search_orders',
    description: 'Busca pedidos (orders) na Ticto com filtros avançados. IMPORTANTE: Quando buscar por email ou documento de cliente, SEMPRE use all_time=true para buscar em todo o histórico, não apenas nos últimos 30 dias.',
    parameters: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email do comprador para busca'
        },
        status: {
          type: 'string',
          enum: ['paid', 'pending', 'canceled', 'refunded', 'expired', 'waiting_payment'],
          description: 'Status do pedido: paid (pago), pending (pendente), canceled (cancelado), refunded (reembolsado), expired (expirado), waiting_payment (aguardando pagamento)'
        },
        order_id: {
          type: 'string',
          description: 'ID específico do pedido para busca direta'
        },
        product_id: {
          type: 'string',
          description: 'ID do produto para filtrar pedidos'
        },
        product_name: {
          type: 'string',
          description: 'Nome do produto para busca parcial'
        },
        document: {
          type: 'string',
          description: 'CPF ou CNPJ do comprador (somente números)'
        },
        all_time: {
          type: 'boolean',
          description: 'Se true, busca em TODO o histórico (desde 2020). Use SEMPRE quando buscar por email ou documento específico de cliente.'
        },
        date_from: {
          type: 'string',
          description: 'Data inicial do período (formato: YYYY-MM-DD). Ignorado se all_time=true.'
        },
        date_to: {
          type: 'string',
          description: 'Data final do período (formato: YYYY-MM-DD). Ignorado se all_time=true.'
        },
        page: {
          type: 'number',
          default: 1,
          description: 'Página para paginação (começa em 1)'
        },
        limit: {
          type: 'number',
          default: 20,
          description: 'Quantidade de resultados por página (máx 100)'
        }
      }
    }
  },
  {
    type: 'function',
    name: 'ticto_get_order_by_id',
    description: 'Obtém detalhes completos de um pedido específico pelo ID. Use quando precisar de informações detalhadas de uma venda.',
    parameters: {
      type: 'object',
      properties: {
        order_id: {
          type: 'string',
          description: 'ID único do pedido na Ticto'
        }
      },
      required: ['order_id']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTIONS - Gestão de Assinaturas
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'ticto_get_subscriptions_summary',
    description: 'Obtém o resumo geral de assinaturas (subscriptions) da Ticto. Retorna totalizadores como total de assinaturas, assinaturas ativas/canceladas e MRR (receita recorrente mensal).',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    type: 'function',
    name: 'ticto_search_subscriptions',
    description: 'Busca assinaturas (subscriptions) na Ticto com filtros avançados. IMPORTANTE: Quando buscar por email ou documento de cliente, SEMPRE use all_time=true para buscar em todo o histórico.',
    parameters: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email do assinante para busca'
        },
        status: {
          type: 'string',
          enum: ['active', 'canceled', 'past_due', 'unpaid', 'trialing'],
          description: 'Status da assinatura: active (ativa), canceled (cancelada), past_due (vencida), unpaid (não paga), trialing (em trial)'
        },
        product_id: {
          type: 'string',
          description: 'ID do produto/plano para filtrar assinaturas'
        },
        product_name: {
          type: 'string',
          description: 'Nome do produto/plano para busca parcial'
        },
        document: {
          type: 'string',
          description: 'CPF ou CNPJ do assinante (somente números)'
        },
        all_time: {
          type: 'boolean',
          description: 'Se true, busca em TODO o histórico (desde 2020). Use SEMPRE quando buscar por email ou documento específico de cliente.'
        },
        date_from: {
          type: 'string',
          description: 'Data inicial do período de criação (formato: YYYY-MM-DD). Ignorado se all_time=true.'
        },
        date_to: {
          type: 'string',
          description: 'Data final do período de criação (formato: YYYY-MM-DD). Ignorado se all_time=true.'
        },
        page: {
          type: 'number',
          default: 1,
          description: 'Página para paginação (começa em 1)'
        },
        limit: {
          type: 'number',
          default: 20,
          description: 'Quantidade de resultados por página (máx 100)'
        }
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMER - Busca Unificada de Cliente
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'ticto_search_customer',
    description: 'Busca um cliente específico e retorna TODAS as suas compras (orders) e assinaturas (subscriptions) de TODO o histórico (desde 2020). Use para ter uma visão completa do histórico de um cliente.',
    parameters: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email do cliente para busca'
        },
        document: {
          type: 'string',
          description: 'CPF ou CNPJ do cliente (somente números)'
        }
      }
    }
  }
];

/**
 * Map tool name to its category for UI display
 */
export function getTictoToolCategory(toolName: string): string {
  if (toolName.includes('order')) {
    return 'orders';
  }
  if (toolName.includes('subscription')) {
    return 'subscriptions';
  }
  if (toolName.includes('customer')) {
    return 'customers';
  }
  return 'ticto';
}

/**
 * Get icon name for tool category
 */
export function getTictoToolIcon(category: string): string {
  const icons: Record<string, string> = {
    orders: 'ShoppingCart',
    subscriptions: 'RefreshCw',
    customers: 'Users',
    ticto: 'Receipt',
  };
  return icons[category] || 'Package';
}

/**
 * Format currency value in BRL
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Format order status to Portuguese
 */
export function formatOrderStatus(status: string): string {
  const statusMap: Record<string, string> = {
    paid: '✅ Pago',
    pending: '⏳ Pendente',
    canceled: '❌ Cancelado',
    refunded: '↩️ Reembolsado',
    expired: '⏰ Expirado',
    waiting_payment: '💳 Aguardando Pagamento',
  };
  return statusMap[status] || status;
}

/**
 * Format subscription status to Portuguese
 */
export function formatSubscriptionStatus(status: string): string {
  const statusMap: Record<string, string> = {
    active: '✅ Ativa',
    canceled: '❌ Cancelada',
    past_due: '⚠️ Vencida',
    unpaid: '💳 Não Paga',
    trialing: '🎁 Em Trial',
  };
  return statusMap[status] || status;
}

