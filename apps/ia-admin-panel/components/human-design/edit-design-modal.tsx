"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui/cn";
import {
  BirthDatePicker,
  BirthTimePicker,
  LocationSearch,
  type LocationResult,
} from "@/components/onboarding";

type EditStep = "date" | "time" | "location" | "confirm";

interface EditDesignModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBirthDate?: string; // YYYY-MM-DD
  currentBirthTime?: string; // HH:mm
  currentLocation?: string;
  currentTimezone?: string;
}

export function EditDesignModal({
  isOpen,
  onClose,
  currentBirthDate,
  currentBirthTime,
  currentLocation,
  currentTimezone,
}: EditDesignModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<EditStep>("date");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [birthDate, setBirthDate] = useState(currentBirthDate || "");
  const [birthTime, setBirthTime] = useState(currentBirthTime || "12:00");
  const [location, setLocation] = useState<LocationResult | null>(
    currentLocation
      ? {
          id: "current",
          name: currentLocation.split(",")[0] || currentLocation,
          fullName: currentLocation,
          region: "",
          country: currentLocation.split(",").pop()?.trim() || "",
          timezone: currentTimezone || "America/Sao_Paulo",
        }
      : null
  );
  const [timezone, setTimezone] = useState(currentTimezone || "");

  const handleRecalculate = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/human-design/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          birthDate,
          birthTime,
          birthLocation: location?.fullName || "",
          timezone: timezone || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao recalcular design");
      }

      // Success - close modal and refresh page
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = useCallback(() => {
    setStep("date");
    setError(null);
    onClose();
  }, [onClose]);

  const steps: EditStep[] = ["date", "time", "location", "confirm"];
  const currentStepIndex = steps.indexOf(step);

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          {/* Modal Container - Centralizado */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-lg max-h-[90vh] overflow-auto pointer-events-auto"
            >
              <div className="bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="relative px-6 py-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Editar dados de nascimento
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Seu Design será recalculado automaticamente
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5 text-zinc-400" />
                  </button>
                </div>

                {/* Progress dots */}
                <div className="flex justify-center gap-2 mt-4">
                  {steps.map((s, i) => (
                    <motion.div
                      key={s}
                      animate={{
                        scale: currentStepIndex === i ? 1.2 : 1,
                        backgroundColor:
                          currentStepIndex > i
                            ? "rgb(139, 92, 246)"
                            : currentStepIndex === i
                            ? "rgb(139, 92, 246)"
                            : "rgb(63, 63, 70)",
                      }}
                      className={cn(
                        "w-2 h-2 rounded-full",
                        currentStepIndex === i && "ring-4 ring-violet-500/20"
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <AnimatePresence mode="wait">
                  {step === "date" && (
                    <StepContent
                      key="date"
                      icon={Calendar}
                      iconColor="text-violet-400"
                      iconBg="bg-violet-500/20 border-violet-500/30"
                      title="Data de nascimento"
                      description="Ajuste a data exata do seu nascimento"
                    >
                      <BirthDatePicker value={birthDate} onChange={setBirthDate} />
                      <div className="flex gap-3 mt-6">
                        <Button
                          variant="ghost"
                          onClick={handleClose}
                          className="text-zinc-400"
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={goNext}
                          disabled={!birthDate}
                          className="flex-1 bg-violet-600 hover:bg-violet-500"
                        >
                          Continuar
                        </Button>
                      </div>
                    </StepContent>
                  )}

                  {step === "time" && (
                    <StepContent
                      key="time"
                      icon={Clock}
                      iconColor="text-amber-400"
                      iconBg="bg-amber-500/20 border-amber-500/30"
                      title="Hora de nascimento"
                      description="Ajuste a hora do seu nascimento"
                    >
                      <BirthTimePicker value={birthTime} onChange={setBirthTime} />
                      <div className="flex gap-3 mt-6">
                        <Button
                          variant="ghost"
                          onClick={goBack}
                          className="text-zinc-400"
                        >
                          Voltar
                        </Button>
                        <Button
                          onClick={goNext}
                          disabled={!birthTime}
                          className="flex-1 bg-violet-600 hover:bg-violet-500"
                        >
                          Continuar
                        </Button>
                      </div>
                    </StepContent>
                  )}

                  {step === "location" && (
                    <StepContent
                      key="location"
                      icon={MapPin}
                      iconColor="text-emerald-400"
                      iconBg="bg-emerald-500/20 border-emerald-500/30"
                      title="Local de nascimento"
                      description="Busque sua cidade de nascimento"
                    >
                      <LocationSearch
                        value={location}
                        onChange={setLocation}
                        onTimezoneDetected={setTimezone}
                      />
                      <div className="flex gap-3 mt-6">
                        <Button
                          variant="ghost"
                          onClick={goBack}
                          className="text-zinc-400"
                        >
                          Voltar
                        </Button>
                        <Button
                          onClick={goNext}
                          disabled={!location}
                          className="flex-1 bg-violet-600 hover:bg-violet-500"
                        >
                          Continuar
                        </Button>
                      </div>
                    </StepContent>
                  )}

                  {step === "confirm" && (
                    <StepContent
                      key="confirm"
                      icon={Sparkles}
                      iconColor="text-fuchsia-400"
                      iconBg="bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border-violet-500/30"
                      title="Confirmar alterações"
                      description="Revise os dados antes de recalcular"
                    >
                      {/* Summary */}
                      <div className="space-y-3 bg-zinc-800/50 rounded-xl p-4">
                        <SummaryRow
                          icon={Calendar}
                          label="Data"
                          value={formatDate(birthDate)}
                        />
                        <SummaryRow
                          icon={Clock}
                          label="Hora"
                          value={birthTime}
                        />
                        <SummaryRow
                          icon={MapPin}
                          label="Local"
                          value={location?.fullName || "Não selecionado"}
                        />
                        {timezone && (
                          <div className="pt-2 border-t border-zinc-700">
                            <p className="text-xs text-zinc-500">
                              Timezone: <span className="text-violet-400">{timezone}</span>
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Warning */}
                      <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mt-4">
                        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-amber-200 font-medium">
                            Atenção
                          </p>
                          <p className="text-xs text-amber-200/70 mt-1">
                            Todo o seu Design Humano será recalculado e os dados
                            anteriores serão substituídos.
                          </p>
                        </div>
                      </div>

                      {/* Error */}
                      <AnimatePresence>
                        {error && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-sm text-destructive mt-4"
                          >
                            {error}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Actions */}
                      <div className="flex gap-3 mt-6">
                        <Button
                          variant="ghost"
                          onClick={goBack}
                          disabled={loading}
                          className="text-zinc-400"
                        >
                          Voltar
                        </Button>
                        <Button
                          onClick={handleRecalculate}
                          disabled={loading}
                          className="flex-1 gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Recalculando...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              Recalcular Design
                            </>
                          )}
                        </Button>
                      </div>
                    </StepContent>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// Helper components
function StepContent({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Step header */}
      <div className="text-center space-y-3">
        <div
          className={cn(
            "inline-flex items-center justify-center w-12 h-12 rounded-xl border",
            iconBg
          )}
        >
          <Icon className={cn("w-6 h-6", iconColor)} />
        </div>
        <div>
          <h3 className="text-lg font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {/* Step content */}
      {children}
    </motion.div>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-zinc-500" />
      <span className="text-sm text-zinc-500">{label}:</span>
      <span className="text-sm text-zinc-200 ml-auto">{value}</span>
    </div>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "Não selecionado";
  const [year, month, day] = dateStr.split("-");
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${parseInt(day)} de ${months[parseInt(month) - 1]} de ${year}`;
}

