import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireStaffSession } from "@/lib/auth/guards";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Initialize OpenAI only if API key exists
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

export async function POST(req: Request) {
  // Check OpenAI API key first
  if (!openai || !OPENAI_API_KEY) {
    console.error("[transcribe] OPENAI_API_KEY não configurada");
    return NextResponse.json(
      { error: "Serviço de transcrição não configurado." },
      { status: 500 }
    );
  }

  // Auth check with proper error handling
  try {
    await requireStaffSession({ redirectOnFail: false });
  } catch (authError) {
    console.error("[transcribe] Auth error:", authError);
    return NextResponse.json(
      { error: "Não autorizado. Faça login novamente." },
      { status: 401 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum arquivo de áudio enviado." },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = [
      "audio/webm",
      "audio/mp3",
      "audio/mpeg",
      "audio/wav",
      "audio/m4a",
      "audio/ogg",
      "audio/mp4",
      "video/webm", // Browser may send webm as video
    ];

    if (!validTypes.some((t) => file.type.includes(t.split("/")[1]))) {
      console.warn("[transcribe] Invalid file type:", file.type);
      // Still try to transcribe - Whisper is flexible
    }

    console.log(`[transcribe] Processing audio: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);

    const response = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "pt",
    });

    console.log(`[transcribe] Success: "${response.text.slice(0, 100)}..."`);

    return NextResponse.json({ text: response.text });
  } catch (error: unknown) {
    console.error("[transcribe] Transcription error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido na transcrição.";
    
    // Check for specific OpenAI errors
    if (errorMessage.includes("Invalid file format")) {
      return NextResponse.json(
        { error: "Formato de áudio não suportado. Tente gravar novamente." },
        { status: 400 }
      );
    }

    if (errorMessage.includes("rate limit")) {
      return NextResponse.json(
        { error: "Muitas solicitações. Aguarde um momento." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: `Erro na transcrição: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
