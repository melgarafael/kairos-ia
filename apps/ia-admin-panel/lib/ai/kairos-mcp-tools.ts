/**
 * Kairos MCP Tools - Definições de ferramentas para OpenAI Function Calling
 *
 * VERSÃO 2.0 - Cobertura completa das tabelas:
 * - profiles (preferências do usuário)
 * - human_design_profiles (dados HD)
 * - daily_logs (check-ins diários)
 * - ai_memories (memórias entre conversas)
 * - ai_sessions (sessões de chat)
 * - ai_messages (mensagens de sessão)
 * - hd_library_entries (biblioteca HD canônica)
 */

// Tool definition for OpenAI Responses API
export interface KairosTool {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolProperty>;
    required?: string[];
  };
  strict?: boolean;
}

interface ToolProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: ToolProperty;
}

/**
 * Complete list of Kairos MCP Tools - v2.0
 * Organized by table/function category
 */
export const KAIROS_MCP_TOOLS: KairosTool[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // PROFILES - Preferências e configurações do usuário
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: "function",
    name: "kairos_getProfile",
    description:
      "Obtém as preferências e configurações do usuário atual. Retorna timezone e preferências personalizadas. Útil para adaptar horários e estilo de comunicação.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    type: "function",
    name: "kairos_updateProfile",
    description:
      "Atualiza as preferências do usuário. Use quando o usuário quiser alterar timezone ou outras configurações.",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description:
            "Timezone do usuário. Ex: 'America/Sao_Paulo', 'America/New_York'",
        },
        preferences: {
          type: "object",
          description:
            "Objeto JSON com preferências personalizadas do usuário",
        },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HUMAN DESIGN PROFILES - Dados do Human Design do usuário
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: "function",
    name: "kairos_getHumanDesignProfile",
    description:
      "Obtém o perfil completo de Human Design do usuário atual. Retorna tipo, estratégia, autoridade, perfil, cruz de encarnação, centros definidos/abertos, canais e portas. Use SEMPRE no início da conversa para personalizar orientações e adaptar comunicação ao tipo.",
    parameters: {
      type: "object",
      properties: {},
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DAILY LOGS - Diário / Check-ins de humor e energia
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: "function",
    name: "kairos_getDailyLogs",
    description:
      "Lista os check-ins/registros diários do usuário. Útil para entender padrões de humor, energia, desafios e foco ao longo do tempo. Use no início da conversa para contexto recente.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description:
            "Número máximo de registros a retornar (default: 10, max: 30)",
          default: 10,
        },
        from: {
          type: "string",
          description: "Data inicial no formato YYYY-MM-DD (opcional)",
        },
        to: {
          type: "string",
          description: "Data final no formato YYYY-MM-DD (opcional)",
        },
      },
    },
  },
  {
    type: "function",
    name: "kairos_createDailyLog",
    description:
      "Cria um novo registro de check-in diário. Use quando o usuário compartilhar como está se sentindo, enfrentando desafios ou definindo foco do dia.",
    parameters: {
      type: "object",
      properties: {
        data: {
          type: "string",
          description:
            "Data do registro no formato YYYY-MM-DD. Se não informado, usa data atual.",
        },
        humor_energia: {
          type: "string",
          description:
            "Como o usuário está se sentindo. Ex: 'Energia baixa', 'Motivado', 'Ansioso', 'Frustrado'",
        },
        principais_desafios: {
          type: "string",
          description:
            "Desafios que o usuário está enfrentando. Ex: 'Pressão no trabalho', 'Dificuldade em decisões'",
        },
        foco_do_dia: {
          type: "string",
          description:
            "Principal foco ou intenção. Ex: 'Responder ao invés de iniciar', 'Descansar mais'",
        },
      },
      required: ["humor_energia"],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AI MEMORIES - Memórias estruturadas entre conversas
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: "function",
    name: "kairos_getMemories",
    description:
      "Recupera memórias/insights salvos anteriormente sobre o usuário. Essencial para manter contexto entre conversas. Pode filtrar por tags para buscar memórias específicas.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Número máximo de memórias (default: 20, max: 50)",
          default: 20,
        },
        tags: {
          type: "string",
          description:
            "Tags para filtrar, separadas por vírgula. Ex: 'carreira,decisao-importante' ou 'generator,nao-self-reconhecido'",
        },
        source_type: {
          type: "string",
          description: "Filtrar por tipo de fonte da memória",
          enum: ["chat", "daily_log", "insight_manual"],
        },
      },
    },
  },
  {
    type: "function",
    name: "kairos_createMemory",
    description:
      "Salva uma nova memória/insight importante sobre o usuário. Use quando surgir: decisão significativa, padrão Não-Self identificado, aprendizado sobre o design, momento importante. NÃO use para coisas triviais.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description:
            "O insight a ser salvo. Seja específico e útil para contexto futuro.",
        },
        tags: {
          type: "string",
          description:
            "Tags estruturadas separadas por vírgula. Use: tipo (generator,mg,manifestor,projector,reflector), contexto (carreira,relacionamento,saude,proposito), insight (decisao-importante,padrao-identificado,nao-self-reconhecido), centro (centro-sacral,centro-emocional,centro-g)",
        },
        source_type: {
          type: "string",
          description: "Tipo de fonte: 'chat' (conversa), 'daily_log' (check-in), 'insight_manual' (insight direto)",
          enum: ["chat", "daily_log", "insight_manual"],
          default: "chat",
        },
      },
      required: ["content"],
    },
  },
  {
    type: "function",
    name: "kairos_deleteMemory",
    description:
      "Remove uma memória específica. Use apenas se o usuário solicitar explicitamente a remoção de uma memória.",
    parameters: {
      type: "object",
      properties: {
        memory_id: {
          type: "string",
          description: "ID da memória a ser removida (UUID)",
        },
      },
      required: ["memory_id"],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AI SESSIONS - Sessões de chat
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: "function",
    name: "kairos_listSessions",
    description:
      "Lista as sessões de chat anteriores do usuário. Útil para referência de conversas passadas ou quando o usuário perguntar sobre histórico.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Número máximo de sessões (default: 10, max: 50)",
          default: 10,
        },
      },
    },
  },
  {
    type: "function",
    name: "kairos_getSession",
    description:
      "Obtém detalhes de uma sessão específica, incluindo título e metadados.",
    parameters: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "ID da sessão (UUID)",
        },
      },
      required: ["session_id"],
    },
  },
  {
    type: "function",
    name: "kairos_getSessionMessages",
    description:
      "Recupera as mensagens de uma sessão de chat anterior. Útil para retomar contexto de conversas passadas quando o usuário fizer referência.",
    parameters: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "ID da sessão (UUID)",
        },
        limit: {
          type: "number",
          description: "Número máximo de mensagens (default: 20, max: 100)",
          default: 20,
        },
      },
      required: ["session_id"],
    },
  },
  {
    type: "function",
    name: "kairos_updateSessionTitle",
    description:
      "Atualiza o título de uma sessão de chat. Use para dar nome descritivo a conversas importantes.",
    parameters: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "ID da sessão (UUID)",
        },
        title: {
          type: "string",
          description: "Novo título para a sessão. Ex: 'Decisão de carreira - Março 2024'",
        },
      },
      required: ["session_id", "title"],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HD LIBRARY - Biblioteca de conteúdo de Human Design (Ra Uru Hu)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: "function",
    name: "kairos_searchHdLibrary",
    description:
      "ESSENCIAL: Busca na biblioteca local de Human Design baseada na doutrina de Ra Uru Hu. Use SEMPRE PRIMEIRO antes de responder sobre qualquer conceito de HD. Retorna conteúdo canônico verificado.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Termo de busca. Ex: 'manifestor', 'centro sacral', 'autoridade emocional', 'perfil 4/6', 'canal 20-34'",
        },
        category: {
          type: "string",
          description: "Categoria específica para filtrar",
          enum: [
            "tipo",
            "estrategia",
            "autoridade",
            "centro",
            "perfil",
            "definicao",
            "canal",
            "porta",
            "circuito",
            "not-self",
            "assinatura",
            "variavel",
          ],
        },
        limit: {
          type: "number",
          description: "Número máximo de resultados (default: 5, max: 10)",
          default: 5,
        },
        priority_only: {
          type: "boolean",
          description:
            "Se true, retorna apenas conteúdo de alta prioridade (80/20 rule: tipos, estratégias, autoridades). Use true para perguntas gerais, false para perguntas específicas.",
          default: false,
        },
      },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "kairos_getHdLibraryEntry",
    description:
      "Obtém uma entrada específica da biblioteca HD pelo slug. Útil quando você já sabe exatamente qual conteúdo precisa.",
    parameters: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description:
            "Slug único da entrada. Ex: 'tipo-generator', 'autoridade-emocional', 'centro-sacral'",
        },
      },
      required: ["slug"],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WEB SEARCH - Busca APENAS em fontes aprovadas de Human Design
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: "function",
    name: "kairos_webSearchHumanDesign",
    description:
      "ÚLTIMO RECURSO: Busca informações sobre Human Design APENAS em fontes aprovadas. Use SOMENTE quando kairos_searchHdLibrary não retornar conteúdo suficiente. Fontes permitidas: jovianarchive.com (oficial Ra Uru Hu) e desenhohumanobrasil.com.br.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Termo de busca. Use inglês para Jovian Archive. Ex: 'generator strategy', 'emotional authority wave', 'channel 20-34 charisma'",
        },
        source: {
          type: "string",
          description:
            "Fonte para buscar. 'jovian' = Jovian Archive (inglês, fonte primária), 'dhbr' = Desenho Humano Brasil (português), 'both' = ambos",
          enum: ["jovian", "dhbr", "both"],
          default: "jovian",
        },
      },
      required: ["query"],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FRIENDS & RELATIONSHIPS - Pessoas e análise de relacionamentos
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: "function",
    name: "kairos_listFriends",
    description:
      "Lista todas as pessoas (amigos, família, colegas) cadastradas pelo usuário com seus perfis de Human Design. Use para contextualizar quando o usuário perguntar sobre alguém específico ou sobre relacionamentos em geral.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    type: "function",
    name: "kairos_getFriend",
    description:
      "Obtém os detalhes completos de Human Design de uma pessoa específica. Inclui tipo, estratégia, autoridade, perfil, centros, canais e portas. Use quando o usuário perguntar especificamente sobre uma pessoa.",
    parameters: {
      type: "object",
      properties: {
        friend_name: {
          type: "string",
          description:
            "Nome da pessoa para buscar. Busca parcial funciona. Ex: 'João', 'Maria Silva'",
        },
        friend_id: {
          type: "string",
          description:
            "ID específico da pessoa (UUID). Use se tiver o ID da lista.",
        },
      },
    },
  },
  {
    type: "function",
    name: "kairos_getRelationship",
    description:
      "Obtém a análise de relacionamento entre o usuário e uma pessoa específica. Inclui temas-chave, conexões eletromagnéticas, canais compostos e áreas de dominância/compromisso. ESSENCIAL para orientar o usuário sobre como se relacionar melhor com a pessoa.",
    parameters: {
      type: "object",
      properties: {
        friend_name: {
          type: "string",
          description:
            "Nome da pessoa. Busca parcial funciona.",
        },
        friend_id: {
          type: "string",
          description:
            "ID específico da pessoa (UUID).",
        },
      },
    },
  },
  {
    type: "function",
    name: "kairos_listRelationships",
    description:
      "Lista todas as análises de relacionamento do usuário com suas conexões. Útil para dar uma visão geral das dinâmicas interpessoais do usuário ou para comparar relacionamentos.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    type: "function",
    name: "kairos_getRelationshipAdvice",
    description:
      "Gera orientação personalizada para o usuário se relacionar melhor com uma pessoa específica, baseado nos Human Designs de ambos e na análise de relacionamento. Use quando o usuário pedir conselhos de comunicação, resolução de conflitos ou melhorar a dinâmica com alguém.",
    parameters: {
      type: "object",
      properties: {
        friend_name: {
          type: "string",
          description:
            "Nome da pessoa para gerar orientação.",
        },
        friend_id: {
          type: "string",
          description:
            "ID específico da pessoa (UUID).",
        },
        context: {
          type: "string",
          description:
            "Contexto específico para a orientação. Ex: 'conflito no trabalho', 'comunicação difícil', 'decisão importante juntos', 'melhorar intimidade'",
        },
      },
      required: ["context"],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // USER LIFE CONTEXT - Contexto de vida do usuário
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: "function",
    name: "kairos_getUserLifeContext",
    description:
      "Obtém o contexto de vida do usuário (profissional, relacionamentos, pessoal, história, metas HD). ESSENCIAL para personalizar orientações de Human Design para a realidade prática do usuário. Use no início da conversa junto com o perfil HD, ou quando precisar entender melhor o contexto do usuário para uma orientação específica.",
    parameters: {
      type: "object",
      properties: {
        categories: {
          type: "string",
          description:
            "Categorias a buscar, separadas por vírgula. Opções: 'all' (todas), 'profissional', 'relacionamentos', 'pessoal', 'historia', 'metas_hd'. Default: 'all'",
        },
      },
    },
  },
];

