"use client";

import { useState, useEffect, useCallback, useMemo, RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronUp } from "lucide-react";
import {
  CENTER_LABELS,
  BODYGRAPH_COLORS,
  CENTER_TYPES,
  type CenterName,
  type CenterState,
} from "../types";

interface CenterInfoCardProps {
  center: CenterName;
  state: CenterState;
  gates: number[];
  anchorPosition: { x: number; y: number };
  containerRef: RefObject<HTMLDivElement>;
  onClose: () => void;
}

// Center descriptions and detailed info
const CENTER_INFO: Record<
  CenterName,
  {
    meaning: string;
    defined: string;
    open: string;
    notSelf: string;
    biological: string;
  }
> = {
  head: {
    meaning: "Inspiration, mental pressure, and the drive to find answers.",
    defined:
      "You have a consistent way of being inspired and thinking about things. You provide mental inspiration to others.",
    open: "You amplify mental pressure and can be deeply inspired by many different sources. Be careful not to think about things that don't matter.",
    notSelf: "Thinking about things that don't matter. Mental anxiety.",
    biological: "Pineal gland",
  },
  ajna: {
    meaning: "Conceptualization, mental processing, and analysis.",
    defined:
      "You have a fixed and reliable way of processing information. Your mind works consistently.",
    open: "You can see things from many perspectives. Great potential for wisdom, but may struggle with mental certainty.",
    notSelf: "Pretending to be certain. Trying to convince others.",
    biological: "Anterior & posterior pituitary glands",
  },
  throat: {
    meaning: "Communication, manifestation, and expression.",
    defined:
      "You have consistent energy for communication and manifestation. Your voice has power.",
    open: "You can communicate in many different ways. Flexible expression, but may struggle with timing.",
    notSelf: "Trying to attract attention. Speaking to be heard.",
    biological: "Thyroid & parathyroid glands",
  },
  g: {
    meaning: "Identity, love, direction, and life purpose.",
    defined:
      "You have a fixed sense of identity and direction. Others are magnetically drawn to your path.",
    open: "You are adaptable in identity and direction. You can see who others truly are.",
    notSelf: "Searching for identity and direction. Feeling lost.",
    biological: "Blood and liver",
  },
  heart: {
    meaning: "Willpower, ego, self-worth, and material resources.",
    defined:
      "You have consistent access to willpower. You can make and keep promises.",
    open: "You amplify willpower and can be wise about worth. Don't make promises or compete unnecessarily.",
    notSelf: "Proving worth. Breaking promises. Over-committing.",
    biological: "Heart, stomach, gallbladder, thymus",
  },
  sacral: {
    meaning: "Life force, sexuality, fertility, and sustainable work energy.",
    defined:
      "You have consistent life force energy. You are designed to respond and have energy for work you love.",
    open: "You amplify sacral energy. Know when enough is enough. Don't commit to work that doesn't light you up.",
    notSelf: "Not knowing when enough is enough. Exhaustion.",
    biological: "Ovaries, testes",
  },
  spleen: {
    meaning:
      "Intuition, immune system, survival instincts, and spontaneous awareness.",
    defined:
      "You have consistent access to intuition and a strong immune system. Trust your spontaneous knowing.",
    open: "You can be highly intuitive when developed. Be careful with health and don't hold onto things too long.",
    notSelf: "Holding on to what isn't good. Fear-based decisions.",
    biological: "Lymphatic system, spleen, T-cells",
  },
  "solar-plexus": {
    meaning: "Emotional awareness, feelings, desires, and passion.",
    defined:
      "You operate in emotional waves. Wait for clarity before making decisions. You are an emotional being.",
    open: "You amplify emotions and can be wise about feelings. Don't avoid confrontation or make decisions to avoid emotional pain.",
    notSelf: "Avoiding truth and confrontation. Emotional volatility.",
    biological: "Lungs, kidneys, prostate, pancreas, nervous system",
  },
  root: {
    meaning: "Adrenaline, drive, pressure to evolve, and kundalini energy.",
    defined:
      "You have consistent access to adrenalized pressure. You can handle stress well.",
    open: "You amplify root pressure and can be in a hurry when it's not necessary. Don't rush through life.",
    notSelf: "Rushing. Being in a hurry to be free of pressure.",
    biological: "Adrenal glands",
  },
};

