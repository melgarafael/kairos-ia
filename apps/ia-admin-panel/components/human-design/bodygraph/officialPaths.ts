/**
 * Official Bodygraph SVG Paths
 * Extracted from the official Human Design bodygraph chart SVG
 * ViewBox: 0 0 400 693
 */

import type { CenterName } from "./types";

/**
 * Official center paths extracted from the reference SVG
 * Each path is the exact d-attribute from the official bodygraph
 */
export const CENTER_PATHS: Record<CenterName, string> = {
  // Head Center - Triangle pointing down (vertex at top)
  head: "m197.71506,2.73446l-44.62799,73.18601c-1.33609,2.25299-.82085,5.10021,1.22829,6.78741.68773.54817,1.56415.82892,2.45658.78695h89.256c2.35423,0,4.40139-2.1641,4.40139-4.82005.03967-1.08493-.28315-2.15357-.92121-3.04942L204.98247,2.73446c-1.01992-1.92547-3.47094-2.6918-5.47451-1.71163-.19736.09655-.38617.20841-.5646.33448-.47159.40428-.8847.86745-1.22829,1.37716h-.00002Z",

  // Ajna Center - Triangle pointing up (vertex at bottom)
  ajna: "m197.34691,193.86404l-44.62801-73.08764c-1.33609-2.25299-.82085-5.10021,1.22829-6.78741.68773-.54817,1.56415-.82892,2.45658-.78695h89.256c2.35423,0,4.40139,2.1641,4.40139,4.82005.03967,1.08493-.28315,2.15357-.92121,3.04942l-44.62799,72.8909c-1.01992,1.92547-3.47094,2.6918-5.47451,1.71163-.19736-.09656-.38617-.20841-.5646-.33448-.44044-.44273-.81894-.93874-1.12594-1.47551Z",

  // Throat Center - Rectangle
  throat: "m239.04696,306.10225h-75.94948c-2.41266.01744-4.38322-1.84801-4.40139-4.16663-.00017-.02107-.00017-.04215,0-.06319v-73.08764c-.01816-2.31863,1.92296-4.21238,4.33562-4.22984.02194-.00017.04387-.00017.06577,0h75.94948c2.41266-.01746,4.38322,1.84801,4.40139,4.16663.00017.02107.00017.04215,0,.06321v73.08764c.01873,2.31809-1.92149,4.21184-4.33357,4.22982-.02263.00021-.04522.00021-.06782,0Z",

  // G Center - Diamond
  g: "m257.77587,386.27241l-53.6355,51.4466c-1.7196,1.5739-4.42186,1.5739-6.14147,0l-53.73784-51.64335c-1.63773-1.65258-1.63773-4.24952,0-5.9021l53.63548-51.54498c1.7196-1.5739,4.42186-1.5739,6.14147,0l53.73784,51.64335c1.72418,1.63589,1.74197,4.30529.03973,5.96229l-.03972.03818Z",

  // Heart Center - Triangle/Pentagon shape
  heart: "m289.01821,393.05985l40.53369,49.67599c1.05494,1.28442.82672,3.14753-.50982,4.16138-.18983.14397-.39662.266-.61612.36357-.68131.38872-1.45955.59271-2.25188.59022h-81.06737c-2.03179.11149-3.77294-1.38099-3.88897-3.33359v-.00003l-.00062-.0109c.05368-.78144.3377-1.53205.81887-2.16411l40.43135-49.47924c1.3704-1.56762,3.74286-1.90541,5.52731-.78693.36635.30281.70849.63161,1.02358.98368v-.00003Z",

  // Spleen Center - Triangle pointing left
  spleen: "m93.20979,522.02065l-83.93339,45.44616c-2.56423,1.38739-5.78453.89873-7.77919-1.18043-.58911-.73314-.91262-1.63127-.92122-2.55755h0v-90.99067c0-2.36083,2.45659-4.42657,5.52732-4.42657,1.26692-.00414,2.50911.33694,3.58252.98368l83.42161,45.34776c2.45659,1.37718,3.27545,4.13148,1.53537,6.19719-.38112.49034-.87051.89344-1.43301,1.18043Z",

  // Solar Plexus Center - Triangle pointing right
  "solar-plexus": "m306.11195,515.33162l84.64991-45.938c2.56266-1.39573,5.78868-.9062,7.7792,1.18043.5891.73314.91262,1.63133.92121,2.55758h0v91.97432c0,2.45921-2.55894,4.42657-5.52731,4.42657-1.26692.00414-2.50912-.33694-3.58252-.98368l-84.34282-45.64291c-2.0853-.93691-2.98546-3.32101-2.01055-5.325.1525-.31346.34664-.60664.57754-.87219.37881-.57926.90794-1.05387,1.53537-1.37718l-.00003.00006Z",

  // Sacral Center - Rectangle
  sacral: "m239.14675,581.53347h-76.05185c-2.41266.01747-4.38322-1.84801-4.40139-4.16666h0c-.00017-.02095-.00017-.04203,0-.06316v-73.08763c-.01815-2.31863,1.92297-4.21238,4.33563-4.22982.02194-.00015.04386-.00015.06575,0h76.05185c2.41266-.01744,4.38322,1.84801,4.40139,4.16666h0c.00016.02101.00016.04209,0,.06316v73.18603c-.13238,2.26474-2.04231,4.05757-4.40139,4.13142Z",

  // Root Center - Rectangle
  root: "m238.87612,692.54966h-75.74477c-2.35214.02131-4.27688-1.79391-4.29902-4.05439h0c-.00025-.0257-.00025-.05139,0-.07709v-73.08763c-.02216-2.26048,1.86665-4.11017,4.21879-4.13148.02675-.00024.05351-.00024.08023,0h75.84712c2.35214-.02131,4.27688,1.79391,4.29902,4.05439h0c.00025.0257.00025.05139,0,.07709v72.98928c-.05413,2.31415-1.99335,4.17777-4.40137,4.22982Z",
};

