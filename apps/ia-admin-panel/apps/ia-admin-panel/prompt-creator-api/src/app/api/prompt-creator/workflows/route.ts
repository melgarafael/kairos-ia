import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveUser, getClientCredentials, createClientSupabase, type ClientCredentials } from '@/lib/supabase'

// ============================================================================
// Types
// ============================================================================

interface AIAgentNode {
  id: string
  name: string
  currentPrompt: string
  isAgentTool: boolean
}

interface N8nWorkflow {
  id: string
  name: string
  active: boolean
  agents: AIAgentNode[]
}

interface N8nConnection {
  api_key: string
  base_url: string
}

// AI Agent node types that can have systemMessage prompts
const AI_AGENT_NODE_TYPES = [
  '@n8n/n8n-nodes-langchain.agent',
  '@n8n/n8n-nodes-langchain.agentTool'
]

// ============================================================================
// CORS
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

// ============================================================================
// Helper Functions
// ============================================================================

// Sanitize base URL
function sanitizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '').replace(/\/api\/v1\/?$/, '')
}

// Get n8n proxy URL based on environment
function getN8nProxyUrl(): string {
  const masterUrl = process.env.SUPABASE_URL!
  return `${masterUrl}/functions/v1/n8n-proxy`
}

// Find AI agents in a workflow
function findAIAgents(workflowData: any): AIAgentNode[] {
  if (!workflowData?.nodes || !Array.isArray(workflowData.nodes)) {
    return []
  }

  return workflowData.nodes
    .filter((node: any) => AI_AGENT_NODE_TYPES.includes(node.type))
    .map((node: any) => ({
      id: node.id,
      name: node.name || 'AI Agent',
      currentPrompt: node.parameters?.options?.systemMessage || '',
      isAgentTool: node.type === '@n8n/n8n-nodes-langchain.agentTool'
    }))
}

// Get n8n connection for user's organization using the new credential resolver
async function getN8nConnection(
  supabase: any, 
  userId: string, 
  organizationId: string | null
): Promise<{ n8nConnection: N8nConnection | null; clientCredentials: ClientCredentials | null }> {
  
  // Use the shared credential resolver with fallback logic
  const credentialsResult = await getClientCredentials(supabase, userId, organizationId)
  
  if (!credentialsResult) {
    console.error('[getN8nConnection] Failed to get client credentials')
    return { n8nConnection: null, clientCredentials: null }
  }

  console.log(`[getN8nConnection] Got credentials via ${credentialsResult.source}`)
  
  const { credentials } = credentialsResult

  // Create client supabase connection
  const clientSupabase = createClientSupabase(credentials)

  // Get n8n credentials from client supabase
  console.log('[getN8nConnection] Calling n8n_get RPC with org_id:', credentials.clientOrgId)
  const { data: n8nData, error: n8nError } = await clientSupabase.rpc('n8n_get', {
    p_organization_id: credentials.clientOrgId
  })

  console.log('[getN8nConnection] n8n_get result:', { data: n8nData, error: n8nError?.message })

  if (n8nError || !n8nData?.[0]) {
    console.error('[getN8nConnection] Failed to get n8n connection:', n8nError?.message, '| Data:', JSON.stringify(n8nData))
    return { n8nConnection: null, clientCredentials: credentials }
  }

  const connection = n8nData[0]
  if (!connection.api_key || !connection.base_url) {
    console.error('[getN8nConnection] n8n connection missing api_key or base_url')
    return { n8nConnection: null, clientCredentials: credentials }
  }

  return {
    n8nConnection: {
      api_key: connection.api_key,
      base_url: sanitizeBaseUrl(connection.base_url)
    },
    clientCredentials: credentials
  }
}

