"use client";

import { motion } from "framer-motion";

/**
 * Channel colors following classic Human Design bodygraph style
 * - Personality: Dark brown (equivalent to "black" in traditional charts)
 * - Design: Golden/amber (equivalent to "red" in traditional charts)
 */
const CHANNEL_COLORS = {
  personality: "#654422", // Dark brown for conscious/personality
  design: "#e4b54b", // Golden amber for unconscious/design
  inactive: "rgba(255, 255, 255, 0.15)", // More visible for inactive channels
} as const;

interface ChannelProps {
  /** Fallback simple path (used when official paths not available) */
  path?: string;
  /** Official SVG path for personality stroke */
  personalityPath?: string;
  /** Official SVG path for design stroke */
  designPath?: string;
  /** Gate A is activated by personality */
  personalityActiveA?: boolean;
  /** Gate B is activated by personality */
  personalityActiveB?: boolean;
  /** Gate A is activated by design */
  designActiveA?: boolean;
  /** Gate B is activated by design */
  designActiveB?: boolean;
  /** Legacy: any personality activation (for backwards compatibility) */
  isPersonality?: boolean;
  /** Legacy: any design activation (for backwards compatibility) */
  isDesign?: boolean;
  /** Channel is active (both gates activated) */
  isActive: boolean;
  onClick?: () => void;
  onHover?: (isHovering: boolean) => void;
  isHighlighted?: boolean;
  index?: number;
}

/**
 * Channel Component
 * Renders connecting lines between centers following classic Human Design style
 * 
 * Classic bodygraph visualization:
 * - Design (unconscious): Rendered in golden/amber color
 * - Personality (conscious): Rendered in dark brown color
 * - Both active: Both paths rendered, with design underneath and personality on top
 * - Inactive: Faint gray line
 */
export function Channel({
  path,
  personalityPath,
  designPath,
  personalityActiveA = false,
  personalityActiveB = false,
  designActiveA = false,
  designActiveB = false,
  isPersonality = false,
  isDesign = false,
  isActive,
  onClick,
  onHover,
  isHighlighted = false,
  index = 0,
}: ChannelProps) {
  // Determine if we have official dual paths or just simple path
  const hasOfficialPaths = !!(personalityPath && designPath);
  
  // Calculate activation states
  // A channel has personality activation if either gate is in personality
  const hasPersonalityActivation = personalityActiveA || personalityActiveB || isPersonality;
  // A channel has design activation if either gate is in design
  const hasDesignActivation = designActiveA || designActiveB || isDesign;
  
  // Animation settings
  const animationDelay = index * 0.03;
  const glowDelay = index * 0.05;

  // Render with official dual paths (new approach)
  if (hasOfficialPaths && isActive) {
    return (
      <g>
        {/* Design path (underneath) - rendered first */}
        {hasDesignActivation && (
          <>
            {/* Design glow */}
            <motion.path
              d={designPath}
              fill={CHANNEL_COLORS.design}
              stroke="none"
              opacity={0.3}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              transition={{ 
                duration: 0.8, 
                delay: glowDelay,
                ease: [0.22, 1, 0.36, 1] 
              }}
              style={{ filter: "blur(2px)" }}
            />
            {/* Design main path */}
            <motion.path
              d={designPath}
              fill={CHANNEL_COLORS.design}
              stroke="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ 
                duration: 0.6, 
                delay: animationDelay,
                ease: [0.22, 1, 0.36, 1] 
              }}
            />
          </>
        )}

        {/* Personality path (on top) - rendered second */}
        {hasPersonalityActivation && (
          <>
            {/* Personality glow */}
            <motion.path
              d={personalityPath}
              fill={CHANNEL_COLORS.personality}
              stroke="none"
              opacity={0.3}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              transition={{ 
                duration: 0.8, 
                delay: glowDelay + 0.05,
                ease: [0.22, 1, 0.36, 1] 
              }}
              style={{ filter: "blur(2px)" }}
            />
            {/* Personality main path */}
            <motion.path
              d={personalityPath}
              fill={CHANNEL_COLORS.personality}
              stroke="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ 
                duration: 0.6, 
                delay: animationDelay + 0.05,
                ease: [0.22, 1, 0.36, 1] 
              }}
            />
          </>
        )}

        {/* Interactive overlay (invisible but captures events) */}
        <path
          d={personalityPath || designPath}
          fill="transparent"
          stroke="transparent"
          strokeWidth={12}
          onClick={onClick}
          onMouseEnter={() => onHover?.(true)}
          onMouseLeave={() => onHover?.(false)}
          style={{ cursor: onClick ? "pointer" : "default" }}
        />

        {/* Highlight overlay */}
        {isHighlighted && (
          <motion.path
            d={personalityPath || designPath}
            fill="rgba(255, 255, 255, 0.3)"
            stroke="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
          />
        )}
      </g>
    );
  }

  // Fallback: render with simple stroke path (legacy approach)
  const getStrokeColor = () => {
    if (!isActive) return CHANNEL_COLORS.inactive;
    if (hasPersonalityActivation && hasDesignActivation) return "url(#channel-gradient)";
    if (hasPersonalityActivation) return CHANNEL_COLORS.personality;
    if (hasDesignActivation) return CHANNEL_COLORS.design;
    return CHANNEL_COLORS.personality;
  };

  const strokeWidth = isActive ? 4 : 2;
  const opacity = isActive ? 1 : 0.5; // Increased opacity for inactive channels
  const fallbackPath = path || personalityPath || designPath || "";

  // Debug: log if path is missing
  if (!fallbackPath && typeof window !== "undefined") {
    console.warn("[Channel] Missing path for channel");
  }

  return (
    <g>
      {/* Background glow for active channels */}
      {isActive && (
        <motion.path
          d={fallbackPath}
          fill="none"
          stroke={getStrokeColor()}
          strokeWidth={strokeWidth + 4}
          strokeLinecap="round"
          opacity={0.2}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ 
            duration: 0.8, 
            delay: glowDelay,
            ease: [0.22, 1, 0.36, 1] 
          }}
          style={{ filter: "blur(4px)" }}
        />
      )}

      {/* Main channel path */}
      <motion.path
        d={fallbackPath}
        fill="none"
        stroke={getStrokeColor()}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        opacity={opacity}
        onClick={onClick}
        onMouseEnter={() => onHover?.(true)}
        onMouseLeave={() => onHover?.(false)}
        style={{ cursor: onClick ? "pointer" : "default" }}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity }}
        transition={{ 
          duration: 0.6, 
          delay: animationDelay,
          ease: [0.22, 1, 0.36, 1] 
        }}
        whileHover={isActive ? { strokeWidth: strokeWidth + 2 } : undefined}
      />

      {/* Highlight overlay */}
      {isHighlighted && (
        <motion.path
          d={fallbackPath}
          fill="none"
          stroke="rgba(255, 255, 255, 0.5)"
          strokeWidth={strokeWidth + 2}
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
        />
      )}
    </g>
  );
}
