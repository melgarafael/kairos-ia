"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Compass, Circle, Link2, Globe2, Settings2 } from "lucide-react";
import { cn } from "@/lib/ui/cn";

type PlanetData = {
  Gate: number;
  Line: number;
  Color?: number;
  Tone?: number;
  Base?: number;
  FixingState?: string;
};

interface DesignAccordionProps {
  profile: {
    tipo?: string | null;
    estrategia?: string | null;
    autoridade?: string | null;
    perfil?: string | null;
    cruz_incarnacao?: string | null;
    definicao?: string | null;
    assinatura?: string | null;
    tema_nao_self?: string | null;
    digestao?: string | null;
    sentido?: string | null;
    sentido_design?: string | null;
    motivacao?: string | null;
    perspectiva?: string | null;
    ambiente?: string | null;
    centros_definidos?: string[] | null;
    centros_abertos?: string[] | null;
    canais?: string[] | null;
    portas?: string[] | null;
    variaveis?: Record<string, string> | null;
    planetas_personalidade?: Record<string, PlanetData> | null;
    planetas_design?: Record<string, PlanetData> | null;
  };
}

type SectionKey = "essencia" | "centros" | "conexoes" | "planetas" | "avancado";

const SECTIONS: { key: SectionKey; title: string; icon: typeof Compass; description: string }[] = [
  { key: "essencia", title: "Essência", icon: Compass, description: "Estratégia, Autoridade e Perfil" },
  { key: "centros", title: "Centros de Energia", icon: Circle, description: "Definidos e abertos" },
  { key: "conexoes", title: "Canais & Portas", icon: Link2, description: "Suas conexões energéticas" },
  { key: "planetas", title: "Mapa Planetário", icon: Globe2, description: "Design e Personalidade" },
  { key: "avancado", title: "Propriedades Avançadas", icon: Settings2, description: "Variáveis e detalhes" },
];

