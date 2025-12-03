/**
 * Status Dashboard API
 * 
 * Aggregates real-time status for:
 * - Supabase connections (saas_supabases_connections)
 * - Plan tokens (saas_plan_tokens)
 * - MCP audit logs (admin_mcp_audit)
 * 
 * GET /api/admin/status
 * Returns aggregated stats with optional detailed lists
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Types
interface ConnectionStats {
  total: number;
  active: number;
  inactive: number;
  used_today: number;
  used_last_7_days: number;
  recent_connections: ConnectionRecord[];
}

interface ConnectionRecord {
  id: string;
  owner_id: string;
  owner_email?: string;
  supabase_url: string;
  label: string | null;
  project_ref: string | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface TokenStats {
  total: number;
  available: number;
  redeemed: number;
  expired: number;
  canceled: number;
  frozen: number;
  issued_today: number;
  issued_last_7_days: number;
  recent_tokens: TokenRecord[];
}

interface TokenRecord {
  id: string;
  owner_user_id: string;
  owner_email?: string;
  plan_name?: string;
  status: string;
  is_frozen: boolean;
  purchased_at: string;
  valid_until: string | null;
  gateway: string | null;
  applied_at: string | null;
}

interface McpStats {
  total_24h: number;
  successful_24h: number;
  failed_24h: number;
  success_rate: number;
  avg_execution_time_ms: number;
  top_tools: { tool_name: string; count: number }[];
  recent_errors: McpErrorRecord[];
}

interface McpErrorRecord {
  id: string;
  tool_name: string;
  error: string;
  created_at: string;
  source: string;
}

interface StatusResponse {
  connections: ConnectionStats;
  tokens: TokenStats;
  mcp: McpStats;
  last_updated: string;
}

// GET handler
export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const session = await requireStaffSession({ redirectOnFail: false });
    if (!session) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    
    // Optional section filter (connections, tokens, mcp, or all)
    const section = searchParams.get("section") || "all";
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const response: Partial<StatusResponse> = {
      last_updated: now.toISOString()
    };

    // Fetch connections stats
    if (section === "all" || section === "connections") {
      response.connections = await getConnectionStats(supabase, today, last7Days);
    }

    // Fetch tokens stats
    if (section === "all" || section === "tokens") {
      response.tokens = await getTokenStats(supabase, today, last7Days);
    }

    // Fetch MCP stats
    if (section === "all" || section === "mcp") {
      response.mcp = await getMcpStats(supabase, last24h);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[status] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 }
    );
  }
}

// Helper: Get connection stats
async function getConnectionStats(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  today: string,
  last7Days: string
): Promise<ConnectionStats> {
  // Total connections
  const { count: total } = await supabase
    .from("saas_supabases_connections")
    .select("*", { count: "exact", head: true });

  // Active connections
  const { count: active } = await supabase
    .from("saas_supabases_connections")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  // Inactive connections
  const { count: inactive } = await supabase
    .from("saas_supabases_connections")
    .select("*", { count: "exact", head: true })
    .eq("is_active", false);

  // Used today
  const { count: usedToday } = await supabase
    .from("saas_supabases_connections")
    .select("*", { count: "exact", head: true })
    .gte("last_used_at", today);

  // Used last 7 days
  const { count: usedLast7Days } = await supabase
    .from("saas_supabases_connections")
    .select("*", { count: "exact", head: true })
    .gte("last_used_at", last7Days);

  // Recent connections (last 10)
  const { data: recentConnections } = await supabase
    .from("saas_supabases_connections")
    .select(`
      id,
      owner_id,
      supabase_url,
      label,
      project_ref,
      is_active,
      last_used_at,
      created_at
    `)
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .limit(10);

  // Get owner emails for recent connections
  const ownerIds = [...new Set(recentConnections?.map(c => c.owner_id) || [])];
  const { data: users } = ownerIds.length > 0
    ? await supabase
        .from("saas_users")
        .select("id, email")
        .in("id", ownerIds)
    : { data: [] };

  const userMap = new Map(users?.map(u => [u.id, u.email]) || []);

  const recent_connections: ConnectionRecord[] = (recentConnections || []).map(c => ({
    id: c.id,
    owner_id: c.owner_id,
    owner_email: userMap.get(c.owner_id),
    supabase_url: c.supabase_url,
    label: c.label,
    project_ref: c.project_ref,
    is_active: c.is_active,
    last_used_at: c.last_used_at,
    created_at: c.created_at
  }));

  return {
    total: total || 0,
    active: active || 0,
    inactive: inactive || 0,
    used_today: usedToday || 0,
    used_last_7_days: usedLast7Days || 0,
    recent_connections
  };
}

// Helper: Get token stats
async function getTokenStats(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  today: string,
  last7Days: string
): Promise<TokenStats> {
  // Total tokens
  const { count: total } = await supabase
    .from("saas_plan_tokens")
    .select("*", { count: "exact", head: true });

  // By status
  const { count: available } = await supabase
    .from("saas_plan_tokens")
    .select("*", { count: "exact", head: true })
    .eq("status", "available");

  const { count: redeemed } = await supabase
    .from("saas_plan_tokens")
    .select("*", { count: "exact", head: true })
    .eq("status", "redeemed");

  const { count: expired } = await supabase
    .from("saas_plan_tokens")
    .select("*", { count: "exact", head: true })
    .eq("status", "expired");

  const { count: canceled } = await supabase
    .from("saas_plan_tokens")
    .select("*", { count: "exact", head: true })
    .eq("status", "canceled");

  // Frozen tokens
  const { count: frozen } = await supabase
    .from("saas_plan_tokens")
    .select("*", { count: "exact", head: true })
    .eq("is_frozen", true);

  // Issued today
  const { count: issuedToday } = await supabase
    .from("saas_plan_tokens")
    .select("*", { count: "exact", head: true })
    .gte("created_at", today);

  // Issued last 7 days
  const { count: issuedLast7Days } = await supabase
    .from("saas_plan_tokens")
    .select("*", { count: "exact", head: true })
    .gte("created_at", last7Days);

  // Recent tokens (last 10)
  const { data: recentTokens } = await supabase
    .from("saas_plan_tokens")
    .select(`
      id,
      owner_user_id,
      plan_id,
      status,
      is_frozen,
      purchased_at,
      valid_until,
      gateway,
      applied_at
    `)
    .order("created_at", { ascending: false })
    .limit(10);

  // Get owner emails and plan names
  const ownerIds = [...new Set(recentTokens?.map(t => t.owner_user_id) || [])];
  const planIds = [...new Set(recentTokens?.map(t => t.plan_id).filter(Boolean) || [])];

  const { data: users } = ownerIds.length > 0
    ? await supabase
        .from("saas_users")
        .select("id, email")
        .in("id", ownerIds)
    : { data: [] };

  const { data: plans } = planIds.length > 0
    ? await supabase
        .from("saas_plans")
        .select("id, name")
        .in("id", planIds)
    : { data: [] };

  const userMap = new Map(users?.map(u => [u.id, u.email]) || []);
  const planMap = new Map(plans?.map(p => [p.id, p.name]) || []);

  const recent_tokens: TokenRecord[] = (recentTokens || []).map(t => ({
    id: t.id,
    owner_user_id: t.owner_user_id,
    owner_email: userMap.get(t.owner_user_id),
    plan_name: t.plan_id ? planMap.get(t.plan_id) : undefined,
    status: t.status,
    is_frozen: t.is_frozen,
    purchased_at: t.purchased_at,
    valid_until: t.valid_until,
    gateway: t.gateway,
    applied_at: t.applied_at
  }));

  return {
    total: total || 0,
    available: available || 0,
    redeemed: redeemed || 0,
    expired: expired || 0,
    canceled: canceled || 0,
    frozen: frozen || 0,
    issued_today: issuedToday || 0,
    issued_last_7_days: issuedLast7Days || 0,
    recent_tokens
  };
}

// Helper: Get MCP stats
async function getMcpStats(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  last24h: string
): Promise<McpStats> {
  // Total calls in 24h
  const { count: total24h } = await supabase
    .from("admin_mcp_audit")
    .select("*", { count: "exact", head: true })
    .gte("created_at", last24h);

  // Successful calls in 24h
  const { count: successful24h } = await supabase
    .from("admin_mcp_audit")
    .select("*", { count: "exact", head: true })
    .gte("created_at", last24h)
    .eq("success", true);

  // Failed calls in 24h
  const { count: failed24h } = await supabase
    .from("admin_mcp_audit")
    .select("*", { count: "exact", head: true })
    .gte("created_at", last24h)
    .eq("success", false);

  // Calculate success rate
  const successRate = total24h && total24h > 0
    ? Math.round((successful24h || 0) / total24h * 100)
    : 100;

  // Average execution time (from last 100 calls)
  const { data: execTimes } = await supabase
    .from("admin_mcp_audit")
    .select("execution_time_ms")
    .gte("created_at", last24h)
    .not("execution_time_ms", "is", null)
    .limit(100);

  const avgExecutionTime = execTimes?.length
    ? Math.round(execTimes.reduce((sum, r) => sum + (r.execution_time_ms || 0), 0) / execTimes.length)
    : 0;

  // Top tools (last 24h)
  const { data: toolsData } = await supabase
    .from("admin_mcp_audit")
    .select("tool_name")
    .gte("created_at", last24h)
    .limit(500);

  const toolCounts = new Map<string, number>();
  toolsData?.forEach(row => {
    const count = toolCounts.get(row.tool_name) || 0;
    toolCounts.set(row.tool_name, count + 1);
  });

  const topTools = Array.from(toolCounts.entries())
    .map(([tool_name, count]) => ({ tool_name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Recent errors
  const { data: errors } = await supabase
    .from("admin_mcp_audit")
    .select("id, tool_name, error, created_at, source")
    .eq("success", false)
    .not("error", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);

  const recent_errors: McpErrorRecord[] = (errors || []).map(e => ({
    id: e.id,
    tool_name: e.tool_name,
    error: e.error || "Unknown error",
    created_at: e.created_at,
    source: e.source
  }));

  return {
    total_24h: total24h || 0,
    successful_24h: successful24h || 0,
    failed_24h: failed24h || 0,
    success_rate: successRate,
    avg_execution_time_ms: avgExecutionTime,
    top_tools: topTools,
    recent_errors
  };
}