/**
 * Center bounding boxes for positioning
 * These define the visual bounds of each center in the viewBox
 */
export const CENTER_BOUNDS: Record<CenterName, { x: number; y: number; width: number; height: number }> = {
  head: { x: 153, y: 1, width: 96, height: 83 },
  ajna: { x: 153, y: 113, width: 96, height: 82 },
  throat: { x: 159, y: 224, width: 84, height: 82 },
  g: { x: 144, y: 328, width: 114, height: 110 },
  heart: { x: 241, y: 393, width: 89, height: 55 },
  spleen: { x: 1, y: 468, width: 93, height: 100 },
  "solar-plexus": { x: 306, y: 469, width: 93, height: 96 },
  sacral: { x: 159, y: 500, width: 85, height: 82 },
  root: { x: 159, y: 611, width: 84, height: 82 },
};

/**
 * Center visual center points (for channel connections)
 */
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
 * Official gate positions extracted from the SVG
 * Each gate is rendered as a small circle at these coordinates
 */
export interface GateConfig {
  gate: number;
  center: CenterName;
  x: number;
  y: number;
}

export const OFFICIAL_GATE_POSITIONS: GateConfig[] = [
  // HEAD CENTER GATES (64, 61, 63)
  { gate: 64, center: "head", x: 180.94, y: 74.34 },
  { gate: 61, center: "head", x: 201.07, y: 74.34 },
  { gate: 63, center: "head", x: 222.14, y: 74.43 },

  // AJNA CENTER GATES (47, 24, 4, 17, 43, 11)
  { gate: 47, center: "ajna", x: 180.29, y: 122.59 },
  { gate: 24, center: "ajna", x: 200.79, y: 122.59 },
  { gate: 4, center: "ajna", x: 221.67, y: 122.78 },
  { gate: 17, center: "ajna", x: 180.01, y: 147.55 },
  { gate: 43, center: "ajna", x: 200.61, y: 182.16 },
  { gate: 11, center: "ajna", x: 221.49, y: 147.74 },

  // THROAT CENTER GATES (62, 23, 56, 35, 12, 45, 33, 8, 31, 20, 16)
  { gate: 62, center: "throat", x: 180.01, y: 234.31 },
  { gate: 23, center: "throat", x: 201.16, y: 234.31 },
  { gate: 56, center: "throat", x: 221.58, y: 234.40 },
  { gate: 16, center: "throat", x: 169.06, y: 248.23 },
  { gate: 20, center: "throat", x: 169.06, y: 280.34 },
  { gate: 31, center: "throat", x: 180.10, y: 297.04 },
  { gate: 8, center: "throat", x: 200.61, y: 297.32 },
  { gate: 33, center: "throat", x: 221.30, y: 297.04 },
  { gate: 35, center: "throat", x: 233.18, y: 247.86 },
  { gate: 12, center: "throat", x: 233.36, y: 267.44 },
  { gate: 45, center: "throat", x: 233.36, y: 285.54 },

  // G CENTER GATES (1, 13, 25, 46, 2, 15, 10, 7)
  { gate: 1, center: "g", x: 200.85, y: 338.84 },
  { gate: 7, center: "g", x: 180.34, y: 358.34 },
  { gate: 13, center: "g", x: 221.60, y: 358.65 },
  { gate: 25, center: "g", x: 243.76, y: 386.21 },
  { gate: 10, center: "g", x: 154.66, y: 382.93 },
  { gate: 15, center: "g", x: 180.57, y: 408.06 },
  { gate: 46, center: "g", x: 221.37, y: 408.06 },
  { gate: 2, center: "g", x: 200.93, y: 427.64 },

  // HEART CENTER GATES (21, 40, 26, 51)
  { gate: 21, center: "heart", x: 285.74, y: 404.86 },
  { gate: 51, center: "heart", x: 271.41, y: 423.06 },
  { gate: 26, center: "heart", x: 258.82, y: 438.21 },
  { gate: 40, center: "heart", x: 312.46, y: 438.21 },

  // SPLEEN CENTER GATES (48, 57, 44, 50, 32, 28, 18)
  { gate: 48, center: "spleen", x: 11.92, y: 481.42 },
  { gate: 57, center: "spleen", x: 30.06, y: 491.82 },
  { gate: 44, center: "spleen", x: 54.62, y: 505.40 },
  { gate: 50, center: "spleen", x: 78.67, y: 518.28 },
  { gate: 32, center: "spleen", x: 56.72, y: 531.16 },
  { gate: 28, center: "spleen", x: 36.76, y: 541.78 },
  { gate: 18, center: "spleen", x: 13.39, y: 553.92 },

  // SACRAL CENTER GATES (5, 14, 29, 59, 9, 3, 42, 27, 34)
  { gate: 5, center: "sacral", x: 180.21, y: 508.83 },
  { gate: 14, center: "sacral", x: 200.49, y: 508.83 },
  { gate: 29, center: "sacral", x: 221.57, y: 508.83 },
  { gate: 34, center: "sacral", x: 168.99, y: 523.82 },
  { gate: 27, center: "sacral", x: 169.07, y: 555.71 },
  { gate: 59, center: "sacral", x: 233.35, y: 555.56 },
  { gate: 42, center: "sacral", x: 180.13, y: 572.71 },
  { gate: 3, center: "sacral", x: 200.49, y: 572.79 },
  { gate: 9, center: "sacral", x: 221.33, y: 572.63 },

  // SOLAR PLEXUS CENTER GATES (6, 37, 22, 36, 30, 55, 49)
  { gate: 36, center: "solar-plexus", x: 389.12, y: 482.18 },
  { gate: 22, center: "solar-plexus", x: 371.84, y: 491.31 },
  { gate: 37, center: "solar-plexus", x: 345.31, y: 506.00 },
  { gate: 6, center: "solar-plexus", x: 319.83, y: 519.37 },
  { gate: 49, center: "solar-plexus", x: 346.20, y: 533.96 },
  { gate: 55, center: "solar-plexus", x: 365.66, y: 544.30 },
  { gate: 30, center: "solar-plexus", x: 386.36, y: 555.62 },

  // ROOT CENTER GATES (53, 60, 52, 19, 39, 41, 58, 38, 54)
  { gate: 60, center: "root", x: 200.90, y: 620.15 },
  { gate: 52, center: "root", x: 221.59, y: 620.01 },
  { gate: 53, center: "root", x: 180.29, y: 619.89 },
  { gate: 54, center: "root", x: 169.37, y: 634.96 },
  { gate: 38, center: "root", x: 169.48, y: 658.81 },
  { gate: 58, center: "root", x: 169.06, y: 683.03 },
  { gate: 19, center: "root", x: 233.08, y: 634.47 },
  { gate: 39, center: "root", x: 232.63, y: 658.81 },
  { gate: 41, center: "root", x: 232.94, y: 683.01 },
];