// ============================================================================
// GET - List workflows with AI agents
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const user = await resolveUser(authHeader)

    // Get n8n connection using new credential resolver with fallback
    const { n8nConnection, clientCredentials } = await getN8nConnection(
      user.supabase, 
      user.userId, 
      user.organizationId
    )
    
    if (!clientCredentials) {
      return NextResponse.json({ 
        workflows: [],
        n8n_connected: false,
        error: 'credentials_not_found',
        message: 'Credenciais do Supabase não encontradas. Verifique a configuração da organização.'
      }, {
        headers: { 'Access-Control-Allow-Origin': '*' }
      })
    }
    
    if (!n8nConnection) {
      return NextResponse.json({ 
        workflows: [],
        n8n_connected: false,
        error: 'n8n_not_connected',
        message: 'Conexão n8n não configurada. Configure em Configurações > Integrações > n8n.'
      }, {
        headers: { 'Access-Control-Allow-Origin': '*' }
      })
    }

    const n8nProxyUrl = getN8nProxyUrl()
    
    // Configuration for paginated workflow fetching (same as PromptInstaller.tsx)
    const WORKFLOW_PAGE_SIZE = 100  // Fetch 100 per page
    const MAX_WORKFLOW_RESULTS = 500  // Max workflows to scan
    const PARALLEL_BATCH_SIZE = 10  // Fetch 10 workflow details in parallel
    
    // Step 1: Get ALL workflows using pagination with cursor
    const allWorkflows: Array<{ id: string; name: string; active: boolean }> = []
    let cursor: string | null = null
    const maxPages = Math.ceil(MAX_WORKFLOW_RESULTS / WORKFLOW_PAGE_SIZE)

    console.log('[GET] Starting paginated workflow fetch...')

    for (let page = 0; page < maxPages; page++) {
      const params = new URLSearchParams({ limit: String(WORKFLOW_PAGE_SIZE) })
      if (cursor) params.set('cursor', cursor)

      const listResponse = await fetch(n8nProxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_url: n8nConnection.base_url,
          api_key: n8nConnection.api_key,
          method: 'GET',
          path: `/api/v1/workflows?${params.toString()}`
        })
      })

      if (!listResponse.ok) {
        console.error('[GET] Failed to fetch workflows page', page)
        break
      }

      const listPayload = await listResponse.json().catch(() => null)
      const rawWorkflows = Array.isArray(listPayload)
        ? listPayload
        : Array.isArray(listPayload?.data)
          ? listPayload.data
          : []

      for (const wf of rawWorkflows) {
        allWorkflows.push({
          id: String(wf.id),
          name: wf.name || 'Sem nome',
          active: wf.active || false
        })
      }

      console.log(`[GET] Page ${page + 1}: fetched ${rawWorkflows.length} workflows (total: ${allWorkflows.length})`)

      // Check if we should continue
      if (rawWorkflows.length === 0) break
      if (rawWorkflows.length < WORKFLOW_PAGE_SIZE) break
      if (allWorkflows.length >= MAX_WORKFLOW_RESULTS) break
      
      // Get next cursor
      const nextCursor = listPayload?.nextCursor || listPayload?.cursor
      if (!nextCursor) break
      cursor = nextCursor
    }

    console.log(`[GET] Total workflows found: ${allWorkflows.length}`)

    // Step 2: Fetch details for each workflow IN PARALLEL BATCHES to find AI agents
    const workflowsWithAgents: N8nWorkflow[] = []

    for (let i = 0; i < allWorkflows.length; i += PARALLEL_BATCH_SIZE) {
      const batch = allWorkflows.slice(i, i + PARALLEL_BATCH_SIZE)
      
      // Fetch all in batch IN PARALLEL (10x faster!)
      const results = await Promise.all(
        batch.map(async (wf) => {
          try {
            const detailResponse = await fetch(n8nProxyUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                base_url: n8nConnection.base_url,
                api_key: n8nConnection.api_key,
                method: 'GET',
                path: `/api/v1/workflows/${encodeURIComponent(wf.id)}`
              })
            })

            if (!detailResponse.ok) return null

            const workflowData = await detailResponse.json()
            const agents = findAIAgents(workflowData)

            // Only return if has AI agents
            if (agents.length > 0) {
              return {
                id: wf.id,
                name: wf.name,
                active: wf.active,
                agents
              }
            }
            return null
          } catch {
            return null
          }
        })
      )

      // Add workflows that have AI agents
      for (const result of results) {
        if (result) workflowsWithAgents.push(result)
      }
    }

    console.log(`[GET] Workflows with AI agents: ${workflowsWithAgents.length}`)

    return NextResponse.json({ 
      workflows: workflowsWithAgents,
      total: workflowsWithAgents.length,
      n8n_connected: true
    }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    })

  } catch (error: any) {
    console.error('Workflows API Error:', error)
    return NextResponse.json({ 
      error: error.message,
      workflows: [] 
    }, { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    })
  }
}

