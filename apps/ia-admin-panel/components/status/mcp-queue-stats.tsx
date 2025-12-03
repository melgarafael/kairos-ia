"use client";

import { useState } from "react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { McpData } from "./status-dashboard";
import {
  Cpu,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Zap,
  TrendingUp,
  AlertTriangle,
  ArrowRight
} from "lucide-react";

interface McpQueueStatsProps {
  data: McpData;
  loading: boolean;
}

// Format tool name
function formatToolName(name: string): string {
  return name
    .replace("admin_", "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

// Time ago
function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s atrás`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m atrás`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h atrás`;
  return `${Math.floor(seconds / 86400)}d atrás`;
}

export function McpQueueStats({ data, loading }: McpQueueStatsProps) {
  const [errorsExpanded, setErrorsExpanded] = useState(false);

  // Calculate success rate color
  const successColor = data.success_rate >= 95
    ? "text-emerald-400"
    : data.success_rate >= 80
    ? "text-amber-400"
    : "text-red-400";

  return (
    <section className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <Cpu className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Filas MCP</h2>
            <p className="text-sm text-muted-foreground">
              Chamadas de ferramentas nas últimas 24h
            </p>
          </div>
        </div>

        <Button variant="ghost" size="sm" asChild>
          <Link href="/audit" className="gap-2">
            Ver auditoria completa
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Cpu className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Chamadas 24h</span>
          </div>
          <p className="text-3xl font-bold tabular-nums">
            {data.total_24h.toLocaleString()}
          </p>
        </Card>

        <Card className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Sucesso</span>
          </div>
          <p className="text-3xl font-bold tabular-nums text-emerald-400">
            {data.successful_24h.toLocaleString()}
          </p>
        </Card>

        <Card className="space-y-2">
          <div className={`flex items-center gap-2 ${successColor}`}>
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Taxa sucesso</span>
          </div>
          <p className={`text-3xl font-bold tabular-nums ${successColor}`}>
            {data.success_rate}%
          </p>
        </Card>

        <Card className="space-y-2">
          <div className="flex items-center gap-2 text-amber-400">
            <Zap className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Tempo médio</span>
          </div>
          <p className="text-3xl font-bold tabular-nums text-amber-400">
            {data.avg_execution_time_ms}ms
          </p>
        </Card>
      </div>

      {/* Top Tools */}
      {data.top_tools.length > 0 && (
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-chart-1" />
            <CardTitle className="text-base">Top ferramentas (24h)</CardTitle>
          </div>
          <div className="space-y-3">
            {data.top_tools.map((tool, idx) => {
              const maxCount = data.top_tools[0]?.count || 1;
              const percent = Math.round((tool.count / maxCount) * 100);

              return (
                <div key={tool.tool_name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {idx + 1}. {formatToolName(tool.tool_name)}
                    </span>
                    <span className="font-mono text-xs">{tool.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-chart-1 to-chart-2"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recent Errors */}
      {data.failed_24h > 0 && (
        <Card className="overflow-hidden">
          <button
            onClick={() => setErrorsExpanded(!errorsExpanded)}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <span className="font-medium">Erros recentes</span>
              <span className="text-xs text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full">
                {data.failed_24h}
              </span>
            </div>
            {errorsExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {errorsExpanded && (
            <div className="border-t border-white/5">
              <div className="divide-y divide-white/5">
                {data.recent_errors.map((error) => (
                  <div key={error.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {formatToolName(error.tool_name)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(error.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2 font-mono">
                      {error.error.length > 200
                        ? error.error.slice(0, 200) + "..."
                        : error.error}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      Fonte: {error.source}
                    </span>
                  </div>
                ))}
                {data.recent_errors.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    Nenhum erro recente
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* No errors message */}
      {data.failed_24h === 0 && (
        <Card className="flex items-center gap-3 p-4 bg-emerald-500/5 border-emerald-500/20">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <div>
            <p className="font-medium text-emerald-400">Sistema saudável</p>
            <p className="text-sm text-muted-foreground">
              Nenhum erro nas últimas 24 horas
            </p>
          </div>
        </Card>
      )}
    </section>
  );
}

