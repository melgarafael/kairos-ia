/**
 * User Life Context API
 * 
 * GET - Retrieve user's life context
 * PUT - Update user's life context (full or partial)
 * 
 * Used for storing personal information that helps the AI mentor
 * provide personalized Human Design guidance.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth/guards";
import {
  getUserLifeContext,
  upsertUserLifeContext,
  getContextCompletionPercentage,
  type UserLifeContextInput,
} from "@/lib/kairos/user-context";

/**
 * GET /api/user-context
 * 
 * Retrieves the current user's life context
 */
export async function GET() {
  let session;
  try {
    session = await requireStaffSession({ redirectOnFail: false });
  } catch {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const context = await getUserLifeContext(session.user.id);
    const completion = getContextCompletionPercentage(context);

    return NextResponse.json({
      context,
      completion,
    });
  } catch (error) {
    console.error("[User Context API] Error fetching:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar contexto" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user-context
 * 
 * Updates the user's life context (partial update supported)
 * 
 * Body can contain any subset of UserLifeContextInput fields
 */
export async function PUT(request: NextRequest) {
  let session;
  try {
    session = await requireStaffSession({ redirectOnFail: false });
  } catch {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as UserLifeContextInput;

    // Validate that at least one field is being updated
    const hasFields = Object.keys(body).some(
      (key) => body[key as keyof UserLifeContextInput] !== undefined
    );

    if (!hasFields) {
      return NextResponse.json(
        { error: "Nenhum campo para atualizar." },
        { status: 400 }
      );
    }

    const updatedContext = await upsertUserLifeContext(session.user.id, body);
    const completion = getContextCompletionPercentage(updatedContext);

    return NextResponse.json({
      context: updatedContext,
      completion,
    });
  } catch (error) {
    console.error("[User Context API] Error updating:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao salvar contexto" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user-context
 * 
 * Alternative to PUT for creating/updating context
 * Accepts same body as PUT
 */
export async function POST(request: NextRequest) {
  return PUT(request);
}

