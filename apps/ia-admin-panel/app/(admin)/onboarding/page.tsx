"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Calendar,
  Clock,
  MapPin,
  Check,
  Star,
} from "lucide-react";
import { HumanDesignTypeBadge } from "@/components/human-design/human-design-type-badge";
import { cn } from "@/lib/ui/cn";
import {
  BirthDatePicker,
  BirthTimePicker,
  LocationSearch,
  type LocationResult,
} from "@/components/onboarding";

type Step =
  | "welcome"
  | "birth-date"
  | "birth-time"
  | "birth-location"
  | "generating"
  | "confirmation";

type ProfileData = {
  tipo: string | null;
  estrategia: string | null;
  autoridade: string | null;
  perfil: string | null;
  cruz_incarnacao: string | null;
  definicao?: string | null;
  assinatura?: string | null;
  tema_nao_self?: string | null;
  digestao?: string | null;
  sentido?: string | null;
  sentido_design?: string | null;
  motivacao?: string | null;
  perspectiva?: string | null;
  ambiente?: string | null;
  centros_definidos: string[] | null;
  centros_abertos: string[] | null;
  canais: string[] | null;
  portas: string[] | null;
  variaveis?: Record<string, string> | null;
  planetas_personalidade?: Record<string, unknown> | null;
  planetas_design?: Record<string, unknown> | null;
  data_nascimento_utc?: string | null;
  data_design_utc?: string | null;
};

