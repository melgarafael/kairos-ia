"use client";

/**
 * MorningCard — O primeiro "uau" do dia
 * 
 * Filosofia Jobs:
 * - Primeiros 10 segundos: mensagem única, generosa em espaço
 * - Ação primária inequívoca (1 CTA por view)
 * - Microinterações suaves com significado
 * 
 * Human Design:
 * - Cada tipo acorda de forma diferente
 * - Estratégia é o que importa de manhã
 * - Dashboard como "acordar digital"
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { Button } from "@/components/ui/button";
import { resolveTypeMeta } from "@/components/human-design/type-meta";
import { getMorningMessage, getPersonalGreeting } from "./morning-messages";

interface MorningCardProps {
  tipo?: string | null;
  userName?: string | null;
  className?: string;
}

// Gradients sutis por tipo — atmosféricos, não saturados
const TYPE_GRADIENTS: Record<string, string> = {
  manifestor: "from-indigo-950/40 via-indigo-900/20 to-transparent",
  generator: "from-amber-950/40 via-amber-900/20 to-transparent",
  "manifesting generator": "from-fuchsia-950/40 via-fuchsia-900/20 to-transparent",
  projector: "from-emerald-950/40 via-emerald-900/20 to-transparent",
  reflector: "from-violet-950/40 via-violet-900/20 to-transparent",
};

// Glow sutil por tipo
const TYPE_GLOWS: Record<string, string> = {
  manifestor: "shadow-indigo-500/5",
  generator: "shadow-amber-500/5",
  "manifesting generator": "shadow-fuchsia-500/5",
  projector: "shadow-emerald-500/5",
  reflector: "shadow-violet-500/5",
};

export function MorningCard({ tipo, userName, className }: MorningCardProps) {
  const meta = resolveTypeMeta(tipo);
  const message = getMorningMessage(tipo);
  const greeting = getPersonalGreeting(userName);
  const Icon = meta.icon;

  const normalized = tipo?.toLowerCase().trim() || "";
  const gradient = TYPE_GRADIENTS[normalized] || "from-zinc-900/40 via-zinc-800/20 to-transparent";
  const glow = TYPE_GLOWS[normalized] || "shadow-zinc-500/5";

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative overflow-hidden rounded-3xl",
        "border border-white/[0.06]",
        "bg-gradient-to-br",
        gradient,
        className
      )}
    >
      {/* Atmospheric pattern — Jobs: "detalhes invisíveis" */}
      <div className="absolute inset-0 opacity-[0.015]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* Subtle glow orb */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/[0.01] blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full bg-white/[0.008] blur-3xl" />

      <div className="relative px-6 py-10 md:px-10 md:py-14 lg:py-16">
        {/* Header: Greeting + Time */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex items-center justify-between mb-8 md:mb-10"
        >
          <p className="text-sm text-white/40 font-medium tracking-wide">
            {greeting}
          </p>
          
          <motion.time
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xs text-white/30 tabular-nums"
          >
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}
          </motion.time>
        </motion.div>

        {/* Type Icon + Greeting Line */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="flex items-start gap-5 mb-8"
        >
          <div
            className={cn(
              "flex-shrink-0 flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-2xl",
              "bg-white/[0.04] backdrop-blur-xl border border-white/[0.08]",
              "shadow-2xl",
              glow
            )}
          >
            <Icon className={cn("w-7 h-7 md:w-8 md:h-8", meta.accentClass)} />
          </div>

          <div className="min-w-0 flex-1">
            <p className={cn(
              "text-xs uppercase tracking-[0.2em] mb-1.5",
              meta.accentClass,
              "opacity-70"
            )}>
              {meta.label}
            </p>
            <p className="text-lg md:text-xl text-white/60 font-medium leading-snug">
              {message.greeting}
            </p>
          </div>
        </motion.div>

        {/* Main Question — O "uau" */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] font-semibold text-white/95 leading-[1.15] tracking-tight mb-6"
        >
          {message.question}
        </motion.h1>

        {/* Guidance — Estratégia sutil */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="flex items-start gap-3 mb-10 max-w-xl"
        >
          <Sparkles className="w-4 h-4 text-white/20 flex-shrink-0 mt-1" />
          <p className="text-sm md:text-base text-white/40 leading-relaxed">
            {message.guidance}
          </p>
        </motion.div>

        {/* Actions — Jobs: "1 CTA inequívoco" */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <Button
            asChild
            size="lg"
            className={cn(
              "group relative overflow-hidden",
              "h-12 px-6 rounded-xl",
              "bg-white/10 hover:bg-white/15 text-white",
              "border border-white/10 hover:border-white/20",
              "shadow-lg shadow-black/10",
              "transition-all duration-300 ease-out"
            )}
          >
            <Link href={message.action.href}>
              <span className="relative z-10 font-medium">
                {message.action.label}
              </span>
              <ArrowRight className="relative z-10 w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </Button>

          {message.secondaryAction && (
            <Button
              asChild
              variant="ghost"
              size="lg"
              className={cn(
                "h-12 px-6 rounded-xl",
                "text-white/50 hover:text-white/80 hover:bg-white/5",
                "transition-all duration-300"
              )}
            >
              <Link href={message.secondaryAction.href}>
                {message.secondaryAction.label}
              </Link>
            </Button>
          )}
        </motion.div>
      </div>
    </motion.section>
  );
}