export function DesignAccordion({ profile }: DesignAccordionProps) {
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(new Set(["essencia"]));

  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {SECTIONS.map((section, index) => {
        const isOpen = openSections.has(section.key);
        const Icon = section.icon;

        // Skip sections with no content
        if (section.key === "planetas" && !profile.planetas_design && !profile.planetas_personalidade) {
          return null;
        }
        if (section.key === "avancado" && !hasAdvancedProperties(profile)) {
          return null;
        }

        return (
          <motion.div
            key={section.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden"
          >
            {/* Header */}
            <button
              onClick={() => toggleSection(section.key)}
              className={cn(
                "w-full flex items-center justify-between px-5 py-4",
                "hover:bg-white/[0.02] transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              )}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/5">
                  <Icon className="w-5 h-5 text-white/50" />
                </div>
                <div className="text-left">
                  <h3 className="text-base font-medium text-white/90">{section.title}</h3>
                  <p className="text-sm text-white/40">{section.description}</p>
                </div>
              </div>
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-5 h-5 text-white/30" />
              </motion.div>
            </button>

            {/* Content */}
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="px-5 pb-5 pt-2 border-t border-white/5">
                    {section.key === "essencia" && <EssenciaContent profile={profile} />}
                    {section.key === "centros" && <CentrosContent profile={profile} />}
                    {section.key === "conexoes" && <ConexoesContent profile={profile} />}
                    {section.key === "planetas" && <PlanetasContent profile={profile} />}
                    {section.key === "avancado" && <AvancadoContent profile={profile} />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

// ============ Section Contents ============

function EssenciaContent({ profile }: { profile: DesignAccordionProps["profile"] }) {
  const items = [
    { label: "Estratégia", value: profile.estrategia, hint: "Como iniciar corretamente" },
    { label: "Autoridade", value: profile.autoridade, hint: "Seu centro de decisão" },
    { label: "Perfil", value: profile.perfil, hint: "Seu papel no mundo" },
    { label: "Definição", value: profile.definicao, hint: "Como sua energia flui" },
    { label: "Cruz de Encarnação", value: profile.cruz_incarnacao, hint: "Seu propósito de vida" },
    { label: "Assinatura", value: profile.assinatura, hint: "Quando você está alinhado" },
    { label: "Tema Não-Self", value: profile.tema_nao_self, hint: "Sinal de desalinhamento" },
  ].filter((item) => item.value);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <PropertyCard key={item.label} {...item} />
      ))}
    </div>
  );
}

function CentrosContent({ profile }: { profile: DesignAccordionProps["profile"] }) {
  const definidos = profile.centros_definidos || [];
  const abertos = profile.centros_abertos || [];

  if (definidos.length === 0 && abertos.length === 0) {
    return <EmptyState text="Centros não disponíveis" />;
  }

  return (
    <div className="space-y-4">
      {definidos.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400/70 mb-2">
            Definidos — Energia consistente
          </p>
          <div className="flex flex-wrap gap-2">
            {definidos.map((center) => (
              <span
                key={center}
                className="px-3 py-1.5 text-sm rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
              >
                {center}
              </span>
            ))}
          </div>
        </div>
      )}

      {abertos.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">
            Abertos — Sabedoria potencial
          </p>
          <div className="flex flex-wrap gap-2">
            {abertos.map((center) => (
              <span
                key={center}
                className="px-3 py-1.5 text-sm rounded-lg bg-white/5 text-white/60 border border-white/10"
              >
                {center}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConexoesContent({ profile }: { profile: DesignAccordionProps["profile"] }) {
  const canais = profile.canais || [];
  const portas = profile.portas || [];

  if (canais.length === 0 && portas.length === 0) {
    return <EmptyState text="Canais e portas não disponíveis" />;
  }

  return (
    <div className="space-y-4">
      {canais.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-purple-400/70 mb-2">
            Canais — Dons e talentos
          </p>
          <div className="flex flex-wrap gap-2">
            {canais.map((canal) => (
              <span
                key={canal}
                className="px-3 py-1.5 text-sm rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20"
              >
                {canal}
              </span>
            ))}
          </div>
        </div>
      )}

      {portas.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">
            Portas — Energias individuais
          </p>
          <div className="flex flex-wrap gap-2">
            {portas.map((porta) => (
              <span
                key={porta}
                className="px-3 py-1.5 text-sm rounded-lg bg-white/5 text-white/60 border border-white/10 font-mono"
              >
                {porta}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanetasContent({ profile }: { profile: DesignAccordionProps["profile"] }) {
  if (!profile.planetas_design && !profile.planetas_personalidade) {
    return <EmptyState text="Dados planetários não disponíveis" />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {profile.planetas_design && (
        <PlanetTable
          title="Design"
          subtitle="Inconsciente"
          planets={profile.planetas_design}
          variant="design"
        />
      )}
      {profile.planetas_personalidade && (
        <PlanetTable
          title="Personalidade"
          subtitle="Consciente"
          planets={profile.planetas_personalidade}
          variant="personality"
        />
      )}
    </div>
  );
}

function AvancadoContent({ profile }: { profile: DesignAccordionProps["profile"] }) {
  const items = [
    { label: "Digestão", value: profile.digestao },
    { label: "Sentido", value: profile.sentido },
    { label: "Sentido Design", value: profile.sentido_design },
    { label: "Motivação", value: profile.motivacao },
    { label: "Perspectiva", value: profile.perspectiva },
    { label: "Ambiente", value: profile.ambiente },
  ].filter((item) => item.value);

  return (
    <div className="space-y-4">
      {/* Variables arrows if available */}
      {profile.variaveis && (
        <div className="flex items-center justify-center gap-6 p-4 rounded-lg bg-white/5">
          <VariableArrow direction={profile.variaveis.Digestion} label="Digestão" />
          <VariableArrow direction={profile.variaveis.Environment} label="Ambiente" />
          <VariableArrow direction={profile.variaveis.Awareness} label="Consciência" />
          <VariableArrow direction={profile.variaveis.Perspective} label="Perspectiva" />
        </div>
      )}

      {items.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex justify-between items-center py-2 px-3 rounded-lg bg-white/5"
            >
              <span className="text-sm text-white/50">{item.label}</span>
              <span className="text-sm text-white/80 font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Helper Components ============

function PropertyCard({ label, value, hint }: { label: string; value?: string | null; hint?: string }) {
  if (!value) return null;

  return (
    <div className="p-4 rounded-lg bg-white/5 border border-white/5">
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className="text-base text-white/90 font-medium">{value}</p>
      {hint && <p className="text-xs text-white/30 mt-1">{hint}</p>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="text-sm text-white/30 py-4 text-center">{text}</p>
  );
}

function VariableArrow({ direction, label }: { direction?: string; label: string }) {
  if (!direction) return null;

  const isLeft = direction.toLowerCase() === "left";

  return (
    <div className="flex flex-col items-center gap-1">
      <span className={cn("text-2xl font-bold", isLeft ? "text-blue-400" : "text-amber-400")}>
        {isLeft ? "←" : "→"}
      </span>
      <span className="text-[10px] text-white/40 uppercase tracking-wide">{label}</span>
    </div>
  );
}

const PLANET_SYMBOLS: Record<string, string> = {
  Sun: "☉",
  Earth: "⊕",
  "North Node": "☊",
  "South Node": "☋",
  Moon: "☽",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Uranus: "♅",
  Neptune: "♆",
  Pluto: "♇",
  Chiron: "⚷",
};

const PLANET_ORDER = [
  "Sun", "Earth", "North Node", "South Node", "Moon", "Mercury",
  "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "Chiron",
];

function PlanetTable({
  title,
  subtitle,
  planets,
  variant,
}: {
  title: string;
  subtitle: string;
  planets: Record<string, PlanetData>;
  variant: "design" | "personality";
}) {
  const isDesign = variant === "design";

  return (
    <div className={cn(
      "rounded-lg overflow-hidden",
      isDesign ? "bg-amber-950/30 border border-amber-900/30" : "bg-zinc-800/30 border border-zinc-700/30"
    )}>
      <div className={cn(
        "px-4 py-2",
        isDesign ? "bg-amber-900/40 text-amber-200" : "bg-zinc-700/40 text-zinc-300"
      )}>
        <p className="text-xs font-semibold uppercase tracking-wider">{title}</p>
        <p className="text-[10px] text-white/40">{subtitle}</p>
      </div>
      <div className="p-2 space-y-0.5">
        {PLANET_ORDER.map((planetName) => {
          const data = planets[planetName];
          if (!data) return null;

          return (
            <div
              key={planetName}
              className={cn(
                "flex items-center justify-between py-1 px-2 rounded text-sm",
                isDesign ? "hover:bg-amber-900/20" : "hover:bg-zinc-700/20"
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn("text-base w-5", isDesign ? "text-amber-400" : "text-zinc-400")}>
                  {PLANET_SYMBOLS[planetName]}
                </span>
                <span className={cn("font-mono text-sm", isDesign ? "text-amber-100" : "text-zinc-200")}>
                  {data.Gate}.{data.Line}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {data.FixingState === "Exalted" && (
                  <span className="text-green-400 text-xs">▲</span>
                )}
                {data.FixingState === "Detriment" && (
                  <span className="text-red-400 text-xs">▼</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ Helpers ============

function hasAdvancedProperties(profile: DesignAccordionProps["profile"]): boolean {
  return !!(
    profile.digestao ||
    profile.sentido ||
    profile.sentido_design ||
    profile.motivacao ||
    profile.perspectiva ||
    profile.ambiente ||
    profile.variaveis
  );
}
