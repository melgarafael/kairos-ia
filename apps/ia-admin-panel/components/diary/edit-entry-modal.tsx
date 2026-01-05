"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Loader2, Trash2, Clock } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { MoodSelector, type MoodValue } from "./mood-selector";
import type { DiaryEntry } from "./diary-entry-card";

interface EditEntryModalProps {
  entry: DiaryEntry;
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: FormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function EditEntryModal({
  entry,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: EditEntryModalProps) {
  const [mood, setMood] = useState<MoodValue | null>(
    (entry.humor_energia as MoodValue) || null
  );
  const [hora, setHora] = useState<string>(entry.hora || "12:00");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("id", entry.id);

    startTransition(async () => {
      await onSave(formData);
      onClose();
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(entry.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  const formattedDate = new Date(entry.data ?? entry.created_at).toLocaleDateString(
    "pt-BR",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );

  const displayTime = entry.hora ? ` às ${entry.hora}` : "";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-4 z-50 m-auto max-w-lg max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl"
          >
            {/* Delete Confirmation Overlay */}
            <AnimatePresence>
              {showDeleteConfirm && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-900/95 backdrop-blur-sm p-6"
                >
                  <div className="text-center space-y-4 max-w-xs">
                    <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-red-500/10 border border-red-500/20">
                      <Trash2 className="w-8 h-8 text-red-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white/90">
                      Deletar registro?
                    </h3>
                    <p className="text-sm text-white/50">
                      Esta ação não pode ser desfeita. O registro será removido
                      permanentemente.
                    </p>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={isDeleting}
                        className={cn(
                          "flex-1 px-4 py-2.5 rounded-xl",
                          "bg-white/5 border border-white/10",
                          "text-sm font-medium text-white/70",
                          "hover:bg-white/10 transition-colors",
                          "disabled:opacity-50"
                        )}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl",
                          "bg-red-500/20 border border-red-500/30",
                          "text-sm font-medium text-red-300",
                          "hover:bg-red-500/30 transition-colors",
                          "disabled:opacity-50"
                        )}
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" />
                            Deletar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div>
                <h2 className="text-lg font-semibold text-white/90">
                  Editar registro
                </h2>
                <p className="text-xs text-white/40 capitalize">{formattedDate}{displayTime}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5 text-white/50" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Hidden fields */}
              <input
                type="hidden"
                name="data"
                defaultValue={entry.data ?? new Date().toISOString().split("T")[0]}
              />
              <input
                type="hidden"
                name="hora"
                value={hora}
              />

              {/* Mood and Time selectors */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <MoodSelector
                    value={mood}
                    onChange={setMood}
                    name="humor_energia"
                  />
                </div>
                
                {/* Time picker */}
                <div className="flex flex-col items-end gap-1">
                  <label className="text-[10px] uppercase tracking-[0.15em] text-white/30">
                    Momento
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                    <Clock className="w-3.5 h-3.5 text-white/40" />
                    <input
                      type="time"
                      value={hora}
                      onChange={(e) => setHora(e.target.value)}
                      className={cn(
                        "bg-transparent text-sm text-white/80",
                        "focus:outline-none",
                        "[&::-webkit-calendar-picker-indicator]:hidden"
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Challenges */}
              <div className="space-y-2">
                <label
                  htmlFor="edit_principais_desafios"
                  className="block text-xs font-medium uppercase tracking-[0.15em] text-white/60"
                >
                  O que está ocupando sua mente?
                </label>
                <textarea
                  id="edit_principais_desafios"
                  name="principais_desafios"
                  rows={3}
                  defaultValue={entry.principais_desafios || ""}
                  placeholder="Desafios, sensações, pensamentos recorrentes..."
                  className={cn(
                    "w-full px-4 py-3 rounded-xl resize-none",
                    "bg-white/5 border border-white/5",
                    "text-white/90 placeholder:text-white/25",
                    "focus:outline-none focus:border-white/20 focus:bg-white/[0.07]",
                    "transition-all duration-200"
                  )}
                />
              </div>

              {/* Focus */}
              <div className="space-y-2">
                <label
                  htmlFor="edit_foco_do_dia"
                  className="block text-xs font-medium uppercase tracking-[0.15em] text-white/60"
                >
                  Qual é sua intenção?
                </label>
                <textarea
                  id="edit_foco_do_dia"
                  name="foco_do_dia"
                  rows={2}
                  defaultValue={entry.foco_do_dia || ""}
                  placeholder="Uma única coisa que importa..."
                  className={cn(
                    "w-full px-4 py-3 rounded-xl resize-none",
                    "bg-white/5 border border-white/5",
                    "text-white/90 placeholder:text-white/25",
                    "focus:outline-none focus:border-white/20 focus:bg-white/[0.07]",
                    "transition-all duration-200"
                  )}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl",
                    "text-sm text-red-400/70 hover:text-red-400",
                    "hover:bg-red-500/10 transition-colors"
                  )}
                >
                  <Trash2 className="w-4 h-4" />
                  Deletar
                </button>

                <button
                  type="submit"
                  disabled={isPending}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl",
                    "bg-white/10 border border-white/10",
                    "text-sm font-medium text-white/90",
                    "hover:bg-white/15 hover:border-white/20",
                    "transition-all duration-200",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar alterações
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

