import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type HdFriend, type HdRelationship } from "./types";

// =============================================================================
// Friends CRUD
// =============================================================================

export async function listFriends(userId: string): Promise<HdFriend[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hd_friends")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Erro ao listar pessoas: ${error.message}`);
  }

  return (data as HdFriend[]) || [];
}

export async function getFriend(userId: string, friendId: string): Promise<HdFriend | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hd_friends")
    .select("*")
    .eq("user_id", userId)
    .eq("id", friendId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar pessoa: ${error.message}`);
  }

  return data as HdFriend | null;
}

export type CreateFriendInput = {
  name: string;
  relationship_type?: string;
  notes?: string;
  birth_date: string; // YYYY-MM-DD
  birth_time: string; // HH:mm
  birth_location?: string;
  timezone: string;
  latitude?: string;
  longitude?: string;
};

export async function createFriend(
  userId: string,
  input: CreateFriendInput
): Promise<HdFriend> {
  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("hd_friends")
    .insert({
      user_id: userId,
      ...input,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Erro ao criar pessoa: ${error.message}`);
  }

  return data as HdFriend;
}

export type UpdateFriendInput = Partial<Omit<HdFriend, "id" | "user_id" | "created_at">>;

export async function updateFriend(
  userId: string,
  friendId: string,
  input: UpdateFriendInput
): Promise<HdFriend> {
  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("hd_friends")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", friendId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar pessoa: ${error.message}`);
  }

  return data as HdFriend;
}

export async function deleteFriend(userId: string, friendId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  
  const { error } = await supabase
    .from("hd_friends")
    .delete()
    .eq("user_id", userId)
    .eq("id", friendId);

  if (error) {
    throw new Error(`Erro ao excluir pessoa: ${error.message}`);
  }
}

// =============================================================================
// Relationships CRUD
// =============================================================================

export async function listRelationships(userId: string): Promise<HdRelationship[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hd_relationships")
    .select(`
      *,
      friend:hd_friends(*)
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao listar relacionamentos: ${error.message}`);
  }

  return (data as HdRelationship[]) || [];
}

export async function getRelationship(
  userId: string,
  friendId: string
): Promise<HdRelationship | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hd_relationships")
    .select(`
      *,
      friend:hd_friends(*)
    `)
    .eq("user_id", userId)
    .eq("friend_id", friendId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar relacionamento: ${error.message}`);
  }

  return data as HdRelationship | null;
}

export type UpsertRelationshipInput = Omit<
  HdRelationship,
  "id" | "user_id" | "created_at" | "updated_at" | "friend"
>;

export async function upsertRelationship(
  userId: string,
  input: UpsertRelationshipInput
): Promise<HdRelationship> {
  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("hd_relationships")
    .upsert({
      user_id: userId,
      ...input,
      updated_at: new Date().toISOString(),
    })
    .select(`
      *,
      friend:hd_friends(*)
    `)
    .single();

  if (error) {
    throw new Error(`Erro ao salvar relacionamento: ${error.message}`);
  }

  return data as HdRelationship;
}

export async function deleteRelationship(userId: string, friendId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  
  const { error } = await supabase
    .from("hd_relationships")
    .delete()
    .eq("user_id", userId)
    .eq("friend_id", friendId);

  if (error) {
    throw new Error(`Erro ao excluir relacionamento: ${error.message}`);
  }
}

// =============================================================================
// Summary for AI Context
// =============================================================================

export type FriendSummary = {
  name: string;
  relationship_type: string | null;
  tipo: string | null;
  estrategia: string | null;
  autoridade: string | null;
  perfil: string | null;
};

export type RelationshipSummary = {
  friend_name: string;
  relationship_type: string | null;
  friend_type: string | null;
  composite_type: string | null;
  key_themes: string[] | null;
};

export async function getFriendsSummaryForAI(userId: string): Promise<{
  friends: FriendSummary[];
  relationships: RelationshipSummary[];
}> {
  const friends = await listFriends(userId);
  const relationships = await listRelationships(userId);

  return {
    friends: friends.map(f => ({
      name: f.name,
      relationship_type: f.relationship_type,
      tipo: f.tipo,
      estrategia: f.estrategia,
      autoridade: f.autoridade,
      perfil: f.perfil,
    })),
    relationships: relationships.map(r => ({
      friend_name: r.friend?.name || "Desconhecido",
      relationship_type: r.friend?.relationship_type || null,
      friend_type: r.friend?.tipo || null,
      composite_type: r.composite_type,
      key_themes: r.key_themes,
    })),
  };
}

