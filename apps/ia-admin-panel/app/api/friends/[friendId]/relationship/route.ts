import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth/guards";
import { getHumanDesignProfile } from "@/lib/kairos/human-design";
import {
  getFriend,
  getRelationship,
  upsertRelationship,
  deleteRelationship,
} from "@/lib/kairos/friends";
import { fetchHumanDesignRelationship } from "@/lib/hd-client";

export const maxDuration = 30;

type RouteContext = {
  params: Promise<{ friendId: string }>;
};

// GET - Get relationship with friend
export async function GET(req: Request, context: RouteContext) {
  let session;
  try {
    session = await requireStaffSession({ redirectOnFail: false });
  } catch {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { friendId } = await context.params;

  try {
    const relationship = await getRelationship(session.user.id, friendId);
    
    if (!relationship) {
      return NextResponse.json({ 
        relationship: null,
        message: "Análise de relacionamento ainda não gerada." 
      });
    }

    return NextResponse.json({ relationship });
  } catch (error) {
    console.error("[Relationship API] Error getting relationship:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar relacionamento" },
      { status: 500 }
    );
  }
}

// POST - Generate/regenerate relationship analysis
export async function POST(req: Request, context: RouteContext) {
  let session;
  try {
    session = await requireStaffSession({ redirectOnFail: false });
  } catch {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { friendId } = await context.params;

  try {
    // Get user's HD profile
    const userProfile = await getHumanDesignProfile(session.user.id);
    if (!userProfile || !userProfile.tipo) {
      return NextResponse.json(
        { error: "Você precisa ter seu Human Design calculado primeiro." },
        { status: 400 }
      );
    }

    // Get friend's HD profile
    const friend = await getFriend(session.user.id, friendId);
    if (!friend) {
      return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
    }
    if (!friend.tipo) {
      return NextResponse.json(
        { error: "Esta pessoa precisa ter o Human Design calculado primeiro." },
        { status: 400 }
      );
    }

    // Extract birth data from user profile raw_data
    const userRawData = userProfile.raw_data as Record<string, unknown> | null;
    const userInput = (userRawData?._input || userRawData) as {
      birthDate?: string;
      birthTime?: string;
      timezone?: string;
    } | null;

    if (!userInput?.birthDate || !userInput?.birthTime) {
      return NextResponse.json(
        { error: "Dados de nascimento do usuário não encontrados. Recalcule seu design." },
        { status: 400 }
      );
    }

    // Fetch relationship data from API
    const relationshipPayload = await fetchHumanDesignRelationship({
      person1: {
        birthDate: userInput.birthDate,
        birthTime: userInput.birthTime,
        timezone: userInput.timezone || "America/Sao_Paulo",
      },
      person2: {
        birthDate: friend.birth_date,
        birthTime: friend.birth_time,
        timezone: friend.timezone,
      },
    });

    // Save relationship
    const relationship = await upsertRelationship(session.user.id, {
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

    return NextResponse.json({ relationship });
  } catch (error) {
    console.error("[Relationship API] Error generating relationship:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao gerar análise de relacionamento" },
      { status: 500 }
    );
  }
}

// DELETE - Delete relationship analysis
export async function DELETE(req: Request, context: RouteContext) {
  let session;
  try {
    session = await requireStaffSession({ redirectOnFail: false });
  } catch {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { friendId } = await context.params;

  try {
    await deleteRelationship(session.user.id, friendId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Relationship API] Error deleting relationship:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao excluir relacionamento" },
      { status: 500 }
    );
  }
}

