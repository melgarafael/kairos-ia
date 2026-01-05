"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { BodygraphCanvas } from "./BodygraphCanvas";
import type { BodygraphData, PlanetPosition } from "./types";

interface BodygraphChartProps {
  // Human Design profile data
  tipo?: string;
  centros_definidos?: string[];
  centros_abertos?: string[];
  canais?: string[];
  portas?: string[];
  planetas_personalidade?: Record<string, PlanetPosition>;
  planetas_design?: Record<string, PlanetPosition>;

  // Display options
  showGates?: boolean;
  showChannels?: boolean;
  enableZoom?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Bodygraph Chart - Interactive Human Design Chart
 *
 * A beautiful, interactive visualization of the Human Design Bodygraph
 * featuring all 9 centers, 36 channels, and 64 gates.
 *
 * Features:
 * - Animated center states (defined/open)
 * - Channel connections with personality/design coloring
 * - Gate number overlays
 * - Hover tooltips with center information
 * - Click for detailed center modal
 * - Zoom and pan controls
 *
 * @example
 * <BodygraphChart
 *   tipo="Generator"
 *   centros_definidos={["Sacral", "Root", "Spleen"]}
 *   centros_abertos={["Head", "Ajna", "Throat", "G", "Heart", "Solar Plexus"]}
 *   canais={["34-57", "53-42"]}
 *   portas={["34", "57", "53", "42"]}
 * />
 */
export function BodygraphChart({
  tipo = "",
  centros_definidos = [],
  centros_abertos = [],
  canais = [],
  portas = [],
  planetas_personalidade,
  planetas_design,
  showGates = true,
  showChannels = true,
  enableZoom = true,
  compact = false,
  className = "",
}: BodygraphChartProps) {
  // Prepare data for canvas
  const bodygraphData: BodygraphData = useMemo(
    () => ({
      tipo,
      centros_definidos,
      centros_abertos,
      canais,
      portas,
      planetas_personalidade,
      planetas_design,
    }),
    [
      tipo,
      centros_definidos,
      centros_abertos,
      canais,
      portas,
      planetas_personalidade,
      planetas_design,
    ]
  );

  // Check if we have any data
  const hasData =
    centros_definidos.length > 0 ||
    centros_abertos.length > 0 ||
    portas.length > 0;

  if (!hasData) {
    return (
      <div
        className={`flex items-center justify-center ${
          compact ? "h-48" : "h-96"
        } ${className}`}
      >
        <div className="text-center text-white/40">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-white/5 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-8 h-8"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
              />
            </svg>
          </div>
          <p className="text-sm">No Human Design data available</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className={`relative ${compact ? "h-64 md:h-80" : "h-[500px] md:h-[600px]"} ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Glass background */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.03] to-transparent border border-white/[0.06] backdrop-blur-xl overflow-hidden">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-cyan-500/5" />

        {/* Chart */}
        <BodygraphCanvas
          data={bodygraphData}
          showGates={showGates}
          showChannels={showChannels}
          enableZoom={enableZoom && !compact}
          className="p-4"
        />
      </div>

      {/* Type badge */}
      {tipo && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10"
        >
          <span className="text-xs font-medium text-white/70">{tipo}</span>
        </motion.div>
      )}

      {/* Legend - only in non-compact mode */}
      {!compact && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="absolute bottom-4 left-4 right-4 flex items-center justify-center gap-4 text-[10px] text-white/50"
        >
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-white/60" />
            <span>Defined</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full border border-white/30" />
            <span>Open</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-[#654422]" />
            <span>Personality</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-[#e4b54b]" />
            <span>Design</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// Re-export types
export type { BodygraphData, CenterName, CenterState, PlanetPosition } from "./types";

