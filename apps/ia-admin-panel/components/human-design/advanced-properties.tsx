"use client";

import { cn } from "@/lib/ui/cn";

type Props = {
  profile: {
    digestao?: string | null;
    sentido?: string | null;
    sentido_design?: string | null;
    motivacao?: string | null;
    perspectiva?: string | null;
    ambiente?: string | null;
    variaveis?: {
      Digestion?: string;
      Environment?: string;
      Awareness?: string;
      Perspective?: string;
    } | null;
  };
};

export function AdvancedProperties({ profile }: Props) {
  const properties = [
    { label: "Digestão", value: profile.digestao },
    { label: "Sentido", value: profile.sentido },
    { label: "Sentido Design", value: profile.sentido_design },
    { label: "Motivação", value: profile.motivacao },
    { label: "Perspectiva", value: profile.perspectiva },
    { label: "Ambiente", value: profile.ambiente },
  ].filter((p) => p.value);

  if (properties.length === 0 && !profile.variaveis) return null;

  return (
    <div className="rounded-xl bg-zinc-900/50 border border-zinc-800 p-6">
      <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
        Propriedades Avançadas
      </h3>

      {/* Variables (Arrows) */}
      {profile.variaveis && (
        <div className="flex items-center justify-center gap-6 mb-6 p-4 bg-zinc-800/50 rounded-lg">
          <VariableArrow
            direction={profile.variaveis.Digestion}
            label="Digestão"
          />
          <VariableArrow
            direction={profile.variaveis.Environment}
            label="Ambiente"
          />
          <VariableArrow
            direction={profile.variaveis.Awareness}
            label="Consciência"
          />
          <VariableArrow
            direction={profile.variaveis.Perspective}
            label="Perspectiva"
          />
        </div>
      )}

      {/* Property Grid */}
      {properties.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {properties.map(({ label, value }) => (
            <div
              key={label}
              className="flex justify-between items-center py-2 px-3 bg-zinc-800/30 rounded"
            >
              <span className="text-zinc-500 text-sm">{label}</span>
              <span className="text-zinc-200 text-sm font-medium">{value}</span>
            </div>
          ))}
        </div>
      )}
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
          "text-3xl font-bold",
          isLeft ? "text-blue-400" : "text-amber-400"
        )}
      >
        {isLeft ? "←" : "→"}
      </span>
      <span className="text-[10px] text-zinc-500 uppercase">{label}</span>
    </div>
  );
}