/**
 * Gate circle path generator - creates the oval/circle path for a gate
 */
export function createGatePath(x: number, y: number): string {
  const rx = 8.08626;
  const ry = 6.98412;
  return `M${x},${y}c4.50374,0,8.08626,3.1478,8.08626,6.98412c0,3.93473-3.58252,6.98412-8.08626,6.98412c-4.50374,0-8.08626-3.1478-8.08626-6.98412c0-3.93473,3.58252-6.98412,8.08626-6.98412Z`;
}

/**
 * Channel path data
 * These are the official paths connecting gates between centers
 */
export interface ChannelPathConfig {
  id: string;
  gate1: number;
  gate2: number;
  center1: CenterName;
  center2: CenterName;
  personalityPath: string;
  designPath: string;
}

// Extracted channel paths from the official SVG (simplified for main connections)
export const OFFICIAL_CHANNEL_PATHS: ChannelPathConfig[] = [
  // HEAD to AJNA (64-47, 61-24, 63-4)
  {
    id: "64-47",
    gate1: 64,
    gate2: 47,
    center1: "head",
    center2: "ajna",
    personalityPath: "M176.18963,83.50696v14.73526h8.62937v-14.73526h-8.62937Z",
    designPath: "M176.18963,83.50696l4.29931-.01277v14.75351h-4.33793v-14.73526Z",
  },
  {
    id: "61-24",
    gate1: 61,
    gate2: 24,
    center1: "head",
    center2: "ajna",
    personalityPath: "M196.76514,83.50696v14.73526h8.62937v-14.73526h-8.62937Z",
    designPath: "M196.76514,83.50696l4.29931-.01277v14.75351h-4.33793v-14.73526Z",
  },
  {
    id: "63-4",
    gate1: 63,
    gate2: 4,
    center1: "head",
    center2: "ajna",
    personalityPath: "M217.19465,83.50303l8.72435-.01859v14.97265h-8.65537v-14.95329Z",
    designPath: "M217.20035,83.69204l4.32203.01779v14.74804h-4.33793v-14.73526Z",
  },

  // AJNA to THROAT (17-62, 43-23, 11-56)
  {
    id: "17-62",
    gate1: 17,
    gate2: 62,
    center1: "ajna",
    center2: "throat",
    personalityPath: "M184.81629,208.96621l-8.64718.01365v-49.79869l8.6255,14.08494v35.69933Z",
    designPath: "M180.50704,166.19873v42.77490h-4.33793v-49.79869l4.33793,7.02379Z",
  },
  {
    id: "43-23",
    gate1: 43,
    gate2: 23,
    center1: "ajna",
    center2: "throat",
    personalityPath: "M200.97848,196.04788c-1.328-.00001-2.59644.74568-3.14428,1.51174-.78047,1.09134-1.25515,2.07336-1.32093,2.11502l-.01527-16.63,8.6815.01527-.02135,16.16635c-.59588-.95143-1.10665-1.85038-1.63104-2.33391-.39752-.36655-1.31091-.84445-2.58791-.84446Z",
    designPath: "M197.62034,194.27946c-.33558-.49965-.85668-1.1868-1.73011-1.52131-.70099-.26847-1.69283-.29084-1.69283-.29084l-.02387-12.95716,4.29395-.01564.01047,16.17203c-.52881-.89754-.8576-1.38707-.8576-1.38707Z",
  },
  {
    id: "11-56",
    gate1: 11,
    gate2: 56,
    center1: "ajna",
    center2: "throat",
    personalityPath: "M217.14465,173.24428l8.74112-14.00107v49.83467h-8.70943v-35.82335Z",
    designPath: "M221.5234,209.07788h-4.33793v-35.82335l4.39267-7.17980v43.00315Z",
  },

  // THROAT to G CENTER
  {
    id: "31-7",
    gate1: 31,
    gate2: 7,
    center1: "throat",
    center2: "g",
    personalityPath: "M176.1841,306.05825h8.65026v18.55912h-8.65026v-18.55912Z",
    designPath: "M176.14059,324.61764l4.34835-.00051v-18.47863h-4.34835v18.47914Z",
  },
  {
    id: "8-1",
    gate1: 8,
    gate2: 1,
    center1: "throat",
    center2: "g",
    personalityPath: "M196.75391,317.97683h8.67278l.00342,12.01199c-1.49258-1.53674-2.12847-1.89884-2.12847-1.89884s-1.20113-.59173-2.25212-.63589c-1.32477-.00883-1.98716.4151-2.28241.5382-.92354.60111-2.02752,1.76691-2.02752,1.76691l.01432-11.78237Z",
    designPath: "M196.72417,317.97684h4.33794l-.02141,9.46842c-1.45602.06074-2.27358.54703-2.27358.54703s-2.02752,1.75808-2.02752,1.75808l-.01543-11.77353Z",
  },
  {
    id: "13-33",
    gate1: 13,
    gate2: 33,
    center1: "g",
    center2: "throat",
    personalityPath: "M217.26438,324.53714h8.61648v25.18555l-8.61648-8.18370v-17.00185Z",
    designPath: "M217.25421,324.55919h4.33793v20.95193l-4.33793-4.14963v-16.80230Z",
  },

  // G CENTER to SACRAL
  {
    id: "15-5",
    gate1: 15,
    gate2: 5,
    center1: "g",
    center2: "sacral",
    personalityPath: "M176.18716,416.80452l8.6758,8.33094v41.50388h-8.70347v-49.83482Z",
    designPath: "M176.18716,416.80452l4.30178,4.08618v45.74714h-4.33793v-49.83332Z",
  },
  {
    id: "2-14",
    gate1: 2,
    gate2: 14,
    center1: "g",
    center2: "sacral",
    personalityPath: "M196.75494,436.49932c1.17146,1.23955,1.74671,1.58773,1.74671,1.58773s1.19591.80232,2.5432.80232,1.99859-.41869,2.57348-.78718,1.86199-1.69547,1.86199-1.69547l-.02191,30.23263h-8.70347v-30.14002Z",
    designPath: "M196.75494,436.49932c1.05036,1.08817,1.92837,1.72397,1.92837,1.72397s2.37669.66608,2.37669.66608l.0021,27.74973h-4.33793l.03077-30.13978Z",
  },
  {
    id: "46-29",
    gate1: 46,
    gate2: 29,
    center1: "g",
    center2: "sacral",
    personalityPath: "M217.19784,425.19402l8.68302-8.38950v49.83482h-8.61648v-41.49417Z",
    designPath: "M217.18556,425.19402l4.33240-4.13603v45.58135h-4.34037v-41.49617Z",
  },

  // SACRAL to ROOT
  {
    id: "53-42",
    gate1: 53,
    gate2: 42,
    center1: "sacral",
    center2: "root",
    personalityPath: "M176.14062,581.51879h8.65948v14.76815h-8.65948v-14.76815Z",
    designPath: "M176.11574,581.51878h4.33793v14.76816h-4.33793v-14.76816Z",
  },
  {
    id: "60-3",
    gate1: 60,
    gate2: 3,
    center1: "sacral",
    center2: "root",
    personalityPath: "M196.70203,596.07432h8.70346v15.12163h-8.70346v-15.12163Z",
    designPath: "M196.69496,596.06638h4.36564v15.12539h-4.36564v-15.12539Z",
  },
  {
    id: "52-9",
    gate1: 52,
    gate2: 9,
    center1: "sacral",
    center2: "root",
    personalityPath: "M217.12742,596.16929h8.70349v15.04037h-8.70349v-15.04037Z",
    designPath: "M217.13811,596.16929h4.33793v15.04037h-4.33793v-15.04037Z",
  },

  // SPLEEN to SACRAL
  {
    id: "50-27",
    gate1: 50,
    gate2: 27,
    center1: "spleen",
    center2: "sacral",
    personalityPath: "M93.27941,521.98139l33.09431,12.19204-3.5565,9.03195-41.01341-15.10132,11.47561-6.12267Z",
    designPath: "M87.60038,525.02055l37.01770,13.63744-2.77688,4.52792-41.01453-15.12481,6.77371-3.04055Z",
  },
  {
    id: "57-34",
    gate1: 57,
    gate2: 34,
    center1: "spleen",
    center2: "sacral",
    personalityPath: "M30.66662,480.695l61.99530-98.42993,7.56956,4.99741-30.37680,48.21296-31.20422,49.56657-3.98390-2.18791-3.94394-2.15910Z",
    designPath: "M30.67622,480.71419l61.98570-98.44912,3.82679,2.50782-61.85896,99.09168-3.95353-3.15038Z",
  },

  // SPLEEN to ROOT  
  {
    id: "32-54",
    gate1: 32,
    gate2: 54,
    center1: "spleen",
    center2: "root",
    personalityPath: "M54.07233,543.1859l8.81349-4.75985,54.73220,46.72396-6.40760,6.82772-57.13810-48.79183Z",
    designPath: "M58.45378,540.72461l56.06281,47.72748-3.30616,3.52550-57.13849-48.78837,4.38184-2.46461Z",
  },
  {
    id: "28-38",
    gate1: 28,
    gate2: 38,
    center1: "spleen",
    center2: "root",
    personalityPath: "M34.25996,553.93389l8.77825-4.81884,60.99596,52.28418-6.35308,6.53766-63.42112-53.99300Z",
    designPath: "M38.77134,551.50902l61.35564,52.28202-3.21536,3.56853-63.42948-53.98972,5.28920-1.86083Z",
  },
  {
    id: "18-58",
    gate1: 18,
    gate2: 58,
    center1: "spleen",
    center2: "root",
    personalityPath: "M14.74203,564.48981l9.05250-4.92150,65.40754,55.77903-6.45151,7.02753-68.00853-57.88506Z",
    designPath: "M19.47482,561.94481l66.52954,56.88226-3.22930,3.57327-67.77485-57.67594,4.47461-2.77959Z",
  },

  // ROOT to SOLAR PLEXUS
  {
    id: "19-49",
    gate1: 19,
    gate2: 49,
    center1: "root",
    center2: "solar-plexus",
    personalityPath: "M285.14557,585.38664l52.87742-45.17476,8.94494,4.86699-54.40182,46.81683-6.42054-6.50906Z",
    designPath: "M288.35383,588.7309l54.00787-45.15552,4.61710,2.49856-54.40182,46.82286-4.22315-4.16580Z",
  },
  {
    id: "39-55",
    gate1: 39,
    gate2: 55,
    center1: "root",
    center2: "solar-plexus",
    personalityPath: "M299.26658,600.0931l58.01514-49.43553,9.04151,4.88282-56.58415,49.07381-6.63050-5.52110Z",
    designPath: "M302.52187,603.6231l59.06243-50.56758,4.73893,2.48480-56.58415,49.07381-3.28721-1.00103Z",
  },
  {
    id: "41-30",
    gate1: 41,
    gate2: 30,
    center1: "root",
    center2: "solar-plexus",
    personalityPath: "M313.03708,614.89465l63.25450-53.00623,9.09324,4.98458-56.48469,56.92419-6.48305-6.92254Z",
    designPath: "M316.25383,618.3269l64.32308-55.09436,4.80791,2.64046-56.50143,56.90631-3.74479-3.49241Z",
  },

  // SOLAR PLEXUS to THROAT
  {
    id: "36-35",
    gate1: 36,
    gate2: 35,
    center1: "solar-plexus",
    center2: "throat",
    personalityPath: "M306.35354,359.87369l7.70444-4.63611,81.54398,115.83394-7.97135,4.35205-81.27707-115.54988Z",
    designPath: "M306.35354,359.87369l3.87833-2.34903,77.42078,115.70223-4.02721,2.16368-77.27190-115.51688Z",
  },
  {
    id: "22-12",
    gate1: 22,
    gate2: 12,
    center1: "solar-plexus",
    center2: "throat",
    personalityPath: "M301.22846,385.14646l7.58472-4.51946,70.15261,99.17009-8.45380,4.60461-69.28353-99.25524Z",
    designPath: "M301.22846,385.14646l3.80465-2.26540,66.21133,96.84859-4.06274,2.19703-65.95324-96.78022Z",
  },

  // THROAT to HEART (45-21)
  {
    id: "45-21",
    gate1: 45,
    gate2: 21,
    center1: "throat",
    center2: "heart",
    personalityPath: "M234.29327,306.08519c2.24241.01331,4.84879.00304,4.84879.00304s3.86491-2.41696,3.86491-2.41696l21.28457,45.4706-7.92891,4.04077-22.06935-47.09745Z",
    designPath: "M239.26932,306.05825l21.07471,45.09537-3.98141,2.02902-22.00586-47.08818,4.91256-.03621Z",
  },

  // HEART to G (25-51)
  {
    id: "25-51",
    gate1: 25,
    gate2: 51,
    center1: "g",
    center2: "heart",
    personalityPath: "M243.96736,399.51585l6.64979-6.45210,8.50095,9.27593-6.73281,6.34210-8.41793-9.16593Z",
    designPath: "M247.29851,396.32217l8.49876,9.23116-3.38171,3.11470-8.45555-9.15252,3.33850-3.19334Z",
  },

  // G to HEART continuation (51-25)  
  {
    id: "51-25",
    gate1: 51,
    gate2: 25,
    center1: "heart",
    center2: "g",
    personalityPath: "M252.28858,408.50206l6.72169-6.30832,8.38714,9.15096-5.90673,7.17723-9.20210-10.01987Z",
    designPath: "M252.27597,408.50336l3.33880-3.14811,8.82109,9.57450-3.03634,3.58340-9.12355-10.00979Z",
  },

  // HEART to SPLEEN (26-44)
  {
    id: "26-44",
    gate1: 26,
    gate2: 44,
    center1: "heart",
    center2: "spleen",
    personalityPath: "M59.87021,496.62047l103.35731-33.02768,3.07137,9.23589-94.71139,30.23436-11.71729-6.44257Z",
    designPath: "M65.83868,499.80075l99.03733-31.62212,1.49007,4.63325-94.57353,30.25639-5.95387-3.26752Z",
  },

  // HEART to SOLAR PLEXUS (40-37)
  {
    id: "40-37",
    gate1: 40,
    gate2: 37,
    center1: "heart",
    center2: "solar-plexus",
    personalityPath: "M323.8526,473.86581l7.87235-4.09800,13.13069,24.53569-7.86855,4.23549-13.13449-24.67318Z",
    designPath: "M323.8526,473.86581l3.91317-2.03818,13.21837,24.57949-3.92909,2.13198-13.20245-24.67329Z",
  },

  // SACRAL to SOLAR PLEXUS (59-6)
  {
    id: "59-6",
    gate1: 59,
    gate2: 6,
    center1: "sacral",
    center2: "solar-plexus",
    personalityPath: "M278.50187,533.25974l27.52574-10.33906,11.37025,6.13363-35.24546,12.89772-3.65053-8.69229Z",
    designPath: "M280.26157,537.55166l31.43243-11.72257,5.70356,3.22185-35.22579,12.89485-1.91020-4.39413Z",
  },

  // SPLEEN to THROAT (16-48)
  {
    id: "16-48",
    gate1: 16,
    gate2: 48,
    center1: "throat",
    center2: "spleen",
    personalityPath: "M14.51036,471.93992l74.24994-116.86562,7.63282,4.71774-66.12057,116.46509-7.97679-4.31713-7.78540-4.00008Z",
    designPath: "M14.54422,471.96143l74.21608-116.88713,3.83125,2.41663-66.06541,116.61760-3.98073-2.14753-8.00119-4.00957Z",
  },
];

