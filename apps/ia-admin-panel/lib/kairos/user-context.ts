/**
 * User Life Context - Server-side functions for AI mentor personalization
 * 
 * Categories:
 * - Profissional: Career, job situation, challenges
 * - Relacionamentos: Relationship status, important people
 * - Pessoal: Values, hobbies, routines
 * - História: Life events, transformations, HD journey
 * - Metas HD: Areas to apply HD, Not-Self patterns noticed
 * 
 * NOTE: For types and constants that can be used in Client Components,
 * import from "./user-context-types" instead.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Re-export types and constants for backward compatibility with server code
export type {
  RelacionamentoInfo,
  EventoMarcante,
  UserLifeContext,
  UserLifeContextInput,
} from "./user-context-types";

export {
  EMPRESA_SITUACAO_OPTIONS,
  STATUS_RELACIONAMENTO_OPTIONS,
  AREAS_APLICAR_HD_OPTIONS,
  DESAFIOS_PROFISSIONAIS_SUGGESTIONS,
  PADROES_NAO_SELF_SUGGESTIONS,
} from "./user-context-types";

// Import types for use in this file
import type { UserLifeContext, UserLifeContextInput } from "./user-context-types";

// =============================================================================
// Database Functions
// =============================================================================

/**
 * Get user life context
 */
export async function getUserLifeContext(userId: string): Promise<UserLifeContext | null> {
  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("user_life_context")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<UserLifeContext>();

  if (error) {
    console.error("[UserLifeContext] Error fetching:", error);
    throw new Error(`Erro ao buscar contexto: ${error.message}`);
  }

  return data;
}

/**
 * Get user life context by specific categories
 */
export async function getUserLifeContextByCategories(
  userId: string,
  categories: ("profissional" | "relacionamentos" | "pessoal" | "historia" | "metas_hd")[]
): Promise<Partial<UserLifeContext> | null> {
  const supabase = await createSupabaseServerClient();
  
  // Build select columns based on categories
  const columns: string[] = ["user_id"];
  
  if (categories.includes("profissional")) {
    columns.push(
      "profissao_atual",
      "empresa_situacao",
      "desafios_profissionais",
      "aspiracoes_carreira",
      "narrativa_profissional"
    );
  }
  
  if (categories.includes("relacionamentos")) {
    columns.push(
      "status_relacionamento",
      "relacionamentos_importantes",
      "desafios_relacionamentos",
      "narrativa_relacionamentos"
    );
  }
  
  if (categories.includes("pessoal")) {
    columns.push(
      "valores_pessoais",
      "hobbies_interesses",
      "rotina_diaria",
      "foco_saude",
      "narrativa_pessoal"
    );
  }
  
  if (categories.includes("historia")) {
    columns.push(
      "eventos_marcantes",
      "transformacoes_vida",
      "jornada_hd",
      "narrativa_historia"
    );
  }
  
  if (categories.includes("metas_hd")) {
    columns.push(
      "areas_aplicar_hd",
      "padroes_nao_self_notados",
      "objetivos_com_hd",
      "narrativa_metas"
    );
  }
  
  const { data, error } = await supabase
    .from("user_life_context")
    .select(columns.join(","))
    .eq("user_id", userId)
    .maybeSingle<Partial<UserLifeContext>>();

  if (error) {
    console.error("[UserLifeContext] Error fetching categories:", error);
    throw new Error(`Erro ao buscar contexto: ${error.message}`);
  }

  return data;
}

/**
 * Create or update user life context
 */
export async function upsertUserLifeContext(
  userId: string, 
  payload: UserLifeContextInput
): Promise<UserLifeContext | null> {
  const supabase = await createSupabaseServerClient();
  
  const dataToSave = {
    user_id: userId,
    ...payload,
    updated_at: new Date().toISOString(),
  };
  
  const { data, error } = await supabase
    .from("user_life_context")
    .upsert(dataToSave)
    .select("*")
    .maybeSingle<UserLifeContext>();

  if (error) {
    console.error("[UserLifeContext] Error upserting:", error);
    throw new Error(`Erro ao salvar contexto: ${error.message}`);
  }

  return data;
}

/**
 * Update specific category of user life context
 */
