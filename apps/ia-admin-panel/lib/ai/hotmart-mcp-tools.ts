/**
 * Hotmart MCP Tools - Definições de ferramentas para OpenAI Function Calling
 * 
 * 9 ferramentas para integração com a API Hotmart:
 * - Resumo de vendas
 * - Busca de vendas
 * - Detalhes de transação
 * - Resumo de assinaturas
 * - Busca de assinaturas
 * - Busca de cliente
 * - Lista de produtos
 * - Comissões de venda
 * - Reembolsos
 */

// Tool definition for OpenAI Responses API
export interface HotmartTool {
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
 * Status possíveis de transações na Hotmart
 */
export const HOTMART_TRANSACTION_STATUS = {
  APPROVED: 'APPROVED',
  BLOCKED: 'BLOCKED',
  CANCELLED: 'CANCELLED',
  CHARGEBACK: 'CHARGEBACK',
  COMPLETE: 'COMPLETE',
  EXPIRED: 'EXPIRED',
  NO_FUNDS: 'NO_FUNDS',
  OVERDUE: 'OVERDUE',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  PRE_ORDER: 'PRE_ORDER',
  PRINTED_BILLET: 'PRINTED_BILLET',
  PROCESSING_TRANSACTION: 'PROCESSING_TRANSACTION',
  PROTESTED: 'PROTESTED',
  REFUNDED: 'REFUNDED',
  STARTED: 'STARTED',
  UNDER_ANALYSIS: 'UNDER_ANALYSIS',
  WAITING_PAYMENT: 'WAITING_PAYMENT',
} as const;

/**
 * Status possíveis de assinaturas na Hotmart
 */
export const HOTMART_SUBSCRIPTION_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  CANCELLED_BY_CUSTOMER: 'CANCELLED_BY_CUSTOMER',
  CANCELLED_BY_SELLER: 'CANCELLED_BY_SELLER',
  CANCELLED_BY_ADMIN: 'CANCELLED_BY_ADMIN',
  DELAYED: 'DELAYED',
  STARTED: 'STARTED',
  OVERDUE: 'OVERDUE',
} as const;

/**
 * Tipos de pagamento na Hotmart
 */
export const HOTMART_PAYMENT_TYPE = {
  BILLET: 'BILLET',
  CREDIT_CARD: 'CREDIT_CARD',
  PIX: 'PIX',
  PAYPAL: 'PAYPAL',
  GOOGLE_PAY: 'GOOGLE_PAY',
  DIRECT_BANK_TRANSFER: 'DIRECT_BANK_TRANSFER',
} as const;

/**
 * Complete list of Hotmart MCP Tools
 */
