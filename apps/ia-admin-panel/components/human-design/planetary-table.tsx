"use client";

import { cn } from "@/lib/ui/cn";

type PlanetData = {
  Gate: number;
  Line: number;
  Color?: number;
  Tone?: number;
  Base?: number;
  FixingState?: string;
};

type Props = {
  title: string;
  planets: Record<string, PlanetData>;
  variant?: "design" | "personality";
};

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
  "Sun",
  "Earth",
  "North Node",
  "South Node",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
  "Pluto",
  "Chiron",
];

export function PlanetaryTable({
  title,
  planets,
  variant = "personality",
}: Props) {
  const isDesign = variant === "design";

  return (
    <div
      className={cn(
        "rounded-lg overflow-hidden",
        isDesign ? "bg-amber-900/30 border border-amber-800/50" : "bg-zinc-800/50 border border-zinc-700/50"
      )}
    >
      <div
        className={cn(
          "px-4 py-2 text-xs font-semibold uppercase tracking-wider",
          isDesign ? "bg-amber-900/50 text-amber-200" : "bg-zinc-700/50 text-zinc-300"
        )}
      >
        {title}
      </div>
      <div className="p-3 space-y-1">
        {PLANET_ORDER.map((planetName) => {
          const data = planets[planetName];
          if (!data) return null;

          return (
            <div
              key={planetName}
              className={cn(
                "flex items-center justify-between py-1.5 px-2 rounded text-sm",
                isDesign ? "hover:bg-amber-900/30" : "hover:bg-zinc-700/30"
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "text-lg w-6 text-center",
                    isDesign ? "text-amber-300" : "text-zinc-400"
                  )}
                >
                  {PLANET_SYMBOLS[planetName]}
                </span>
                <span
                  className={cn(
                    "font-mono text-base",
                    isDesign ? "text-amber-100" : "text-zinc-200"
                  )}
                >
                  {data.Gate}.{data.Line}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {data.FixingState === "Exalted" && (
                  <span className="text-green-400 text-xs" title="Exalted">
                    ▲
                  </span>
                )}
                {data.FixingState === "Detriment" && (
                  <span className="text-red-400 text-xs" title="Detriment">
                    ▼
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

