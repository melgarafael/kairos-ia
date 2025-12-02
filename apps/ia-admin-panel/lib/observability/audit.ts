import { supabaseConfig } from "@/lib/supabase/config";

// ============================================================================
// Types
// ============================================================================

type AuditPayload = {
  user_id: string;
  event: string;
  metadata?: Record<string, any>;
};

export type McpToolAuditPayload = {
  user_id: string;
  session_id?: string;
  tool_name: string;
  tool_category?: string;
  arguments?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  execution_time_ms?: number;
  success?: boolean;
  source?: "ia-console-v3" | "ia-console-vendas" | "mcp-server" | "api";
  trace_id?: string;
  platform?: "ticto" | "hotmart"; // For vendas tools
};

// Tool categories based on tool name prefixes
const TOOL_CATEGORIES: Record<string, string> = {
  // Admin tools
  admin_list_users: "users",
  admin_get_user: "users",
  admin_update_user: "users",
  admin_create_user: "users",
  admin_generate_magic_link: "users",
  admin_send_bulk_emails: "users",
  admin_list_tokens: "tokens",
  admin_issue_tokens: "tokens",
  admin_bulk_issue_tokens: "tokens",
  admin_user_tokens: "tokens",
  admin_refund_tokens: "tokens",
  admin_update_user_trails: "tokens",
  admin_list_organizations: "organizations",
  admin_delete_organization: "organizations",
  admin_bulk_delete_organizations: "organizations",
  admin_create_org_with_connection: "organizations",
  admin_get_connection_stats: "analytics",
  admin_get_survey_metrics: "analytics",
  admin_get_trail_feedback_analytics: "analytics",
  admin_get_feature_catalog: "analytics",
  admin_get_system_kpis: "analytics",
  search_documentation: "docs",
  
  // Ticto tools (vendas)
  ticto_get_orders_summary: "orders",
  ticto_search_orders: "orders",
  ticto_get_order_by_id: "orders",
  ticto_get_subscriptions_summary: "subscriptions",
  ticto_search_subscriptions: "subscriptions",
  ticto_search_customer: "customers",
  
  // Hotmart tools (vendas)
  hotmart_get_sales_summary: "sales",
  hotmart_search_sales: "sales",
  hotmart_get_sale_by_transaction: "sales",
  hotmart_get_subscriptions_summary: "subscriptions",
  hotmart_search_subscriptions: "subscriptions",
  hotmart_search_customer: "customers",
  hotmart_get_products: "products",
  hotmart_get_commissions: "commissions",
  hotmart_get_refunds: "refunds"
};

/**
 * Get tool category from tool name
 */
export function getToolCategoryFromName(toolName: string): string {
  // Direct match
  if (TOOL_CATEGORIES[toolName]) {
    return TOOL_CATEGORIES[toolName];
  }
  
  // Prefix matching for admin tools
  if (toolName.startsWith("admin_list_") || toolName.startsWith("admin_get_user")) {
    return "users";
  }
  if (toolName.includes("token")) {
    return "tokens";
  }
  if (toolName.includes("org")) {
    return "organizations";
  }
  if (toolName.includes("connection") || toolName.includes("supabase")) {
    return "connections";
  }
  
  // Prefix matching for Ticto tools
  if (toolName.startsWith("ticto_")) {
    if (toolName.includes("order")) return "orders";
    if (toolName.includes("subscription")) return "subscriptions";
    if (toolName.includes("customer")) return "customers";
    return "ticto";
  }
  
  // Prefix matching for Hotmart tools
  if (toolName.startsWith("hotmart_")) {
    if (toolName.includes("sale")) return "sales";
    if (toolName.includes("subscription")) return "subscriptions";
    if (toolName.includes("customer")) return "customers";
    if (toolName.includes("product")) return "products";
    if (toolName.includes("commission")) return "commissions";
    if (toolName.includes("refund")) return "refunds";
    return "hotmart";
  }
  
  return "other";
}

