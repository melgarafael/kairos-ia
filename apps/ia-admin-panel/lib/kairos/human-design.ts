import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type HumanDesignProfile } from "./types";

export async function getHumanDesignProfile(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("human_design_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<HumanDesignProfile>();

  if (error) {
    throw new Error(`Erro ao buscar Human Design: ${error.message}`);
  }

  return data;
}

export type UpsertHumanDesignInput = Partial<Omit<HumanDesignProfile, "user_id">>;

export async function upsertHumanDesignProfile(userId: string, payload: UpsertHumanDesignInput) {
  const supabase = await createSupabaseServerClient();
  
  const dataToSave = {
    user_id: userId,
    ...payload,
    updated_at: new Date().toISOString()
  };
  
  // Debug: log what we're about to save
  console.log("[HD Upsert] Data to save:", JSON.stringify({
    centros_definidos: dataToSave.centros_definidos,
    centros_abertos: dataToSave.centros_abertos,
  }, null, 2));
  
  const { data, error } = await supabase
    .from("human_design_profiles")
    .upsert(dataToSave)
    .select("*")
    .maybeSingle<HumanDesignProfile>();

  if (error) {
    console.error("[HD Upsert] Error:", error);
    throw new Error(`Erro ao salvar Human Design: ${error.message}`);
  }
  
  // Debug: log what was returned
  console.log("[HD Upsert] Saved data:", JSON.stringify({
    centros_definidos: data?.centros_definidos,
    centros_abertos: data?.centros_abertos,
  }, null, 2));

  return data;
}