export async function updateUserLifeContextCategory(
  userId: string,
  category: "profissional" | "relacionamentos" | "pessoal" | "historia" | "metas_hd",
  data: UserLifeContextInput
): Promise<UserLifeContext | null> {
  // Filter to only include fields from the specified category
  const filteredData: UserLifeContextInput = {};
  
  if (category === "profissional") {
    if (data.profissao_atual !== undefined) filteredData.profissao_atual = data.profissao_atual;
    if (data.empresa_situacao !== undefined) filteredData.empresa_situacao = data.empresa_situacao;
    if (data.desafios_profissionais !== undefined) filteredData.desafios_profissionais = data.desafios_profissionais;
    if (data.aspiracoes_carreira !== undefined) filteredData.aspiracoes_carreira = data.aspiracoes_carreira;
    if (data.narrativa_profissional !== undefined) filteredData.narrativa_profissional = data.narrativa_profissional;
  }
  
  if (category === "relacionamentos") {
    if (data.status_relacionamento !== undefined) filteredData.status_relacionamento = data.status_relacionamento;
    if (data.relacionamentos_importantes !== undefined) filteredData.relacionamentos_importantes = data.relacionamentos_importantes;
    if (data.desafios_relacionamentos !== undefined) filteredData.desafios_relacionamentos = data.desafios_relacionamentos;
    if (data.narrativa_relacionamentos !== undefined) filteredData.narrativa_relacionamentos = data.narrativa_relacionamentos;
  }
  
  if (category === "pessoal") {
    if (data.valores_pessoais !== undefined) filteredData.valores_pessoais = data.valores_pessoais;
    if (data.hobbies_interesses !== undefined) filteredData.hobbies_interesses = data.hobbies_interesses;
    if (data.rotina_diaria !== undefined) filteredData.rotina_diaria = data.rotina_diaria;
    if (data.foco_saude !== undefined) filteredData.foco_saude = data.foco_saude;
    if (data.narrativa_pessoal !== undefined) filteredData.narrativa_pessoal = data.narrativa_pessoal;
  }
  
  if (category === "historia") {
    if (data.eventos_marcantes !== undefined) filteredData.eventos_marcantes = data.eventos_marcantes;
    if (data.transformacoes_vida !== undefined) filteredData.transformacoes_vida = data.transformacoes_vida;
    if (data.jornada_hd !== undefined) filteredData.jornada_hd = data.jornada_hd;
    if (data.narrativa_historia !== undefined) filteredData.narrativa_historia = data.narrativa_historia;
  }
  
  if (category === "metas_hd") {
    if (data.areas_aplicar_hd !== undefined) filteredData.areas_aplicar_hd = data.areas_aplicar_hd;
    if (data.padroes_nao_self_notados !== undefined) filteredData.padroes_nao_self_notados = data.padroes_nao_self_notados;
    if (data.objetivos_com_hd !== undefined) filteredData.objetivos_com_hd = data.objetivos_com_hd;
    if (data.narrativa_metas !== undefined) filteredData.narrativa_metas = data.narrativa_metas;
  }
  
  return upsertUserLifeContext(userId, filteredData);
}

/**
 * Format user life context for AI consumption
 * Returns a structured string summary for the AI mentor
 */
export function formatUserLifeContextForAI(context: UserLifeContext | null): string {
  if (!context) {
    return "Contexto de vida: Não preenchido pelo usuário.";
  }
  
  const sections: string[] = [];
  
  // Profissional
  const profissionalParts: string[] = [];
  if (context.profissao_atual) profissionalParts.push(`Profissão: ${context.profissao_atual}`);
  if (context.empresa_situacao) profissionalParts.push(`Situação: ${context.empresa_situacao}`);
  if (context.desafios_profissionais?.length) {
    profissionalParts.push(`Desafios: ${context.desafios_profissionais.join(", ")}`);
  }
  if (context.aspiracoes_carreira) profissionalParts.push(`Aspirações: ${context.aspiracoes_carreira}`);
  if (context.narrativa_profissional) profissionalParts.push(`Contexto: ${context.narrativa_profissional}`);
  
  if (profissionalParts.length > 0) {
    sections.push(`**Profissional:**\n${profissionalParts.join("\n")}`);
  }
  
  // Relacionamentos
  const relacParts: string[] = [];
  if (context.status_relacionamento) relacParts.push(`Status: ${context.status_relacionamento}`);
  if (context.relacionamentos_importantes?.length) {
    const pessoas = context.relacionamentos_importantes
      .map(r => `${r.nome} (${r.tipo})${r.notas ? ` - ${r.notas}` : ""}`)
      .join("; ");
    relacParts.push(`Pessoas importantes: ${pessoas}`);
  }
  if (context.desafios_relacionamentos?.length) {
    relacParts.push(`Desafios: ${context.desafios_relacionamentos.join(", ")}`);
  }
  if (context.narrativa_relacionamentos) relacParts.push(`Contexto: ${context.narrativa_relacionamentos}`);
  
  if (relacParts.length > 0) {
    sections.push(`**Relacionamentos:**\n${relacParts.join("\n")}`);
  }
  
  // Pessoal
  const pessoalParts: string[] = [];
  if (context.valores_pessoais?.length) {
    pessoalParts.push(`Valores: ${context.valores_pessoais.join(", ")}`);
  }
  if (context.hobbies_interesses?.length) {
    pessoalParts.push(`Interesses: ${context.hobbies_interesses.join(", ")}`);
  }
  if (context.rotina_diaria) pessoalParts.push(`Rotina: ${context.rotina_diaria}`);
  if (context.foco_saude) pessoalParts.push(`Foco saúde: ${context.foco_saude}`);
  if (context.narrativa_pessoal) pessoalParts.push(`Contexto: ${context.narrativa_pessoal}`);
  
  if (pessoalParts.length > 0) {
    sections.push(`**Pessoal:**\n${pessoalParts.join("\n")}`);
  }
  
  // História
  const historiaParts: string[] = [];
  if (context.eventos_marcantes?.length) {
    const eventos = context.eventos_marcantes
      .map(e => `${e.ano}: ${e.descricao}`)
      .join("; ");
    historiaParts.push(`Eventos marcantes: ${eventos}`);
  }
  if (context.transformacoes_vida) historiaParts.push(`Transformações: ${context.transformacoes_vida}`);
  if (context.jornada_hd) historiaParts.push(`Jornada HD: ${context.jornada_hd}`);
  if (context.narrativa_historia) historiaParts.push(`Contexto: ${context.narrativa_historia}`);
  
  if (historiaParts.length > 0) {
    sections.push(`**História:**\n${historiaParts.join("\n")}`);
  }
  
  // Metas HD
  const metasParts: string[] = [];
  if (context.areas_aplicar_hd?.length) {
    metasParts.push(`Áreas para aplicar HD: ${context.areas_aplicar_hd.join(", ")}`);
  }
  if (context.padroes_nao_self_notados?.length) {
    metasParts.push(`Padrões Não-Self notados: ${context.padroes_nao_self_notados.join(", ")}`);
  }
  if (context.objetivos_com_hd) metasParts.push(`Objetivos: ${context.objetivos_com_hd}`);
  if (context.narrativa_metas) metasParts.push(`Contexto: ${context.narrativa_metas}`);
  
  if (metasParts.length > 0) {
    sections.push(`**Metas com Human Design:**\n${metasParts.join("\n")}`);
  }
  
  if (sections.length === 0) {
    return "Contexto de vida: Não preenchido pelo usuário.";
  }
  
  return `## Contexto de Vida do Usuário\n\n${sections.join("\n\n")}`;
}

