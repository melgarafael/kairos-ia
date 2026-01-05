"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Calendar, Target, Pencil, Clock } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { getMoodMeta } from "./mood-selector";

export interface DiaryEntry {
  id: string;
  data: string | null;
  hora: string | null; // HH:MM format
  created_at: string;
  humor_energia: string | null;
  principais_desafios: string | null;
  foco_do_dia: string | null;
}

interface DiaryEntryCardProps {
  entry: DiaryEntry;
  index: number;
  isLast?: boolean;
  onEdit?: (entry: DiaryEntry) => void;
}

export function DiaryEntryCard({ entry, index, isLast, onEdit }: DiaryEntryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const moodMeta = getMoodMeta(entry.humor_energia);

  const displayDate = entry.data ?? entry.created_at;
  const formattedDate = new Date(displayDate).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  // Format time display
  const displayTime = entry.hora || null;

  // Check if it's today
  const isToday =
    new Date(displayDate).toDateString() === new Date().toDateString();

  const hasContent = entry.principais_desafios || entry.foco_do_dia;

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(entry);
  };

  // Get preview text
  const previewText = entry.principais_desafios || entry.foco_do_dia;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex gap-3 sm:gap-4"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        {/* Mood indicator dot */}
        <motion.div
          whileHover={{ scale: 1.1 }}
          className={cn(
            "relative z-10 flex items-center justify-center",
            "w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2",
            "transition-all duration-200",
            moodMeta
              ? cn(moodMeta.bgColor, moodMeta.borderColor, "shadow-lg", moodMeta.glowColor)
              : "bg-white/5 border-white/20"
          )}
        >
          {moodMeta ? (
            <moodMeta.icon className={cn("w-4 h-4", moodMeta.color)} />
          ) : (
            <div className="w-2 h-2 rounded-full bg-white/40" />
          )}
        </motion.div>

        {/* Vertical line */}
        {!isLast && (
          <div className="w-px flex-1 min-h-[20px] bg-gradient-to-b from-white/10 to-transparent" />
        )}
      </div>

      {/* Content card */}
      <motion.div
        className={cn(
          "flex-1 mb-4 rounded-xl border overflow-hidden",
          "transition-all duration-200",
          isExpanded
            ? "bg-white/[0.04] border-white/10"
            : "bg-white/[0.02] border-white/5 hover:bg-white/[0.03] hover:border-white/10"
        )}
      >
        {/* Header - always visible */}
        <div 
          className={cn(
            "flex items-start justify-between p-3 sm:p-4",
            hasContent && "cursor-pointer"
          )}
          onClick={() => hasContent && setIsExpanded(!isExpanded)}
        >
          <div className="flex-1 min-w-0">
            {/* Date and time row */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-white/30" />
                <span className="text-sm text-white/70">{formattedDate}</span>
              </div>
              
              {displayTime && (
                <span className="flex items-center gap-1 text-xs text-white/45 bg-white/5 px-1.5 py-0.5 rounded">
                  <Clock className="w-2.5 h-2.5" />
                  {displayTime}
                </span>
              )}
              
              {isToday && (
                <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Hoje
                </span>
              )}
              
              {/* Mood label on same line for mobile */}
              {moodMeta && (
                <span className={cn("text-xs font-medium ml-auto sm:hidden", moodMeta.color)}>
                  {moodMeta.label}
                </span>
              )}
            </div>

            {/* Preview text - only show when NOT expanded */}
            {!isExpanded && previewText && (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-white/40 line-clamp-1 mt-1.5 pr-4"
              >
                {previewText}
              </motion.p>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 ml-2 flex-shrink-0">
            {/* Mood label - desktop only */}
            {moodMeta && (
              <span className={cn("text-xs font-medium hidden sm:block", moodMeta.color)}>
                {moodMeta.label}
              </span>
            )}

            {/* Edit button - shown on hover or when expanded */}
            <AnimatePresence>
              {(isHovered || isExpanded) && onEdit && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  onClick={handleEditClick}
                  className={cn(
                    "p-1.5 rounded-lg",
                    "text-white/40 hover:text-white/70",
                    "hover:bg-white/10 transition-colors"
                  )}
                  title="Editar registro"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Expand indicator */}
            {hasContent && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="p-1"
              >
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-4 h-4 text-white/30" />
                </motion.div>
              </button>
            )}
          </div>
        </div>

        {/* Expandable content */}
        <AnimatePresence initial={false}>
          {isExpanded && hasContent && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="px-3 sm:px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                {/* Challenges */}
                {entry.principais_desafios && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">
                      Na mente
                    </p>
                    <p className="text-sm text-white/70 leading-relaxed">
                      {entry.principais_desafios}
                    </p>
                  </div>
                )}

                {/* Focus */}
                {entry.foco_do_dia && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-white/[0.04] border border-white/5">
                    <Target className="w-4 h-4 text-white/40 flex-shrink-0 mt-0.5" />
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">
                        Intenção
                      </p>
                      <p className="text-sm text-white/80 font-medium">
                        {entry.foco_do_dia}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