/**
 * Tool categories for organization
 */
export type ToolCategory =
  | "profile"
  | "human_design"
  | "diario"
  | "memorias"
  | "sessoes"
  | "biblioteca"
  | "web_search"
  | "relacionamentos"
  | "contexto"
  | "sistema";

/**
 * Get tool category for UI display and organization
 */
export function getKairosToolCategory(toolName: string): ToolCategory {
  // Profile tools
  if (toolName === "kairos_getProfile" || toolName === "kairos_updateProfile") {
    return "profile";
  }
  // Human Design tools
  if (toolName.includes("HumanDesign")) {
    return "human_design";
  }
  // Daily logs tools
  if (toolName.includes("DailyLog")) {
    return "diario";
  }
  // Memory tools
  if (toolName.includes("Memory") || toolName.includes("Memories")) {
    return "memorias";
  }
  // Session tools
  if (toolName.includes("Session")) {
    return "sessoes";
  }
  // HD Library tools
  if (toolName.includes("HdLibrary")) {
    return "biblioteca";
  }
  // Web search tools
  if (toolName.includes("webSearch")) {
    return "web_search";
  }
  // Friends & Relationships tools
  if (toolName.includes("Friend") || toolName.includes("Relationship")) {
    return "relacionamentos";
  }
  // User Life Context tools
  if (toolName.includes("LifeContext") || toolName.includes("UserLifeContext")) {
    return "contexto";
  }
  return "sistema";
}

