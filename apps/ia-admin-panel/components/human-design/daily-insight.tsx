"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RefreshCw, Loader2, Wand2 } from "lucide-react";
import { cn } from "@/lib/ui/cn";

interface DailyInsightProps {
  tipo?: string | null;
  className?: string;
}

interface InsightData {
  insight: string;
  type: string;
  strategy: string;
  authority: string;
  generatedAt: string;
  cacheUntil: string;
}

const STORAGE_KEY = "kairos_daily_insight";

/**
 * DailyInsight Component
 * 
 * Generates and displays a personalized AI insight on the dashboard.
 * Following Jobsian philosophy: one clear message, emotional impact, 
 * and progressive disclosure through subtle animations.
 */
export function DailyInsight({ tipo, className }: DailyInsightProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load cached insight on mount
  useEffect(() => {
    const cached = getCachedInsight();
    if (cached && !isExpired(cached.cacheUntil)) {
      setInsight(cached.insight);
    } else {
      // Generate new insight
      generateInsight();
    }
  }, []);

  // Get cached insight from localStorage
  const getCachedInsight = useCallback((): InsightData | null => {
    if (typeof window === "undefined") return null;
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Ignore parsing errors
    }
    return null;
  }, []);

  // Check if cache is expired
  const isExpired = useCallback((cacheUntil: string): boolean => {
    return new Date(cacheUntil) < new Date();
  }, []);

  // Cache insight in localStorage
  const cacheInsight = useCallback((data: InsightData) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Generate new insight via streaming API
  const generateInsight = useCallback(async () => {
    setLoading(true);
    setStreaming(true);
    setError(null);
    setInsight("");

    try {
      const response = await fetch("/api/kairos/insight", {
        method: "GET",
        credentials: "include"
      });

      if (!response.ok) {
        if (response.status === 404) {
          setError("Complete seu onboarding primeiro");
          return;
        }
        throw new Error("Failed to generate insight");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let fullInsight = "";
      let insightData: Partial<InsightData> = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.text) {
                fullInsight += data.text;
                setInsight(fullInsight);
              }
              
              if (data.done) {
                insightData = {
                  insight: fullInsight,
                  type: data.type,
                  strategy: data.strategy,
                  authority: data.authority,
                  generatedAt: new Date().toISOString(),
                  cacheUntil: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
                };
              }

              if (data.error) {
                throw new Error(data.error);
              }
            } catch (e) {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      }

      // Cache the complete insight
      if (insightData.insight) {
        cacheInsight(insightData as InsightData);
      }

    } catch (err) {
      console.error("[DailyInsight] Error:", err);
      setError("Não foi possível gerar seu insight");
      setInsight(null);
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }, [cacheInsight]);

  // Refresh insight (with manual trigger)
  const refreshInsight = useCallback(() => {
    // Clear cache
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    generateInsight();
  }, [generateInsight]);

  // Get accent color based on tipo
  const getAccentColor = (tipo?: string | null): string => {
    const colorMap: Record<string, string> = {
      manifestor: "text-indigo-400",
      generator: "text-amber-400",
      "manifesting generator": "text-fuchsia-400",
      projector: "text-emerald-400",
      projetor: "text-emerald-400",
      reflector: "text-slate-300",
      refletor: "text-slate-300"
    };
    return colorMap[tipo?.toLowerCase() || ""] || "text-white/70";
  };

  // Get background glow
  const getGlowClass = (tipo?: string | null): string => {
    const glowMap: Record<string, string> = {
      manifestor: "shadow-indigo-500/10",
      generator: "shadow-amber-500/10",
      "manifesting generator": "shadow-fuchsia-500/10",
      projector: "shadow-emerald-500/10",
      projetor: "shadow-emerald-500/10",
      reflector: "shadow-slate-400/10",
      refletor: "shadow-slate-400/10"
    };
    return glowMap[tipo?.toLowerCase() || ""] || "shadow-white/5";
  };

  const accentColor = getAccentColor(tipo);
  const glowClass = getGlowClass(tipo);

  // Don't render if no tipo (profile not complete)
  if (!tipo) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative overflow-hidden rounded-xl",
        "bg-gradient-to-br from-white/[0.04] to-transparent",
        "border border-white/[0.06]",
        "shadow-xl",
        glowClass,
        className
      )}
    >
      {/* Subtle animated background */}
      <div className="absolute inset-0 opacity-30">
        <motion.div
          animate={{
            background: [
              "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.03) 0%, transparent 50%)",
              "radial-gradient(circle at 80% 50%, rgba(255,255,255,0.03) 0%, transparent 50%)",
              "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.03) 0%, transparent 50%)"
            ]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0"
        />
      </div>

      <div className="relative px-5 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <motion.div
              animate={streaming ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 2, repeat: streaming ? Infinity : 0, ease: "linear" }}
            >
              <Wand2 className={cn("w-4 h-4", accentColor)} />
            </motion.div>
            <span className="text-xs uppercase tracking-[0.2em] text-white/40 font-medium">
              Insight do dia
            </span>
          </div>

          {/* Refresh button */}
          <motion.button
            onClick={refreshInsight}
            disabled={loading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "p-1.5 rounded-lg",
              "bg-white/5 hover:bg-white/10",
              "border border-white/5 hover:border-white/10",
              "transition-colors duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            title="Gerar novo insight"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 text-white/40 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-white/40" />
            )}
          </motion.button>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {error ? (
            <motion.p
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm text-red-400/70"
            >
              {error}
            </motion.p>
          ) : loading && !insight ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3"
            >
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.2
                    }}
                    className="w-1.5 h-1.5 rounded-full bg-white/30"
                  />
                ))}
              </div>
              <span className="text-sm text-white/40">Conectando com seu design...</span>
            </motion.div>
          ) : insight ? (
            <motion.div
              key="insight"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="space-y-2"
            >
              <div className="flex items-start gap-3">
                <Sparkles className={cn("w-4 h-4 flex-shrink-0 mt-1", accentColor, "opacity-60")} />
                <p className="text-sm text-white/70 leading-relaxed">
                  {insight}
                  {streaming && (
                    <motion.span
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="inline-block ml-0.5 w-0.5 h-4 bg-white/50 align-middle"
                    />
                  )}
                </p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

