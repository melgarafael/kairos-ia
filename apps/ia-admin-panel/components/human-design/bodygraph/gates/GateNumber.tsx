"use client";

import { motion } from "framer-motion";

/**
 * Gate colors following classic Human Design style
 */
const GATE_COLORS = {
  personality: "#654422", // Dark brown for conscious
  design: "#e4b54b", // Golden amber for unconscious
  both: "#ffffff", // White when both
  inactive: "rgba(255, 255, 255, 0.45)", // Visible but dimmed
  inactiveBg: "rgba(255, 255, 255, 0.08)",
} as const;

interface GateNumberProps {
  number: number;
  x: number;
  y: number;
  isPersonality: boolean;
  isDesign: boolean;
  isActive: boolean;
  onClick?: () => void;
  onHover?: (isHovering: boolean) => void;
  size?: "sm" | "md";
}

/**
 * Gate Number Component
 * Displays gate number at its position with proper coloring
 * 
 * All 64 gates are always visible:
 * - Active gates: Filled circle with appropriate color (personality/design/both)
 * - Inactive gates: Outlined circle with dimmed number
 */
export function GateNumber({
  number,
  x,
  y,
  isPersonality,
  isDesign,
  isActive,
  onClick,
  onHover,
  size = "sm",
}: GateNumberProps) {
  // Determine colors based on activation type
  const getTextColor = () => {
    if (!isActive) return GATE_COLORS.inactive;
    if (isPersonality && isDesign) return GATE_COLORS.both;
    if (isPersonality) return GATE_COLORS.personality;
    if (isDesign) return GATE_COLORS.design;
    return "rgba(255, 255, 255, 0.7)";
  };

  const getBackgroundColor = () => {
    if (!isActive) return GATE_COLORS.inactiveBg;
    if (isPersonality && isDesign) return "rgba(255, 255, 255, 0.2)";
    if (isPersonality) return `${GATE_COLORS.personality}40`;
    if (isDesign) return `${GATE_COLORS.design}40`;
    return "rgba(255, 255, 255, 0.1)";
  };

  const getStrokeColor = () => {
    if (!isActive) return "rgba(255, 255, 255, 0.2)";
    if (isPersonality && isDesign) return GATE_COLORS.both;
    if (isPersonality) return GATE_COLORS.personality;
    if (isDesign) return GATE_COLORS.design;
    return "rgba(255, 255, 255, 0.4)";
  };

  const fontSize = size === "sm" ? 8 : 10;
  const radius = size === "sm" ? 7 : 9;

  return (
    <motion.g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      style={{ cursor: onClick ? "pointer" : "default" }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: number * 0.005 }}
      whileHover={{ scale: 1.3 }}
    >
      {/* Background circle - always visible */}
      <circle
        r={radius}
        fill={getBackgroundColor()}
        stroke={getStrokeColor()}
        strokeWidth={isActive ? 1.5 : 0.5}
        opacity={isActive ? 1 : 0.6}
      />

      {/* Glow effect for active gates */}
      {isActive && (
        <circle
          r={radius + 2}
          fill="none"
          stroke={getStrokeColor()}
          strokeWidth={2}
          opacity={0.3}
          style={{ filter: "blur(2px)" }}
        />
      )}

      {/* Gate number text */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight={isActive ? 700 : 400}
        fill={getTextColor()}
        style={{ 
          fontFamily: "var(--font-mono, monospace)",
          textShadow: isActive ? "0 0 4px rgba(0,0,0,0.8)" : "none",
        }}
      >
        {number}
      </text>
    </motion.g>
  );
}
