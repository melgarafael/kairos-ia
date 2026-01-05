"use client";

import { useState, useRef, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Check, Loader2, Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { MoodSelector, type MoodValue } from "./mood-selector";

// Helper to get current time in HH:MM format
function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

interface ReflectionFormProps {
  onSubmit: (formData: FormData) => Promise<void>;
}

type FormState = "idle" | "submitting" | "success";

export function ReflectionForm({ onSubmit }: ReflectionFormProps) {
  const [mood, setMood] = useState<MoodValue | null>(null);
  const [hora, setHora] = useState<string>(getCurrentTime());
  const [formState, setFormState] = useState<FormState>("idle");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (formState !== "idle") return;

    const formData = new FormData(e.currentTarget);

    setFormState("submitting");

    startTransition(async () => {
      try {
        await onSubmit(formData);
        setFormState("success");

        // Reset form after success animation
        setTimeout(() => {
          formRef.current?.reset();
          setMood(null);
          setHora(getCurrentTime());
          setFormState("idle");
        }, 2000);
      } catch {
        setFormState("idle");
      }
    });
  };

  const isSubmitting = formState === "submitting" || isPending;
  const isSuccess = formState === "success";

  // Format today's date in Portuguese
  const todayFormatted = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <motion.form
      ref={formRef}
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative rounded-2xl border border-white/5 bg-white/[0.02]",
        "overflow-hidden"
      )}
    >
      {/* Success overlay */}
      <AnimatePresence>
        {isSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-emerald-950/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 mb-4"
            >
              <Check className="w-8 h-8 text-emerald-400" />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg font-medium text-white/90"
            >
              Check-in registrado
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-sm text-white/50"
            >
              Sua reflexão foi salva
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-5 sm:p-6 space-y-5">
        {/* Hidden date field - defaults to today */}
        <input
          type="hidden"
          name="data"
          value={new Date().toISOString().split("T")[0]}
        />
        <input
          type="hidden"
          name="hora"
          value={hora}
        />

        {/* Date/Time context bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5"
        >
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-white/40" />
            <span className="text-sm text-white/60 capitalize">
              {todayFormatted}
            </span>
          </div>
          
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/5 hover:border-white/10 transition-colors">
            <Clock className="w-3.5 h-3.5 text-white/40" />
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className={cn(
                "bg-transparent text-sm text-white/70 w-[4.5rem]",
                "focus:outline-none",
                "[&::-webkit-calendar-picker-indicator]:hidden"
              )}
            />
          </div>
        </motion.div>

        {/* Mood Selector */}
        <MoodSelector
          value={mood}
          onChange={setMood}
          name="humor_energia"
        />

        {/* Reflection prompts */}
        <div className="space-y-4">
          {/* Challenges / What's on your mind */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="space-y-2"
          >
            <label
              htmlFor="principais_desafios"
              className="block text-xs font-medium uppercase tracking-[0.15em] text-white/60"
            >
              O que está ocupando sua mente?
            </label>
            <textarea
              id="principais_desafios"
              name="principais_desafios"
              rows={3}
              placeholder="Desafios, sensações, pensamentos recorrentes..."
              className={cn(
                "w-full px-4 py-3 rounded-xl resize-none",
                "bg-white/[0.04] border border-white/5",
                "text-white/90 placeholder:text-white/25",
                "focus:outline-none focus:border-white/15 focus:bg-white/[0.06]",
                "transition-all duration-200"
              )}
            />
          </motion.div>

          {/* Focus / Intention */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="space-y-2"
          >
            <label
              htmlFor="foco_do_dia"
              className="block text-xs font-medium uppercase tracking-[0.15em] text-white/60"
            >
              Qual é sua intenção agora?
            </label>
            <textarea
              id="foco_do_dia"
              name="foco_do_dia"
              rows={2}
              placeholder="Uma única coisa que importa..."
              className={cn(
                "w-full px-4 py-3 rounded-xl resize-none",
                "bg-white/[0.04] border border-white/5",
                "text-white/90 placeholder:text-white/25",
                "focus:outline-none focus:border-white/15 focus:bg-white/[0.06]",
                "transition-all duration-200"
              )}
            />
          </motion.div>
        </div>

        {/* Submit button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex justify-end pt-1"
        >
          <button
            type="submit"
            disabled={isSubmitting || isSuccess}
            className={cn(
              "group flex items-center gap-2 px-5 py-2.5 rounded-xl",
              "bg-white/10 border border-white/10",
              "text-sm font-medium text-white/90",
              "hover:bg-white/15 hover:border-white/20",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
              "transition-all duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <span>Salvar check-in</span>
                <Send className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </motion.div>
      </div>

      {/* Subtle bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </motion.form>
  );
}
