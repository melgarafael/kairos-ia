/**
 * Bodygraph Chart Types
 * Based on Human Design System specifications
 */

export type CenterName =
  | "head"
  | "ajna"
  | "throat"
  | "g"
  | "heart"
  | "sacral"
  | "spleen"
  | "solar-plexus"
  | "root";

export type CenterType = "motor" | "awareness" | "pressure" | "identity" | "communication";

export type CenterState = "defined" | "open";

export interface CenterData {
  name: CenterName;
  type: CenterType;
  state: CenterState;
  gates: number[];
}

export interface ChannelData {
  id: string; // e.g., "13-33"
  gate1: number;
  gate2: number;
  isPersonality: boolean;
  isDesign: boolean;
  // Both true = full channel (black + red overlay)
}

export interface GateData {
  number: number;
  center: CenterName;
  line?: number;
  isPersonality: boolean;
  isDesign: boolean;
}

export interface PlanetPosition {
  Gate: number;
  Line: number;
  Color?: number;
  Tone?: number;
  Base?: number;
  FixingState?: "None" | "Exalted" | "Detriment";
}

export interface BodygraphData {
  tipo: string;
  centros_definidos: string[];
  centros_abertos: string[];
  canais: string[]; // ["13-33", "25-51"]
  portas: string[]; // ["13", "33", "25", "51"]
  planetas_personalidade?: Record<string, PlanetPosition>;
  planetas_design?: Record<string, PlanetPosition>;
}

// Center visual configuration
export interface CenterConfig {
  name: CenterName;
  label: string;
  type: CenterType;
  x: number;
  y: number;
  width: number;
  height: number;
  gates: number[];
}

// Channel path configuration
export interface ChannelConfig {
  id: string;
  gate1: number;
  gate2: number;
  center1: CenterName;
  center2: CenterName;
  path: string; // SVG path d attribute
}

// Color palette for the bodygraph
export const BODYGRAPH_COLORS = {
  // Center types
  motor: "#f59e0b", // Amber
  awareness: "#10b981", // Emerald
  pressure: "#8b5cf6", // Violet
  identity: "#f472b6", // Pink
  communication: "#06b6d4", // Cyan

  // States
  defined: {
    fill: "currentColor",
    stroke: "currentColor",
    glow: "0 0 20px currentColor",
  },
  open: {
    fill: "transparent",
    stroke: "rgba(255, 255, 255, 0.3)",
    glow: "none",
  },

  // Channels
  personality: "#1a1a1a", // Black
  design: "#dc2626", // Red
  both: "url(#channel-gradient)", // Gradient

  // Background
  background: "rgba(0, 0, 0, 0.4)",
  grid: "rgba(255, 255, 255, 0.03)",
} as const;

// Center type mapping
export const CENTER_TYPES: Record<CenterName, CenterType> = {
  head: "pressure",
  ajna: "awareness",
  throat: "communication",
  g: "identity",
  heart: "motor",
  sacral: "motor",
  spleen: "awareness",
  "solar-plexus": "awareness", // Also motor
  root: "pressure", // Also motor
};

// Human-readable center names
export const CENTER_LABELS: Record<CenterName, string> = {
  head: "Head",
  ajna: "Ajna",
  throat: "Throat",
  g: "G Center",
  heart: "Heart",
  sacral: "Sacral",
  spleen: "Spleen",
  "solar-plexus": "Solar Plexus",
  root: "Root",
};

