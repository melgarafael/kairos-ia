import type { CenterName } from "../types";

/**
 * Gate positions based on the official Bodygraph SVG
 * Coordinates match the 400x693 viewBox
 */

interface GatePosition {
  gate: number;
  center: CenterName;
  x: number;
  y: number;
}

/**
 * All 64 gates mapped to their visual positions
 * Positions extracted from official Human Design Bodygraph SVG
 */
export const GATE_POSITIONS: GatePosition[] = [
  // HEAD CENTER GATES (64, 61, 63)
  { gate: 64, center: "head", x: 181, y: 74 },
  { gate: 61, center: "head", x: 201, y: 74 },
  { gate: 63, center: "head", x: 222, y: 74 },

  // AJNA CENTER GATES (47, 24, 4, 17, 43, 11)
  { gate: 47, center: "ajna", x: 180, y: 123 },
  { gate: 24, center: "ajna", x: 201, y: 123 },
  { gate: 4, center: "ajna", x: 222, y: 123 },
  { gate: 17, center: "ajna", x: 180, y: 148 },
  { gate: 43, center: "ajna", x: 201, y: 182 },
  { gate: 11, center: "ajna", x: 221, y: 148 },

  // THROAT CENTER GATES (62, 23, 56, 35, 12, 45, 33, 8, 31, 20, 16)
  { gate: 62, center: "throat", x: 180, y: 234 },
  { gate: 23, center: "throat", x: 201, y: 234 },
  { gate: 56, center: "throat", x: 222, y: 234 },
  { gate: 16, center: "throat", x: 169, y: 248 },
  { gate: 20, center: "throat", x: 169, y: 280 },
  { gate: 31, center: "throat", x: 180, y: 297 },
  { gate: 8, center: "throat", x: 201, y: 297 },
  { gate: 33, center: "throat", x: 221, y: 297 },
  { gate: 35, center: "throat", x: 233, y: 248 },
  { gate: 12, center: "throat", x: 233, y: 267 },
  { gate: 45, center: "throat", x: 233, y: 286 },

  // G CENTER GATES (1, 13, 25, 46, 2, 15, 10, 7)
  { gate: 1, center: "g", x: 201, y: 339 },
  { gate: 7, center: "g", x: 180, y: 358 },
  { gate: 13, center: "g", x: 222, y: 359 },
  { gate: 10, center: "g", x: 155, y: 383 },
  { gate: 25, center: "g", x: 244, y: 386 },
  { gate: 15, center: "g", x: 181, y: 408 },
  { gate: 46, center: "g", x: 221, y: 408 },
  { gate: 2, center: "g", x: 201, y: 428 },

  // HEART CENTER GATES (21, 40, 26, 51)
  { gate: 21, center: "heart", x: 286, y: 405 },
  { gate: 51, center: "heart", x: 271, y: 423 },
  { gate: 26, center: "heart", x: 259, y: 438 },
  { gate: 40, center: "heart", x: 312, y: 438 },

  // SPLEEN CENTER GATES (48, 57, 44, 50, 32, 28, 18)
  { gate: 48, center: "spleen", x: 12, y: 481 },
  { gate: 57, center: "spleen", x: 30, y: 492 },
  { gate: 44, center: "spleen", x: 55, y: 505 },
  { gate: 50, center: "spleen", x: 79, y: 518 },
  { gate: 32, center: "spleen", x: 57, y: 531 },
  { gate: 28, center: "spleen", x: 37, y: 542 },
  { gate: 18, center: "spleen", x: 13, y: 554 },

  // SACRAL CENTER GATES (5, 14, 29, 59, 9, 3, 42, 27, 34)
  { gate: 5, center: "sacral", x: 180, y: 509 },
  { gate: 14, center: "sacral", x: 200, y: 509 },
  { gate: 29, center: "sacral", x: 222, y: 509 },
  { gate: 34, center: "sacral", x: 169, y: 524 },
  { gate: 27, center: "sacral", x: 169, y: 556 },
  { gate: 59, center: "sacral", x: 233, y: 556 },
  { gate: 42, center: "sacral", x: 180, y: 573 },
  { gate: 3, center: "sacral", x: 200, y: 573 },
  { gate: 9, center: "sacral", x: 221, y: 573 },

  // SOLAR PLEXUS CENTER GATES (6, 37, 22, 36, 30, 55, 49)
  { gate: 36, center: "solar-plexus", x: 389, y: 482 },
  { gate: 22, center: "solar-plexus", x: 372, y: 491 },
  { gate: 37, center: "solar-plexus", x: 345, y: 506 },
  { gate: 6, center: "solar-plexus", x: 320, y: 519 },
  { gate: 49, center: "solar-plexus", x: 346, y: 534 },
  { gate: 55, center: "solar-plexus", x: 366, y: 544 },
  { gate: 30, center: "solar-plexus", x: 386, y: 556 },

  // ROOT CENTER GATES (53, 60, 52, 19, 39, 41, 58, 38, 54)
  { gate: 53, center: "root", x: 180, y: 620 },
  { gate: 60, center: "root", x: 201, y: 620 },
  { gate: 52, center: "root", x: 222, y: 620 },
  { gate: 54, center: "root", x: 169, y: 635 },
  { gate: 38, center: "root", x: 169, y: 659 },
  { gate: 58, center: "root", x: 169, y: 683 },
  { gate: 19, center: "root", x: 233, y: 634 },
  { gate: 39, center: "root", x: 233, y: 659 },
  { gate: 41, center: "root", x: 233, y: 683 },
];

/**
 * Get gate position by gate number
 */
export function getGatePosition(gateNumber: number): GatePosition | undefined {
  return GATE_POSITIONS.find((g) => g.gate === gateNumber);
}

/**
 * Get all gates for a center
 */
export function getGatesForCenter(center: CenterName): GatePosition[] {
  return GATE_POSITIONS.filter((g) => g.center === center);
}
