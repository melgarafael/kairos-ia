import { NextRequest, NextResponse } from 'next/server'
import { resolveUser } from '@/lib/supabase'
import { callMCPTool } from '@/lib/mcp-tools'

// ============================================================================
// Types
// ============================================================================

interface DataPreview {
  clients: {
    count: number
    items: Array<{
      id: string
      company_name: string
      sector: string
      status: string
    }>
  }
  briefings: {
    count: number
    items: Array<{
      id: string
      client_id: string
      client_name: string
      type: string
      title: string
    }>
  }
  contracts: {
    count: number
    items: Array<{
      id: string
      client_id: string
      client_name: string
      status: string
      total_value: number
    }>
  }
  transcriptions: {
    count: number
    items: Array<{
      id: string
      client_id: string
      client_name: string
      title: string
      meeting_date: string
    }>
  }
  feedbacks: {
    count: number
    items: Array<{
      id: string
      client_id: string
      client_name: string
      type: string
      sentiment: string
    }>
  }
  documents: {
    count: number
    items: Array<{
      id: string
      client_id: string
      client_name: string
      type: string
      name: string
    }>
  }
  available_tools: string[]
}

// ============================================================================
// CORS
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

// ============================================================================
// GET Handler - Fetch all data previews in parallel
// ============================================================================