/**
 * Check completion percentage of user life context
 */
export function getContextCompletionPercentage(context: UserLifeContext | null): {
  total: number;
  profissional: number;
  relacionamentos: number;
  pessoal: number;
  historia: number;
  metas_hd: number;
} {
  if (!context) {
    return { total: 0, profissional: 0, relacionamentos: 0, pessoal: 0, historia: 0, metas_hd: 0 };
  }
  
  const checkField = (value: unknown): number => {
    if (value === null || value === undefined) return 0;
    if (Array.isArray(value)) return value.length > 0 ? 1 : 0;
    if (typeof value === "string") return value.trim().length > 0 ? 1 : 0;
    return 1;
  };
  
  // Profissional: 5 fields
  const profFields = [
    context.profissao_atual,
    context.empresa_situacao,
    context.desafios_profissionais,
    context.aspiracoes_carreira,
    context.narrativa_profissional,
  ];
  const profissional = Math.round((profFields.reduce((sum, f) => sum + checkField(f), 0) / 5) * 100);
  
  // Relacionamentos: 4 fields
  const relacFields = [
    context.status_relacionamento,
    context.relacionamentos_importantes,
    context.desafios_relacionamentos,
    context.narrativa_relacionamentos,
  ];
  const relacionamentos = Math.round((relacFields.reduce((sum, f) => sum + checkField(f), 0) / 4) * 100);
  
  // Pessoal: 5 fields
  const pessoalFields = [
    context.valores_pessoais,
    context.hobbies_interesses,
    context.rotina_diaria,
    context.foco_saude,
    context.narrativa_pessoal,
  ];
  const pessoal = Math.round((pessoalFields.reduce((sum, f) => sum + checkField(f), 0) / 5) * 100);
  
  // História: 4 fields
  const historiaFields = [
    context.eventos_marcantes,
    context.transformacoes_vida,
    context.jornada_hd,
    context.narrativa_historia,
  ];
  const historia = Math.round((historiaFields.reduce((sum, f) => sum + checkField(f), 0) / 4) * 100);
  
  // Metas HD: 4 fields
  const metasFields = [
    context.areas_aplicar_hd,
    context.padroes_nao_self_notados,
    context.objetivos_com_hd,
    context.narrativa_metas,
  ];
  const metas_hd = Math.round((metasFields.reduce((sum, f) => sum + checkField(f), 0) / 4) * 100);
  
  // Total average
  const total = Math.round((profissional + relacionamentos + pessoal + historia + metas_hd) / 5);
  
  return { total, profissional, relacionamentos, pessoal, historia, metas_hd };
}

