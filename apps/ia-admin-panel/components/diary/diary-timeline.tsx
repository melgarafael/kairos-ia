"use client";

import { motion } from "framer-motion";
import { BookOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { DiaryEntryCard, type DiaryEntry } from "./diary-entry-card";

interface DiaryTimelineProps {
  entries: DiaryEntry[];
  className?: string;
  onEdit?: (entry: DiaryEntry) => void;
}

export function DiaryTimeline({ entries, className, onEdit }: DiaryTimelineProps) {
  // Empty state
  if (entries.length === 0) {
    return <EmptyState />;
  }

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className={cn("space-y-4", className)}
    >
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5">
            <BookOpen className="w-4 h-4 text-white/40" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-white/80">Sua jornada</h2>
            <p className="text-xs text-white/40">
              {entries.length} {entries.length === 1 ? "registro" : "registros"}
            </p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="pt-2">
        {entries.map((entry, index) => (
          <DiaryEntryCard
            key={entry.id}
            entry={entry}
            index={index}
            isLast={index === entries.length - 1}
            onEdit={onEdit}
          />
        ))}
      </div>
    </motion.section>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6",
        "rounded-2xl border border-white/5 bg-white/[0.02]"
      )}
    >
      {/* Illustration */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
        className="relative mb-6"
      >
        {/* Glow background */}
        <div className="absolute inset-0 rounded-full bg-violet-500/10 blur-2xl scale-150" />

        <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/10">
          <Sparkles className="w-10 h-10 text-violet-300" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-center space-y-2 max-w-xs"
      >
        <h3 className="text-lg font-medium text-white/90">
          Sua jornada começa aqui
        </h3>
        <p className="text-sm text-white/50 leading-relaxed">
          Registre seu primeiro check-in acima. Suas reflexões ajudam a mentora
          Kairos a te conhecer melhor.
        </p>
      </motion.div>

      {/* Decorative dots */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex items-center gap-2 mt-8"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-violet-400/40" />
        <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-400/40" />
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400/40" />
      </motion.div>
    </motion.div>
  );
}