// Card dimensions
const CARD_WIDTH = 320;
const CARD_HEIGHT = 380;
const OFFSET = 16;
const MOBILE_BREAKPOINT = 768;

/**
 * Calculate safe position for the info card
 * Ensures the card stays within viewport bounds
 */
function calculateSafePosition(
  anchor: { x: number; y: number },
  containerRect: DOMRect
): { x: number; y: number; placement: "right" | "left" | "bottom" } {
  let x = anchor.x + OFFSET;
  let y = anchor.y;
  let placement: "right" | "left" | "bottom" = "right";

  // Check if card would overflow right
  if (x + CARD_WIDTH > containerRect.width) {
    // Try placing on the left
    x = anchor.x - CARD_WIDTH - OFFSET;
    placement = "left";

    // If it still overflows left, center it
    if (x < 0) {
      x = Math.max(OFFSET, (containerRect.width - CARD_WIDTH) / 2);
      placement = "bottom";
    }
  }

  // Adjust vertical position to stay in bounds
  if (y + CARD_HEIGHT > containerRect.height) {
    y = containerRect.height - CARD_HEIGHT - OFFSET;
  }

  // Ensure y is not negative
  y = Math.max(OFFSET, y);

  return { x, y, placement };
}

export function CenterInfoCard({
  center,
  state,
  gates,
  anchorPosition,
  containerRef,
  onClose,
}: CenterInfoCardProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Calculate card position
  const position = useMemo(() => {
    if (isMobile || !containerRef.current) {
      return null; // Will use mobile fixed positioning
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    return calculateSafePosition(anchorPosition, containerRect);
  }, [anchorPosition, containerRef, isMobile]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const centerType = CENTER_TYPES[center];
  const color = BODYGRAPH_COLORS[centerType];
  const isDefined = state === "defined";
  const info = CENTER_INFO[center];

  // Mobile slide-up panel
  if (isMobile) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        />
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: isExpanded ? 0 : "calc(100% - 80px)" }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 max-h-[75vh]"
        >
          <div
            className="rounded-t-3xl backdrop-blur-xl border-t border-x overflow-hidden"
            style={{
              background: "rgba(10, 10, 10, 0.98)",
              borderColor: isDefined ? `${color}40` : "rgba(255, 255, 255, 0.1)",
            }}
          >
            {/* Drag handle */}
            <div
              className="flex justify-center py-3 cursor-pointer"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div
              className="px-5 pb-4 flex items-center justify-between"
              onClick={() => setIsExpanded(true)}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{
                    backgroundColor: isDefined ? color : "transparent",
                    border: isDefined
                      ? "none"
                      : "2px solid rgba(255, 255, 255, 0.3)",
                    boxShadow: isDefined ? `0 0 12px ${color}` : "none",
                  }}
                />
                <div>
                  <h2
                    className="text-lg font-semibold"
                    style={{
                      color: isDefined ? color : "rgba(255, 255, 255, 0.9)",
                    }}
                  >
                    {CENTER_LABELS[center]}
                  </h2>
                  <p className="text-xs text-white/50">
                    {isDefined ? "Defined Center" : "Open Center"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <ChevronUp
                    className={`w-5 h-5 text-white/60 transition-transform ${
                      isExpanded ? "" : "rotate-180"
                    }`}
                  />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>
            </div>

            {/* Content */}
            {isExpanded && (
              <div className="px-5 pb-6 space-y-4 overflow-y-auto max-h-[calc(75vh-100px)]">
                <p className="text-white/70 text-sm leading-relaxed">
                  {info.meaning}
                </p>

                <div
                  className="p-4 rounded-xl"
                  style={{
                    backgroundColor: isDefined
                      ? `${color}10`
                      : "rgba(255, 255, 255, 0.03)",
                    borderLeft: `3px solid ${
                      isDefined ? color : "rgba(255, 255, 255, 0.2)"
                    }`,
                  }}
                >
                  <h3
                    className="text-sm font-medium mb-2"
                    style={{
                      color: isDefined ? color : "rgba(255, 255, 255, 0.8)",
                    }}
                  >
                    {isDefined ? "Your Defined Center" : "Your Open Center"}
                  </h3>
                  <p className="text-sm text-white/70 leading-relaxed">
                    {isDefined ? info.defined : info.open}
                  </p>
                </div>

                {gates.length > 0 && (
                  <div>
                    <span className="text-xs uppercase tracking-wider text-white/40 block mb-2">
                      Active Gates
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {gates.map((gate) => (
                        <span
                          key={gate}
                          className="text-sm px-3 py-1.5 rounded-lg font-mono"
                          style={{
                            backgroundColor: `${color}15`,
                            color: color,
                            border: `1px solid ${color}30`,
                          }}
                        >
                          {gate}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Desktop positioned card
  if (!position) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, x: position.placement === "left" ? 20 : -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "absolute",
          left: position.x,
          top: position.y,
          width: CARD_WIDTH,
          zIndex: 50,
        }}
        className="pointer-events-auto"
      >
        <div
          className="rounded-2xl backdrop-blur-xl border overflow-hidden shadow-2xl"
          style={{
            background: "rgba(10, 10, 10, 0.95)",
            borderColor: isDefined ? `${color}40` : "rgba(255, 255, 255, 0.1)",
            boxShadow: isDefined
              ? `0 24px 64px ${color}30, 0 0 0 1px ${color}15`
              : "0 24px 64px rgba(0, 0, 0, 0.5)",
          }}
        >
          {/* Header */}
          <div
            className="px-5 py-4 border-b flex items-center justify-between"
            style={{
              borderColor: isDefined ? `${color}20` : "rgba(255, 255, 255, 0.1)",
              background: isDefined ? `${color}10` : "transparent",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{
                  backgroundColor: isDefined ? color : "transparent",
                  border: isDefined
                    ? "none"
                    : "2px solid rgba(255, 255, 255, 0.3)",
                  boxShadow: isDefined ? `0 0 12px ${color}` : "none",
                }}
              />
              <div>
                <h2
                  className="text-base font-semibold"
                  style={{
                    color: isDefined ? color : "rgba(255, 255, 255, 0.9)",
                  }}
                >
                  {CENTER_LABELS[center]}
                </h2>
                <p className="text-xs text-white/50">
                  {isDefined ? "Defined" : "Open"} • {info.biological}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 py-4 space-y-4 max-h-[320px] overflow-y-auto">
            {/* Meaning */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-white/40 mb-1.5">
                Core Meaning
              </h3>
              <p className="text-sm text-white/80 leading-relaxed">
                {info.meaning}
              </p>
            </div>

            {/* State-specific info */}
            <div
              className="p-3 rounded-xl"
              style={{
                backgroundColor: isDefined
                  ? `${color}10`
                  : "rgba(255, 255, 255, 0.03)",
                borderLeft: `3px solid ${
                  isDefined ? color : "rgba(255, 255, 255, 0.2)"
                }`,
              }}
            >
              <h3
                className="text-xs font-medium mb-1.5"
                style={{
                  color: isDefined ? color : "rgba(255, 255, 255, 0.8)",
                }}
              >
                {isDefined ? "Your Defined Center" : "Your Open Center"}
              </h3>
              <p className="text-xs text-white/70 leading-relaxed">
                {isDefined ? info.defined : info.open}
              </p>
            </div>

            {/* Not-Self Theme */}
            <div className="p-3 rounded-xl bg-red-950/20 border-l-[3px] border-red-500/50">
              <h3 className="text-xs font-medium text-red-400 mb-1.5">
                Not-Self Theme
              </h3>
              <p className="text-xs text-white/70 leading-relaxed">
                {info.notSelf}
              </p>
            </div>

            {/* Gates */}
            {gates.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-wider text-white/40 mb-2">
                  Active Gates ({gates.length})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {gates.map((gate) => (
                    <span
                      key={gate}
                      className="text-xs px-2 py-1 rounded-lg font-mono"
                      style={{
                        backgroundColor: `${color}15`,
                        color: color,
                        border: `1px solid ${color}30`,
                      }}
                    >
                      {gate}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Connection line to anchor */}
        {position.placement !== "bottom" && (
          <svg
            className="absolute pointer-events-none"
            style={{
              left: position.placement === "left" ? CARD_WIDTH : -OFFSET,
              top: 20,
              width: OFFSET,
              height: 2,
            }}
          >
            <line
              x1={0}
              y1={1}
              x2={OFFSET}
              y2={1}
              stroke={isDefined ? color : "rgba(255, 255, 255, 0.2)"}
              strokeWidth={2}
              strokeDasharray="4 2"
            />
          </svg>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

