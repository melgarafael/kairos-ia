"use client";

import { useState } from "react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import type { TokenData } from "./status-dashboard";
import {
  Ticket,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Snowflake,
  AlertTriangle,
  TrendingUp,
  User,
  CreditCard
} from "lucide-react";

interface TokenStatsProps {
  data: TokenData;
  loading: boolean;
}

// Status colors and labels
const STATUS_CONFIG: Record<string, { color: string; label: string; icon: typeof CheckCircle2 }> = {
  available: { color: "bg-emerald-500/20 text-emerald-400", label: "Disponível", icon: CheckCircle2 },
  redeemed: { color: "bg-blue-500/20 text-blue-400", label: "Resgatado", icon: CheckCircle2 },
  expired: { color: "bg-amber-500/20 text-amber-400", label: "Expirado", icon: Clock },
  canceled: { color: "bg-red-500/20 text-red-400", label: "Cancelado", icon: XCircle }
};

// Format date
function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
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

export function TokenStats({ data, loading }: TokenStatsProps) {
  const [expanded, setExpanded] = useState(false);

  // Calculate usage percent
  const usedTokens = data.redeemed + data.expired + data.canceled;
  const usagePercent = data.total > 0 
    ? Math.round((usedTokens / data.total) * 100)
    : 0;

  return (
    <section className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
          <Ticket className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Tokens de Plano</h2>
          <p className="text-sm text-muted-foreground">
            Licenças emitidas e resgatadas
          </p>
        </div>
      </div>

      {/* KPI Grid - Row 1: Status breakdown */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Ticket className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Total</span>
          </div>
          <p className="text-3xl font-bold tabular-nums">
            {data.total.toLocaleString()}
          </p>
        </Card>

        <Card className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Disponíveis</span>
          </div>
          <p className="text-3xl font-bold tabular-nums text-emerald-400">
            {data.available.toLocaleString()}
          </p>
        </Card>

        <Card className="space-y-2">
          <div className="flex items-center gap-2 text-blue-400">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Resgatados</span>
          </div>
          <p className="text-3xl font-bold tabular-nums text-blue-400">
            {data.redeemed.toLocaleString()}
          </p>
        </Card>

        <Card className="space-y-2">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Expirados</span>
          </div>
          <p className="text-3xl font-bold tabular-nums text-amber-400">
            {data.expired.toLocaleString()}
          </p>
        </Card>

        <Card className="space-y-2">
          <div className="flex items-center gap-2 text-cyan-400">
            <Snowflake className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Congelados</span>
          </div>
          <p className="text-3xl font-bold tabular-nums text-cyan-400">
            {data.frozen.toLocaleString()}
          </p>
        </Card>
      </div>

      {/* KPI Grid - Row 2: Issuance stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Emitidos hoje</span>
          </div>
          <p className="text-3xl font-bold tabular-nums">
            {data.issued_today.toLocaleString()}
          </p>
        </Card>

        <Card className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Emitidos 7 dias</span>
          </div>
          <p className="text-3xl font-bold tabular-nums">
            {data.issued_last_7_days.toLocaleString()}
          </p>
        </Card>

        <Card className="space-y-2">
          <div className="flex items-center gap-2 text-red-400">
            <XCircle className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Cancelados</span>
          </div>
          <p className="text-3xl font-bold tabular-nums text-red-400">
            {data.canceled.toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Expandable table */}
      <Card className="overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Tokens recentes</span>
            <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
              {data.recent_tokens.length}
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
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Owner</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plano</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Gateway</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Validade</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Emitido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.recent_tokens.map((token) => {
                    const statusConfig = STATUS_CONFIG[token.status] || STATUS_CONFIG.available;
                    const StatusIcon = statusConfig.icon;

                    return (
                      <tr key={token.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span className="text-xs truncate max-w-[150px]">
                              {token.owner_email || token.owner_user_id.slice(0, 8)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-xs">
                            {token.plan_name || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${statusConfig.color}`}>
                              <StatusIcon className="h-3 w-3" />
                              {statusConfig.label}
                            </span>
                            {token.is_frozen && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-400">
                                <Snowflake className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {token.gateway ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-white/5 text-muted-foreground">
                              <CreditCard className="h-3 w-3" />
                              {token.gateway}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {formatDate(token.valid_until)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {timeAgo(token.purchased_at)}
                        </td>
                      </tr>
                    );
                  })}
                  {data.recent_tokens.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        Nenhum token recente
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

