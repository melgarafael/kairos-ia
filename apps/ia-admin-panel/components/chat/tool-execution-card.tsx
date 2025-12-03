"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/ui/cn";
import {
  ChevronDown,
  ChevronRight,
  Users,
  Ticket,
  Building2,
  BarChart3,
  BookOpen,
  Settings,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Wrench,
} from "lucide-react";

// Tool call status
export type ToolStatus = "executing" | "success" | "error";

// Tool call data
export interface ToolCallData {
  id: string;
  name: string;
  category: string;
  status: ToolStatus;
  arguments?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  startTime: number;
  endTime?: number;
}

// Icon map for categories
const categoryIcons: Record<string, typeof Users> = {
  users: Users,
  tokens: Ticket,
  orgs: Building2,
  analytics: BarChart3,
  docs: BookOpen,
  system: Settings,
};

// Color map for categories
const categoryColors: Record<string, string> = {
  users: "from-blue-500/20 to-blue-600/5 border-blue-500/30",
  tokens: "from-amber-500/20 to-amber-600/5 border-amber-500/30",
  orgs: "from-purple-500/20 to-purple-600/5 border-purple-500/30",
  analytics: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30",
  docs: "from-cyan-500/20 to-cyan-600/5 border-cyan-500/30",
  system: "from-gray-500/20 to-gray-600/5 border-gray-500/30",
};

const categoryIconColors: Record<string, string> = {
  users: "text-blue-400",
  tokens: "text-amber-400",
  orgs: "text-purple-400",
  analytics: "text-emerald-400",
  docs: "text-cyan-400",
  system: "text-gray-400",
};

interface ToolExecutionCardProps {
  tool: ToolCallData;
  defaultExpanded?: boolean;
}

export function ToolExecutionCard({ tool, defaultExpanded = false }: ToolExecutionCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const Icon = categoryIcons[tool.category] || Wrench;
  const colorClass = categoryColors[tool.category] || categoryColors.system;
  const iconColor = categoryIconColors[tool.category] || categoryIconColors.system;

  const duration = tool.endTime ? tool.endTime - tool.startTime : null;

  // Format tool name for display
  const displayName = tool.name
    .replace(/^admin_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        "rounded-xl border bg-gradient-to-br backdrop-blur-sm overflow-hidden",
        colorClass
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors"
      >
        {/* Category Icon */}
        <div className={cn("p-2 rounded-lg bg-white/10", iconColor)}>
          <Icon className="w-4 h-4" />
        </div>

        {/* Tool Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-foreground truncate">
              {displayName}
            </span>
            {duration !== null && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
                <Clock className="w-3 h-3" />
                {duration}ms
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground/60 font-mono truncate">
            {tool.name}
          </p>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          {tool.status === "executing" && (
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          )}
          {tool.status === "success" && (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          {tool.status === "error" && (
            <XCircle className="w-4 h-4 text-red-400" />
          )}
          
          {/* Expand Icon */}
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground/50" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              {/* Arguments */}
              {tool.arguments && Object.keys(tool.arguments).length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground/80 mb-1">
                    Argumentos
                  </p>
                  <pre className="text-xs bg-black/20 rounded-lg p-2 overflow-x-auto font-mono text-foreground/80">
                    {JSON.stringify(tool.arguments, null, 2)}
                  </pre>
                </div>
              ) : null}

              {/* Result */}
              {tool.status === "success" && tool.result && (
                <div>
                  <p className="text-xs font-medium text-emerald-400/80 mb-1">
                    Resultado
                  </p>
                  <pre className="text-xs bg-emerald-500/10 rounded-lg p-2 overflow-x-auto max-h-48 font-mono text-emerald-200/80">
                    {typeof tool.result === "string"
                      ? tool.result
                      : JSON.stringify(tool.result, null, 2)}
                  </pre>
                </div>
              )}

              {/* Error */}
              {tool.status === "error" && tool.error && (
                <div>
                  <p className="text-xs font-medium text-red-400/80 mb-1">
                    Erro
                  </p>
                  <pre className="text-xs bg-red-500/10 rounded-lg p-2 overflow-x-auto font-mono text-red-200/80">
                    {tool.error}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Group of tool cards
interface ToolExecutionGroupProps {
  tools: ToolCallData[];
  title?: string;
}

export function ToolExecutionGroup({ tools, title = "Ferramentas Executadas" }: ToolExecutionGroupProps) {
  if (tools.length === 0) return null;

  const successCount = tools.filter((t) => t.status === "success").length;
  const errorCount = tools.filter((t) => t.status === "error").length;
  const executingCount = tools.filter((t) => t.status === "executing").length;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h4 className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
          {title}
        </h4>
        <div className="flex items-center gap-2 text-xs">
          {executingCount > 0 && (
            <span className="flex items-center gap-1 text-blue-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              {executingCount}
            </span>
          )}
          {successCount > 0 && (
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              {successCount}
            </span>
          )}
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <XCircle className="w-3 h-3" />
              {errorCount}
            </span>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {tools.map((tool) => (
            <ToolExecutionCard key={tool.id} tool={tool} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

