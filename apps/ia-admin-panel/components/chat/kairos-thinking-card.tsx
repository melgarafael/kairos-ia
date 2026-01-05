"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/ui/cn";
import { Sparkles, ChevronDown, ChevronUp, Brain, Eye, EyeOff } from "lucide-react";

interface KairosThinkingCardProps {
  /** The reasoning/thinking text being streamed */
  content: string;
  /** Whether the thinking is still streaming */
  isStreaming?: boolean;
  /** Whether to show expanded by default */
  defaultExpanded?: boolean;
  /** Optional className for container */
  className?: string;
}

/**
 * KairosThinkingCard - Displays AI reasoning in a mystical, elegant card
 * 
 * Creates a magical experience by showing what Kairos is thinking,
 * with typing effect, pulsing cursor, and smooth animations.
 */
export function KairosThinkingCard({
  content,
  isStreaming = false,
  defaultExpanded = true,
  className
}: KairosThinkingCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showContent, setShowContent] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when content updates
  useEffect(() => {
    if (contentRef.current && isStreaming) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  // Auto-collapse after streaming ends (with delay)
  useEffect(() => {
    if (!isStreaming && content.length > 0) {
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, content]);

  if (!content && !isStreaming) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-gradient-to-br from-violet-950/40 via-purple-900/30 to-fuchsia-950/40",
        "border border-violet-500/20",
        "backdrop-blur-xl shadow-lg shadow-violet-500/5",
        className
      )}
    >
      {/* Animated glow effect */}
      <div className="absolute inset-0 pointer-events-none">
        <div className={cn(
          "absolute -top-20 -right-20 w-40 h-40",
          "bg-violet-500/10 rounded-full blur-3xl",
          isStreaming && "animate-pulse"
        )} />
        <div className={cn(
          "absolute -bottom-20 -left-20 w-40 h-40",
          "bg-fuchsia-500/10 rounded-full blur-3xl",
          isStreaming && "animate-pulse"
        )} />
      </div>

      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3",
          "text-left transition-colors cursor-pointer",
          "hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        )}
      >
        {/* Icon with animation */}
        <div className="relative">
          <div className={cn(
            "p-2 rounded-xl",
            "bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20",
            "border border-violet-500/30"
          )}>
            <Brain className={cn(
              "w-4 h-4 text-violet-400",
              isStreaming && "animate-pulse"
            )} />
          </div>
          {isStreaming && (
            <motion.div
              className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-violet-400"
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-violet-300">
              {isStreaming ? "Kairos está pensando..." : "Pensamento de Kairos"}
            </span>
            {isStreaming && (
              <motion.div
                className="flex gap-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-violet-400"
                    animate={{ y: [0, -4, 0] }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.15
                    }}
                  />
                ))}
              </motion.div>
            )}
          </div>
          <p className="text-xs text-violet-400/60 truncate">
            {content.length > 50 ? content.slice(0, 50) + "..." : content || "Analisando sua mensagem..."}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowContent(!showContent);
            }}
            className="p-1.5 rounded-lg hover:bg-white/10 text-violet-400/60 hover:text-violet-300 transition-colors"
            title={showContent ? "Ocultar conteúdo" : "Mostrar conteúdo"}
          >
            {showContent ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <div className="text-violet-400/50">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </div>
      </div>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && showContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <div
                ref={contentRef}
                className={cn(
                  "relative max-h-40 overflow-y-auto",
                  "rounded-xl p-3",
                  "bg-black/20 border border-violet-500/10",
                  "scrollbar-thin scrollbar-thumb-violet-500/20 scrollbar-track-transparent"
                )}
              >
                {/* Sparkle decoration */}
                <Sparkles className="absolute top-2 right-2 w-3 h-3 text-violet-500/30" />
                
                {/* Content with typing effect */}
                <p className={cn(
                  "text-sm leading-relaxed text-violet-200/80",
                  "whitespace-pre-wrap font-light"
                )}>
                  {content || "..."}
                  {/* Blinking cursor */}
                  {isStreaming && (
                    <motion.span
                      className="inline-block w-0.5 h-4 ml-0.5 bg-violet-400 rounded-full align-middle"
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  )}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * KairosStatusIndicator - Compact status indicator for agent status
 * Shows humanized messages with subtle animation
 */
interface KairosStatusIndicatorProps {
  status: string | null;
  className?: string;
}

export function KairosStatusIndicator({ status, className }: KairosStatusIndicatorProps) {
  if (!status) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full",
        "bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10",
        "border border-violet-500/20",
        "text-sm text-violet-300",
        className
      )}
    >
      <motion.div
        className="w-2 h-2 rounded-full bg-violet-400"
        animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
      <span className="font-light">{status}</span>
    </motion.div>
  );
}

export default KairosThinkingCard;

