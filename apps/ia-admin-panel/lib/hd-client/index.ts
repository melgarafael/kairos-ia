/**
 * Human Design API Client
 * Integrates with Bodygraph API (bodygraph.com/docs)
 * 
 * Endpoints:
 * - Locations: GET /v210502/locations - Find timezone by city
 * - HD Data: GET /v221006/hd-data - Generate Human Design chart
 */

// Types
export type HdApiParams = {
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:mm
  birthLocation: string; // City name or coordinates
  timezone?: string; // IANA timezone (e.g., America/Sao_Paulo)
  latitude?: string;
  longitude?: string;
  // Design name to generate SVG chart (e.g., "classic", "dark", "light")
  // When included, API returns SVG property with the generated chart image
  design?: string;
};

export type HdApiLocationResult = {
  asciiname: string;
  timezone: string;
  geo: string;
  admin1: string;
  country: string;
  value: string;
  tokens: string[];
};

export type HdApiPropertyItem = {
  name: string;
  id: string;
  option: string;
  description?: string;
  link?: string;
  list?: Array<{ option: number | string; description?: string; link?: string }>;
};

export type HdPlanetPosition = {
  Gate: number;
  Line: number;
  Color?: number;
  Tone?: number;
  Base?: number;
  FixingState?: "None" | "Exalted" | "Detriment";
};

export type HdPlanetaryPositions = Record<string, HdPlanetPosition>;

export type HdVariables = {
  Digestion?: "left" | "right";
  Environment?: "left" | "right";
  Awareness?: "left" | "right";
  Perspective?: "left" | "right";
};

export type HdApiResponse = {
  Properties: {
    BirthDateLocal?: string;
    BirthDateLocal12?: string;
    BirthDateUtc?: string;
    BirthDateUtc12?: string;
    Age?: number;
    DesignDateUtc?: string;
    DesignDateUtc12?: string;
    Type: HdApiPropertyItem;
    Strategy: HdApiPropertyItem;
    InnerAuthority: HdApiPropertyItem;
    Definition: HdApiPropertyItem;
    Profile: HdApiPropertyItem;
    IncarnationCross: HdApiPropertyItem;
    Signature: HdApiPropertyItem;
    NotSelfTheme: HdApiPropertyItem;
    Digestion?: HdApiPropertyItem;
    Sense?: HdApiPropertyItem;
    DesignSense?: HdApiPropertyItem;
    Motivation?: HdApiPropertyItem;
    Perspective?: HdApiPropertyItem;
    Environment?: HdApiPropertyItem;
    Miljø?: HdApiPropertyItem;
    Gates?: HdApiPropertyItem;
    Channels?: HdApiPropertyItem;
  };
  // Centers in different formats
  Centers?: {
    Defined?: string[];
    Open?: string[];
  };
  DefinedCenters?: string[];
  OpenCenters?: string[];
  UnconsciousCenters?: string[];
  ConsciousCenters?: string[];
  // Channels and Gates
  Channels?: string[] | Array<{ option: string; description?: string }>;
  Gates?: Record<string, number> | Array<{ option: number | string; line?: number; color?: number }>;
  // Planetary positions
  Personality?: HdPlanetaryPositions;
  Design?: HdPlanetaryPositions;
  // Variables (arrows)
  Variables?: HdVariables;
  // Additional
  ChartUrl?: string; // URL to the chart (may just be base URL without proper design)
  Svg?: string; // SVG string (returned when valid 'design' parameter is included)
  Planets?: Array<{ id: string; option: string; description?: string }>;
  Tooltips?: Record<string, unknown>;
};

export type HdApiPayload = {
  tipo: string;
  estrategia: string;
  autoridade: string;
  perfil: string;
  cruz_incarnacao: string;
  assinatura?: string;
  tema_nao_self?: string;
  definicao?: string;
  // Advanced properties
  digestao?: string;
  sentido?: string;
  sentido_design?: string;
  motivacao?: string;
  perspectiva?: string;
  ambiente?: string;
  // Centers
  centros_definidos: string[];
  centros_abertos: string[];
  // Channels and gates
  canais: string[];
  portas: string[];
  // Planetary positions
  planetas_personalidade?: HdPlanetaryPositions;
  planetas_design?: HdPlanetaryPositions;
  // Variables (arrows)
  variaveis?: HdVariables;
  // Dates
  data_nascimento_utc?: string;
  data_design_utc?: string;
  // Chart URL (when design parameter is included and returns URL)
  chart_url?: string;
  // SVG string (when design parameter is included and returns SVG)
  bodygraph_svg?: string;
  // Raw response
  raw: Record<string, unknown>;
};

