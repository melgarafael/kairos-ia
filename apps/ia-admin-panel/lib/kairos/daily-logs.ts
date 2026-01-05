import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type DailyLog } from "./types";

export type DailyLogInput = {
  data?: string;
  hora?: string | null; // HH:MM format
  humor_energia?: string | null;
  principais_desafios?: string | null;
  foco_do_dia?: string | null;
};

export async function listDailyLogs(userId: string, opts: { limit?: number } = {}) {
  const { limit = 30 } = opts;
  const supabase = await createSupabaseServerClient();
  
  // Try with hora column first, fallback to without if column doesn't exist yet
  let result = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", userId)
    .order("data", { ascending: false })
    .order("hora", { ascending: false })
    .limit(limit);

  // If hora column doesn't exist, retry without it
  if (result.error?.message?.includes("hora")) {
    result = await supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", userId)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
  }

  if (result.error) {
    throw new Error(`Erro ao listar diários: ${result.error.message}`);
  }

  return result.data as DailyLog[];
}

export async function createDailyLog(userId: string, input: DailyLogInput) {
  const supabase = await createSupabaseServerClient();
  
  // Default to current time if not provided
  const now = new Date();
  const defaultHora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  // Try with hora column first
  let result = await supabase
    .from("daily_logs")
    .insert({
      user_id: userId,
      data: input.data,
      hora: input.hora ?? defaultHora,
      humor_energia: input.humor_energia ?? null,
      principais_desafios: input.principais_desafios ?? null,
      foco_do_dia: input.foco_do_dia ?? null
    })
    .select("*")
    .single<DailyLog>();

  // If hora column doesn't exist, retry without it
  if (result.error?.message?.includes("hora")) {
    result = await supabase
      .from("daily_logs")
      .insert({
        user_id: userId,
        data: input.data,
        humor_energia: input.humor_energia ?? null,
        principais_desafios: input.principais_desafios ?? null,
        foco_do_dia: input.foco_do_dia ?? null
      })
      .select("*")
      .single<DailyLog>();
  }

  if (result.error) {
    throw new Error(`Erro ao criar diário: ${result.error.message}`);
  }

  return result.data;
}

export async function updateDailyLog(userId: string, logId: string, input: DailyLogInput) {
  const supabase = await createSupabaseServerClient();
  
  // Try with hora and updated_at columns first
  let result = await supabase
    .from("daily_logs")
    .update({
      data: input.data,
      hora: input.hora,
      humor_energia: input.humor_energia ?? null,
      principais_desafios: input.principais_desafios ?? null,
      foco_do_dia: input.foco_do_dia ?? null,
      updated_at: new Date().toISOString()
    })
    .eq("id", logId)
    .eq("user_id", userId)
    .select("*")
    .single<DailyLog>();

  // If hora/updated_at columns don't exist, retry without them
  if (result.error?.message?.includes("hora") || result.error?.message?.includes("updated_at")) {
    result = await supabase
      .from("daily_logs")
      .update({
        data: input.data,
        humor_energia: input.humor_energia ?? null,
        principais_desafios: input.principais_desafios ?? null,
        foco_do_dia: input.foco_do_dia ?? null
      })
      .eq("id", logId)
      .eq("user_id", userId)
      .select("*")
      .single<DailyLog>();
  }

  if (result.error) {
    throw new Error(`Erro ao atualizar diário: ${result.error.message}`);
  }

  return result.data;
}

export async function deleteDailyLog(userId: string, logId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("daily_logs")
    .delete()
    .eq("id", logId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Erro ao deletar diário: ${error.message}`);
  }

  return true;
}

