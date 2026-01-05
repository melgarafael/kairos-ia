import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth/guards";
import {
  fetchHumanDesignFromApi,
  normalizeHumanDesignPayload,
  getTimezoneForLocation,
  type HdApiParams,
} from "@/lib/hd-client";
import { upsertHumanDesignProfile } from "@/lib/kairos/human-design";

export const maxDuration = 30; // Allow 30s for API call

type RequestBody = {
  birthDate?: string; // YYYY-MM-DD
  birthTime?: string; // HH:mm
  birthLocation?: string; // City name
  timezone?: string; // IANA timezone
  latitude?: string;
  longitude?: string;
};

export async function POST(req: Request) {
  let session;
  try {
    session = await requireStaffSession({ redirectOnFail: false });
  } catch {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = (await req.json()) as RequestBody;

  // Validate required fields
  if (!body.birthDate) {
    return NextResponse.json(
      { error: "Data de nascimento é obrigatória." },
      { status: 400 }
    );
  }

  if (!body.birthTime) {
    return NextResponse.json(
      { error: "Hora de nascimento é obrigatória." },
      { status: 400 }
    );
  }

  // Try to derive timezone from location if not provided
  let timezone = body.timezone;
  if (!timezone && body.birthLocation) {
    try {
      const derivedTimezone = await getTimezoneForLocation(body.birthLocation);
      if (derivedTimezone) {
        timezone = derivedTimezone;
      }
    } catch (error) {
      console.warn("[HD Fetch] Could not derive timezone:", error);
    }
  }

  // Default to Sao Paulo if still no timezone
  if (!timezone) {
    timezone = "America/Sao_Paulo";
  }

  const params: HdApiParams = {
    birthDate: body.birthDate,
    birthTime: body.birthTime,
    birthLocation: body.birthLocation || "",
    timezone,
    latitude: body.latitude,
    longitude: body.longitude,
  };

  try {
    // Fetch from Bodygraph API
    const payload = await fetchHumanDesignFromApi(params);
    
    // Debug: log the payload
    console.log("[HD Fetch] Raw payload:", {
      centros_definidos: payload.centros_definidos,
      centros_abertos: payload.centros_abertos,
      chart_url: payload.chart_url || "not provided",
    });
    
    const normalized = normalizeHumanDesignPayload(payload);
    
    // Add input data to raw_data for future editing
    const rawDataWithInput = {
      ...normalized.raw_data,
      _input: {
        birthDate: body.birthDate,
        birthTime: body.birthTime,
        birthLocation: body.birthLocation,
        timezone,
      },
    };
    normalized.raw_data = rawDataWithInput;
    
    // Debug: log normalized data
    console.log("[HD Fetch] Normalized data centros:", {
      definidos: normalized.centros_definidos,
      abertos: normalized.centros_abertos,
    });

    // Save to database
    const savedProfile = await upsertHumanDesignProfile(session.user.id, normalized);
    
    // Debug: log what was saved
    console.log("[HD Fetch] Saved profile centros:", {
      definidos: savedProfile?.centros_definidos,
      abertos: savedProfile?.centros_abertos,
    });

    return NextResponse.json({
      success: true,
      profile: normalized,
      raw: payload.raw,
    });
  } catch (error) {
    console.error("[HD Fetch] Error:", error);

    const message =
      error instanceof Error ? error.message : "Erro ao gerar Human Design";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