export async function GET(request: NextRequest) {
  const traceId = crypto.randomUUID()

  try {
    const authHeader = request.headers.get('authorization')
    const user = await resolveUser(authHeader)
    const token = authHeader?.replace('Bearer ', '') || ''

    // Fetch all data in parallel for speed (Jobs: "time-to-pleasure")
    console.log('[data-preview] Fetching data for user:', user.userId)
    
    const [
      clientsResult,
      briefingsResult,
      contractsResult,
      transcriptionsResult,
      feedbacksResult,
      documentsResult,
      toolsResult
    ] = await Promise.all([
      callMCPTool('listar_clientes_automacao', { limite: 10 }, token),
      callMCPTool('listar_briefings', { limite: 10 }, token),
      callMCPTool('listar_contratos', { limite: 10 }, token),
      callMCPTool('listar_transcricoes', { limite: 10 }, token),
      callMCPTool('listar_feedbacks', { limite: 10 }, token),
      callMCPTool('listar_documentos', { limite: 10 }, token),
      callMCPTool('obter_tools_disponiveis', {}, token)
    ])
    
    console.log('[data-preview] Raw briefings result:', JSON.stringify(briefingsResult, null, 2))

    // Helper to safely extract array from MCP result
    // MCP returns: { total: N, clientes: [...] } or { total: N, briefings: [...] } etc.
    const safeArray = (result: unknown, key?: string): unknown[] => {
      if (Array.isArray(result)) return result
      if (result && typeof result === 'object') {
        // Try specific key first (e.g., 'clientes', 'briefings')
        if (key && key in result) {
          return Array.isArray((result as any)[key]) ? (result as any)[key] : []
        }
        // Fallback to common patterns
        if ('data' in result && Array.isArray((result as any).data)) {
          return (result as any).data
        }
        if ('items' in result && Array.isArray((result as any).items)) {
          return (result as any).items
        }
        // Try to find any array property
        for (const k of Object.keys(result as object)) {
          if (Array.isArray((result as any)[k])) {
            return (result as any)[k]
          }
        }
      }
      return []
    }

    // Helper to get count from MCP result
    const safeCount = (result: unknown, arr: unknown[]): number => {
      if (result && typeof result === 'object' && 'total' in result) {
        return (result as any).total
      }
      if (result && typeof result === 'object' && 'count' in result) {
        return (result as any).count
      }
      return arr.length
    }

    // Build response - use specific keys for MCP results
    const clientsArr = safeArray(clientsResult, 'clientes')
    const briefingsArr = safeArray(briefingsResult, 'briefings')
    const contractsArr = safeArray(contractsResult, 'contratos')
    const transcriptionsArr = safeArray(transcriptionsResult, 'transcricoes')
    const feedbacksArr = safeArray(feedbacksResult, 'feedbacks')
    const documentsArr = safeArray(documentsResult, 'documentos')

    // Build client name lookup map (MCP returns 'empresa' field)
    const clientNameMap = new Map<string, string>()
    clientsArr.forEach((c: any) => {
      const name = c?.empresa || c?.company_name || c?.name
      if (c?.id && name) {
        clientNameMap.set(c.id, name)
      }
    })

    const preview: DataPreview = {
      clients: {
        count: safeCount(clientsResult, clientsArr),
        // MCP returns: { id, empresa, contato, email, telefone, status, setor, ... }
        items: clientsArr.slice(0, 5).map((c: any) => ({
          id: c.id || '',
          company_name: c.empresa || c.company_name || c.name || 'Sem nome',
          sector: c.setor || c.sector || c.industry || 'Não informado',
          status: c.status || 'active'
        }))
      },
      briefings: {
        count: safeCount(briefingsResult, briefingsArr),
        // MCP returns: { id, cliente_id, titulo, tipo, conteudo, ... }
        items: briefingsArr.slice(0, 5).map((b: any) => ({
          id: b.id || '',
          client_id: b.cliente_id || b.client_id || '',
          client_name: clientNameMap.get(b.cliente_id || b.client_id) || 'Cliente',
          type: b.tipo || b.type || 'general',
          title: b.titulo || b.title || b.conteudo?.slice(0, 50) || 'Briefing'
        }))
      },
      contracts: {
        count: safeCount(contractsResult, contractsArr),
        // MCP returns: { id, cliente_id, nome, numero, valor_setup, valor_recorrente, status, ... }
        items: contractsArr.slice(0, 5).map((c: any) => ({
          id: c.id || '',
          client_id: c.cliente_id || c.client_id || '',
          client_name: clientNameMap.get(c.cliente_id || c.client_id) || 'Cliente',
          status: c.status || 'active',
          total_value: c.valor_setup || c.valor_recorrente || c.total_value || c.value || 0
        }))
      },
      transcriptions: {
        count: safeCount(transcriptionsResult, transcriptionsArr),
        // MCP returns: { id, cliente_id, titulo, data_reuniao, resumo, ... }
        items: transcriptionsArr.slice(0, 5).map((t: any) => ({
          id: t.id || '',
          client_id: t.cliente_id || t.client_id || '',
          client_name: clientNameMap.get(t.cliente_id || t.client_id) || 'Cliente',
          title: t.titulo || t.title || t.resumo?.slice(0, 50) || 'Reunião',
          meeting_date: t.data_reuniao || t.meeting_date || t.created_at || ''
        }))
      },
      feedbacks: {
        count: safeCount(feedbacksResult, feedbacksArr),
        // MCP returns: { id, cliente_id, tipo, avaliacao, titulo, conteudo, status, ... }
        items: feedbacksArr.slice(0, 5).map((f: any) => {
          // Coalesce avaliacao to 3 (neutral) if undefined/null to ensure correct sentiment
          const rating = f.avaliacao ?? 3
          return {
            id: f.id || '',
            client_id: f.cliente_id || f.client_id || '',
            client_name: clientNameMap.get(f.cliente_id || f.client_id) || 'Cliente',
            type: f.tipo || f.type || 'general',
            sentiment: rating > 3 ? 'positive' : rating < 3 ? 'negative' : 'neutral'
          }
        })
      },
      documents: {
        count: safeCount(documentsResult, documentsArr),
        // MCP returns: { id, cliente_id, nome, tipo, arquivo_nome, ... }
        items: documentsArr.slice(0, 5).map((d: any) => ({
          id: d.id || '',
          client_id: d.cliente_id || d.client_id || '',
          client_name: clientNameMap.get(d.cliente_id || d.client_id) || 'Cliente',
          type: d.tipo || d.type || 'other',
          name: d.nome || d.arquivo_nome || d.name || d.original_name || 'Documento'
        }))
      },
      available_tools: Array.isArray(toolsResult) 
        ? toolsResult.map((t: any) => t.name || t)
        : (toolsResult as any)?.tools?.map((t: any) => t.name || t) || []
    }

    return NextResponse.json(
      { preview, user_id: user.userId },
      {
        headers: {
          'x-trace-id': traceId,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'private, max-age=60' // Cache for 1 minute
        }
      }
    )
  } catch (error) {
    console.error('Data preview error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { 
        status: error instanceof Error && error.message.includes('autenticação') ? 401 : 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      }
    )
  }
}

