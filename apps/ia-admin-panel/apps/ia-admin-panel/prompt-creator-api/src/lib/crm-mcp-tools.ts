import { createClient } from '@supabase/supabase-js'
import { getClientCredentials, createAdminClient, createUserClient } from './supabase'

// ============================================================================
// MCP Tool definitions for CRM AI Assistant
// ============================================================================

export const CRM_MCP_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'analisar_pipeline',
      description: 'Analisa o pipeline do CRM com métricas detalhadas: leads por estágio, valores, SLAs, conversão. Use SEMPRE que o usuário perguntar sobre performance, pipeline, métricas ou quiser entender o funil.',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: { 
            type: 'number', 
            description: 'OPCIONAL - Período em dias para análise. Padrão: 30 dias' 
          },
          estagio_especifico: {
            type: 'string',
            description: 'OPCIONAL - Nome do estágio para análise focada'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'sugerir_acao',
      description: 'Sugere a melhor próxima ação para um lead específico baseado em seu histórico, tempo no estágio, SLA e padrões de sucesso. REQUER lead_id.',
      parameters: {
        type: 'object',
        properties: {
          lead_id: { 
            type: 'string', 
            description: 'UUID do lead para análise' 
          }
        },
        required: ['lead_id']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'listar_leads_risco',
      description: 'Lista leads em risco: SLA atrasado, sem atividade recente, ou estagnados. Use para priorizar ações urgentes.',
      parameters: {
        type: 'object',
        properties: {
          tipo_risco: { 
            type: 'string', 
            enum: ['sla_atrasado', 'sem_atividade', 'estagnado', 'todos'],
            description: 'OPCIONAL - Tipo de risco para filtrar. Padrão: todos' 
          },
          limite: { 
            type: 'number', 
            description: 'OPCIONAL - Quantidade máxima de leads. Padrão: 10' 
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'buscar_lead',
      description: 'Busca informações detalhadas de um lead específico incluindo histórico de atividades, notas e qualificação BANT.',
      parameters: {
        type: 'object',
        properties: {
          lead_id: { 
            type: 'string', 
            description: 'UUID do lead' 
          },
          nome: {
            type: 'string',
            description: 'ALTERNATIVO - Nome ou parte do nome do lead para busca'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'listar_leads',
      description: 'Lista leads com filtros opcionais. Sem filtros retorna os mais recentes.',
      parameters: {
        type: 'object',
        properties: {
          estagio: { 
            type: 'string', 
            description: 'OPCIONAL - Filtrar por estágio' 
          },
          prioridade: { 
            type: 'string', 
            enum: ['low', 'medium', 'high'],
            description: 'OPCIONAL - Filtrar por prioridade' 
          },
          bant_score_min: {
            type: 'number',
            description: 'OPCIONAL - Score BANT mínimo (0-4)'
          },
          limite: { 
            type: 'number', 
            description: 'OPCIONAL - Quantidade máxima. Padrão: 20' 
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'atualizar_lead',
      description: 'Atualiza informações de um lead: estágio, valor, prioridade, campos BANT, etc.',
      parameters: {
        type: 'object',
        properties: {
          lead_id: { 
            type: 'string', 
            description: 'UUID do lead a atualizar' 
          },
          campo: {
            type: 'string',
            enum: ['stage', 'priority', 'value', 'bant_budget', 'bant_authority', 'bant_need', 'bant_timeline', 'description'],
            description: 'Campo a ser atualizado'
          },
          valor: {
            type: 'string',
            description: 'Novo valor do campo'
          }
        },
        required: ['lead_id', 'campo', 'valor']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'adicionar_nota',
      description: 'Adiciona uma nota ou observação a um lead.',
      parameters: {
        type: 'object',
        properties: {
          lead_id: { 
            type: 'string', 
            description: 'UUID do lead' 
          },
          nota: {
            type: 'string',
            description: 'Conteúdo da nota'
          }
        },
        required: ['lead_id', 'nota']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'obter_metas',
      description: 'Obtém as metas atuais do CRM e seu progresso (receita, conversões, leads).',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'gerar_resumo_diario',
      description: 'Gera um resumo executivo do dia: leads novos, movimentações, SLAs, metas, destaques e alertas.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'listar_templates',
      description: 'Lista templates de mensagem disponíveis para WhatsApp e Email.',
      parameters: {
        type: 'object',
        properties: {
          tipo: {
            type: 'string',
            enum: ['whatsapp', 'email'],
            description: 'OPCIONAL - Filtrar por tipo de canal'
          },
          estagio_sugerido: {
            type: 'string',
            description: 'OPCIONAL - Filtrar por estágio onde o template é sugerido'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'sugerir_template',
      description: 'Sugere o melhor template de mensagem para um lead específico baseado no estágio e contexto.',
      parameters: {
        type: 'object',
        properties: {
          lead_id: {
            type: 'string',
            description: 'UUID do lead'
          },
          canal: {
            type: 'string',
            enum: ['whatsapp', 'email'],
            description: 'Canal de comunicação'
          }
        },
        required: ['lead_id', 'canal']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'calcular_forecast',
      description: 'Calcula previsão de receita baseada no pipeline atual e taxas históricas de conversão.',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Horizonte de previsão em dias. Padrão: 30'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'analisar_objecoes',
      description: 'Analisa as principais objeções dos leads. Use quando o usuário perguntar sobre "objeções", "por que leads não fecham", "motivos de perda", "resistências", "barreiras de venda".',
      parameters: {
        type: 'object',
        properties: {
          estagio: {
            type: 'string',
            description: 'OPCIONAL - Filtrar por estágio específico'
          },
          limite: {
            type: 'number',
            description: 'OPCIONAL - Quantidade máxima de leads a analisar. Padrão: 50'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'buscar_notas_padrao',
      description: 'Busca padrões nas notas e atividades dos leads. Use para encontrar palavras-chave recorrentes como objeções, problemas, feedbacks.',
      parameters: {
        type: 'object',
        properties: {
          palavra_chave: {
            type: 'string',
            description: 'Palavra ou frase para buscar nas notas (ex: "preço", "concorrente", "orçamento")'
          },
          limite: {
            type: 'number',
            description: 'OPCIONAL - Quantidade máxima de resultados. Padrão: 20'
          }
        }
      }
    }
  },
  // ==========================================================================
  // TOOLS ESTRATÉGICAS PARA CRO/CEO
  // ==========================================================================
  {
    type: 'function' as const,
    function: {
      name: 'analisar_receita',
      description: 'Analisa receita por período, categoria e método de pagamento. Use para perguntas sobre "receita", "faturamento", "vendas do mês", "quanto vendemos".',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Período em dias para análise. Padrão: 30'
          },
          agrupar_por: {
            type: 'string',
            enum: ['dia', 'semana', 'mes', 'categoria', 'metodo_pagamento'],
            description: 'OPCIONAL - Como agrupar os dados. Padrão: mes'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'comparar_periodos',
      description: 'Compara métricas entre dois períodos (ex: mês atual vs anterior). Use para "crescimento", "comparativo", "evolução", "vs mês passado".',
      parameters: {
        type: 'object',
        properties: {
          metrica: {
            type: 'string',
            enum: ['receita', 'leads', 'conversoes', 'ticket_medio', 'pipeline'],
            description: 'Métrica a comparar'
          },
          periodo_atual_dias: {
            type: 'number',
            description: 'OPCIONAL - Dias do período atual. Padrão: 30'
          },
          periodo_anterior_dias: {
            type: 'number',
            description: 'OPCIONAL - Dias do período anterior. Padrão: 30'
          }
        },
        required: ['metrica']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'analisar_conversao_funil',
      description: 'Analisa taxa de conversão detalhada entre estágios do funil. Use para "conversão", "taxa de conversão", "gargalo do funil", "onde estamos perdendo".',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Período em dias. Padrão: 30'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'analisar_canais',
      description: 'Analisa performance por canal/fonte de leads. Use para "qual canal", "melhor fonte", "de onde vêm os leads", "ROI de canal".',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Período em dias. Padrão: 30'
          },
          ordenar_por: {
            type: 'string',
            enum: ['quantidade', 'valor', 'conversao'],
            description: 'OPCIONAL - Como ordenar. Padrão: quantidade'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'calcular_velocidade_vendas',
      description: 'Calcula velocidade de vendas: tempo médio no funil e por estágio. Use para "tempo médio", "ciclo de venda", "velocidade", "quanto tempo leva".',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Período para análise de leads fechados. Padrão: 90'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'analisar_perdas',
      description: 'Analisa leads perdidos: motivos, estágios onde perdemos, valor perdido. Use para "perdas", "leads perdidos", "por que perdemos", "churn de leads".',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Período em dias. Padrão: 30'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'gerar_relatorio_executivo',
      description: 'Gera relatório executivo completo para CRO/CEO com todas as métricas principais: receita, pipeline, conversão, forecast, metas, riscos. Use para "relatório", "visão geral", "resumo executivo", "dashboard completo".',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Período em dias. Padrão: 30'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'analisar_ticket_medio',
      description: 'Analisa ticket médio por período, estágio e segmento. Use para "ticket médio", "valor médio de venda", "deal size".',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Período em dias. Padrão: 30'
          },
          segmentar_por: {
            type: 'string',
            enum: ['canal', 'estagio', 'prioridade'],
            description: 'OPCIONAL - Como segmentar a análise'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'projetar_meta',
      description: 'Projeta probabilidade de bater a meta com base no ritmo atual. Use para "vamos bater a meta?", "probabilidade", "projeção de meta", "ritmo de vendas".',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  // ==========================================================================
  // TOOLS ESPECÍFICAS CEO - Visão Macro e Estratégica
  // ==========================================================================
  {
    type: 'function' as const,
    function: {
      name: 'analisar_cobertura_pipeline',
      description: 'Analisa cobertura de pipeline vs meta. Responde: "Temos pipeline suficiente?", "Cobertura de meta", "Pipeline vs meta". CEO adora essa métrica.',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Horizonte em dias. Padrão: 30'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'top_oportunidades',
      description: 'Lista as TOP N oportunidades que podem fazer a diferença no resultado. Use para "principais negócios", "maiores oportunidades", "deals importantes".',
      parameters: {
        type: 'object',
        properties: {
          limite: {
            type: 'number',
            description: 'OPCIONAL - Quantidade de oportunidades. Padrão: 5'
          },
          excluir_fechados: {
            type: 'boolean',
            description: 'OPCIONAL - Excluir leads já fechados. Padrão: true'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'receita_por_segmento',
      description: 'Analisa receita por segmento/canal/origem. Use para "receita por segmento", "quais clientes mais lucrativos", "performance por mercado".',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Período em dias. Padrão: 30'
          },
          agrupar_por: {
            type: 'string',
            enum: ['canal', 'source', 'priority'],
            description: 'OPCIONAL - Como segmentar. Padrão: canal'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'saude_base_clientes',
      description: 'Analisa saúde da base: clientes ativos vs inativos, churn, motivos de cancelamento. Use para "churn", "clientes ativos", "base de clientes".',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Período para análise de churn. Padrão: 30'
          }
        }
      }
    }
  },
  // ==========================================================================
  // TOOLS ESPECÍFICAS CRO - Visão Operacional e de Funil
  // ==========================================================================
  {
    type: 'function' as const,
    function: {
      name: 'performance_vendedores',
      description: 'Analisa performance individual de vendedores: conversão, ticket, volume. Use para "ranking vendedores", "top performers", "quem precisa de ajuda".',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Período em dias. Padrão: 30'
          },
          ordenar_por: {
            type: 'string',
            enum: ['receita', 'conversao', 'volume', 'ticket_medio'],
            description: 'OPCIONAL - Métrica para ordenar. Padrão: receita'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'atividades_time',
      description: 'Analisa volume de atividades do time: ligações, WhatsApp, reuniões, propostas. Use para "atividades", "produtividade", "quantos contatos".',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Período em dias. Padrão: 7'
          },
          vendedor_id: {
            type: 'string',
            description: 'OPCIONAL - UUID de vendedor específico'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'tempo_por_estagio',
      description: 'Analisa tempo médio que leads passam em cada estágio. Identifica gargalos. Use para "onde leads ficam parados", "gargalo do funil", "tempo por etapa".',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Período em dias. Padrão: 30'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'motivo_perda_detalhado',
      description: 'Analisa motivos de perda por canal, vendedor e estágio. Use para "por que perdemos por canal", "vendedor que mais perde", "onde perdemos mais".',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Período em dias. Padrão: 30'
          },
          agrupar_por: {
            type: 'string',
            enum: ['canal', 'vendedor', 'estagio'],
            description: 'OPCIONAL - Como agrupar. Padrão: canal'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'qualidade_leads_por_origem',
      description: 'Analisa qualidade de leads por origem/canal: conversão, ticket, tempo de ciclo. Use para "qual canal traz lead melhor", "ROI de canal", "qualidade por fonte".',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Período em dias. Padrão: 30'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'sla_tempo_resposta',
      description: 'Analisa SLA de tempo de resposta ao lead. Use para "tempo de resposta", "SLA", "quanto tempo para responder lead".',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Período em dias. Padrão: 7'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'uso_crm',
      description: 'Analisa qualidade de uso do CRM: campos preenchidos, atualizações de estágio, pipeline fantasma. Use para "uso do CRM", "dados preenchidos", "pipeline fantasma".',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Período em dias. Padrão: 7'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'forecast_detalhado',
      description: 'Gera forecast detalhado com probabilidade por estágio e acurácia histórica. Use para "forecast detalhado", "previsão de vendas", "quanto vamos fechar".',
      parameters: {
        type: 'object',
        properties: {
          horizonte_dias: {
            type: 'number',
            description: 'OPCIONAL - Horizonte de previsão. Padrão: 30'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'dashboard_ceo',
      description: 'Dashboard resumido para CEO com os 5 principais indicadores. Use quando CEO pedir "resumo", "como estamos", "visão geral rápida".',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Período em dias. Padrão: 30'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'dashboard_cro',
      description: 'Dashboard operacional para CRO com métricas de funil e time. Use quando CRO pedir "dashboard", "métricas operacionais", "visão do funil".',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Período em dias. Padrão: 30'
          }
        }
      }
    }
  },
  // ==========================================================================
  // TOOL PARA GERAÇÃO DE PROPOSTAS COM IA
  // ==========================================================================
  {
    type: 'function' as const,
    function: {
      name: 'gerar_contexto_proposta',
      description: 'Obtém contexto completo do lead para gerar texto de proposta comercial personalizada. Use quando o usuário quiser gerar uma proposta ou texto comercial.',
      parameters: {
        type: 'object',
        properties: {
          lead_id: {
            type: 'string',
            description: 'UUID do lead para o qual a proposta será gerada'
          },
          produtos_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'OPCIONAL - IDs dos produtos selecionados para a proposta'
          },
          valor_total: {
            type: 'number',
            description: 'OPCIONAL - Valor total da proposta'
          },
          desconto_percent: {
            type: 'number',
            description: 'OPCIONAL - Percentual de desconto aplicado'
          },
          validade_dias: {
            type: 'number',
            description: 'OPCIONAL - Dias de validade da proposta. Padrão: 30'
          },
          tom: {
            type: 'string',
            enum: ['formal', 'consultivo', 'amigavel'],
            description: 'OPCIONAL - Tom de voz do texto. Padrão: consultivo'
          },
          foco: {
            type: 'string',
            description: 'OPCIONAL - Ênfase específica para o texto (ex: "urgência", "economia", "qualidade")'
          }
        },
        required: ['lead_id']
      }
    }
  },
  // ==========================================================================
  // TOOLS PARA REPOSITÓRIO DE MENSAGENS (HISTÓRICO DE CONVERSAS)
  // ==========================================================================
  {
    type: 'function' as const,
    function: {
      name: 'obter_historico_conversa',
      description: 'Obtém o histórico de mensagens/conversas de WhatsApp com um cliente específico. CRÍTICO: Use SEMPRE antes de gerar propostas para entender o contexto real da negociação. Retorna mensagens do cliente, da IA e de atendentes humanos.',
      parameters: {
        type: 'object',
        properties: {
          whatsapp_cliente: {
            type: 'string',
            description: 'Número de WhatsApp do cliente (formato: 5511999999999)'
          },
          limite: {
            type: 'number',
            description: 'OPCIONAL - Quantidade máxima de mensagens. Padrão: 50'
          },
          apenas_cliente: {
            type: 'boolean',
            description: 'OPCIONAL - Se true, retorna apenas mensagens enviadas pelo cliente. Padrão: false (retorna todas)'
          },
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Buscar mensagens dos últimos X dias. Padrão: 30'
          }
        },
        required: ['whatsapp_cliente']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'buscar_conversas_lead',
      description: 'Busca conversas de WhatsApp de um lead específico usando seu ID. Encontra o WhatsApp do lead e retorna o histórico de mensagens. Ideal quando você tem apenas o lead_id.',
      parameters: {
        type: 'object',
        properties: {
          lead_id: {
            type: 'string',
            description: 'UUID do lead para buscar conversas'
          },
          limite: {
            type: 'number',
            description: 'OPCIONAL - Quantidade máxima de mensagens. Padrão: 50'
          },
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Buscar mensagens dos últimos X dias. Padrão: 30'
          }
        },
        required: ['lead_id']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'buscar_mensagens_por_texto',
      description: 'Busca mensagens no repositório que contenham um texto específico. Útil para encontrar conversas sobre temas específicos como "preço", "desconto", "prazo", etc.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Texto para buscar nas mensagens (usa busca full-text)'
          },
          whatsapp_cliente: {
            type: 'string',
            description: 'OPCIONAL - Filtrar por número de WhatsApp específico'
          },
          sender_type: {
            type: 'string',
            enum: ['cliente', 'ia', 'humano'],
            description: 'OPCIONAL - Filtrar por tipo de remetente'
          },
          limite: {
            type: 'number',
            description: 'OPCIONAL - Quantidade máxima de resultados. Padrão: 30'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'resumir_conversa',
      description: 'Obtém um resumo estruturado de uma conversa com um cliente: principais pontos discutidos, necessidades identificadas, objeções levantadas e próximos passos acordados. OBRIGATÓRIO: Forneça whatsapp_cliente OU lead_id (pelo menos um).',
      parameters: {
        type: 'object',
        properties: {
          whatsapp_cliente: {
            type: 'string',
            description: 'Número de WhatsApp do cliente (formato: 5511999999999). OBRIGATÓRIO se lead_id não for fornecido.'
          },
          lead_id: {
            type: 'string',
            description: 'UUID do lead - usado para buscar o WhatsApp automaticamente. OBRIGATÓRIO se whatsapp_cliente não for fornecido.'
          }
        },
        required: []
      }
    }
  },
  // ==========================================================================
  // TOOLS DE QUALIFICAÇÃO BANT (v99)
  // ==========================================================================
  {
    type: 'function' as const,
    function: {
      name: 'atualizar_bant',
      description: 'Atualiza qualificação BANT de um lead. Use quando descobrir informações sobre Budget (orçamento), Authority (decisor), Need (necessidade) ou Timeline (prazo). BANT score 0-1: Frio, 2: Morno, 3-4: Quente.',
      parameters: {
        type: 'object',
        properties: {
          lead_id: {
            type: 'string',
            description: 'UUID do lead'
          },
          bant_type: {
            type: 'string',
            enum: ['budget', 'authority', 'need', 'timeline'],
            description: 'Tipo de BANT: budget (orçamento confirmado), authority (é o decisor?), need (tem necessidade real?), timeline (tem prazo?)'
          },
          confirmed: {
            type: 'boolean',
            description: 'Se o critério foi confirmado pelo cliente'
          },
          value: {
            type: 'string',
            description: 'Valor/descrição (ex: "R$ 10.000 - R$ 20.000" para budget, "João Silva - Diretor" para authority, "Precisa até dezembro" para timeline)'
          },
          notes: {
            type: 'string',
            description: 'Observações adicionais sobre este critério'
          }
        },
        required: ['lead_id', 'bant_type', 'confirmed']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'analisar_bant_pipeline',
      description: 'Analisa qualificação BANT do pipeline. Mostra distribuição de leads por score BANT (Frio/Morno/Quente), taxas de conversão por score e estágios com melhor qualificação. Use para "análise de qualificação", "leads qualificados", "BANT do funil".',
      parameters: {
        type: 'object',
        properties: {
          periodo_dias: {
            type: 'number',
            description: 'OPCIONAL - Período em dias. Padrão: 30'
          },
          estagio: {
            type: 'string',
            description: 'OPCIONAL - Filtrar por estágio específico'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'atualizar_objecao',
      description: 'Registra a objeção principal de um lead. Use quando identificar uma resistência ou barreira de venda (preço, timing, concorrente, fit, etc).',
      parameters: {
        type: 'object',
        properties: {
          lead_id: {
            type: 'string',
            description: 'UUID do lead'
          },
          objection_type: {
            type: 'string',
            description: 'Tipo de objeção: "preço", "timing", "concorrente", "fit", "budget", "autoridade", "urgência", "outro"'
          },
          objection_details: {
            type: 'string',
            description: 'Detalhes/contexto da objeção'
          }
        },
        required: ['lead_id', 'objection_type']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'gerenciar_decision_map',
      description: 'Gerencia o mapa de decisão (stakeholders) de um lead B2B. Adiciona, atualiza ou remove pessoas envolvidas na decisão de compra.',
      parameters: {
        type: 'object',
        properties: {
          lead_id: {
            type: 'string',
            description: 'UUID do lead'
          },
          action: {
            type: 'string',
            enum: ['add', 'update', 'remove', 'list'],
            description: 'Ação: add (adicionar), update (atualizar), remove (remover), list (listar)'
          },
          stakeholder_name: {
            type: 'string',
            description: 'Nome do stakeholder (obrigatório para add/update/remove)'
          },
          stakeholder_role: {
            type: 'string',
            description: 'Cargo/função (ex: Diretor de TI, Gerente de Compras)'
          },
          influence: {
            type: 'string',
            enum: ['decisor', 'influenciador', 'usuario', 'bloqueador'],
            description: 'Nível de influência na decisão'
          },
          status: {
            type: 'string',
            enum: ['favoravel', 'neutro', 'contra', 'desconhecido'],
            description: 'Posição em relação à compra'
          },
          notes: {
            type: 'string',
            description: 'Observações sobre este stakeholder'
          }
        },
        required: ['lead_id', 'action']
      }
    }
  },
  // ==========================================================================
  // TOOLS DE METAS (v98 - crm_goals)
  // ==========================================================================
  {
    type: 'function' as const,
    function: {
      name: 'criar_meta',
      description: 'Cria uma nova meta de vendas. Use para definir targets de receita, conversões ou novos leads por período.',
      parameters: {
        type: 'object',
        properties: {
          metric: {
            type: 'string',
            enum: ['revenue', 'conversions', 'leads_created'],
            description: 'Tipo de métrica: revenue (faturamento R$), conversions (leads convertidos), leads_created (novos leads)'
          },
          target_value: {
            type: 'number',
            description: 'Valor alvo da meta (ex: 100000 para receita, 50 para conversões)'
          },
          period_type: {
            type: 'string',
            enum: ['weekly', 'monthly', 'quarterly'],
            description: 'Tipo de período. Padrão: monthly'
          },
          period_start: {
            type: 'string',
            description: 'Data início do período (YYYY-MM-DD)'
          },
          period_end: {
            type: 'string',
            description: 'Data fim do período (YYYY-MM-DD)'
          }
        },
        required: ['metric', 'target_value', 'period_start', 'period_end']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'analisar_metas',
      description: 'Analisa o progresso das metas atuais. Mostra % de atingimento, projeção de fechamento e ritmo necessário. Use para "como estão as metas", "vamos bater meta", "progresso das metas".',
      parameters: {
        type: 'object',
        properties: {
          metric: {
            type: 'string',
            enum: ['revenue', 'conversions', 'leads_created'],
            description: 'OPCIONAL - Filtrar por tipo de métrica'
          }
        }
      }
    }
  },
  // ==========================================================================
  // TOOLS DE PROPOSTAS (v102 - crm_proposals)
  // ==========================================================================
  {
    type: 'function' as const,
    function: {
      name: 'criar_proposta',
      description: 'Cria uma proposta comercial no sistema para um lead. A proposta é salva com número único, pode ser enviada por WhatsApp/email e rastreada. Use após gerar_contexto_proposta para salvar a proposta.',
      parameters: {
        type: 'object',
        properties: {
          lead_id: {
            type: 'string',
            description: 'UUID do lead'
          },
          title: {
            type: 'string',
            description: 'Título da proposta. Padrão: "Proposta Comercial"'
          },
          items: {
            type: 'array',
            description: 'Array de itens da proposta',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Nome do item' },
                description: { type: 'string', description: 'Descrição' },
                quantity: { type: 'number', description: 'Quantidade' },
                unit_price: { type: 'number', description: 'Preço unitário' }
              }
            }
          },
          subtotal: {
            type: 'number',
            description: 'Subtotal da proposta'
          },
          discount_percent: {
            type: 'number',
            description: 'Percentual de desconto (0-100)'
          },
          validity_days: {
            type: 'number',
            description: 'Dias de validade. Padrão: 30'
          },
          notes: {
            type: 'string',
            description: 'Observações para o cliente (será incluído na proposta)'
          },
          internal_notes: {
            type: 'string',
            description: 'Notas internas (não visíveis ao cliente)'
          }
        },
        required: ['lead_id', 'items', 'subtotal']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'listar_propostas',
      description: 'Lista propostas comerciais. Pode filtrar por lead ou status. Use para "propostas do lead", "propostas enviadas", "propostas pendentes".',
      parameters: {
        type: 'object',
        properties: {
          lead_id: {
            type: 'string',
            description: 'OPCIONAL - Filtrar por lead específico'
          },
          status: {
            type: 'string',
            enum: ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'],
            description: 'OPCIONAL - Filtrar por status: draft (rascunho), sent (enviada), viewed (visualizada), accepted (aceita), rejected (rejeitada), expired (expirada)'
          },
          limite: {
            type: 'number',
            description: 'OPCIONAL - Máximo de resultados. Padrão: 20'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'atualizar_status_proposta',
      description: 'Atualiza o status de uma proposta (enviar, marcar como aceita/rejeitada). Use após criar ou quando o cliente responder.',
      parameters: {
        type: 'object',
        properties: {
          proposal_id: {
            type: 'string',
            description: 'UUID da proposta'
          },
          status: {
            type: 'string',
            enum: ['sent', 'accepted', 'rejected'],
            description: 'Novo status: sent (enviar), accepted (cliente aceitou), rejected (cliente recusou)'
          },
          sent_via: {
            type: 'string',
            description: 'Canal de envio (whatsapp, email) - usar quando status=sent'
          },
          rejection_reason: {
            type: 'string',
            description: 'Motivo da rejeição - usar quando status=rejected'
          }
        },
        required: ['proposal_id', 'status']
      }
    }
  },
  // ==========================================================================
  // TOOL ESPECIAL: QUALIFICAÇÃO COMPLETA PARA PROPOSAL WRITER
  // ==========================================================================
  {
    type: 'function' as const,
    function: {
      name: 'obter_qualificacao_completa',
      description: `🎯 ESSENCIAL PARA PROPOSTAS: Obtém TODOS os dados de qualificação de um lead para criar propostas altamente personalizadas.
      
Retorna:
- BANT completo (Budget, Authority, Need, Timeline) com detalhes e notas
- Objeções registradas e como foram tratadas
- Mapa de decisão (stakeholders, decisores, influenciadores)
- Score de qualificação (0-4) e interpretação
- Histórico de propostas anteriores
- Recomendações para a proposta

Use OBRIGATORIAMENTE antes de criar propostas para leads qualificados!`,
      parameters: {
        type: 'object',
        properties: {
          lead_id: {
            type: 'string',
            description: 'UUID do lead'
          },
          incluir_historico_propostas: {
            type: 'boolean',
            description: 'Incluir propostas anteriores enviadas para este lead. Padrão: true'
          }
        },
        required: ['lead_id']
      }
    }
  }
]

// ============================================================================
// Tool Implementation - Direct queries to Client Supabase
// ============================================================================

interface ToolContext {
  clientSupabase: any // eslint-disable-line @typescript-eslint/no-explicit-any
  clientOrgId: string
}

async function getToolContext(authToken: string): Promise<ToolContext> {
  const adminSupabase = createAdminClient()
  const userSupabase = createUserClient(authToken)
  
  // Get user info
  const { data: { user }, error: authError } = await userSupabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Não foi possível autenticar o usuário')
  }
  
  // Get user's organization
  const { data: saasUser } = await adminSupabase
    .from('saas_users')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  
  // Get client credentials
  const result = await getClientCredentials(adminSupabase, user.id, saasUser?.organization_id)
  
  if (!result) {
    throw new Error('Não foi possível obter credenciais do Supabase do cliente')
  }
  
  const clientSupabase = createClient(result.credentials.url, result.credentials.serviceKey, {
    auth: { persistSession: false }
  })
  
  return {
    clientSupabase,
    clientOrgId: result.credentials.clientOrgId
  }
}

// ============================================================================
// Tool Implementations
// ============================================================================

async function analisarPipeline(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 30
  const estagioEspecifico = args.estagio_especifico as string | undefined
  
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)
  
  // Get all leads
  let query = ctx.clientSupabase
    .from('crm_leads')
    .select('id, stage, value, priority, sla_status, created_at, stage_entered_at, bant_score')
    .eq('organization_id', ctx.clientOrgId)
    .gte('created_at', dataInicio.toISOString())
  
  if (estagioEspecifico) {
    query = query.eq('stage', estagioEspecifico)
  }
  
  const { data: leads, error } = await query
  
  if (error) {
    return { error: `Erro ao buscar leads: ${error.message}` }
  }
  
  // Calculate metrics by stage
  const stageMetrics: Record<string, { count: number; value: number; slaBreached: number; avgBant: number; bantSum: number }> = {}
  
  for (const lead of leads || []) {
    const stage = lead.stage || 'Sem estágio'
    if (!stageMetrics[stage]) {
      stageMetrics[stage] = { count: 0, value: 0, slaBreached: 0, avgBant: 0, bantSum: 0 }
    }
    stageMetrics[stage].count++
    stageMetrics[stage].value += lead.value || 0
    if (lead.sla_status === 'breached') stageMetrics[stage].slaBreached++
    stageMetrics[stage].bantSum += lead.bant_score || 0
  }
  
  // Calculate averages
  for (const stage of Object.keys(stageMetrics)) {
    const m = stageMetrics[stage]
    m.avgBant = m.count > 0 ? Math.round((m.bantSum / m.count) * 10) / 10 : 0
  }
  
  const totalLeads = leads?.length || 0
  const valorTotal = leads?.reduce((sum: number, l: any) => sum + (l.value || 0), 0) || 0
  const slaAtrasados = leads?.filter((l: any) => l.sla_status === 'breached').length || 0
  
  return {
    periodo_dias: periodoDias,
    total_leads: totalLeads,
    valor_total_pipeline: valorTotal,
    leads_sla_atrasado: slaAtrasados,
    metricas_por_estagio: stageMetrics,
    analise: `Pipeline com ${totalLeads} leads e valor total de R$ ${valorTotal.toLocaleString('pt-BR')}. ${slaAtrasados} leads com SLA atrasado.`
  }
}

async function sugerirAcao(ctx: ToolContext, args: Record<string, unknown>) {
  const leadId = args.lead_id as string
  
  if (!leadId) {
    return { error: 'lead_id é obrigatório' }
  }
  
  const { data: lead, error } = await ctx.clientSupabase
    .from('crm_leads')
    .select('*')
    .eq('id', leadId)
    .eq('organization_id', ctx.clientOrgId)
    .single()
  
  if (error || !lead) {
    return { error: 'Lead não encontrado' }
  }
  
  // Get activities
  const { data: activities } = await ctx.clientSupabase
    .from('crm_activities')
    .select('type, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(5)
  
  // Calculate days in current stage
  const diasNoEstagio = lead.stage_entered_at 
    ? Math.floor((Date.now() - new Date(lead.stage_entered_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0
  
  // Suggest action based on context
  let sugestao = ''
  let prioridade = 'medium'
  
  if (lead.sla_status === 'breached') {
    sugestao = `🚨 URGENTE: Lead está com SLA estourado há ${diasNoEstagio} dias. Faça contato imediato para evitar perda.`
    prioridade = 'high'
  } else if (lead.sla_status === 'warning') {
    sugestao = `⚠️ Lead próximo do limite de SLA. Priorize o contato hoje.`
    prioridade = 'high'
  } else if (!activities || activities.length === 0) {
    sugestao = `📞 Lead sem atividades registradas. Faça o primeiro contato e registre uma nota.`
    prioridade = 'medium'
  } else if ((lead.bant_score || 0) < 2) {
    sugestao = `📋 Lead com BANT incompleto (${lead.bant_score || 0}/4). Complete a qualificação para entender o potencial.`
    prioridade = 'medium'
  } else if (lead.stage === 'Qualificação' && (lead.bant_score || 0) >= 3) {
    sugestao = `🎯 Lead bem qualificado! Mova para Proposta e envie uma oferta personalizada.`
    prioridade = 'high'
  } else {
    sugestao = `✅ Lead em andamento normal. Continue o follow-up conforme o processo.`
    prioridade = 'low'
  }
  
  return {
    lead_id: leadId,
    lead_nome: lead.name,
    estagio_atual: lead.stage,
    dias_no_estagio: diasNoEstagio,
    sla_status: lead.sla_status,
    bant_score: lead.bant_score || 0,
    valor: lead.value,
    ultima_atividade: activities?.[0]?.created_at || 'Nenhuma',
    sugestao,
    prioridade
  }
}

async function listarLeadsRisco(ctx: ToolContext, args: Record<string, unknown>) {
  const tipoRisco = (args.tipo_risco as string) || 'todos'
  const limite = (args.limite as number) || 10
  
  let query = ctx.clientSupabase
    .from('crm_leads')
    .select('id, name, stage, value, sla_status, stage_entered_at, updated_at')
    .eq('organization_id', ctx.clientOrgId)
  
  if (tipoRisco === 'sla_atrasado') {
    query = query.eq('sla_status', 'breached')
  } else if (tipoRisco === 'sem_atividade' || tipoRisco === 'estagnado') {
    const seteDiasAtras = new Date()
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)
    query = query.lt('updated_at', seteDiasAtras.toISOString())
  } else {
    // todos - SLA breached or warning
    query = query.in('sla_status', ['breached', 'warning'])
  }
  
  const { data: leads, error } = await query.limit(limite)
  
  if (error) {
    return { error: `Erro ao buscar leads: ${error.message}` }
  }
  
  const leadsFormatados = (leads || []).map((lead: any) => {
    const diasNoEstagio = lead.stage_entered_at 
      ? Math.floor((Date.now() - new Date(lead.stage_entered_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0
    
    return {
      id: lead.id,
      nome: lead.name,
      estagio: lead.stage,
      valor: lead.value,
      status_sla: lead.sla_status,
      dias_no_estagio: diasNoEstagio
    }
  })
  
  return {
    tipo_filtro: tipoRisco,
    total_encontrados: leadsFormatados.length,
    leads: leadsFormatados
  }
}

async function buscarLead(ctx: ToolContext, args: Record<string, unknown>) {
  const leadId = args.lead_id as string | undefined
  const nome = args.nome as string | undefined
  
  let query = ctx.clientSupabase
    .from('crm_leads')
    .select('*')
    .eq('organization_id', ctx.clientOrgId)
  
  if (leadId) {
    query = query.eq('id', leadId)
  } else if (nome) {
    query = query.ilike('name', `%${nome}%`)
  } else {
    return { error: 'Informe lead_id ou nome para buscar' }
  }
  
  const { data: leads, error } = await query.limit(5)
  
  if (error) {
    return { error: `Erro na busca: ${error.message}` }
  }
  
  if (!leads || leads.length === 0) {
    return { error: 'Nenhum lead encontrado' }
  }
  
  // Get activities for first lead
  const lead = leads[0]
  const { data: activities } = await ctx.clientSupabase
    .from('crm_activities')
    .select('type, content, created_at')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: false })
    .limit(10)
  
  return {
    lead: {
      id: lead.id,
      nome: lead.name,
      email: lead.email,
      telefone: lead.phone,
      estagio: lead.stage,
      valor: lead.value,
      prioridade: lead.priority,
      descricao: lead.description,
      bant_budget: lead.bant_budget,
      bant_authority: lead.bant_authority,
      bant_need: lead.bant_need,
      bant_timeline: lead.bant_timeline,
      bant_score: lead.bant_score,
      sla_status: lead.sla_status,
      objecao: lead.objection_reason,
      decision_map: lead.decision_map,
      criado_em: lead.created_at,
      atualizado_em: lead.updated_at
    },
    total_resultados: leads.length,
    atividades_recentes: activities || []
  }
}

async function listarLeads(ctx: ToolContext, args: Record<string, unknown>) {
  const estagio = args.estagio as string | undefined
  const prioridade = args.prioridade as string | undefined
  const bantScoreMin = args.bant_score_min as number | undefined
  const limite = (args.limite as number) || 20
  
  let query = ctx.clientSupabase
    .from('crm_leads')
    .select('id, name, email, stage, value, priority, bant_score, sla_status, objection_reason, created_at')
    .eq('organization_id', ctx.clientOrgId)
    .order('created_at', { ascending: false })
  
  if (estagio) query = query.eq('stage', estagio)
  if (prioridade) query = query.eq('priority', prioridade)
  if (bantScoreMin !== undefined) query = query.gte('bant_score', bantScoreMin)
  
  const { data: leads, error } = await query.limit(limite)
  
  if (error) {
    return { error: `Erro ao listar leads: ${error.message}` }
  }
  
  return {
    total: leads?.length || 0,
    filtros: { estagio, prioridade, bant_score_min: bantScoreMin },
    leads: (leads || []).map((l: any) => ({
      id: l.id,
      nome: l.name,
      email: l.email,
      estagio: l.stage,
      valor: l.value,
      prioridade: l.priority,
      bant_score: l.bant_score,
      sla_status: l.sla_status,
      objecao: l.objection_reason
    }))
  }
}

async function atualizarLead(ctx: ToolContext, args: Record<string, unknown>) {
  const leadId = args.lead_id as string
  const campo = args.campo as string
  const valor = args.valor as string
  
  if (!leadId || !campo || !valor) {
    return { error: 'lead_id, campo e valor são obrigatórios' }
  }
  
  const updateData: Record<string, unknown> = {}
  updateData[campo] = campo === 'value' ? parseFloat(valor) : valor
  
  if (campo === 'stage') {
    updateData.stage_entered_at = new Date().toISOString()
  }
  
  const { error } = await ctx.clientSupabase
    .from('crm_leads')
    .update(updateData)
    .eq('id', leadId)
    .eq('organization_id', ctx.clientOrgId)
  
  if (error) {
    return { error: `Erro ao atualizar: ${error.message}` }
  }
  
  return {
    sucesso: true,
    lead_id: leadId,
    campo_atualizado: campo,
    novo_valor: valor
  }
}

async function adicionarNota(ctx: ToolContext, args: Record<string, unknown>) {
  const leadId = args.lead_id as string
  const nota = args.nota as string
  
  if (!leadId || !nota) {
    return { error: 'lead_id e nota são obrigatórios' }
  }
  
  const { error } = await ctx.clientSupabase
    .from('crm_activities')
    .insert({
      lead_id: leadId,
      organization_id: ctx.clientOrgId,
      type: 'note',
      content: nota,
      created_by: 'ai_assistant'
    })
  
  if (error) {
    return { error: `Erro ao adicionar nota: ${error.message}` }
  }
  
  return {
    sucesso: true,
    lead_id: leadId,
    nota_adicionada: nota
  }
}

async function obterMetas(ctx: ToolContext) {
  const { data: goals, error } = await ctx.clientSupabase
    .from('crm_goals')
    .select('*')
    .eq('organization_id', ctx.clientOrgId)
    .eq('status', 'active')
  
  if (error) {
    return { error: `Erro ao buscar metas: ${error.message}` }
  }
  
  const metasFormatadas = (goals || []).map((g: any) => ({
    id: g.id,
    tipo: g.type,
    titulo: g.title,
    meta: g.target,
    atual: g.current,
    progresso_pct: g.target > 0 ? Math.round((g.current / g.target) * 100) : 0,
    periodo: `${g.period_start} até ${g.period_end}`
  }))
  
  return {
    total_metas_ativas: metasFormatadas.length,
    metas: metasFormatadas
  }
}

async function gerarResumoDiario(ctx: ToolContext) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  
  // Leads created today
  const { data: leadsHoje } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, name, value')
    .eq('organization_id', ctx.clientOrgId)
    .gte('created_at', hoje.toISOString())
  
  // Leads with SLA issues
  const { data: leadsSlaProblema } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, name, stage, sla_status')
    .eq('organization_id', ctx.clientOrgId)
    .in('sla_status', ['breached', 'warning'])
  
  // Goals progress
  const { data: goals } = await ctx.clientSupabase
    .from('crm_goals')
    .select('type, target, current')
    .eq('organization_id', ctx.clientOrgId)
    .eq('status', 'active')
  
  // Pipeline value
  const { data: pipeline } = await ctx.clientSupabase
    .from('crm_leads')
    .select('value')
    .eq('organization_id', ctx.clientOrgId)
    .not('stage', 'eq', 'Fechado Perdido')
  
  const valorPipeline = (pipeline || []).reduce((sum: number, l: any) => sum + (l.value || 0), 0)
  const leadsNovos = leadsHoje?.length || 0
  const leadsRisco = leadsSlaProblema?.length || 0
  
  return {
    data: hoje.toISOString().split('T')[0],
    resumo: {
      leads_novos_hoje: leadsNovos,
      leads_em_risco: leadsRisco,
      valor_pipeline: valorPipeline
    },
    alertas: leadsRisco > 0 
      ? [`⚠️ ${leadsRisco} leads precisam de atenção urgente (SLA)`]
      : ['✅ Nenhum alerta crítico'],
    metas: (goals || []).map((g: any) => ({
      tipo: g.type,
      progresso: g.target > 0 ? `${Math.round((g.current / g.target) * 100)}%` : '0%'
    }))
  }
}

async function listarTemplates(ctx: ToolContext, args: Record<string, unknown>) {
  const tipo = args.tipo as string | undefined
  const estagioSugerido = args.estagio_sugerido as string | undefined
  
  let query = ctx.clientSupabase
    .from('crm_templates')
    .select('id, name, content, type, stage_name, variables, usage_count')
    .eq('organization_id', ctx.clientOrgId)
  
  if (tipo) query = query.eq('type', tipo)
  if (estagioSugerido) query = query.eq('stage_name', estagioSugerido)
  
  const { data: templates, error } = await query
  
  if (error) {
    // Table might not exist yet
    return { 
      total: 0, 
      templates: [],
      mensagem: 'Nenhum template encontrado. Você pode criar templates em Configurações > Templates.'
    }
  }
  
  return {
    total: templates?.length || 0,
    templates: (templates || []).map((t: any) => ({
      id: t.id,
      nome: t.name,
      tipo: t.type,
      conteudo: t.content,
      estagio_sugerido: t.stage_name,
      variaveis: t.variables,
      uso: t.usage_count
    }))
  }
}

async function sugerirTemplate(ctx: ToolContext, args: Record<string, unknown>) {
  const leadId = args.lead_id as string
  const canal = args.canal as string
  
  if (!leadId || !canal) {
    return { error: 'lead_id e canal são obrigatórios' }
  }
  
  // Get lead info
  const { data: lead } = await ctx.clientSupabase
    .from('crm_leads')
    .select('name, stage')
    .eq('id', leadId)
    .eq('organization_id', ctx.clientOrgId)
    .single()
  
  if (!lead) {
    return { error: 'Lead não encontrado' }
  }
  
  // Find best template
  const { data: templates } = await ctx.clientSupabase
    .from('crm_templates')
    .select('*')
    .eq('organization_id', ctx.clientOrgId)
    .eq('type', canal)
    .or(`stage_name.eq.${lead.stage},stage_name.is.null`)
    .order('usage_count', { ascending: false })
    .limit(3)
  
  if (!templates || templates.length === 0) {
    return {
      lead_nome: lead.name,
      canal,
      mensagem: 'Nenhum template encontrado para este canal/estágio.',
      sugestao_generica: canal === 'whatsapp' 
        ? `Olá ${lead.name}! Tudo bem? Gostaria de dar continuidade ao nosso assunto...`
        : `Assunto: Acompanhamento - ${lead.name}\n\nOlá,\n\nGostaria de dar continuidade ao nosso contato...`
    }
  }
  
  const template = templates[0]
  const conteudoPersonalizado = template.content.replace(/\{lead_name\}/g, lead.name)
  
  return {
    lead_nome: lead.name,
    estagio: lead.stage,
    canal,
    template_sugerido: {
      id: template.id,
      nome: template.name,
      conteudo_original: template.content,
      conteudo_personalizado: conteudoPersonalizado,
      variaveis: template.variables
    },
    outros_templates: templates.slice(1).map((t: any) => ({ id: t.id, nome: t.name }))
  }
}

async function calcularForecast(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 30
  
  // Get current pipeline
  const { data: leads } = await ctx.clientSupabase
    .from('crm_leads')
    .select('stage, value')
    .eq('organization_id', ctx.clientOrgId)
    .not('stage', 'in', '(Fechado Ganho,Fechado Perdido)')
  
  // Define conversion rates by stage (simplified)
  const taxasConversao: Record<string, number> = {
    'Novo Lead': 0.15,
    'Qualificação': 0.25,
    'Proposta': 0.40,
    'Negociação': 0.65,
    'Fechamento': 0.85
  }
  
  let previsaoTotal = 0
  const previsaoPorEstagio: Record<string, { valor: number; previsao: number; taxa: number }> = {}
  
  for (const lead of leads || []) {
    const taxa = taxasConversao[lead.stage] || 0.20
    const previsaoLead = (lead.value || 0) * taxa
    previsaoTotal += previsaoLead
    
    if (!previsaoPorEstagio[lead.stage]) {
      previsaoPorEstagio[lead.stage] = { valor: 0, previsao: 0, taxa }
    }
    previsaoPorEstagio[lead.stage].valor += lead.value || 0
    previsaoPorEstagio[lead.stage].previsao += previsaoLead
  }
  
  return {
    horizonte_dias: periodoDias,
    valor_pipeline_total: (leads || []).reduce((s: number, l: any) => s + (l.value || 0), 0),
    previsao_receita: Math.round(previsaoTotal),
    previsao_por_estagio: previsaoPorEstagio,
    metodologia: 'Previsão baseada em taxas históricas de conversão por estágio'
  }
}

async function analisarObjecoes(ctx: ToolContext, args: Record<string, unknown>) {
  const estagio = args.estagio as string | undefined
  const limite = (args.limite as number) || 50
  
  // Buscar leads com objeções preenchidas
  let query = ctx.clientSupabase
    .from('crm_leads')
    .select('id, name, stage, value, objection_reason, bant_score')
    .eq('organization_id', ctx.clientOrgId)
    .not('objection_reason', 'is', null)
  
  if (estagio) {
    query = query.eq('stage', estagio)
  }
  
  const { data: leadsComObjecao, error } = await query.limit(limite)
  
  if (error) {
    return { error: `Erro ao buscar objeções: ${error.message}` }
  }
  
  // Também buscar notas que mencionam objeções comuns
  const { data: notasObjecao } = await ctx.clientSupabase
    .from('crm_activities')
    .select('lead_id, content, created_at')
    .eq('organization_id', ctx.clientOrgId)
    .eq('type', 'note')
    .or('content.ilike.%preço%,content.ilike.%orçamento%,content.ilike.%concorrente%,content.ilike.%tempo%,content.ilike.%decidir%,content.ilike.%pensar%,content.ilike.%caro%,content.ilike.%barato%')
    .order('created_at', { ascending: false })
    .limit(30)
  
  // Agrupar objeções por tipo
  const objecoesPorTipo: Record<string, { count: number; leads: string[]; valorTotal: number }> = {}
  
  for (const lead of leadsComObjecao || []) {
    const objecao = lead.objection_reason || 'Não especificada'
    if (!objecoesPorTipo[objecao]) {
      objecoesPorTipo[objecao] = { count: 0, leads: [], valorTotal: 0 }
    }
    objecoesPorTipo[objecao].count++
    objecoesPorTipo[objecao].leads.push(lead.name)
    objecoesPorTipo[objecao].valorTotal += lead.value || 0
  }
  
  // Análise de padrões nas notas
  const padroesNotas: Record<string, number> = {}
  const palavrasChave = ['preço', 'orçamento', 'concorrente', 'tempo', 'decidir', 'pensar', 'caro']
  
  for (const nota of notasObjecao || []) {
    const conteudoLower = (nota.content || '').toLowerCase()
    for (const palavra of palavrasChave) {
      if (conteudoLower.includes(palavra)) {
        padroesNotas[palavra] = (padroesNotas[palavra] || 0) + 1
      }
    }
  }
  
  // Ordenar objeções por frequência
  const objecoesOrdenadas = Object.entries(objecoesPorTipo)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([objecao, dados]) => ({
      objecao,
      frequencia: dados.count,
      valor_em_risco: dados.valorTotal,
      exemplos_leads: dados.leads.slice(0, 3)
    }))
  
  const totalLeadsComObjecao = leadsComObjecao?.length || 0
  const valorTotalEmRisco = (leadsComObjecao || []).reduce((s: number, l: any) => s + (l.value || 0), 0)
  
  return {
    resumo: {
      total_leads_com_objecao: totalLeadsComObjecao,
      valor_total_em_risco: valorTotalEmRisco,
      principal_objecao: objecoesOrdenadas[0]?.objecao || 'Nenhuma objeção registrada'
    },
    objecoes_por_frequencia: objecoesOrdenadas,
    padroes_nas_notas: padroesNotas,
    insight: totalLeadsComObjecao > 0 
      ? `A principal objeção é "${objecoesOrdenadas[0]?.objecao}" com ${objecoesOrdenadas[0]?.frequencia} ocorrências, representando R$ ${objecoesOrdenadas[0]?.valor_em_risco?.toLocaleString('pt-BR')} em risco.`
      : 'Nenhuma objeção registrada nos leads. Considere preencher o campo "Objeção" ao qualificar leads.'
  }
}

async function buscarNotasPadrao(ctx: ToolContext, args: Record<string, unknown>) {
  const palavraChave = args.palavra_chave as string
  const limite = (args.limite as number) || 20
  
  if (!palavraChave) {
    return { error: 'palavra_chave é obrigatória' }
  }
  
  // Buscar notas que contenham a palavra-chave
  const { data: notas, error } = await ctx.clientSupabase
    .from('crm_activities')
    .select(`
      id,
      lead_id,
      content,
      created_at,
      crm_leads!inner (
        id,
        name,
        stage,
        value
      )
    `)
    .eq('organization_id', ctx.clientOrgId)
    .eq('type', 'note')
    .ilike('content', `%${palavraChave}%`)
    .order('created_at', { ascending: false })
    .limit(limite)
  
  if (error) {
    return { error: `Erro ao buscar notas: ${error.message}` }
  }
  
  const resultados = (notas || []).map((nota: any) => ({
    lead_nome: nota.crm_leads?.name,
    lead_estagio: nota.crm_leads?.stage,
    lead_valor: nota.crm_leads?.value,
    nota_conteudo: nota.content,
    data: nota.created_at
  }))
  
  return {
    palavra_buscada: palavraChave,
    total_encontrado: resultados.length,
    resultados,
    analise: resultados.length > 0
      ? `Encontrei ${resultados.length} notas mencionando "${palavraChave}". Isso pode indicar um padrão importante nas objeções ou feedbacks dos leads.`
      : `Nenhuma nota encontrada com "${palavraChave}".`
  }
}

// ============================================================================
// TOOLS ESTRATÉGICAS PARA CRO/CEO
// ============================================================================

async function analisarReceita(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 30
  const agruparPor = (args.agrupar_por as string) || 'mes'
  
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)
  
  // Buscar receita de leads com pagamento
  const { data: leadsComPagamento } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, name, payment_value, stage, canal, created_at, updated_at')
    .eq('organization_id', ctx.clientOrgId)
    .eq('has_payment', true)
    .gte('updated_at', dataInicio.toISOString())
  
  // Buscar entradas (receita direta)
  const { data: entradas } = await ctx.clientSupabase
    .from('entradas')
    .select('id, descricao, valor, categoria, metodo_pagamento, data_entrada')
    .eq('organization_id', ctx.clientOrgId)
    .gte('data_entrada', dataInicio.toISOString())
  
  const receitaLeads = (leadsComPagamento || []).reduce((s: number, l: any) => s + (l.payment_value || 0), 0)
  const receitaEntradas = (entradas || []).reduce((s: number, e: any) => s + (e.valor || 0), 0)
  const receitaTotal = receitaLeads + receitaEntradas
  
  // Agrupar por categoria (entradas)
  const porCategoria: Record<string, number> = {}
  for (const e of entradas || []) {
    porCategoria[e.categoria] = (porCategoria[e.categoria] || 0) + (e.valor || 0)
  }
  
  // Agrupar por método de pagamento
  const porMetodo: Record<string, number> = {}
  for (const e of entradas || []) {
    porMetodo[e.metodo_pagamento] = (porMetodo[e.metodo_pagamento] || 0) + (e.valor || 0)
  }
  
  // Agrupar por canal (leads)
  const porCanal: Record<string, number> = {}
  for (const l of leadsComPagamento || []) {
    const canal = l.canal || 'Não informado'
    porCanal[canal] = (porCanal[canal] || 0) + (l.payment_value || 0)
  }
  
  return {
    periodo: `Últimos ${periodoDias} dias`,
    resumo: {
      receita_total: receitaTotal,
      receita_leads_crm: receitaLeads,
      receita_entradas: receitaEntradas,
      quantidade_leads_pagantes: leadsComPagamento?.length || 0,
      quantidade_entradas: entradas?.length || 0,
      ticket_medio: (leadsComPagamento?.length || 0) > 0 
        ? Math.round(receitaLeads / leadsComPagamento!.length) 
        : 0
    },
    por_categoria: porCategoria,
    por_metodo_pagamento: porMetodo,
    por_canal: porCanal
  }
}

async function compararPeriodos(ctx: ToolContext, args: Record<string, unknown>) {
  const metrica = args.metrica as string
  const periodoAtualDias = (args.periodo_atual_dias as number) || 30
  const periodoAnteriorDias = (args.periodo_anterior_dias as number) || 30
  
  const agora = new Date()
  const inicioAtual = new Date(agora)
  inicioAtual.setDate(inicioAtual.getDate() - periodoAtualDias)
  
  const inicioAnterior = new Date(inicioAtual)
  inicioAnterior.setDate(inicioAnterior.getDate() - periodoAnteriorDias)
  
  let valorAtual = 0
  let valorAnterior = 0
  let detalhes: any = {}
  
  if (metrica === 'receita') {
    // Período atual
    const { data: leadsAtual } = await ctx.clientSupabase
      .from('crm_leads')
      .select('payment_value')
      .eq('organization_id', ctx.clientOrgId)
      .eq('has_payment', true)
      .gte('updated_at', inicioAtual.toISOString())
    
    // Período anterior
    const { data: leadsAnterior } = await ctx.clientSupabase
      .from('crm_leads')
      .select('payment_value')
      .eq('organization_id', ctx.clientOrgId)
      .eq('has_payment', true)
      .gte('updated_at', inicioAnterior.toISOString())
      .lt('updated_at', inicioAtual.toISOString())
    
    valorAtual = (leadsAtual || []).reduce((s: number, l: any) => s + (l.payment_value || 0), 0)
    valorAnterior = (leadsAnterior || []).reduce((s: number, l: any) => s + (l.payment_value || 0), 0)
    detalhes = { vendas_atual: leadsAtual?.length || 0, vendas_anterior: leadsAnterior?.length || 0 }
    
  } else if (metrica === 'leads') {
    const { data: leadsAtual } = await ctx.clientSupabase
      .from('crm_leads')
      .select('id')
      .eq('organization_id', ctx.clientOrgId)
      .gte('created_at', inicioAtual.toISOString())
    
    const { data: leadsAnterior } = await ctx.clientSupabase
      .from('crm_leads')
      .select('id')
      .eq('organization_id', ctx.clientOrgId)
      .gte('created_at', inicioAnterior.toISOString())
      .lt('created_at', inicioAtual.toISOString())
    
    valorAtual = leadsAtual?.length || 0
    valorAnterior = leadsAnterior?.length || 0
    
  } else if (metrica === 'conversoes') {
    const { data: convAtual } = await ctx.clientSupabase
      .from('crm_leads')
      .select('id')
      .eq('organization_id', ctx.clientOrgId)
      .in('stage', ['Fechado Ganho', 'fechado', 'ganho', 'convertido'])
      .gte('updated_at', inicioAtual.toISOString())
    
    const { data: convAnterior } = await ctx.clientSupabase
      .from('crm_leads')
      .select('id')
      .eq('organization_id', ctx.clientOrgId)
      .in('stage', ['Fechado Ganho', 'fechado', 'ganho', 'convertido'])
      .gte('updated_at', inicioAnterior.toISOString())
      .lt('updated_at', inicioAtual.toISOString())
    
    valorAtual = convAtual?.length || 0
    valorAnterior = convAnterior?.length || 0
    
  } else if (metrica === 'pipeline') {
    const { data: pipeAtual } = await ctx.clientSupabase
      .from('crm_leads')
      .select('value')
      .eq('organization_id', ctx.clientOrgId)
      .not('stage', 'in', '(Fechado Ganho,Fechado Perdido,fechado,perdido)')
    
    valorAtual = (pipeAtual || []).reduce((s: number, l: any) => s + (l.value || 0), 0)
    valorAnterior = 0 // Pipeline é snapshot, não tem período anterior
    detalhes = { leads_em_pipeline: pipeAtual?.length || 0 }
  }
  
  const variacao = valorAnterior > 0 
    ? Math.round(((valorAtual - valorAnterior) / valorAnterior) * 100) 
    : valorAtual > 0 ? 100 : 0
  
  return {
    metrica,
    periodo_atual: `Últimos ${periodoAtualDias} dias`,
    periodo_anterior: `${periodoAtualDias + periodoAnteriorDias} a ${periodoAtualDias} dias atrás`,
    valor_atual: valorAtual,
    valor_anterior: valorAnterior,
    variacao_percentual: variacao,
    tendencia: variacao > 0 ? '📈 Crescimento' : variacao < 0 ? '📉 Queda' : '➡️ Estável',
    detalhes
  }
}

async function analisarConversaoFunil(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 30
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)
  
  const { data: leads } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, stage, created_at, updated_at, value')
    .eq('organization_id', ctx.clientOrgId)
    .gte('created_at', dataInicio.toISOString())
  
  // Contar por estágio
  const porEstagio: Record<string, { quantidade: number; valor: number }> = {}
  for (const lead of leads || []) {
    const stage = lead.stage || 'Sem estágio'
    if (!porEstagio[stage]) {
      porEstagio[stage] = { quantidade: 0, valor: 0 }
    }
    porEstagio[stage].quantidade++
    porEstagio[stage].valor += lead.value || 0
  }
  
  const totalLeads = leads?.length || 0
  const ganhos = (leads || []).filter((l: any) => 
    ['Fechado Ganho', 'fechado', 'ganho', 'convertido'].includes(l.stage?.toLowerCase() || '')
  ).length
  const perdidos = (leads || []).filter((l: any) => 
    ['Fechado Perdido', 'perdido', 'desqualificado'].includes(l.stage?.toLowerCase() || '')
  ).length
  
  const taxaConversaoGeral = totalLeads > 0 ? Math.round((ganhos / totalLeads) * 100) : 0
  const taxaPerdaGeral = totalLeads > 0 ? Math.round((perdidos / totalLeads) * 100) : 0
  
  // Identificar gargalos (estágios com mais leads parados)
  const estagiosOrdenados = Object.entries(porEstagio)
    .filter(([stage]) => !['Fechado Ganho', 'Fechado Perdido', 'fechado', 'perdido', 'ganho'].includes(stage))
    .sort((a, b) => b[1].quantidade - a[1].quantidade)
  
  const gargalo = estagiosOrdenados[0]
  
  return {
    periodo: `Últimos ${periodoDias} dias`,
    resumo: {
      total_leads_no_periodo: totalLeads,
      leads_ganhos: ganhos,
      leads_perdidos: perdidos,
      em_andamento: totalLeads - ganhos - perdidos,
      taxa_conversao_geral: `${taxaConversaoGeral}%`,
      taxa_perda_geral: `${taxaPerdaGeral}%`
    },
    por_estagio: porEstagio,
    gargalo_identificado: gargalo ? {
      estagio: gargalo[0],
      quantidade_parada: gargalo[1].quantidade,
      valor_parado: gargalo[1].valor,
      recomendacao: `O estágio "${gargalo[0]}" tem ${gargalo[1].quantidade} leads parados. Revise as ações para acelerar a passagem.`
    } : null
  }
}

async function analisarCanais(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 30
  const ordenarPor = (args.ordenar_por as string) || 'quantidade'
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)
  
  const { data: leads } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, canal, source, stage, value, has_payment, payment_value')
    .eq('organization_id', ctx.clientOrgId)
    .gte('created_at', dataInicio.toISOString())
  
  const porCanal: Record<string, { 
    quantidade: number; 
    valor_pipeline: number; 
    conversoes: number;
    receita: number;
    taxa_conversao: number;
  }> = {}
  
  for (const lead of leads || []) {
    const canal = lead.canal || lead.source || 'Não informado'
    if (!porCanal[canal]) {
      porCanal[canal] = { quantidade: 0, valor_pipeline: 0, conversoes: 0, receita: 0, taxa_conversao: 0 }
    }
    porCanal[canal].quantidade++
    porCanal[canal].valor_pipeline += lead.value || 0
    
    if (['Fechado Ganho', 'fechado', 'ganho', 'convertido'].includes((lead.stage || '').toLowerCase())) {
      porCanal[canal].conversoes++
    }
    if (lead.has_payment) {
      porCanal[canal].receita += lead.payment_value || 0
    }
  }
  
  // Calcular taxa de conversão
  for (const canal of Object.keys(porCanal)) {
    porCanal[canal].taxa_conversao = porCanal[canal].quantidade > 0
      ? Math.round((porCanal[canal].conversoes / porCanal[canal].quantidade) * 100)
      : 0
  }
  
  // Ordenar
  const canaisOrdenados = Object.entries(porCanal).sort((a, b) => {
    if (ordenarPor === 'valor') return b[1].valor_pipeline - a[1].valor_pipeline
    if (ordenarPor === 'conversao') return b[1].taxa_conversao - a[1].taxa_conversao
    return b[1].quantidade - a[1].quantidade
  })
  
  const melhorCanal = canaisOrdenados[0]
  
  return {
    periodo: `Últimos ${periodoDias} dias`,
    ordenado_por: ordenarPor,
    canais: Object.fromEntries(canaisOrdenados),
    insight: melhorCanal ? {
      melhor_canal: melhorCanal[0],
      leads: melhorCanal[1].quantidade,
      conversao: `${melhorCanal[1].taxa_conversao}%`,
      receita: melhorCanal[1].receita,
      recomendacao: `O canal "${melhorCanal[0]}" é o mais efetivo com ${melhorCanal[1].taxa_conversao}% de conversão. Considere aumentar investimento.`
    } : null
  }
}

async function calcularVelocidadeVendas(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 90
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)
  
  // Buscar leads fechados no período
  const { data: leadsFechados } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, created_at, updated_at, stage, value')
    .eq('organization_id', ctx.clientOrgId)
    .in('stage', ['Fechado Ganho', 'fechado', 'ganho', 'convertido'])
    .gte('updated_at', dataInicio.toISOString())
  
  if (!leadsFechados || leadsFechados.length === 0) {
    return {
      periodo: `Últimos ${periodoDias} dias`,
      erro: 'Nenhum lead fechado no período para calcular velocidade',
      sugestao: 'Amplie o período de análise ou verifique se há leads com estágio de fechamento.'
    }
  }
  
  // Calcular tempo médio de fechamento
  const temposEmDias = leadsFechados.map((l: any) => {
    const criado = new Date(l.created_at)
    const fechado = new Date(l.updated_at)
    return Math.round((fechado.getTime() - criado.getTime()) / (1000 * 60 * 60 * 24))
  })
  
  const tempoMedio = Math.round(temposEmDias.reduce((a: number, b: number) => a + b, 0) / temposEmDias.length)
  const tempoMinimo = Math.min(...temposEmDias)
  const tempoMaximo = Math.max(...temposEmDias)
  
  // Valor médio dos fechados
  const valorTotal = leadsFechados.reduce((s: number, l: any) => s + (l.value || 0), 0)
  const ticketMedio = Math.round(valorTotal / leadsFechados.length)
  
  // Velocidade de vendas = (Leads × Ticket Médio × Taxa de Conversão) / Ciclo de Venda
  const velocidadeDiaria = ticketMedio / tempoMedio
  
  return {
    periodo: `Últimos ${periodoDias} dias`,
    ciclo_vendas: {
      tempo_medio_dias: tempoMedio,
      tempo_minimo_dias: tempoMinimo,
      tempo_maximo_dias: tempoMaximo,
      descricao: tempoMedio <= 7 ? '🚀 Ciclo muito rápido' 
        : tempoMedio <= 30 ? '✅ Ciclo saudável'
        : tempoMedio <= 60 ? '⚠️ Ciclo longo' 
        : '🔴 Ciclo muito longo'
    },
    vendas: {
      quantidade_fechadas: leadsFechados.length,
      valor_total: valorTotal,
      ticket_medio: ticketMedio
    },
    velocidade: {
      receita_media_diaria: Math.round(velocidadeDiaria),
      receita_projetada_mes: Math.round(velocidadeDiaria * 30)
    }
  }
}

async function analisarPerdas(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 30
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)
  
  const { data: leadsPerdidos } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, name, stage, value, objection_type, objection_details, canal, source, updated_at')
    .eq('organization_id', ctx.clientOrgId)
    .in('stage', ['Fechado Perdido', 'perdido', 'desqualificado'])
    .gte('updated_at', dataInicio.toISOString())
  
  if (!leadsPerdidos || leadsPerdidos.length === 0) {
    return {
      periodo: `Últimos ${periodoDias} dias`,
      resultado: 'Nenhum lead perdido no período. Ótima notícia! 🎉'
    }
  }
  
  // Agrupar por motivo
  const porMotivo: Record<string, { quantidade: number; valor: number }> = {}
  for (const lead of leadsPerdidos) {
    const motivo = lead.objection_type || 'Não especificado'
    if (!porMotivo[motivo]) {
      porMotivo[motivo] = { quantidade: 0, valor: 0 }
    }
    porMotivo[motivo].quantidade++
    porMotivo[motivo].valor += lead.value || 0
  }
  
  // Agrupar por canal
  const porCanal: Record<string, number> = {}
  for (const lead of leadsPerdidos) {
    const canal = lead.canal || lead.source || 'Não informado'
    porCanal[canal] = (porCanal[canal] || 0) + 1
  }
  
  const valorTotalPerdido = leadsPerdidos.reduce((s: number, l: any) => s + (l.value || 0), 0)
  const motivosOrdenados = Object.entries(porMotivo).sort((a, b) => b[1].quantidade - a[1].quantidade)
  const principalMotivo = motivosOrdenados[0]
  
  return {
    periodo: `Últimos ${periodoDias} dias`,
    resumo: {
      total_perdidos: leadsPerdidos.length,
      valor_total_perdido: valorTotalPerdido,
      principal_motivo: principalMotivo?.[0] || 'Não especificado',
      frequencia_principal: principalMotivo?.[1].quantidade || 0
    },
    por_motivo: Object.fromEntries(motivosOrdenados),
    por_canal: porCanal,
    leads_recentes: leadsPerdidos.slice(0, 5).map((l: any) => ({
      nome: l.name,
      valor: l.value,
      motivo: l.objection_type || 'Não especificado',
      detalhes: l.objection_details
    })),
    recomendacao: principalMotivo 
      ? `O principal motivo de perda é "${principalMotivo[0]}" (${principalMotivo[1].quantidade} leads, R$ ${principalMotivo[1].valor.toLocaleString('pt-BR')} perdidos). Sugiro criar um playbook para contornar essa objeção.`
      : 'Preencha o campo "Motivo da Perda" ao fechar leads para obter insights melhores.'
  }
}

async function gerarRelatorioExecutivo(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 30
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)
  
  // Buscar todos os dados necessários em paralelo
  const [leadsResult, entradasResult, goalsResult] = await Promise.all([
    ctx.clientSupabase
      .from('crm_leads')
      .select('id, stage, value, has_payment, payment_value, canal, created_at, updated_at, bant_score, sla_status')
      .eq('organization_id', ctx.clientOrgId),
    ctx.clientSupabase
      .from('entradas')
      .select('valor, data_entrada')
      .eq('organization_id', ctx.clientOrgId)
      .gte('data_entrada', dataInicio.toISOString()),
    ctx.clientSupabase
      .from('crm_goals')
      .select('*')
      .eq('organization_id', ctx.clientOrgId)
      .eq('status', 'active')
  ])
  
  const leads = leadsResult.data || []
  const entradas = entradasResult.data || []
  const goals = goalsResult.data || []
  
  // Cálculos
  const leadsNoPeriodo = leads.filter((l: any) => new Date(l.created_at) >= dataInicio)
  const leadsGanhos = leads.filter((l: any) => 
    ['Fechado Ganho', 'fechado', 'ganho', 'convertido'].includes((l.stage || '').toLowerCase()) &&
    new Date(l.updated_at) >= dataInicio
  )
  const leadsPerdidos = leads.filter((l: any) => 
    ['Fechado Perdido', 'perdido'].includes((l.stage || '').toLowerCase()) &&
    new Date(l.updated_at) >= dataInicio
  )
  const leadsAtivos = leads.filter((l: any) => 
    !['Fechado Ganho', 'Fechado Perdido', 'fechado', 'perdido', 'ganho'].includes((l.stage || '').toLowerCase())
  )
  
  const receitaLeads = leadsGanhos.reduce((s: number, l: any) => s + (l.payment_value || 0), 0)
  const receitaEntradas = entradas.reduce((s: number, e: any) => s + (e.valor || 0), 0)
  const receitaTotal = receitaLeads + receitaEntradas
  
  const valorPipeline = leadsAtivos.reduce((s: number, l: any) => s + (l.value || 0), 0)
  const ticketMedio = leadsGanhos.length > 0 ? Math.round(receitaLeads / leadsGanhos.length) : 0
  
  const taxaConversao = leadsNoPeriodo.length > 0 
    ? Math.round((leadsGanhos.length / leadsNoPeriodo.length) * 100) 
    : 0
  
  const leadsEmRisco = leads.filter((l: any) => l.sla_status === 'breached' || l.sla_status === 'warning').length
  const leadsQuentes = leads.filter((l: any) => (l.bant_score || 0) >= 3).length
  
  // Metas
  const metaReceita = goals.find((g: any) => g.type === 'revenue')
  const metaConversao = goals.find((g: any) => g.type === 'conversions')
  const metaLeads = goals.find((g: any) => g.type === 'leads')
  
  // Forecast simplificado
  const taxasConversao: Record<string, number> = {
    'Novo Lead': 0.15, 'Qualificação': 0.25, 'Proposta': 0.40, 'Negociação': 0.65, 'Fechamento': 0.85
  }
  const forecastPipeline = leadsAtivos.reduce((s: number, l: any) => {
    const taxa = taxasConversao[l.stage] || 0.20
    return s + ((l.value || 0) * taxa)
  }, 0)
  
  return {
    titulo: '📊 RELATÓRIO EXECUTIVO CRM',
    periodo: `Últimos ${periodoDias} dias`,
    gerado_em: new Date().toLocaleString('pt-BR'),
    
    receita: {
      total_periodo: receitaTotal,
      de_leads_crm: receitaLeads,
      outras_entradas: receitaEntradas,
      ticket_medio: ticketMedio,
      meta: metaReceita ? {
        valor: metaReceita.target,
        atual: metaReceita.current,
        progresso: `${Math.round((metaReceita.current / metaReceita.target) * 100)}%`
      } : null
    },
    
    pipeline: {
      valor_total: valorPipeline,
      leads_ativos: leadsAtivos.length,
      leads_quentes_bant_3_4: leadsQuentes,
      leads_em_risco_sla: leadsEmRisco,
      forecast_ponderado: Math.round(forecastPipeline)
    },
    
    conversao: {
      novos_leads_periodo: leadsNoPeriodo.length,
      leads_ganhos: leadsGanhos.length,
      leads_perdidos: leadsPerdidos.length,
      taxa_conversao: `${taxaConversao}%`,
      meta: metaConversao ? {
        valor: metaConversao.target,
        atual: metaConversao.current,
        progresso: `${Math.round((metaConversao.current / metaConversao.target) * 100)}%`
      } : null
    },
    
    alertas: [
      leadsEmRisco > 0 ? `⚠️ ${leadsEmRisco} leads em risco de SLA` : null,
      leadsPerdidos.length > leadsGanhos.length ? '🔴 Mais perdas que ganhos no período' : null,
      taxaConversao < 10 ? '⚠️ Taxa de conversão abaixo de 10%' : null,
      leadsQuentes > 5 ? `🔥 ${leadsQuentes} leads quentes para priorizar` : null
    ].filter(Boolean),
    
    recomendacoes: [
      leadsEmRisco > 0 ? `Priorize os ${leadsEmRisco} leads em risco de SLA para evitar perdas.` : null,
      leadsQuentes > 0 ? `Foque nos ${leadsQuentes} leads com BANT 3+/4 para acelerar fechamentos.` : null,
      taxaConversao < 20 ? 'Revise o processo de qualificação para melhorar a taxa de conversão.' : null
    ].filter(Boolean)
  }
}

async function analisarTicketMedio(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 30
  const segmentarPor = args.segmentar_por as string | undefined
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)
  
  const { data: leads } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, value, payment_value, has_payment, stage, canal, priority')
    .eq('organization_id', ctx.clientOrgId)
    .or(`has_payment.eq.true,stage.in.(Fechado Ganho,fechado,ganho,convertido)`)
    .gte('updated_at', dataInicio.toISOString())
  
  if (!leads || leads.length === 0) {
    return {
      periodo: `Últimos ${periodoDias} dias`,
      erro: 'Nenhuma venda encontrada no período'
    }
  }
  
  const valores = leads.map((l: any) => l.payment_value || l.value || 0).filter((v: number) => v > 0)
  const ticketMedio = Math.round(valores.reduce((a: number, b: number) => a + b, 0) / valores.length)
  const ticketMinimo = Math.min(...valores)
  const ticketMaximo = Math.max(...valores)
  
  let segmentacao: Record<string, { quantidade: number; ticket_medio: number; valor_total: number }> = {}
  
  if (segmentarPor) {
    for (const lead of leads) {
      const chave = (lead as any)[segmentarPor] || 'Não informado'
      if (!segmentacao[chave]) {
        segmentacao[chave] = { quantidade: 0, ticket_medio: 0, valor_total: 0 }
      }
      segmentacao[chave].quantidade++
      segmentacao[chave].valor_total += lead.payment_value || lead.value || 0
    }
    
    for (const chave of Object.keys(segmentacao)) {
      segmentacao[chave].ticket_medio = Math.round(segmentacao[chave].valor_total / segmentacao[chave].quantidade)
    }
  }
  
  return {
    periodo: `Últimos ${periodoDias} dias`,
    resumo: {
      ticket_medio: ticketMedio,
      ticket_minimo: ticketMinimo,
      ticket_maximo: ticketMaximo,
      total_vendas: valores.length,
      valor_total: valores.reduce((a: number, b: number) => a + b, 0)
    },
    segmentacao: segmentarPor ? segmentacao : null,
    insight: ticketMaximo > ticketMedio * 3 
      ? `Há grande variação nos tickets (R$ ${ticketMinimo.toLocaleString('pt-BR')} a R$ ${ticketMaximo.toLocaleString('pt-BR')}). Considere segmentar sua estratégia por faixa de valor.`
      : `Tickets relativamente consistentes, média de R$ ${ticketMedio.toLocaleString('pt-BR')}.`
  }
}

async function projetarMeta(ctx: ToolContext) {
  const { data: goals } = await ctx.clientSupabase
    .from('crm_goals')
    .select('*')
    .eq('organization_id', ctx.clientOrgId)
    .eq('status', 'active')
  
  if (!goals || goals.length === 0) {
    return {
      erro: 'Nenhuma meta ativa encontrada. Configure metas em Configurações > Metas para usar esta análise.'
    }
  }
  
  const projecoes = []
  const hoje = new Date()
  
  for (const goal of goals) {
    const inicio = new Date(goal.period_start)
    const fim = new Date(goal.period_end)
    const diasTotais = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
    const diasDecorridos = Math.ceil((hoje.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
    const diasRestantes = Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
    
    const progressoAtual = goal.current || 0
    const meta = goal.target || 0
    const progressoPct = meta > 0 ? Math.round((progressoAtual / meta) * 100) : 0
    
    // Ritmo atual
    const ritmoAtual = diasDecorridos > 0 ? progressoAtual / diasDecorridos : 0
    const projecaoFinal = Math.round(ritmoAtual * diasTotais)
    
    // Ritmo necessário
    const faltante = meta - progressoAtual
    const ritmoNecessario = diasRestantes > 0 ? faltante / diasRestantes : faltante
    
    // Probabilidade (simplificada)
    let probabilidade = 0
    if (progressoAtual >= meta) {
      probabilidade = 100
    } else if (ritmoAtual >= ritmoNecessario * 0.9) {
      probabilidade = 85
    } else if (ritmoAtual >= ritmoNecessario * 0.7) {
      probabilidade = 60
    } else if (ritmoAtual >= ritmoNecessario * 0.5) {
      probabilidade = 35
    } else {
      probabilidade = 15
    }
    
    projecoes.push({
      tipo: goal.type,
      titulo: goal.title,
      meta: meta,
      atual: progressoAtual,
      progresso: `${progressoPct}%`,
      dias_restantes: diasRestantes,
      ritmo_atual_diario: Math.round(ritmoAtual * 100) / 100,
      ritmo_necessario_diario: Math.round(ritmoNecessario * 100) / 100,
      projecao_final: projecaoFinal,
      probabilidade_bater: `${probabilidade}%`,
      status: probabilidade >= 70 ? '🟢 No caminho' : probabilidade >= 40 ? '🟡 Atenção' : '🔴 Risco'
    })
  }
  
  return {
    data_analise: hoje.toLocaleDateString('pt-BR'),
    metas: projecoes,
    resumo: projecoes.every((p: any) => p.probabilidade_bater.replace('%', '') >= 70)
      ? '✅ Todas as metas estão no caminho!'
      : projecoes.some((p: any) => p.probabilidade_bater.replace('%', '') < 40)
      ? '⚠️ Algumas metas precisam de atenção urgente'
      : '📊 Metas em andamento, monitorar de perto'
  }
}

// ============================================================================
// TOOLS ESPECÍFICAS CEO - Implementações
// ============================================================================

async function analisarCoberturaPipeline(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 30
  
  // Buscar metas ativas
  const { data: goals } = await ctx.clientSupabase
    .from('crm_goals')
    .select('*')
    .eq('organization_id', ctx.clientOrgId)
    .eq('status', 'active')
    .eq('type', 'revenue')
  
  // Buscar pipeline ativo
  const { data: leadsAtivos } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, stage, value, bant_score')
    .eq('organization_id', ctx.clientOrgId)
    .not('stage', 'in', '(Fechado Ganho,Fechado Perdido,fechado,perdido,ganho)')
  
  const valorPipeline = (leadsAtivos || []).reduce((s: number, l: any) => s + (l.value || 0), 0)
  
  // Calcular forecast ponderado
  const taxasConversao: Record<string, number> = {
    'Novo Lead': 0.15, 'Qualificação': 0.25, 'Proposta': 0.40, 'Negociação': 0.65, 'Fechamento': 0.85
  }
  
  const forecastPonderado = (leadsAtivos || []).reduce((s: number, l: any) => {
    const taxa = taxasConversao[l.stage] || 0.20
    return s + ((l.value || 0) * taxa)
  }, 0)
  
  const metaReceita = goals?.[0]
  const metaValor = metaReceita?.target || 0
  
  const cobertura = metaValor > 0 ? Math.round((valorPipeline / metaValor) * 100) : 0
  const coberturaForecast = metaValor > 0 ? Math.round((forecastPonderado / metaValor) * 100) : 0
  
  // Recomendação baseada em cobertura
  let status = '🟢'
  let recomendacao = ''
  if (cobertura >= 300) {
    status = '🟢'
    recomendacao = 'Pipeline saudável com boa margem de segurança.'
  } else if (cobertura >= 200) {
    status = '🟡'
    recomendacao = 'Pipeline ok, mas monitore de perto. Considere acelerar prospecção.'
  } else if (cobertura >= 100) {
    status = '🟠'
    recomendacao = 'Pipeline apertado! Precisa aumentar geração de leads urgentemente.'
  } else {
    status = '🔴'
    recomendacao = 'Pipeline insuficiente para bater meta. Ação urgente necessária.'
  }
  
  return {
    periodo: `Próximos ${periodoDias} dias`,
    meta: {
      valor: metaValor,
      titulo: metaReceita?.title || 'Meta de Receita',
      progresso_atual: metaReceita?.current || 0,
      faltante: Math.max(0, metaValor - (metaReceita?.current || 0))
    },
    pipeline: {
      valor_total: valorPipeline,
      leads_ativos: leadsAtivos?.length || 0,
      forecast_ponderado: Math.round(forecastPonderado)
    },
    cobertura: {
      pipeline_vs_meta: `${cobertura}%`,
      forecast_vs_meta: `${coberturaForecast}%`,
      status,
      interpretacao: cobertura >= 300 ? 'Excelente' : cobertura >= 200 ? 'Bom' : cobertura >= 100 ? 'Apertado' : 'Crítico'
    },
    recomendacao,
    benchmark: 'O ideal é ter cobertura de 300%+ (3x a meta) para garantir resultado.'
  }
}

async function topOportunidades(ctx: ToolContext, args: Record<string, unknown>) {
  const limite = (args.limite as number) || 5
  const excluirFechados = args.excluir_fechados !== false
  
  let query = ctx.clientSupabase
    .from('crm_leads')
    .select('id, name, stage, value, bant_score, sla_status, created_at, updated_at, canal, priority')
    .eq('organization_id', ctx.clientOrgId)
    .order('value', { ascending: false })
    .limit(limite)
  
  if (excluirFechados) {
    query = query.not('stage', 'in', '(Fechado Ganho,Fechado Perdido,fechado,perdido,ganho)')
  }
  
  const { data: leads } = await query
  
  const valorTotal = (leads || []).reduce((s: number, l: any) => s + (l.value || 0), 0)
  
  const oportunidades = (leads || []).map((l: any, idx: number) => ({
    posicao: idx + 1,
    nome: l.name,
    valor: l.value || 0,
    estagio: l.stage,
    bant_score: l.bant_score || 0,
    sla_status: l.sla_status || 'ok',
    prioridade: l.priority,
    canal: l.canal,
    dias_no_funil: Math.round((new Date().getTime() - new Date(l.created_at).getTime()) / (1000 * 60 * 60 * 24)),
    risco: l.sla_status === 'breached' ? '🔴 SLA vencido' : l.sla_status === 'warning' ? '🟡 SLA próximo' : '🟢 OK'
  }))
  
  return {
    titulo: `Top ${limite} Oportunidades`,
    valor_total: valorTotal,
    oportunidades,
    insight: oportunidades.length > 0
      ? `As ${limite} maiores oportunidades somam R$ ${valorTotal.toLocaleString('pt-BR')}. ${
          oportunidades.some((o: any) => o.sla_status === 'breached') 
            ? '⚠️ Há oportunidades com SLA vencido - priorize!' 
            : 'Todas em dia com SLA.'
        }`
      : 'Nenhuma oportunidade ativa encontrada.'
  }
}

async function receitaPorSegmento(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 30
  const agruparPor = (args.agrupar_por as string) || 'canal'
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)
  
  const { data: leads } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, canal, source, priority, payment_value, has_payment, stage, value')
    .eq('organization_id', ctx.clientOrgId)
    .or(`has_payment.eq.true,stage.in.(Fechado Ganho,fechado,ganho,convertido)`)
    .gte('updated_at', dataInicio.toISOString())
  
  const porSegmento: Record<string, { quantidade: number; receita: number; ticket_medio: number }> = {}
  
  for (const lead of leads || []) {
    const segmento = (lead as any)[agruparPor] || lead.source || 'Não informado'
    if (!porSegmento[segmento]) {
      porSegmento[segmento] = { quantidade: 0, receita: 0, ticket_medio: 0 }
    }
    porSegmento[segmento].quantidade++
    porSegmento[segmento].receita += lead.payment_value || lead.value || 0
  }
  
  // Calcular ticket médio e ordenar
  for (const seg of Object.keys(porSegmento)) {
    porSegmento[seg].ticket_medio = porSegmento[seg].quantidade > 0
      ? Math.round(porSegmento[seg].receita / porSegmento[seg].quantidade)
      : 0
  }
  
  const segmentosOrdenados = Object.entries(porSegmento).sort((a, b) => b[1].receita - a[1].receita)
  const melhorSegmento = segmentosOrdenados[0]
  const receitaTotal = segmentosOrdenados.reduce((s, [, v]) => s + v.receita, 0)
  
  return {
    periodo: `Últimos ${periodoDias} dias`,
    agrupado_por: agruparPor,
    receita_total: receitaTotal,
    segmentos: Object.fromEntries(segmentosOrdenados),
    insight: melhorSegmento
      ? `"${melhorSegmento[0]}" é o segmento mais lucrativo com R$ ${melhorSegmento[1].receita.toLocaleString('pt-BR')} (${Math.round((melhorSegmento[1].receita / receitaTotal) * 100)}% da receita).`
      : 'Sem dados suficientes para análise.',
    recomendacao: melhorSegmento && melhorSegmento[1].receita > receitaTotal * 0.5
      ? `Considere focar mais em "${melhorSegmento[0]}" - representa mais de 50% da receita.`
      : 'Receita bem distribuída entre segmentos.'
  }
}

async function saudeBaseClientes(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 30
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)
  
  // Buscar clientes convertidos
  const { data: leadsConvertidos } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, name, payment_value, converted_at, stage, objection_type')
    .eq('organization_id', ctx.clientOrgId)
    .not('converted_client_id', 'is', null)
  
  // Buscar leads perdidos (churn potencial)
  const { data: leadsPerdidos } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, name, value, objection_type, objection_details, stage, updated_at')
    .eq('organization_id', ctx.clientOrgId)
    .in('stage', ['Fechado Perdido', 'perdido', 'desqualificado'])
    .gte('updated_at', dataInicio.toISOString())
  
  // Calcular métricas
  const clientesAtivos = leadsConvertidos?.length || 0
  const perdidosNoPeriodo = leadsPerdidos?.length || 0
  const taxaChurn = clientesAtivos > 0 ? Math.round((perdidosNoPeriodo / clientesAtivos) * 100) : 0
  
  // Agrupar motivos de churn
  const motivosChurn: Record<string, number> = {}
  for (const lead of leadsPerdidos || []) {
    const motivo = lead.objection_type || 'Não especificado'
    motivosChurn[motivo] = (motivosChurn[motivo] || 0) + 1
  }
  
  const motivosOrdenados = Object.entries(motivosChurn).sort((a, b) => b[1] - a[1])
  const principalMotivo = motivosOrdenados[0]
  
  const receitaClientes = (leadsConvertidos || []).reduce((s: number, l: any) => s + (l.payment_value || 0), 0)
  const valorPerdido = (leadsPerdidos || []).reduce((s: number, l: any) => s + (l.value || 0), 0)
  
  return {
    periodo: `Últimos ${periodoDias} dias`,
    resumo: {
      clientes_convertidos: clientesAtivos,
      receita_base: receitaClientes,
      perdidos_no_periodo: perdidosNoPeriodo,
      taxa_churn: `${taxaChurn}%`,
      valor_perdido: valorPerdido
    },
    saude: taxaChurn < 5 ? '🟢 Saudável' : taxaChurn < 15 ? '🟡 Atenção' : '🔴 Crítico',
    motivos_perda: Object.fromEntries(motivosOrdenados),
    insight: principalMotivo
      ? `Principal motivo de perda: "${principalMotivo[0]}" (${principalMotivo[1]} ocorrências). ${
          principalMotivo[0].toLowerCase().includes('preço') 
            ? 'Considere revisar política de precificação ou criar opções mais acessíveis.'
            : 'Revise o processo de vendas para endereçar essa objeção.'
        }`
      : 'Sem perdas significativas no período.',
    acao_recomendada: taxaChurn > 10
      ? 'URGENTE: Taxa de churn acima de 10%. Implemente programa de retenção.'
      : 'Manter monitoramento regular.'
  }
}

// ============================================================================
// TOOLS ESPECÍFICAS CRO - Implementações
// ============================================================================

async function performanceVendedores(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 30
  const ordenarPor = (args.ordenar_por as string) || 'receita'
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)
  
  // Buscar leads com assigned_to
  const { data: leads } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, assigned_to, stage, value, payment_value, has_payment, created_at')
    .eq('organization_id', ctx.clientOrgId)
    .gte('created_at', dataInicio.toISOString())
    .not('assigned_to', 'is', null)
  
  const porVendedor: Record<string, { 
    leads: number; 
    ganhos: number; 
    receita: number; 
    valor_pipeline: number;
    taxa_conversao: number;
    ticket_medio: number;
  }> = {}
  
  for (const lead of leads || []) {
    const vendedor = lead.assigned_to || 'Não atribuído'
    if (!porVendedor[vendedor]) {
      porVendedor[vendedor] = { leads: 0, ganhos: 0, receita: 0, valor_pipeline: 0, taxa_conversao: 0, ticket_medio: 0 }
    }
    porVendedor[vendedor].leads++
    porVendedor[vendedor].valor_pipeline += lead.value || 0
    
    if (['Fechado Ganho', 'fechado', 'ganho', 'convertido'].includes((lead.stage || '').toLowerCase())) {
      porVendedor[vendedor].ganhos++
      porVendedor[vendedor].receita += lead.payment_value || lead.value || 0
    }
  }
  
  // Calcular métricas derivadas
  for (const v of Object.keys(porVendedor)) {
    const data = porVendedor[v]
    data.taxa_conversao = data.leads > 0 ? Math.round((data.ganhos / data.leads) * 100) : 0
    data.ticket_medio = data.ganhos > 0 ? Math.round(data.receita / data.ganhos) : 0
  }
  
  // Ordenar
  const vendedoresOrdenados = Object.entries(porVendedor).sort((a, b) => {
    if (ordenarPor === 'conversao') return b[1].taxa_conversao - a[1].taxa_conversao
    if (ordenarPor === 'volume') return b[1].leads - a[1].leads
    if (ordenarPor === 'ticket_medio') return b[1].ticket_medio - a[1].ticket_medio
    return b[1].receita - a[1].receita
  })
  
  const topPerformer = vendedoresOrdenados[0]
  const bottomPerformer = vendedoresOrdenados[vendedoresOrdenados.length - 1]
  
  return {
    periodo: `Últimos ${periodoDias} dias`,
    ordenado_por: ordenarPor,
    vendedores: vendedoresOrdenados.map(([id, data], idx) => ({
      posicao: idx + 1,
      vendedor_id: id,
      ...data,
      status: idx === 0 ? '🥇 Top' : idx < 3 ? '🥈 Alta' : data.taxa_conversao < 10 ? '⚠️ Precisa ajuda' : '📊 Regular'
    })),
    insight: {
      top_performer: topPerformer ? {
        id: topPerformer[0],
        receita: topPerformer[1].receita,
        conversao: `${topPerformer[1].taxa_conversao}%`
      } : null,
      precisa_atencao: bottomPerformer && bottomPerformer[1].taxa_conversao < 10 ? {
        id: bottomPerformer[0],
        conversao: `${bottomPerformer[1].taxa_conversao}%`,
        recomendacao: 'Agendar coaching e revisão de discurso'
      } : null
    }
  }
}

async function atividadesTime(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 7
  const vendedorId = args.vendedor_id as string | undefined
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)
  
  let query = ctx.clientSupabase
    .from('crm_activities')
    .select('id, type, lead_id, created_at, created_by')
    .eq('organization_id', ctx.clientOrgId)
    .gte('created_at', dataInicio.toISOString())
  
  if (vendedorId) {
    query = query.eq('created_by', vendedorId)
  }
  
  const { data: atividades } = await query
  
  // Agrupar por tipo
  const porTipo: Record<string, number> = {}
  const porDia: Record<string, number> = {}
  const porVendedor: Record<string, Record<string, number>> = {}
  
  for (const atv of atividades || []) {
    const tipo = atv.type || 'outro'
    porTipo[tipo] = (porTipo[tipo] || 0) + 1
    
    const dia = new Date(atv.created_at).toLocaleDateString('pt-BR')
    porDia[dia] = (porDia[dia] || 0) + 1
    
    const vendedor = atv.created_by || 'Desconhecido'
    if (!porVendedor[vendedor]) {
      porVendedor[vendedor] = {}
    }
    porVendedor[vendedor][tipo] = (porVendedor[vendedor][tipo] || 0) + 1
  }
  
  const totalAtividades = atividades?.length || 0
  const mediaDiaria = Math.round(totalAtividades / periodoDias)
  
  return {
    periodo: `Últimos ${periodoDias} dias`,
    resumo: {
      total_atividades: totalAtividades,
      media_diaria: mediaDiaria,
      status: mediaDiaria >= 20 ? '🟢 Ativo' : mediaDiaria >= 10 ? '🟡 Moderado' : '🔴 Baixo'
    },
    por_tipo: porTipo,
    por_dia: porDia,
    por_vendedor: vendedorId ? null : porVendedor,
    benchmark: {
      ideal_diario: '15-25 atividades',
      sua_media: `${mediaDiaria} atividades`,
      gap: mediaDiaria < 15 ? `Faltam ${15 - mediaDiaria} atividades/dia para atingir o mínimo` : 'Acima do mínimo ✅'
    }
  }
}

async function tempoPorEstagio(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 30
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)
  
  // Buscar leads com histórico de estágios (via atividades de stage_change)
  const { data: leads } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, name, stage, created_at, updated_at, value')
    .eq('organization_id', ctx.clientOrgId)
    .gte('created_at', dataInicio.toISOString())
  
  // Calcular tempo médio no estágio atual
  const tempoPorEstagio: Record<string, { leads: number; tempo_total_dias: number; valor_parado: number }> = {}
  
  for (const lead of leads || []) {
    const stage = lead.stage || 'Sem estágio'
    const diasNoEstagio = Math.round((new Date().getTime() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24))
    
    if (!tempoPorEstagio[stage]) {
      tempoPorEstagio[stage] = { leads: 0, tempo_total_dias: 0, valor_parado: 0 }
    }
    tempoPorEstagio[stage].leads++
    tempoPorEstagio[stage].tempo_total_dias += diasNoEstagio
    tempoPorEstagio[stage].valor_parado += lead.value || 0
  }
  
  // Calcular médias e identificar gargalos
  const analise = Object.entries(tempoPorEstagio)
    .filter(([stage]) => !['Fechado Ganho', 'Fechado Perdido', 'fechado', 'perdido', 'ganho'].includes(stage))
    .map(([stage, data]) => ({
      estagio: stage,
      leads: data.leads,
      tempo_medio_dias: Math.round(data.tempo_total_dias / data.leads),
      valor_parado: data.valor_parado,
      status: data.leads >= 10 && (data.tempo_total_dias / data.leads) > 7 ? '🔴 Gargalo' : '🟢 OK'
    }))
    .sort((a, b) => b.tempo_medio_dias - a.tempo_medio_dias)
  
  const gargalo = analise.find(a => a.status === '🔴 Gargalo')
  
  return {
    periodo: `Últimos ${periodoDias} dias`,
    analise_por_estagio: analise,
    gargalo_identificado: gargalo ? {
      estagio: gargalo.estagio,
      leads_parados: gargalo.leads,
      tempo_medio: `${gargalo.tempo_medio_dias} dias`,
      valor_em_risco: gargalo.valor_parado,
      recomendacao: `O estágio "${gargalo.estagio}" é um gargalo com ${gargalo.leads} leads parados há ${gargalo.tempo_medio_dias} dias em média. Revise o processo desta etapa.`
    } : null,
    saude_funil: gargalo ? '🟡 Atenção - Gargalo identificado' : '🟢 Fluindo bem'
  }
}

async function motivoPerdaDetalhado(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 30
  const agruparPor = (args.agrupar_por as string) || 'canal'
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)
  
  const { data: leadsPerdidos } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, name, value, objection_type, objection_details, canal, source, assigned_to, stage')
    .eq('organization_id', ctx.clientOrgId)
    .in('stage', ['Fechado Perdido', 'perdido', 'desqualificado'])
    .gte('updated_at', dataInicio.toISOString())
  
  const analise: Record<string, Record<string, { quantidade: number; valor: number }>> = {}
  
  for (const lead of leadsPerdidos || []) {
    const dimensao = agruparPor === 'vendedor' ? lead.assigned_to : agruparPor === 'estagio' ? lead.stage : (lead.canal || lead.source || 'Não informado')
    const motivo = lead.objection_type || 'Não especificado'
    
    if (!analise[dimensao]) {
      analise[dimensao] = {}
    }
    if (!analise[dimensao][motivo]) {
      analise[dimensao][motivo] = { quantidade: 0, valor: 0 }
    }
    analise[dimensao][motivo].quantidade++
    analise[dimensao][motivo].valor += lead.value || 0
  }
  
  const totalPerdido = (leadsPerdidos || []).reduce((s: number, l: any) => s + (l.value || 0), 0)
  
  return {
    periodo: `Últimos ${periodoDias} dias`,
    agrupado_por: agruparPor,
    total_leads_perdidos: leadsPerdidos?.length || 0,
    valor_total_perdido: totalPerdido,
    analise_detalhada: analise,
    insight: Object.keys(analise).length > 0
      ? `Análise de perdas por ${agruparPor}. Use esses dados para identificar padrões e treinar o time.`
      : 'Sem perdas no período para analisar.'
  }
}

async function qualidadeLeadsPorOrigem(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 30
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)
  
  const { data: leads } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, canal, source, stage, value, payment_value, has_payment, created_at, updated_at')
    .eq('organization_id', ctx.clientOrgId)
    .gte('created_at', dataInicio.toISOString())
  
  const porOrigem: Record<string, {
    total: number;
    ganhos: number;
    perdidos: number;
    receita: number;
    tempo_medio_dias: number;
    taxa_conversao: number;
    ticket_medio: number;
  }> = {}
  
  for (const lead of leads || []) {
    const origem = lead.canal || lead.source || 'Não informado'
    if (!porOrigem[origem]) {
      porOrigem[origem] = { total: 0, ganhos: 0, perdidos: 0, receita: 0, tempo_medio_dias: 0, taxa_conversao: 0, ticket_medio: 0 }
    }
    porOrigem[origem].total++
    
    const diasNoFunil = Math.round((new Date(lead.updated_at).getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24))
    porOrigem[origem].tempo_medio_dias += diasNoFunil
    
    if (['Fechado Ganho', 'fechado', 'ganho', 'convertido'].includes((lead.stage || '').toLowerCase())) {
      porOrigem[origem].ganhos++
      porOrigem[origem].receita += lead.payment_value || lead.value || 0
    } else if (['Fechado Perdido', 'perdido', 'desqualificado'].includes((lead.stage || '').toLowerCase())) {
      porOrigem[origem].perdidos++
    }
  }
  
  // Calcular métricas derivadas
  for (const o of Object.keys(porOrigem)) {
    const data = porOrigem[o]
    data.tempo_medio_dias = data.total > 0 ? Math.round(data.tempo_medio_dias / data.total) : 0
    data.taxa_conversao = data.total > 0 ? Math.round((data.ganhos / data.total) * 100) : 0
    data.ticket_medio = data.ganhos > 0 ? Math.round(data.receita / data.ganhos) : 0
  }
  
  const origensOrdenadas = Object.entries(porOrigem)
    .sort((a, b) => b[1].taxa_conversao - a[1].taxa_conversao)
    .map(([origem, data]) => ({
      origem,
      ...data,
      qualidade: data.taxa_conversao >= 30 ? '🟢 Alta' : data.taxa_conversao >= 15 ? '🟡 Média' : '🔴 Baixa'
    }))
  
  const melhor = origensOrdenadas[0]
  const pior = origensOrdenadas[origensOrdenadas.length - 1]
  
  return {
    periodo: `Últimos ${periodoDias} dias`,
    origens: origensOrdenadas,
    insight: {
      melhor_origem: melhor ? {
        nome: melhor.origem,
        conversao: `${melhor.taxa_conversao}%`,
        recomendacao: `Invista mais em "${melhor.origem}" - melhor taxa de conversão.`
      } : null,
      pior_origem: pior && pior.taxa_conversao < 10 ? {
        nome: pior.origem,
        conversao: `${pior.taxa_conversao}%`,
        recomendacao: `Revise "${pior.origem}" - baixa conversão pode indicar ICP errado.`
      } : null
    }
  }
}

async function slaTempoResposta(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 7
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)
  
  // Buscar leads recentes e suas primeiras atividades
  const { data: leads } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, name, created_at, sla_status')
    .eq('organization_id', ctx.clientOrgId)
    .gte('created_at', dataInicio.toISOString())
  
  const { data: atividades } = await ctx.clientSupabase
    .from('crm_activities')
    .select('lead_id, created_at')
    .eq('organization_id', ctx.clientOrgId)
    .gte('created_at', dataInicio.toISOString())
    .order('created_at', { ascending: true })
  
  // Calcular tempo até primeira resposta
  const temposResposta: number[] = []
  const leadsComResposta: string[] = []
  
  for (const lead of leads || []) {
    const primeiraAtividade = (atividades || []).find((a: any) => a.lead_id === lead.id)
    if (primeiraAtividade) {
      const tempoMinutos = Math.round((new Date(primeiraAtividade.created_at).getTime() - new Date(lead.created_at).getTime()) / (1000 * 60))
      temposResposta.push(tempoMinutos)
      leadsComResposta.push(lead.id)
    }
  }
  
  const tempoMedio = temposResposta.length > 0 
    ? Math.round(temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length)
    : 0
  
  const leadsBreached = (leads || []).filter((l: any) => l.sla_status === 'breached').length
  const leadsWarning = (leads || []).filter((l: any) => l.sla_status === 'warning').length
  
  return {
    periodo: `Últimos ${periodoDias} dias`,
    metricas: {
      tempo_medio_resposta_minutos: tempoMedio,
      tempo_medio_formatado: tempoMedio < 60 ? `${tempoMedio} min` : `${Math.round(tempoMedio / 60)} horas`,
      leads_respondidos: leadsComResposta.length,
      leads_sem_resposta: (leads?.length || 0) - leadsComResposta.length,
      leads_sla_vencido: leadsBreached,
      leads_sla_proximo: leadsWarning
    },
    status: tempoMedio <= 15 ? '🟢 Excelente' : tempoMedio <= 60 ? '🟡 Aceitável' : '🔴 Lento',
    benchmark: {
      ideal: '< 15 minutos',
      aceitavel: '< 1 hora',
      seu_tempo: tempoMedio < 60 ? `${tempoMedio} minutos` : `${Math.round(tempoMedio / 60)} horas`
    },
    recomendacao: tempoMedio > 60
      ? 'URGENTE: Tempo de resposta muito alto. Implemente notificações e rotina de atendimento rápido.'
      : tempoMedio > 15
      ? 'Bom, mas pode melhorar. Considere automação para resposta inicial.'
      : 'Excelente tempo de resposta! Mantenha assim.'
  }
}

async function usoCrm(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 7
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)
  
  const { data: leads } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, name, stage, value, canal, description, bant_score, assigned_to, updated_at')
    .eq('organization_id', ctx.clientOrgId)
    .not('stage', 'in', '(Fechado Ganho,Fechado Perdido,fechado,perdido,ganho)')
  
  let camposObrigatorios = { preenchidos: 0, total: 0 }
  let leadsFantasma = 0 // Leads sem atualização há muito tempo
  let leadsSemAssignee = 0
  
  for (const lead of leads || []) {
    // Verificar campos importantes
    const campos = [lead.canal, lead.description, lead.value]
    campos.forEach(() => camposObrigatorios.total++)
    campos.filter(Boolean).forEach(() => camposObrigatorios.preenchidos++)
    
    // Verificar leads fantasma (sem atualização há mais de 7 dias)
    const diasSemAtualizar = Math.round((new Date().getTime() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24))
    if (diasSemAtualizar > 7) {
      leadsFantasma++
    }
    
    if (!lead.assigned_to) {
      leadsSemAssignee++
    }
  }
  
  const taxaPreenchimento = camposObrigatorios.total > 0
    ? Math.round((camposObrigatorios.preenchidos / camposObrigatorios.total) * 100)
    : 0
  
  const taxaFantasma = (leads?.length || 0) > 0
    ? Math.round((leadsFantasma / leads!.length) * 100)
    : 0
  
  return {
    periodo: `Últimos ${periodoDias} dias`,
    qualidade_dados: {
      taxa_preenchimento: `${taxaPreenchimento}%`,
      campos_analisados: ['canal', 'descricao', 'valor'],
      status: taxaPreenchimento >= 80 ? '🟢 Bom' : taxaPreenchimento >= 50 ? '🟡 Regular' : '🔴 Ruim'
    },
    pipeline_fantasma: {
      leads_desatualizados: leadsFantasma,
      percentual: `${taxaFantasma}%`,
      criterio: 'Sem atualização há mais de 7 dias',
      risco: taxaFantasma > 30 ? '🔴 Alto - pipeline não confiável' : taxaFantasma > 15 ? '🟡 Médio' : '🟢 Baixo'
    },
    atribuicao: {
      leads_sem_responsavel: leadsSemAssignee,
      percentual: (leads?.length || 0) > 0 ? `${Math.round((leadsSemAssignee / leads!.length) * 100)}%` : '0%'
    },
    recomendacoes: [
      taxaPreenchimento < 80 ? 'Treine o time para preencher todos os campos obrigatórios' : null,
      taxaFantasma > 20 ? 'Implemente rotina semanal de limpeza de pipeline' : null,
      leadsSemAssignee > 5 ? 'Atribua responsáveis para todos os leads' : null
    ].filter(Boolean)
  }
}

async function forecastDetalhado(ctx: ToolContext, args: Record<string, unknown>) {
  const horizonteDias = (args.horizonte_dias as number) || 30
  
  const { data: leads } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, name, stage, value, bant_score, sla_status, updated_at')
    .eq('organization_id', ctx.clientOrgId)
    .not('stage', 'in', '(Fechado Ganho,Fechado Perdido,fechado,perdido,ganho)')
  
  // Taxas de conversão por estágio (podem ser customizadas)
  const taxasConversao: Record<string, number> = {
    'Novo Lead': 0.10,
    'Qualificação': 0.20,
    'Proposta': 0.40,
    'Negociação': 0.60,
    'Fechamento': 0.85
  }
  
  // Ajuste por BANT score
  const ajusteBant = (bant: number) => {
    if (bant >= 4) return 1.2
    if (bant >= 3) return 1.1
    if (bant >= 2) return 1.0
    return 0.8
  }
  
  let forecastOtimista = 0
  let forecastRealista = 0
  let forecastPessimista = 0
  
  const porEstagio: Record<string, { leads: number; valor: number; forecast: number }> = {}
  
  for (const lead of leads || []) {
    const stage = lead.stage || 'Novo Lead'
    const taxaBase = taxasConversao[stage] || 0.15
    const ajuste = ajusteBant(lead.bant_score || 0)
    const valor = lead.value || 0
    
    forecastOtimista += valor * Math.min(taxaBase * ajuste * 1.3, 1)
    forecastRealista += valor * taxaBase * ajuste
    forecastPessimista += valor * taxaBase * ajuste * 0.7
    
    if (!porEstagio[stage]) {
      porEstagio[stage] = { leads: 0, valor: 0, forecast: 0 }
    }
    porEstagio[stage].leads++
    porEstagio[stage].valor += valor
    porEstagio[stage].forecast += valor * taxaBase * ajuste
  }
  
  return {
    horizonte: `Próximos ${horizonteDias} dias`,
    cenarios: {
      pessimista: Math.round(forecastPessimista),
      realista: Math.round(forecastRealista),
      otimista: Math.round(forecastOtimista)
    },
    por_estagio: porEstagio,
    metodologia: 'Forecast ponderado por taxa de conversão histórica + ajuste BANT',
    confiabilidade: (leads?.length || 0) > 20 ? '🟢 Alta (base > 20 leads)' : '🟡 Média (base < 20 leads)',
    recomendacao: `Use o cenário realista (R$ ${Math.round(forecastRealista).toLocaleString('pt-BR')}) para planejamento. O pessimista para reserva de caixa.`
  }
}

async function dashboardCeo(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 30
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)
  
  // Buscar dados em paralelo
  const [leadsResult, goalsResult, entradasResult] = await Promise.all([
    ctx.clientSupabase
      .from('crm_leads')
      .select('id, stage, value, payment_value, has_payment, bant_score, sla_status, created_at, updated_at')
      .eq('organization_id', ctx.clientOrgId),
    ctx.clientSupabase
      .from('crm_goals')
      .select('*')
      .eq('organization_id', ctx.clientOrgId)
      .eq('status', 'active'),
    ctx.clientSupabase
      .from('entradas')
      .select('valor')
      .eq('organization_id', ctx.clientOrgId)
      .gte('data_entrada', dataInicio.toISOString())
  ])
  
  const leads = leadsResult.data || []
  const goals = goalsResult.data || []
  const entradas = entradasResult.data || []
  
  // Cálculos
  const leadsNoPeriodo = leads.filter((l: any) => new Date(l.created_at) >= dataInicio)
  const leadsGanhos = leads.filter((l: any) => 
    ['Fechado Ganho', 'fechado', 'ganho', 'convertido'].includes((l.stage || '').toLowerCase()) &&
    new Date(l.updated_at) >= dataInicio
  )
  const leadsAtivos = leads.filter((l: any) => 
    !['Fechado Ganho', 'Fechado Perdido', 'fechado', 'perdido', 'ganho'].includes((l.stage || '').toLowerCase())
  )
  
  const receitaLeads = leadsGanhos.reduce((s: number, l: any) => s + (l.payment_value || 0), 0)
  const receitaEntradas = entradas.reduce((s: number, e: any) => s + (e.valor || 0), 0)
  const receitaTotal = receitaLeads + receitaEntradas
  
  const valorPipeline = leadsAtivos.reduce((s: number, l: any) => s + (l.value || 0), 0)
  const leadsEmRisco = leads.filter((l: any) => l.sla_status === 'breached' || l.sla_status === 'warning').length
  
  const taxaConversao = leadsNoPeriodo.length > 0 
    ? Math.round((leadsGanhos.length / leadsNoPeriodo.length) * 100) 
    : 0
  
  const metaReceita = goals.find((g: any) => g.type === 'revenue')
  const progressoMeta = metaReceita ? Math.round((metaReceita.current / metaReceita.target) * 100) : 0
  
  return {
    titulo: '📊 DASHBOARD CEO',
    periodo: `Últimos ${periodoDias} dias`,
    gerado_em: new Date().toLocaleString('pt-BR'),
    
    kpis: {
      receita_mes: {
        valor: receitaTotal,
        label: 'Receita do Mês',
        status: '💰'
      },
      pipeline: {
        valor: valorPipeline,
        leads: leadsAtivos.length,
        label: 'Pipeline Ativo',
        status: '📈'
      },
      conversao: {
        valor: `${taxaConversao}%`,
        label: 'Taxa de Conversão',
        status: taxaConversao >= 20 ? '🟢' : taxaConversao >= 10 ? '🟡' : '🔴'
      },
      meta: {
        valor: metaReceita ? `${progressoMeta}%` : 'Não configurada',
        label: 'Progresso da Meta',
        status: progressoMeta >= 80 ? '🟢' : progressoMeta >= 50 ? '🟡' : '🔴'
      },
      risco: {
        valor: leadsEmRisco,
        label: 'Leads em Risco',
        status: leadsEmRisco === 0 ? '🟢' : leadsEmRisco <= 5 ? '🟡' : '🔴'
      }
    },
    
    alertas: [
      leadsEmRisco > 5 ? `⚠️ ${leadsEmRisco} leads em risco de SLA` : null,
      taxaConversao < 10 ? '⚠️ Taxa de conversão abaixo de 10%' : null,
      progressoMeta > 0 && progressoMeta < 50 ? '⚠️ Meta com menos de 50% de progresso' : null
    ].filter(Boolean),
    
    resumo_executivo: `Receita de R$ ${receitaTotal.toLocaleString('pt-BR')} no período. Pipeline de R$ ${valorPipeline.toLocaleString('pt-BR')} com ${leadsAtivos.length} leads. ${taxaConversao >= 15 ? 'Conversão saudável.' : 'Conversão precisa de atenção.'}`
  }
}

// ============================================================================
// Geração de Contexto para Propostas com IA
// ============================================================================

async function gerarContextoProposta(ctx: ToolContext, args: Record<string, unknown>) {
  const leadId = args.lead_id as string
  const produtosIds = args.produtos_ids as string[] | undefined
  const valorTotal = args.valor_total as number | undefined
  const descontoPercent = args.desconto_percent as number | undefined
  const validadeDias = (args.validade_dias as number) || 30
  const tom = (args.tom as string) || 'consultivo'
  const foco = args.foco as string | undefined

  if (!leadId) {
    return { error: 'lead_id é obrigatório' }
  }

  // 1. Buscar dados do lead com qualificação completa
  const { data: lead, error: leadError } = await ctx.clientSupabase
    .from('crm_leads')
    .select(`
      id, name, email, whatsapp, company_name, description, stage, value, priority,
      source, canal, bant_budget, bant_authority, bant_need, bant_timeline, bant_score,
      objection_type, objection_details, decision_map,
      created_at, stage_entered_at, updated_at
    `)
    .eq('id', leadId)
    .eq('organization_id', ctx.clientOrgId)
    .single()

  if (leadError || !lead) {
    return { error: `Lead não encontrado: ${leadError?.message || 'ID inválido'}` }
  }

  // 1.1 Buscar propostas anteriores deste lead
  const { data: propostasAnteriores } = await ctx.clientSupabase
    .from('crm_proposals')
    .select('proposal_number, title, total_value, status, rejection_reason, created_at')
    .eq('lead_id', leadId)
    .eq('organization_id', ctx.clientOrgId)
    .order('created_at', { ascending: false })
    .limit(3)

  // 2. Buscar últimas notas do lead
  const { data: activities } = await ctx.clientSupabase
    .from('crm_activities')
    .select('content, type, created_at')
    .eq('lead_id', leadId)
    .eq('organization_id', ctx.clientOrgId)
    .order('created_at', { ascending: false })
    .limit(10)

  const notas = (activities || [])
    .filter((a: any) => a.type === 'note' || a.type === 'call' || a.type === 'meeting')
    .map((a: any) => a.content)
    .slice(0, 5)

  // 3. Buscar produtos selecionados (se IDs fornecidos)
  let produtos: any[] = []
  if (produtosIds && produtosIds.length > 0) {
    const { data: produtosData } = await ctx.clientSupabase
      .from('produtos_servicos')
      .select('id, nome, descricao, preco_base, tipo, categoria')
      .in('id', produtosIds)
      .eq('organization_id', ctx.clientOrgId)

    produtos = produtosData || []
  }

  // 4. Buscar interesses do lead (produtos vinculados)
  const { data: interesses } = await ctx.clientSupabase
    .from('lead_products')
    .select(`
      type, quantity, notes,
      produto_servico:produtos_servicos(id, nome, descricao, preco_base, tipo)
    `)
    .eq('lead_id', leadId)
    .eq('organization_id', ctx.clientOrgId)
    .eq('type', 'interest')
    .limit(10)

  // 5. Buscar template padrão de proposta (se existir)
  const { data: template } = await ctx.clientSupabase
    .from('crm_proposal_templates')
    .select('name, header_text, footer_text, terms_conditions')
    .eq('organization_id', ctx.clientOrgId)
    .eq('is_default', true)
    .single()

  // 6. Montar contexto rico
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  const diasNoPipeline = Math.floor(
    (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )

  // Interpretar BANT Score
  const bantScore = lead.bant_score || 0
  const bantInterpretacao = 
    bantScore === 0 ? '❄️ Não Qualificado' :
    bantScore === 1 ? '🧊 Frio' :
    bantScore === 2 ? '🌡️ Morno' :
    bantScore === 3 ? '🔥 Quente' :
    '🔥🔥 Muito Quente'

  // Formatar decision_map
  const stakeholders = (lead.decision_map || []).map((s: any) => ({
    nome: s.name,
    cargo: s.role,
    tipo: s.type === 'decision_maker' ? '👔 Decisor' :
          s.type === 'influencer' ? '💡 Influenciador' :
          s.type === 'user' ? '👤 Usuário' : '📋 Outro'
  }))

  // Formatar objeção
  const objecaoLabelsCtx: Record<string, string> = {
    'preco': '💰 Preço', 'timing': '⏰ Timing', 'concorrente': '🏆 Concorrente',
    'fit': '🎯 Fit', 'budget': '💳 Budget', 'autoridade': '👤 Autoridade',
    'urgencia': '⚡ Urgência', 'outro': '📝 Outro'
  }

  return {
    sucesso: true,
    contexto: {
      lead: {
        nome: lead.name,
        empresa: lead.company_name || 'Não informada',
        email: lead.email || 'Não informado',
        whatsapp: lead.whatsapp || 'Não informado',
        descricao: lead.description || 'Não informada',
        estagio: lead.stage,
        valor_estimado: lead.value ? formatCurrency(lead.value) : 'Não estimado',
        prioridade: lead.priority,
        canal_origem: lead.canal || lead.source || 'Não informado',
        dias_no_pipeline: diasNoPipeline,
        ultima_atualizacao: lead.updated_at
          ? new Date(lead.updated_at).toLocaleDateString('pt-BR')
          : 'Não registrado'
      },
      
      // QUALIFICAÇÃO BANT COMPLETA
      qualificacao_bant: {
        score: bantScore,
        max_score: 4,
        nivel: bantInterpretacao,
        budget: {
          confirmado: lead.bant_budget?.confirmed || false,
          valor: lead.bant_budget?.value || null,
          notas: lead.bant_budget?.notes || null
        },
        authority: {
          confirmado: lead.bant_authority?.confirmed || false,
          cargo: lead.bant_authority?.value || null,
          notas: lead.bant_authority?.notes || null
        },
        need: {
          confirmado: lead.bant_need?.confirmed || false,
          necessidade: lead.bant_need?.value || null,
          notas: lead.bant_need?.notes || null
        },
        timeline: {
          confirmado: lead.bant_timeline?.confirmed || false,
          prazo: lead.bant_timeline?.value || null,
          notas: lead.bant_timeline?.notes || null
        }
      },

      // OBJEÇÕES REGISTRADAS
      objecao: lead.objection_type ? {
        tipo: lead.objection_type,
        label: objecaoLabelsCtx[lead.objection_type as string] || lead.objection_type,
        detalhes: lead.objection_details || null
      } : null,

      // MAPA DE DECISÃO (STAKEHOLDERS)
      stakeholders: stakeholders.length > 0 ? stakeholders : null,
      decisor_principal: stakeholders.find((s: any) => s.tipo.includes('Decisor')) || null,

      // PROPOSTAS ANTERIORES
      propostas_anteriores: (propostasAnteriores || []).map((p: any) => ({
        numero: p.proposal_number,
        titulo: p.title,
        valor: formatCurrency(p.total_value || 0),
        status: p.status,
        motivo_rejeicao: p.rejection_reason || null,
        data: new Date(p.created_at).toLocaleDateString('pt-BR')
      })),

      notas_historico: notas.length > 0 ? notas : ['Nenhuma nota registrada'],
      interesses: (interesses || []).map((i: any) => ({
        produto: i.produto_servico?.nome || 'Produto',
        quantidade: i.quantity || 1,
        observacao: i.notes
      })),
      produtos_proposta: produtos.map((p: any) => ({
        nome: p.nome,
        descricao: p.descricao || '',
        preco: formatCurrency(p.preco_base),
        tipo: p.tipo || 'Não classificado'
      })),
      valores: {
        total: valorTotal ? formatCurrency(valorTotal) : 'A definir',
        desconto: descontoPercent ? `${descontoPercent}%` : '0%',
        validade: `${validadeDias} dias`
      },
      configuracoes: {
        tom,
        foco: foco || 'geral'
      },
      template_padrao: template
        ? {
            header: template.header_text,
            footer: template.footer_text,
            termos: template.terms_conditions
          }
        : null
    },
    instrucao: `Com base neste contexto COMPLETO (incluindo qualificação BANT, objeções e stakeholders), gere uma proposta comercial personalizada para ${lead.name}${lead.company_name ? ` da ${lead.company_name}` : ''}.

🎯 BANT Score: ${bantScore}/4 (${bantInterpretacao})
${stakeholders.length > 0 ? `👥 Stakeholders: ${stakeholders.map((s: any) => s.nome).join(', ')}` : ''}
${lead.objection_type ? `⚠️ Objeção registrada: ${objecaoLabelsCtx[lead.objection_type as string] || lead.objection_type}` : ''}
${(propostasAnteriores || []).length > 0 ? `📋 ${propostasAnteriores.length} proposta(s) anterior(es)` : ''}

Use tom ${tom}${foco ? ` com foco em ${foco}` : ''}. Se houver objeções, aborde-as na proposta. Se houver múltiplos stakeholders, considere os diferentes interesses.`
  }
}

async function dashboardCro(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 30
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)
  
  const { data: leads } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, stage, value, canal, sla_status, bant_score, assigned_to, created_at, updated_at, objection_type')
    .eq('organization_id', ctx.clientOrgId)
  
  const { data: atividades } = await ctx.clientSupabase
    .from('crm_activities')
    .select('id, type, lead_id, created_by')
    .eq('organization_id', ctx.clientOrgId)
    .gte('created_at', dataInicio.toISOString())
  
  // Funil por estágio
  const porEstagio: Record<string, number> = {}
  const leadsNoPeriodo = (leads || []).filter((l: any) => new Date(l.created_at) >= dataInicio)
  
  for (const lead of leads || []) {
    porEstagio[lead.stage] = (porEstagio[lead.stage] || 0) + 1
  }
  
  // Conversão
  const ganhos = (leads || []).filter((l: any) => 
    ['Fechado Ganho', 'fechado', 'ganho', 'convertido'].includes((l.stage || '').toLowerCase()) &&
    new Date(l.updated_at) >= dataInicio
  ).length
  const perdidos = (leads || []).filter((l: any) => 
    ['Fechado Perdido', 'perdido'].includes((l.stage || '').toLowerCase()) &&
    new Date(l.updated_at) >= dataInicio
  ).length
  
  // Atividades por tipo
  const atividadesPorTipo: Record<string, number> = {}
  for (const atv of atividades || []) {
    atividadesPorTipo[atv.type] = (atividadesPorTipo[atv.type] || 0) + 1
  }
  
  // Por canal
  const porCanal: Record<string, number> = {}
  for (const lead of leadsNoPeriodo) {
    const canal = lead.canal || 'Não informado'
    porCanal[canal] = (porCanal[canal] || 0) + 1
  }
  
  // Objeções
  const objecoes: Record<string, number> = {}
  for (const lead of leads || []) {
    if (lead.objection_type) {
      objecoes[lead.objection_type] = (objecoes[lead.objection_type] || 0) + 1
    }
  }
  
  const slaBreached = (leads || []).filter((l: any) => l.sla_status === 'breached').length
  const totalAtividades = atividades?.length || 0
  const mediaDiaria = Math.round(totalAtividades / periodoDias)
  
  return {
    titulo: '📊 DASHBOARD CRO',
    periodo: `Últimos ${periodoDias} dias`,
    gerado_em: new Date().toLocaleString('pt-BR'),
    
    funil: {
      distribuicao: porEstagio,
      novos_leads: leadsNoPeriodo.length,
      ganhos,
      perdidos,
      taxa_conversao: leadsNoPeriodo.length > 0 ? `${Math.round((ganhos / leadsNoPeriodo.length) * 100)}%` : '0%',
      taxa_perda: leadsNoPeriodo.length > 0 ? `${Math.round((perdidos / leadsNoPeriodo.length) * 100)}%` : '0%'
    },
    
    atividade: {
      total: totalAtividades,
      media_diaria: mediaDiaria,
      por_tipo: atividadesPorTipo,
      status: mediaDiaria >= 15 ? '🟢 Ativo' : mediaDiaria >= 8 ? '🟡 Moderado' : '🔴 Baixo'
    },
    
    canais: porCanal,
    
    sla: {
      leads_vencidos: slaBreached,
      status: slaBreached === 0 ? '🟢 Todos em dia' : slaBreached <= 3 ? '🟡 Atenção' : '🔴 Crítico'
    },
    
    objecoes_principais: Object.entries(objecoes).sort((a, b) => b[1] - a[1]).slice(0, 5),
    
    acoes_recomendadas: [
      slaBreached > 0 ? `Priorizar ${slaBreached} leads com SLA vencido` : null,
      mediaDiaria < 10 ? 'Aumentar volume de atividades comerciais' : null,
      perdidos > ganhos ? 'Revisar processo - mais perdas que ganhos' : null
    ].filter(Boolean)
  }
}

// ============================================================================
// Ferramentas para Repositório de Mensagens (Histórico de Conversas)
// ============================================================================

/**
 * Obtém histórico de conversas de um cliente pelo número de WhatsApp
 */
async function obterHistoricoConversa(ctx: ToolContext, args: Record<string, unknown>) {
  const whatsappCliente = args.whatsapp_cliente as string
  const limite = (args.limite as number) || 50
  const apenasCliente = (args.apenas_cliente as boolean) || false
  const periodoDias = (args.periodo_dias as number) || 30

  if (!whatsappCliente) {
    return { error: 'whatsapp_cliente é obrigatório' }
  }

  // Normalizar número (remover caracteres não numéricos)
  const numeroNormalizado = whatsappCliente.replace(/\D/g, '')

  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)

  // Buscar mensagens do repositório
  let query = ctx.clientSupabase
    .from('repositorio_de_mensagens')
    .select('id, created_at, whatsapp_cliente, whatsapp_empresa, sender_type, direction, content_text, has_media, media_type')
    .eq('organization_id', ctx.clientOrgId)
    .or(`whatsapp_cliente.ilike.%${numeroNormalizado}%,whatsapp_cliente.eq.${whatsappCliente}`)
    .gte('created_at', dataInicio.toISOString())
    .order('created_at', { ascending: true })
    .limit(limite)

  if (apenasCliente) {
    query = query.eq('sender_type', 'cliente')
  }

  const { data: mensagens, error } = await query

  if (error) {
    return { error: `Erro ao buscar mensagens: ${error.message}` }
  }

  if (!mensagens || mensagens.length === 0) {
    return {
      sucesso: false,
      mensagem: 'Nenhuma conversa encontrada para este número no período',
      whatsapp_buscado: whatsappCliente,
      periodo_dias: periodoDias
    }
  }

  // Formatar mensagens para retorno
  const conversasFormatadas = mensagens.map((m: any) => ({
    data_hora: new Date(m.created_at).toLocaleString('pt-BR'),
    remetente: m.sender_type === 'cliente' ? '👤 CLIENTE' : m.sender_type === 'ia' ? '🤖 IA' : '👨‍💼 HUMANO',
    sender_type: m.sender_type,
    direcao: m.direction === 'inbound' ? '📥 Recebida' : '📤 Enviada',
    mensagem: m.content_text || (m.has_media ? `[Mídia: ${m.media_type || 'arquivo'}]` : '[Mensagem vazia]'),
    tem_midia: m.has_media,
    tipo_midia: m.media_type
  }))

  // Estatísticas da conversa
  const stats = {
    total_mensagens: mensagens.length,
    mensagens_cliente: mensagens.filter((m: any) => m.sender_type === 'cliente').length,
    mensagens_ia: mensagens.filter((m: any) => m.sender_type === 'ia').length,
    mensagens_humano: mensagens.filter((m: any) => m.sender_type === 'humano').length,
    primeira_mensagem: new Date(mensagens[0].created_at).toLocaleString('pt-BR'),
    ultima_mensagem: new Date(mensagens[mensagens.length - 1].created_at).toLocaleString('pt-BR')
  }

  return {
    sucesso: true,
    whatsapp_cliente: whatsappCliente,
    periodo: `Últimos ${periodoDias} dias`,
    estatisticas: stats,
    conversas: conversasFormatadas,
    instrucao: 'Use estas mensagens para entender o contexto real da negociação antes de gerar propostas.'
  }
}

/**
 * Busca conversas de um lead específico pelo ID
 */
async function buscarConversasLead(ctx: ToolContext, args: Record<string, unknown>) {
  const leadId = args.lead_id as string
  const limite = (args.limite as number) || 50
  const periodoDias = (args.periodo_dias as number) || 30

  if (!leadId) {
    return { error: 'lead_id é obrigatório' }
  }

  // 1. Buscar dados do lead para obter o WhatsApp
  const { data: lead, error: leadError } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, name, whatsapp, email, company_name')
    .eq('id', leadId)
    .eq('organization_id', ctx.clientOrgId)
    .single()

  if (leadError || !lead) {
    return { error: `Lead não encontrado: ${leadError?.message || 'ID inválido'}` }
  }

  if (!lead.whatsapp) {
    return {
      sucesso: false,
      lead_nome: lead.name,
      mensagem: 'Lead não possui número de WhatsApp cadastrado',
      sugestao: 'Cadastre o WhatsApp do lead para poder buscar histórico de conversas'
    }
  }

  // 2. Buscar mensagens usando o WhatsApp do lead
  const numeroNormalizado = lead.whatsapp.replace(/\D/g, '')
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)

  const { data: mensagens, error: msgError } = await ctx.clientSupabase
    .from('repositorio_de_mensagens')
    .select('id, created_at, whatsapp_cliente, whatsapp_empresa, sender_type, direction, content_text, has_media, media_type')
    .eq('organization_id', ctx.clientOrgId)
    .or(`whatsapp_cliente.ilike.%${numeroNormalizado}%,whatsapp_cliente.eq.${lead.whatsapp}`)
    .gte('created_at', dataInicio.toISOString())
    .order('created_at', { ascending: true })
    .limit(limite)

  if (msgError) {
    return { error: `Erro ao buscar mensagens: ${msgError.message}` }
  }

  if (!mensagens || mensagens.length === 0) {
    return {
      sucesso: false,
      lead: {
        id: lead.id,
        nome: lead.name,
        empresa: lead.company_name,
        whatsapp: lead.whatsapp
      },
      mensagem: 'Nenhuma conversa encontrada para este lead no período',
      periodo_dias: periodoDias
    }
  }

  // Formatar mensagens
  const conversasFormatadas = mensagens.map((m: any) => ({
    data_hora: new Date(m.created_at).toLocaleString('pt-BR'),
    remetente: m.sender_type === 'cliente' ? '👤 CLIENTE' : m.sender_type === 'ia' ? '🤖 IA' : '👨‍💼 HUMANO',
    sender_type: m.sender_type,
    mensagem: m.content_text || (m.has_media ? `[Mídia: ${m.media_type || 'arquivo'}]` : '[Mensagem vazia]'),
  }))

  // Estatísticas
  const stats = {
    total_mensagens: mensagens.length,
    mensagens_cliente: mensagens.filter((m: any) => m.sender_type === 'cliente').length,
    mensagens_ia: mensagens.filter((m: any) => m.sender_type === 'ia').length,
    mensagens_humano: mensagens.filter((m: any) => m.sender_type === 'humano').length,
  }

  return {
    sucesso: true,
    lead: {
      id: lead.id,
      nome: lead.name,
      empresa: lead.company_name,
      whatsapp: lead.whatsapp,
      email: lead.email
    },
    periodo: `Últimos ${periodoDias} dias`,
    estatisticas: stats,
    conversas: conversasFormatadas,
    instrucao: `Histórico de conversas de ${lead.name}. Use para personalizar propostas com base nas necessidades reais expressas.`
  }
}

/**
 * Busca mensagens por texto (full-text search)
 */
async function buscarMensagensPorTexto(ctx: ToolContext, args: Record<string, unknown>) {
  const query = args.query as string
  const whatsappCliente = args.whatsapp_cliente as string | undefined
  const senderType = args.sender_type as string | undefined
  const limite = (args.limite as number) || 30

  if (!query) {
    return { error: 'query é obrigatório para busca' }
  }

  // Construir query de busca
  let supabaseQuery = ctx.clientSupabase
    .from('repositorio_de_mensagens')
    .select('id, created_at, whatsapp_cliente, sender_type, content_text')
    .eq('organization_id', ctx.clientOrgId)
    .textSearch('tsv', query, { type: 'websearch', config: 'portuguese' })
    .order('created_at', { ascending: false })
    .limit(limite)

  if (whatsappCliente) {
    const numeroNormalizado = whatsappCliente.replace(/\D/g, '')
    supabaseQuery = supabaseQuery.or(`whatsapp_cliente.ilike.%${numeroNormalizado}%,whatsapp_cliente.eq.${whatsappCliente}`)
  }

  if (senderType && ['cliente', 'ia', 'humano'].includes(senderType)) {
    supabaseQuery = supabaseQuery.eq('sender_type', senderType)
  }

  const { data: mensagens, error } = await supabaseQuery

  if (error) {
    return { error: `Erro na busca: ${error.message}` }
  }

  if (!mensagens || mensagens.length === 0) {
    return {
      sucesso: false,
      query,
      mensagem: 'Nenhuma mensagem encontrada com este termo',
      dica: 'Tente termos mais genéricos ou verifique a ortografia'
    }
  }

  const resultados = mensagens.map((m: any) => ({
    data_hora: new Date(m.created_at).toLocaleString('pt-BR'),
    whatsapp: m.whatsapp_cliente,
    remetente: m.sender_type === 'cliente' ? '👤 CLIENTE' : m.sender_type === 'ia' ? '🤖 IA' : '👨‍💼 HUMANO',
    conteudo: m.content_text
  }))

  return {
    sucesso: true,
    query,
    total_encontrado: mensagens.length,
    resultados,
    instrucao: 'Use estes resultados para entender como os clientes falam sobre este tema.'
  }
}

/**
 * Gera um resumo estruturado de uma conversa
 */
async function resumirConversa(ctx: ToolContext, args: Record<string, unknown>) {
  const whatsappCliente = args.whatsapp_cliente as string | undefined
  const leadId = args.lead_id as string | undefined

  let numeroWhatsapp = whatsappCliente

  // Se tiver lead_id, buscar o WhatsApp
  if (!numeroWhatsapp && leadId) {
    const { data: lead } = await ctx.clientSupabase
      .from('crm_leads')
      .select('name, whatsapp, company_name')
      .eq('id', leadId)
      .eq('organization_id', ctx.clientOrgId)
      .single()

    if (lead?.whatsapp) {
      numeroWhatsapp = lead.whatsapp
    } else {
      return { error: 'Lead não possui WhatsApp cadastrado' }
    }
  }

  if (!numeroWhatsapp) {
    return { error: 'Forneça whatsapp_cliente ou lead_id' }
  }

  // Buscar mensagens dos últimos 30 dias
  const numeroNormalizado = numeroWhatsapp.replace(/\D/g, '')
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - 30)

  const { data: mensagens, error } = await ctx.clientSupabase
    .from('repositorio_de_mensagens')
    .select('sender_type, content_text, created_at')
    .eq('organization_id', ctx.clientOrgId)
    .or(`whatsapp_cliente.ilike.%${numeroNormalizado}%,whatsapp_cliente.eq.${numeroWhatsapp}`)
    .gte('created_at', dataInicio.toISOString())
    .order('created_at', { ascending: true })
    .limit(100)

  if (error || !mensagens || mensagens.length === 0) {
    return {
      sucesso: false,
      mensagem: 'Nenhuma conversa encontrada para resumir'
    }
  }

  // Extrair padrões das mensagens do cliente
  const mensagensCliente = mensagens
    .filter((m: any) => m.sender_type === 'cliente')
    .map((m: any) => m.content_text)
    .filter(Boolean)

  // Identificar padrões comuns (simplificado - pode ser melhorado com NLP)
  const palavrasChave = {
    preco: mensagensCliente.filter((m: string) => /preço|valor|custo|quanto|desconto|barato|caro/i.test(m)).length,
    urgencia: mensagensCliente.filter((m: string) => /urgente|rapido|prazo|hoje|amanha|logo|preciso/i.test(m)).length,
    duvidas: mensagensCliente.filter((m: string) => /como|funciona|pode|consegue|explica|duvida|\?/i.test(m)).length,
    interesse: mensagensCliente.filter((m: string) => /quero|gostei|interessado|fechamos|vamos|aceito/i.test(m)).length,
    objecao: mensagensCliente.filter((m: string) => /mas|porem|não sei|talvez|depois|pensar|analisar/i.test(m)).length
  }

  // Criar resumo estruturado
  const resumo = {
    whatsapp: numeroWhatsapp,
    total_mensagens: mensagens.length,
    mensagens_do_cliente: mensagensCliente.length,
    
    periodo: {
      primeira_msg: new Date(mensagens[0].created_at).toLocaleString('pt-BR'),
      ultima_msg: new Date(mensagens[mensagens.length - 1].created_at).toLocaleString('pt-BR')
    },

    sinais_identificados: {
      perguntas_sobre_preco: palavrasChave.preco > 0 ? `✅ Sim (${palavrasChave.preco} menções)` : '❌ Não identificado',
      demonstra_urgencia: palavrasChave.urgencia > 0 ? `✅ Sim (${palavrasChave.urgencia} menções)` : '❌ Não identificado',
      fez_perguntas: palavrasChave.duvidas > 0 ? `✅ Sim (${palavrasChave.duvidas} perguntas)` : '❌ Não identificado',
      demonstra_interesse: palavrasChave.interesse > 0 ? `✅ Sim (${palavrasChave.interesse} sinais)` : '❌ Não identificado',
      levantou_objecoes: palavrasChave.objecao > 0 ? `⚠️ Sim (${palavrasChave.objecao} sinais)` : '✅ Nenhuma identificada'
    },

    ultimas_mensagens_cliente: mensagensCliente.slice(-5).map((m: string) => m.substring(0, 200)),

    recomendacao: gerarRecomendacao(palavrasChave)
  }

  return {
    sucesso: true,
    resumo,
    instrucao: 'Use este resumo para personalizar a proposta comercial com base no comportamento real do cliente.'
  }
}

function gerarRecomendacao(palavras: Record<string, number>): string {
  const recs: string[] = []

  if (palavras.preco > 2) {
    recs.push('Cliente sensível a preço - destaque ROI e condições especiais')
  }
  if (palavras.urgencia > 1) {
    recs.push('Cliente demonstra urgência - ofereça implementação rápida')
  }
  if (palavras.objecao > 2) {
    recs.push('Cliente tem objeções - aborde-as diretamente na proposta')
  }
  if (palavras.interesse > 2) {
    recs.push('Cliente demonstra forte interesse - seja direto no fechamento')
  }
  if (palavras.duvidas > 3) {
    recs.push('Cliente tem muitas dúvidas - inclua seção FAQ na proposta')
  }

  return recs.length > 0 ? recs.join('; ') : 'Conversa ainda em fase inicial - explore mais as necessidades'
}

// ============================================================================
// BANT Qualification Tools (v99)
// ============================================================================

async function atualizarBant(ctx: ToolContext, args: Record<string, unknown>) {
  const leadId = args.lead_id as string
  const bantType = args.bant_type as string
  const confirmed = args.confirmed as boolean
  const value = args.value as string | undefined
  const notes = args.notes as string | undefined

  if (!leadId || !bantType) {
    return { error: 'lead_id e bant_type são obrigatórios' }
  }

  const bantField = `bant_${bantType}` as string
  const bantValue = {
    confirmed,
    value: value || null,
    notes: notes || null,
    updated_at: new Date().toISOString()
  }

  const { data, error } = await ctx.clientSupabase
    .from('crm_leads')
    .update({ [bantField]: bantValue })
    .eq('id', leadId)
    .eq('organization_id', ctx.clientOrgId)
    .select('id, name, bant_budget, bant_authority, bant_need, bant_timeline, bant_score')
    .single()

  if (error) return { error: `Erro ao atualizar BANT: ${error.message}` }
  if (!data) return { error: 'Lead não encontrado' }

  const bantLabels: Record<string, string> = {
    budget: 'Orçamento',
    authority: 'Autoridade',
    need: 'Necessidade',
    timeline: 'Prazo'
  }

  return {
    sucesso: true,
    lead: {
      id: data.id,
      nome: data.name,
      bant_score: data.bant_score,
      qualification_level: data.bant_score >= 3 ? 'Quente 🔥' : data.bant_score >= 2 ? 'Morno 🌡️' : 'Frio ❄️'
    },
    campo_atualizado: bantLabels[bantType] || bantType,
    confirmado: confirmed,
    valor: value,
    mensagem: `${bantLabels[bantType]} ${confirmed ? 'confirmado' : 'não confirmado'}. BANT Score: ${data.bant_score}/4`
  }
}

async function analisarBantPipeline(ctx: ToolContext, args: Record<string, unknown>) {
  const periodoDias = (args.periodo_dias as number) || 30
  const estagioFiltro = args.estagio as string | undefined

  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodoDias)

  let query = ctx.clientSupabase
    .from('crm_leads')
    .select('id, name, stage, value, bant_score, bant_budget, bant_authority, bant_need, bant_timeline, converted_client_id, created_at')
    .eq('organization_id', ctx.clientOrgId)
    .gte('created_at', dataInicio.toISOString())

  if (estagioFiltro) query = query.eq('stage', estagioFiltro)

  const { data: leads, error } = await query

  if (error) return { error: `Erro ao buscar leads: ${error.message}` }

  // Agrupar por score
  const porScore: Record<string, { count: number; value: number; converted: number }> = {
    'Quente (3-4)': { count: 0, value: 0, converted: 0 },
    'Morno (2)': { count: 0, value: 0, converted: 0 },
    'Frio (0-1)': { count: 0, value: 0, converted: 0 }
  }

  // Agrupar por estágio
  const porEstagio: Record<string, { count: number; avgBant: number; totalBant: number }> = {}

  // Análise de critérios BANT
  const criterios = {
    budget_confirmado: 0,
    authority_confirmado: 0,
    need_confirmado: 0,
    timeline_confirmado: 0
  }

  for (const lead of leads || []) {
    const score = lead.bant_score || 0
    const stage = lead.stage || 'Sem estágio'
    const value = lead.value || 0
    const converted = lead.converted_client_id ? 1 : 0

    // Por score
    if (score >= 3) {
      porScore['Quente (3-4)'].count++
      porScore['Quente (3-4)'].value += value
      porScore['Quente (3-4)'].converted += converted
    } else if (score === 2) {
      porScore['Morno (2)'].count++
      porScore['Morno (2)'].value += value
      porScore['Morno (2)'].converted += converted
    } else {
      porScore['Frio (0-1)'].count++
      porScore['Frio (0-1)'].value += value
      porScore['Frio (0-1)'].converted += converted
    }

    // Por estágio
    if (!porEstagio[stage]) {
      porEstagio[stage] = { count: 0, avgBant: 0, totalBant: 0 }
    }
    porEstagio[stage].count++
    porEstagio[stage].totalBant += score

    // Critérios
    if (lead.bant_budget?.confirmed) criterios.budget_confirmado++
    if (lead.bant_authority?.confirmed) criterios.authority_confirmado++
    if (lead.bant_need?.confirmed) criterios.need_confirmado++
    if (lead.bant_timeline?.confirmed) criterios.timeline_confirmado++
  }

  // Calcular médias
  for (const stage of Object.keys(porEstagio)) {
    const s = porEstagio[stage]
    s.avgBant = s.count > 0 ? Math.round((s.totalBant / s.count) * 10) / 10 : 0
  }

  // Taxas de conversão por score
  const taxasConversao = Object.entries(porScore).map(([nivel, data]) => ({
    nivel,
    leads: data.count,
    valor_pipeline: data.value,
    convertidos: data.converted,
    taxa_conversao: data.count > 0 ? `${Math.round((data.converted / data.count) * 100)}%` : '0%'
  }))

  const totalLeads = leads?.length || 0

  return {
    periodo_dias: periodoDias,
    total_leads: totalLeads,
    
    distribuicao_por_score: taxasConversao,
    
    bant_por_estagio: Object.entries(porEstagio).map(([stage, data]) => ({
      estagio: stage,
      leads: data.count,
      bant_medio: data.avgBant
    })).sort((a, b) => b.bant_medio - a.bant_medio),
    
    criterios_confirmados: {
      budget: `${criterios.budget_confirmado}/${totalLeads} (${totalLeads > 0 ? Math.round((criterios.budget_confirmado / totalLeads) * 100) : 0}%)`,
      authority: `${criterios.authority_confirmado}/${totalLeads} (${totalLeads > 0 ? Math.round((criterios.authority_confirmado / totalLeads) * 100) : 0}%)`,
      need: `${criterios.need_confirmado}/${totalLeads} (${totalLeads > 0 ? Math.round((criterios.need_confirmado / totalLeads) * 100) : 0}%)`,
      timeline: `${criterios.timeline_confirmado}/${totalLeads} (${totalLeads > 0 ? Math.round((criterios.timeline_confirmado / totalLeads) * 100) : 0}%)`
    },
    
    insight: porScore['Quente (3-4)'].count > 0
      ? `🔥 ${porScore['Quente (3-4)'].count} leads quentes com R$ ${porScore['Quente (3-4)'].value.toLocaleString('pt-BR')} em pipeline - priorize estes!`
      : '❄️ Nenhum lead com BANT completo (3-4). Foque em qualificação antes de avançar.'
  }
}

async function atualizarObjecao(ctx: ToolContext, args: Record<string, unknown>) {
  const leadId = args.lead_id as string
  const objectionType = args.objection_type as string
  const objectionDetails = args.objection_details as string | undefined

  if (!leadId || !objectionType) {
    return { error: 'lead_id e objection_type são obrigatórios' }
  }

  const updateData: any = { objection_type: objectionType }
  if (objectionDetails) updateData.objection_details = objectionDetails

  const { data, error } = await ctx.clientSupabase
    .from('crm_leads')
    .update(updateData)
    .eq('id', leadId)
    .eq('organization_id', ctx.clientOrgId)
    .select('id, name, objection_type, objection_details')
    .single()

  if (error) return { error: `Erro ao atualizar objeção: ${error.message}` }
  if (!data) return { error: 'Lead não encontrado' }

  return {
    sucesso: true,
    lead: data,
    mensagem: `Objeção "${objectionType}" registrada para ${data.name}`
  }
}

async function gerenciarDecisionMap(ctx: ToolContext, args: Record<string, unknown>) {
  const leadId = args.lead_id as string
  const action = args.action as string
  const stakeholderName = args.stakeholder_name as string | undefined
  const stakeholderRole = args.stakeholder_role as string | undefined
  const influence = args.influence as string | undefined
  const status = args.status as string | undefined
  const notes = args.notes as string | undefined

  if (!leadId || !action) {
    return { error: 'lead_id e action são obrigatórios' }
  }

  // Buscar decision_map atual
  const { data: lead, error: fetchError } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, name, decision_map')
    .eq('id', leadId)
    .eq('organization_id', ctx.clientOrgId)
    .single()

  if (fetchError || !lead) return { error: 'Lead não encontrado' }

  let decisionMap: any[] = lead.decision_map || []

  if (action === 'list') {
    return {
      lead_id: leadId,
      lead_nome: lead.name,
      total_stakeholders: decisionMap.length,
      stakeholders: decisionMap
    }
  }

  if (!stakeholderName) {
    return { error: 'stakeholder_name é obrigatório para add/update/remove' }
  }

  if (action === 'add') {
    // Verificar se já existe
    const existing = decisionMap.find((s: any) => s.name.toLowerCase() === stakeholderName.toLowerCase())
    if (existing) {
      return { error: `Stakeholder "${stakeholderName}" já existe no mapa de decisão` }
    }

    decisionMap.push({
      id: crypto.randomUUID(),
      name: stakeholderName,
      role: stakeholderRole || null,
      influence: influence || 'influenciador',
      status: status || 'desconhecido',
      notes: notes || null,
      added_at: new Date().toISOString()
    })
  } else if (action === 'update') {
    const idx = decisionMap.findIndex((s: any) => s.name.toLowerCase() === stakeholderName.toLowerCase())
    if (idx < 0) {
      return { error: `Stakeholder "${stakeholderName}" não encontrado` }
    }
    decisionMap[idx] = {
      ...decisionMap[idx],
      ...(stakeholderRole && { role: stakeholderRole }),
      ...(influence && { influence }),
      ...(status && { status }),
      ...(notes && { notes }),
      updated_at: new Date().toISOString()
    }
  } else if (action === 'remove') {
    decisionMap = decisionMap.filter((s: any) => s.name.toLowerCase() !== stakeholderName.toLowerCase())
  }

  const { error: updateError } = await ctx.clientSupabase
    .from('crm_leads')
    .update({ decision_map: decisionMap })
    .eq('id', leadId)
    .eq('organization_id', ctx.clientOrgId)

  if (updateError) return { error: `Erro ao atualizar mapa de decisão: ${updateError.message}` }

  const actionLabels: Record<string, string> = {
    add: 'adicionado',
    update: 'atualizado',
    remove: 'removido'
  }

  return {
    sucesso: true,
    lead_id: leadId,
    lead_nome: lead.name,
    acao: actionLabels[action],
    stakeholder: stakeholderName,
    total_stakeholders: decisionMap.length,
    stakeholders: decisionMap
  }
}

// ============================================================================
// Goals Tools (v98)
// ============================================================================

async function criarMeta(ctx: ToolContext, args: Record<string, unknown>) {
  const metric = args.metric as string
  const targetValue = args.target_value as number
  const periodType = (args.period_type as string) || 'monthly'
  const periodStart = args.period_start as string
  const periodEnd = args.period_end as string

  if (!metric || targetValue === undefined || !periodStart || !periodEnd) {
    return { error: 'metric, target_value, period_start e period_end são obrigatórios' }
  }

  const { data, error } = await ctx.clientSupabase
    .from('crm_goals')
    .insert({
      organization_id: ctx.clientOrgId,
      metric,
      target_value: targetValue,
      current_value: 0,
      period_type: periodType,
      period_start: periodStart,
      period_end: periodEnd
    })
    .select()
    .single()

  if (error) return { error: `Erro ao criar meta: ${error.message}` }

  const metricLabels: Record<string, string> = {
    revenue: 'Receita',
    conversions: 'Conversões',
    leads_created: 'Novos Leads'
  }

  return {
    sucesso: true,
    meta: {
      id: data.id,
      tipo: metricLabels[metric] || metric,
      valor_alvo: targetValue,
      periodo: `${periodStart} até ${periodEnd}`,
      tipo_periodo: periodType
    },
    mensagem: `Meta de ${metricLabels[metric]} criada: ${metric === 'revenue' ? `R$ ${targetValue.toLocaleString('pt-BR')}` : targetValue}`
  }
}

async function analisarMetas(ctx: ToolContext, args: Record<string, unknown>) {
  const metricFilter = args.metric as string | undefined

  const today = new Date().toISOString().split('T')[0]

  let query = ctx.clientSupabase
    .from('crm_goals')
    .select('*')
    .eq('organization_id', ctx.clientOrgId)
    .lte('period_start', today)
    .gte('period_end', today)

  if (metricFilter) query = query.eq('metric', metricFilter)

  const { data: goals, error } = await query

  if (error) return { error: `Erro ao buscar metas: ${error.message}` }

  if (!goals || goals.length === 0) {
    return {
      mensagem: 'Nenhuma meta ativa encontrada para o período atual',
      sugestao: 'Use criar_meta para definir metas de receita, conversões ou novos leads'
    }
  }

  const metasAnalisadas = goals.map((g: any) => {
    const progressPercent = g.target_value > 0 ? Math.round((g.current_value / g.target_value) * 100) : 0
    
    // Calcular dias restantes e ritmo necessário
    const periodEnd = new Date(g.period_end)
    const periodStart = new Date(g.period_start)
    const hoje = new Date()
    const diasTotais = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
    const diasDecorridos = Math.ceil((hoje.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
    const diasRestantes = Math.max(0, Math.ceil((periodEnd.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)))
    
    const progressoEsperado = diasTotais > 0 ? Math.round((diasDecorridos / diasTotais) * 100) : 0
    const faltaAtigir = g.target_value - g.current_value
    const ritmoDiarioNecessario = diasRestantes > 0 ? faltaAtigir / diasRestantes : faltaAtigir

    const statusIcon = progressPercent >= progressoEsperado ? '🟢' : progressPercent >= progressoEsperado * 0.8 ? '🟡' : '🔴'

    return {
      id: g.id,
      metrica: g.metric === 'revenue' ? 'Receita' : g.metric === 'conversions' ? 'Conversões' : 'Novos Leads',
      valor_alvo: g.metric === 'revenue' ? `R$ ${g.target_value.toLocaleString('pt-BR')}` : g.target_value,
      valor_atual: g.metric === 'revenue' ? `R$ ${g.current_value.toLocaleString('pt-BR')}` : g.current_value,
      progresso: `${progressPercent}%`,
      progresso_esperado: `${progressoEsperado}%`,
      status: `${statusIcon} ${progressPercent >= 100 ? 'Meta atingida!' : progressPercent >= progressoEsperado ? 'No ritmo' : 'Abaixo do esperado'}`,
      dias_restantes: diasRestantes,
      falta_atingir: g.metric === 'revenue' ? `R$ ${faltaAtigir.toLocaleString('pt-BR')}` : faltaAtigir,
      ritmo_diario_necessario: g.metric === 'revenue' ? `R$ ${Math.ceil(ritmoDiarioNecessario).toLocaleString('pt-BR')}/dia` : `${Math.ceil(ritmoDiarioNecessario)}/dia`
    }
  })

  return {
    total_metas: goals.length,
    metas: metasAnalisadas,
    resumo: {
      no_ritmo: metasAnalisadas.filter((m: any) => m.status.includes('No ritmo') || m.status.includes('atingida')).length,
      abaixo: metasAnalisadas.filter((m: any) => m.status.includes('Abaixo')).length
    }
  }
}

// ============================================================================
// Proposals Tools (v102)
// ============================================================================

async function criarProposta(ctx: ToolContext, args: Record<string, unknown>) {
  const leadId = args.lead_id as string
  const title = (args.title as string) || 'Proposta Comercial'
  const items = args.items as any[]
  const subtotal = args.subtotal as number
  const discountPercent = (args.discount_percent as number) || 0
  const validityDays = (args.validity_days as number) || 30
  const notes = args.notes as string | undefined
  const internalNotes = args.internal_notes as string | undefined

  if (!leadId || !items || subtotal === undefined) {
    return { error: 'lead_id, items e subtotal são obrigatórios' }
  }

  // Verificar se lead existe
  const { data: lead, error: leadError } = await ctx.clientSupabase
    .from('crm_leads')
    .select('id, name, company_name')
    .eq('id', leadId)
    .eq('organization_id', ctx.clientOrgId)
    .single()

  if (leadError || !lead) return { error: 'Lead não encontrado' }

  const { data, error } = await ctx.clientSupabase
    .from('crm_proposals')
    .insert({
      organization_id: ctx.clientOrgId,
      lead_id: leadId,
      title,
      items,
      subtotal,
      discount_percent: discountPercent,
      validity_days: validityDays,
      notes: notes || null,
      internal_notes: internalNotes || null,
      status: 'draft'
    })
    .select()
    .single()

  if (error) return { error: `Erro ao criar proposta: ${error.message}` }

  return {
    sucesso: true,
    proposta: {
      id: data.id,
      numero: data.proposal_number,
      titulo: data.title,
      lead_nome: lead.name,
      empresa: lead.company_name,
      subtotal: `R$ ${subtotal.toLocaleString('pt-BR')}`,
      desconto: `${discountPercent}%`,
      total: `R$ ${data.total_value?.toLocaleString('pt-BR') || subtotal.toLocaleString('pt-BR')}`,
      validade: `${validityDays} dias`,
      expira_em: data.expires_at,
      status: 'Rascunho',
      share_token: data.share_token
    },
    proximos_passos: [
      '1. Revise a proposta gerada',
      '2. Use atualizar_status_proposta com status="sent" para marcar como enviada',
      '3. Compartilhe o link da proposta ou envie por WhatsApp/email'
    ]
  }
}

async function listarPropostas(ctx: ToolContext, args: Record<string, unknown>) {
  const leadId = args.lead_id as string | undefined
  const status = args.status as string | undefined
  const limite = (args.limite as number) || 20

  let query = ctx.clientSupabase
    .from('crm_proposals')
    .select(`
      id, lead_id, title, proposal_number, subtotal, discount_percent, total_value,
      status, validity_days, expires_at, sent_at, viewed_at, view_count,
      accepted_at, rejected_at, rejection_reason, created_at
    `)
    .eq('organization_id', ctx.clientOrgId)

  if (leadId) query = query.eq('lead_id', leadId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query.order('created_at', { ascending: false }).limit(limite)

  if (error) return { error: `Erro ao listar propostas: ${error.message}` }

  const statusLabels: Record<string, string> = {
    draft: '📝 Rascunho',
    sent: '📤 Enviada',
    viewed: '👁️ Visualizada',
    accepted: '✅ Aceita',
    rejected: '❌ Rejeitada',
    expired: '⏰ Expirada'
  }

  const propostas = (data || []).map((p: any) => ({
    id: p.id,
    numero: p.proposal_number,
    titulo: p.title,
    valor_total: `R$ ${p.total_value?.toLocaleString('pt-BR') || p.subtotal?.toLocaleString('pt-BR')}`,
    desconto: `${p.discount_percent || 0}%`,
    status: statusLabels[p.status] || p.status,
    visualizacoes: p.view_count || 0,
    enviada_em: p.sent_at ? new Date(p.sent_at).toLocaleString('pt-BR') : null,
    visualizada_em: p.viewed_at ? new Date(p.viewed_at).toLocaleString('pt-BR') : null,
    expira_em: p.expires_at ? new Date(p.expires_at).toLocaleDateString('pt-BR') : null,
    criada_em: new Date(p.created_at).toLocaleDateString('pt-BR')
  }))

  return {
    total: propostas.length,
    filtros: { lead_id: leadId, status },
    propostas
  }
}

async function atualizarStatusProposta(ctx: ToolContext, args: Record<string, unknown>) {
  const proposalId = args.proposal_id as string
  const status = args.status as string
  const sentVia = args.sent_via as string | undefined
  const rejectionReason = args.rejection_reason as string | undefined

  if (!proposalId || !status) {
    return { error: 'proposal_id e status são obrigatórios' }
  }

  const updateData: any = {
    status,
    updated_at: new Date().toISOString()
  }

  if (status === 'sent') {
    updateData.sent_at = new Date().toISOString()
    if (sentVia) updateData.sent_via = sentVia
  } else if (status === 'accepted') {
    updateData.accepted_at = new Date().toISOString()
  } else if (status === 'rejected') {
    updateData.rejected_at = new Date().toISOString()
    if (rejectionReason) updateData.rejection_reason = rejectionReason
  }

  const { data, error } = await ctx.clientSupabase
    .from('crm_proposals')
    .update(updateData)
    .eq('id', proposalId)
    .eq('organization_id', ctx.clientOrgId)
    .select('id, proposal_number, title, status, sent_at, accepted_at, rejected_at')
    .single()

  if (error) return { error: `Erro ao atualizar proposta: ${error.message}` }
  if (!data) return { error: 'Proposta não encontrada' }

  const statusLabels: Record<string, string> = {
    sent: '📤 Proposta marcada como enviada',
    accepted: '🎉 Proposta aceita pelo cliente!',
    rejected: '❌ Proposta rejeitada pelo cliente'
  }

  return {
    sucesso: true,
    proposta: {
      id: data.id,
      numero: data.proposal_number,
      titulo: data.title,
      status: data.status
    },
    mensagem: statusLabels[status] || `Status atualizado para ${status}`,
    proximo_passo: status === 'accepted' 
      ? 'Parabéns! Considere converter o lead em cliente usando a tool de conversão.'
      : status === 'rejected'
      ? 'Registre o motivo de perda no lead para análises futuras.'
      : 'Acompanhe se o cliente visualizou a proposta.'
  }
}

// ============================================================================
// Qualificação Completa para Proposal Writer
// ============================================================================

async function obterQualificacaoCompleta(ctx: ToolContext, args: Record<string, unknown>) {
  const leadId = args.lead_id as string
  const incluirHistoricoPropostas = args.incluir_historico_propostas !== false // default true

  if (!leadId) {
    return { error: 'lead_id é obrigatório' }
  }

  // 1. Buscar dados completos do lead com qualificação
  const { data: lead, error: leadError } = await ctx.clientSupabase
    .from('crm_leads')
    .select(`
      id, name, email, whatsapp, company_name, description, stage, value, priority,
      source, canal, created_at, stage_entered_at, updated_at,
      bant_budget, bant_authority, bant_need, bant_timeline, bant_score,
      objection_type, objection_details, decision_map
    `)
    .eq('id', leadId)
    .eq('organization_id', ctx.clientOrgId)
    .single()

  if (leadError || !lead) {
    return { error: `Lead não encontrado: ${leadError?.message || 'ID inválido'}` }
  }

  // 2. Buscar propostas anteriores (se solicitado)
  let propostasAnteriores: any[] = []
  if (incluirHistoricoPropostas) {
    const { data: propostas } = await ctx.clientSupabase
      .from('crm_proposals')
      .select('id, proposal_number, title, total_value, status, sent_at, accepted_at, rejected_at, rejection_reason, view_count, created_at')
      .eq('lead_id', leadId)
      .eq('organization_id', ctx.clientOrgId)
      .order('created_at', { ascending: false })
      .limit(5)

    propostasAnteriores = propostas || []
  }

  // 3. Buscar notas e atividades relevantes para qualificação
  const { data: atividades } = await ctx.clientSupabase
    .from('crm_activities')
    .select('type, content, created_at')
    .eq('lead_id', leadId)
    .eq('organization_id', ctx.clientOrgId)
    .order('created_at', { ascending: false })
    .limit(15)

  // 4. Interpretar BANT Score
  const bantScore = lead.bant_score || 0
  const interpretacaoBant = 
    bantScore === 0 ? { nivel: 'Não Qualificado', emoji: '❄️', descricao: 'Nenhum critério BANT confirmado. Lead frio.' } :
    bantScore === 1 ? { nivel: 'Frio', emoji: '🧊', descricao: 'Apenas 1 critério confirmado. Necessita mais qualificação.' } :
    bantScore === 2 ? { nivel: 'Morno', emoji: '🌡️', descricao: '2 critérios confirmados. Potencial moderado.' } :
    bantScore === 3 ? { nivel: 'Quente', emoji: '🔥', descricao: '3 critérios confirmados. Lead promissor!' } :
    { nivel: 'Muito Quente', emoji: '🔥🔥', descricao: 'Todos os 4 critérios confirmados. Prioridade máxima!' }

  // 5. Montar detalhes BANT estruturados
  const bantDetalhado = {
    budget: {
      confirmado: lead.bant_budget?.confirmed || false,
      valor: lead.bant_budget?.value || null,
      notas: lead.bant_budget?.notes || null,
      interpretacao: lead.bant_budget?.confirmed 
        ? `✅ Orçamento confirmado${lead.bant_budget?.value ? `: ${lead.bant_budget.value}` : ''}`
        : '❓ Orçamento não confirmado'
    },
    authority: {
      confirmado: lead.bant_authority?.confirmed || false,
      cargo: lead.bant_authority?.value || null,
      notas: lead.bant_authority?.notes || null,
      interpretacao: lead.bant_authority?.confirmed
        ? `✅ ${lead.name} é decisor${lead.bant_authority?.value ? ` (${lead.bant_authority.value})` : ''}`
        : '❓ Verificar se é o decisor ou influenciador'
    },
    need: {
      confirmado: lead.bant_need?.confirmed || false,
      necessidade: lead.bant_need?.value || null,
      notas: lead.bant_need?.notes || null,
      interpretacao: lead.bant_need?.confirmed
        ? `✅ Necessidade identificada${lead.bant_need?.value ? `: ${lead.bant_need.value}` : ''}`
        : '❓ Necessidade ainda não está clara'
    },
    timeline: {
      confirmado: lead.bant_timeline?.confirmed || false,
      prazo: lead.bant_timeline?.value || null,
      notas: lead.bant_timeline?.notes || null,
      interpretacao: lead.bant_timeline?.confirmed
        ? `✅ Tem urgência${lead.bant_timeline?.value ? `: ${lead.bant_timeline.value}` : ''}`
        : '❓ Sem prazo definido'
    }
  }

  // 6. Processar Decision Map (Stakeholders)
  const decisionMap = lead.decision_map || []
  const stakeholdersFormatados = decisionMap.map((s: any) => ({
    nome: s.name,
    cargo: s.role,
    tipo: s.type, // decision_maker, influencer, user, gatekeeper
    tipoLabel: 
      s.type === 'decision_maker' ? '👔 Decisor' :
      s.type === 'influencer' ? '💡 Influenciador' :
      s.type === 'user' ? '👤 Usuário Final' :
      s.type === 'gatekeeper' ? '🚪 Gatekeeper' : '❓ Outro',
    contato: s.contact || null,
    notas: s.notes || null
  }))

  // 7. Processar Objeções
  const objecaoLabels: Record<string, string> = {
    'preco': '💰 Preço muito alto',
    'timing': '⏰ Momento não é adequado',
    'concorrente': '🏆 Preferiu concorrente',
    'fit': '🎯 Não atende às necessidades',
    'budget': '💳 Sem orçamento aprovado',
    'autoridade': '👤 Precisa de aprovação',
    'urgencia': '⚡ Sem urgência',
    'outro': '📝 Outro motivo'
  }
  const objecao = lead.objection_type ? {
    tipo: lead.objection_type,
    detalhes: lead.objection_details || null,
    tipoLabel: objecaoLabels[lead.objection_type as string] || lead.objection_type
  } : null

  // 8. Histórico de propostas formatado
  const statusPropostaLabels: Record<string, string> = {
    'draft': '📝 Rascunho',
    'sent': '📤 Enviada',
    'viewed': '👁️ Visualizada',
    'accepted': '✅ Aceita',
    'rejected': '❌ Rejeitada',
    'expired': '⏰ Expirada'
  }
  const historicoPropostas = propostasAnteriores.map((p: any) => ({
    numero: p.proposal_number,
    titulo: p.title,
    valor: `R$ ${(p.total_value || 0).toLocaleString('pt-BR')}`,
    status: p.status,
    statusLabel: statusPropostaLabels[p.status as string] || p.status,
    visualizacoes: p.view_count || 0,
    motivoRejeicao: p.rejection_reason || null,
    data: new Date(p.created_at).toLocaleDateString('pt-BR')
  }))

  // 9. Gerar recomendações para a proposta
  const recomendacoes: string[] = []
  
  if (bantScore >= 3) {
    recomendacoes.push('🎯 Lead bem qualificado! Proposta assertiva e objetiva.')
  } else if (bantScore === 2) {
    recomendacoes.push('⚠️ Qualificação moderada. Inclua mais detalhes sobre benefícios.')
  } else {
    recomendacoes.push('❄️ Lead frio. Considere uma proposta mais consultiva, focada em educação.')
  }

  if (bantDetalhado.budget.confirmado && lead.bant_budget?.value) {
    recomendacoes.push(`💰 Orçamento conhecido (${lead.bant_budget.value}). Adeque a proposta a esse valor.`)
  }

  if (bantDetalhado.timeline.confirmado && lead.bant_timeline?.value) {
    recomendacoes.push(`⏰ Urgência: ${lead.bant_timeline.value}. Destaque prazos e entrega rápida.`)
  }

  if (stakeholdersFormatados.length > 1) {
    recomendacoes.push(`👥 ${stakeholdersFormatados.length} stakeholders envolvidos. Considere preparar versões focadas.`)
  }

  if (objecao) {
    recomendacoes.push(`⚠️ Objeção registrada: ${objecao.tipoLabel}. Aborde esse ponto na proposta.`)
  }

  if (historicoPropostas.length > 0) {
    const rejeitadas = historicoPropostas.filter((p: any) => p.status === 'rejected')
    if (rejeitadas.length > 0) {
      recomendacoes.push(`📋 ${rejeitadas.length} proposta(s) rejeitada(s) anteriormente. Revise motivos e ajuste abordagem.`)
    }
  }

  // 10. Calcular dias no pipeline
  const diasNoPipeline = Math.floor(
    (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )

  return {
    sucesso: true,
    lead: {
      id: lead.id,
      nome: lead.name,
      empresa: lead.company_name || 'Não informada',
      email: lead.email,
      whatsapp: lead.whatsapp,
      estagio: lead.stage,
      valor_estimado: lead.value ? `R$ ${lead.value.toLocaleString('pt-BR')}` : 'Não estimado',
      prioridade: lead.priority,
      canal_origem: lead.canal || lead.source || 'Não informado',
      descricao: lead.description || 'Não informada',
      dias_no_pipeline: diasNoPipeline
    },
    
    qualificacao_bant: {
      score: bantScore,
      max_score: 4,
      interpretacao: interpretacaoBant,
      detalhes: bantDetalhado
    },

    objecao_registrada: objecao,

    mapa_decisao: {
      total_stakeholders: stakeholdersFormatados.length,
      decisores: stakeholdersFormatados.filter((s: any) => s.tipo === 'decision_maker'),
      influenciadores: stakeholdersFormatados.filter((s: any) => s.tipo === 'influencer'),
      todos: stakeholdersFormatados
    },

    historico_propostas: {
      total: historicoPropostas.length,
      propostas: historicoPropostas
    },

    notas_recentes: (atividades || [])
      .filter((a: any) => ['note', 'call', 'meeting'].includes(a.type))
      .slice(0, 5)
      .map((a: any) => ({
        tipo: a.type,
        conteudo: a.content,
        data: new Date(a.created_at).toLocaleDateString('pt-BR')
      })),

    recomendacoes_proposta: recomendacoes,

    resumo_executivo: `
📊 **Resumo de Qualificação - ${lead.name}${lead.company_name ? ` (${lead.company_name})` : ''}**

${interpretacaoBant.emoji} **BANT Score: ${bantScore}/4** - ${interpretacaoBant.nivel}
- Budget: ${bantDetalhado.budget.interpretacao}
- Authority: ${bantDetalhado.authority.interpretacao}
- Need: ${bantDetalhado.need.interpretacao}
- Timeline: ${bantDetalhado.timeline.interpretacao}

${stakeholdersFormatados.length > 0 ? `👥 **Stakeholders:** ${stakeholdersFormatados.map((s: any) => `${s.nome} (${s.tipoLabel})`).join(', ')}` : ''}
${objecao ? `⚠️ **Objeção:** ${objecao.tipoLabel}${objecao.detalhes ? ` - ${objecao.detalhes}` : ''}` : ''}
${historicoPropostas.length > 0 ? `📋 **Propostas anteriores:** ${historicoPropostas.length} (${historicoPropostas.map((p: any) => p.statusLabel).join(', ')})` : ''}

🎯 **Recomendações:** ${recomendacoes.join(' | ')}
    `.trim()
  }
}

// ============================================================================
// Main dispatcher
// ============================================================================

export async function callCrmMCPTool(
  toolName: string,
  args: Record<string, unknown>,
  authToken: string
): Promise<unknown> {
  try {
    console.log(`[crm-mcp] Executing tool: ${toolName}`, JSON.stringify(args))
    
    const ctx = await getToolContext(authToken)
    
    switch (toolName) {
      case 'analisar_pipeline':
        return await analisarPipeline(ctx, args)
      case 'sugerir_acao':
        return await sugerirAcao(ctx, args)
      case 'listar_leads_risco':
        return await listarLeadsRisco(ctx, args)
      case 'buscar_lead':
        return await buscarLead(ctx, args)
      case 'listar_leads':
        return await listarLeads(ctx, args)
      case 'atualizar_lead':
        return await atualizarLead(ctx, args)
      case 'adicionar_nota':
        return await adicionarNota(ctx, args)
      case 'obter_metas':
        return await obterMetas(ctx)
      case 'gerar_resumo_diario':
        return await gerarResumoDiario(ctx)
      case 'listar_templates':
        return await listarTemplates(ctx, args)
      case 'sugerir_template':
        return await sugerirTemplate(ctx, args)
      case 'calcular_forecast':
        return await calcularForecast(ctx, args)
      case 'analisar_objecoes':
        return await analisarObjecoes(ctx, args)
      case 'buscar_notas_padrao':
        return await buscarNotasPadrao(ctx, args)
      // Tools estratégicas para CRO/CEO
      case 'analisar_receita':
        return await analisarReceita(ctx, args)
      case 'comparar_periodos':
        return await compararPeriodos(ctx, args)
      case 'analisar_conversao_funil':
        return await analisarConversaoFunil(ctx, args)
      case 'analisar_canais':
        return await analisarCanais(ctx, args)
      case 'calcular_velocidade_vendas':
        return await calcularVelocidadeVendas(ctx, args)
      case 'analisar_perdas':
        return await analisarPerdas(ctx, args)
      case 'gerar_relatorio_executivo':
        return await gerarRelatorioExecutivo(ctx, args)
      case 'analisar_ticket_medio':
        return await analisarTicketMedio(ctx, args)
      case 'projetar_meta':
        return await projetarMeta(ctx)
      // Tools específicas CEO
      case 'analisar_cobertura_pipeline':
        return await analisarCoberturaPipeline(ctx, args)
      case 'top_oportunidades':
        return await topOportunidades(ctx, args)
      case 'receita_por_segmento':
        return await receitaPorSegmento(ctx, args)
      case 'saude_base_clientes':
        return await saudeBaseClientes(ctx, args)
      // Tools específicas CRO
      case 'performance_vendedores':
        return await performanceVendedores(ctx, args)
      case 'atividades_time':
        return await atividadesTime(ctx, args)
      case 'tempo_por_estagio':
        return await tempoPorEstagio(ctx, args)
      case 'motivo_perda_detalhado':
        return await motivoPerdaDetalhado(ctx, args)
      case 'qualidade_leads_por_origem':
        return await qualidadeLeadsPorOrigem(ctx, args)
      case 'sla_tempo_resposta':
        return await slaTempoResposta(ctx, args)
      case 'uso_crm':
        return await usoCrm(ctx, args)
      case 'forecast_detalhado':
        return await forecastDetalhado(ctx, args)
      case 'dashboard_ceo':
        return await dashboardCeo(ctx, args)
      case 'dashboard_cro':
        return await dashboardCro(ctx, args)
      // Tool para propostas com IA
      case 'gerar_contexto_proposta':
        return await gerarContextoProposta(ctx, args)
      // Tools para repositório de mensagens (histórico de conversas)
      case 'obter_historico_conversa':
        return await obterHistoricoConversa(ctx, args)
      case 'buscar_conversas_lead':
        return await buscarConversasLead(ctx, args)
      case 'buscar_mensagens_por_texto':
        return await buscarMensagensPorTexto(ctx, args)
      case 'resumir_conversa':
        return await resumirConversa(ctx, args)
      // Tools de qualificação BANT (v99)
      case 'atualizar_bant':
        return await atualizarBant(ctx, args)
      case 'analisar_bant_pipeline':
        return await analisarBantPipeline(ctx, args)
      case 'atualizar_objecao':
        return await atualizarObjecao(ctx, args)
      case 'gerenciar_decision_map':
        return await gerenciarDecisionMap(ctx, args)
      // Tools de metas (v98)
      case 'criar_meta':
        return await criarMeta(ctx, args)
      case 'analisar_metas':
        return await analisarMetas(ctx, args)
      // Tools de propostas (v102)
      case 'criar_proposta':
        return await criarProposta(ctx, args)
      case 'listar_propostas':
        return await listarPropostas(ctx, args)
      case 'atualizar_status_proposta':
        return await atualizarStatusProposta(ctx, args)
      case 'obter_qualificacao_completa':
        return await obterQualificacaoCompleta(ctx, args)
      default:
        return { error: `Tool desconhecida: ${toolName}` }
    }
  } catch (error) {
    console.error(`[crm-mcp] Error in ${toolName}:`, error)
    return { error: error instanceof Error ? error.message : 'Erro desconhecido' }
  }
}
