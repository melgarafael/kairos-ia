// Supabase Edge Function - MCP Vendas (Ticto + Hotmart)
// Exposes MCP-compatible JSON-RPC endpoint for n8n/agents.

// Deno globals
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

// Environment
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TICTO_CLIENT_ID = Deno.env.get("TICTO_CLIENT_ID") ?? "";
const TICTO_CLIENT_SECRET = Deno.env.get("TICTO_CLIENT_SECRET") ?? "";
const TICTO_API_BASE_URL = Deno.env.get("TICTO_API_BASE_URL") ?? "https://glados.ticto.cloud";
const HOTMART_CLIENT_ID = Deno.env.get("HOTMART_CLIENT_ID") ?? "";
const HOTMART_CLIENT_SECRET = Deno.env.get("HOTMART_CLIENT_SECRET") ?? "";
const HOTMART_BASIC_AUTH = Deno.env.get("HOTMART_BASIC_AUTH") ?? "";
const HOTMART_API_BASE_URL =
  Deno.env.get("HOTMART_API_BASE_URL") ?? "https://developers.hotmart.com";
const HOTMART_AUTH_URL = "https://api-sec-vlc.hotmart.com/security/oauth/token";

// CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

// ──────────────────────────────────────────────────────────────────────────────
// MCP Tool Definitions (mirrors app MCP tools)
// ──────────────────────────────────────────────────────────────────────────────
type ToolProperty = {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
};

type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, ToolProperty>;
    required?: string[];
  };
};

const TICTO_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "ticto_get_orders_summary",
    description:
      "Obtém o resumo geral de vendas (orders) da Ticto. Retorna totalizadores como total de pedidos, receita total e comissões.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ticto_search_orders",
    description:
      "Busca pedidos na Ticto com filtros avançados. Use all_time=true para histórico completo quando buscar por email/documento.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Email do comprador" },
        status: {
          type: "string",
          enum: ["paid", "pending", "canceled", "refunded", "expired", "waiting_payment"],
        },
        order_id: { type: "string", description: "ID do pedido" },
        product_id: { type: "string" },
        product_name: { type: "string" },
        document: { type: "string", description: "CPF/CNPJ (somente números)" },
        all_time: { type: "boolean", description: "Busca todo histórico" },
        date_from: { type: "string", description: "YYYY-MM-DD" },
        date_to: { type: "string", description: "YYYY-MM-DD" },
        page: { type: "number", default: 1 },
        limit: { type: "number", default: 20 },
      },
    },
  },
  {
    name: "ticto_get_order_by_id",
    description: "Obtém detalhes completos de um pedido pelo ID.",
    inputSchema: {
      type: "object",
      properties: { order_id: { type: "string" } },
      required: ["order_id"],
    },
  },
  {
    name: "ticto_get_subscriptions_summary",
    description:
      "Obtém o resumo geral de assinaturas da Ticto (ativas, canceladas, MRR, etc.).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ticto_search_subscriptions",
    description:
      "Busca assinaturas na Ticto com filtros avançados. Use all_time=true para histórico completo.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string" },
        status: { type: "string", enum: ["active", "canceled", "past_due", "unpaid", "trialing"] },
        product_id: { type: "string" },
        product_name: { type: "string" },
        document: { type: "string" },
        all_time: { type: "boolean" },
        date_from: { type: "string" },
        date_to: { type: "string" },
        page: { type: "number", default: 1 },
        limit: { type: "number", default: 20 },
      },
    },
  },
  {
    name: "ticto_search_customer",
    description:
      "Busca um cliente específico e retorna todas as compras e assinaturas do histórico.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string" },
        document: { type: "string" },
      },
    },
  },
];

