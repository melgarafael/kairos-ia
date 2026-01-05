"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Trash2,
  RefreshCw,
  Heart,
  User,
  Sparkles,
  Target,
  Compass,
  Grid3X3,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { type HdFriend, type HdRelationship, RELATIONSHIP_TYPES } from "@/lib/kairos/types";
import { resolveTypeMeta } from "@/components/human-design/type-meta";

interface FriendDetailModalProps {
  friend: HdFriend | null;
  onClose: () => void;
  onFriendUpdated: (friend: HdFriend) => void;
  onFriendDeleted: (friendId: string) => void;
  onRelationshipGenerated: (relationship: HdRelationship) => void;
}

export function FriendDetailModal({
  friend,
  onClose,
  onFriendUpdated,
  onFriendDeleted,
  onRelationshipGenerated,
}: FriendDetailModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingRelationship, setIsGeneratingRelationship] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!friend) return null;

  const typeMeta = resolveTypeMeta(friend.tipo);
  const relationshipLabel = RELATIONSHIP_TYPES.find(
    (r) => r.value === friend.relationship_type
  )?.label || friend.relationship_type;

  const handleRefreshHD = async () => {
    setError(null);
    setIsRefreshing(true);

    try {
      const response = await fetch(`/api/friends/${friend.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recalculateHD: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao recalcular");
      }

      onFriendUpdated(data.friend);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao recalcular");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/friends/${friend.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao excluir");
      }

      onFriendDeleted(friend.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir");
      setIsDeleting(false);
    }
  };

  const handleGenerateRelationship = async () => {
    setError(null);
    setIsGeneratingRelationship(true);

    try {
      const response = await fetch(`/api/friends/${friend.id}/relationship`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao gerar análise");
      }

      onRelationshipGenerated(data.relationship);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar análise de relacionamento");
    } finally {
      setIsGeneratingRelationship(false);
    }
  };

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
            "relative w-full max-w-xl max-h-[90vh] overflow-y-auto",
            "bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl"
          )}
        >
          {/* Header with type gradient */}
          <div
            className={cn(
              "relative p-6 border-b border-white/5",
              "bg-gradient-to-br",
              getTypeGradient(friend.tipo)
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

            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div
                className={cn(
                  "flex items-center justify-center w-16 h-16 rounded-2xl",
                  "bg-white/10 border border-white/10"
                )}
              >
                {friend.tipo ? (
                  <typeMeta.icon className={cn("w-8 h-8", typeMeta.accentClass)} />
                ) : (
                  <User className="w-8 h-8 text-white/40" />
                )}
              </div>

              <div>
                <h2 className="text-xl font-semibold text-white">
                  {friend.name}
                </h2>
                {relationshipLabel && (
                  <p className="text-sm text-white/50">{relationshipLabel}</p>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}

            {/* HD Summary */}
            {friend.tipo ? (
              <div className="space-y-4">
                {/* Type & Strategy */}
                <div className="grid grid-cols-2 gap-4">
                  <InfoCard
                    icon={<Target className="w-4 h-4" />}
                    label="Tipo"
                    value={typeMeta.label}
                    accent={typeMeta.accentClass}
                  />
                  <InfoCard
                    icon={<Compass className="w-4 h-4" />}
                    label="Estratégia"
                    value={friend.estrategia || "—"}
                  />
                </div>

                {/* Authority & Profile */}
                <div className="grid grid-cols-2 gap-4">
                  <InfoCard
                    icon={<Sparkles className="w-4 h-4" />}
                    label="Autoridade"
                    value={friend.autoridade || "—"}
                  />
                  <InfoCard
                    icon={<Grid3X3 className="w-4 h-4" />}
                    label="Perfil"
                    value={friend.perfil || "—"}
                  />
                </div>

                {/* Centers */}
                {(friend.centros_definidos || friend.centros_abertos) && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <h4 className="text-sm font-medium text-white/70 mb-3">Centros</h4>
                    <div className="space-y-2 text-sm">
                      {friend.centros_definidos && friend.centros_definidos.length > 0 && (
                        <p className="text-white/60">
                          <span className="text-emerald-400">Definidos:</span>{" "}
                          {friend.centros_definidos.join(", ")}
                        </p>
                      )}
                      {friend.centros_abertos && friend.centros_abertos.length > 0 && (
                        <p className="text-white/60">
                          <span className="text-amber-400">Abertos:</span>{" "}
                          {friend.centros_abertos.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="p-4 rounded-2xl bg-white/5 inline-block mb-4">
                  <RefreshCw className="w-8 h-8 text-white/30" />
                </div>
                <p className="text-white/50 mb-4">
                  Human Design ainda não calculado
                </p>
                <button
                  onClick={handleRefreshHD}
                  disabled={isRefreshing}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium",
                    "bg-white/10 text-white hover:bg-white/20 transition-colors"
                  )}
                >
                  {isRefreshing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Calcular agora"
                  )}
                </button>
              </div>
            )}

            {/* Notes */}
            {friend.notes && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <h4 className="text-sm font-medium text-white/70 mb-2">Notas</h4>
                <p className="text-sm text-white/50 whitespace-pre-wrap">
                  {friend.notes}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/5">
              {/* Generate Relationship */}
              {friend.tipo && (
                <button
                  onClick={handleGenerateRelationship}
                  disabled={isGeneratingRelationship}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
                    "bg-gradient-to-r from-rose-600 to-fuchsia-600",
                    "text-white shadow-lg shadow-rose-500/20",
                    "hover:shadow-rose-500/30 transition-shadow",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isGeneratingRelationship ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Heart className="w-4 h-4" />
                      Analisar Relacionamento
                    </>
                  )}
                </button>
              )}

              {/* Refresh HD */}
              {friend.tipo && (
                <button
                  onClick={handleRefreshHD}
                  disabled={isRefreshing}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
                    "bg-white/10 text-white hover:bg-white/20 transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isRefreshing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Recalcular HD
                </button>
              )}

              {/* Delete */}
              <div className="flex-1" />
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/50">Confirmar?</span>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium",
                      "bg-red-600 text-white hover:bg-red-500 transition-colors"
                    )}
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Sim, excluir"
                    )}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 rounded-lg text-sm text-white/60 hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
                    "text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  )}
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function InfoCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
      <div className="flex items-center gap-2 text-white/40 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={cn("font-medium", accent || "text-white/80")}>{value}</p>
    </div>
  );
}

function getTypeGradient(tipo?: string | null): string {
  const gradientMap: Record<string, string> = {
    manifestor: "from-indigo-950/50 to-transparent",
    generator: "from-amber-950/50 to-transparent",
    "manifesting generator": "from-fuchsia-950/50 to-transparent",
    projector: "from-emerald-950/50 to-transparent",
    reflector: "from-slate-900/50 to-transparent",
  };
  const normalized = tipo?.toLowerCase().trim() || "";
  return gradientMap[normalized] || "from-zinc-800/50 to-transparent";
}

