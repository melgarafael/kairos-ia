import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth/guards";
import {
  listFriends,
  createFriend,
  updateFriend,
  upsertRelationship,
  type CreateFriendInput,
} from "@/lib/kairos/friends";
import {
  fetchHumanDesignFromApi,
  fetchHumanDesignRelationship,
  normalizeHumanDesignPayload,
  getTimezoneForLocation,
  type HdApiParams,
} from "@/lib/hd-client";
import { getHumanDesignProfile } from "@/lib/kairos/human-design";

export const maxDuration = 60; // Increased for HD + relationship calculation

// GET - List all friends
export async function GET() {
  let session;
  try {
    session = await requireStaffSession({ redirectOnFail: false });
  } catch {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const friends = await listFriends(session.user.id);
    return NextResponse.json({ friends });
  } catch (error) {
    console.error("[Friends API] Error listing friends:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao listar pessoas" },
      { status: 500 }
    );
  }
}

// POST - Create new friend with HD calculation
export async function POST(req: Request) {
  let session;
  try {
    session = await requireStaffSession({ redirectOnFail: false });
  } catch {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = (await req.json()) as CreateFriendInput & {
    calculateHD?: boolean;
  };

  // Validate required fields
  if (!body.name) {
    return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  }
  if (!body.birth_date) {
    return NextResponse.json({ error: "Data de nascimento é obrigatória." }, { status: 400 });
  }
  if (!body.birth_time) {
    return NextResponse.json({ error: "Hora de nascimento é obrigatória." }, { status: 400 });
  }

  // Derive timezone if not provided
  let timezone = body.timezone;
  if (!timezone && body.birth_location) {
    try {
      const derivedTimezone = await getTimezoneForLocation(body.birth_location);
      if (derivedTimezone) {
        timezone = derivedTimezone;
      }
    } catch (error) {
      console.warn("[Friends API] Could not derive timezone:", error);
    }
  }
  if (!timezone) {
    timezone = "America/Sao_Paulo";
  }

  try {
    // Create the friend record first
    const friend = await createFriend(session.user.id, {
      name: body.name,
      relationship_type: body.relationship_type,
      notes: body.notes,
      birth_date: body.birth_date,
      birth_time: body.birth_time,
      birth_location: body.birth_location,
      timezone,
      latitude: body.latitude,
      longitude: body.longitude,
    });

    // If calculateHD is true (default), fetch HD data
    if (body.calculateHD !== false) {
      try {
        const hdParams: HdApiParams = {
          birthDate: body.birth_date,
          birthTime: body.birth_time,
          birthLocation: body.birth_location || "",
          timezone,
          latitude: body.latitude,
          longitude: body.longitude,
        };

        const hdPayload = await fetchHumanDesignFromApi(hdParams);
        const normalized = normalizeHumanDesignPayload(hdPayload);

        // Update friend with HD data
        const updatedFriend = await updateFriend(session.user.id, friend.id, {
          tipo: normalized.tipo,
          estrategia: normalized.estrategia,
          autoridade: normalized.autoridade,
          perfil: normalized.perfil,
          cruz_incarnacao: normalized.cruz_incarnacao,
          definicao: normalized.definicao,
          assinatura: normalized.assinatura,
          tema_nao_self: normalized.tema_nao_self,
          digestao: normalized.digestao,
          sentido: normalized.sentido,
          sentido_design: normalized.sentido_design,
          motivacao: normalized.motivacao,
          perspectiva: normalized.perspectiva,
          ambiente: normalized.ambiente,
          centros_definidos: normalized.centros_definidos,
          centros_abertos: normalized.centros_abertos,
          canais: normalized.canais,
          portas: normalized.portas,
          variaveis: normalized.variaveis,
          planetas_personalidade: normalized.planetas_personalidade,
          planetas_design: normalized.planetas_design,
          data_nascimento_utc: normalized.data_nascimento_utc,
          data_design_utc: normalized.data_design_utc,
          chart_url: normalized.chart_url,
          bodygraph_svg: normalized.bodygraph_svg,
          raw_data: normalized.raw_data,
        });

        // ========================================
        // AUTO-GENERATE RELATIONSHIP ANALYSIS
        // ========================================
        let relationship = null;
        let relationshipWarning: string | undefined;

        try {
          // Get user's HD profile to generate relationship
          const userProfile = await getHumanDesignProfile(session.user.id);
          
          if (userProfile?.tipo) {
            // Extract user's birth data from raw_data
            const userRawData = userProfile.raw_data as Record<string, unknown> | null;
            const userInput = (userRawData?._input || userRawData) as {
              birthDate?: string;
              birthTime?: string;
              timezone?: string;
            } | null;

            if (userInput?.birthDate && userInput?.birthTime) {
              // Fetch relationship data from API
              const relationshipPayload = await fetchHumanDesignRelationship({
                person1: {
                  birthDate: userInput.birthDate,
                  birthTime: userInput.birthTime,
                  timezone: userInput.timezone || "America/Sao_Paulo",
                },
                person2: {
                  birthDate: body.birth_date,
                  birthTime: body.birth_time,
                  timezone,
                },
              });

              // Save relationship
              relationship = await upsertRelationship(session.user.id, {
                friend_id: friend.id,
                composite_type: relationshipPayload.composite_type,
                definition_type: relationshipPayload.definition_type,
                composite_channels: relationshipPayload.composite_channels,
                electromagnetic_connections: relationshipPayload.electromagnetic_connections,
                dominance_areas: relationshipPayload.dominance_areas,
                compromise_areas: relationshipPayload.compromise_areas,
                key_themes: relationshipPayload.key_themes,
                relationship_svg: relationshipPayload.relationship_svg,
                raw_data: relationshipPayload.raw,
              });

              console.log("[Friends API] Auto-generated relationship for:", updatedFriend.name);
            } else {
              relationshipWarning = "Análise de relacionamento não gerada: dados de nascimento do usuário incompletos.";
            }
          } else {
            relationshipWarning = "Análise de relacionamento não gerada: calcule seu próprio Human Design primeiro.";
          }
        } catch (relError) {
          console.error("[Friends API] Error auto-generating relationship:", relError);
          relationshipWarning = "Pessoa criada com HD, mas houve erro ao gerar análise de relacionamento. Você pode gerar manualmente em /pessoas.";
        }

        return NextResponse.json({ 
          friend: updatedFriend, 
          relationship,
          ...(relationshipWarning && { warning: relationshipWarning }),
        });
      } catch (hdError) {
        console.error("[Friends API] Error calculating HD:", hdError);
        // Return the friend even if HD calculation failed
        return NextResponse.json({
          friend,
          warning: "Pessoa criada, mas houve erro ao calcular Human Design. Tente recalcular depois.",
        });
      }
    }

    return NextResponse.json({ friend });
  } catch (error) {
    console.error("[Friends API] Error creating friend:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar pessoa" },
      { status: 500 }
    );
  }
}

