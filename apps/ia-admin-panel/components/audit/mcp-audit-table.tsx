"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ChevronLeft,
  ChevronRight,
  Activity,
  Zap,
  AlertTriangle,
  TrendingUp,
  GitBranch
} from "lucide-react";
import { TraceViewer } from "./trace-viewer";

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

interface ApiResponse {
  logs: McpAuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  stats?: AggregatedStats;
}

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
  users: "bg-blue-500/20 text-blue-400",
  tokens: "bg-purple-500/20 text-purple-400",
  organizations: "bg-emerald-500/20 text-emerald-400",
  connections: "bg-amber-500/20 text-amber-400",
  analytics: "bg-cyan-500/20 text-cyan-400",
  docs: "bg-pink-500/20 text-pink-400",
  other: "bg-gray-500/20 text-gray-400"
};

// Format time ago
function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s atrás`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m atrás`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h atrás`;
  return `${Math.floor(seconds / 86400)}d atrás`;
}

// Format tool name for display
function formatToolName(name: string): string {
  return name
    .replace("admin_", "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

// Stats Cards Component
function StatsCards({ stats }: { stats: AggregatedStats }) {
  const successRate = stats.total_calls > 0
    ? Math.round((stats.successful_calls / stats.total_calls) * 100)
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
          <Activity className="h-6 w-6 text-blue-400" />
        </div>
        <div>
          <p className="text-2xl font-bold">{stats.total_calls.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total de chamadas</p>
        </div>
      </Card>

      <Card className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <p className="text-2xl font-bold">{successRate}%</p>
          <p className="text-xs text-muted-foreground">Taxa de sucesso</p>
        </div>
      </Card>

      <Card className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
          <Zap className="h-6 w-6 text-amber-400" />
        </div>
        <div>
          <p className="text-2xl font-bold">{stats.avg_execution_time_ms}ms</p>
          <p className="text-xs text-muted-foreground">Tempo médio</p>
        </div>
      </Card>

      <Card className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-red-400" />
        </div>
        <div>
          <p className="text-2xl font-bold">{stats.failed_calls}</p>
          <p className="text-xs text-muted-foreground">Erros</p>
        </div>
      </Card>
    </div>
  );
}

// Top Tools Component
function TopTools({ tools }: { tools: { tool_name: string; count: number }[] }) {
  const maxCount = tools[0]?.count || 1;

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-chart-1" />
        <CardTitle className="text-base">Top Tools</CardTitle>
      </div>
      <div className="space-y-3">
        {tools.slice(0, 5).map((tool, idx) => (
          <div key={tool.tool_name} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {idx + 1}. {formatToolName(tool.tool_name)}
              </span>
              <span className="font-mono">{tool.count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-chart-1"
                style={{ width: `${(tool.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Main Component
export function McpAuditTable() {
  const [logs, setLogs] = useState<McpAuditLog[]>([]);
  const [stats, setStats] = useState<AggregatedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);
  const [traceFilter, setTraceFilter] = useState<string>("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        include_stats: page === 1 ? "true" : "false"
      });

      if (searchTerm) params.set("tool_name", searchTerm);
      if (selectedCategory) params.set("category", selectedCategory);
      if (showOnlyErrors) params.set("success", "false");
      if (traceFilter) params.set("trace_id", traceFilter);

      const res = await fetch(`/api/admin/mcp-audit?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");

      const data: ApiResponse = await res.json();
      setLogs(data.logs);
      setTotalPages(data.pagination.total_pages);
      setTotal(data.pagination.total);

      if (data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, selectedCategory, showOnlyErrors, traceFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedCategory, showOnlyErrors, traceFilter]);

  const categories = stats?.calls_by_category || [];

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && <StatsCards stats={stats} />}

      {/* Filters & Controls */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por tool..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedCategory === null ? "default" : "ghost"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            Todos
          </Button>
          {categories.slice(0, 5).map((cat) => (
            <Button
              key={cat.category}
              variant={selectedCategory === cat.category ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedCategory(cat.category)}
              className="capitalize"
            >
              {cat.category}
            </Button>
          ))}
        </div>

        <Button
          variant={showOnlyErrors ? "destructive" : "ghost"}
          size="sm"
          onClick={() => setShowOnlyErrors(!showOnlyErrors)}
        >
          <XCircle className="h-4 w-4 mr-1" />
          Apenas erros
        </Button>

        <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Trace Filter */}
      {traceFilter && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-chart-1/10 border border-chart-1/20">
          <GitBranch className="h-4 w-4 text-chart-1" />
          <span className="text-sm">Filtrando por trace:</span>
          <code className="text-xs font-mono bg-black/30 px-2 py-0.5 rounded">{traceFilter}</code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTraceFilter("")}
            className="ml-auto h-6"
          >
            Limpar filtro
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setSelectedTrace(traceFilter)}
            className="h-6"
          >
            Ver Timeline
          </Button>
        </div>
      )}

      {/* Top Tools */}
      {stats && stats.top_tools.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <TopTools tools={stats.top_tools} />
          
          {/* Categories breakdown */}
          <Card className="space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-chart-2" />
              <CardTitle className="text-base">Por Categoria</CardTitle>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <div
                  key={cat.category}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                    CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.other
                  }`}
                >
                  {cat.category}: {cat.count}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/5 bg-white/[0.02]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tool</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Categoria</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Trace</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tempo</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Quando</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Carregando...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhum log encontrado
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <>
                    <tr
                      key={log.id}
                      className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                      onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                    >
                      <td className="px-4 py-3">
                        {log.success ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-400" />
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {formatToolName(log.tool_name)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            CATEGORY_COLORS[log.tool_category || "other"] || CATEGORY_COLORS.other
                          }`}
                        >
                          {log.tool_category || "other"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {log.trace_id ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTrace(log.trace_id);
                            }}
                            className="flex items-center gap-1 text-xs font-mono text-chart-1 hover:text-chart-1/80 hover:underline"
                            title="Ver timeline do trace"
                          >
                            <GitBranch className="h-3 w-3" />
                            {log.trace_id.slice(0, 8)}...
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {log.execution_time_ms !== null ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {log.execution_time_ms}ms
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {timeAgo(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm">
                          {expandedRow === log.id ? "Fechar" : "Detalhes"}
                        </Button>
                      </td>
                    </tr>
                    {expandedRow === log.id && (
                      <tr key={`${log.id}-expanded`} className="bg-white/[0.02]">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid gap-4 md:grid-cols-2 text-xs">
                            <div className="space-y-2">
                              <p className="font-medium text-muted-foreground uppercase tracking-wider">
                                Argumentos
                              </p>
                              <pre className="p-3 rounded-lg bg-black/30 overflow-x-auto max-h-48">
                                {JSON.stringify(log.arguments, null, 2)}
                              </pre>
                            </div>
                            <div className="space-y-2">
                              <p className="font-medium text-muted-foreground uppercase tracking-wider">
                                {log.error ? "Erro" : "Resultado"}
                              </p>
                              <pre
                                className={`p-3 rounded-lg overflow-x-auto max-h-48 ${
                                  log.error ? "bg-red-500/10 text-red-300" : "bg-black/30"
                                }`}
                              >
                                {log.error || JSON.stringify(log.result, null, 2)}
                              </pre>
                            </div>
                            <div className="md:col-span-2 flex flex-wrap items-center gap-4 text-muted-foreground">
                              <span>
                                <strong>Session:</strong> {log.session_id || "-"}
                              </span>
                              <span>
                                <strong>Source:</strong> {log.source}
                              </span>
                              {log.trace_id && (
                                <div className="flex items-center gap-2 ml-auto">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTraceFilter(log.trace_id!);
                                    }}
                                    className="h-7 text-xs"
                                  >
                                    <Search className="h-3 w-3 mr-1" />
                                    Filtrar por Trace
                                  </Button>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTrace(log.trace_id);
                                    }}
                                    className="h-7 text-xs"
                                  >
                                    <GitBranch className="h-3 w-3 mr-1" />
                                    Ver Timeline
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <p className="text-sm text-muted-foreground">
              {total.toLocaleString()} logs no total
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Trace Viewer Modal */}
      {selectedTrace && (
        <TraceViewer
          traceId={selectedTrace}
          onClose={() => setSelectedTrace(null)}
        />
      )}
    </div>
  );
}

