import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth/guards";
import { searchLocations } from "@/lib/hd-client";

export async function GET(req: Request) {
  try {
    await requireStaffSession({ redirectOnFail: false });
  } catch {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  if (!query || query.length < 2) {
    return NextResponse.json({ locations: [] });
  }

  try {
    const locations = await searchLocations(query);

    // Return simplified format for frontend
    const simplified = locations.map((loc) => ({
      label: loc.value,
      timezone: loc.timezone,
      city: loc.asciiname,
      country: loc.country,
      region: loc.admin1,
    }));

    return NextResponse.json({ locations: simplified });
  } catch (error) {
    console.error("[HD Locations] Error:", error);

    const message =
      error instanceof Error ? error.message : "Erro ao buscar locais";

    // Check if it's a configuration error
    if (message.includes("API_KEY")) {
      return NextResponse.json(
        { error: "Configuração da API pendente.", locations: [] },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: message, locations: [] }, { status: 500 });
  }
}

