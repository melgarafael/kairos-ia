/**
 * Trace API - Get all tool calls for a specific trace
 * 
 * GET /api/admin/mcp-audit/trace/[traceId]
 * Returns all tool calls associated with a trace_id, ordered chronologically
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface TraceToolCall {
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
  created_at: string;
}

interface TraceResponse {
  trace_id: string;
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  total_execution_time_ms: number;
  start_time: string;
  end_time: string;
  duration_ms: number;
  tools_used: string[];
  categories_used: string[];
  tool_calls: TraceToolCall[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ traceId: string }> }
) {
  try {
    // Authenticate
    const session = await requireStaffSession({ redirectOnFail: false });
    if (!session) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { traceId } = await params;

    if (!traceId) {
      return NextResponse.json({ error: "trace_id é obrigatório." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Fetch all tool calls for this trace
    const { data: toolCalls, error } = await supabase
      .from("admin_mcp_audit")
      .select("*")
      .eq("trace_id", traceId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[trace-api] Query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!toolCalls || toolCalls.length === 0) {
      return NextResponse.json({ error: "Trace não encontrado." }, { status: 404 });
    }

    // Calculate trace statistics
    const successfulCalls = toolCalls.filter(tc => tc.success).length;
    const failedCalls = toolCalls.filter(tc => !tc.success).length;
    const totalExecutionTime = toolCalls.reduce(
      (sum, tc) => sum + (tc.execution_time_ms || 0),
      0
    );

    const startTime = toolCalls[0].created_at;
    const endTime = toolCalls[toolCalls.length - 1].created_at;
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();

    // Get unique tools and categories
    const toolsUsed = [...new Set(toolCalls.map(tc => tc.tool_name))];
    const categoriesUsed = [...new Set(toolCalls.map(tc => tc.tool_category).filter(Boolean))];

    const response: TraceResponse = {
      trace_id: traceId,
      total_calls: toolCalls.length,
      successful_calls: successfulCalls,
      failed_calls: failedCalls,
      total_execution_time_ms: totalExecutionTime,
      start_time: startTime,
      end_time: endTime,
      duration_ms: durationMs,
      tools_used: toolsUsed,
      categories_used: categoriesUsed as string[],
      tool_calls: toolCalls
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[trace-api] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 }
    );
  }
}

