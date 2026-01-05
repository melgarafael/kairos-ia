import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth/guards";
import {
  getFriend,
  updateFriend,
  deleteFriend,
  upsertRelationship,
  type UpdateFriendInput,
} from "@/lib/kairos/friends";
import {
  fetchHumanDesignFromApi,
  fetchHumanDesignRelationship,
  normalizeHumanDesignPayload,
  type HdApiParams,
} from "@/lib/hd-client";
import { getHumanDesignProfile } from "@/lib/kairos/human-design";

export const maxDuration = 60; // Increased for HD + relationship calculation

type RouteContext = {
  params: Promise<{ friendId: string }>;
};

// GET - Get single friend
export async function GET(req: Request, context: RouteContext) {
  let session;
  try {
    session = await requireStaffSession({ redirectOnFail: false });
  } catch {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { friendId } = await context.params;

  try {
    const friend = await getFriend(session.user.id, friendId);
    
    if (!friend) {
      return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ friend });
  } catch (error) {
    console.error("[Friends API] Error getting friend:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar pessoa" },
      { status: 500 }
    );
  }
}

// PUT - Update friend
export async function PUT(req: Request, context: RouteContext) {
  let session;
  try {
    session = await requireStaffSession({ redirectOnFail: false });
  } catch {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { friendId } = await context.params;
  const body = (await req.json()) as UpdateFriendInput & {
    recalculateHD?: boolean;
  };

  // Extract recalculateHD flag (not a DB column)
  const { recalculateHD, ...updateData } = body;

  try {
    // Get current friend to check if birth data changed
    const currentFriend = await getFriend(session.user.id, friendId);
    if (!currentFriend) {
      return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
    }

    // Check if birth data changed
    const birthDataChanged =
      (updateData.birth_date && updateData.birth_date !== currentFriend.birth_date) ||
      (updateData.birth_time && updateData.birth_time !== currentFriend.birth_time) ||
      (updateData.timezone && updateData.timezone !== currentFriend.timezone);

    // Update the friend (without recalculateHD flag)
    let updatedFriend = await updateFriend(session.user.id, friendId, updateData);

    // Recalculate HD if requested or if birth data changed
    let relationship = null;
    let relationshipWarning: string | undefined;

    if (recalculateHD || birthDataChanged) {
      try {
        const hdParams: HdApiParams = {
          birthDate: updatedFriend.birth_date,
          birthTime: updatedFriend.birth_time,
          birthLocation: updatedFriend.birth_location || "",
          timezone: updatedFriend.timezone,
          latitude: updatedFriend.latitude || undefined,
          longitude: updatedFriend.longitude || undefined,
        };

        const hdPayload = await fetchHumanDesignFromApi(hdParams);
        const normalized = normalizeHumanDesignPayload(hdPayload);

        updatedFriend = await updateFriend(session.user.id, friendId, {
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
        // AUTO-REGENERATE RELATIONSHIP ANALYSIS
        // ========================================
        try {
          const userProfile = await getHumanDesignProfile(session.user.id);
          
          if (userProfile?.tipo) {
            const userRawData = userProfile.raw_data as Record<string, unknown> | null;
            const userInput = (userRawData?._input || userRawData) as {
              birthDate?: string;
              birthTime?: string;
              timezone?: string;
            } | null;

            if (userInput?.birthDate && userInput?.birthTime) {
              const relationshipPayload = await fetchHumanDesignRelationship({
                person1: {
                  birthDate: userInput.birthDate,
                  birthTime: userInput.birthTime,
                  timezone: userInput.timezone || "America/Sao_Paulo",
                },
                person2: {
                  birthDate: updatedFriend.birth_date,
                  birthTime: updatedFriend.birth_time,
                  timezone: updatedFriend.timezone,
                },
              });

              relationship = await upsertRelationship(session.user.id, {
                friend_id: friendId,
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

              console.log("[Friends API] Auto-regenerated relationship for:", updatedFriend.name);
            }
          }
        } catch (relError) {
          console.error("[Friends API] Error auto-regenerating relationship:", relError);
          relationshipWarning = "HD recalculado, mas houve erro ao atualizar análise de relacionamento.";
        }
      } catch (hdError) {
        console.error("[Friends API] Error recalculating HD:", hdError);
        return NextResponse.json({
          friend: updatedFriend,
          warning: "Pessoa atualizada, mas houve erro ao recalcular Human Design.",
        });
      }
    }

    return NextResponse.json({ 
      friend: updatedFriend,
      ...(relationship && { relationship }),
      ...(relationshipWarning && { warning: relationshipWarning }),
    });
  } catch (error) {
    console.error("[Friends API] Error updating friend:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar pessoa" },
      { status: 500 }
    );
  }
}

// DELETE - Delete friend
export async function DELETE(req: Request, context: RouteContext) {
  let session;
  try {
    session = await requireStaffSession({ redirectOnFail: false });
  } catch {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { friendId } = await context.params;

  try {
    await deleteFriend(session.user.id, friendId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Friends API] Error deleting friend:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao excluir pessoa" },
      { status: 500 }
    );
  }
}

