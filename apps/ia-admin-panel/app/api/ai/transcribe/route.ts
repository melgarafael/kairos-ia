import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireStaffSession } from "@/lib/auth/guards";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    await requireStaffSession({ redirectOnFail: false });
  } catch {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const response = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "pt",
    });

    return NextResponse.json({ text: response.text });
  } catch (error: any) {
    console.error("[transcribe] Error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Erro na transcrição." },
      { status: 500 }
    );
  }
}