// Step progress order
const STEP_ORDER: Step[] = [
  "welcome",
  "birth-date",
  "birth-time",
  "birth-location",
  "generating",
  "confirmation",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("12:00");
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [timezone, setTimezone] = useState("");

  // Generated profile
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const currentStepIndex = STEP_ORDER.indexOf(step);
  const totalSteps = STEP_ORDER.length - 2; // Exclude generating and confirmation

  const handleGenerateDesign = async () => {
    setLoading(true);
    setError(null);
    setStep("generating");

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
        throw new Error(data.error || "Erro ao gerar design");
      }

      setProfile(data.profile);
      setStep("confirmation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setStep("birth-location");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    router.push("/app");
    router.refresh();
  };

  const goNext = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEP_ORDER.length) {
      setStep(STEP_ORDER[nextIndex]);
    }
  }, [currentStepIndex]);

  const goBack = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(STEP_ORDER[prevIndex]);
    }
  }, [currentStepIndex]);

  return (
    <div className="min-h-[calc(100vh-4rem)] relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      {/* Progress indicator */}
      <AnimatePresence>
        {step !== "welcome" && step !== "generating" && step !== "confirmation" && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10">
              {STEP_ORDER.slice(1, -2).map((s, i) => {
                const stepIndex = i + 1;
                const isActive = currentStepIndex === stepIndex;
                const isComplete = currentStepIndex > stepIndex;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <motion.div
                      animate={{
                        scale: isActive ? 1.2 : 1,
                        backgroundColor: isComplete
                          ? "rgb(139, 92, 246)"
                          : isActive
                          ? "rgb(139, 92, 246)"
                          : "rgb(63, 63, 70)",
                      }}
                      className={cn(
                        "w-2 h-2 rounded-full",
                        isActive && "ring-4 ring-violet-500/20"
                      )}
                    />
                    {i < 2 && (
                      <div
                        className={cn(
                          "w-8 h-0.5 rounded-full",
                          currentStepIndex > stepIndex ? "bg-violet-500" : "bg-zinc-700"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-6 py-16">
        <div className="w-full max-w-lg relative">
          <AnimatePresence mode="wait">
            {step === "welcome" && (
              <StepWelcome key="welcome" onNext={() => setStep("birth-date")} />
            )}

            {step === "birth-date" && (
              <StepBirthDate
                key="birth-date"
                value={birthDate}
                onChange={setBirthDate}
                onNext={goNext}
                onBack={goBack}
              />
            )}

            {step === "birth-time" && (
              <StepBirthTime
                key="birth-time"
                value={birthTime}
                onChange={setBirthTime}
                onNext={goNext}
                onBack={goBack}
              />
            )}

            {step === "birth-location" && (
              <StepBirthLocation
                key="birth-location"
                value={location}
                onChange={setLocation}
                timezone={timezone}
                onTimezoneChange={setTimezone}
                error={error}
                onNext={handleGenerateDesign}
                onBack={goBack}
              />
            )}

            {step === "generating" && <StepGenerating key="generating" />}

            {step === "confirmation" && profile && (
              <StepConfirmation
                key="confirmation"
                profile={profile}
                onComplete={handleComplete}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ============================================
// STEP COMPONENTS
// ============================================

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="text-center space-y-10"
    >
      {/* Animated icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.6, type: "spring" }}
        className="relative inline-flex"
      >
        {/* Pulsing rings */}
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute inset-0 rounded-3xl bg-violet-500/20"
        />
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
          className="absolute inset-0 rounded-3xl bg-fuchsia-500/20"
        />

        <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 border border-violet-500/40 flex items-center justify-center">
          <Sparkles className="w-12 h-12 text-violet-300" />
        </div>
      </motion.div>

      {/* Title */}
      <div className="space-y-4">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-4xl font-semibold tracking-tight text-foreground"
        >
          Descubra seu
          <br />
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Design Humano
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed"
        >
          Em menos de 1 minuto, Kairos IA conhecerá seu mapa energético para
          oferecer orientações únicas para você.
        </motion.p>
      </div>

      {/* Benefits */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="grid gap-4 max-w-sm mx-auto"
      >
        {[
          { icon: Star, text: "Conheça seu tipo, estratégia e autoridade" },
          { icon: Sparkles, text: "Receba orientações personalizadas da IA" },
          { icon: Check, text: "Desenvolva autoconhecimento real" },
        ].map((benefit, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.1 }}
            className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <benefit.icon className="w-5 h-5 text-violet-400" />
            </div>
            <span className="text-sm text-zinc-300">{benefit.text}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="pt-4"
      >
        <Button
          onClick={onNext}
          size="lg"
          className="px-10 h-14 text-lg gap-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 shadow-lg shadow-violet-500/25"
        >
          Começar jornada
          <ArrowRight className="w-5 h-5" />
        </Button>
      </motion.div>

      {/* Note */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="text-xs text-muted-foreground/60"
      >
        Leva menos de 1 minuto • Você pode atualizar depois
      </motion.p>
    </motion.div>
  );
}

function StepBirthDate({
  value,
  onChange,
  onNext,
  onBack,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="text-center space-y-3">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring" }}
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-500/20 border border-violet-500/30"
        >
          <Calendar className="w-7 h-7 text-violet-400" />
        </motion.div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Quando você nasceu?
        </h2>
        <p className="text-muted-foreground text-sm">
          A data exata é essencial para o cálculo do seu mapa
        </p>
      </div>

      {/* Date picker */}
      <BirthDatePicker value={value} onChange={onChange} />

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          variant="ghost"
          onClick={onBack}
          className="gap-2 text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <Button
          onClick={onNext}
          disabled={!value}
          className="flex-1 h-12 gap-2 bg-violet-600 hover:bg-violet-500"
        >
          Continuar
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}

function StepBirthTime({
  value,
  onChange,
  onNext,
  onBack,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="text-center space-y-3">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring" }}
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30"
        >
          <Clock className="w-7 h-7 text-amber-400" />
        </motion.div>
        <h2 className="text-2xl font-semibold tracking-tight">
          A que horas você nasceu?
        </h2>
        <p className="text-muted-foreground text-sm">
          Quanto mais preciso, mais detalhado seu mapa
        </p>
      </div>

      {/* Time picker */}
      <BirthTimePicker value={value} onChange={onChange} />

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          variant="ghost"
          onClick={onBack}
          className="gap-2 text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <Button
          onClick={onNext}
          disabled={!value}
          className="flex-1 h-12 gap-2 bg-violet-600 hover:bg-violet-500"
        >
          Continuar
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}

function StepBirthLocation({
  value,
  onChange,
  timezone,
  onTimezoneChange,
  error,
  onNext,
  onBack,
}: {
  value: LocationResult | null;
  onChange: (v: LocationResult | null) => void;
  timezone: string;
  onTimezoneChange: (v: string) => void;
  error: string | null;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="text-center space-y-3">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring" }}
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30"
        >
          <MapPin className="w-7 h-7 text-emerald-400" />
        </motion.div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Onde você nasceu?
        </h2>
        <p className="text-muted-foreground text-sm">
          Busque sua cidade e o fuso horário será preenchido automaticamente
        </p>
      </div>

      {/* Location search */}
      <LocationSearch
        value={value}
        onChange={onChange}
        onTimezoneDetected={onTimezoneChange}
      />

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-sm text-destructive"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          variant="ghost"
          onClick={onBack}
          className="gap-2 text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <Button
          onClick={onNext}
          disabled={!value}
          className="flex-1 h-12 gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
        >
          <Sparkles className="w-4 h-4" />
          Gerar meu Design
        </Button>
      </div>
    </motion.div>
  );
}

function StepGenerating() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4 }}
      className="text-center space-y-10 py-12"
    >
      {/* Animated orb */}
      <div className="relative inline-flex items-center justify-center">
        {/* Orbiting particles */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ rotate: 360 }}
            transition={{
              duration: 3 + i,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute inset-0"
          >
            <div
              className="absolute w-3 h-3 bg-violet-400 rounded-full"
              style={{
                top: "50%",
                left: "50%",
                transform: `translate(-50%, -50%) translateX(${50 + i * 15}px)`,
              }}
            />
          </motion.div>
        ))}

        {/* Main orb */}
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            boxShadow: [
              "0 0 30px rgba(139, 92, 246, 0.3)",
              "0 0 60px rgba(139, 92, 246, 0.5)",
              "0 0 30px rgba(139, 92, 246, 0.3)",
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center"
        >
          <Sparkles className="w-10 h-10 text-white" />
        </motion.div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Calculando seu mapa...</h2>
        <motion.p
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-muted-foreground"
        >
          Conectando com as posições planetárias do momento do seu nascimento
        </motion.p>
      </div>

      {/* Loading bar */}
      <div className="max-w-xs mx-auto">
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="h-full w-1/2 bg-gradient-to-r from-transparent via-violet-500 to-transparent"
          />
        </div>
      </div>
    </motion.div>
  );
}

function StepConfirmation({
  profile,
  onComplete,
}: {
  profile: ProfileData;
  onComplete: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-8"
    >
      {/* Success header */}
      <div className="text-center space-y-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30"
        >
          <Check className="w-10 h-10 text-emerald-400" />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-semibold"
        >
          Seu Design está pronto!
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-muted-foreground"
        >
          Kairos IA agora conhece seu mapa e vai te guiar de forma
          personalizada.
        </motion.p>
      </div>

      {/* Profile summary card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/60 border border-white/10 rounded-3xl p-6 space-y-6 backdrop-blur-sm"
      >
        {/* Type badge */}
        <div className="flex justify-center">
          <HumanDesignTypeBadge
            type={profile.tipo}
            className="text-lg px-6 py-3"
          />
        </div>

        {/* Main attributes */}
        <div className="grid gap-3">
          <ProfileAttribute label="Tipo" value={profile.tipo} highlight />
          <ProfileAttribute label="Estratégia" value={profile.estrategia} />
          <ProfileAttribute
            label="Autoridade Interna"
            value={profile.autoridade}
          />
          <ProfileAttribute label="Perfil" value={profile.perfil} />
          <ProfileAttribute
            label="Cruz de Encarnação"
            value={profile.cruz_incarnacao}
          />
        </div>

        {/* Signature & Theme */}
        {(profile.assinatura || profile.tema_nao_self) && (
          <div className="border-t border-white/10 pt-4 grid grid-cols-2 gap-4">
            {profile.assinatura && (
              <div className="text-center">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                  Assinatura
                </p>
                <p className="text-emerald-400 font-medium">
                  {profile.assinatura}
                </p>
              </div>
            )}
            {profile.tema_nao_self && (
              <div className="text-center">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                  Tema Não-Self
                </p>
                <p className="text-amber-400 font-medium">
                  {profile.tema_nao_self}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Variables (Arrows) */}
        {profile.variaveis && (
          <div className="flex items-center justify-center gap-6 p-3 bg-zinc-800/50 rounded-xl">
            <VariableArrow
              direction={profile.variaveis.Digestion}
              label="Dig"
            />
            <VariableArrow
              direction={profile.variaveis.Environment}
              label="Env"
            />
            <VariableArrow
              direction={profile.variaveis.Awareness}
              label="Awa"
            />
            <VariableArrow
              direction={profile.variaveis.Perspective}
              label="Per"
            />
          </div>
        )}

        {/* Centers */}
        {profile.centros_definidos && profile.centros_definidos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">
              Centros Definidos
            </p>
            <div className="flex flex-wrap gap-1">
              {profile.centros_definidos.map((c) => (
                <span
                  key={c}
                  className="px-2 py-1 text-xs bg-amber-500/20 text-amber-200 rounded-lg"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-center pt-2"
      >
        <Button
          onClick={onComplete}
          size="lg"
          className="px-10 h-14 text-lg gap-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 shadow-lg shadow-violet-500/25"
        >
          Entrar no meu espaço Kairos
          <ArrowRight className="w-5 h-5" />
        </Button>
      </motion.div>
    </motion.div>
  );
}

// Helper components
function ProfileAttribute({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value?: string | null;
  highlight?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
      <span className="text-zinc-500 text-sm">{label}</span>
      <span
        className={cn(
          "text-sm text-right max-w-[60%]",
          highlight ? "text-violet-400 font-medium" : "text-zinc-200"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function VariableArrow({
  direction,
  label,
}: {
  direction?: string;
  label: string;
}) {
  if (!direction) return null;
  const isLeft = direction === "left";
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={cn(
          "text-2xl font-bold",
          isLeft ? "text-blue-400" : "text-amber-400"
        )}
      >
        {isLeft ? "←" : "→"}
      </span>
      <span className="text-[10px] text-zinc-500 uppercase">{label}</span>
    </div>
  );
}