/**
 * Colors from the official SVG for each center type
 */
export const OFFICIAL_CENTER_COLORS: Record<CenterName, { defined: string; open: string }> = {
  head: { defined: "#8b5cf6", open: "transparent" },
  ajna: { defined: "#8b5cf6", open: "transparent" },
  throat: { defined: "#bf5a0f", open: "transparent" },
  g: { defined: "#e49e4b", open: "transparent" },
  heart: { defined: "#a23423", open: "transparent" },
  spleen: { defined: "#bf5a0f", open: "transparent" },
  "solar-plexus": { defined: "#bf5a0f", open: "transparent" },
  sacral: { defined: "#bf5a0f", open: "transparent" },
  root: { defined: "#bf5a0f", open: "transparent" },
};

/**
 * Gate colors
 */
export const GATE_COLORS = {
  defined: "#3d3b37",
  open: "transparent",
  personality: "#1a1a1a",
  design: "#e4b54b",
};

/**
 * Lookup helper to find official channel paths by gate pair
 * Handles gates in either order (e.g., 64-47 or 47-64)
 */
export function getOfficialChannelPath(gate1: number, gate2: number): ChannelPathConfig | undefined {
  return OFFICIAL_CHANNEL_PATHS.find(
    (ch) =>
      (ch.gate1 === gate1 && ch.gate2 === gate2) ||
      (ch.gate1 === gate2 && ch.gate2 === gate1)
  );
}

