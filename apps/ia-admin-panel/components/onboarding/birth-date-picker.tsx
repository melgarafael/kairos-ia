"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/ui/cn";

interface BirthDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
}

const MONTHS = [
  { value: 1, label: "Janeiro", short: "Jan" },
  { value: 2, label: "Fevereiro", short: "Fev" },
  { value: 3, label: "Março", short: "Mar" },
  { value: 4, label: "Abril", short: "Abr" },
  { value: 5, label: "Maio", short: "Mai" },
  { value: 6, label: "Junho", short: "Jun" },
  { value: 7, label: "Julho", short: "Jul" },
  { value: 8, label: "Agosto", short: "Ago" },
  { value: 9, label: "Setembro", short: "Set" },
  { value: 10, label: "Outubro", short: "Out" },
  { value: 11, label: "Novembro", short: "Nov" },
  { value: 12, label: "Dezembro", short: "Dez" },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => currentYear - i);

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

export function BirthDatePicker({ value, onChange }: BirthDatePickerProps) {
  // Parse initial value
  const parseDate = useCallback((dateStr: string) => {
    if (!dateStr) {
      return { day: 15, month: 6, year: 1990 };
    }
    const [y, m, d] = dateStr.split("-").map(Number);
    return { day: d || 15, month: m || 6, year: y || 1990 };
  }, []);

  const initialDate = parseDate(value);
  const [day, setDay] = useState(initialDate.day);
  const [month, setMonth] = useState(initialDate.month);
  const [year, setYear] = useState(initialDate.year);

  const daysInCurrentMonth = getDaysInMonth(month, year);
  const DAYS = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);

  // Update parent when values change
  useEffect(() => {
    const adjustedDay = Math.min(day, daysInCurrentMonth);
    if (adjustedDay !== day) {
      setDay(adjustedDay);
    }
    const formatted = `${year}-${String(month).padStart(2, "0")}-${String(adjustedDay).padStart(2, "0")}`;
    onChange(formatted);
  }, [day, month, year, daysInCurrentMonth, onChange]);

  return (
    <div className="relative">
      {/* Elegant container */}
      <div className="relative bg-gradient-to-b from-zinc-900/80 to-zinc-900/60 rounded-2xl border border-white/10 overflow-hidden backdrop-blur-sm">
        {/* Selection indicator - the highlighted band */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 pointer-events-none z-10">
          <div className="h-full mx-4 rounded-xl bg-gradient-to-r from-violet-500/20 via-fuchsia-500/15 to-violet-500/20 border border-white/10" />
        </div>

        {/* Gradient overlays for depth */}
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-zinc-900 to-transparent pointer-events-none z-20" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-900 to-transparent pointer-events-none z-20" />

        {/* Columns container */}
        <div className="flex items-center py-4">
          {/* Day picker */}
          <WheelColumn
            items={DAYS.map((d) => ({ value: d, label: String(d).padStart(2, "0") }))}
            value={Math.min(day, daysInCurrentMonth)}
            onChange={setDay}
            className="flex-[0.8]"
          />

          {/* Month picker */}
          <WheelColumn
            items={MONTHS.map((m) => ({ value: m.value, label: m.label }))}
            value={month}
            onChange={setMonth}
            className="flex-[1.2]"
          />

          {/* Year picker */}
          <WheelColumn
            items={YEARS.map((y) => ({ value: y, label: String(y) }))}
            value={year}
            onChange={setYear}
            className="flex-1"
          />
        </div>
      </div>

      {/* Display selected date elegantly */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-4 text-center"
      >
        <p className="text-sm text-muted-foreground">
          <span className="text-violet-400 font-medium">
            {day} de {MONTHS[month - 1]?.label} de {year}
          </span>
        </p>
      </motion.div>
    </div>
  );
}

// Individual wheel column component
interface WheelColumnProps {
  items: Array<{ value: number; label: string }>;
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

function WheelColumn({ items, value, onChange, className }: WheelColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 48; // h-12
  const visibleItems = 5;
  const [isDragging, setIsDragging] = useState(false);

  // Find current index
  const currentIndex = items.findIndex((item) => item.value === value);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;

  // Scroll to selected item on mount and value change
  useEffect(() => {
    if (containerRef.current && !isDragging) {
      const scrollTop = safeIndex * itemHeight;
      containerRef.current.scrollTo({ top: scrollTop, behavior: "smooth" });
    }
  }, [safeIndex, isDragging]);

  // Handle scroll end to snap to nearest item
  const handleScrollEnd = useCallback(() => {
    if (!containerRef.current) return;
    
    const scrollTop = containerRef.current.scrollTop;
    const index = Math.round(scrollTop / itemHeight);
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
    
    if (items[clampedIndex]) {
      onChange(items[clampedIndex].value);
    }
  }, [items, onChange]);

  // Debounce scroll end detection
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleScroll = useCallback(() => {
    setIsDragging(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      handleScrollEnd();
      setIsDragging(false);
    }, 100);
  }, [handleScrollEnd]);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-[240px] overflow-y-auto scrollbar-hide snap-y snap-mandatory overscroll-contain"
        style={{
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Top padding for centering */}
        <div style={{ height: itemHeight * 2 }} />

        {items.map((item, idx) => {
          const distance = Math.abs(idx - safeIndex);
          const opacity = distance === 0 ? 1 : distance === 1 ? 0.5 : 0.25;
          const scale = distance === 0 ? 1 : distance === 1 ? 0.9 : 0.8;

          return (
            <div
              key={item.value}
              onClick={() => onChange(item.value)}
              className="h-12 flex items-center justify-center cursor-pointer snap-center"
              style={{
                height: itemHeight,
              }}
            >
              <span
                className={cn(
                  "text-lg font-medium transition-all duration-200 select-none",
                  distance === 0 ? "text-white" : "text-zinc-500"
                )}
                style={{
                  opacity,
                  transform: `scale(${scale})`,
                }}
              >
                {item.label}
              </span>
            </div>
          );
        })}

        {/* Bottom padding for centering */}
        <div style={{ height: itemHeight * 2 }} />
      </div>
    </div>
  );
}

