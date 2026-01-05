"use client";

/**
 * StrategyReminder — Lembrete sutil da estratégia
 * 
 * Filosofia Jobs:
 * - Detalhes são o produto
 * - Estados vazios que ensinam
 * - Opiniado por padrão
 * 
 * Human Design:
 * - Estratégia + Autoridade = núcleo do experimento
 * - A mente tenta controlar, o corpo sabe
 * - 90% do valor está em viver isso
 */

import { motion } from "framer-motion";
import { Compass, Clock, Sparkles, Moon, Heart } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { resolveTypeMeta } from "@/components/human-design/type-meta";

interface StrategyReminderProps {
  tipo?: string | null;
  estrategia?: string | null;
  autoridade?: string | null;
  className?: string;
}

type TypeKey = "manifestor" | "generator" | "manifesting generator" | "projector" | "reflector";

// Estratégias oficiais por tipo
const STRATEGIES: Record<TypeKey, { label: string; short: string; icon: typeof Compass }> = {
  manifestor: {
    label: "Informar antes de agir",
    short: "Informe",
    icon: Compass,
  },
  generator: {
    label: "Responder à vida",
    short: "Responda",
    icon: Heart,
  },
  "manifesting generator": {
    label: "Responder, informar e pivotar",
    short: "Responda",
    icon: Sparkles,
  },
  projector: {
    label: "Esperar pelo convite",
    short: "Espere",
    icon: Clock,
  },
  reflector: {
    label: "Esperar o ciclo lunar",
    short: "Sinta",
    icon: Moon,
  },
};

// Autoridades simplificadas
const AUTHORITIES: Record<string, string> = {
  "emocional": "Espere a onda emocional passar",
  "emotional": "Espere a onda emocional passar",
  "sacral": "Confie na resposta do corpo",
  "splenic": "Siga a intuição instantânea",
  "spleen": "Siga a intuição instantânea",
  "esplênica": "Siga a intuição instantânea",
  "ego": "O que você realmente quer?",
  "heart": "O que você realmente quer?",
  "coração": "O que você realmente quer?",
  "self": "O que é certo para você?",
  "g center": "O que é certo para você?",
  "identidade": "O que é certo para você?",
  "mental": "Fale com pessoas corretas",
  "ambiental": "Fale com pessoas corretas",
  "lunar": "Espere o ciclo completo",
  "none": "Observe o ambiente",
};

function normalizeType(rawType?: string | null): TypeKey | null {
  if (!rawType) return null;
  const v = rawType.toLowerCase().trim();
  if (v === "mg" || v === "manifesting generator") return "manifesting generator";
  if (v === "generator") return "generator";
  if (v === "manifestor") return "manifestor";
  if (v === "projector") return "projector";
  if (v === "reflector") return "reflector";
  return null;
}

function getAuthorityTip(rawAuthority?: string | null): string {
  if (!rawAuthority) return "Observe antes de decidir";
  const normalized = rawAuthority.toLowerCase().trim();
  
  for (const [key, tip] of Object.entries(AUTHORITIES)) {
    if (normalized.includes(key)) return tip;
  }
  
  return "Observe antes de decidir";
}

export function StrategyReminder({ tipo, estrategia, autoridade, className }: StrategyReminderProps) {
  const typeKey = normalizeType(tipo);
  const meta = resolveTypeMeta(tipo);
  
  if (!typeKey) return null;

  const strategy = STRATEGIES[typeKey];
  const authorityTip = getAuthorityTip(autoridade);
  const Icon = strategy.icon;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-white/[0.02] border border-white/[0.06]",
        "p-5",
        className
      )}
    >
      {/* Background accent */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-white/[0.02] to-transparent rounded-full blur-2xl" />
      </div>

      <div className="relative space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center w-9 h-9 rounded-xl",
            "bg-white/[0.04] border border-white/[0.08]"
          )}>
            <Icon className={cn("w-4 h-4", meta.accentClass, "opacity-80")} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/30">
              Sua Estratégia
            </p>
            <p className={cn("text-sm font-medium", meta.accentClass)}>
              {strategy.label}
            </p>
          </div>
        </div>

        {/* Authority tip */}
        <div className="pl-12">
          <p className="text-xs text-white/40 leading-relaxed">
            <span className="text-white/25">Autoridade:</span>{" "}
            {authorityTip}
          </p>
        </div>

        {/* Subtle reminder */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="pt-2 border-t border-white/[0.04]"
        >
          <p className="text-[11px] text-white/25 italic">
            A mente opina. O corpo sabe.
          </p>
        </motion.div>
      </div>
    </motion.section>
  );
}