const HOTMART_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "hotmart_get_sales_summary",
    description:
      "Obtém resumo geral de vendas na Hotmart. Datas no formato YYYY-MM-DD.",
    inputSchema: {
      type: "object",
      properties: {
        start_date: { type: "string" },
        end_date: { type: "string" },
        transaction_status: {
          type: "string",
          enum: ["APPROVED", "COMPLETE", "CANCELLED", "REFUNDED", "CHARGEBACK", "WAITING_PAYMENT", "EXPIRED"],
        },
      },
    },
  },
  {
    name: "hotmart_search_sales",
    description:
      "Busca vendas na Hotmart com filtros avançados. Use all_time=true para histórico completo em buscas por cliente.",
    inputSchema: {
      type: "object",
      properties: {
        buyer_email: { type: "string" },
        buyer_name: { type: "string" },
        transaction_status: {
          type: "string",
          enum: [
            "APPROVED",
            "BLOCKED",
            "CANCELLED",
            "CHARGEBACK",
            "COMPLETE",
            "EXPIRED",
            "NO_FUNDS",
            "OVERDUE",
            "PARTIALLY_REFUNDED",
            "PRE_ORDER",
            "PRINTED_BILLET",
            "PROCESSING_TRANSACTION",
            "PROTESTED",
            "REFUNDED",
            "STARTED",
            "UNDER_ANALYSIS",
            "WAITING_PAYMENT",
          ],
        },
        transaction: { type: "string" },
        product_id: { type: "number" },
        payment_type: {
          type: "string",
          enum: ["BILLET", "CREDIT_CARD", "PIX", "PAYPAL", "GOOGLE_PAY", "DIRECT_BANK_TRANSFER"],
        },
        offer_code: { type: "string" },
        commission_as: { type: "string", enum: ["PRODUCER", "COPRODUCER", "AFFILIATE"] },
        all_time: { type: "boolean" },
        start_date: { type: "string" },
        end_date: { type: "string" },
        max_results: { type: "number", default: 50 },
        page_token: { type: "string" },
      },
    },
  },
  {
    name: "hotmart_get_sale_by_transaction",
    description: "Obtém detalhes completos de uma venda pelo código da transação.",
    inputSchema: {
      type: "object",
      properties: { transaction: { type: "string" } },
      required: ["transaction"],
    },
  },
  {
    name: "hotmart_get_subscriptions_summary",
    description: "Obtém resumo geral de assinaturas na Hotmart.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "number" },
        status: {
          type: "string",
          enum: [
            "ACTIVE",
            "INACTIVE",
            "CANCELLED_BY_CUSTOMER",
            "CANCELLED_BY_SELLER",
            "CANCELLED_BY_ADMIN",
            "DELAYED",
            "STARTED",
            "OVERDUE",
          ],
        },
      },
    },
  },
  {
    name: "hotmart_search_subscriptions",
    description: "Busca assinaturas na Hotmart com filtros por status/produto.",
    inputSchema: {
      type: "object",
      properties: {
        subscriber_code: { type: "string" },
        status: {
          type: "string",
          enum: [
            "ACTIVE",
            "INACTIVE",
            "CANCELLED_BY_CUSTOMER",
            "CANCELLED_BY_SELLER",
            "CANCELLED_BY_ADMIN",
            "DELAYED",
            "STARTED",
            "OVERDUE",
          ],
        },
        product_id: { type: "number" },
        plan_id: { type: "number" },
        max_results: { type: "number", default: 50 },
        page_token: { type: "string" },
      },
    },
  },
  {
    name: "hotmart_search_customer",
    description:
      "Busca um cliente na Hotmart e retorna suas vendas e assinaturas.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string" },
        name: { type: "string" },
      },
    },
  },
  {
    name: "hotmart_get_products",
    description: "Lista produtos cadastrados na Hotmart.",
    inputSchema: {
      type: "object",
      properties: {
        max_results: { type: "number", default: 50 },
        page_token: { type: "string" },
      },
    },
  },
  {
    name: "hotmart_get_commissions",
    description: "Obtém comissões de vendas na Hotmart.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "number" },
        transaction_status: { type: "string", enum: ["APPROVED", "COMPLETE", "CANCELLED", "REFUNDED"] },
        commission_as: { type: "string", enum: ["PRODUCER", "COPRODUCER", "AFFILIATE"] },
        start_date: { type: "string" },
        end_date: { type: "string" },
        max_results: { type: "number", default: 50 },
      },
    },
  },
  {
    name: "hotmart_get_refunds",
    description: "Busca vendas reembolsadas na Hotmart.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "number" },
        buyer_email: { type: "string" },
        start_date: { type: "string" },
        end_date: { type: "string" },
        max_results: { type: "number", default: 50 },
      },
    },
  },
];

const TOOLS = [...TICTO_MCP_TOOLS, ...HOTMART_MCP_TOOLS];

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: string | number | null; result: unknown }
  | { jsonrpc: "2.0"; id: string | number | null; error: { code: number; message: string } };