export const HOTMART_MCP_TOOLS: HotmartTool[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // SALES - Gestão de Vendas
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'hotmart_get_sales_summary',
    description: 'Obtém o resumo geral de vendas da Hotmart. Retorna totalizadores como total de transações e valor total. Use para ter uma visão geral do desempenho de vendas na plataforma Hotmart.',
    parameters: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Data inicial do período (formato: YYYY-MM-DD). Se não informado, considera os últimos 30 dias.'
        },
        end_date: {
          type: 'string',
          description: 'Data final do período (formato: YYYY-MM-DD). Se não informado, considera a data atual.'
        },
        transaction_status: {
          type: 'string',
          enum: ['APPROVED', 'COMPLETE', 'CANCELLED', 'REFUNDED', 'CHARGEBACK', 'WAITING_PAYMENT', 'EXPIRED'],
          description: 'Filtrar resumo por status específico de transação'
        }
      }
    }
  },
  {
    type: 'function',
    name: 'hotmart_search_sales',
    description: 'Busca vendas (transações) na Hotmart com filtros avançados. IMPORTANTE: As datas devem ser informadas no formato YYYY-MM-DD. Use all_time=true para buscar em todo o histórico quando pesquisar por email ou nome de cliente.',
    parameters: {
      type: 'object',
      properties: {
        buyer_email: {
          type: 'string',
          description: 'Email do comprador para busca exata'
        },
        buyer_name: {
          type: 'string',
          description: 'Nome do comprador para busca'
        },
        transaction_status: {
          type: 'string',
          enum: ['APPROVED', 'BLOCKED', 'CANCELLED', 'CHARGEBACK', 'COMPLETE', 'EXPIRED', 'NO_FUNDS', 'OVERDUE', 'PARTIALLY_REFUNDED', 'PRE_ORDER', 'PRINTED_BILLET', 'PROCESSING_TRANSACTION', 'PROTESTED', 'REFUNDED', 'STARTED', 'UNDER_ANALYSIS', 'WAITING_PAYMENT'],
          description: 'Status da transação para filtrar'
        },
        transaction: {
          type: 'string',
          description: 'Código único da transação (ex: HP17715690036014) para busca direta'
        },
        product_id: {
          type: 'number',
          description: 'ID do produto para filtrar vendas'
        },
        payment_type: {
          type: 'string',
          enum: ['BILLET', 'CREDIT_CARD', 'PIX', 'PAYPAL', 'GOOGLE_PAY', 'DIRECT_BANK_TRANSFER'],
          description: 'Tipo de pagamento utilizado'
        },
        offer_code: {
          type: 'string',
          description: 'Código da oferta do produto'
        },
        commission_as: {
          type: 'string',
          enum: ['PRODUCER', 'COPRODUCER', 'AFFILIATE'],
          description: 'Filtrar por tipo de comissionamento'
        },
        all_time: {
          type: 'boolean',
          description: 'Se true, busca em TODO o histórico (desde o início). Use SEMPRE quando buscar por email ou nome específico de cliente.'
        },
        start_date: {
          type: 'string',
          description: 'Data inicial do período (formato: YYYY-MM-DD). Ignorado se all_time=true.'
        },
        end_date: {
          type: 'string',
          description: 'Data final do período (formato: YYYY-MM-DD). Ignorado se all_time=true.'
        },
        max_results: {
          type: 'number',
          default: 50,
          description: 'Quantidade máxima de resultados por página (máx 100)'
        },
        page_token: {
          type: 'string',
          description: 'Token de paginação para obter próxima página de resultados'
        }
      }
    }
  },
  {
    type: 'function',
    name: 'hotmart_get_sale_by_transaction',
    description: 'Obtém detalhes completos de uma venda específica pelo código de transação. Use quando precisar de informações detalhadas de uma transação específica na Hotmart.',
    parameters: {
      type: 'object',
      properties: {
        transaction: {
          type: 'string',
          description: 'Código único da transação na Hotmart (ex: HP17715690036014)'
        }
      },
      required: ['transaction']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTIONS - Gestão de Assinaturas
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'hotmart_get_subscriptions_summary',
    description: 'Obtém o resumo geral de assinaturas da Hotmart. Retorna totalizadores como total de assinaturas, ativas, canceladas e MRR (receita recorrente mensal).',
    parameters: {
      type: 'object',
      properties: {
        product_id: {
          type: 'number',
          description: 'ID do produto para filtrar resumo de assinaturas'
        },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'INACTIVE', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_SELLER', 'CANCELLED_BY_ADMIN', 'DELAYED', 'STARTED', 'OVERDUE'],
          description: 'Status da assinatura para filtrar'
        }
      }
    }
  },
  {
    type: 'function',
    name: 'hotmart_search_subscriptions',
    description: 'Busca assinaturas na Hotmart com filtros avançados. Permite filtrar por status, produto e período.',
    parameters: {
      type: 'object',
      properties: {
        subscriber_code: {
          type: 'string',
          description: 'Código único do assinante'
        },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'INACTIVE', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_SELLER', 'CANCELLED_BY_ADMIN', 'DELAYED', 'STARTED', 'OVERDUE'],
          description: 'Status da assinatura: ACTIVE (ativa), INACTIVE (inativa), CANCELLED_* (cancelada), DELAYED (atrasada), OVERDUE (vencida)'
        },
        product_id: {
          type: 'number',
          description: 'ID do produto/plano para filtrar assinaturas'
        },
        plan_id: {
          type: 'number',
          description: 'ID do plano específico'
        },
        max_results: {
          type: 'number',
          default: 50,
          description: 'Quantidade de resultados por página (máx 100)'
        },
        page_token: {
          type: 'string',
          description: 'Token de paginação para próxima página'
        }
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMER - Busca Unificada de Cliente
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'hotmart_search_customer',
    description: 'Busca um cliente específico na Hotmart e retorna TODAS as suas compras e assinaturas. Use para ter uma visão completa do histórico de um cliente na plataforma.',
    parameters: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email do cliente para busca'
        },
        name: {
          type: 'string',
          description: 'Nome do cliente para busca'
        }
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTS - Gestão de Produtos
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'hotmart_get_products',
    description: 'Lista os produtos cadastrados na conta Hotmart. Retorna ID, nome, status e preço base dos produtos.',
    parameters: {
      type: 'object',
      properties: {
        max_results: {
          type: 'number',
          default: 50,
          description: 'Quantidade de resultados por página (máx 100)'
        },
        page_token: {
          type: 'string',
          description: 'Token de paginação para próxima página'
        }
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMISSIONS - Comissões de Venda
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'hotmart_get_commissions',
    description: 'Obtém as comissões de vendas da Hotmart. Mostra valores comissionados por transação, seja como produtor, coprodutor ou afiliado.',
    parameters: {
      type: 'object',
      properties: {
        product_id: {
          type: 'number',
          description: 'ID do produto para filtrar comissões'
        },
        transaction_status: {
          type: 'string',
          enum: ['APPROVED', 'COMPLETE', 'CANCELLED', 'REFUNDED'],
          description: 'Status das transações para filtrar'
        },
        commission_as: {
          type: 'string',
          enum: ['PRODUCER', 'COPRODUCER', 'AFFILIATE'],
          description: 'Tipo de comissionamento: PRODUCER (produtor), COPRODUCER (coprodutor), AFFILIATE (afiliado)'
        },
        start_date: {
          type: 'string',
          description: 'Data inicial do período (formato: YYYY-MM-DD)'
        },
        end_date: {
          type: 'string',
          description: 'Data final do período (formato: YYYY-MM-DD)'
        },
        max_results: {
          type: 'number',
          default: 50,
          description: 'Quantidade de resultados por página'
        }
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REFUNDS - Reembolsos
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'hotmart_get_refunds',
    description: 'Busca vendas reembolsadas ou com pedido de reembolso na Hotmart. Use para verificar histórico de devoluções.',
    parameters: {
      type: 'object',
      properties: {
        product_id: {
          type: 'number',
          description: 'ID do produto para filtrar reembolsos'
        },
        buyer_email: {
          type: 'string',
          description: 'Email do comprador'
        },
        start_date: {
          type: 'string',
          description: 'Data inicial do período (formato: YYYY-MM-DD)'
        },
        end_date: {
          type: 'string',
          description: 'Data final do período (formato: YYYY-MM-DD)'
        },
        max_results: {
          type: 'number',
          default: 50,
          description: 'Quantidade de resultados por página'
        }
      }
    }
  }
];

/**
 * Map tool name to its category for UI display
 */
export function getHotmartToolCategory(toolName: string): string {
  if (toolName.includes('sales') || toolName.includes('sale')) {
    return 'sales';
  }
  if (toolName.includes('subscription')) {
    return 'subscriptions';
  }
  if (toolName.includes('customer')) {
    return 'customers';
  }
  if (toolName.includes('product')) {
    return 'products';
  }
  if (toolName.includes('commission')) {
    return 'commissions';
  }
  if (toolName.includes('refund')) {
    return 'refunds';
  }
  return 'hotmart';
}

/**
 * Get icon name for tool category
 */
export function getHotmartToolIcon(category: string): string {
  const icons: Record<string, string> = {
    sales: 'ShoppingCart',
    subscriptions: 'RefreshCw',
    customers: 'Users',
    products: 'Package',
    commissions: 'DollarSign',
    refunds: 'RotateCcw',
    hotmart: 'Flame',
  };
  return icons[category] || 'Flame';
}

/**
 * Format currency value in BRL
 * NOTA: Hotmart já retorna valores em BRL, não precisa dividir por 100
 */
export function formatHotmartCurrency(value: number, currencyCode: string = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currencyCode,
  }).format(value);
}

/**
 * Format transaction status to Portuguese
 */
export function formatHotmartTransactionStatus(status: string): string {
  const statusMap: Record<string, string> = {
    APPROVED: '✅ Aprovado',
    BLOCKED: '🚫 Bloqueado',
    CANCELLED: '❌ Cancelado',
    CHARGEBACK: '⚠️ Chargeback',
    COMPLETE: '✅ Completo',
    EXPIRED: '⏰ Expirado',
    NO_FUNDS: '💳 Sem Fundos',
    OVERDUE: '⚠️ Atrasado',
    PARTIALLY_REFUNDED: '↩️ Parcialmente Reembolsado',
    PRE_ORDER: '📋 Pré-Venda',
    PRINTED_BILLET: '📄 Boleto Impresso',
    PROCESSING_TRANSACTION: '⏳ Processando',
    PROTESTED: '📢 Protestado',
    REFUNDED: '↩️ Reembolsado',
    STARTED: '🔄 Iniciado',
    UNDER_ANALYSIS: '🔍 Em Análise',
    WAITING_PAYMENT: '💳 Aguardando Pagamento',
  };
  return statusMap[status] || status;
}

/**
 * Format subscription status to Portuguese
 */
export function formatHotmartSubscriptionStatus(status: string): string {
  const statusMap: Record<string, string> = {
    ACTIVE: '✅ Ativa',
    INACTIVE: '⏸️ Inativa',
    CANCELLED_BY_CUSTOMER: '❌ Cancelada pelo Cliente',
    CANCELLED_BY_SELLER: '❌ Cancelada pelo Vendedor',
    CANCELLED_BY_ADMIN: '❌ Cancelada pelo Admin',
    DELAYED: '⚠️ Atrasada',
    STARTED: '🔄 Iniciada',
    OVERDUE: '⚠️ Vencida',
  };
  return statusMap[status] || status;
}

/**
 * Format payment type to Portuguese
 */
export function formatHotmartPaymentType(type: string): string {
  const typeMap: Record<string, string> = {
    BILLET: '📄 Boleto',
    CREDIT_CARD: '💳 Cartão de Crédito',
    PIX: '⚡ PIX',
    PAYPAL: '🅿️ PayPal',
    GOOGLE_PAY: '📱 Google Pay',
    DIRECT_BANK_TRANSFER: '🏦 Transferência Bancária',
    CASH_PAYMENT: '💵 Pagamento em Dinheiro',
    DIRECT_DEBIT: '🏦 Débito Direto',
    FINANCED_BILLET: '📄 Boleto Financiado',
    FINANCED_INSTALLMENT: '💳 Parcelamento Financiado',
    HOTCARD: '🔥 Hotcard',
    HYBRID: '🔄 Híbrido',
    MANUAL_TRANSFER: '🏦 Transferência Manual',
    PAYPAL_INTERNACIONAL: '🅿️ PayPal Internacional',
    WALLET: '👛 Carteira',
  };
  return typeMap[type] || type;
}

/**
 * Convert date string to Hotmart timestamp (milliseconds)
 */
export function dateToHotmartTimestamp(dateStr: string): number {
  return new Date(dateStr).getTime();
}

/**
 * Convert Hotmart timestamp to date string
 */
export function hotmartTimestampToDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('pt-BR');
}

/**
 * Convert Hotmart timestamp to datetime string
 */
export function hotmartTimestampToDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('pt-BR');
}