/**
 * Get all 36 Human Design channels
 * Each channel connects two gates from different centers
 */
export const ALL_36_CHANNELS: Array<{ gate1: number; gate2: number; name: string }> = [
  // Format Channels (Head to Ajna)
  { gate1: 64, gate2: 47, name: "Abstraction" },
  { gate1: 61, gate2: 24, name: "Awareness" },
  { gate1: 63, gate2: 4, name: "Logic" },
  
  // Understanding Channels (Ajna to Throat)
  { gate1: 17, gate2: 62, name: "Acceptance" },
  { gate1: 43, gate2: 23, name: "Structuring" },
  { gate1: 11, gate2: 56, name: "Curiosity" },
  
  // Identity Channels (Throat to G)
  { gate1: 31, gate2: 7, name: "Alpha" },
  { gate1: 8, gate2: 1, name: "Inspiration" },
  { gate1: 33, gate2: 13, name: "Prodigal" },
  
  // Centering Channels (G to Sacral)
  { gate1: 15, gate2: 5, name: "Rhythm" },
  { gate1: 2, gate2: 14, name: "Beat" },
  { gate1: 46, gate2: 29, name: "Discovery" },
  
  // Initiation Channels (Sacral to Root)
  { gate1: 42, gate2: 53, name: "Maturation" },
  { gate1: 3, gate2: 60, name: "Mutation" },
  { gate1: 9, gate2: 52, name: "Concentration" },
  
  // Awareness Channels (Spleen to Sacral)
  { gate1: 50, gate2: 27, name: "Preservation" },
  { gate1: 57, gate2: 34, name: "Power" },
  
  // Survival Channels (Spleen to Root)
  { gate1: 32, gate2: 54, name: "Transformation" },
  { gate1: 28, gate2: 38, name: "Struggle" },
  { gate1: 18, gate2: 58, name: "Judgment" },
  
  // Emotional Channels (Root to Solar Plexus)
  { gate1: 19, gate2: 49, name: "Synthesis" },
  { gate1: 39, gate2: 55, name: "Emoting" },
  { gate1: 41, gate2: 30, name: "Recognition" },
  
  // Manifestation Channels (Solar Plexus to Throat)
  { gate1: 36, gate2: 35, name: "Transitoriness" },
  { gate1: 22, gate2: 12, name: "Openness" },
  
  // Will Channels (Throat to Heart)
  { gate1: 45, gate2: 21, name: "Money Line" },
  
  // Initiation Channels (G to Heart)
  { gate1: 25, gate2: 51, name: "Initiation" },
  
  // Community Channels (Heart to Spleen)
  { gate1: 26, gate2: 44, name: "Surrender" },
  
  // Emotion Channels (Heart to Solar Plexus)
  { gate1: 40, gate2: 37, name: "Community" },
  
  // Intimacy Channel (Sacral to Solar Plexus)
  { gate1: 59, gate2: 6, name: "Intimacy" },
  
  // Talent Channel (Throat to Spleen)
  { gate1: 16, gate2: 48, name: "Wavelength" },
  
  // Integration Channels (G to Spleen and G to Sacral via Throat)
  { gate1: 10, gate2: 20, name: "Awakening" },
  { gate1: 10, gate2: 34, name: "Exploration" },
  { gate1: 10, gate2: 57, name: "Perfected Form" },
  { gate1: 20, gate2: 34, name: "Charisma" },
  { gate1: 20, gate2: 57, name: "Brain Wave" },
];

