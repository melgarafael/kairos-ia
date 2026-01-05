"use client";

import { motion } from "framer-motion";
import { Sparkles, Calendar, Flame } from "lucide-react";
import { cn } from "@/lib/ui/cn";

interface DiaryHeroProps {
  userName?: string;
  tipo?: string | null;
  streakDays?: number;
  totalEntries?: number;
}

// Gradient classes por tipo HD
const gradientMap: Record<string, string> = {
  manifestor: "from-indigo-950/60 via-indigo-900/30 to-transparent",
  generator: "from-amber-950/60 via-amber-900/30 to-transparent",
  "manifesting generator": "from-fuchsia-950/60 via-fuchsia-900/30 to-transparent",
  projector: "from-emerald-950/60 via-emerald-900/30 to-transparent",
  reflector: "from-slate-900/60 via-slate-800/30 to-transparent",
};

// Glow color por tipo
const glowMap: Record<string, string> = {
  manifestor: "shadow-indigo-500/10",
  generator: "shadow-amber-500/10",
  "manifesting generator": "shadow-fuchsia-500/10",
  projector: "shadow-emerald-500/10",
  reflector: "shadow-slate-400/10",
};

// Frases inspiradoras baseadas no momento do dia
const MORNING_PROMPTS = [
  "Como você está começando este dia?",
  "O que seu corpo está te dizendo agora?",
  "Qual energia você traz para esta manhã?",
  "Como está seu coração ao acordar?",
];

const AFTERNOON_PROMPTS = [
  "Como você está se sentindo agora?",
  "O que mudou desde a manhã?",
  "Como está sua energia neste momento?",
  "O que seu corpo precisa agora?",
];

const EVENING_PROMPTS = [
  "Como foi seu dia até aqui?",
  "O que você aprendeu sobre si hoje?",
  "Como está encerrando este dia?",
  "O que precisa ser reconhecido?",
];

export function DiaryHero({ userName, tipo, streakDays = 0, totalEntries = 0 }: DiaryHeroProps) {
  const normalized = tipo?.toLowerCase().trim() || "";
  const gradient = gradientMap[normalized] || "from-violet-950/60 via-violet-900/30 to-transparent";
  const glow = glowMap[normalized] || "shadow-violet-500/10";

  // Saudação e prompt baseados na hora do dia
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  
  // Seleciona prompt baseado no período do dia
  const prompts = hour < 12 ? MORNING_PROMPTS : hour < 18 ? AFTERNOON_PROMPTS : EVENING_PROMPTS;
  const minuteOfDay = hour * 60 + new Date().getMinutes();
  const dailyPrompt = prompts[Math.floor(minuteOfDay / 30) % prompts.length];

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
      <div className="absolute inset-0 opacity-[0.02]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Subtle glow orb */}
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/[0.02] blur-3xl" />

      <div className="relative px-6 py-8 md:px-8 md:py-10">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between mb-6"
        >
          <p className="text-sm text-white/50">
            {greeting}{userName ? `, ${userName}` : ""}
          </p>

          {/* Streak badge */}
          {streakDays > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
                "bg-white/5 border border-white/10",
                "shadow-lg",
                glow
              )}
            >
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-white/80">
                {streakDays} {streakDays === 1 ? "dia" : "dias"}
              </span>
            </motion.div>
          )}
        </motion.div>

        {/* Main prompt */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className={cn(
                "flex items-center justify-center w-12 h-12 rounded-xl",
                "bg-white/5 backdrop-blur-sm border border-white/10",
                "shadow-xl",
                glow
              )}
            >
              <Sparkles className="w-6 h-6 text-white/60" />
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-white/40">
                Diário de Alinhamento
              </p>
              <p className="text-[10px] text-white/30">
                {totalEntries} {totalEntries === 1 ? "registro" : "registros"} salvos
              </p>
            </div>
          </div>

          <h1 className="text-2xl md:text-3xl font-semibold text-white/90 leading-tight">
            {dailyPrompt}
          </h1>

          <p className="text-base text-white/50 leading-relaxed max-w-lg">
            Registre como você se sente ao longo do dia. Suas sensações mudam — 
            e está tudo bem fazer vários check-ins para acompanhar essa jornada.
          </p>
        </motion.div>

        {/* Date indicator */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5"
        >
          <Calendar className="w-3.5 h-3.5 text-white/40" />
          <span className="text-xs text-white/50">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </span>
        </motion.div>
      </div>
    </motion.section>
  );
}

