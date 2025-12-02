import { SUPABASE_URL } from './supabase'

// ============================================================================
// MCP Tool definitions for OpenAI function calling
// VERSÃO 2.0 - Otimizado para criação de agentes de IA de excelência
// ============================================================================

export const MCP_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'listar_clientes_automacao',
      description: 'Lista todos os clientes de automação. CHAME SEM PARÂMETROS primeiro para ver todos. Só use filtros se o usuário pedir especificamente.',
      parameters: {
        type: 'object',
        properties: {
          status: { 
            type: 'string', 
            enum: ['active', 'onboarding', 'paused', 'churned'], 
            description: 'OPCIONAL - Só use se usuário pedir status específico' 
          },
          limite: { 
            type: 'number', 
            description: 'OPCIONAL - Padrão: 50' 
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'obter_cliente',
      description: 'Obtém detalhes de um cliente específico. REQUER cliente_id que é um UUID (formato: 123e4567-e89b-12d3-a456-426614174000). Use listar_clientes_automacao primeiro para obter IDs.',
      parameters: {
        type: 'object',
        properties: {
          cliente_id: { 
            type: 'string', 
            description: 'UUID do cliente. DEVE ser formato UUID válido (ex: 5a595c4a-bad7-45ee-9b7c-e39f6d8c52ec). NÃO é o nome da empresa.' 
          }
        },
        required: ['cliente_id']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'listar_briefings',
      description: 'Lista briefings com informações de negócio, dores, objetivos, horários, preços, serviços. CHAME SEM PARÂMETROS para listar TODOS. EXTRAIA 100% das informações para o prompt: horários de funcionamento, lista de serviços/preços, promoções, regras, tom de voz, objeções comuns.',
      parameters: {
        type: 'object',
        properties: {
          cliente_id: { 
            type: 'string', 
            description: 'OPCIONAL - UUID do cliente para filtrar. Use SOMENTE se tiver o UUID do cliente.' 
          },
          tipo: { 
            type: 'string', 
            enum: ['general', 'project', 'pain_points', 'goals', 'requirements'],
            description: 'OPCIONAL - Tipo de briefing. NÃO USE este filtro a menos que usuário peça tipo específico.'
          },
          limite: { 
            type: 'number',
            description: 'OPCIONAL - Padrão: 50'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'listar_contratos',
      description: 'Lista contratos com valores e ferramentas MCP incluídas. CHAME SEM PARÂMETROS para listar todos. Útil para saber quais tools o agente terá acesso.',
      parameters: {
        type: 'object',
        properties: {
          cliente_id: { 
            type: 'string', 
            description: 'OPCIONAL - UUID do cliente para filtrar' 
          },
          status: { 
            type: 'string', 
            enum: ['draft', 'active', 'expired', 'cancelled'],
            description: 'OPCIONAL - Status do contrato'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'listar_processos',
      description: 'Lista processos de implementação. CHAME SEM PARÂMETROS para listar todos.',
      parameters: {
        type: 'object',
        properties: {
          cliente_id: { 
            type: 'string',
            description: 'OPCIONAL - UUID do cliente para filtrar'
          },
          tipo: { 
            type: 'string', 
            enum: ['onboarding', 'implementation', 'monitoring', 'support'],
            description: 'OPCIONAL - Tipo de processo'
          },
          status: { 
            type: 'string', 
            enum: ['pending', 'in_progress', 'completed', 'blocked', 'cancelled'],
            description: 'OPCIONAL - Status do processo'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'listar_transcricoes',
      description: 'Lista transcrições de reuniões. CHAME SEM PARÂMETROS para listar todas. Útil para entender contexto de conversas anteriores com o cliente.',
      parameters: {
        type: 'object',
        properties: {
          cliente_id: { 
            type: 'string',
            description: 'OPCIONAL - UUID do cliente para filtrar'
          },
          limite: { 
            type: 'number',
            description: 'OPCIONAL - Padrão: 20'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'listar_feedbacks',
      description: 'Lista feedbacks de clientes. CHAME SEM PARÂMETROS para listar todos.',
      parameters: {
        type: 'object',
        properties: {
          cliente_id: { 
            type: 'string',
            description: 'OPCIONAL - UUID do cliente para filtrar'
          },
          tipo: { 
            type: 'string', 
            enum: ['general', 'satisfaction', 'feature_request', 'issue', 'praise'],
            description: 'OPCIONAL - Tipo de feedback'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'listar_documentos',
      description: 'Lista documentos como planilhas de produtos, FAQs, propostas. CHAME SEM PARÂMETROS para listar todos. Útil para obter lista de serviços e preços.',
      parameters: {
        type: 'object',
        properties: {
          cliente_id: { 
            type: 'string',
            description: 'OPCIONAL - UUID do cliente para filtrar'
          },
          tipo: { 
            type: 'string', 
            enum: ['product_sheet', 'lead_sheet', 'qna_sheet', 'contract', 'proposal', 'other'],
            description: 'OPCIONAL - Tipo de documento'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'obter_tools_disponiveis',
      description: 'Lista TODAS as ferramentas MCP do TomikOS (41 tools) para incluir em prompts de agentes. Retorna documentação completa de cada tool com parâmetros e exemplos de uso.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'prompt_finalizado',
      description: 'OBRIGATÓRIO: Chame APÓS gerar o prompt completo (dentro do artifact :::prompt). Ativa os botões de instalação. Só chame quando o prompt estiver 100% pronto.',
      parameters: {
        type: 'object',
        properties: {
          titulo_prompt: { 
            type: 'string', 
            description: 'Nome do prompt gerado' 
          },
          resumo: { 
            type: 'string', 
            description: 'Resumo curto (1-2 frases) do que o agente faz' 
          }
        },
        required: ['titulo_prompt', 'resumo']
      }
    }
  }
]

// ============================================================================
// DOCUMENTAÇÃO DAS TOOLS DO TENANT-MCP (Para referência do Prompt Creator)
// ============================================================================

export const TENANT_MCP_TOOLS_DOCUMENTATION = `
## 🔧 FERRAMENTAS MCP DO TENANT (41 Tools)

### 📊 CRM - GESTÃO DE LEADS (7 tools)

| Tool | Descrição | Parâmetros Principais |
|------|-----------|----------------------|
| \`list_leads\` | Lista leads com filtros | stage, search, limit, offset |
| \`create_lead\` | Cria novo lead | name*, whatsapp, email, stage, value, source, canal |
| \`update_lead\` | Atualiza lead existente | lead_id*, name, email, stage, value, priority, assigned_to |
| \`delete_lead\` | Remove lead (soft delete) | lead_id* |
| \`get_lead\` | Busca lead por ID | lead_id* |
| \`list_clients\` | Lista clientes | search, limit, offset |
| \`list_crm_stages\` | Lista estágios do funil | - |

### 📅 AGENDA (5 tools)

| Tool | Descrição | Parâmetros Principais |
|------|-----------|----------------------|
| \`list_appointments\` | Lista agendamentos | collaborator_id, client_id, lead_id, date_from, date_to, status |
| \`create_appointment\` | Cria agendamento | datetime*, collaborator_id, client_id/lead_id, duration_minutes, tipo |
| \`update_appointment\` | Atualiza agendamento | appointment_id*, datetime, status, anotacoes |
| \`delete_appointment\` | Cancela agendamento | appointment_id* |
| \`get_collaborator_schedule\` | Agenda de colaborador | collaborator_id*, date* |

### 💰 FINANÇAS (5 tools)

| Tool | Descrição | Parâmetros Principais |
|------|-----------|----------------------|
| \`list_incomes\` | Lista receitas | date_from, date_to, cliente_id, categoria |
| \`create_income\` | Registra receita | valor*, descricao*, categoria*, cliente_id, data_entrada |
| \`list_expenses\` | Lista despesas | date_from, date_to, categoria |
| \`create_expense\` | Registra despesa | valor*, descricao*, categoria*, data_saida |
| \`get_financial_summary\` | Resumo financeiro | date_from*, date_to* |

### 💬 MENSAGENS (3 tools)

| Tool | Descrição | Parâmetros Principais |
|------|-----------|----------------------|
| \`list_messages\` | Histórico de mensagens | client_id, lead_id, limit |
| \`insert_user_message\` | Registra msg do cliente | content*, client_id/lead_id, channel |
| \`insert_ai_response\` | Registra resposta IA | content*, client_id/lead_id, channel |

### 🔍 CONSULTAS (2 tools)

| Tool | Descrição | Parâmetros Principais |
|------|-----------|----------------------|
| \`list_products\` | Lista produtos/serviços | search, tipo, ativo |
| \`list_collaborators\` | Lista colaboradores | active_only |

### 👤 CLIENTES (4 tools)

| Tool | Descrição | Parâmetros Principais |
|------|-----------|----------------------|
| \`create_client\` | Cadastra cliente | nome*, telefone*, email, nascimento, endereco |
| \`update_client\` | Atualiza cliente | client_id*, nome, email, telefone, endereco |
| \`convert_lead_to_client\` | Converte lead em cliente | lead_id*, telefone* |
| \`list_payments\` | Lista pagamentos | client_id, status, date_from, date_to |

### 🎯 QUALIFICAÇÃO BANT (4 tools)

| Tool | Descrição | Parâmetros Principais |
|------|-----------|----------------------|
| \`update_bant\` | Atualiza BANT do lead | lead_id*, bant_type* (budget/authority/need/timeline), confirmed*, value, notes |
| \`get_qualified_leads\` | Leads por score BANT | min_score, max_score, stage, limit |
| \`update_objection\` | Registra objeção | lead_id*, objection_type* (preço/timing/concorrente/autoridade/confiança/funcionalidades), objection_details |
| \`update_decision_map\` | Mapa de stakeholders | lead_id*, action* (add/update/remove), stakeholder* (name, role, influence, status, notes) |

**Score BANT:**
- 0-1 = Frio ❄️ (Foco em qualificação)
- 2 = Morno 🌡️ (Foco em agendamento)
- 3-4 = Quente 🔥 (Foco em fechamento)

**Tipos de Influência:**
- decisor: Quem aprova a compra
- influenciador: Quem influencia a decisão
- usuario: Quem vai usar o produto/serviço
- bloqueador: Quem pode vetar

### 🎯 METAS (3 tools)

| Tool | Descrição | Parâmetros Principais |
|------|-----------|----------------------|
| \`list_goals\` | Lista metas | metric, period_type, active_only |
| \`create_goal\` | Cria meta | metric* (revenue/conversions/leads_created), target_value*, period_start*, period_end* |
| \`update_goal\` | Atualiza meta | goal_id*, target_value, current_value |

### 📝 PROPOSTAS (4 tools)

| Tool | Descrição | Parâmetros Principais |
|------|-----------|----------------------|
| \`list_proposals\` | Lista propostas | lead_id, status, limit |
| \`create_proposal\` | Cria proposta | lead_id*, items*, subtotal*, title, discount_percent, validity_days |
| \`update_proposal_status\` | Atualiza status | proposal_id*, status* (sent/viewed/accepted/rejected), sent_via, rejection_reason |
| \`list_proposal_templates\` | Templates de proposta | active_only |

### 📨 TEMPLATES DE MENSAGEM (3 tools)

| Tool | Descrição | Parâmetros Principais |
|------|-----------|----------------------|
| \`list_message_templates\` | Lista templates | type (whatsapp/email), suggested_stage, active_only |
| \`record_template_usage\` | Registra uso | template_id*, lead_id*, channel* |
| \`mark_template_response\` | Marca resposta | usage_id* |

---

## 📋 EXEMPLOS DE USO DAS TOOLS

### Fluxo de Primeiro Contato
\`\`\`
1. list_leads { search: "[WhatsApp do lead]" }
   → Se não encontrar:
2. create_lead { name: "[Nome]", whatsapp: "[WhatsApp]", canal: "WhatsApp", source: "Site" }
\`\`\`

### Fluxo de Qualificação BANT
\`\`\`
1. update_bant { lead_id: "uuid", bant_type: "budget", confirmed: true, value: "R$ 5.000 - R$ 10.000" }
2. update_bant { lead_id: "uuid", bant_type: "authority", confirmed: true, value: "João Silva - Diretor" }
3. update_bant { lead_id: "uuid", bant_type: "need", confirmed: true, value: "Precisa aumentar vendas em 30%" }
4. update_bant { lead_id: "uuid", bant_type: "timeline", confirmed: true, value: "Próximos 2 meses" }
\`\`\`

### Fluxo de Agendamento
\`\`\`
1. get_collaborator_schedule { collaborator_id: "uuid", date: "2024-01-15" }
2. create_appointment { datetime: "2024-01-15T14:00:00", lead_id: "uuid", duration_minutes: 30 }
3. update_lead { lead_id: "uuid", stage: "Agendado" }
\`\`\`

### Fluxo de Objeção
\`\`\`
1. update_objection { lead_id: "uuid", objection_type: "preço", objection_details: "Cliente achou caro o plano Pro" }
\`\`\`

### Fluxo de Proposta
\`\`\`
1. list_products { tipo: "servico", ativo: true }
2. create_proposal { 
     lead_id: "uuid", 
     title: "Proposta Comercial - Plano Pro",
     items: [{ name: "Plano Pro", quantity: 1, unit_price: 997 }],
     subtotal: 997,
     discount_percent: 10,
     validity_days: 7
   }
3. update_proposal_status { proposal_id: "uuid", status: "sent", sent_via: "whatsapp" }
\`\`\`
`

// Call MCP tool via Edge Function
export async function callMCPTool(
  toolName: string,
  args: Record<string, unknown>,
  authToken: string
): Promise<unknown> {
  // Handle special tool that returns documentation
  if (toolName === 'obter_tools_disponiveis') {
    return {
      total_tools: 41,
      documentacao: TENANT_MCP_TOOLS_DOCUMENTATION,
      categorias: [
        { nome: 'CRM', tools: 7 },
        { nome: 'Agenda', tools: 5 },
        { nome: 'Finanças', tools: 5 },
        { nome: 'Mensagens', tools: 3 },
        { nome: 'Consultas', tools: 2 },
        { nome: 'Clientes', tools: 4 },
        { nome: 'BANT', tools: 4 },
        { nome: 'Metas', tools: 3 },
        { nome: 'Propostas', tools: 4 },
        { nome: 'Templates', tools: 3 }
      ]
    }
  }

  // Handle prompt_finalizado locally
  if (toolName === 'prompt_finalizado') {
    return { success: true, message: 'Prompt marcado como finalizado' }
  }

  const mcpUrl = `${SUPABASE_URL}/functions/v1/prompt-creator-mcp`
  
  const payload = {
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'tools/call',
    params: { name: toolName, arguments: args }
  }
  
  try {
    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    })
    
    const result = await response.json()
    
    if (result.error) {
      return { error: result.error.message || 'MCP tool error' }
    }
    
    // Extract text content from MCP response
    if (result.result?.content?.[0]?.text) {
      try {
        return JSON.parse(result.result.content[0].text)
      } catch {
        return { text: result.result.content[0].text }
      }
    }
    
    return result.result || { error: 'No result' }
  } catch (error) {
    console.error('MCP tool call failed:', toolName, error)
    return { error: error instanceof Error ? error.message : 'Failed to call MCP tool' }
  }
}
