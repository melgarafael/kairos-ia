"use client";

import { motion } from "framer-motion";
import { User, ChevronRight, UserPlus } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { type HdFriend, RELATIONSHIP_TYPES } from "@/lib/kairos/types";
import { resolveTypeMeta } from "@/components/human-design/type-meta";

interface FriendsListProps {
  friends: HdFriend[];
  onSelectFriend: (friend: HdFriend) => void;
}

export function FriendsList({ friends, onSelectFriend }: FriendsListProps) {
  if (friends.length === 0) {
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
          <UserPlus className="w-8 h-8 text-white/30" />
        </div>
        <h3 className="text-lg font-medium text-white/70 mb-2">
          Nenhuma pessoa adicionada
        </h3>
        <p className="text-sm text-white/40 text-center max-w-sm">
          Adicione amigos, familiares ou colegas para explorar as dinâmicas 
          de relacionamento através do Human Design.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="grid gap-3">
      {friends.map((friend, index) => (
        <FriendCard
          key={friend.id}
          friend={friend}
          index={index}
          onClick={() => onSelectFriend(friend)}
        />
      ))}
    </div>
  );
}

interface FriendCardProps {
  friend: HdFriend;
  index: number;
  onClick: () => void;
}

function FriendCard({ friend, index, onClick }: FriendCardProps) {
  const typeMeta = resolveTypeMeta(friend.tipo);
  const relationshipLabel = RELATIONSHIP_TYPES.find(
    (r) => r.value === friend.relationship_type
  )?.label || friend.relationship_type;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-xl",
        "bg-white/5 border border-white/5",
        "hover:bg-white/10 hover:border-white/10 transition-all",
        "text-left group"
      )}
    >
      {/* Avatar/Icon */}
      <div
        className={cn(
          "flex items-center justify-center w-12 h-12 rounded-xl",
          "border border-white/10",
          getTypeBgClass(friend.tipo)
        )}
      >
        {friend.tipo ? (
          <typeMeta.icon className={cn("w-6 h-6", typeMeta.accentClass)} />
        ) : (
          <User className="w-6 h-6 text-white/40" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-white/90 truncate">
          {friend.name}
        </h3>
        <div className="flex items-center gap-3 text-sm text-white/50">
          {relationshipLabel && (
            <span>{relationshipLabel}</span>
          )}
          {friend.tipo && (
            <>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className={typeMeta.accentClass}>{typeMeta.label}</span>
            </>
          )}
        </div>
      </div>

      {/* Strategy/Authority Preview */}
      {friend.estrategia && (
        <div className="hidden md:block text-right">
          <p className="text-xs text-white/30">Estratégia</p>
          <p className="text-sm text-white/60 truncate max-w-[160px]">
            {friend.estrategia}
          </p>
        </div>
      )}

      {/* Arrow */}
      <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-white/40 transition-colors" />
    </motion.button>
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
  return bgMap[normalized] || "bg-zinc-800/30";
}

