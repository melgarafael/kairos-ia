"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CENTER_LABELS, BODYGRAPH_COLORS, CENTER_TYPES, type CenterName, type CenterState } from "../types";

interface CenterTooltipProps {
  center: CenterName;
  state: CenterState;
  gates: number[];
  position: { x: number; y: number };
  isVisible: boolean;
}

// Center descriptions for tooltips
const CENTER_DESCRIPTIONS: Record<CenterName, string> = {
  head: "Inspiration & mental pressure. Questions drive thoughts.",
  ajna: "Conceptualization & analysis. Processing information.",
  throat: "Communication & manifestation. Expression of self.",
  g: "Identity & direction. Love, self, and life purpose.",
  heart: "Willpower & ego. Material world and value.",
  sacral: "Life force & sexuality. Sustainable energy source.",
  spleen: "Intuition & immune system. Moment-to-moment awareness.",
  "solar-plexus": "Emotional awareness. Wave patterns and clarity.",
  root: "Adrenaline & drive. Pressure to evolve and survive.",
};

export function CenterTooltip({
  center,
  state,
  gates,
  position,
  isVisible,
}: CenterTooltipProps) {
  const centerType = CENTER_TYPES[center];
  const color = BODYGRAPH_COLORS[centerType];
  const isDefined = state === "defined";

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "absolute",
            left: position.x,
            top: position.y,
            transform: "translate(-50%, -100%)",
            marginTop: -12,
            zIndex: 50,
          }}
        >
          <div
            className="rounded-xl backdrop-blur-xl border px-4 py-3 shadow-2xl min-w-[200px] max-w-[280px]"
            style={{
              background: "rgba(0, 0, 0, 0.85)",
              borderColor: isDefined ? color : "rgba(255, 255, 255, 0.1)",
              boxShadow: isDefined
                ? `0 8px 32px ${color}40, 0 0 0 1px ${color}20`
                : "0 8px 32px rgba(0, 0, 0, 0.4)",
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: isDefined ? color : "transparent",
                  border: isDefined ? "none" : "1px solid rgba(255, 255, 255, 0.3)",
                }}
              />
              <span
                className="font-semibold text-sm"
                style={{ color: isDefined ? color : "rgba(255, 255, 255, 0.8)" }}
              >
                {CENTER_LABELS[center]}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full ml-auto"
                style={{
                  backgroundColor: isDefined
                    ? `${color}20`
                    : "rgba(255, 255, 255, 0.05)",
                  color: isDefined ? color : "rgba(255, 255, 255, 0.5)",
                }}
              >
                {isDefined ? "Defined" : "Open"}
              </span>
            </div>

            {/* Description */}
            <p className="text-xs text-white/60 leading-relaxed mb-3">
              {CENTER_DESCRIPTIONS[center]}
            </p>

            {/* Gates */}
            {gates.length > 0 && (
              <div className="border-t border-white/10 pt-2">
                <span className="text-[10px] uppercase tracking-wider text-white/40 block mb-1">
                  Active Gates
                </span>
                <div className="flex flex-wrap gap-1">
                  {gates.map((gate) => (
                    <span
                      key={gate}
                      className="text-xs px-1.5 py-0.5 rounded font-mono"
                      style={{
                        backgroundColor: `${color}20`,
                        color: color,
                      }}
                    >
                      {gate}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tooltip arrow */}
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-full"
            style={{
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: `6px solid ${isDefined ? color : "rgba(0, 0, 0, 0.85)"}`,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

