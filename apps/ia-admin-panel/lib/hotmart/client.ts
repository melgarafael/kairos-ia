/**
 * Hotmart API Client
 * 
 * Cliente para integração com a API da Hotmart (plataforma de vendas).
 * Implementa OAuth2 com cache de token e refresh automático.
 * 
 * Documentação: https://developers.hotmart.com/docs/pt-BR/
 * 
 * IMPORTANTE: Diferente da Ticto, os valores da Hotmart já vêm em BRL,
 * não necessitando divisão por 100.
 */

// Types
export interface HotmartAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface HotmartBuyer {
  name: string;
  email: string;
  ucode?: string;
  checkout_phone?: string;
  address?: {
    country?: string;
    country_iso?: string;
    state?: string;
    city?: string;
    zip_code?: string;
  };
}

export interface HotmartProduct {
  id: number;
  ucode?: string;
  name: string;
  has_co_production?: boolean;
}

export interface HotmartProducer {
  name: string;
  ucode?: string;
}

export interface HotmartPurchase {
  transaction: string;
  order_date: number; // timestamp in ms
  approved_date?: number;
  status: string;
  price: {
    value: number;
    currency_code: string;
  };
  payment: {
    type: string;
    installments_number?: number;
    refusal_reason?: string;
  };
  offer?: {
    code: string;
    payment_mode?: string;
  };
  commission?: {
    value: number;
    currency_code: string;
  };
  is_subscription?: boolean;
  recurrency_number?: number;
  tracking?: {
    source?: string;
    source_sck?: string;
    external_code?: string;
  };
}

export interface HotmartSale {
  product: HotmartProduct;
  buyer: HotmartBuyer;
  producer?: HotmartProducer;
  purchase: HotmartPurchase;
  subscription?: {
    subscriber_code?: string;
    status?: string;
    plan?: {
      id?: number;
      name?: string;
    };
  };
}

export interface HotmartSalesSummary {
  total_items: number;
  total_value: {
    value: number;
    currency_code: string;
  };
  items_by_status?: Record<string, number>;
}

export interface HotmartSubscription {
  subscriber_code: string;
  subscription_id?: number;
  status: string;
  accession_date?: number;
  end_accession_reason?: string;
  request_date?: number;
  date_next_charge?: number;
  plan?: {
    id: number;
    name: string;
    recurrency_period?: number;
  };
  product?: HotmartProduct;
  buyer?: HotmartBuyer;
  price?: {
    value: number;
    currency_code: string;
  };
  trial?: boolean;
}

export interface HotmartSubscriptionsSummary {
  total_subscriptions: number;
  active_subscriptions: number;
  cancelled_subscriptions: number;
  delayed_subscriptions?: number;
  total_mrr?: number;
}

export interface HotmartPaginatedResponse<T> {
  items: T[];
  page_info?: {
    total_results?: number;
    next_page_token?: string;
    prev_page_token?: string;
    results_per_page?: number;
  };
}

export interface HotmartProductDetail {
  id: number;
  name: string;
  ucode?: string;
  status?: string;
  created_at?: number;
  updated_at?: number;
  base_price?: number;
  currency?: string;
  has_co_production?: boolean;
}

export interface HotmartCommission {
  transaction: string;
  product: HotmartProduct;
  commission_as: string;
  commission: {
    value: number;
    currency_code: string;
  };
  source?: string;
  order_date: number;
  approved_date?: number;
}

export interface HotmartRefund {
  transaction: string;
  status: string;
  refund_reason?: string;
  refund_type?: string;
  value?: number;
  currency_code?: string;
  date?: number;
}

export interface HotmartSearchParams {
  max_results?: number;
  page_token?: string;
  product_id?: number;
  start_date?: number; // timestamp in ms
  end_date?: number; // timestamp in ms
  transaction_status?: string;
  buyer_email?: string;
  buyer_name?: string;
  sales_source?: string;
  transaction?: string;
  payment_type?: string;
  offer_code?: string;
  commission_as?: string;
}

export interface HotmartSubscriptionSearchParams {
  max_results?: number;
  page_token?: string;
  product_id?: number;
  subscriber_code?: string;
  subscriber_email?: string;
  status?: string;
  plan_id?: number;
  accession_date?: number;
  end_accession_date?: number;
}

// Token cache
interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: CachedToken | null = null;

