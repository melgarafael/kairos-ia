/**
 * Ticto API Client
 * 
 * Cliente para integração com a API da Ticto (plataforma de vendas).
 * Implementa OAuth2 com cache de token e refresh automático.
 * 
 * Documentação: https://tictoapi.readme.io/reference/getting-started-with-your-api-1
 */

// Types
export interface TictoAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

export interface TictoOrder {
  id: string;
  order_id?: string;
  status: string;
  customer: {
    name: string;
    email: string;
    document?: string;
    phone?: string;
  };
  product: {
    id: string;
    name: string;
    price: number;
  };
  payment: {
    method: string;
    status: string;
    amount: number;
    currency: string;
    paid_at?: string;
  };
  commission?: {
    amount: number;
    percentage: number;
  };
  created_at: string;
  updated_at?: string;
}

export interface TictoSubscription {
  id: string;
  subscription_id?: string;
  status: string;
  customer: {
    name: string;
    email: string;
    document?: string;
    phone?: string;
  };
  plan: {
    id: string;
    name: string;
    price: number;
    interval: string;
  };
  current_period_start?: string;
  current_period_end?: string;
  canceled_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface TictoOrdersSummary {
  total_orders: number;
  total_revenue: number;
  total_commission: number;
  currency: string;
  period?: {
    from: string;
    to: string;
  };
  // Allow additional fields from API
  [key: string]: unknown;
}

export interface TictoSubscriptionsSummary {
  total_subscriptions: number;
  active_subscriptions: number;
  canceled_subscriptions: number;
  past_due_subscriptions?: number;
  mrr: number; // Monthly Recurring Revenue
  active_revenue?: number; // Receita total das ativas
  canceled_revenue?: number; // Receita das canceladas
  past_due_revenue?: number; // Receita das atrasadas
  currency: string;
  // Allow additional fields from API
  [key: string]: unknown;
}

export interface TictoPaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface TictoSearchParams {
  page?: number;
  limit?: number;
  email?: string;
  status?: string;
  order_id?: string;
  product_id?: string;
  product_name?: string;
  document?: string;
  date_from?: string;
  date_to?: string;
}

// Token cache
interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: CachedToken | null = null;

// Configuration
const TICTO_CLIENT_ID = process.env.TICTO_CLIENT_ID || '';
const TICTO_CLIENT_SECRET = process.env.TICTO_CLIENT_SECRET || '';
const TICTO_API_BASE_URL = process.env.TICTO_API_BASE_URL || 'https://glados.ticto.cloud';

// Token expiration buffer (5 minutes before actual expiry)
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/**
 * Convert cents to BRL (Ticto API returns values in cents)
 */
function centsToBRL(cents: number): number {
  return cents / 100;
}

/**
 * Convert monetary fields in an object from cents to BRL
 */
function convertMonetaryFields<T extends Record<string, unknown>>(obj: T, fields: string[]): T {
  const result = { ...obj };
  for (const field of fields) {
    if (typeof result[field] === 'number') {
      (result as Record<string, unknown>)[field] = centsToBRL(result[field] as number);
    }
  }
  return result;
}

/**
 * TictoClient - Singleton client for Ticto API
 */
class TictoClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.baseUrl = TICTO_API_BASE_URL;
    this.clientId = TICTO_CLIENT_ID;
    this.clientSecret = TICTO_CLIENT_SECRET;
  }

  /**
   * Check if credentials are configured
   */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Get valid access token (from cache or fresh)
   */
  private async getAccessToken(): Promise<string> {
    // Check cache
    if (tokenCache && tokenCache.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
      return tokenCache.accessToken;
    }

    // Fetch new token
    const token = await this.authenticate();
    return token;
  }

  /**
   * Authenticate with Ticto OAuth2
   */
  private async authenticate(): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Ticto API não configurada. Defina TICTO_CLIENT_ID e TICTO_CLIENT_SECRET.');
    }

    const url = `${this.baseUrl}/api/security/oauth/token`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TictoClient] Auth error:', response.status, errorText);
      throw new Error(`Falha na autenticação Ticto: ${response.status} - ${errorText}`);
    }

    const data: TictoAuthResponse = await response.json();

    // Cache token
    tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };

    console.log('[TictoClient] Token obtained, expires in:', data.expires_in, 'seconds');
    return data.access_token;
  }

  /**
   * Make authenticated request to Ticto API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAccessToken();
    
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TictoClient] Request error (${endpoint}):`, response.status, errorText);
      
      // If 401, clear cache and retry once
      if (response.status === 401) {
        tokenCache = null;
        const newToken = await this.getAccessToken();
        
        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });
        
        if (!retryResponse.ok) {
          const retryError = await retryResponse.text();
          throw new Error(`Erro na API Ticto: ${retryResponse.status} - ${retryError}`);
        }
        
        return retryResponse.json();
      }
      
      throw new Error(`Erro na API Ticto: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Build query string from params
   */
  private buildQueryString(params: Record<string, unknown>): string {
    const searchParams = new URLSearchParams();
    
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    }
    
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ORDERS ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get orders summary (commission totalizer)
   * Note: Converts monetary values from cents to BRL
   */
  async getOrdersSummary(): Promise<TictoOrdersSummary> {
    const raw = await this.request<TictoOrdersSummary>('/api/v1/orders/summary');
    
    // Convert all known monetary fields
    const monetaryFields = ['total_revenue', 'total_commission', 'revenue', 'commission'];
    
    // Also convert any field that ends with '_revenue', '_amount', '_value', or '_commission'
    for (const key of Object.keys(raw)) {
      if (
        (key.endsWith('_revenue') || key.endsWith('_amount') || key.endsWith('_value') || key.endsWith('_commission')) &&
        typeof raw[key] === 'number'
      ) {
        if (!monetaryFields.includes(key)) {
          monetaryFields.push(key);
        }
      }
    }
    
    return convertMonetaryFields(raw, monetaryFields);
  }

  /**
   * Get orders history with filters
   * Note: Converts monetary values from cents to BRL
   */
  async getOrdersHistory(params: TictoSearchParams = {}): Promise<TictoPaginatedResponse<TictoOrder>> {
    const query = this.buildQueryString({
      page: params.page || 1,
      limit: params.limit || 20,
      email: params.email,
      status: params.status,
      order_id: params.order_id,
      product_id: params.product_id,
      product_name: params.product_name,
      document: params.document,
      date_from: params.date_from,
      date_to: params.date_to,
    });

    const raw = await this.request<TictoPaginatedResponse<TictoOrder>>(`/api/v1/orders/history${query}`);
    
    // Convert monetary values in each order
    raw.data = raw.data.map(order => ({
      ...order,
      product: order.product ? {
        ...order.product,
        price: centsToBRL(order.product.price)
      } : order.product,
      payment: order.payment ? {
        ...order.payment,
        amount: centsToBRL(order.payment.amount)
      } : order.payment,
      commission: order.commission ? {
        ...order.commission,
        amount: centsToBRL(order.commission.amount)
      } : order.commission,
    }));
    
    return raw;
  }

  /**
   * Search orders with various filters
   */
  async searchOrders(params: TictoSearchParams): Promise<TictoPaginatedResponse<TictoOrder>> {
    return this.getOrdersHistory(params);
  }

  /**
   * Get single order by ID
   */
  async getOrderById(orderId: string): Promise<TictoOrder | null> {
    const result = await this.getOrdersHistory({ order_id: orderId, limit: 1 });
    return result.data[0] || null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTIONS ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get subscriptions summary
   * Note: Converts monetary values from cents to BRL
   */
  async getSubscriptionsSummary(): Promise<TictoSubscriptionsSummary> {
    const raw = await this.request<TictoSubscriptionsSummary>('/api/v1/subscriptions/summary');
    
    // Convert all known monetary fields
    const monetaryFields = [
      'mrr', 
      'active_revenue', 
      'canceled_revenue', 
      'past_due_revenue',
      'total_revenue',
      'revenue'
    ];
    
    // Also convert any field that ends with '_revenue' or '_amount' or '_value'
    for (const key of Object.keys(raw)) {
      if (
        (key.endsWith('_revenue') || key.endsWith('_amount') || key.endsWith('_value')) &&
        typeof raw[key] === 'number'
      ) {
        if (!monetaryFields.includes(key)) {
          monetaryFields.push(key);
        }
      }
    }
    
    return convertMonetaryFields(raw, monetaryFields);
  }

  /**
   * Get subscriptions history with filters
   * Note: Converts monetary values from cents to BRL
   */
  async getSubscriptionsHistory(params: TictoSearchParams = {}): Promise<TictoPaginatedResponse<TictoSubscription>> {
    const query = this.buildQueryString({
      page: params.page || 1,
      limit: params.limit || 20,
      email: params.email,
      status: params.status,
      product_id: params.product_id,
      product_name: params.product_name,
      document: params.document,
      date_from: params.date_from,
      date_to: params.date_to,
    });

    const raw = await this.request<TictoPaginatedResponse<TictoSubscription>>(`/api/v1/subscriptions/history${query}`);
    
    // Convert monetary values in each subscription
    raw.data = raw.data.map(subscription => ({
      ...subscription,
      plan: subscription.plan ? {
        ...subscription.plan,
        price: centsToBRL(subscription.plan.price)
      } : subscription.plan,
    }));
    
    return raw;
  }

  /**
   * Search subscriptions with various filters
   */
  async searchSubscriptions(params: TictoSearchParams): Promise<TictoPaginatedResponse<TictoSubscription>> {
    return this.getSubscriptionsHistory(params);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMER SEARCH (unified across orders and subscriptions)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Search customer by email, document, or name
   * Returns combined data from orders and subscriptions from ALL TIME
   * Note: Does NOT use date filters when searching by email/document to avoid OR logic issues
   */
  async searchCustomer(params: {
    email?: string;
    document?: string;
    name?: string;
  }): Promise<{
    orders: TictoOrder[];
    subscriptions: TictoSubscription[];
    total_orders: number;
    total_subscriptions: number;
  }> {
    // Don't use date filters when searching by email/document
    // The Ticto API seems to use OR logic when date filters are combined with other filters
    const searchParams: TictoSearchParams = {
      email: params.email,
      document: params.document,
      limit: 100, // Get more results for customer overview
      // No date filters - let the API return all records for this customer
    };

    const [ordersResult, subscriptionsResult] = await Promise.all([
      this.getOrdersHistory(searchParams),
      this.getSubscriptionsHistory(searchParams),
    ]);

    return {
      orders: ordersResult.data,
      subscriptions: subscriptionsResult.data,
      total_orders: ordersResult.meta.total,
      total_subscriptions: subscriptionsResult.meta.total,
    };
  }

  /**
   * Test connection to Ticto API
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.getAccessToken();
      return { success: true, message: 'Conexão com Ticto estabelecida com sucesso.' };
    } catch (error) {
      return { 
        success: false, 
        message: `Falha na conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }
}

// Export singleton instance
export const tictoClient = new TictoClient();

// Export class for testing
export { TictoClient };