function jsonRpcError(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function cleanParams(params: Record<string, unknown>): Record<string, string> {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  return Object.fromEntries(entries.map(([k, v]) => [k, String(v)]));
}

function dateToHotmartTimestamp(dateStr?: string): number | undefined {
  if (!dateStr) return undefined;
  return new Date(dateStr).getTime();
}

// Optional audit to admin_mcp_audit table
async function auditToolCall(payload: {
  tool_name: string;
  tool_category?: string;
  arguments?: unknown;
  result?: unknown;
  error?: string | null;
  platform?: "ticto" | "hotmart";
}) {
  if (!supabaseUrl || !supabaseServiceRoleKey) return;
  try {
    await fetch(`${supabaseUrl}/rest/v1/admin_mcp_audit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: null,
        session_id: null,
        tool_name: payload.tool_name,
        tool_category: payload.tool_category || null,
        arguments: payload.arguments ?? {},
        result: payload.result ?? {},
        error: payload.error || null,
        execution_time_ms: null,
        success: payload.error ? false : true,
        source: "mcp-vendas-edge",
        trace_id: null,
        platform: payload.platform || null,
        created_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.warn("[mcp-vendas] audit failed", err);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Ticto Client (Deno version)
// ──────────────────────────────────────────────────────────────────────────────
type CachedToken = { accessToken: string; expiresAt: number };
const TOKEN_BUFFER_MS = 5 * 60 * 1000;

class TictoClient {
  private baseUrl = TICTO_API_BASE_URL;
  private clientId = TICTO_CLIENT_ID;
  private clientSecret = TICTO_CLIENT_SECRET;
  private token: CachedToken | null = null;

  isConfigured() {
    return Boolean(this.clientId && this.clientSecret);
  }

  private async getAccessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + TOKEN_BUFFER_MS) {
      return this.token.accessToken;
    }
    const res = await fetch(`${this.baseUrl}/api/security/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });
    if (!res.ok) {
      throw new Error(`Falha na autenticação Ticto: ${res.status} - ${await res.text()}`);
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    if (res.status === 401) {
      this.token = null;
      return this.request(endpoint, options);
    }
    if (!res.ok) {
      throw new Error(`Erro na API Ticto (${res.status}): ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  private buildQuery(params: Record<string, unknown>) {
    const qp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") qp.append(k, String(v));
    }
    const qs = qp.toString();
    return qs ? `?${qs}` : "";
  }

  private centsToBRL(cents: number) {
    return cents / 100;
  }

  async getOrdersSummary() {
    const data = await this.request<Record<string, unknown>>("/api/v1/orders/summary");
    for (const key of Object.keys(data)) {
      if (
        typeof data[key] === "number" &&
        (key.endsWith("_revenue") || key.endsWith("_amount") || key.endsWith("_value") || key.endsWith("_commission"))
      ) {
        data[key] = this.centsToBRL(data[key] as number);
      }
    }
    return data;
  }

  async searchOrders(params: Record<string, unknown>) {
    const query = this.buildQuery({
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
    const res = await this.request<{
      data: any[];
      meta: { total: number };
    }>(`/api/v1/orders/history${query}`);
    res.data = res.data.map((order) => ({
      ...order,
      product: order.product
        ? { ...order.product, price: this.centsToBRL(order.product.price) }
        : order.product,
      payment: order.payment ? { ...order.payment, amount: this.centsToBRL(order.payment.amount) } : order.payment,
      commission: order.commission
        ? { ...order.commission, amount: this.centsToBRL(order.commission.amount) }
        : order.commission,
    }));
    return res;
  }

  async getOrderById(orderId: string) {
    const res = await this.searchOrders({ order_id: orderId, limit: 1 });
    return res.data?.[0] ?? null;
  }

  async getSubscriptionsSummary() {
    const data = await this.request<Record<string, unknown>>("/api/v1/subscriptions/summary");
    for (const key of Object.keys(data)) {
      if (
        typeof data[key] === "number" &&
        (key.endsWith("_revenue") || key.endsWith("_amount") || key.endsWith("_value"))
      ) {
        data[key] = this.centsToBRL(data[key] as number);
      }
    }
    return data;
  }

  async searchSubscriptions(params: Record<string, unknown>) {
    const query = this.buildQuery({
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
    const res = await this.request<{
      data: any[];
      meta: { total: number };
    }>(`/api/v1/subscriptions/history${query}`);
    res.data = res.data.map((sub) => ({
      ...sub,
      plan: sub.plan ? { ...sub.plan, price: this.centsToBRL(sub.plan.price) } : sub.plan,
    }));
    return res;
  }

  async searchCustomer(params: { email?: string; document?: string }) {
    const searchParams = { email: params.email, document: params.document, limit: 100 };
    const [orders, subscriptions] = await Promise.all([
      this.searchOrders(searchParams),
      this.searchSubscriptions(searchParams),
    ]);
    return {
      orders: orders.data,
      subscriptions: subscriptions.data,
      total_orders: orders.meta?.total ?? orders.data?.length ?? 0,
      total_subscriptions: subscriptions.meta?.total ?? subscriptions.data?.length ?? 0,
    };
  }
}

const tictoClient = new TictoClient();

// ──────────────────────────────────────────────────────────────────────────────
// Hotmart Client (Deno version)
// ──────────────────────────────────────────────────────────────────────────────
class HotmartClient {
  private baseUrl = HOTMART_API_BASE_URL;
  private clientId = HOTMART_CLIENT_ID;
  private clientSecret = HOTMART_CLIENT_SECRET;
  private basicAuth = HOTMART_BASIC_AUTH;
  private token: CachedToken | null = null;

  isConfigured() {
    return Boolean((this.clientId && this.clientSecret) || this.basicAuth);
  }

  private async getAccessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + TOKEN_BUFFER_MS) {
      return this.token.accessToken;
    }
    if (!this.isConfigured()) {
      throw new Error("Hotmart API não configurada. Defina HOTMART_CLIENT_ID/SECRET ou HOTMART_BASIC_AUTH.");
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const basic = this.basicAuth || btoa(`${this.clientId}:${this.clientSecret}`);
    headers.Authorization = `Basic ${basic}`;
    const res = await fetch(`${HOTMART_AUTH_URL}?grant_type=client_credentials`, {
      method: "POST",
      headers,
    });
    if (!res.ok) {
      throw new Error(`Falha na autenticação Hotmart: ${res.status} - ${await res.text()}`);
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    if (res.status === 401) {
      this.token = null;
      return this.request(endpoint, options);
    }
    if (!res.ok) {
      throw new Error(`Erro na API Hotmart (${res.status}): ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  private buildQuery(params: Record<string, unknown>) {
    const qp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") qp.append(k, String(v));
    }
    const qs = qp.toString();
    return qs ? `?${qs}` : "";
  }

  async getSalesSummary(params: Record<string, unknown>) {
    const query = this.buildQuery({
      product_id: params.product_id,
      start_date: params.start_date,
      end_date: params.end_date,
      transaction_status: params.transaction_status,
      buyer_email: params.buyer_email,
    });
    return this.request(`/payments/api/v1/sales/summary${query}`);
  }

  async searchSales(params: Record<string, unknown>) {
    const query = this.buildQuery({
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
    });
    return this.request(`/payments/api/v1/sales/history${query}`);
  }

  async getSaleByTransaction(transaction: string) {
    const res = await this.searchSales({ transaction, max_results: 1 });
    return res.items?.[0] ?? null;
  }

  async getSubscriptionsSummary(params: Record<string, unknown>) {
    const query = this.buildQuery({ product_id: params.product_id, status: params.status });
    return this.request(`/payments/api/v1/subscriptions/summary${query}`);
  }

  async getSubscriptions(params: Record<string, unknown>) {
    const query = this.buildQuery({
      max_results: params.max_results || 50,
      page_token: params.page_token,
      product_id: params.product_id,
      subscriber_code: params.subscriber_code,
      status: params.status,
      plan_id: params.plan_id,
      accession_date: params.accession_date,
      end_accession_date: params.end_accession_date,
    });
    return this.request(`/payments/api/v1/subscriptions${query}`);
  }

  async searchCustomer(params: { email?: string; name?: string }) {
    if (!params.email && !params.name) {
      throw new Error("Informe email ou nome para buscar o cliente");
    }
    const sales = await this.searchSales({
      buyer_email: params.email,
      buyer_name: params.name,
      max_results: 100,
    });
    const subscriptionCodes = new Set<string>();
    const subscriptions: any[] = [];
    for (const sale of sales.items || []) {
      const code = sale.subscription?.subscriber_code;
      if (code && !subscriptionCodes.has(code)) {
        subscriptionCodes.add(code);
        const sub = await this.getSubscriptions({ subscriber_code: code, max_results: 1 });
        if (sub.items?.[0]) subscriptions.push(sub.items[0]);
      }
    }
    return {
      sales: sales.items || [],
      subscriptions,
      total_sales: sales.page_info?.total_results ?? sales.items?.length ?? 0,
      total_subscriptions: subscriptions.length,
    };
  }

  async getProducts(params: Record<string, unknown>) {
    const query = this.buildQuery({
      max_results: params.max_results || 50,
      page_token: params.page_token,
    });
    return this.request(`/payments/api/v1/products${query}`);
  }

  async getCommissions(params: Record<string, unknown>) {
    const query = this.buildQuery({
      max_results: params.max_results || 50,
      page_token: params.page_token,
      product_id: params.product_id,
      start_date: params.start_date,
      end_date: params.end_date,
      transaction_status: params.transaction_status,
      commission_as: params.commission_as,
    });
    return this.request(`/payments/api/v1/sales/commissions${query}`);
  }

  async getRefunds(params: Record<string, unknown>) {
    const query = this.buildQuery({
      max_results: params.max_results || 50,
      product_id: params.product_id,
      buyer_email: params.buyer_email,
      start_date: params.start_date,
      end_date: params.end_date,
      transaction_status: "REFUNDED",
    });
    return this.request(`/payments/api/v1/sales/history${query}`);
  }
}

const hotmartClient = new HotmartClient();

// ──────────────────────────────────────────────────────────────────────────────
// Tool execution
// ──────────────────────────────────────────────────────────────────────────────
async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const start = Date.now();
  let result: unknown;
  let error: string | null = null;
  let platform: "ticto" | "hotmart" | undefined;

  try {
    // Ticto
    if (name.startsWith("ticto_")) {
      platform = "ticto";
      if (!tictoClient.isConfigured()) {
        throw new Error("API Ticto não configurada. Defina TICTO_CLIENT_ID e TICTO_CLIENT_SECRET.");
      }
      if (name === "ticto_get_orders_summary") {
        result = await tictoClient.getOrdersSummary();
      } else if (name === "ticto_search_orders") {
        const hasCustomer = args.email || args.document;
        const useAllTime = args.all_time === true;
        const date_from = useAllTime && hasCustomer ? undefined : args.date_from;
        const date_to = useAllTime && hasCustomer ? undefined : args.date_to;
        result = await tictoClient.searchOrders({
          ...args,
          date_from,
          date_to,
          limit: args.limit ? Math.min(Number(args.limit), 100) : hasCustomer ? 100 : 20,
        });
      } else if (name === "ticto_get_order_by_id") {
        result = await tictoClient.getOrderById(String(args.order_id || ""));
      } else if (name === "ticto_get_subscriptions_summary") {
        result = await tictoClient.getSubscriptionsSummary();
      } else if (name === "ticto_search_subscriptions") {
        const hasCustomer = args.email || args.document;
        const useAllTime = args.all_time === true;
        const date_from = useAllTime && hasCustomer ? undefined : args.date_from;
        const date_to = useAllTime && hasCustomer ? undefined : args.date_to;
        result = await tictoClient.searchSubscriptions({
          ...args,
          date_from,
          date_to,
          limit: args.limit ? Math.min(Number(args.limit), 100) : hasCustomer ? 100 : 20,
        });
      } else if (name === "ticto_search_customer") {
        result = await tictoClient.searchCustomer({
          email: args.email as string | undefined,
          document: args.document as string | undefined,
        });
      } else {
        throw new Error(`Tool Ticto desconhecida: ${name}`);
      }
    }

    // Hotmart
    else if (name.startsWith("hotmart_")) {
      platform = "hotmart";
      if (!hotmartClient.isConfigured()) {
        throw new Error("API Hotmart não configurada. Defina HOTMART_CLIENT_ID/SECRET ou HOTMART_BASIC_AUTH.");
      }

      const hasCustomer = args.buyer_email || args.buyer_name;
      const useAllTime = args.all_time === true;
      const start_date = useAllTime && hasCustomer ? undefined : dateToHotmartTimestamp(args.start_date as string);
      const end_date = useAllTime && hasCustomer ? undefined : dateToHotmartTimestamp(args.end_date as string);

      if (name === "hotmart_get_sales_summary") {
        result = await hotmartClient.getSalesSummary({
          ...args,
          start_date,
          end_date,
          transaction_status: args.transaction_status,
        });
      } else if (name === "hotmart_search_sales") {
        result = await hotmartClient.searchSales({
          ...args,
          start_date,
          end_date,
          max_results: args.max_results ? Math.min(Number(args.max_results), 100) : hasCustomer ? 100 : 50,
        });
      } else if (name === "hotmart_get_sale_by_transaction") {
        result = await hotmartClient.getSaleByTransaction(String(args.transaction || ""));
      } else if (name === "hotmart_get_subscriptions_summary") {
        result = await hotmartClient.getSubscriptionsSummary({
          product_id: args.product_id,
          status: args.status,
        });
      } else if (name === "hotmart_search_subscriptions") {
        result = await hotmartClient.getSubscriptions({
          subscriber_code: args.subscriber_code,
          status: args.status,
          product_id: args.product_id,
          plan_id: args.plan_id,
          max_results: args.max_results ? Math.min(Number(args.max_results), 100) : 50,
          page_token: args.page_token,
        });
      } else if (name === "hotmart_search_customer") {
        result = await hotmartClient.searchCustomer({
          email: args.email as string | undefined,
          name: args.name as string | undefined,
        });
      } else if (name === "hotmart_get_products") {
        result = await hotmartClient.getProducts({
          max_results: args.max_results ? Math.min(Number(args.max_results), 100) : 50,
          page_token: args.page_token,
        });
      } else if (name === "hotmart_get_commissions") {
        const commissionStart = dateToHotmartTimestamp(args.start_date as string);
        const commissionEnd = dateToHotmartTimestamp(args.end_date as string);
        result = await hotmartClient.getCommissions({
          product_id: args.product_id,
          transaction_status: args.transaction_status,
          commission_as: args.commission_as,
          start_date: commissionStart,
          end_date: commissionEnd,
          max_results: args.max_results ? Math.min(Number(args.max_results), 100) : 50,
        });
      } else if (name === "hotmart_get_refunds") {
        const refundStart = dateToHotmartTimestamp(args.start_date as string);
        const refundEnd = dateToHotmartTimestamp(args.end_date as string);
        result = await hotmartClient.getRefunds({
          product_id: args.product_id,
          buyer_email: args.buyer_email,
          start_date: refundStart,
          end_date: refundEnd,
          max_results: args.max_results ? Math.min(Number(args.max_results), 100) : 50,
        });
      } else {
        throw new Error(`Tool Hotmart desconhecida: ${name}`);
      }
    } else {
      throw new Error(`Tool desconhecida: ${name}`);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    result = { error: true, message: error };
  }

  await auditToolCall({
    tool_name: name,
    tool_category: name.includes("order") || name.includes("sales") ? "sales" : undefined,
    arguments: args,
    result,
    error,
    platform,
  });

  const elapsed = Date.now() - start;
  console.log(`[mcp-vendas] tool=${name} success=${!error} time_ms=${elapsed}`);

  return JSON.stringify(result ?? {}, null, 2);
}

// ──────────────────────────────────────────────────────────────────────────────
// HTTP Handlers (JSON-RPC + SSE handshake)
// ──────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { method, id, params } = body;

      // initialize
      if (method === "initialize") {
        const resp: JsonRpcResponse = {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "tomik-vendas-mcp", version: "1.0.0" },
          },
        };
        return new Response(JSON.stringify(resp), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // tools/list
      if (method === "tools/list") {
        const resp: JsonRpcResponse = {
          jsonrpc: "2.0",
          id,
          result: { tools: TOOLS },
        };
        return new Response(JSON.stringify(resp), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // tools/call (NDJSON streaming)
      if (method === "tools/call") {
        const name = params?.name as string | undefined;
        const args = (params?.arguments as Record<string, unknown>) || {};
        if (!name) {
          const resp = jsonRpcError(id, -32602, "Tool name is required");
          return new Response(JSON.stringify(resp), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({ event: "init", id, tool: name }) + "\n",
                ),
              );

              const resultText = await executeTool(name, args);

              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    event: "result",
                    id,
                    content: [{ type: "text", text: resultText }],
                  }) + "\n",
                ),
              );
            } catch (err) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    event: "error",
                    id,
                    message: err instanceof Error ? err.message : String(err),
                  }) + "\n",
                ),
              );
            } finally {
              controller.close();
            }
          },
          cancel() {
            console.log("[mcp-vendas] stream cancelled");
          },
        });

        return new Response(stream, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/x-ndjson",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      const resp = jsonRpcError(id, -32601, `Method not found: ${method}`);
      return new Response(JSON.stringify(resp), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[mcp-vendas] request error", err);
      const resp = jsonRpcError(null, -32603, err instanceof Error ? err.message : String(err));
      return new Response(JSON.stringify(resp), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Tomik Vendas MCP Active", {
    headers: { ...corsHeaders, "Content-Type": "text/plain" },
  });
});

