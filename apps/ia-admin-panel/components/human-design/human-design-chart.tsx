"use client";

import { cn } from "@/lib/ui/cn";
import { resolveTypeMeta } from "./type-meta";

type Props = {
  tipo?: string | null;
  className?: string;
};

/**
 * Bodygraph visual placeholder
 * Ready for future SVG/canvas implementation
 */
export function HumanDesignChart({ tipo, className }: Props) {
  const meta = resolveTypeMeta(tipo);

  return (
    <div
      className={cn(
        "relative aspect-[3/4] rounded-xl overflow-hidden",
        "bg-gradient-to-b from-white/[0.03] to-transparent",
        "border border-white/5",
        className
      )}
    >
      {/* Background grid pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* Placeholder content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
        <div
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center mb-4",
            "bg-white/5 border border-white/10"
          )}
        >
          <meta.icon className={cn("w-6 h-6", meta.accentClass)} />
        </div>
        
        <p className="text-xs uppercase tracking-[0.2em] text-white/30 mb-1">
          Bodygraph
        </p>
        <p className={cn("text-sm font-medium", meta.accentClass)}>
          {meta.label}
        </p>
        
        <p className="mt-4 text-[10px] text-white/20 max-w-[140px]">
          Visualização em breve
        </p>
      </div>
    </div>
  );
}
