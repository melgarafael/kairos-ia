"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/ui/cn";
import { Sun, Moon, Sunrise, Sunset } from "lucide-react";

interface BirthTimePickerProps {
  value: string; // HH:mm
  onChange: (value: string) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
// Human Design requires minute precision (00-59) - each minute matters for accurate calculations
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function getTimeOfDay(hour: number): {
  label: string;
  icon: typeof Sun;
  gradient: string;
} {
  if (hour >= 5 && hour < 12) {
    return {
      label: "Manhã",
      icon: Sunrise,
      gradient: "from-amber-500/20 to-orange-500/20",
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      label: "Tarde",
      icon: Sun,
      gradient: "from-yellow-500/20 to-amber-500/20",
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      label: "Anoitecer",
      icon: Sunset,
      gradient: "from-orange-500/20 to-rose-500/20",
    };
  } else {
    return {
      label: "Noite",
      icon: Moon,
      gradient: "from-indigo-500/20 to-violet-500/20",
    };
  }
}

export function BirthTimePicker({ value, onChange }: BirthTimePickerProps) {
  const parseTime = useCallback((timeStr: string) => {
    if (!timeStr) return { hour: 12, minute: 0 };
    const [h, m] = timeStr.split(":").map(Number);
    return { hour: h || 12, minute: m || 0 };
  }, []);

  const initial = parseTime(value);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);

  const timeOfDay = getTimeOfDay(hour);
  const TimeIcon = timeOfDay.icon;

  useEffect(() => {
    const formatted = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    onChange(formatted);
  }, [hour, minute, onChange]);

  return (
    <div className="space-y-6">
      {/* Visual time indicator */}
      <motion.div
        layout
        className={cn(
          "relative p-6 rounded-2xl border border-white/10 overflow-hidden",
          "bg-gradient-to-br",
          timeOfDay.gradient
        )}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
        </div>

        <div className="relative flex items-center justify-center gap-8">
          {/* Time icon */}
          <motion.div
            key={timeOfDay.label}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <TimeIcon className="w-12 h-12 text-white/60" />
          </motion.div>

          {/* Large time display */}
          <div className="text-center">
            <div className="text-5xl font-light tracking-wider text-white tabular-nums">
              {String(hour).padStart(2, "0")}
              <span className="animate-pulse mx-1">:</span>
              {String(minute).padStart(2, "0")}
            </div>
            <motion.p
              key={timeOfDay.label}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-white/50 mt-1"
            >
              {timeOfDay.label}
            </motion.p>
          </div>
        </div>
      </motion.div>

      {/* Time selectors */}
      <div className="grid grid-cols-2 gap-4">
        {/* Hour selector */}
        <div className="space-y-3">
          <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
            Hora
          </label>
          <div className="grid grid-cols-6 gap-1">
            {HOURS.map((h) => (
              <button
                key={h}
                onClick={() => setHour(h)}
                className={cn(
                  "h-10 rounded-lg text-sm font-medium transition-all",
                  hour === h
                    ? "bg-violet-500 text-white shadow-lg shadow-violet-500/30"
                    : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200"
                )}
              >
                {String(h).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>

        {/* Minute selector - full precision for Human Design accuracy */}
        <div className="space-y-3">
          <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
            Minuto
          </label>
          <div className="max-h-[200px] overflow-y-auto rounded-xl bg-zinc-800/30 p-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            <div className="grid grid-cols-10 gap-1">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  onClick={() => setMinute(m)}
                  className={cn(
                    "h-8 rounded-md text-xs font-medium transition-all",
                    minute === m
                      ? "bg-violet-500 text-white shadow-lg shadow-violet-500/30"
                      : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200"
                  )}
                >
                  {String(m).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Helpful hint */}
      <p className="text-xs text-zinc-500 text-center">
        Se não souber a hora exata, 12:00 é um bom ponto de partida
      </p>
    </div>
  );
}

