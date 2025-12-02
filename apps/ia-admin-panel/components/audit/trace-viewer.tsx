"use client";

import { useState, useEffect } from "react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  Zap,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Terminal
} from "lucide-react";

// Types
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

interface TraceData {
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

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
  users: "border-blue-500 bg-blue-500/10",
  tokens: "border-purple-500 bg-purple-500/10",
  organizations: "border-emerald-500 bg-emerald-500/10",
  connections: "border-amber-500 bg-amber-500/10",
  analytics: "border-cyan-500 bg-cyan-500/10",
  docs: "border-pink-500 bg-pink-500/10",
  other: "border-gray-500 bg-gray-500/10"
};

const CATEGORY_DOT_COLORS: Record<string, string> = {
  users: "bg-blue-500",
  tokens: "bg-purple-500",
  organizations: "bg-emerald-500",
  connections: "bg-amber-500",
  analytics: "bg-cyan-500",
  docs: "bg-pink-500",
  other: "bg-gray-500"
};

// Format tool name
function formatToolName(name: string): string {
  return name
    .replace("admin_", "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

// Format time
function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3
  });
}

// Timeline Item Component
function TimelineItem({
  call,
  isLast,
  index
}: {
  call: TraceToolCall;
  isLast: boolean;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const category = call.tool_category || "other";

  return (
    <div className="relative flex gap-4">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            call.success
              ? "border-emerald-500 bg-emerald-500/20"
              : "border-red-500 bg-red-500/20"
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              call.success ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 bg-white/10 min-h-[40px]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div
          className={`rounded-lg border-l-4 p-4 cursor-pointer transition-colors hover:bg-white/[0.02] ${
            CATEGORY_COLORS[category]
          }`}
          onClick={() => setExpanded(!expanded)}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">
                  #{index + 1}
                </span>
                <h4 className="font-medium">{formatToolName(call.tool_name)}</h4>
                {call.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(call.created_at)}
                </span>
                {call.execution_time_ms !== null && (
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {call.execution_time_ms}ms
                  </span>
                )}
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${CATEGORY_DOT_COLORS[category]} text-white`}
                >
                  {category}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Expanded Details */}
          {expanded && (
            <div className="mt-4 space-y-3 text-xs">
              <div>
                <p className="font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Argumentos
                </p>
                <pre className="p-2 rounded bg-black/30 overflow-x-auto max-h-32">
                  {JSON.stringify(call.arguments, null, 2)}
                </pre>
              </div>
              <div>
                <p className="font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  {call.error ? "Erro" : "Resultado"}
                </p>
                <pre
                  className={`p-2 rounded overflow-x-auto max-h-32 ${
                    call.error ? "bg-red-500/10 text-red-300" : "bg-black/30"
                  }`}
                >
                  {call.error || JSON.stringify(call.result, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Main Trace Viewer Component
interface TraceViewerProps {
  traceId: string;
  onClose: () => void;
}

export function TraceViewer({ traceId, onClose }: TraceViewerProps) {
  const [trace, setTrace] = useState<TraceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrace() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/admin/mcp-audit/trace/${traceId}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erro ao buscar trace");
        }
        const data = await res.json();
        setTrace(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    }

    fetchTrace();
  }, [traceId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden">
          <div className="p-8 text-center">
            <Activity className="h-8 w-8 animate-spin mx-auto mb-4 text-chart-1" />
            <p className="text-muted-foreground">Carregando trace...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !trace) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <Card className="w-full max-w-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-red-400">Erro</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-muted-foreground">{error || "Trace não encontrado"}</p>
        </Card>
      </div>
    );
  }

  const successRate = trace.total_calls > 0
    ? Math.round((trace.successful_calls / trace.total_calls) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <GitBranch className="h-5 w-5 text-chart-1" />
                <CardTitle>Trace Timeline</CardTitle>
              </div>
              <CardDescription className="font-mono text-xs break-all">
                {trace.trace_id}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="text-center p-3 rounded-lg bg-white/5">
              <p className="text-2xl font-bold">{trace.total_calls}</p>
              <p className="text-xs text-muted-foreground">Tool Calls</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-white/5">
              <p className="text-2xl font-bold text-emerald-400">{successRate}%</p>
              <p className="text-xs text-muted-foreground">Sucesso</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-white/5">
              <p className="text-2xl font-bold">{trace.total_execution_time_ms}ms</p>
              <p className="text-xs text-muted-foreground">Tempo Total</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-white/5">
              <p className="text-2xl font-bold">{trace.duration_ms}ms</p>
              <p className="text-xs text-muted-foreground">Duração</p>
            </div>
          </div>

          {/* Tools & Categories used */}
          <div className="flex flex-wrap gap-2 mt-4">
            {trace.categories_used.map((cat) => (
              <span
                key={cat}
                className={`px-2 py-1 rounded-full text-xs ${CATEGORY_DOT_COLORS[cat] || CATEGORY_DOT_COLORS.other} text-white`}
              >
                {cat}
              </span>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Execução Sequencial
            </h3>
          </div>

          <div className="space-y-0">
            {trace.tool_calls.map((call, index) => (
              <TimelineItem
                key={call.id}
                call={call}
                isLast={index === trace.tool_calls.length - 1}
                index={index}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Início: {new Date(trace.start_time).toLocaleString("pt-BR")}
            </span>
            <span>
              Fim: {new Date(trace.end_time).toLocaleString("pt-BR")}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

