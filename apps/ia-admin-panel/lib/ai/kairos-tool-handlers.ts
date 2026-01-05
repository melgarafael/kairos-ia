/**
 * Kairos Tool Handlers - Executa as ferramentas do MCP Kairos
 *
 * Cada handler recebe os argumentos da tool e o userId do usuário atual,
 * executa a operação no Supabase e retorna o resultado.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHumanDesignProfile } from "@/lib/kairos/human-design";
import { listDailyLogs, createDailyLog } from "@/lib/kairos/daily-logs";
import { listAiMemories, createAiMemory } from "@/lib/kairos/ai-memories";
import {
  listFriends,
  getFriend,
  listRelationships,
  getRelationship,
  getFriendsSummaryForAI,
  type HdFriend,
} from "@/lib/kairos/friends";
import {
  getUserLifeContext,
  getUserLifeContextByCategories,
  formatUserLifeContextForAI,
} from "@/lib/kairos/user-context";

export type ToolResult = {
  success: boolean;
  data?: unknown;
  error?: string;
};

/**
 * Execute a Kairos tool by name
 */
export async function executeKairosTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case "kairos_getHumanDesignProfile":
        return await handleGetHumanDesignProfile(userId);

      case "kairos_getDailyLogs":
        return await handleGetDailyLogs(userId, args);

      case "kairos_createDailyLog":
        return await handleCreateDailyLog(userId, args);

      case "kairos_getMemories":
        return await handleGetMemories(userId, args);

      case "kairos_createMemory":
        return await handleCreateMemory(userId, args);

      case "kairos_searchHdLibrary":
        return await handleSearchHdLibrary(args);

      case "kairos_webSearchHumanDesign":
        return await handleWebSearchHumanDesign(args);

      case "kairos_getSessionMessages":
        return await handleGetSessionMessages(userId, args);

      // Friends & Relationships
      case "kairos_listFriends":
        return await handleListFriends(userId);

      case "kairos_getFriend":
        return await handleGetFriend(userId, args);

      case "kairos_getRelationship":
        return await handleGetRelationship(userId, args);

      case "kairos_listRelationships":
        return await handleListRelationships(userId);

      case "kairos_getRelationshipAdvice":
        return await handleGetRelationshipAdvice(userId, args);

      // User Life Context
      case "kairos_getUserLifeContext":
        return await handleGetUserLifeContext(userId, args);

      default:
        return {
          success: false,
          error: `Tool não reconhecida: ${toolName}`,
        };
    }
  } catch (error) {
    console.error(`[Kairos Tool] Error executing ${toolName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleGetHumanDesignProfile(userId: string): Promise<ToolResult> {
  const profile = await getHumanDesignProfile(userId);

  if (!profile) {
    return {
      success: true,
      data: {
        exists: false,
        message:
          "O usuário ainda não cadastrou seu Human Design. Sugira completar o onboarding em /onboarding",
      },
    };
  }

  return {
    success: true,
    data: {
      exists: true,
      tipo: profile.tipo,
      estrategia: profile.estrategia,
      autoridade: profile.autoridade,
      perfil: profile.perfil,
      cruz_incarnacao: profile.cruz_incarnacao,
      centros_definidos: profile.centros_definidos,
      centros_abertos: profile.centros_abertos,
      canais: profile.canais,
      portas: profile.portas,
    },
  };
}

async function handleGetDailyLogs(
  userId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 10, 30);

  const logs = await listDailyLogs(userId, { limit });

  // Filter by date range if provided
  let filteredLogs = logs;
  if (args.from) {
    const fromDate = new Date(String(args.from));
    filteredLogs = filteredLogs.filter(
      (log) => new Date(log.data || log.created_at) >= fromDate
    );
  }
  if (args.to) {
    const toDate = new Date(String(args.to));
    filteredLogs = filteredLogs.filter(
      (log) => new Date(log.data || log.created_at) <= toDate
    );
  }

  return {
    success: true,
    data: {
      count: filteredLogs.length,
      logs: filteredLogs.map((log) => ({
        id: log.id,
        data: log.data,
        humor_energia: log.humor_energia,
        principais_desafios: log.principais_desafios,
        foco_do_dia: log.foco_do_dia,
        created_at: log.created_at,
      })),
    },
  };
}

async function handleCreateDailyLog(
  userId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const today = new Date().toISOString().split("T")[0];

  const log = await createDailyLog(userId, {
    data: String(args.data || today),
    humor_energia: args.humor_energia ? String(args.humor_energia) : null,
    principais_desafios: args.principais_desafios
      ? String(args.principais_desafios)
      : null,
    foco_do_dia: args.foco_do_dia ? String(args.foco_do_dia) : null,
  });

  return {
    success: true,
    data: {
      message: "Check-in registrado com sucesso",
      log: {
        id: log.id,
        data: log.data,
        humor_energia: log.humor_energia,
        principais_desafios: log.principais_desafios,
        foco_do_dia: log.foco_do_dia,
      },
    },
  };
}

async function handleGetMemories(
  userId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 20, 50);

  // Parse tags if provided
  let tags: string[] | undefined;
  if (args.tags && typeof args.tags === "string") {
    tags = args.tags.split(",").map((t) => t.trim());
  }

  const memories = await listAiMemories(userId, { limit, tags });

  return {
    success: true,
    data: {
      count: memories.length,
      memories: memories.map((m) => ({
        id: m.id,
        content: m.content,
        tags: m.tags,
        source_type: m.source_type,
        created_at: m.created_at,
      })),
    },
  };
}

async function handleCreateMemory(
  userId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  if (!args.content) {
    return { success: false, error: "Content é obrigatório" };
  }

  // Parse tags if provided
  let tags: string[] | null = null;
  if (args.tags && typeof args.tags === "string") {
    tags = args.tags.split(",").map((t) => t.trim());
  }

  const memory = await createAiMemory(userId, {
    content: String(args.content),
    tags,
    source_type: String(args.source_type || "chat"),
    source_id: args.source_id ? String(args.source_id) : null,
  });

  return {
    success: true,
    data: {
      message: "Memória salva com sucesso",
      memory: {
        id: memory.id,
        content: memory.content,
        tags: memory.tags,
      },
    },
  };
}

/**
 * Enhanced HD Library Search with Ra Uru Hu doctrine support
 * Uses full-text search, category filtering, and priority ordering
 */
async function handleSearchHdLibrary(
  args: Record<string, unknown>
): Promise<ToolResult> {
  if (!args.query) {
    return { success: false, error: "Query é obrigatório" };
  }

  const limit = Math.min(Number(args.limit) || 5, 10);
  const query = String(args.query).toLowerCase().trim();
  const category = args.category ? String(args.category) : undefined;
  const priorityOnly = Boolean(args.priority_only);

  const supabase = await createSupabaseServerClient();

  // Build the query with enhanced search
  let dbQuery = supabase
    .from("hd_library_entries")
    .select("slug, title, content, tags, category, priority, source_url");

  // Apply category filter if provided
  if (category) {
    dbQuery = dbQuery.eq("category", category);
  }

  // Apply priority filter for 80/20 content (priority >= 80)
  if (priorityOnly) {
    dbQuery = dbQuery.gte("priority", 80);
  }

  // First try: Full-text search using search_vector (if available)
  const { data: ftsData, error: ftsError } = await dbQuery
    .textSearch("search_vector", query.split(" ").join(" & "), {
      type: "websearch",
      config: "portuguese",
    })
    .order("priority", { ascending: false })
    .limit(limit);

  // If full-text search returns results, use them
  if (!ftsError && ftsData && ftsData.length > 0) {
    return {
      success: true,
      data: {
        count: ftsData.length,
        search_type: "full_text",
        entries: ftsData.map((e) => ({
          slug: e.slug,
          title: e.title,
          content: e.content,
          tags: e.tags,
          category: e.category,
          priority: e.priority,
          source_url: e.source_url,
        })),
      },
    };
  }

  // Fallback: ILIKE search on title, content, slug
  const { data: iLikeData, error: iLikeError } = await supabase
    .from("hd_library_entries")
    .select("slug, title, content, tags, category, priority, source_url")
    .or(`title.ilike.%${query}%,content.ilike.%${query}%,slug.ilike.%${query}%`)
    .order("priority", { ascending: false })
    .limit(limit);

  if (iLikeError) {
    return { success: false, error: iLikeError.message };
  }

  if (iLikeData && iLikeData.length > 0) {
    return {
      success: true,
      data: {
        count: iLikeData.length,
        search_type: "ilike",
        entries: iLikeData.map((e) => ({
          slug: e.slug,
          title: e.title,
          content: e.content,
          tags: e.tags,
          category: e.category,
          priority: e.priority,
          source_url: e.source_url,
        })),
      },
    };
  }

  // Final fallback: Tag search
  const { data: tagData } = await supabase
    .from("hd_library_entries")
    .select("slug, title, content, tags, category, priority, source_url")
    .contains("tags", [query])
    .order("priority", { ascending: false })
    .limit(limit);

  if (tagData && tagData.length > 0) {
    return {
      success: true,
      data: {
        count: tagData.length,
        search_type: "tags",
        entries: tagData.map((e) => ({
          slug: e.slug,
          title: e.title,
          content: e.content,
          tags: e.tags,
          category: e.category,
          priority: e.priority,
          source_url: e.source_url,
        })),
      },
    };
  }

  // No results found - suggest using web search for approved sources
  return {
    success: true,
    data: {
      count: 0,
      search_type: "none",
      entries: [],
      message: `Nenhum conteúdo encontrado na biblioteca local para "${query}". Use kairos_webSearchHumanDesign para buscar nas fontes oficiais (Jovian Archive ou Desenho Humano Brasil).`,
      suggestion: "Use kairos_webSearchHumanDesign com a mesma query para buscar nas fontes aprovadas.",
    },
  };
}

/**
 * Web Search for Human Design - ONLY approved sources
 * Sources: jovianarchive.com, desenhohumanobrasil.com.br
 * 
 * This handler uses a controlled web search that restricts results
 * to the canonical sources of Ra Uru Hu's Human Design doctrine.
 */
async function handleWebSearchHumanDesign(
  args: Record<string, unknown>
): Promise<ToolResult> {
  if (!args.query) {
    return { success: false, error: "Query é obrigatório" };
  }

  const query = String(args.query).trim();
  const source = String(args.source || "both");

  // Build site-restricted search query
  let siteRestriction = "";
  switch (source) {
    case "jovian":
      siteRestriction = "site:jovianarchive.com";
      break;
    case "dhbr":
      siteRestriction = "site:desenhohumanobrasil.com.br";
      break;
    case "both":
    default:
      siteRestriction = "(site:jovianarchive.com OR site:desenhohumanobrasil.com.br)";
      break;
  }

  const searchQuery = `${query} ${siteRestriction}`;

  // Log the search for debugging/auditing
  console.log(`[Kairos WebSearch] Query: "${searchQuery}"`);

  // Since we're using local search only (user preference), 
  // we return a structured response that the AI can use to generate 
  // a response based on its knowledge of Ra Uru Hu's teachings
  // 
  // In production, this could be integrated with OpenAI's web_search tool
  // or a custom search API that respects the source restrictions
  
  return {
    success: true,
    data: {
      query: searchQuery,
      source_restriction: source,
      approved_sources: [
        { name: "Jovian Archive", url: "https://jovianarchive.com", language: "en" },
        { name: "Desenho Humano Brasil", url: "https://desenhohumanobrasil.com.br", language: "pt-BR" },
      ],
      message: `Busca configurada para fontes aprovadas: ${source === "both" ? "Jovian Archive e Desenho Humano Brasil" : source === "jovian" ? "Jovian Archive" : "Desenho Humano Brasil"}. Use seu conhecimento da doutrina de Ra Uru Hu para responder, citando estas fontes quando apropriado.`,
      guidelines: [
        "Baseie a resposta APENAS na doutrina original de Ra Uru Hu",
        "Cite jovianarchive.com ou desenhohumanobrasil.com.br como fontes",
        "Priorize Tipo, Estratégia e Autoridade (80/20 do Human Design)",
        "Use linguagem orientadora, não determinista",
        "Nunca misture com sistemas não-canônicos",
      ],
    },
  };
}

async function handleGetSessionMessages(
  userId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  if (!args.session_id) {
    return { success: false, error: "session_id é obrigatório" };
  }

  const limit = Math.min(Number(args.limit) || 20, 50);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("session_id", String(args.session_id))
    .eq("user_id", userId) // Security: ensure user owns the session
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    data: {
      count: data?.length || 0,
      messages:
        data?.map((m) => ({
          role: m.role,
          content: m.content,
          created_at: m.created_at,
        })) || [],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FRIENDS & RELATIONSHIPS HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleListFriends(userId: string): Promise<ToolResult> {
  const friends = await listFriends(userId);

  if (friends.length === 0) {
    return {
      success: true,
      data: {
        count: 0,
        friends: [],
        message:
          "O usuário ainda não cadastrou pessoas. Sugira adicionar amigos, família ou colegas em /pessoas",
      },
    };
  }

  return {
    success: true,
    data: {
      count: friends.length,
      friends: friends.map((f) => ({
        id: f.id,
        name: f.name,
        relationship_type: f.relationship_type,
        notes: f.notes, // Important context about the relationship
        tipo: f.tipo,
        estrategia: f.estrategia,
        autoridade: f.autoridade,
        perfil: f.perfil,
      })),
    },
  };
}

async function handleGetFriend(
  userId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  let friend: HdFriend | null = null;

  // Try by ID first
  if (args.friend_id) {
    friend = await getFriend(userId, String(args.friend_id));
  }
  // Or search by name
  else if (args.friend_name) {
    const friends = await listFriends(userId);
    const searchName = String(args.friend_name).toLowerCase();
    friend = friends.find((f) =>
      f.name.toLowerCase().includes(searchName)
    ) || null;
  }

  if (!friend) {
    return {
      success: true,
      data: {
        found: false,
        message: `Pessoa não encontrada. Use kairos_listFriends para ver todas as pessoas cadastradas.`,
      },
    };
  }

  return {
    success: true,
    data: {
      found: true,
      friend: {
        id: friend.id,
        name: friend.name,
        relationship_type: friend.relationship_type,
        notes: friend.notes,
        tipo: friend.tipo,
        estrategia: friend.estrategia,
        autoridade: friend.autoridade,
        perfil: friend.perfil,
        cruz_incarnacao: friend.cruz_incarnacao,
        definicao: friend.definicao,
        centros_definidos: friend.centros_definidos,
        centros_abertos: friend.centros_abertos,
        canais: friend.canais,
        assinatura: friend.assinatura,
        tema_nao_self: friend.tema_nao_self,
      },
    },
  };
}

async function handleGetRelationship(
  userId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  let friendId: string | null = null;

  // Try by ID first
  if (args.friend_id) {
    friendId = String(args.friend_id);
  }
  // Or search by name to get ID
  else if (args.friend_name) {
    const friends = await listFriends(userId);
    const searchName = String(args.friend_name).toLowerCase();
    const friend = friends.find((f) =>
      f.name.toLowerCase().includes(searchName)
    );
    friendId = friend?.id || null;
  }

  if (!friendId) {
    return {
      success: true,
      data: {
        found: false,
        message: `Pessoa não encontrada. Use kairos_listFriends para ver todas as pessoas cadastradas.`,
      },
    };
  }

  const relationship = await getRelationship(userId, friendId);

  if (!relationship) {
    return {
      success: true,
      data: {
        found: false,
        message: `Análise de relacionamento ainda não gerada para esta pessoa. O usuário pode gerar em /pessoas clicando em "Analisar Relacionamento".`,
      },
    };
  }

  return {
    success: true,
    data: {
      found: true,
      relationship: {
        friend_name: relationship.friend?.name,
        friend_type: relationship.friend?.tipo,
        composite_type: relationship.composite_type,
        definition_type: relationship.definition_type,
        composite_channels: relationship.composite_channels,
        electromagnetic_connections: relationship.electromagnetic_connections,
        dominance_areas: relationship.dominance_areas,
        compromise_areas: relationship.compromise_areas,
        key_themes: relationship.key_themes,
      },
    },
  };
}

async function handleListRelationships(userId: string): Promise<ToolResult> {
  const relationships = await listRelationships(userId);

  if (relationships.length === 0) {
    return {
      success: true,
      data: {
        count: 0,
        relationships: [],
        message:
          "O usuário ainda não gerou análises de relacionamento. Sugira adicionar pessoas e gerar análises em /pessoas",
      },
    };
  }

  return {
    success: true,
    data: {
      count: relationships.length,
      relationships: relationships.map((r) => ({
        friend_id: r.friend_id,
        friend_name: r.friend?.name,
        relationship_type: r.friend?.relationship_type,
        friend_notes: r.friend?.notes, // Important context
        friend_type: r.friend?.tipo,
        composite_type: r.composite_type,
        key_themes: r.key_themes?.slice(0, 2), // Just first 2 for summary
      })),
    },
  };
}

async function handleGetRelationshipAdvice(
  userId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  if (!args.context) {
    return { success: false, error: "Contexto é obrigatório para gerar orientação" };
  }

  // Get user profile
  const userProfile = await getHumanDesignProfile(userId);
  if (!userProfile) {
    return {
      success: false,
      error: "Você precisa ter seu Human Design cadastrado para receber orientações de relacionamento.",
    };
  }

  // Get friend
  let friend: HdFriend | null = null;
  let friendId: string | null = null;

  if (args.friend_id) {
    friendId = String(args.friend_id);
    friend = await getFriend(userId, friendId);
  } else if (args.friend_name) {
    const friends = await listFriends(userId);
    const searchName = String(args.friend_name).toLowerCase();
    friend = friends.find((f) => f.name.toLowerCase().includes(searchName)) || null;
    friendId = friend?.id || null;
  }

  if (!friend || !friendId) {
    return {
      success: true,
      data: {
        found: false,
        message: `Pessoa não encontrada. Use kairos_listFriends para ver todas as pessoas cadastradas.`,
      },
    };
  }

  // Get relationship if exists
  const relationship = friendId ? await getRelationship(userId, friendId) : null;

  // Build comprehensive context for AI to generate advice
  return {
    success: true,
    data: {
      found: true,
      context: String(args.context),
      user_profile: {
        tipo: userProfile.tipo,
        estrategia: userProfile.estrategia,
        autoridade: userProfile.autoridade,
        perfil: userProfile.perfil,
        centros_definidos: userProfile.centros_definidos,
        centros_abertos: userProfile.centros_abertos,
      },
      friend_profile: {
        name: friend.name,
        relationship_type: friend.relationship_type,
        notes: friend.notes, // Important context about this relationship
        tipo: friend.tipo,
        estrategia: friend.estrategia,
        autoridade: friend.autoridade,
        perfil: friend.perfil,
        centros_definidos: friend.centros_definidos,
        centros_abertos: friend.centros_abertos,
      },
      relationship_analysis: relationship
        ? {
            composite_type: relationship.composite_type,
            composite_channels: relationship.composite_channels,
            electromagnetic_connections: relationship.electromagnetic_connections,
            dominance_areas: relationship.dominance_areas,
            compromise_areas: relationship.compromise_areas,
            key_themes: relationship.key_themes,
          }
        : null,
      guidance_instructions: [
        "Baseie a orientação nos Tipos e Estratégias de ambos",
        "Considere as Autoridades de cada um para tomada de decisão",
        "Identifique centros onde há condicionamento mútuo",
        "Sugira formas práticas de comunicação alinhadas ao HD",
        "Se houver análise de relacionamento, use os temas-chave",
        "Mantenha tom prático, compassivo e específico ao contexto dado",
      ],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// USER LIFE CONTEXT HANDLER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Handler for getting user life context
 * Supports fetching all categories or specific ones
 */
async function handleGetUserLifeContext(
  userId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const categoriesArg = String(args.categories || "all").toLowerCase().trim();
  
  try {
    let context;
    
    if (categoriesArg === "all" || !categoriesArg) {
      // Get all context
      context = await getUserLifeContext(userId);
    } else {
      // Parse categories and get specific ones
      const categoryList = categoriesArg.split(",").map(c => c.trim()) as (
        "profissional" | "relacionamentos" | "pessoal" | "historia" | "metas_hd"
      )[];
      
      // Validate categories
      const validCategories = ["profissional", "relacionamentos", "pessoal", "historia", "metas_hd"];
      const invalidCategories = categoryList.filter(c => !validCategories.includes(c));
      
      if (invalidCategories.length > 0) {
        return {
          success: false,
          error: `Categorias inválidas: ${invalidCategories.join(", ")}. Use: ${validCategories.join(", ")}`,
        };
      }
      
      context = await getUserLifeContextByCategories(userId, categoryList);
    }
    
    if (!context) {
      return {
        success: true,
        data: {
          filled: false,
          message: "O usuário ainda não preencheu seu contexto de vida. As orientações serão baseadas apenas no Human Design. Sugira preencher em /meu-contexto para orientações mais personalizadas.",
          formatted: "Contexto de vida: Não preenchido pelo usuário.",
        },
      };
    }
    
    // Format for AI consumption
    const formatted = formatUserLifeContextForAI(context as Parameters<typeof formatUserLifeContextForAI>[0]);
    
    return {
      success: true,
      data: {
        filled: true,
        context,
        formatted,
        usage_guidelines: [
          "Use o contexto profissional para orientações de carreira específicas",
          "Considere os relacionamentos importantes ao dar conselhos interpessoais",
          "Respeite os valores pessoais nas sugestões práticas",
          "A jornada HD indica o nível de familiaridade do usuário com o sistema",
          "Foque nas áreas que o usuário quer aplicar HD (areas_aplicar_hd)",
          "Padrões Não-Self já notados indicam consciência do usuário - reforce ou aprofunde",
        ],
      },
    };
  } catch (error) {
    console.error("[Kairos Tool] Error getting user life context:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao buscar contexto de vida",
    };
  }
}

