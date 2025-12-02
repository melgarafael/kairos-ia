/**
 * MCP Audit API
 * 
 * Endpoints for querying MCP tool call audit logs.
 * 
 * GET /api/admin/mcp-audit
 * - Query params: page, limit, tool_name, user_id, success, date_from, date_to
 * - Returns paginated logs with aggregations
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Types
interface McpAuditLog {
  id: string;
  user_id: string;
  session_id: string | null;
  tool_name: string;
  tool_category: string | null;
  arguments: Record<string, unknown>;
  result: Record<string, unknown>;
  error: string | null;
  execution_time_ms: number | null;
  success: boolean;
  source: string;
  trace_id: string | null;
  created_at: string;
}

interface AggregatedStats {
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  avg_execution_time_ms: number;
  top_tools: { tool_name: string; count: number }[];
  calls_by_category: { category: string; count: number }[];
}

// GET handler - Query audit logs
export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const session = await requireStaffSession({ redirectOnFail: false });
    if (!session) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { searchParams } = new URL(request.url);

    // Parse query params
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const offset = (page - 1) * limit;

    // Filters
    const toolName = searchParams.get("tool_name");
    const userId = searchParams.get("user_id");
    const category = searchParams.get("category");
    const success = searchParams.get("success");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const traceId = searchParams.get("trace_id");
    const includeStats = searchParams.get("include_stats") === "true";

    // Build query
    let query = supabase
      .from("admin_mcp_audit")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (toolName) {
      query = query.ilike("tool_name", `%${toolName}%`);
    }
    if (userId) {
      query = query.eq("user_id", userId);
    }
    if (category) {
      query = query.eq("tool_category", category);
    }
    if (success !== null && success !== undefined) {
      query = query.eq("success", success === "true");
    }
    if (dateFrom) {
      query = query.gte("created_at", dateFrom);
    }
    if (dateTo) {
      query = query.lte("created_at", dateTo);
    }
    if (traceId) {
      query = query.eq("trace_id", traceId);
    }

    const { data: logs, error, count } = await query;

    if (error) {
      console.error("[mcp-audit] Query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build response
    const response: {
      logs: McpAuditLog[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
      stats?: AggregatedStats;
    } = {
      logs: logs || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    };

    // Include aggregated stats if requested
    if (includeStats) {
      const stats = await getAggregatedStats(supabase, dateFrom, dateTo);
      response.stats = stats;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[mcp-audit] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 }
    );
  }
}

// Helper: Get aggregated stats
async function getAggregatedStats(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  dateFrom?: string | null,
  dateTo?: string | null
): Promise<AggregatedStats> {
  // Base date filter
  let dateFilter = "";
  const params: string[] = [];
  
  if (dateFrom) {
    dateFilter += ` AND created_at >= '${dateFrom}'`;
  }
  if (dateTo) {
    dateFilter += ` AND created_at <= '${dateTo}'`;
  }

  // Total counts
  const { count: totalCalls } = await supabase
    .from("admin_mcp_audit")
    .select("*", { count: "exact", head: true });

  const { count: successfulCalls } = await supabase
    .from("admin_mcp_audit")
    .select("*", { count: "exact", head: true })
    .eq("success", true);

  const { count: failedCalls } = await supabase
    .from("admin_mcp_audit")
    .select("*", { count: "exact", head: true })
    .eq("success", false);

  // Average execution time
  const { data: avgData } = await supabase
    .from("admin_mcp_audit")
    .select("execution_time_ms")
    .not("execution_time_ms", "is", null)
    .limit(1000);

  const avgExecutionTime = avgData?.length
    ? avgData.reduce((sum, row) => sum + (row.execution_time_ms || 0), 0) / avgData.length
    : 0;

  // Top tools - get all and aggregate in JS
  const { data: toolsData } = await supabase
    .from("admin_mcp_audit")
    .select("tool_name")
    .limit(5000);

  const toolCounts = new Map<string, number>();
  toolsData?.forEach(row => {
    const count = toolCounts.get(row.tool_name) || 0;
    toolCounts.set(row.tool_name, count + 1);
  });

  const topTools = Array.from(toolCounts.entries())
    .map(([tool_name, count]) => ({ tool_name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Calls by category
  const { data: categoryData } = await supabase
    .from("admin_mcp_audit")
    .select("tool_category")
    .limit(5000);

  const categoryCounts = new Map<string, number>();
  categoryData?.forEach(row => {
    const cat = row.tool_category || "other";
    const count = categoryCounts.get(cat) || 0;
    categoryCounts.set(cat, count + 1);
  });

  const callsByCategory = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total_calls: totalCalls || 0,
    successful_calls: successfulCalls || 0,
    failed_calls: failedCalls || 0,
    avg_execution_time_ms: Math.round(avgExecutionTime),
    top_tools: topTools,
    calls_by_category: callsByCategory
  };
}

