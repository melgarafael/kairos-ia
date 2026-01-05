"use client";

/**
 * QuickActions — Ações rápidas contextuais
 * 
 * Filosofia Jobs:
 * - Zero dead-ends; sempre há próximo passo claro
 * - Microinterações com significado
 * - Linguagem curta, humana, sem "configurês"
 * 
 * Human Design:
 * - Ações alinhadas com a Estratégia do tipo
 * - Autoridade influencia como decidir
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { 
  MessageCircle, 
  BookOpen, 
  Sparkles, 
  User,
  Calendar,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { resolveTypeMeta } from "@/components/human-design/type-meta";

interface QuickActionsProps {
  tipo?: string | null;
  hasRecentLog?: boolean;
  className?: string;
}

interface QuickAction {
  id: string;
  icon: typeof MessageCircle;
  label: string;
  description: string;
  href: string;
}

// Ações base disponíveis para todos
const BASE_ACTIONS: QuickAction[] = [
  {
    id: "mentora",
    icon: MessageCircle,
    label: "Mentora Kairos",
    description: "Conversa guiada por seu design",
    href: "/ia",
  },
  {
    id: "diario",
    icon: BookOpen,
    label: "Diário",
    description: "Registre seu dia",
    href: "/diario",
  },
  {
    id: "design",
    icon: User,
    label: "Meu Design",
    description: "Explore seu mapa",
    href: "/meu-design",
  },
];

// Ações prioritárias por tipo (ordem de exibição)
const TYPE_ACTION_ORDER: Record<string, string[]> = {
  generator: ["diario", "mentora", "design"],
  "manifesting generator": ["diario", "mentora", "design"],
  projector: ["mentora", "diario", "design"],
  manifestor: ["diario", "mentora", "design"],
  reflector: ["mentora", "diario", "design"],
};

function getOrderedActions(tipo?: string | null): QuickAction[] {
  const normalized = tipo?.toLowerCase().trim() || "";
  const order = TYPE_ACTION_ORDER[normalized] || ["mentora", "diario", "design"];
  
  return order
    .map(id => BASE_ACTIONS.find(a => a.id === id))
    .filter((a): a is QuickAction => a !== undefined);
}

export function QuickActions({ tipo, hasRecentLog = false, className }: QuickActionsProps) {
  const meta = resolveTypeMeta(tipo);
  const actions = getOrderedActions(tipo);
  const normalized = tipo?.toLowerCase().trim() || "";

  // Container animation
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  };

  // Item animation
  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  // Accent colors sutis por tipo
  const accentBorders: Record<string, string> = {
    manifestor: "hover:border-indigo-500/20",
    generator: "hover:border-amber-500/20",
    "manifesting generator": "hover:border-fuchsia-500/20",
    projector: "hover:border-emerald-500/20",
    reflector: "hover:border-violet-500/20",
  };

  const accentBorder = accentBorders[normalized] || "hover:border-white/15";

  return (
    <motion.section
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className={cn("space-y-4", className)}
    >
      {/* Section header */}
      <motion.div
        variants={itemVariants}
        className="flex items-center justify-between"
      >
        <h2 className="text-sm font-medium text-white/40 uppercase tracking-[0.15em]">
          Ações Rápidas
        </h2>
      </motion.div>

      {/* Actions grid — Mobile: stack, Desktop: 3 cols */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {actions.map((action, index) => {
          const Icon = action.icon;
          const isFirst = index === 0;
          
          return (
            <motion.div
              key={action.id}
              variants={itemVariants}
            >
              <Link
                href={action.href}
                className={cn(
                  "group flex items-center gap-4 p-4 rounded-2xl",
                  "bg-white/[0.02] border border-white/[0.06]",
                  "hover:bg-white/[0.04]",
                  accentBorder,
                  "transition-all duration-300 ease-out",
                  // Primeiro item é destacado em mobile
                  isFirst && "sm:col-span-1"
                )}
              >
                <div
                  className={cn(
                    "flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl",
                    "bg-white/[0.04] border border-white/[0.06]",
                    "group-hover:bg-white/[0.06] group-hover:border-white/[0.1]",
                    "transition-all duration-300"
                  )}
                >
                  <Icon className={cn(
                    "w-5 h-5",
                    isFirst ? meta.accentClass : "text-white/50",
                    "group-hover:text-white/80 transition-colors duration-300"
                  )} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium text-white/80",
                    "group-hover:text-white transition-colors duration-300"
                  )}>
                    {action.label}
                  </p>
                  <p className="text-xs text-white/35 truncate">
                    {action.description}
                  </p>
                </div>

                <ChevronRight className={cn(
                  "w-4 h-4 text-white/20",
                  "group-hover:text-white/40 group-hover:translate-x-0.5",
                  "transition-all duration-300"
                )} />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}

