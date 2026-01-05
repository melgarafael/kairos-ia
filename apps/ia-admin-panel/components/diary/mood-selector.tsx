"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/ui/cn";
import {
  Sun,
  Zap,
  Scale,
  CloudMoon,
  Battery,
  CloudRain,
  type LucideIcon,
} from "lucide-react";

export type MoodValue =
  | "radiante"
  | "energizado"
  | "equilibrado"
  | "reflexivo"
  | "cansado"
  | "sobrecarregado";

interface MoodOption {
  value: MoodValue;
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
}

const MOOD_OPTIONS: MoodOption[] = [
  {
    value: "radiante",
    label: "Radiante",
    icon: Sun,
    color: "text-amber-300",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    glowColor: "shadow-amber-500/20",
  },
  {
    value: "energizado",
    label: "Energizado",
    icon: Zap,
    color: "text-emerald-300",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    glowColor: "shadow-emerald-500/20",
  },
  {
    value: "equilibrado",
    label: "Equilibrado",
    icon: Scale,
    color: "text-sky-300",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/30",
    glowColor: "shadow-sky-500/20",
  },
  {
    value: "reflexivo",
    label: "Reflexivo",
    icon: CloudMoon,
    color: "text-violet-300",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/30",
    glowColor: "shadow-violet-500/20",
  },
  {
    value: "cansado",
    label: "Cansado",
    icon: Battery,
    color: "text-orange-300",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    glowColor: "shadow-orange-500/20",
  },
  {
    value: "sobrecarregado",
    label: "Sobrecarga",
    icon: CloudRain,
    color: "text-slate-300",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/30",
    glowColor: "shadow-slate-500/20",
  },
];

interface MoodSelectorProps {
  value?: MoodValue | string | null;
  onChange?: (value: MoodValue) => void;
  name?: string;
}

export function MoodSelector({ value, onChange, name }: MoodSelectorProps) {
  const [selected, setSelected] = useState<MoodValue | null>(
    (value as MoodValue) || null
  );

  const handleSelect = (mood: MoodValue) => {
    setSelected(mood);
    onChange?.(mood);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-[0.15em] text-white/60">
        Como você está agora?
      </p>

      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={selected || ""} />

      {/* Grid: 2 rows on mobile, 1 row on desktop */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-2.5">
        {MOOD_OPTIONS.map((mood, index) => {
          const isSelected = selected === mood.value;
          const Icon = mood.icon;

          return (
            <motion.button
              key={mood.value}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.3 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleSelect(mood.value)}
              className={cn(
                "group relative flex flex-col items-center justify-center",
                "gap-1.5 py-3 px-2 rounded-xl",
                "border transition-all duration-200",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                "min-h-[72px]",
                isSelected
                  ? cn(mood.bgColor, mood.borderColor, "shadow-lg", mood.glowColor)
                  : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10"
              )}
            >
              {/* Selection ring */}
              {isSelected && (
                <motion.div
                  layoutId="mood-ring"
                  className="absolute inset-0 rounded-xl border-2 border-white/20"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}

              <motion.div
                animate={{ scale: isSelected ? 1.1 : 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="relative z-10"
              >
                <Icon
                  className={cn(
                    "w-5 h-5 transition-colors",
                    isSelected ? mood.color : "text-white/40 group-hover:text-white/60"
                  )}
                />
              </motion.div>

              <span
                className={cn(
                  "relative z-10 text-[11px] font-medium transition-colors text-center leading-tight",
                  isSelected ? "text-white/90" : "text-white/40 group-hover:text-white/60"
                )}
              >
                {mood.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// Export para uso na timeline também
export { MOOD_OPTIONS };
export function getMoodMeta(value?: string | null) {
  if (!value) return null;
  return MOOD_OPTIONS.find((m) => m.value === value.toLowerCase()) || null;
}