/**
 * Get icon name for tool category (Lucide icons)
 */
export function getKairosToolIcon(category: ToolCategory): string {
  const icons: Record<ToolCategory, string> = {
    profile: "User",
    human_design: "Sparkles",
    diario: "Calendar",
    memorias: "Brain",
    sessoes: "MessageSquare",
    biblioteca: "BookOpen",
    web_search: "Globe",
    relacionamentos: "Users",
    contexto: "FileUser",
    sistema: "Settings",
  };
  return icons[category] || "Wrench";
}

/**
 * Get humanized tool message for UI feedback
 */
export function getHumanizedToolMessage(toolName: string): string {
  const messages: Record<string, string> = {
    // Profile
    kairos_getProfile: "👤 Carregando suas preferências...",
    kairos_updateProfile: "⚙️ Atualizando suas configurações...",
    // Human Design
    kairos_getHumanDesignProfile: "✨ Conectando com seu Human Design...",
    // User Life Context
    kairos_getUserLifeContext: "📋 Carregando seu contexto de vida...",
    // Daily Logs
    kairos_getDailyLogs: "📅 Acessando seus registros recentes...",
    kairos_createDailyLog: "📝 Registrando seu check-in do dia...",
    // Memories
    kairos_getMemories: "🧠 Buscando memórias de nossas conversas...",
    kairos_createMemory: "💫 Guardando este insight para o futuro...",
    kairos_deleteMemory: "🗑️ Removendo memória...",
    // Sessions
    kairos_listSessions: "📋 Listando suas conversas anteriores...",
    kairos_getSession: "📂 Abrindo sessão...",
    kairos_getSessionMessages: "💬 Recuperando contexto de conversa anterior...",
    kairos_updateSessionTitle: "✏️ Atualizando título da sessão...",
    // HD Library
    kairos_searchHdLibrary: "📚 Consultando a biblioteca de Human Design...",
    kairos_getHdLibraryEntry: "📖 Buscando conteúdo específico...",
    // Web Search
    kairos_webSearchHumanDesign: "🌐 Buscando nas fontes oficiais (Jovian Archive)...",
    // Friends & Relationships
    kairos_listFriends: "👥 Listando suas conexões...",
    kairos_getFriend: "👤 Buscando perfil da pessoa...",
    kairos_getRelationship: "💜 Analisando a dinâmica de relacionamento...",
    kairos_listRelationships: "💕 Listando suas análises de relacionamento...",
    kairos_getRelationshipAdvice: "💡 Preparando orientação para este relacionamento...",
  };
  return messages[toolName] || `🔧 Processando ${toolName}...`;
}

