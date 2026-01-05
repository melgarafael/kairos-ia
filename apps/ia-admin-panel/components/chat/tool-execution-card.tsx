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
  // Kairos-specific icons
  Sparkles,
  Calendar,
  Brain,
  MessageSquare,
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

// Icon map for categories (includes Admin + Kairos tools)
const categoryIcons: Record<string, typeof Users> = {
  // Admin tools
  users: Users,
  tokens: Ticket,
  orgs: Building2,
  analytics: BarChart3,
  docs: BookOpen,
  system: Settings,
  // Kairos tools
  human_design: Sparkles,
  diario: Calendar,
  memorias: Brain,
  biblioteca: BookOpen,
  sessoes: MessageSquare,
};

// Color map for categories (includes Admin + Kairos tools)
const categoryColors: Record<string, string> = {
  // Admin tools
  users: "from-blue-500/20 to-blue-600/5 border-blue-500/30",
  tokens: "from-amber-500/20 to-amber-600/5 border-amber-500/30",
  orgs: "from-purple-500/20 to-purple-600/5 border-purple-500/30",
  analytics: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30",
  docs: "from-cyan-500/20 to-cyan-600/5 border-cyan-500/30",
  system: "from-gray-500/20 to-gray-600/5 border-gray-500/30",
  // Kairos tools - mystical theme
  human_design: "from-amber-500/20 to-yellow-500/5 border-amber-500/30",
  diario: "from-emerald-500/20 to-green-500/5 border-emerald-500/30",
  memorias: "from-violet-500/20 to-purple-500/5 border-violet-500/30",
  biblioteca: "from-blue-500/20 to-indigo-500/5 border-blue-500/30",
  sessoes: "from-fuchsia-500/20 to-pink-500/5 border-fuchsia-500/30",
};

const categoryIconColors: Record<string, string> = {
  // Admin tools
  users: "text-blue-400",
  tokens: "text-amber-400",
  orgs: "text-purple-400",
  analytics: "text-emerald-400",
  docs: "text-cyan-400",
  system: "text-gray-400",
  // Kairos tools
  human_design: "text-amber-400",
  diario: "text-emerald-400",
  memorias: "text-violet-400",
  biblioteca: "text-blue-400",
  sessoes: "text-fuchsia-400",
};

// Humanized tool names in Portuguese (Kairos tools)
const humanizedToolNames: Record<string, { title: string; description: string }> = {
  // Kairos tools
  kairos_getHumanDesignProfile: {
    title: "Lendo seu Human Design",
    description: "Consultando seu tipo, estratégia e autoridade"
  },
  kairos_getDailyLogs: {
    title: "Acessando seu diário",
    description: "Buscando seus registros de humor e energia"
  },
  kairos_createDailyLog: {
    title: "Registrando check-in",
    description: "Salvando como você está se sentindo"
  },
  kairos_getMemories: {
    title: "Buscando memórias",
    description: "Recuperando insights de conversas anteriores"
  },
  kairos_createMemory: {
    title: "Guardando insight",
    description: "Salvando este momento para o futuro"
  },
  kairos_searchHdLibrary: {
    title: "Consultando biblioteca",
    description: "Buscando conhecimento de Human Design"
  },
  kairos_getSessionMessages: {
    title: "Recuperando contexto",
    description: "Acessando histórico de conversas"
  },
  // Admin tools (fallback)
  admin_list_users: {
    title: "Listando usuários",
    description: "Buscando lista de usuários"
  },
  admin_get_user_details: {
    title: "Detalhes do usuário",
    description: "Consultando informações do usuário"
  },
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

  // Get humanized name or fallback to formatted name
  const humanized = humanizedToolNames[tool.name];
  const displayName = humanized?.title || tool.name
    .replace(/^admin_/, "")
    .replace(/^kairos_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
  const displayDescription = humanized?.description;

  // Status text for humanized display
  const statusText = tool.status === "executing" 
    ? "Processando..." 
    : tool.status === "success" 
      ? "Concluído" 
      : "Erro";

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

        {/* Tool Info - Humanized */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-foreground truncate">
              {displayName}
            </span>
            {tool.status === "success" && duration !== null && (
              <span className="text-xs text-emerald-400/70">
                ✓
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground/60 truncate">
            {tool.status === "executing" 
              ? (displayDescription || "Processando...") 
              : statusText}
          </p>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          {tool.status === "executing" && (
            <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
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
              {Object.keys(tool.arguments ?? {}).length > 0 ? (
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
              {tool.status === "success" && tool.result !== undefined && tool.result !== null ? (
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
              ) : null}

              {/* Error */}
              {tool.status === "error" && tool.error ? (
                <div>
                  <p className="text-xs font-medium text-red-400/80 mb-1">
                    Erro
                  </p>
                  <pre className="text-xs bg-red-500/10 rounded-lg p-2 overflow-x-auto font-mono text-red-200/80">
                    {tool.error}
                  </pre>
                </div>
              ) : null}
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

export function ToolExecutionGroup({ tools, title = "O que consultei" }: ToolExecutionGroupProps) {
  if (tools.length === 0) return null;

  const successCount = tools.filter((t) => t.status === "success").length;
  const errorCount = tools.filter((t) => t.status === "error").length;
  const executingCount = tools.filter((t) => t.status === "executing").length;
  const allComplete = executingCount === 0;
  const hasErrors = errorCount > 0;

  // Humanized status message
  const statusMessage = executingCount > 0 
    ? "Processando..."
    : hasErrors 
      ? `${successCount} consulta${successCount !== 1 ? 's' : ''} • ${errorCount} erro${errorCount !== 1 ? 's' : ''}`
      : successCount === 1 
        ? "1 consulta realizada" 
        : `${successCount} consultas realizadas`;

  return (
    <div className="space-y-2">
      {/* Header - Humanized */}
      <div className="flex items-center justify-between px-1">
        <h4 className="text-xs font-medium text-violet-400/70 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          {title}
        </h4>
        <div className="flex items-center gap-2 text-xs">
          {executingCount > 0 ? (
            <span className="flex items-center gap-1.5 text-violet-400/70">
              <Loader2 className="w-3 h-3 animate-spin" />
              {statusMessage}
            </span>
          ) : (
            <span className={cn(
              "flex items-center gap-1.5",
              hasErrors ? "text-amber-400/70" : "text-emerald-400/70"
            )}>
              {hasErrors ? null : <CheckCircle2 className="w-3 h-3" />}
              {statusMessage}
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

