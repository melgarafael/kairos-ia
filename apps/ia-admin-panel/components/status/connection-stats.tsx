"use client";

import { useState } from "react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ConnectionData } from "./status-dashboard";
import {
  Database,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  User
} from "lucide-react";

interface ConnectionStatsProps {
  data: ConnectionData;
  loading: boolean;
}

// Format time ago
function timeAgo(dateString: string | null): string {
  if (!dateString) return "Nunca";
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s atrás`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m atrás`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h atrás`;
  return `${Math.floor(seconds / 86400)}d atrás`;
}

// Extract project name from supabase URL
function extractProjectName(url: string): string {
  try {
    const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
    return match ? match[1] : url;
  } catch {
    return url;
  }
}

export function ConnectionStats({ data, loading }: ConnectionStatsProps) {
  const [expanded, setExpanded] = useState(false);

  const usagePercent = data.total > 0
    ? Math.round((data.active / data.total) * 100)
    : 0;

  return (
    <section className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <Database className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Conexões Supabase</h2>
          <p className="text-sm text-muted-foreground">
            Projetos conectados pelos usuários
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Database className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Total</span>
          </div>
          <p className="text-3xl font-bold tabular-nums">
            {data.total.toLocaleString()}
          </p>
        </Card>

        <Card className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Ativas</span>
          </div>
          <p className="text-3xl font-bold tabular-nums text-emerald-400">
            {data.active.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">{usagePercent}% do total</p>
        </Card>

        <Card className="space-y-2">
          <div className="flex items-center gap-2 text-amber-400">
            <XCircle className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Inativas</span>
          </div>
          <p className="text-3xl font-bold tabular-nums text-amber-400">
            {data.inactive.toLocaleString()}
          </p>
        </Card>

        <Card className="space-y-2">
          <div className="flex items-center gap-2 text-cyan-400">
            <Activity className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Hoje</span>
          </div>
          <p className="text-3xl font-bold tabular-nums text-cyan-400">
            {data.used_today.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">usadas hoje</p>
        </Card>

        <Card className="space-y-2">
          <div className="flex items-center gap-2 text-purple-400">
            <Clock className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">7 dias</span>
          </div>
          <p className="text-3xl font-bold tabular-nums text-purple-400">
            {data.used_last_7_days.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">usadas na semana</p>
        </Card>
      </div>

      {/* Expandable table */}
      <Card className="overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Conexões recentes</span>
            <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
              {data.recent_connections.length}
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="border-t border-white/5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.02]">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Projeto</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Owner</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Último uso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.recent_connections.map((conn) => (
                    <tr key={conn.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium font-mono text-xs">
                            {conn.label || extractProjectName(conn.supabase_url)}
                          </span>
                          <a
                            href={conn.supabase_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        {conn.project_ref && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            ref: {conn.project_ref}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span className="text-xs truncate max-w-[150px]">
                            {conn.owner_email || conn.owner_id.slice(0, 8)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {conn.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Ativa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400">
                            <XCircle className="h-3 w-3" />
                            Inativa
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {timeAgo(conn.last_used_at)}
                      </td>
                    </tr>
                  ))}
                  {data.recent_connections.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        Nenhuma conexão recente
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}