// Configuration
const HOTMART_CLIENT_ID = process.env.HOTMART_CLIENT_ID || '';
const HOTMART_CLIENT_SECRET = process.env.HOTMART_CLIENT_SECRET || '';
const HOTMART_BASIC_AUTH = process.env.HOTMART_BASIC_AUTH || '';
const HOTMART_API_BASE_URL = process.env.HOTMART_API_BASE_URL || 'https://developers.hotmart.com';
const HOTMART_AUTH_URL = 'https://api-sec-vlc.hotmart.com/security/oauth/token';

// Token expiration buffer (5 minutes before actual expiry)
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/**
 * Transaction Status enum for Hotmart
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
 * Subscription Status enum for Hotmart
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
 * Payment Type enum for Hotmart
 */
export const HOTMART_PAYMENT_TYPE = {
  BILLET: 'BILLET',
  CASH_PAYMENT: 'CASH_PAYMENT',
  CREDIT_CARD: 'CREDIT_CARD',
  DIRECT_BANK_TRANSFER: 'DIRECT_BANK_TRANSFER',
  DIRECT_DEBIT: 'DIRECT_DEBIT',
  FINANCED_BILLET: 'FINANCED_BILLET',
  FINANCED_INSTALLMENT: 'FINANCED_INSTALLMENT',
  GOOGLE_PAY: 'GOOGLE_PAY',
  HOTCARD: 'HOTCARD',
  HYBRID: 'HYBRID',
  MANUAL_TRANSFER: 'MANUAL_TRANSFER',
  PAYPAL: 'PAYPAL',
  PAYPAL_INTERNACIONAL: 'PAYPAL_INTERNACIONAL',
  PIX: 'PIX',
  WALLET: 'WALLET',
} as const;

/**
 * HotmartClient - Singleton client for Hotmart API
 */
class HotmartClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private basicAuth: string;

  constructor() {
    this.baseUrl = HOTMART_API_BASE_URL;
    this.clientId = HOTMART_CLIENT_ID;
    this.clientSecret = HOTMART_CLIENT_SECRET;
    this.basicAuth = HOTMART_BASIC_AUTH;
  }

  /**
   * Check if credentials are configured
   */
  isConfigured(): boolean {
    // Need either client_id/secret OR basic auth
    return Boolean((this.clientId && this.clientSecret) || this.basicAuth);
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
   * Authenticate with Hotmart OAuth2
   */
  private async authenticate(): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Hotmart API não configurada. Defina HOTMART_CLIENT_ID/HOTMART_CLIENT_SECRET ou HOTMART_BASIC_AUTH.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Use Basic Auth if available, otherwise Client Credentials
    if (this.basicAuth) {
      headers['Authorization'] = `Basic ${this.basicAuth}`;
    } else {
      headers['Authorization'] = `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`;
    }

    const response = await fetch(`${HOTMART_AUTH_URL}?grant_type=client_credentials`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[HotmartClient] Auth error:', response.status, errorText);
      throw new Error(`Falha na autenticação Hotmart: ${response.status} - ${errorText}`);
    }

    const data: HotmartAuthResponse = await response.json();

    // Cache token
    tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };

    console.log('[HotmartClient] Token obtained, expires in:', data.expires_in, 'seconds');
    return data.access_token;
  }

  /**
   * Make authenticated request to Hotmart API
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
      console.error(`[HotmartClient] Request error (${endpoint}):`, response.status, errorText);
      
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
          throw new Error(`Erro na API Hotmart: ${retryResponse.status} - ${retryError}`);
        }
        
        return retryResponse.json();
      }
      
      throw new Error(`Erro na API Hotmart: ${response.status} - ${errorText}`);
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

  /**
   * Convert date string (YYYY-MM-DD) to timestamp in milliseconds
   */
  private dateToTimestamp(dateStr: string): number {
    return new Date(dateStr).getTime();
  }

  /**
   * Convert timestamp in milliseconds to date string (YYYY-MM-DD)
   */
  private timestampToDate(timestamp: number): string {
    return new Date(timestamp).toISOString().split('T')[0];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SALES ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get sales history with filters
   * Endpoint: GET /payments/api/v1/sales/history
   */
  async getSalesHistory(params: HotmartSearchParams = {}): Promise<HotmartPaginatedResponse<HotmartSale>> {
    const queryParams: Record<string, unknown> = {
      max_results: params.max_results || 50,
      page_token: params.page_token,
      product_id: params.product_id,
      start_date: params.start_date,
      end_date: params.end_date,
      transaction_status: params.transaction_status,
      buyer_email: params.buyer_email,
      buyer_name: params.buyer_name,
      sales_source: params.sales_source,
      transaction: params.transaction,
      payment_type: params.payment_type,
      offer_code: params.offer_code,
      commission_as: params.commission_as,
    };

    const query = this.buildQueryString(queryParams);
    return this.request<HotmartPaginatedResponse<HotmartSale>>(`/payments/api/v1/sales/history${query}`);
  }

  /**
   * Search sales with various filters
   */
  async searchSales(params: HotmartSearchParams): Promise<HotmartPaginatedResponse<HotmartSale>> {
    return this.getSalesHistory(params);
  }

  /**
   * Get single sale by transaction ID
   */
  async getSaleByTransaction(transaction: string): Promise<HotmartSale | null> {
    const result = await this.getSalesHistory({ transaction, max_results: 1 });
    return result.items?.[0] || null;
  }

  /**
   * Get sales summary
   * Endpoint: GET /payments/api/v1/sales/summary
   */
  async getSalesSummary(params: Partial<HotmartSearchParams> = {}): Promise<HotmartSalesSummary> {
    const queryParams: Record<string, unknown> = {
      product_id: params.product_id,
      start_date: params.start_date,
      end_date: params.end_date,
      transaction_status: params.transaction_status,
      buyer_email: params.buyer_email,
    };

    const query = this.buildQueryString(queryParams);
    return this.request<HotmartSalesSummary>(`/payments/api/v1/sales/summary${query}`);
  }

  /**
   * Get sales participants/users
   * Endpoint: GET /payments/api/v1/sales/users
   */
  async getSalesUsers(params: HotmartSearchParams = {}): Promise<HotmartPaginatedResponse<HotmartSale>> {
    const queryParams: Record<string, unknown> = {
      max_results: params.max_results || 50,
      page_token: params.page_token,
      transaction: params.transaction,
    };

    const query = this.buildQueryString(queryParams);
    return this.request<HotmartPaginatedResponse<HotmartSale>>(`/payments/api/v1/sales/users${query}`);
  }

  /**
   * Get sales commissions
   * Endpoint: GET /payments/api/v1/sales/commissions
   */
  async getSalesCommissions(params: HotmartSearchParams = {}): Promise<HotmartPaginatedResponse<HotmartCommission>> {
    const queryParams: Record<string, unknown> = {
      max_results: params.max_results || 50,
      page_token: params.page_token,
      product_id: params.product_id,
      start_date: params.start_date,
      end_date: params.end_date,
      transaction_status: params.transaction_status,
      commission_as: params.commission_as,
    };

    const query = this.buildQueryString(queryParams);
    return this.request<HotmartPaginatedResponse<HotmartCommission>>(`/payments/api/v1/sales/commissions${query}`);
  }

  /**
   * Get sales price details
   * Endpoint: GET /payments/api/v1/sales/price/details
   */
  async getSalesPriceDetails(transaction: string): Promise<unknown> {
    const query = this.buildQueryString({ transaction });
    return this.request<unknown>(`/payments/api/v1/sales/price/details${query}`);
  }

  /**
   * Request refund for a sale
   * Endpoint: POST /payments/api/v1/sales/refund
   */
  async requestRefund(transaction: string): Promise<HotmartRefund> {
    return this.request<HotmartRefund>('/payments/api/v1/sales/refund', {
      method: 'POST',
      body: JSON.stringify({ transaction }),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTION ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get subscriptions list
   * Endpoint: GET /payments/api/v1/subscriptions
   */
  async getSubscriptions(params: HotmartSubscriptionSearchParams = {}): Promise<HotmartPaginatedResponse<HotmartSubscription>> {
    const queryParams: Record<string, unknown> = {
      max_results: params.max_results || 50,
      page_token: params.page_token,
      product_id: params.product_id,
      subscriber_code: params.subscriber_code,
      status: params.status,
      plan_id: params.plan_id,
      accession_date: params.accession_date,
      end_accession_date: params.end_accession_date,
    };

    const query = this.buildQueryString(queryParams);
    return this.request<HotmartPaginatedResponse<HotmartSubscription>>(`/payments/api/v1/subscriptions${query}`);
  }

  /**
   * Search subscriptions by email
   */
  async searchSubscriptionsByEmail(email: string, status?: string): Promise<HotmartPaginatedResponse<HotmartSubscription>> {
    // Hotmart API doesn't support direct email filter for subscriptions
    // We need to get sales first, then filter subscriptions
    const sales = await this.getSalesHistory({ buyer_email: email, max_results: 100 });
    
    // Extract subscription info from sales
    const subscriptions: HotmartSubscription[] = [];
    for (const sale of sales.items || []) {
      if (sale.subscription?.subscriber_code) {
        const sub = await this.getSubscriptionByCode(sale.subscription.subscriber_code);
        if (sub && (!status || sub.status === status)) {
          subscriptions.push(sub);
        }
      }
    }

    return { items: subscriptions };
  }

  /**
   * Get subscription by subscriber code
   */
  async getSubscriptionByCode(subscriberCode: string): Promise<HotmartSubscription | null> {
    const result = await this.getSubscriptions({ subscriber_code: subscriberCode, max_results: 1 });
    return result.items?.[0] || null;
  }

  /**
   * Get subscriptions summary
   * Endpoint: GET /payments/api/v1/subscriptions/summary
   */
  async getSubscriptionsSummary(params: Partial<HotmartSubscriptionSearchParams> = {}): Promise<HotmartSubscriptionsSummary> {
    const queryParams: Record<string, unknown> = {
      product_id: params.product_id,
      status: params.status,
    };

    const query = this.buildQueryString(queryParams);
    return this.request<HotmartSubscriptionsSummary>(`/payments/api/v1/subscriptions/summary${query}`);
  }

  /**
   * Get subscription purchases
   * Endpoint: GET /payments/api/v1/subscriptions/{subscriber_code}/purchases
   */
  async getSubscriptionPurchases(subscriberCode: string): Promise<HotmartPaginatedResponse<HotmartPurchase>> {
    return this.request<HotmartPaginatedResponse<HotmartPurchase>>(
      `/payments/api/v1/subscriptions/${subscriberCode}/purchases`
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCT ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get products list
   * Endpoint: GET /payments/api/v1/products
   */
  async getProducts(params: { max_results?: number; page_token?: string } = {}): Promise<HotmartPaginatedResponse<HotmartProductDetail>> {
    const query = this.buildQueryString({
      max_results: params.max_results || 50,
      page_token: params.page_token,
    });
    return this.request<HotmartPaginatedResponse<HotmartProductDetail>>(`/payments/api/v1/products${query}`);
  }

  /**
   * Get product offers
   * Endpoint: GET /payments/api/v1/products/{product_id}/offers
   */
  async getProductOffers(productId: number): Promise<unknown> {
    return this.request<unknown>(`/payments/api/v1/products/${productId}/offers`);
  }

  /**
   * Get product plans (for subscriptions)
   * Endpoint: GET /payments/api/v1/products/{product_id}/plans
   */
  async getProductPlans(productId: number): Promise<unknown> {
    return this.request<unknown>(`/payments/api/v1/products/${productId}/plans`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMER SEARCH (unified across sales and subscriptions)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Search customer by email
   * Returns combined data from sales and subscriptions
   */
  async searchCustomer(params: {
    email?: string;
    name?: string;
  }): Promise<{
    sales: HotmartSale[];
    subscriptions: HotmartSubscription[];
    total_sales: number;
    total_subscriptions: number;
  }> {
    if (!params.email && !params.name) {
      throw new Error('Informe email ou nome para buscar o cliente');
    }

    const searchParams: HotmartSearchParams = {
      buyer_email: params.email,
      buyer_name: params.name,
      max_results: 100,
    };

    const salesResult = await this.getSalesHistory(searchParams);
    
    // Get unique subscriptions from sales
    const subscriptionCodes = new Set<string>();
    const subscriptions: HotmartSubscription[] = [];
    
    for (const sale of salesResult.items || []) {
      if (sale.subscription?.subscriber_code && !subscriptionCodes.has(sale.subscription.subscriber_code)) {
        subscriptionCodes.add(sale.subscription.subscriber_code);
        const sub = await this.getSubscriptionByCode(sale.subscription.subscriber_code);
        if (sub) {
          subscriptions.push(sub);
        }
      }
    }

    return {
      sales: salesResult.items || [],
      subscriptions,
      total_sales: salesResult.page_info?.total_results || salesResult.items?.length || 0,
      total_subscriptions: subscriptions.length,
    };
  }

  /**
   * Test connection to Hotmart API
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.getAccessToken();
      return { success: true, message: 'Conexão com Hotmart estabelecida com sucesso.' };
    } catch (error) {
      return { 
        success: false, 
        message: `Falha na conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }
}

// Export singleton instance
export const hotmartClient = new HotmartClient();

// Export class for testing
export { HotmartClient };

