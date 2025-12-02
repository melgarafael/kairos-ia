import { NextRequest, NextResponse } from 'next/server'
import { resolveUser, createAdminClient, getClientCredentials, createClientSupabase } from '@/lib/supabase'

// Types
interface SessionRequest {
  action: 'list' | 'create' | 'delete' | 'get_messages' | 'save_prompt'
  session_id?: string
  prompt_data?: {
    agent_name: string
    prompt: string
    business_description?: string
    agent_goal?: string
    tone_of_voice?: string
    tasks?: string[]
    tools_instructions?: string
  }
}

// CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

// List sessions
async function listSessions(supabase: ReturnType<typeof createAdminClient>, userId: string, limit = 20) {
  const { data, error } = await supabase
    .from('prompt_creator_sessions')
    .select('id, title, metadata, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Erro ao listar sessões: ${error.message}`)
  return data || []
}

// Create session
async function createSession(supabase: ReturnType<typeof createAdminClient>, userId: string, title?: string) {
  const { data, error } = await supabase
    .from('prompt_creator_sessions')
    .insert({
      user_id: userId,
      title: title || 'Nova conversa',
      metadata: {}
    })
    .select()
    .single()

  if (error) throw new Error(`Erro ao criar sessão: ${error.message}`)
  return data
}

// Delete session
async function deleteSession(supabase: ReturnType<typeof createAdminClient>, userId: string, sessionId: string) {
  const { error } = await supabase
    .from('prompt_creator_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId)

  if (error) throw new Error(`Erro ao deletar sessão: ${error.message}`)
  return { success: true }
}

// Get messages
async function getMessages(supabase: ReturnType<typeof createAdminClient>, userId: string, sessionId: string) {
  // First verify ownership
  const { data: session, error: sessionError } = await supabase
    .from('prompt_creator_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (sessionError || !session) {
    throw new Error('Sessão não encontrada')
  }

  const { data, error } = await supabase
    .from('prompt_creator_messages')
    .select('id, role, content, tool_calls, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Erro ao buscar mensagens: ${error.message}`)
  return data || []
}

// Save prompt to client Supabase
// Following the doctrine: Use getClientCredentials with fallback to saas_supabase_connections
async function savePromptToClient(
  masterSupabase: ReturnType<typeof createAdminClient>,
  userId: string,
  organizationId: string | null,
  promptData: NonNullable<SessionRequest['prompt_data']>
) {
  // Use the shared credential resolver with fallback logic
  const credentialsResult = await getClientCredentials(masterSupabase, userId, organizationId)

  if (!credentialsResult) {
    console.error('[savePromptToClient] Failed to get client credentials')
    throw new Error('Credenciais do Client Supabase não encontradas. Verifique a configuração da organização.')
  }

  console.log(`[savePromptToClient] Got credentials via ${credentialsResult.source}`)
  
  const { credentials } = credentialsResult

  // Create client connection using resolved credentials
  const clientSupabase = createClientSupabase(credentials)

  // Insert into agent_prompts
  // Doctrine: Use client_org_id for organization_id in Client Supabase
  const { data, error } = await clientSupabase
    .from('agent_prompts')
    .insert({
      organization_id: credentials.clientOrgId, // CORRETO: usar client_org_id resolvido
      agent_name: promptData.agent_name,
      prompt: promptData.prompt,
      business_description: promptData.business_description || null,
      agent_goal: promptData.agent_goal || null,
      tone_of_voice: promptData.tone_of_voice || null,
      tasks: promptData.tasks || null,
      tools_instructions: promptData.tools_instructions || null
    })
    .select()
    .single()

  if (error) throw new Error(`Erro ao salvar prompt: ${error.message}`)
  return data
}

// GET handler - List sessions
export async function GET(request: NextRequest) {
  const traceId = crypto.randomUUID()

  try {
    const authHeader = request.headers.get('authorization')
    const user = await resolveUser(authHeader)

    const sessions = await listSessions(user.supabase, user.userId)

    return NextResponse.json(
      { sessions },
      {
        headers: {
          'x-trace-id': traceId,
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  } catch (error) {
    console.error('List sessions error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { 
        status: error instanceof Error && error.message.includes('autenticação') ? 401 : 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      }
    )
  }
}

// POST handler - Create session, get messages, save prompt
export async function POST(request: NextRequest) {
  const traceId = crypto.randomUUID()

  try {
    const authHeader = request.headers.get('authorization')
    const user = await resolveUser(authHeader)

    const body: SessionRequest = await request.json()
    const { action, session_id, prompt_data } = body

    switch (action) {
      case 'create': {
        const session = await createSession(user.supabase, user.userId)
        return NextResponse.json(
          { session },
          {
            headers: {
              'x-trace-id': traceId,
              'Access-Control-Allow-Origin': '*'
            }
          }
        )
      }

      case 'get_messages': {
        if (!session_id) {
          return NextResponse.json(
            { error: 'session_id required' },
            { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
          )
        }
        const messages = await getMessages(user.supabase, user.userId, session_id)
        return NextResponse.json(
          { messages },
          {
            headers: {
              'x-trace-id': traceId,
              'Access-Control-Allow-Origin': '*'
            }
          }
        )
      }

      case 'save_prompt': {
        if (!prompt_data || !prompt_data.agent_name || !prompt_data.prompt) {
          return NextResponse.json(
            { error: 'prompt_data with agent_name and prompt required' },
            { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
          )
        }

        // Note: organizationId can be null - the credential resolver has fallback logic
        const savedPrompt = await savePromptToClient(
          user.supabase, 
          user.userId, 
          user.organizationId, 
          prompt_data
        )
        return NextResponse.json(
          { prompt: savedPrompt },
          {
            headers: {
              'x-trace-id': traceId,
              'Access-Control-Allow-Origin': '*'
            }
          }
        )
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
        )
    }
  } catch (error) {
    console.error('Session action error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { 
        status: error instanceof Error && error.message.includes('autenticação') ? 401 : 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      }
    )
  }
}

// DELETE handler - Delete session
export async function DELETE(request: NextRequest) {
  const traceId = crypto.randomUUID()

  try {
    const authHeader = request.headers.get('authorization')
    const user = await resolveUser(authHeader)

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'session_id required' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    const result = await deleteSession(user.supabase, user.userId, sessionId)
    return NextResponse.json(
      result,
      {
        headers: {
          'x-trace-id': traceId,
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  } catch (error) {
    console.error('Delete session error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { 
        status: error instanceof Error && error.message.includes('autenticação') ? 401 : 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      }
    )
  }
}

