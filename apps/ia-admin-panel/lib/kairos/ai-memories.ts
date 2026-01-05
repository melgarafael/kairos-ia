import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type AiMemory } from "./types";

export type ListAiMemoriesOptions = {
  limit?: number;
  since?: string;
  tags?: string[];
};

export async function listAiMemories(userId: string, options: ListAiMemoriesOptions = {}) {
  const { limit = 20, since, tags } = options;
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("ai_memories")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (since) {
    query = query.gte("created_at", since);
  }
  if (tags && tags.length > 0) {
    query = query.contains("tags", tags);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar memórias: ${error.message}`);
  }

  return data as AiMemory[];
}

export type CreateAiMemoryInput = {
  source_type?: string | null;
  source_id?: string | null;
  content: string;
  tags?: string[] | null;
};

export async function createAiMemory(userId: string, input: CreateAiMemoryInput) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_memories")
    .insert({
      user_id: userId,
      source_type: input.source_type ?? null,
      source_id: input.source_id ?? null,
      content: input.content,
      tags: input.tags ?? null
    })
    .select("*")
    .single<AiMemory>();

  if (error) {
    throw new Error(`Erro ao salvar memória: ${error.message}`);
  }

  return data;
}

