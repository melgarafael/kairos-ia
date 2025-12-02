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
  source?: "ia-console-v3" | "mcp-server" | "api";
  trace_id?: string;
};

// Tool categories based on tool name prefixes
const TOOL_CATEGORIES: Record<string, string> = {
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
  search_documentation: "docs"
};

/**
 * Get tool category from tool name
 */
export function getToolCategoryFromName(toolName: string): string {
  // Direct match
  if (TOOL_CATEGORIES[toolName]) {
    return TOOL_CATEGORIES[toolName];
  }
  
  // Prefix matching
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
    time_ms: payload.execution_time_ms
  });

  if (!supabaseConfig.serviceRoleKey) return;

  // Auto-detect category if not provided
  const category = payload.tool_category || getToolCategoryFromName(payload.tool_name);

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

  const rows = payloads.map(payload => ({
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
    created_at: new Date().toISOString()
  }));

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