/**
 * Get tool priority for execution order
 * Higher = should be called first
 */
export function getToolPriority(toolName: string): number {
  const priorities: Record<string, number> = {
    // Initialization (call first)
    kairos_getHumanDesignProfile: 100,
    kairos_getProfile: 95,
    kairos_getUserLifeContext: 92, // High priority - context for personalization
    kairos_getMemories: 90,
    kairos_getDailyLogs: 85,
    // Knowledge retrieval (call before responding)
    kairos_searchHdLibrary: 80,
    kairos_getHdLibraryEntry: 75,
    // Relationships context (important for personalization)
    kairos_listFriends: 70,
    kairos_getFriend: 68,
    kairos_getRelationship: 65,
    kairos_listRelationships: 62,
    kairos_getRelationshipAdvice: 60,
    // Fallback search
    kairos_webSearchHumanDesign: 50,
    // Context retrieval
    kairos_listSessions: 40,
    kairos_getSession: 35,
    kairos_getSessionMessages: 30,
    // Write operations (call as needed)
    kairos_createDailyLog: 20,
    kairos_createMemory: 15,
    kairos_updateProfile: 10,
    kairos_updateSessionTitle: 10,
    kairos_deleteMemory: 5,
  };
  return priorities[toolName] || 0;
}

/**
 * Get tools grouped by category
 */