// ============================================================================
// Audit Functions
// ============================================================================

/**
 * Audit agent event (general AI events)
 */
export async function auditAgentEvent(payload: AuditPayload) {
  console.info("[audit] agent-event", payload);

  if (!supabaseConfig.serviceRoleKey) return;

  try {
    const res = await fetch(`${supabaseConfig.url}/rest/v1/admin_ai_audit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseConfig.serviceRoleKey,
        Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        ...payload,
        metadata: payload.metadata ?? {},
        created_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      console.warn("[audit] failed to persist", await res.text());
    }
  } catch (error) {
    console.error("[audit] error", error);
  }
}

/**
 * Audit MCP tool call (granular tool execution logging)
 */
export async function auditMcpToolCall(payload: McpToolAuditPayload) {
  console.info("[audit] mcp-tool-call", {
    tool: payload.tool_name,
    success: payload.success,
    time_ms: payload.execution_time_ms,
    platform: payload.platform
  });

  if (!supabaseConfig.serviceRoleKey) return;

  // Auto-detect category if not provided
  const category = payload.tool_category || getToolCategoryFromName(payload.tool_name);
  
  // Auto-detect platform from tool name if not provided
  let platform = payload.platform;
  if (!platform && payload.tool_name.startsWith("ticto_")) platform = "ticto";
  if (!platform && payload.tool_name.startsWith("hotmart_")) platform = "hotmart";

  try {
    const res = await fetch(`${supabaseConfig.url}/rest/v1/admin_mcp_audit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseConfig.serviceRoleKey,
        Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        user_id: payload.user_id,
        session_id: payload.session_id || null,
        tool_name: payload.tool_name,
        tool_category: category,
        arguments: payload.arguments ?? {},
        result: payload.result ?? {},
        error: payload.error || null,
        execution_time_ms: payload.execution_time_ms || null,
        success: payload.success ?? true,
        source: payload.source || "ia-console-v3",
        trace_id: payload.trace_id || null,
        platform: platform || null,
        created_at: new Date().toISOString()
      })
    });
    
    if (!res.ok) {
      console.warn("[audit] failed to persist mcp audit", await res.text());
    }
  } catch (error) {
    console.error("[audit] mcp audit error", error);
  }
}

/**
 * Batch audit multiple MCP tool calls (more efficient for agentic loops)
 */
export async function auditMcpToolCallsBatch(payloads: McpToolAuditPayload[]) {
  if (!supabaseConfig.serviceRoleKey || payloads.length === 0) return;

  console.info("[audit] mcp-tool-calls-batch", { count: payloads.length });

  const rows = payloads.map(payload => {
    // Auto-detect platform from tool name if not provided
    let platform = payload.platform;
    if (!platform && payload.tool_name.startsWith("ticto_")) platform = "ticto";
    if (!platform && payload.tool_name.startsWith("hotmart_")) platform = "hotmart";
    
    return {
      user_id: payload.user_id,
      session_id: payload.session_id || null,
      tool_name: payload.tool_name,
      tool_category: payload.tool_category || getToolCategoryFromName(payload.tool_name),
      arguments: payload.arguments ?? {},
      result: payload.result ?? {},
      error: payload.error || null,
      execution_time_ms: payload.execution_time_ms || null,
      success: payload.success ?? true,
      source: payload.source || "ia-console-v3",
      trace_id: payload.trace_id || null,
      platform: platform || null,
      created_at: new Date().toISOString()
    };
  });

  try {
    const res = await fetch(`${supabaseConfig.url}/rest/v1/admin_mcp_audit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseConfig.serviceRoleKey,
        Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
        Prefer: "return=minimal"
      },
      body: JSON.stringify(rows)
    });
    
    if (!res.ok) {
      console.warn("[audit] failed to persist mcp audit batch", await res.text());
    }
  } catch (error) {
    console.error("[audit] mcp audit batch error", error);
  }
}

