import { NextResponse } from "next/server";
import { searchLocations } from "@/lib/hd-client";

export const maxDuration = 10;

/**
 * GET /api/locations/search?q=<query>
 * 
 * Search for locations using the BodyGraph API.
 * Returns cities with their timezone for auto-population.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const results = await searchLocations(query);
    
    // Return simplified format for frontend
    return NextResponse.json(
      results.slice(0, 8).map((loc) => ({
        id: `${loc.asciiname}-${loc.country}`.toLowerCase().replace(/\s+/g, "-"),
        name: loc.asciiname,
        fullName: loc.value,
        region: loc.admin1,
        country: loc.country,
        timezone: loc.timezone,
      }))
    );
  } catch (error) {
    console.error("[Locations Search] Error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar localizações" },
      { status: 500 }
    );
  }
}