// ============================================================================
// POST - Install prompt into workflow
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const user = await resolveUser(authHeader)
    const { workflow_id, agent_id, prompt } = await req.json()

    if (!workflow_id || !agent_id || !prompt) {
      return NextResponse.json({ 
        error: 'workflow_id, agent_id e prompt são obrigatórios' 
      }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } })
    }

    // Get n8n connection using new credential resolver with fallback
    const { n8nConnection, clientCredentials } = await getN8nConnection(
      user.supabase, 
      user.userId, 
      user.organizationId
    )
    
    if (!n8nConnection) {
      return NextResponse.json({ 
        error: 'Conexão n8n não configurada' 
      }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } })
    }

    const n8nProxyUrl = getN8nProxyUrl()

    // Step 1: Get current workflow
    const getResponse = await fetch(n8nProxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_url: n8nConnection.base_url,
        api_key: n8nConnection.api_key,
        method: 'GET',
        path: `/api/v1/workflows/${encodeURIComponent(workflow_id)}`
      })
    })

    if (!getResponse.ok) {
      throw new Error('Workflow não encontrado')
    }

    const workflow = await getResponse.json()
    
    if (!workflow?.nodes || !Array.isArray(workflow.nodes)) {
      throw new Error('Workflow inválido')
    }

    // Step 2: Find and update the agent node
    const updatedNodes = workflow.nodes.map((node: any) => {
      if (node.id === agent_id) {
        return {
          ...node,
          parameters: {
            ...node.parameters,
            options: {
              ...(node.parameters?.options || {}),
              systemMessage: prompt
            }
          }
        }
      }
      return node
    })

    // Step 3: Prepare workflow for update (only allowed fields)
    const allowedRootKeys = new Set(['name', 'nodes', 'connections', 'settings', 'staticData'])
    const sanitizedWorkflow: Record<string, unknown> = {}
    for (const key of Object.keys(workflow)) {
      if (allowedRootKeys.has(key)) {
        sanitizedWorkflow[key] = workflow[key]
      }
    }
    sanitizedWorkflow.nodes = updatedNodes

    // Step 4: Update workflow
    const updateResponse = await fetch(n8nProxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_url: n8nConnection.base_url,
        api_key: n8nConnection.api_key,
        method: 'PUT',
        path: `/api/v1/workflows/${encodeURIComponent(workflow_id)}`,
        body: sanitizedWorkflow
      })
    })

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text().catch(() => 'Erro ao atualizar')
      throw new Error(errorText)
    }

    // Step 5: Save prompt to agent_prompts table in client supabase
    // Use the client credentials we already resolved (with fallback)
    if (clientCredentials) {
      try {
        const clientSupabase = createClientSupabase(clientCredentials)

        // Save to agent_prompts using client_org_id (following doctrine)
        await clientSupabase
          .from('agent_prompts')
          .upsert({
            organization_id: clientCredentials.clientOrgId,
            agent_name: workflow.name || 'AI Agent',
            prompt: prompt,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'organization_id,agent_name'
          })
        
        console.log('[POST] Prompt saved to agent_prompts table')
      } catch (saveError: any) {
        // Don't fail the whole operation if saving fails
        console.error('[POST] Failed to save prompt to agent_prompts:', saveError.message)
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Prompt instalado com sucesso!',
      workflow_name: workflow.name
    }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    })

  } catch (error: any) {
    console.error('Install Prompt Error:', error)
    return NextResponse.json({ 
      error: error.message 
    }, { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    })
  }
}

