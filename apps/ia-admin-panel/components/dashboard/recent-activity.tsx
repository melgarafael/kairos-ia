"use client";

/**
 * RecentActivity — Últimas interações
 * 
 * Filosofia Jobs:
 * - Estados vazios que ensinam: sample data + CTA
 * - Feedback imediato
 * - Detalhes são o produto
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { BookOpen, Brain, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { type DailyLog, type AiMemory } from "@/lib/kairos/types";

interface RecentActivityProps {
  logs: Pick<DailyLog, "id" | "data" | "created_at" | "humor_energia" | "foco_do_dia">[];
  memories: Pick<AiMemory, "id" | "content" | "created_at">[];
  className?: string;
}

// Emoji mapping for mood
const MOOD_EMOJIS: Record<string, string> = {
  "muito bem": "✨",
  "bem": "🌟",
  "ok": "🌤",
  "regular": "☁️",
  "cansado": "🌙",
  "desafiador": "⚡",
};

function getMoodEmoji(mood?: string | null): string {
  if (!mood) return "🌟";
  const normalized = mood.toLowerCase().trim();
  for (const [key, emoji] of Object.entries(MOOD_EMOJIS)) {
    if (normalized.includes(key)) return emoji;
  }
  return "🌟";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Hoje";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Ontem";
  }
  return date.toLocaleDateString("pt-BR", { 
    day: "numeric", 
    month: "short" 
  });
}

export function RecentActivity({ logs, memories, className }: RecentActivityProps) {
  const hasLogs = logs.length > 0;
  const hasMemories = memories.length > 0;
  const isEmpty = !hasLogs && !hasMemories;

  // Container animation
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.06,
        delayChildren: 0.2,
      },
    },
  };

  // Item animation
  const itemVariants = {
    hidden: { opacity: 0, x: -12 },
    show: { 
      opacity: 1, 
      x: 0,
      transition: {
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  return (
    <motion.section
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className={cn("space-y-6", className)}
    >
      {/* Logs Section */}
      <div className="space-y-3">
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-white/30" />
            <h3 className="text-sm font-medium text-white/50">
              Últimos registros
            </h3>
          </div>
          {hasLogs && (
            <Link 
              href="/diario"
              className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
            >
              Ver todos <ChevronRight className="w-3 h-3" />
            </Link>
          )}
        </motion.div>

        {hasLogs ? (
          <div className="space-y-2">
            {logs.slice(0, 3).map((log) => (
              <motion.div
                key={log.id}
                variants={itemVariants}
                className={cn(
                  "group flex items-center gap-3 p-3 rounded-xl",
                  "bg-white/[0.02] border border-white/[0.04]",
                  "hover:bg-white/[0.04] hover:border-white/[0.08]",
                  "transition-all duration-300"
                )}
              >
                <span className="text-lg flex-shrink-0">
                  {getMoodEmoji(log.humor_energia)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/70 truncate">
                    {log.foco_do_dia || "Sem foco registrado"}
                  </p>
                  <p className="text-[11px] text-white/30">
                    {formatDate(log.data ?? log.created_at)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            variants={itemVariants}
            className={cn(
              "flex flex-col items-center justify-center p-6 rounded-xl",
              "bg-white/[0.01] border border-dashed border-white/[0.06]",
              "text-center"
            )}
          >
            <Sparkles className="w-8 h-8 text-white/15 mb-3" />
            <p className="text-sm text-white/40 mb-2">
              Nenhum registro ainda
            </p>
            <p className="text-xs text-white/25 mb-4 max-w-[200px]">
              Seus registros diários alimentam a mentora com contexto valioso
            </p>
            <Link
              href="/diario"
              className={cn(
                "inline-flex items-center gap-1 px-4 py-2 rounded-lg",
                "bg-white/[0.04] hover:bg-white/[0.08]",
                "text-xs text-white/60 hover:text-white/80",
                "border border-white/[0.06] hover:border-white/[0.1]",
                "transition-all duration-300"
              )}
            >
              Fazer primeiro registro
              <ChevronRight className="w-3 h-3" />
            </Link>
          </motion.div>
        )}
      </div>

      {/* Memories Section */}
      <div className="space-y-3">
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-white/30" />
            <h3 className="text-sm font-medium text-white/50">
              Memórias da mentora
            </h3>
          </div>
        </motion.div>

        {hasMemories ? (
          <div className="space-y-2">
            {memories.slice(0, 3).map((memory) => (
              <motion.div
                key={memory.id}
                variants={itemVariants}
                className={cn(
                  "p-3 rounded-xl",
                  "bg-white/[0.02] border border-white/[0.04]"
                )}
              >
                <p className="text-sm text-white/60 line-clamp-2 leading-relaxed">
                  {memory.content}
                </p>
                <p className="text-[10px] text-white/25 mt-2">
                  {formatDate(memory.created_at)}
                </p>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            variants={itemVariants}
            className={cn(
              "p-4 rounded-xl",
              "bg-white/[0.01] border border-dashed border-white/[0.06]"
            )}
          >
            <p className="text-xs text-white/30 text-center">
              A mentora ainda não guardou memórias. Converse com ela para criar contexto.
            </p>
          </motion.div>
        )}
      </div>
    </motion.section>
  );
}