// API Configuration
const API_BASE_URL = "https://api.bodygraphchart.com";
const API_VERSION_LOCATIONS = "v210502";
const API_VERSION_HD_DATA = "v221006";

function getApiKey(): string | null {
  const key = process.env.BODYGRAPH_API_KEY;
  if (!key) {
    console.warn("[HD Client] BODYGRAPH_API_KEY não configurada - usando modo mock");
    return null;
  }
  return key;
}

/**
 * Get the design name for SVG generation
 * You need to create a design in the Bodygraph.com dashboard first
 * Then set the BODYGRAPH_DESIGN_NAME environment variable
 */
function getDesignName(): string | null {
  return process.env.BODYGRAPH_DESIGN_NAME || null;
}

/**
 * Generate mock HD data for testing when API is not configured
 */
function generateMockHdData(params: HdApiParams): HdApiPayload {
  // Use birth data to deterministically generate a "type"
  const dateSum = params.birthDate.split("-").reduce((a, b) => a + parseInt(b), 0);
  const timeSum = params.birthTime.split(":").reduce((a, b) => a + parseInt(b), 0);
  const seed = (dateSum + timeSum) % 5;

  const types = ["Generator", "Manifesting Generator", "Projector", "Manifestor", "Reflector"];
  const strategies = ["To Respond", "To Respond", "Wait for Invitation", "To Inform", "Wait Lunar Cycle"];
  const authorities = ["Sacral", "Emotional - Solar Plexus", "Splenic", "Ego Projected", "Lunar"];
  const profiles = ["1 / 3", "2 / 4", "3 / 5", "4 / 6", "5 / 1", "6 / 2"];
  const definitions = ["Single Definition", "Split Definition", "Triple Split", "Quadruple Split", "No Definition"];
  const signatures = ["Satisfaction", "Satisfaction", "Success", "Peace", "Surprise"];
  const notSelfThemes = ["Frustration", "Frustration", "Bitterness", "Anger", "Disappointment"];
  const digestions = ["Calm", "Nervous", "Alternating", "Direct", "Indirect", "Open"];
  const senses = ["Smell", "Taste", "Outer Vision", "Inner Vision", "Feeling", "Touch"];
  const motivations = ["Fear", "Hope", "Desire", "Need", "Guilt", "Innocence"];
  const perspectives = ["Survival", "Possibility", "Power", "Wanting", "Probability", "Personal"];
  const environments = ["Caves", "Markets", "Kitchens", "Mountains", "Valleys", "Shores"];

  const allCenters = ["Head", "Ajna", "Throat", "G", "Heart", "Sacral", "Spleen", "Solar Plexus", "Root"];
  const definedCount = 4 + (seed % 4);
  const definedCenters = allCenters.slice(0, definedCount);
  const openCenters = allCenters.slice(definedCount);

  // Generate mock planetary positions
  const generatePlanetPosition = (baseSeed: number): HdPlanetPosition => ({
    Gate: (baseSeed % 64) + 1,
    Line: (baseSeed % 6) + 1,
    Color: (baseSeed % 6) + 1,
    Tone: (baseSeed % 6) + 1,
    Base: (baseSeed % 5) + 1,
    FixingState: baseSeed % 10 === 0 ? "Exalted" : baseSeed % 15 === 0 ? "Detriment" : "None",
  });

  const planets = ["Sun", "Earth", "North Node", "South Node", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
  
  const mockPersonality: HdPlanetaryPositions = {};
  const mockDesign: HdPlanetaryPositions = {};
  
  planets.forEach((planet, idx) => {
    mockPersonality[planet] = generatePlanetPosition(seed + idx * 7);
    mockDesign[planet] = generatePlanetPosition(seed + idx * 11 + 3);
  });

  // Format birth date for display
  const [year, month, day] = params.birthDate.split("-");
  const birthDateFormatted = `${day}th ${getMonthName(parseInt(month))} ${year} @ ${params.birthTime}`;

  return {
    tipo: types[seed],
    estrategia: strategies[seed],
    autoridade: authorities[seed],
    perfil: profiles[seed % profiles.length],
    cruz_incarnacao: `Right Angle Cross of Service (${17 + seed}/${18 + seed} | ${58 + seed % 6}/${52 + seed % 6})`,
    assinatura: signatures[seed],
    tema_nao_self: notSelfThemes[seed],
    definicao: definitions[seed],
    // Advanced properties
    digestao: digestions[seed],
    sentido: senses[seed],
    sentido_design: senses[(seed + 2) % senses.length],
    motivacao: motivations[seed],
    perspectiva: perspectives[seed],
    ambiente: environments[seed],
    // Centers
    centros_definidos: definedCenters,
    centros_abertos: openCenters,
    // Channels and gates
    canais: [`${13}-${33}`, `${25}-${51}`, `${18}-${58}`].slice(0, 2 + (seed % 3)),
    portas: ["13", "33", "25", "51", "18", "58", "17", "62", "5", "15"].slice(0, 5 + seed),
    // Planetary positions
    planetas_personalidade: mockPersonality,
    planetas_design: mockDesign,
    // Variables (arrows)
    variaveis: {
      Digestion: seed % 2 === 0 ? "left" : "right",
      Environment: seed % 3 === 0 ? "left" : "right",
      Awareness: seed % 2 === 1 ? "left" : "right",
      Perspective: seed % 4 === 0 ? "left" : "right",
    },
    // Dates
    data_nascimento_utc: birthDateFormatted,
    data_design_utc: `Design date ~88 days before birth`,
    // Chart - undefined in mock mode (real data only from API with valid design)
    chart_url: undefined,
    bodygraph_svg: undefined,
    // Raw
    raw: {
      _mock: true,
      _note: "Dados de demonstração. Configure BODYGRAPH_API_KEY para dados reais.",
      birthDate: params.birthDate,
      birthTime: params.birthTime,
      birthLocation: params.birthLocation,
    },
  };
}

function getMonthName(month: number): string {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return months[month - 1] || "January";
}

/**
 * Search for locations/timezones by city name
 * Returns mock data if API key is not configured
 */
export async function searchLocations(
  query: string
): Promise<HdApiLocationResult[]> {
  const apiKey = getApiKey();
  
  // If no API key, return some mock locations for testing
  if (!apiKey) {
    const mockLocations: HdApiLocationResult[] = [
      {
        asciiname: "Sao Paulo",
        timezone: "America/Sao_Paulo",
        geo: "-23.55,-46.63",
        admin1: "Sao Paulo",
        country: "Brazil",
        value: "São Paulo, São Paulo, Brazil",
        tokens: ["sao", "paulo", "brazil"],
      },
      {
        asciiname: "Rio de Janeiro",
        timezone: "America/Sao_Paulo",
        geo: "-22.91,-43.17",
        admin1: "Rio de Janeiro",
        country: "Brazil",
        value: "Rio de Janeiro, Rio de Janeiro, Brazil",
        tokens: ["rio", "janeiro", "brazil"],
      },
      {
        asciiname: "New York",
        timezone: "America/New_York",
        geo: "40.71,-74.01",
        admin1: "New York",
        country: "United States",
        value: "New York, New York, United States",
        tokens: ["new", "york", "usa"],
      },
      {
        asciiname: "London",
        timezone: "Europe/London",
        geo: "51.51,-0.13",
        admin1: "England",
        country: "United Kingdom",
        value: "London, England, United Kingdom",
        tokens: ["london", "uk", "england"],
      },
      {
        asciiname: "Paris",
        timezone: "Europe/Paris",
        geo: "48.86,2.35",
        admin1: "Île-de-France",
        country: "France",
        value: "Paris, Île-de-France, France",
        tokens: ["paris", "france"],
      },
    ];

    // Filter by query
    const queryLower = query.toLowerCase();
    return mockLocations.filter(
      (loc) =>
        loc.asciiname.toLowerCase().includes(queryLower) ||
        loc.value.toLowerCase().includes(queryLower) ||
        loc.tokens.some((t) => t.includes(queryLower))
    );
  }

  const url = `${API_BASE_URL}/${API_VERSION_LOCATIONS}/locations?api_key=${apiKey}&query=${encodeURIComponent(query)}`;

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao buscar locais: ${response.status} - ${text}`);
  }

  const data = (await response.json()) as HdApiLocationResult[];
  return data;
}

/**
 * Fetch Human Design data from Bodygraph API
 * Falls back to mock data if API key is not configured
 */
export async function fetchHumanDesignFromApi(
  params: HdApiParams
): Promise<HdApiPayload> {
  const apiKey = getApiKey();

  // If no API key, return mock data for testing
  if (!apiKey) {
    console.log(`[HD Client] Using mock data (no API key configured)`);
    return generateMockHdData(params);
  }

  // Format date and time for API: "YYYY-MM-DD HH:mm"
  const dateTime = `${params.birthDate} ${params.birthTime}`;

  // Build URL with query parameters
  const queryParams = new URLSearchParams({
    api_key: apiKey,
    date: dateTime,
    timezone: params.timezone || "America/Sao_Paulo",
  });

  // Add optional coordinates if provided
  if (params.latitude) {
    queryParams.set("latitude", params.latitude);
  }
  if (params.longitude) {
    queryParams.set("longitude", params.longitude);
  }
  
  // Add design parameter to generate SVG chart (only if configured)
  // The design name must be created in the Bodygraph.com dashboard first!
  // Set BODYGRAPH_DESIGN_NAME env var with your design name
  const designName = params.design || getDesignName();
  if (designName) {
    queryParams.set("design", designName);
    console.log(`[HD Client] Including design param: "${designName}" for SVG generation`);
  } else {
    console.log(`[HD Client] No design configured - SVG will not be generated. Set BODYGRAPH_DESIGN_NAME env var.`);
  }

  const url = `${API_BASE_URL}/${API_VERSION_HD_DATA}/hd-data?${queryParams.toString()}`;

  console.log(`[HD Client] Fetching HD data from API...`);

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    console.error(`[HD Client] API error: ${response.status} - ${text}`);
    throw new Error(
      `Erro ao gerar Human Design: ${response.status} - ${text}`
    );
  }

  const data = (await response.json()) as HdApiResponse;
  console.log(`[HD Client] Successfully fetched HD data`);
  
  // Log all top-level keys and potential SVG/chart locations
  console.log(`[HD Client] Response structure:`, {
    keys: Object.keys(data),
    ChartUrl: data.ChartUrl,
    // Check if SVG is anywhere (case variations)
    hasSvg: 'Svg' in data || 'svg' in data || 'SVG' in data,
  });
  
  // Check for SVG in different possible locations
  const anyData = data as Record<string, unknown>;
  if (anyData.Svg) console.log(`[HD Client] Found Svg, length:`, String(anyData.Svg).length);
  if (anyData.svg) console.log(`[HD Client] Found svg, length:`, String(anyData.svg).length);
  if (anyData.SVG) console.log(`[HD Client] Found SVG, length:`, String(anyData.SVG).length);
  if (anyData.chart) console.log(`[HD Client] Found chart:`, anyData.chart);
  if (anyData.image) console.log(`[HD Client] Found image:`, anyData.image);

  // Normalize the response to our internal format
  return normalizeApiResponse(data);
}

/**
 * Normalize Bodygraph API response to our internal format
 */
function normalizeApiResponse(response: HdApiResponse): HdApiPayload {
  const props = response.Properties;

  // Extract centers - API returns them in multiple formats
  let centrosDefinidos: string[] = [];
  let centrosAbertos: string[] = [];

  // Try DefinedCenters/OpenCenters first (main format)
  if (response.DefinedCenters) {
    console.log("[HD Client] Centers found in response.DefinedCenters:", response.DefinedCenters);
    centrosDefinidos = [...response.DefinedCenters];
  } else if (response.Centers?.Defined) {
    console.log("[HD Client] Centers found in response.Centers.Defined:", response.Centers.Defined);
    centrosDefinidos = [...response.Centers.Defined];
  }

  if (response.OpenCenters) {
    console.log("[HD Client] Open centers found in response.OpenCenters:", response.OpenCenters);
    centrosAbertos = [...response.OpenCenters];
  } else if (response.Centers?.Open) {
    console.log("[HD Client] Open centers found in response.Centers.Open:", response.Centers.Open);
    centrosAbertos = [...response.Centers.Open];
  }
  
  console.log("[HD Client] Final centers - Defined:", centrosDefinidos, "Open:", centrosAbertos);

  // Extract channels - can be array of strings or objects
  const canais: string[] = [];
  if (response.Channels) {
    console.log("[HD Client] Channels found in response.Channels:", typeof response.Channels, response.Channels);
    if (Array.isArray(response.Channels)) {
      response.Channels.forEach((ch) => {
        if (typeof ch === "string") {
          canais.push(ch);
        } else if (typeof ch === "object" && ch.option) {
          canais.push(ch.option);
        }
      });
    }
  } else if (props.Channels?.list) {
    console.log("[HD Client] Channels found in props.Channels.list:", props.Channels.list);
    props.Channels.list.forEach((ch) => {
      canais.push(String(ch.option));
    });
  }
  console.log("[HD Client] Final channels extracted:", canais.length, "channels:", canais);

  // Extract gates - can be object with numeric keys or array
  const portasSet = new Set<string>();
  
  // Method 1: From response.Gates
  if (response.Gates) {
    console.log("[HD Client] Gates found in response.Gates:", typeof response.Gates, response.Gates);
    if (Array.isArray(response.Gates)) {
      response.Gates.forEach((g) => {
        if (typeof g === "object" && g.option !== undefined) {
          portasSet.add(String(g.option));
        } else {
          portasSet.add(String(g));
        }
      });
    } else if (typeof response.Gates === "object") {
      // Gates as object with numeric keys - could be {key: gateNumber} or {gateNumber: line}
      Object.entries(response.Gates).forEach(([key, value]) => {
        // Try both the key and value as gate numbers
        const keyNum = parseInt(key);
        const valNum = typeof value === "number" ? value : parseInt(String(value));
        
        // If key is 1-64, it's likely a gate number
        if (keyNum >= 1 && keyNum <= 64) {
          portasSet.add(String(keyNum));
        }
        // If value is 1-64, it's likely a gate number
        if (valNum >= 1 && valNum <= 64) {
          portasSet.add(String(valNum));
        }
      });
    }
  }
  
  // Method 2: From props.Gates.list
  if (props.Gates?.list) {
    console.log("[HD Client] Gates found in props.Gates.list:", props.Gates.list);
    props.Gates.list.forEach((g) => {
      portasSet.add(String(g.option));
    });
  }
  
  // Method 3: Extract gates from planetary positions (most reliable)
  if (response.Personality) {
    console.log("[HD Client] Extracting gates from Personality planets");
    Object.values(response.Personality).forEach((planet) => {
      if (planet.Gate && planet.Gate >= 1 && planet.Gate <= 64) {
        portasSet.add(String(planet.Gate));
      }
    });
  }
  
  if (response.Design) {
    console.log("[HD Client] Extracting gates from Design planets");
    Object.values(response.Design).forEach((planet) => {
      if (planet.Gate && planet.Gate >= 1 && planet.Gate <= 64) {
        portasSet.add(String(planet.Gate));
      }
    });
  }
  
  const portas = Array.from(portasSet);
  console.log("[HD Client] Final gates extracted:", portas.length, "gates:", portas);

  return {
    tipo: normalizeType(props.Type?.id || props.Type?.option || ""),
    estrategia: props.Strategy?.id || props.Strategy?.option || "",
    autoridade: props.InnerAuthority?.id || props.InnerAuthority?.option || "",
    perfil: props.Profile?.id || props.Profile?.option || "",
    cruz_incarnacao:
      props.IncarnationCross?.id || props.IncarnationCross?.option || "",
    assinatura: props.Signature?.id || props.Signature?.option || undefined,
    tema_nao_self:
      props.NotSelfTheme?.id || props.NotSelfTheme?.option || undefined,
    definicao: props.Definition?.id || props.Definition?.option || undefined,
    // Advanced properties
    digestao: props.Digestion?.id || props.Digestion?.option || undefined,
    sentido: props.Sense?.id || props.Sense?.option || undefined,
    sentido_design: props.DesignSense?.id || props.DesignSense?.option || undefined,
    motivacao: props.Motivation?.id || props.Motivation?.option || undefined,
    perspectiva: props.Perspective?.id || props.Perspective?.option || undefined,
    ambiente: props.Environment?.id || props.Environment?.option || undefined,
    // Centers
    centros_definidos: centrosDefinidos,
    centros_abertos: centrosAbertos,
    // Channels and gates
    canais,
    portas,
    // Planetary positions
    planetas_personalidade: response.Personality || undefined,
    planetas_design: response.Design || undefined,
    // Variables (arrows)
    variaveis: response.Variables || undefined,
    // Dates
    data_nascimento_utc: props.BirthDateUtc || undefined,
    data_design_utc: props.DesignDateUtc || undefined,
    // Chart URL or SVG (returned when valid design parameter was included)
    // Prefer SVG if available, fallback to ChartUrl if it's a real chart URL (not just base domain)
    chart_url: response.Svg 
      ? undefined  // If we have SVG, we'll use that instead
      : (response.ChartUrl && response.ChartUrl.includes('/chart/')) 
        ? response.ChartUrl 
        : undefined,
    // SVG string (if design parameter was valid)
    bodygraph_svg: response.Svg || undefined,
    // Raw response
    raw: response as unknown as Record<string, unknown>,
  };
}

/**
 * Normalize type names to our standard format
 */
function normalizeType(typeStr: string): string {
  const normalized = typeStr.toLowerCase().trim();

  // Map common variations
  const typeMap: Record<string, string> = {
    generator: "Generator",
    "manifesting generator": "Manifesting Generator",
    mg: "Manifesting Generator",
    manifestor: "Manifestor",
    projector: "Projector",
    reflector: "Reflector",
  };

  return typeMap[normalized] || typeStr;
}

/**
 * Convert HdApiPayload to database-ready format
 */
export function normalizeHumanDesignPayload(payload: HdApiPayload) {
  return {
    tipo: payload.tipo || null,
    estrategia: payload.estrategia || null,
    autoridade: payload.autoridade || null,
    perfil: payload.perfil || null,
    cruz_incarnacao: payload.cruz_incarnacao || null,
    assinatura: payload.assinatura || null,
    tema_nao_self: payload.tema_nao_self || null,
    definicao: payload.definicao || null,
    // Advanced properties
    digestao: payload.digestao || null,
    sentido: payload.sentido || null,
    sentido_design: payload.sentido_design || null,
    motivacao: payload.motivacao || null,
    perspectiva: payload.perspectiva || null,
    ambiente: payload.ambiente || null,
    // Centers
    centros_definidos:
      payload.centros_definidos.length > 0
        ? payload.centros_definidos
        : null,
    centros_abertos:
      payload.centros_abertos.length > 0 ? payload.centros_abertos : null,
    // Channels and gates
    canais: payload.canais.length > 0 ? payload.canais : null,
    portas: payload.portas.length > 0 ? payload.portas : null,
    // Planetary positions
    planetas_personalidade: payload.planetas_personalidade || null,
    planetas_design: payload.planetas_design || null,
    // Variables (arrows)
    variaveis: payload.variaveis || null,
    // Dates
    data_nascimento_utc: payload.data_nascimento_utc || null,
    data_design_utc: payload.data_design_utc || null,
    // Chart URL (image URL from API)
    chart_url: payload.chart_url || null,
    // Bodygraph SVG (when design returns SVG)
    bodygraph_svg: payload.bodygraph_svg || null,
    // Raw response
    raw_data: payload.raw || null,
  };
}

/**
 * Helper to derive timezone from location
 */
export async function getTimezoneForLocation(
  location: string
): Promise<string | null> {
  try {
    const results = await searchLocations(location);
    if (results.length > 0) {
      return results[0].timezone;
    }
    return null;
  } catch (error) {
    console.error(`[HD Client] Error getting timezone for ${location}:`, error);
    return null;
  }
}

// =============================================================================
// RELATIONSHIP API
// =============================================================================

export type HdRelationshipParams = {
  // Person 1 (usually the user)
  person1: {
    birthDate: string; // YYYY-MM-DD
    birthTime: string; // HH:mm
    timezone: string;
  };
  // Person 2 (the friend/contact)
  person2: {
    birthDate: string; // YYYY-MM-DD
    birthTime: string; // HH:mm
    timezone: string;
  };
  // Design name for SVG generation
  design?: string;
};

export type HdRelationshipApiResponse = {
  Properties?: {
    CompositeType?: { id?: string; option?: string };
    DefinitionType?: { id?: string; option?: string };
  };
  CompositeChannels?: string[] | Array<{ option: string }>;
  ElectromagneticConnections?: string[] | Array<{ option: string }>;
  DominanceAreas?: string[] | Array<{ option: string }>;
  CompromiseAreas?: string[] | Array<{ option: string }>;
  KeyThemes?: string[] | Array<{ option: string }>;
  Svg?: string;
  // Raw data for both individuals
  Person1?: HdApiResponse;
  Person2?: HdApiResponse;
};

export type HdRelationshipPayload = {
  composite_type: string | null;
  definition_type: string | null;
  composite_channels: string[];
  electromagnetic_connections: string[];
  dominance_areas: string[];
  compromise_areas: string[];
  key_themes: string[];
  relationship_svg: string | null;
  raw: Record<string, unknown>;
};

/**
 * Fetch Human Design Relationship data from Bodygraph API
 * Uses the date[] parameter to pass both people's birth data
 */
export async function fetchHumanDesignRelationship(
  params: HdRelationshipParams
): Promise<HdRelationshipPayload> {
  const apiKey = getApiKey();

  // If no API key, return mock data
  if (!apiKey) {
    console.log(`[HD Client] Using mock relationship data (no API key configured)`);
    return generateMockRelationshipData();
  }

  // Format dates for API: "YYYY-MM-DD HH:mm"
  const date1 = `${params.person1.birthDate} ${params.person1.birthTime}`;
  const date2 = `${params.person2.birthDate} ${params.person2.birthTime}`;

  // Build URL with multiple date[] parameters
  const queryParams = new URLSearchParams();
  queryParams.set("api_key", apiKey);
  // The API expects date[] for relationship analysis
  queryParams.append("date[]", date1);
  queryParams.append("date[]", date2);
  queryParams.append("timezone[]", params.person1.timezone);
  queryParams.append("timezone[]", params.person2.timezone);

  // Add design parameter for SVG if configured
  const designName = params.design || getDesignName();
  if (designName) {
    queryParams.set("design", designName);
    console.log(`[HD Client] Including design param for relationship: "${designName}"`);
  }

  const url = `${API_BASE_URL}/${API_VERSION_HD_DATA}/hd-data?${queryParams.toString()}`;

  console.log(`[HD Client] Fetching relationship data from API...`);

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    console.error(`[HD Client] Relationship API error: ${response.status} - ${text}`);
    throw new Error(`Erro ao gerar análise de relacionamento: ${response.status} - ${text}`);
  }

  const data = (await response.json()) as HdRelationshipApiResponse;
  console.log(`[HD Client] Successfully fetched relationship data`);

  return normalizeRelationshipResponse(data);
}

/**
 * Generate mock relationship data for testing
 */
function generateMockRelationshipData(): HdRelationshipPayload {
  return {
    composite_type: "Electromagnetic Attraction",
    definition_type: "Split Definition (Connected)",
    composite_channels: ["13-33 Channel of the Prodigal", "25-51 Channel of Initiation"],
    electromagnetic_connections: ["Gate 1 ↔ Gate 8", "Gate 13 ↔ Gate 33", "Gate 25 ↔ Gate 51"],
    dominance_areas: ["Pessoa 1: Centros motores (Sacral, Root)", "Pessoa 2: Centros de consciência (Ajna, Spleen)"],
    compromise_areas: ["Garganta: Ambos querem expressar", "Solar Plexus: Emoções amplificadas"],
    key_themes: [
      "Atração eletromagnética forte nos canais 13-33",
      "Complementaridade nos centros de consciência",
      "Potencial de crescimento através da diferença",
      "Necessidade de espaço para autoridade individual"
    ],
    relationship_svg: null,
    raw: {
      _mock: true,
      _note: "Dados de demonstração. Configure BODYGRAPH_API_KEY para dados reais."
    },
  };
}

/**
 * Normalize relationship API response to our internal format
 */
function normalizeRelationshipResponse(response: HdRelationshipApiResponse): HdRelationshipPayload {
  const props = response.Properties || {};

  // Extract arrays - they can be strings or objects with option property
  const extractArray = (arr: unknown): string[] => {
    if (!arr) return [];
    if (!Array.isArray(arr)) return [];
    return arr.map(item => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item && "option" in item) {
        return String((item as { option: unknown }).option);
      }
      return String(item);
    });
  };

  return {
    composite_type: props.CompositeType?.id || props.CompositeType?.option || null,
    definition_type: props.DefinitionType?.id || props.DefinitionType?.option || null,
    composite_channels: extractArray(response.CompositeChannels),
    electromagnetic_connections: extractArray(response.ElectromagneticConnections),
    dominance_areas: extractArray(response.DominanceAreas),
    compromise_areas: extractArray(response.CompromiseAreas),
    key_themes: extractArray(response.KeyThemes),
    relationship_svg: response.Svg || null,
    raw: response as unknown as Record<string, unknown>,
  };
}
