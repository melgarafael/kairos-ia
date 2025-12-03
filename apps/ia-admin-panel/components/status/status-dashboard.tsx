"use client";

import { useState, useEffect, useCallback } from "react";
import { ConnectionStats } from "./connection-stats";
import { TokenStats } from "./token-stats";
import { McpQueueStats } from "./mcp-queue-stats";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock, Wifi, WifiOff } from "lucide-react";

// Types matching the API response
export interface ConnectionData {
  total: number;
  active: number;
  inactive: number;
  used_today: number;
  used_last_7_days: number;
  recent_connections: {
    id: string;
    owner_id: string;
    owner_email?: string;
    supabase_url: string;
    label: string | null;
    project_ref: string | null;
    is_active: boolean;
    last_used_at: string | null;
    created_at: string;
  }[];
}

export interface TokenData {
  total: number;
  available: number;
  redeemed: number;
  expired: number;
  canceled: number;
  frozen: number;
  issued_today: number;
  issued_last_7_days: number;
  recent_tokens: {
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
  }[];
}

export interface McpData {
  total_24h: number;
  successful_24h: number;
  failed_24h: number;
  success_rate: number;
  avg_execution_time_ms: number;
  top_tools: { tool_name: string; count: number }[];
  recent_errors: {
    id: string;
    tool_name: string;
    error: string;
    created_at: string;
    source: string;
  }[];
}

interface StatusData {
  connections?: ConnectionData;
  tokens?: TokenData;
  mcp?: McpData;
  last_updated: string;
}

const POLLING_INTERVAL = 30000; // 30 seconds

export function StatusDashboard() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [countdown, setCountdown] = useState(POLLING_INTERVAL / 1000);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch("/api/admin/status");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const json = await res.json();
      setData(json);
      setLastFetch(new Date());
      setCountdown(POLLING_INTERVAL / 1000);
    } catch (err) {
      console.error("[StatusDashboard] Fetch error:", err);
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling
  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(() => {
      fetchData();
    }, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [isPolling, fetchData]);

  // Countdown timer
  useEffect(() => {
    if (!isPolling) return;

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : POLLING_INTERVAL / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [isPolling]);

  const formatLastFetch = () => {
    if (!lastFetch) return "Nunca";
    return lastFetch.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  return (
    <div className="space-y-8">
      {/* Header with controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Status em tempo real</h1>
          <p className="text-muted-foreground">
            Monitoramento de conexões Supabase, tokens e filas MCP
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Last updated indicator */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Última atualização: {formatLastFetch()}</span>
            {isPolling && (
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                {countdown}s
              </span>
            )}
          </div>

          {/* Polling toggle */}
          <Button
            variant={isPolling ? "default" : "ghost"}
            size="sm"
            onClick={() => setIsPolling(!isPolling)}
            className="gap-2"
          >
            {isPolling ? (
              <>
                <Wifi className="h-4 w-4" />
                Auto
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" />
                Pausado
              </>
            )}
          </Button>

          {/* Manual refresh */}
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
          <p className="font-medium">Erro ao carregar dados</p>
          <p className="text-sm opacity-80">{error}</p>
        </div>
      )}

      {/* Loading state for initial load */}
      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Carregando status...</p>
          </div>
        </div>
      )}

      {/* Main content */}
      {data && (
        <div className="space-y-8">
          {/* Connections section */}
          {data.connections && (
            <ConnectionStats data={data.connections} loading={loading} />
          )}

          {/* Tokens section */}
          {data.tokens && (
            <TokenStats data={data.tokens} loading={loading} />
          )}

          {/* MCP section */}
          {data.mcp && (
            <McpQueueStats data={data.mcp} loading={loading} />
          )}
        </div>
      )}
    </div>
  );
}

