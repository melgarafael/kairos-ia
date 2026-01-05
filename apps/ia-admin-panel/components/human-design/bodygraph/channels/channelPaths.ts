import type { CenterName, ChannelConfig } from "../types";

/**
 * Channel Path Configurations
 * Maps all 36 channels with their SVG paths connecting centers
 * Coordinates based on official Bodygraph layout (400x693 viewBox)
 */

// Center visual center points (for path calculations) - Based on official SVG
export const CENTER_POSITIONS: Record<CenterName, { x: number; y: number }> = {
  head: { x: 201, y: 42 },
  ajna: { x: 201, y: 154 },
  throat: { x: 201, y: 265 },
  g: { x: 201, y: 383 },
  heart: { x: 286, y: 420 },
  spleen: { x: 47, y: 518 },
  "solar-plexus": { x: 353, y: 517 },
  sacral: { x: 201, y: 541 },
  root: { x: 201, y: 652 },
};

/**
 * All 36 Human Design Channels
 * Each channel connects two centers via specific gates
 * Paths updated to match official SVG viewBox (400x693)
 */
export const CHANNEL_CONFIGS: ChannelConfig[] = [
  // HEAD to AJNA channels (3 channels)
  {
    id: "64-47",
    gate1: 64,
    gate2: 47,
    center1: "head",
    center2: "ajna",
    path: "M 180 75 L 180 115", // Left path
  },
  {
    id: "61-24",
    gate1: 61,
    gate2: 24,
    center1: "head",
    center2: "ajna",
    path: "M 201 75 L 201 115", // Center path
  },
  {
    id: "63-4",
    gate1: 63,
    gate2: 4,
    center1: "head",
    center2: "ajna",
    path: "M 222 75 L 222 115", // Right path
  },

  // AJNA to THROAT channels (3 channels)
  {
    id: "17-62",
    gate1: 17,
    gate2: 62,
    center1: "ajna",
    center2: "throat",
    path: "M 180 155 Q 180 190 180 225",
  },
  {
    id: "43-23",
    gate1: 43,
    gate2: 23,
    center1: "ajna",
    center2: "throat",
    path: "M 201 190 L 201 225",
  },
  {
    id: "11-56",
    gate1: 11,
    gate2: 56,
    center1: "ajna",
    center2: "throat",
    path: "M 222 155 Q 222 190 222 225",
  },

  // THROAT to G CENTER channels
  {
    id: "31-7",
    gate1: 31,
    gate2: 7,
    center1: "throat",
    center2: "g",
    path: "M 180 305 L 180 330",
  },
  {
    id: "8-1",
    gate1: 8,
    gate2: 1,
    center1: "throat",
    center2: "g",
    path: "M 201 305 Q 201 320 201 335",
  },
  {
    id: "13-33",
    gate1: 13,
    gate2: 33,
    center1: "g",
    center2: "throat",
    path: "M 222 305 L 222 355",
  },

  // THROAT to SPLEEN (16-48)
  {
    id: "16-48",
    gate1: 16,
    gate2: 48,
    center1: "throat",
    center2: "spleen",
    path: "M 169 280 Q 110 380 47 480",
  },

  // THROAT to HEART (45-21)
  {
    id: "45-21",
    gate1: 45,
    gate2: 21,
    center1: "throat",
    center2: "heart",
    path: "M 233 285 Q 260 350 286 400",
  },

  // THROAT to SOLAR PLEXUS (35-36, 12-22)
  {
    id: "36-35",
    gate1: 36,
    gate2: 35,
    center1: "solar-plexus",
    center2: "throat",
    path: "M 233 250 Q 290 350 385 480",
  },
  {
    id: "22-12",
    gate1: 22,
    gate2: 12,
    center1: "solar-plexus",
    center2: "throat",
    path: "M 233 268 Q 285 360 370 490",
  },

  // G CENTER to SACRAL channels
  {
    id: "15-5",
    gate1: 15,
    gate2: 5,
    center1: "g",
    center2: "sacral",
    path: "M 180 425 L 180 500",
  },
  {
    id: "2-14",
    gate1: 2,
    gate2: 14,
    center1: "g",
    center2: "sacral",
    path: "M 201 435 L 201 500",
  },
  {
    id: "46-29",
    gate1: 46,
    gate2: 29,
    center1: "g",
    center2: "sacral",
    path: "M 222 425 L 222 500",
  },

  // G CENTER to HEART (25-51)
  {
    id: "25-51",
    gate1: 25,
    gate2: 51,
    center1: "g",
    center2: "heart",
    path: "M 244 386 Q 260 405 271 416",
  },
  {
    id: "51-25",
    gate1: 51,
    gate2: 25,
    center1: "heart",
    center2: "g",
    path: "M 261 408 Q 255 395 250 390",
  },

  // HEART to SPLEEN (26-44)
  {
    id: "26-44",
    gate1: 26,
    gate2: 44,
    center1: "heart",
    center2: "spleen",
    path: "M 259 438 Q 150 460 55 505",
  },

  // HEART to SOLAR PLEXUS (40-37)
  {
    id: "40-37",
    gate1: 40,
    gate2: 37,
    center1: "heart",
    center2: "solar-plexus",
    path: "M 312 438 Q 330 470 345 500",
  },

  // SPLEEN to SACRAL channels
  {
    id: "50-27",
    gate1: 50,
    gate2: 27,
    center1: "spleen",
    center2: "sacral",
    path: "M 79 518 Q 130 530 169 548",
  },
  {
    id: "57-34",
    gate1: 57,
    gate2: 34,
    center1: "spleen",
    center2: "sacral",
    path: "M 30 490 Q 90 500 169 523",
  },

  // SPLEEN to ROOT channels
  {
    id: "32-54",
    gate1: 32,
    gate2: 54,
    center1: "spleen",
    center2: "root",
    path: "M 57 531 Q 100 590 169 634",
  },
  {
    id: "28-38",
    gate1: 28,
    gate2: 38,
    center1: "spleen",
    center2: "root",
    path: "M 37 542 Q 80 600 169 659",
  },
  {
    id: "18-58",
    gate1: 18,
    gate2: 58,
    center1: "spleen",
    center2: "root",
    path: "M 13 554 Q 60 610 169 683",
  },

  // SACRAL to ROOT channels
  {
    id: "53-42",
    gate1: 53,
    gate2: 42,
    center1: "root",
    center2: "sacral",
    path: "M 180 620 L 180 572",
  },
  {
    id: "60-3",
    gate1: 60,
    gate2: 3,
    center1: "root",
    center2: "sacral",
    path: "M 201 620 L 201 573",
  },
  {
    id: "52-9",
    gate1: 52,
    gate2: 9,
    center1: "root",
    center2: "sacral",
    path: "M 222 620 L 222 573",
  },

  // ROOT to SOLAR PLEXUS channels
  {
    id: "19-49",
    gate1: 19,
    gate2: 49,
    center1: "root",
    center2: "solar-plexus",
    path: "M 233 634 Q 290 590 346 534",
  },
  {
    id: "39-55",
    gate1: 39,
    gate2: 55,
    center1: "root",
    center2: "solar-plexus",
    path: "M 233 659 Q 295 600 366 544",
  },
  {
    id: "41-30",
    gate1: 41,
    gate2: 30,
    center1: "root",
    center2: "solar-plexus",
    path: "M 233 683 Q 300 610 386 555",
  },

  // SACRAL to SOLAR PLEXUS (59-6)
  {
    id: "59-6",
    gate1: 59,
    gate2: 6,
    center1: "sacral",
    center2: "solar-plexus",
    path: "M 233 556 Q 270 540 320 519",
  },
];

/**
 * Get channel config by ID
 */
export function getChannelById(id: string): ChannelConfig | undefined {
  return CHANNEL_CONFIGS.find((c) => c.id === id);
}

/**
 * Get all channels connecting to a specific center
 */
export function getChannelsForCenter(center: CenterName): ChannelConfig[] {
  return CHANNEL_CONFIGS.filter(
    (c) => c.center1 === center || c.center2 === center
  );
}

/**
 * Get channel connecting two gates
 */
export function getChannelByGates(gate1: number, gate2: number): ChannelConfig | undefined {
  return CHANNEL_CONFIGS.find(
    (c) =>
      (c.gate1 === gate1 && c.gate2 === gate2) ||
      (c.gate1 === gate2 && c.gate2 === gate1)
  );
}
