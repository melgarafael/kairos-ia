/**
 * Kairos IA - Daily Insight Generator
 * 
 * Generates personalized AI insights for the dashboard based on:
 * - User's Human Design profile (Type, Strategy, Authority)
 * - Recent memories from conversations
 * - Current date/context
 * 
 * Uses streaming for real-time generation.
 * 
 * Following Ra Uru Hu's doctrine and Jobsian philosophy for UX.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireStaffSession } from "@/lib/auth/guards";
import { getHumanDesignProfile } from "@/lib/kairos/human-design";
import { listAiMemories } from "@/lib/kairos/ai-memories";
import { getHdDoctrineCompact } from "@/lib/ai/prompts/kairos-hd-doctrine";

// Config
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = "gpt-4o-mini"; // Using faster model for insights
const CACHE_DURATION = 12 * 60 * 60; // 12 hours in seconds

// Initialize OpenAI
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// Insight prompt template
const INSIGHT_SYSTEM_PROMPT = `Você é a Kairos IA, gerando um insight diário personalizado para o dashboard.

${getHdDoctrineCompact()}

## SUA TAREFA
Gere UMA frase de insight personalizada (máximo 2 frases curtas) que:
1. Seja baseada no TIPO, ESTRATÉGIA e AUTORIDADE do usuário
2. Seja relevante para o momento atual (dia da semana, período)
3. Traga uma perspectiva prática e acolhedora
4. NÃO seja genérica - deve refletir especificamente o design da pessoa
5. Use linguagem orientadora ("experimente", "observe", "lembre-se")

## FORMATO
- Máximo 2 frases
- Tom: Acolhedor, poético mas prático
- Comece com uma observação sobre o design
- Termine com uma sugestão gentil ou lembrete

## EXEMPLOS POR TIPO
- Generator: "Hoje sua energia sacral pede para responder ao que te chama. Observe o que faz seu corpo dizer 'sim'."
- Projector: "A sabedoria de esperar é seu superpoder. Hoje, reconheça onde você já foi convidado."
- Manifestor: "Seu impulso de iniciar está presente. Informe antes de agir e veja os caminhos se abrirem."
- MG: "Velocidade é seu ritmo natural. Mas lembre-se: responder antes de agir transforma pressa em fluidez."
- Reflector: "Você é o espelho do ambiente. Hoje, observe como os lugares afetam sua clareza."`;

/**
 * POST /api/kairos/insight
 * 
 * Generates a personalized daily insight for the user's dashboard
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await requireStaffSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check OpenAI availability
    if (!openai) {
      return NextResponse.json(
        { error: "OpenAI not configured" },
        { status: 500 }
      );
    }

    const userId = session.user.id;

    // Get user's Human Design profile
    const profile = await getHumanDesignProfile(userId);
    if (!profile || !profile.tipo) {
      return NextResponse.json(
        { 
          error: "Profile not found",
          message: "Complete seu onboarding para receber insights personalizados"
        },
        { status: 404 }
      );
    }

    // Get recent memories for context (limit to 5 most recent)
    const memories = await listAiMemories(userId, { limit: 5 });

    // Build context for the AI
    const today = new Date();
    const dayOfWeek = today.toLocaleDateString("pt-BR", { weekday: "long" });
    const timeOfDay = today.getHours() < 12 ? "manhã" : today.getHours() < 18 ? "tarde" : "noite";

    const contextPrompt = `
## PERFIL DO USUÁRIO
- **Tipo:** ${profile.tipo}
- **Estratégia:** ${profile.estrategia}
- **Autoridade:** ${profile.autoridade}
- **Perfil:** ${profile.perfil || "não informado"}
- **Tema Não-Self:** ${getNotSelfTheme(profile.tipo)}
- **Assinatura:** ${getSignature(profile.tipo)}

## CONTEXTO TEMPORAL
- **Dia:** ${dayOfWeek}
- **Período:** ${timeOfDay}

${memories.length > 0 ? `## MEMÓRIAS RECENTES
${memories.map(m => `- ${m.content}`).join("\n")}` : ""}

Gere o insight personalizado agora (máximo 2 frases):`;

    // Generate insight using OpenAI
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: INSIGHT_SYSTEM_PROMPT },
        { role: "user", content: contextPrompt }
      ],
      max_tokens: 150,
      temperature: 0.8, // Slightly creative for variety
    });

    const insight = response.choices[0]?.message?.content?.trim();

    if (!insight) {
      return NextResponse.json(
        { error: "Failed to generate insight" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      insight,
      type: profile.tipo,
      strategy: profile.estrategia,
      authority: profile.autoridade,
      generatedAt: new Date().toISOString(),
      cacheUntil: new Date(Date.now() + CACHE_DURATION * 1000).toISOString()
    });

  } catch (error) {
    console.error("[Kairos Insight] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/kairos/insight
 * 
 * Streaming version for real-time insight generation
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const session = await requireStaffSession();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Check OpenAI availability
    if (!openai) {
      return new Response("OpenAI not configured", { status: 500 });
    }

    const userId = session.user.id;

    // Get user's Human Design profile
    const profile = await getHumanDesignProfile(userId);
    if (!profile || !profile.tipo) {
      return new Response(
        JSON.stringify({ 
          error: "Profile not found",
          message: "Complete seu onboarding para receber insights personalizados"
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get recent memories for context
    const memories = await listAiMemories(userId, { limit: 5 });

    // Build context
    const today = new Date();
    const dayOfWeek = today.toLocaleDateString("pt-BR", { weekday: "long" });
    const timeOfDay = today.getHours() < 12 ? "manhã" : today.getHours() < 18 ? "tarde" : "noite";

    const contextPrompt = `
## PERFIL DO USUÁRIO
- **Tipo:** ${profile.tipo}
- **Estratégia:** ${profile.estrategia}
- **Autoridade:** ${profile.autoridade}
- **Perfil:** ${profile.perfil || "não informado"}
- **Tema Não-Self:** ${getNotSelfTheme(profile.tipo)}
- **Assinatura:** ${getSignature(profile.tipo)}

## CONTEXTO TEMPORAL
- **Dia:** ${dayOfWeek}
- **Período:** ${timeOfDay}

${memories.length > 0 ? `## MEMÓRIAS RECENTES
${memories.map(m => `- ${m.content}`).join("\n")}` : ""}

Gere o insight personalizado agora (máximo 2 frases):`;

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          const response = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            messages: [
              { role: "system", content: INSIGHT_SYSTEM_PROMPT },
              { role: "user", content: contextPrompt }
            ],
            max_tokens: 150,
            temperature: 0.8,
            stream: true
          });

          for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`));
            }
          }

          // Send completion event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            done: true,
            type: profile.tipo,
            strategy: profile.estrategia,
            authority: profile.autoridade
          })}\n\n`));

          controller.close();
        } catch (error) {
          console.error("[Kairos Insight Stream] Error:", error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Generation failed" })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive"
      }
    });

  } catch (error) {
    console.error("[Kairos Insight] Error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

/**
 * Helper: Get Not-Self theme for a type
 */
function getNotSelfTheme(type: string): string {
  const themes: Record<string, string> = {
    generator: "Frustração",
    "manifesting generator": "Frustração e Raiva",
    mg: "Frustração e Raiva",
    manifestor: "Raiva",
    projector: "Amargura",
    projetor: "Amargura",
    reflector: "Decepção",
    refletor: "Decepção"
  };
  return themes[type.toLowerCase()] || "Desalinhamento";
}

/**
 * Helper: Get Signature for a type
 */
function getSignature(type: string): string {
  const signatures: Record<string, string> = {
    generator: "Satisfação",
    "manifesting generator": "Satisfação e Paz",
    mg: "Satisfação e Paz",
    manifestor: "Paz",
    projector: "Sucesso",
    projetor: "Sucesso",
    reflector: "Surpresa",
    refletor: "Surpresa"
  };
  return signatures[type.toLowerCase()] || "Alinhamento";
}

