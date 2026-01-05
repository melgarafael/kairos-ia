"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Heart,
  Users2,
  Zap,
  Link2,
  Scale,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { type HdRelationship, RELATIONSHIP_TYPES } from "@/lib/kairos/types";
import { resolveTypeMeta } from "@/components/human-design/type-meta";

interface RelationshipDetailModalProps {
  relationship: HdRelationship | null;
  onClose: () => void;
}

export function RelationshipDetailModal({
  relationship,
  onClose,
}: RelationshipDetailModalProps) {
  if (!relationship) return null;

  const friend = relationship.friend;
  const friendTypeMeta = friend?.tipo ? resolveTypeMeta(friend.tipo) : null;
  const relationshipLabel = RELATIONSHIP_TYPES.find(
    (r) => r.value === friend?.relationship_type
  )?.label || friend?.relationship_type;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={cn(
            "relative w-full max-w-2xl max-h-[90vh] overflow-y-auto",
            "bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl"
          )}
        >
          {/* Header with gradient */}
          <div
            className={cn(
              "relative p-6 border-b border-white/5",
              "bg-gradient-to-br from-rose-950/50 via-fuchsia-950/30 to-transparent"
            )}
          >
            <button
              onClick={onClose}
              className={cn(
                "absolute top-4 right-4 p-2 rounded-lg",
                "hover:bg-white/10 transition-colors"
              )}
            >
              <X className="w-5 h-5 text-white/60" />
            </button>

            {/* Names with heart */}
            <div className="flex items-center justify-center gap-4 py-4">
              <div className="text-center">
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2",
                    "bg-white/10 border border-white/10"
                  )}
                >
                  <Users2 className="w-6 h-6 text-white/60" />
                </div>
                <p className="font-medium text-white/90">Você</p>
              </div>

              <div className="flex items-center">
                <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent" />
                <div className="p-2 rounded-full bg-rose-500/20 border border-rose-500/30 mx-2">
                  <Heart className="w-5 h-5 text-rose-400" />
                </div>
                <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent" />
              </div>

              <div className="text-center">
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2",
                    getTypeBgClass(friend?.tipo),
                    "border border-white/10"
                  )}
                >
                  {friendTypeMeta ? (
                    <friendTypeMeta.icon className={cn("w-6 h-6", friendTypeMeta.accentClass)} />
                  ) : (
                    <Users2 className="w-6 h-6 text-white/60" />
                  )}
                </div>
                <p className="font-medium text-white/90">{friend?.name || "Pessoa"}</p>
                {relationshipLabel && (
                  <p className="text-xs text-white/40">{relationshipLabel}</p>
                )}
              </div>
            </div>

            {/* Composite type */}
            {relationship.composite_type && (
              <div className="text-center mt-4">
                <span className="text-xs uppercase tracking-wider text-white/40">
                  Tipo de Conexão
                </span>
                <p className="text-lg font-medium text-rose-300">
                  {relationship.composite_type}
                </p>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Key Themes */}
            {relationship.key_themes && relationship.key_themes.length > 0 && (
              <Section
                icon={<Sparkles className="w-4 h-4 text-amber-400" />}
                title="Temas-Chave"
                color="amber"
              >
                <ul className="space-y-2">
                  {relationship.key_themes.map((theme, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-white/70">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 mt-1.5 flex-shrink-0" />
                      {theme}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Electromagnetic Connections */}
            {relationship.electromagnetic_connections && relationship.electromagnetic_connections.length > 0 && (
              <Section
                icon={<Zap className="w-4 h-4 text-fuchsia-400" />}
                title="Conexões Eletromagnéticas"
                color="fuchsia"
              >
                <p className="text-sm text-white/50 mb-3">
                  Atrações naturais onde um complementa o outro
                </p>
                <div className="flex flex-wrap gap-2">
                  {relationship.electromagnetic_connections.map((conn, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-lg text-sm bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300"
                    >
                      {conn}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Composite Channels */}
            {relationship.composite_channels && relationship.composite_channels.length > 0 && (
              <Section
                icon={<Link2 className="w-4 h-4 text-emerald-400" />}
                title="Canais Compostos"
                color="emerald"
              >
                <p className="text-sm text-white/50 mb-3">
                  Canais formados quando vocês estão juntos
                </p>
                <div className="flex flex-wrap gap-2">
                  {relationship.composite_channels.map((channel, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-lg text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                    >
                      {channel}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Dominance & Compromise */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Dominance Areas */}
              {relationship.dominance_areas && relationship.dominance_areas.length > 0 && (
                <Section
                  icon={<Scale className="w-4 h-4 text-sky-400" />}
                  title="Áreas de Dominância"
                  color="sky"
                  compact
                >
                  <ul className="space-y-1.5">
                    {relationship.dominance_areas.map((area, i) => (
                      <li key={i} className="text-sm text-white/60">
                        {area}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Compromise Areas */}
              {relationship.compromise_areas && relationship.compromise_areas.length > 0 && (
                <Section
                  icon={<Scale className="w-4 h-4 text-orange-400" />}
                  title="Áreas de Compromisso"
                  color="orange"
                  compact
                >
                  <ul className="space-y-1.5">
                    {relationship.compromise_areas.map((area, i) => (
                      <li key={i} className="text-sm text-white/60">
                        {area}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>

            {/* Definition Type */}
            {relationship.definition_type && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                <span className="text-xs uppercase tracking-wider text-white/40">
                  Tipo de Definição
                </span>
                <p className="text-white/80 mt-1">{relationship.definition_type}</p>
              </div>
            )}

            {/* AI Tip */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-violet-950/30 to-fuchsia-950/20 border border-violet-500/10">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-violet-500/20">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/80 mb-1">
                    Dica da Mentora Kairos
                  </p>
                  <p className="text-sm text-white/50">
                    Use o chat com a Kairos para pedir estratégias específicas de comunicação 
                    e interação com {friend?.name}. Ela conhece os dois designs e pode sugerir 
                    abordagens personalizadas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Section({
  icon,
  title,
  color,
  compact = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  const borderColors: Record<string, string> = {
    amber: "border-amber-500/10",
    fuchsia: "border-fuchsia-500/10",
    emerald: "border-emerald-500/10",
    sky: "border-sky-500/10",
    orange: "border-orange-500/10",
  };

  return (
    <div
      className={cn(
        "p-4 rounded-xl bg-white/[0.02] border",
        borderColors[color] || "border-white/5",
        compact && "p-3"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4 className="text-sm font-medium text-white/70">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function getTypeBgClass(tipo?: string | null): string {
  const bgMap: Record<string, string> = {
    manifestor: "bg-indigo-900/30",
    generator: "bg-amber-900/30",
    "manifesting generator": "bg-fuchsia-900/30",
    projector: "bg-emerald-900/30",
    reflector: "bg-slate-800/30",
  };
  const normalized = tipo?.toLowerCase().trim() || "";
  return bgMap[normalized] || "bg-white/10";
}

