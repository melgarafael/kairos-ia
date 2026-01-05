"use client";

import { motion } from "framer-motion";
import { Heart, Sparkles, ChevronRight, Users2 } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { type HdRelationship, RELATIONSHIP_TYPES } from "@/lib/kairos/types";
import { resolveTypeMeta } from "@/components/human-design/type-meta";

interface RelationshipsListProps {
  relationships: HdRelationship[];
  onSelectRelationship: (relationship: HdRelationship) => void;
}

export function RelationshipsList({ relationships, onSelectRelationship }: RelationshipsListProps) {
  if (relationships.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          "flex flex-col items-center justify-center py-16",
          "rounded-2xl border border-dashed border-white/10 bg-white/[0.02]"
        )}
      >
        <div className="p-4 rounded-2xl bg-white/5 mb-4">
          <Heart className="w-8 h-8 text-white/30" />
        </div>
        <h3 className="text-lg font-medium text-white/70 mb-2">
          Nenhum relacionamento analisado
        </h3>
        <p className="text-sm text-white/40 text-center max-w-sm">
          Adicione pessoas e gere análises de relacionamento para entender 
          melhor suas dinâmicas interpessoais.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="grid gap-3">
      {relationships.map((relationship, index) => (
        <RelationshipCard
          key={relationship.id}
          relationship={relationship}
          index={index}
          onClick={() => onSelectRelationship(relationship)}
        />
      ))}
    </div>
  );
}

interface RelationshipCardProps {
  relationship: HdRelationship;
  index: number;
  onClick: () => void;
}

function RelationshipCard({ relationship, index, onClick }: RelationshipCardProps) {
  const friend = relationship.friend;
  const typeMeta = friend?.tipo ? resolveTypeMeta(friend.tipo) : null;
  const relationshipLabel = RELATIONSHIP_TYPES.find(
    (r) => r.value === friend?.relationship_type
  )?.label || friend?.relationship_type;

  // Get first key theme as preview
  const keyThemePreview = relationship.key_themes?.[0];

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-xl",
        "bg-gradient-to-br from-rose-950/20 to-fuchsia-950/10",
        "border border-rose-500/10",
        "hover:border-rose-500/20 hover:from-rose-950/30 transition-all",
        "text-left group"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex items-center justify-center w-12 h-12 rounded-xl",
          "bg-rose-500/10 border border-rose-500/20"
        )}
      >
        <Users2 className="w-6 h-6 text-rose-400" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-white/60">Você</span>
          <Heart className="w-3 h-3 text-rose-400" />
          <span className="font-medium text-white/90 truncate">
            {friend?.name || "Pessoa"}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-white/50">
          {relationshipLabel && (
            <span>{relationshipLabel}</span>
          )}
          {typeMeta && (
            <>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className={typeMeta.accentClass}>{typeMeta.label}</span>
            </>
          )}
        </div>
      </div>

      {/* Key Theme Preview */}
      {keyThemePreview && (
        <div className="hidden md:flex items-start gap-2 max-w-[200px]">
          <Sparkles className="w-4 h-4 text-rose-400/60 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-white/40 line-clamp-2">
            {keyThemePreview}
          </p>
        </div>
      )}

      {/* Arrow */}
      <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-white/40 transition-colors" />
    </motion.button>
  );
}

