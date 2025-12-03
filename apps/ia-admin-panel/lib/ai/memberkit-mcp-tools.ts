/**
 * Memberkit MCP Tools - Definições de ferramentas para OpenAI Function Calling
 * 
 * 26 ferramentas para integração com a API Memberkit:
 * - Academy (conta)
 * - Courses (cursos e aulas)
 * - Classrooms (turmas)
 * - Memberships (assinaturas)
 * - Users (membros)
 * - Rankings
 * - Scores (pontuações)
 * - Quizzes
 * - Comments (comentários)
 */

// Tool definition for OpenAI Responses API
export interface MemberkitTool {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
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
 * Status possíveis de membros na Memberkit
 */
export const MEMBER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BLOCKED: 'blocked',
  ARCHIVED: 'archived',
} as const;

/**
 * Status possíveis de assinaturas na Memberkit
 */
export const MEMBERSHIP_STATUS = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  EXPIRED: 'expired',
  PENDING: 'pending',
} as const;

/**
 * Status possíveis de comentários
 */
export const COMMENT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

/**
 * Complete list of Memberkit MCP Tools (26 tools)
 */
export const MEMBERKIT_MCP_TOOLS: MemberkitTool[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // ACADEMY - Informações da Conta
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'memberkit_get_academy',
    description: 'Retorna informações da conta/academia autenticada. Inclui nome, subdomínio, domínio customizado, email e URLs. Use para verificar configurações gerais da plataforma.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COURSES - Cursos e Aulas
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'memberkit_list_courses',
    description: 'Lista todos os cursos cadastrados na plataforma. Retorna id, nome, descrição, posição, imagem e categoria de cada curso. Suporta paginação.',
    parameters: {
      type: 'object',
      properties: {
        page: {
          type: 'number',
          default: 1,
          description: 'Número da página para paginação (começa em 1)'
        }
      }
    }
  },
  {
    type: 'function',
    name: 'memberkit_get_course',
    description: 'Retorna detalhes completos de um curso específico, incluindo módulos, aulas e configurações. Use após listar cursos para obter informações detalhadas.',
    parameters: {
      type: 'object',
      properties: {
        course_id: {
          type: 'number',
          description: 'ID único do curso na Memberkit'
        }
      },
      required: ['course_id']
    }
  },
  {
    type: 'function',
    name: 'memberkit_get_lesson',
    description: 'Retorna detalhes completos de uma aula específica, incluindo vídeo, arquivos anexos, duração e progresso. Útil para verificar conteúdo de uma aula específica.',
    parameters: {
      type: 'object',
      properties: {
        course_id: {
          type: 'number',
          description: 'ID do curso que contém a aula'
        },
        lesson_id: {
          type: 'number',
          description: 'ID único da aula'
        }
      },
      required: ['course_id', 'lesson_id']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CLASSROOMS - Turmas
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'memberkit_list_classrooms',
    description: 'Lista todas as turmas cadastradas. Turmas agrupam alunos e podem ter datas de início/fim específicas. Suporta paginação.',
    parameters: {
      type: 'object',
      properties: {
        page: {
          type: 'number',
          default: 1,
          description: 'Número da página para paginação'
        }
      }
    }
  },
  {
    type: 'function',
    name: 'memberkit_get_classroom',
    description: 'Retorna detalhes completos de uma turma específica, incluindo alunos matriculados, datas e configurações.',
    parameters: {
      type: 'object',
      properties: {
        classroom_id: {
          type: 'number',
          description: 'ID único da turma'
        }
      },
      required: ['classroom_id']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMBERSHIPS - Assinaturas e Níveis
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'memberkit_list_membership_levels',
    description: 'Lista todos os níveis de assinatura disponíveis (planos). Retorna nome, descrição, preço e benefícios de cada nível.',
    parameters: {
      type: 'object',
      properties: {
        page: {
          type: 'number',
          default: 1,
          description: 'Número da página para paginação'
        }
      }
    }
  },
  {
    type: 'function',
    name: 'memberkit_list_memberships',
    description: 'Lista todas as assinaturas/memberships. Mostra quais usuários estão em quais planos, status e datas de validade. IMPORTANTE: Para buscar assinatura de um usuário específico, use o parâmetro user_id.',
    parameters: {
      type: 'object',
      properties: {
        user_id: {
          type: 'number',
          description: 'Filtrar assinaturas de um usuário específico pelo ID'
        },
        membership_level_id: {
          type: 'number',
          description: 'Filtrar por nível de assinatura específico'
        },
        status: {
          type: 'string',
          enum: ['active', 'canceled', 'expired', 'pending'],
          description: 'Filtrar por status: active (ativa), canceled (cancelada), expired (expirada), pending (pendente)'
        },
        page: {
          type: 'number',
          default: 1,
          description: 'Número da página para paginação'
        }
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // USERS - Membros/Alunos
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'memberkit_list_users',
    description: 'Lista membros/alunos cadastrados com filtros. SEMPRE use esta ferramenta primeiro para encontrar o ID de um usuário antes de outras operações. Busque por email para encontrar usuários específicos.',
    parameters: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Buscar por email exato ou parcial do membro'
        },
        name: {
          type: 'string',
          description: 'Buscar por nome do membro'
        },
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'blocked', 'archived'],
          description: 'Filtrar por status: active, inactive, blocked, archived'
        },
        membership_level_id: {
          type: 'number',
          description: 'Filtrar por nível de assinatura'
        },
        classroom_id: {
          type: 'number',
          description: 'Filtrar por turma'
        },
        page: {
          type: 'number',
          default: 1,
          description: 'Número da página para paginação'
        }
      }
    }
  },
  {
    type: 'function',
    name: 'memberkit_get_user',
    description: 'Retorna detalhes completos de um membro específico: nome, email, assinaturas, progresso nos cursos, histórico de atividades recentes, pontuação e ranking. Use após encontrar o ID via memberkit_list_users.',
    parameters: {
      type: 'object',
      properties: {
        user_id: {
          type: 'number',
          description: 'ID único do membro na Memberkit'
        }
      },
      required: ['user_id']
    }
  },
  {
    type: 'function',
    name: 'memberkit_create_user',
    description: 'Cadastra um novo membro/aluno na plataforma. Requer email (único). Opcionalmente pode associar a uma assinatura ou turma. SEMPRE confirme os dados antes de criar.',
    parameters: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email do novo membro (obrigatório, deve ser único)'
        },
        name: {
          type: 'string',
          description: 'Nome completo do membro'
        },
        password: {
          type: 'string',
          description: 'Senha inicial (se não informada, usuário precisará recuperar)'
        },
        membership_level_id: {
          type: 'number',
          description: 'ID do nível de assinatura para associar'
        },
        classroom_id: {
          type: 'number',
          description: 'ID da turma para matricular'
        },
        expires_at: {
          type: 'string',
          description: 'Data de expiração da assinatura (formato: YYYY-MM-DD)'
        },
        custom_fields: {
          type: 'object',
          description: 'Campos customizados em formato chave-valor'
        }
      },
      required: ['email']
    }
  },
  {
    type: 'function',
    name: 'memberkit_update_user',
    description: 'Atualiza dados de um membro existente. Pode alterar nome, email, assinatura, turma e campos customizados. SEMPRE confirme as alterações antes de executar.',
    parameters: {
      type: 'object',
      properties: {
        user_id: {
          type: 'number',
          description: 'ID do membro a atualizar'
        },
        email: {
          type: 'string',
          description: 'Novo email (deve ser único)'
        },
        name: {
          type: 'string',
          description: 'Novo nome'
        },
        membership_level_id: {
          type: 'number',
          description: 'Novo nível de assinatura'
        },
        classroom_id: {
          type: 'number',
          description: 'Nova turma'
        },
        expires_at: {
          type: 'string',
          description: 'Nova data de expiração (formato: YYYY-MM-DD)'
        },
        blocked: {
          type: 'boolean',
          description: 'Se true, bloqueia o acesso do usuário'
        },
        custom_fields: {
          type: 'object',
          description: 'Campos customizados para atualizar'
        }
      },
      required: ['user_id']
    }
  },
  {
    type: 'function',
    name: 'memberkit_archive_user',
    description: 'Arquiva (soft delete) um membro. O membro perde acesso mas seus dados são mantidos. AÇÃO DESTRUTIVA: SEMPRE peça confirmação explícita antes de executar.',
    parameters: {
      type: 'object',
      properties: {
        user_id: {
          type: 'number',
          description: 'ID do membro a arquivar'
        }
      },
      required: ['user_id']
    }
  },
  {
    type: 'function',
    name: 'memberkit_get_user_activities',
    description: 'Retorna histórico de atividades de um membro: aulas assistidas, tempo de acesso, interações, downloads, etc. Útil para verificar engajamento e progresso.',
    parameters: {
      type: 'object',
      properties: {
        user_id: {
          type: 'number',
          description: 'ID do membro'
        },
        page: {
          type: 'number',
          default: 1,
          description: 'Página para paginação'
        },
        per_page: {
          type: 'number',
          default: 20,
          description: 'Quantidade de atividades por página'
        }
      },
      required: ['user_id']
    }
  },
  {
    type: 'function',
    name: 'memberkit_generate_magic_link',
    description: 'Gera um link mágico de acesso para um membro. O link permite login sem senha por tempo limitado. Útil para suporte e recuperação de acesso.',
    parameters: {
      type: 'object',
      properties: {
        user_id: {
          type: 'number',
          description: 'ID do membro para gerar o link'
        },
        expires_in: {
          type: 'number',
          default: 3600,
          description: 'Tempo de validade em segundos (padrão: 1 hora = 3600)'
        }
      },
      required: ['user_id']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RANKINGS - Classificação e Gamificação
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'memberkit_list_rankings',
    description: 'Lista todos os rankings disponíveis na plataforma. Rankings são usados para gamificação e mostram classificação dos alunos por pontuação.',
    parameters: {
      type: 'object',
      properties: {
        page: {
          type: 'number',
          default: 1,
          description: 'Página para paginação'
        }
      }
    }
  },
  {
    type: 'function',
    name: 'memberkit_get_user_ranking',
    description: 'Retorna a posição e pontuação de um usuário em um ranking específico. Inclui posição atual, total de pontos e histórico.',
    parameters: {
      type: 'object',
      properties: {
        ranking_id: {
          type: 'number',
          description: 'ID do ranking'
        },
        user_id: {
          type: 'number',
          description: 'ID do usuário para verificar posição'
        }
      },
      required: ['ranking_id']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SCORES - Pontuações
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'memberkit_create_score',
    description: 'Cadastra pontuação para um usuário. Usado para gamificação. A pontuação é somada ao total do usuário e afeta seu ranking.',
    parameters: {
      type: 'object',
      properties: {
        user_id: {
          type: 'number',
          description: 'ID do usuário que receberá os pontos'
        },
        points: {
          type: 'number',
          description: 'Quantidade de pontos a adicionar (pode ser negativo para remover)'
        },
        description: {
          type: 'string',
          description: 'Descrição/motivo da pontuação (ex: "Conclusão do módulo 1")'
        },
        ranking_id: {
          type: 'number',
          description: 'ID do ranking onde os pontos serão computados'
        }
      },
      required: ['user_id', 'points']
    }
  },
  {
    type: 'function',
    name: 'memberkit_delete_score',
    description: 'Remove uma pontuação específica. Isso subtrai os pontos do total do usuário. AÇÃO DESTRUTIVA: confirme antes de executar.',
    parameters: {
      type: 'object',
      properties: {
        score_id: {
          type: 'number',
          description: 'ID da pontuação a remover'
        }
      },
      required: ['score_id']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // QUIZZES - Questionários
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'memberkit_list_quiz_submissions',
    description: 'Lista submissões de quizzes/questionários. Mostra respostas dos alunos, notas e status de aprovação.',
    parameters: {
      type: 'object',
      properties: {
        user_id: {
          type: 'number',
          description: 'Filtrar submissões de um usuário específico'
        },
        quiz_id: {
          type: 'number',
          description: 'Filtrar por quiz específico'
        },
        page: {
          type: 'number',
          default: 1,
          description: 'Página para paginação'
        }
      }
    }
  },
  {
    type: 'function',
    name: 'memberkit_get_quiz_submission',
    description: 'Retorna detalhes de uma submissão de quiz específica: respostas, acertos, nota e feedback.',
    parameters: {
      type: 'object',
      properties: {
        submission_id: {
          type: 'number',
          description: 'ID da submissão'
        }
      },
      required: ['submission_id']
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMENTS - Comentários
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    name: 'memberkit_list_comments',
    description: 'Lista comentários com filtros. Pode filtrar por aula, usuário ou status de aprovação. Útil para moderação.',
    parameters: {
      type: 'object',
      properties: {
        lesson_id: {
          type: 'number',
          description: 'Filtrar comentários de uma aula específica'
        },
        user_id: {
          type: 'number',
          description: 'Filtrar comentários de um usuário específico'
        },
        status: {
          type: 'string',
          enum: ['pending', 'approved', 'rejected'],
          description: 'Filtrar por status: pending (pendente), approved (aprovado), rejected (rejeitado)'
        },
        page: {
          type: 'number',
          default: 1,
          description: 'Página para paginação'
        }
      }
    }
  },
  {
    type: 'function',
    name: 'memberkit_get_comment',
    description: 'Retorna detalhes de um comentário específico: conteúdo, autor, data, respostas e status de aprovação.',
    parameters: {
      type: 'object',
      properties: {
        comment_id: {
          type: 'number',
          description: 'ID do comentário'
        }
      },
      required: ['comment_id']
    }
  },
  {
    type: 'function',
    name: 'memberkit_create_comment',
    description: 'Cria um novo comentário em uma aula. Pode ser usado para adicionar notas administrativas ou responder dúvidas.',
    parameters: {
      type: 'object',
      properties: {
        lesson_id: {
          type: 'number',
          description: 'ID da aula onde o comentário será criado'
        },
        user_id: {
          type: 'number',
          description: 'ID do usuário autor do comentário'
        },
        content: {
          type: 'string',
          description: 'Conteúdo do comentário'
        },
        parent_id: {
          type: 'number',
          description: 'ID do comentário pai (para respostas)'
        }
      },
      required: ['lesson_id', 'user_id', 'content']
    }
  },
  {
    type: 'function',
    name: 'memberkit_delete_comment',
    description: 'Remove um comentário. AÇÃO DESTRUTIVA: sempre confirme antes de executar.',
    parameters: {
      type: 'object',
      properties: {
        comment_id: {
          type: 'number',
          description: 'ID do comentário a remover'
        }
      },
      required: ['comment_id']
    }
  },
  {
    type: 'function',
    name: 'memberkit_approve_comment',
    description: 'Aprova um comentário pendente, tornando-o visível para outros usuários.',
    parameters: {
      type: 'object',
      properties: {
        comment_id: {
          type: 'number',
          description: 'ID do comentário a aprovar'
        }
      },
      required: ['comment_id']
    }
  },
  {
    type: 'function',
    name: 'memberkit_reject_comment',
    description: 'Rejeita um comentário, impedindo que seja exibido. Útil para moderação de conteúdo inadequado.',
    parameters: {
      type: 'object',
      properties: {
        comment_id: {
          type: 'number',
          description: 'ID do comentário a rejeitar'
        }
      },
      required: ['comment_id']
    }
  }
];

/**
 * Map tool name to its category for UI display
 */
export function getMemberkitToolCategory(toolName: string): string {
  if (toolName.includes('academy')) return 'academy';
  if (toolName.includes('course') || toolName.includes('lesson')) return 'courses';
  if (toolName.includes('classroom')) return 'classrooms';
  if (toolName.includes('membership')) return 'memberships';
  if (toolName.includes('user') && !toolName.includes('ranking')) return 'users';
  if (toolName.includes('ranking')) return 'rankings';
  if (toolName.includes('score')) return 'scores';
  if (toolName.includes('quiz')) return 'quizzes';
  if (toolName.includes('comment')) return 'comments';
  return 'memberkit';
}

/**
 * Get icon name for tool category
 */
export function getMemberkitToolIcon(category: string): string {
  const icons: Record<string, string> = {
    academy: 'Building2',
    courses: 'BookOpen',
    classrooms: 'Users2',
    memberships: 'CreditCard',
    users: 'User',
    rankings: 'Trophy',
    scores: 'Star',
    quizzes: 'ClipboardCheck',
    comments: 'MessageSquare',
    memberkit: 'GraduationCap',
  };
  return icons[category] || 'Package';
}

/**
 * Get friendly category name in Portuguese
 */
export function getMemberkitCategoryName(category: string): string {
  const names: Record<string, string> = {
    academy: 'Academia',
    courses: 'Cursos',
    classrooms: 'Turmas',
    memberships: 'Assinaturas',
    users: 'Membros',
    rankings: 'Rankings',
    scores: 'Pontuações',
    quizzes: 'Quizzes',
    comments: 'Comentários',
    memberkit: 'Memberkit',
  };
  return names[category] || category;
}

/**
 * Format member status to Portuguese
 */
export function formatMemberStatus(status: string): string {
  const statusMap: Record<string, string> = {
    active: '✅ Ativo',
    inactive: '⚪ Inativo',
    blocked: '🚫 Bloqueado',
    archived: '📦 Arquivado',
  };
  return statusMap[status] || status;
}

/**
 * Format membership status to Portuguese
 */
export function formatMembershipStatus(status: string): string {
  const statusMap: Record<string, string> = {
    active: '✅ Ativa',
    canceled: '❌ Cancelada',
    expired: '⏰ Expirada',
    pending: '⏳ Pendente',
  };
  return statusMap[status] || status;
}

/**
 * Format comment status to Portuguese
 */
export function formatCommentStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '⏳ Pendente',
    approved: '✅ Aprovado',
    rejected: '❌ Rejeitado',
  };
  return statusMap[status] || status;
}

/**
 * Format date in Brazilian format
 */
export function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

