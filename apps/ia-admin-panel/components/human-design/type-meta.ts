import {
  Zap,
  Flame,
  Sparkles,
  Eye,
  MoonStar,
  type LucideIcon
} from "lucide-react";

type TypeKey = "manifestor" | "generator" | "manifesting generator" | "projector" | "reflector";

type TypeMeta = {
  label: string;
  icon: LucideIcon;
  badgeClass: string;
  accentClass: string;
};

export const HUMAN_DESIGN_TYPE_META: Record<TypeKey, TypeMeta> = {
  manifestor: {
    label: "Manifestor",
    icon: Zap,
    badgeClass: "bg-indigo-900/70 text-indigo-50 border-indigo-500/60",
    accentClass: "text-indigo-200"
  },
  generator: {
    label: "Generator",
    icon: Flame,
    badgeClass: "bg-amber-900/60 text-amber-50 border-amber-500/60",
    accentClass: "text-amber-200"
  },
  "manifesting generator": {
    label: "Manifesting Generator",
    icon: Sparkles,
    badgeClass: "bg-fuchsia-900/60 text-fuchsia-50 border-fuchsia-500/60",
    accentClass: "text-fuchsia-200"
  },
  projector: {
    label: "Projector",
    icon: Eye,
    badgeClass: "bg-emerald-900/60 text-emerald-50 border-emerald-500/60",
    accentClass: "text-emerald-200"
  },
  reflector: {
    label: "Reflector",
    icon: MoonStar,
    badgeClass: "bg-slate-800/70 text-slate-50 border-slate-400/60",
    accentClass: "text-slate-200"
  }
};

export function resolveTypeMeta(rawType?: string | null): TypeMeta {
  const normalized = normalizeType(rawType);
  if (normalized && HUMAN_DESIGN_TYPE_META[normalized]) {
    return HUMAN_DESIGN_TYPE_META[normalized];
  }
  return {
    label: rawType?.trim() || "Seu tipo",
    icon: Sparkles,
    badgeClass: "bg-slate-800/60 text-slate-50 border-slate-500/50",
    accentClass: "text-slate-200"
  };
}

function normalizeType(value?: string | null): TypeKey | null {
  if (!value) return null;
  const v = value.toLowerCase().trim();
  if (v === "mg" || v === "manifesting generator") return "manifesting generator";
  if (v === "generator") return "generator";
  if (v === "manifestor") return "manifestor";
  if (v === "projector") return "projector";
  if (v === "reflector") return "reflector";
  return null;
}