export function getToolsByCategory(): Record<ToolCategory, KairosTool[]> {
  const grouped: Record<ToolCategory, KairosTool[]> = {
    profile: [],
    human_design: [],
    contexto: [],
    diario: [],
    memorias: [],
    sessoes: [],
    biblioteca: [],
    web_search: [],
    relacionamentos: [],
    sistema: [],
  };

  for (const tool of KAIROS_MCP_TOOLS) {
    const category = getKairosToolCategory(tool.name);
    grouped[category].push(tool);
  }

  return grouped;
}

/**
 * Get initialization tools (should be called at conversation start)
 */
export function getInitializationTools(): KairosTool[] {
  const initToolNames = [
    "kairos_getHumanDesignProfile",
    "kairos_getUserLifeContext",
    "kairos_getMemories",
    "kairos_getDailyLogs",
  ];
  return KAIROS_MCP_TOOLS.filter((t) => initToolNames.includes(t.name));
}

/**
 * Get knowledge tools (should be called before responding about HD concepts)
 */
export function getKnowledgeTools(): KairosTool[] {
  const knowledgeToolNames = [
    "kairos_searchHdLibrary",
    "kairos_getHdLibraryEntry",
    "kairos_webSearchHumanDesign",
  ];
  return KAIROS_MCP_TOOLS.filter((t) => knowledgeToolNames.includes(t.name));
}
