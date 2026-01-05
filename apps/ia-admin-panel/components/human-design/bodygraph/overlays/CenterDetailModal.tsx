"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { CENTER_LABELS, BODYGRAPH_COLORS, CENTER_TYPES, type CenterName, type CenterState } from "../types";

interface CenterDetailModalProps {
  center: CenterName | null;
  state: CenterState;
  gates: number[];
  isOpen: boolean;
  onClose: () => void;
}

// Extended center information
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
    defined: "You have a consistent way of being inspired and thinking about things. You provide mental inspiration to others.",
    open: "You amplify mental pressure and can be deeply inspired by many different sources. Be careful not to think about things that don't matter.",
    notSelf: "Thinking about things that don't matter. Mental anxiety.",
    biological: "Pineal gland",
  },
  ajna: {
    meaning: "Conceptualization, mental processing, and analysis.",
    defined: "You have a fixed and reliable way of processing information. Your mind works consistently.",
    open: "You can see things from many perspectives. Great potential for wisdom, but may struggle with mental certainty.",
    notSelf: "Pretending to be certain. Trying to convince others.",
    biological: "Anterior & posterior pituitary glands",
  },
  throat: {
    meaning: "Communication, manifestation, and expression.",
    defined: "You have consistent energy for communication and manifestation. Your voice has power.",
    open: "You can communicate in many different ways. Flexible expression, but may struggle with timing.",
    notSelf: "Trying to attract attention. Speaking to be heard.",
    biological: "Thyroid & parathyroid glands",
  },
  g: {
    meaning: "Identity, love, direction, and life purpose.",
    defined: "You have a fixed sense of identity and direction. Others are magnetically drawn to your path.",
    open: "You are adaptable in identity and direction. You can see who others truly are.",
    notSelf: "Searching for identity and direction. Feeling lost.",
    biological: "Blood and liver",
  },
  heart: {
    meaning: "Willpower, ego, self-worth, and material resources.",
    defined: "You have consistent access to willpower. You can make and keep promises.",
    open: "You amplify willpower and can be wise about worth. Don't make promises or compete unnecessarily.",
    notSelf: "Proving worth. Breaking promises. Over-committing.",
    biological: "Heart, stomach, gallbladder, thymus",
  },
  sacral: {
    meaning: "Life force, sexuality, fertility, and sustainable work energy.",
    defined: "You have consistent life force energy. You are designed to respond and have energy for work you love.",
    open: "You amplify sacral energy. Know when enough is enough. Don't commit to work that doesn't light you up.",
    notSelf: "Not knowing when enough is enough. Exhaustion.",
    biological: "Ovaries, testes",
  },
  spleen: {
    meaning: "Intuition, immune system, survival instincts, and spontaneous awareness.",
    defined: "You have consistent access to intuition and a strong immune system. Trust your spontaneous knowing.",
    open: "You can be highly intuitive when developed. Be careful with health and don't hold onto things too long.",
    notSelf: "Holding on to what isn't good. Fear-based decisions.",
    biological: "Lymphatic system, spleen, T-cells",
  },
  "solar-plexus": {
    meaning: "Emotional awareness, feelings, desires, and passion.",
    defined: "You operate in emotional waves. Wait for clarity before making decisions. You are an emotional being.",
    open: "You amplify emotions and can be wise about feelings. Don't avoid confrontation or make decisions to avoid emotional pain.",
    notSelf: "Avoiding truth and confrontation. Emotional volatility.",
    biological: "Lungs, kidneys, prostate, pancreas, nervous system",
  },
  root: {
    meaning: "Adrenaline, drive, pressure to evolve, and kundalini energy.",
    defined: "You have consistent access to adrenalized pressure. You can handle stress well.",
    open: "You amplify root pressure and can be in a hurry when it's not necessary. Don't rush through life.",
    notSelf: "Rushing. Being in a hurry to be free of pressure.",
    biological: "Adrenal glands",
  },
};

export function CenterDetailModal({
  center,
  state,
  gates,
  isOpen,
  onClose,
}: CenterDetailModalProps) {
  if (!center) return null;

  const centerType = CENTER_TYPES[center];
  const color = BODYGRAPH_COLORS[centerType];
  const isDefined = state === "defined";
  const info = CENTER_INFO[center];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg"
          >
            <div
              className="rounded-2xl backdrop-blur-xl border overflow-hidden mx-4"
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
                className="px-6 py-4 border-b flex items-center justify-between"
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
                      border: isDefined ? "none" : "2px solid rgba(255, 255, 255, 0.3)",
                      boxShadow: isDefined ? `0 0 12px ${color}` : "none",
                    }}
                  />
                  <div>
                    <h2
                      className="text-lg font-semibold"
                      style={{ color: isDefined ? color : "rgba(255, 255, 255, 0.9)" }}
                    >
                      {CENTER_LABELS[center]}
                    </h2>
                    <p className="text-xs text-white/50">
                      {isDefined ? "Defined Center" : "Open Center"} • {info.biological}
                    </p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
                {/* Meaning */}
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-white/40 mb-2">
                    Core Meaning
                  </h3>
                  <p className="text-white/80 leading-relaxed">{info.meaning}</p>
                </div>

                {/* State-specific info */}
                <div
                  className="p-4 rounded-xl"
                  style={{
                    backgroundColor: isDefined ? `${color}10` : "rgba(255, 255, 255, 0.03)",
                    borderLeft: `3px solid ${isDefined ? color : "rgba(255, 255, 255, 0.2)"}`,
                  }}
                >
                  <h3
                    className="text-sm font-medium mb-2"
                    style={{ color: isDefined ? color : "rgba(255, 255, 255, 0.8)" }}
                  >
                    {isDefined ? "Your Defined Center" : "Your Open Center"}
                  </h3>
                  <p className="text-sm text-white/70 leading-relaxed">
                    {isDefined ? info.defined : info.open}
                  </p>
                </div>

                {/* Not-Self Theme */}
                <div className="p-4 rounded-xl bg-red-950/20 border-l-3 border-red-500/50">
                  <h3 className="text-sm font-medium text-red-400 mb-2">
                    Not-Self Theme
                  </h3>
                  <p className="text-sm text-white/70 leading-relaxed">{info.notSelf}</p>
                </div>

                {/* Gates */}
                {gates.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-white/40 mb-3">
                      Active Gates ({gates.length})
                    </h3>
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
                          Gate {gate}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

