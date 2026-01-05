import { cn } from "@/lib/ui/cn";
import { resolveTypeMeta } from "./type-meta";

type Props = {
  type?: string | null;
  className?: string;
};

export function HumanDesignTypeBadge({ type, className }: Props) {
  const meta = resolveTypeMeta(type);
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium",
        meta.badgeClass,
        className
      )}
      aria-label={`Tipo Human Design: ${meta.label}`}
    >
      <Icon size={16} />
      <span>{meta.label}</span>
    </span>
  );
}

