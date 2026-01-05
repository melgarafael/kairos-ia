"use client";

import { motion } from "framer-motion";
import { Sparkles, Calendar } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { resolveTypeMeta } from "./type-meta";
import { getTypeTagline } from "./type-taglines";

interface HumanDesignHeroProps {
  tipo?: string | null;
  birthDate?: string;
  userName?: string;
}

export function HumanDesignHero({ tipo, birthDate, userName }: HumanDesignHeroProps) {
  const meta = resolveTypeMeta(tipo);
  const tagline = getTypeTagline(tipo);
  const Icon = meta.icon;

  // Gradient classes por tipo
  const gradientMap: Record<string, string> = {
    manifestor: "from-indigo-950/80 via-indigo-900/40 to-transparent",
    generator: "from-amber-950/80 via-amber-900/40 to-transparent",
    "manifesting generator": "from-fuchsia-950/80 via-fuchsia-900/40 to-transparent",
    projector: "from-emerald-950/80 via-emerald-900/40 to-transparent",
    reflector: "from-slate-900/80 via-slate-800/40 to-transparent",
  };

  const normalized = tipo?.toLowerCase().trim() || "";
  const gradient = gradientMap[normalized] || "from-zinc-900/80 via-zinc-800/40 to-transparent";

  // Glow color por tipo
  const glowMap: Record<string, string> = {
    manifestor: "shadow-indigo-500/20",
    generator: "shadow-amber-500/20",
    "manifesting generator": "shadow-fuchsia-500/20",
    projector: "shadow-emerald-500/20",
    reflector: "shadow-slate-400/20",
  };
  const glow = glowMap[normalized] || "shadow-zinc-500/20";

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/5",
        "bg-gradient-to-br",
        gradient
      )}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }} />
      </div>

      <div className="relative px-6 py-10 md:px-10 md:py-14">
        {/* Greeting */}
        {userName && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-white/50 mb-2"
          >
            Olá, {userName}
          </motion.p>
        )}

        {/* Icon + Type */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="flex items-center gap-4 mb-6"
        >
          <div
            className={cn(
              "flex items-center justify-center w-16 h-16 rounded-2xl",
              "bg-white/5 backdrop-blur-sm border border-white/10",
              "shadow-2xl",
              glow
            )}
          >
            <Icon className={cn("w-8 h-8", meta.accentClass)} />
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-white/40 mb-1">
              Seu Tipo
            </p>
            <h1 className={cn("text-3xl md:text-4xl font-semibold tracking-tight", meta.accentClass)}>
              {meta.label}
            </h1>
          </div>
        </motion.div>

        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3 max-w-xl"
        >
          <h2 className="text-xl md:text-2xl font-medium text-white/90">
            {tagline.headline}
          </h2>
          <p className="text-base text-white/60 leading-relaxed">
            {tagline.subline}
          </p>
        </motion.div>

        {/* Essence quote */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/5 max-w-xl"
        >
          <Sparkles className="w-5 h-5 text-white/30 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-white/50 italic leading-relaxed">
            {tagline.essence}
          </p>
        </motion.div>

        {/* Birth date badge */}
        {birthDate && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10"
          >
            <Calendar className="w-4 h-4 text-white/40" />
            <span className="text-sm text-white/60">{birthDate}</span>
          </motion.div>
        )}
      </div>
    </motion.section>
  );
}

