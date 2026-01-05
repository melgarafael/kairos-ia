"use client";

import { motion } from "framer-motion";
import { BODYGRAPH_COLORS, CENTER_TYPES, type CenterName, type CenterState } from "../types";
import { CENTER_PATHS, OFFICIAL_CENTER_COLORS } from "../officialPaths";

interface CenterBaseProps {
  name: CenterName;
  state: CenterState;
  children?: React.ReactNode;
  onClick?: (event?: React.MouseEvent) => void;
  onHover?: (isHovering: boolean) => void;
  isHighlighted?: boolean;
  /** Use official absolute path instead of children */
  useOfficialPath?: boolean;
}

/**
 * Base wrapper for all center shapes
 * Handles state styling, glow effects, and interactions
 * Now supports official paths with absolute coordinates
 */
export function CenterBase({
  name,
  state,
  children,
  onClick,
  onHover,
  isHighlighted = false,
  useOfficialPath = true,
}: CenterBaseProps) {
  const isDefined = state === "defined";
  const officialColor = OFFICIAL_CENTER_COLORS[name];
  const fillColor = isDefined ? officialColor.defined : officialColor.open;
  const strokeColor = isDefined ? "rgba(0,0,0,0.8)" : "rgba(255, 255, 255, 0.25)";

  const pathContent = useOfficialPath ? (
    <path d={CENTER_PATHS[name]} />
  ) : (
    children
  );

  return (
    <motion.g
      onClick={(e) => onClick?.(e)}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      style={{ cursor: onClick ? "pointer" : "default" }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
      }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Glow filter for defined centers */}
      {isDefined && (
        <defs>
          <filter id={`glow-${name}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}

      {/* Pulse animation for defined centers */}
      {isDefined && (
        <motion.g
          animate={{
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{ filter: `url(#glow-${name})` }}
        >
          <g style={{ fill: fillColor, stroke: strokeColor, strokeWidth: 1 }}>
            {pathContent}
          </g>
        </motion.g>
      )}

      {/* Main shape */}
      <g
        style={{
          fill: fillColor,
          stroke: strokeColor,
          strokeWidth: isDefined ? 1 : 1,
          filter: isDefined ? `url(#glow-${name})` : "none",
        }}
      >
        {pathContent}
      </g>

      {/* Highlight overlay */}
      {isHighlighted && (
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            fill: "rgba(255, 255, 255, 0.15)",
            stroke: "rgba(255, 255, 255, 0.6)",
            strokeWidth: 2,
          }}
        >
          {pathContent}
        </motion.g>
      )}
    </motion.g>
  );
}