/**
 * Map of all gates to their centers
 */
export const GATE_TO_CENTER: Record<number, CenterName> = {
  // Head
  64: "head", 61: "head", 63: "head",
  // Ajna
  47: "ajna", 24: "ajna", 4: "ajna", 17: "ajna", 43: "ajna", 11: "ajna",
  // Throat
  62: "throat", 23: "throat", 56: "throat", 16: "throat", 20: "throat", 
  31: "throat", 8: "throat", 33: "throat", 35: "throat", 12: "throat", 45: "throat",
  // G Center
  1: "g", 7: "g", 13: "g", 25: "g", 10: "g", 15: "g", 46: "g", 2: "g",
  // Heart
  21: "heart", 51: "heart", 26: "heart", 40: "heart",
  // Spleen
  48: "spleen", 57: "spleen", 44: "spleen", 50: "spleen", 32: "spleen", 28: "spleen", 18: "spleen",
  // Sacral
  5: "sacral", 14: "sacral", 29: "sacral", 34: "sacral", 27: "sacral", 
  59: "sacral", 42: "sacral", 3: "sacral", 9: "sacral",
  // Solar Plexus
  36: "solar-plexus", 22: "solar-plexus", 37: "solar-plexus", 6: "solar-plexus", 
  49: "solar-plexus", 55: "solar-plexus", 30: "solar-plexus",
  // Root
  60: "root", 52: "root", 53: "root", 54: "root", 38: "root", 
  58: "root", 19: "root", 39: "root", 41: "root",
};

