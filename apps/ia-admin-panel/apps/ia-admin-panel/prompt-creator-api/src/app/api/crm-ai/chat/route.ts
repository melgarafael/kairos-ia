import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { resolveUser, createAdminClient } from '@/lib/supabase'
import { CRM_MCP_TOOLS, callCrmMCPTool } from '@/lib/crm-mcp-tools'
import { getCrmSystemPromptWithTime } from '@/lib/crm-system-prompt'

// Types
interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: unknown[]
  tool_call_id?: string
}

interface ChatRequest {
  session_id?: string
  messages?: ChatMessage[]
  stream?: boolean
}

interface ToolCall {
  name: string
  call_id: string
  arguments: Record<string, unknown>
  result?: unknown
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

// Convert MCP tools to OpenAI Responses API format
const RESPONSES_TOOLS = CRM_MCP_TOOLS.map(tool => ({
  type: 'function' as const,
  name: tool.function.name,
  description: tool.function.description,
  parameters: tool.function.parameters,
  strict: false
}))

// CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

// Session Management - uses same tables as prompt-creator but with different prefix
async function createSession(supabase: ReturnType<typeof createAdminClient>, userId: string, title?: string) {
  // Try to use prompt_creator_sessions table (reuse existing infrastructure)
  const { data, error } = await supabase
    .from('prompt_creator_sessions')
    .insert({
      user_id: userId,
      title: title || '[CRM AI] Nova conversa',
      metadata: { type: 'crm_ai' }
    })
    .select()
    .single()

  if (error) {
    console.log('Could not create session, using mock:', error.message)
    return { id: `crm_mock_${crypto.randomUUID()}`, user_id: userId }
  }
  return data
}

async function updateSessionTitle(supabase: ReturnType<typeof createAdminClient>, sessionId: string, firstMessage: string) {
  if (sessionId.startsWith('crm_mock_')) return
  
  const title = `[CRM AI] ${firstMessage.length > 40 ? firstMessage.slice(0, 37) + '...' : firstMessage}`

  await supabase
    .from('prompt_creator_sessions')
    .update({ title })
    .eq('id', sessionId)
}

async function saveMessage(
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string,
  role: string,
  content: string,
  toolCalls?: unknown
) {
  if (sessionId.startsWith('crm_mock_')) return
  
  const { error } = await supabase
    .from('prompt_creator_messages')
    .insert({
      session_id: sessionId,
      role,
      content,
      tool_calls: toolCalls || null
    })

  if (error) {
    console.error('Failed to save CRM AI message:', sessionId, error.message)
  }
}

// Build conversation input for Responses API
function buildConversationInput(messages: ChatMessage[]): string {
  const relevantMessages = messages.filter(m => m.role !== 'tool')
  const conversationParts: string[] = []
  
  for (const msg of relevantMessages) {
    if (msg.role === 'user') {
      conversationParts.push(`Usuário: ${msg.content}`)
    } else if (msg.role === 'assistant') {
      conversationParts.push(`Assistente: ${msg.content}`)
    }
  }
  
  return conversationParts.join('\n\n')
}

// Main POST handler
export async function POST(request: NextRequest) {
  const traceId = crypto.randomUUID()

  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization')
    const user = await resolveUser(authHeader)

    // Parse request body
    const body: ChatRequest = await request.json()
    const { session_id, messages = [], stream = true } = body

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'messages required' },
        { status: 400, headers: { 'x-trace-id': traceId } }
      )
    }

    // Create or use existing session
    let currentSessionId: string = session_id || ''
    if (!currentSessionId) {
      const session = await createSession(user.supabase, user.userId)
      currentSessionId = session.id

      const firstUserMessage = messages.find(m => m.role === 'user')
      if (firstUserMessage) {
        await updateSessionTitle(user.supabase, currentSessionId, firstUserMessage.content)
      }
    }

    // Save user message
    const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0]
    if (lastUserMessage) {
      await saveMessage(user.supabase, currentSessionId, 'user', lastUserMessage.content)
    }

    const conversationInput = buildConversationInput(messages)

    // Streaming response with Agentic Loop
    if (stream) {
      const encoder = new TextEncoder()
      
      const streamResponse = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(JSON.stringify({ k: 'init', traceId }) + '\n'))

            let fullContent = ''
            const allToolCalls: ToolCall[] = []
            let maxLoops = 5
            let currentInput = conversationInput

            while (maxLoops > 0) {
              const pendingCalls: Map<number, { name: string; call_id: string; arguments: string }> = new Map()
              const iterationToolCalls: ToolCall[] = []
              let iterationContent = ''

              const response = await openai.responses.create({
                model: 'gpt-5.1',
                instructions: getCrmSystemPromptWithTime(),
                input: currentInput,
                tools: RESPONSES_TOOLS,
                stream: true
              })

              for await (const event of response) {
                const eventType = (event as any).type

                if (eventType === 'response.output_text.delta') {
                  const delta = (event as any).delta || ''
                  iterationContent += delta
                  controller.enqueue(encoder.encode(JSON.stringify({ k: 't', d: delta }) + '\n'))
                }

                if (eventType === 'response.output_item.added') {
                  const item = (event as any).item
                  if (item?.type === 'function_call' && item?.name) {
                    const outputIndex = (event as any).output_index ?? 0
                    const callId = item.call_id || `call_${crypto.randomUUID()}`
                    pendingCalls.set(outputIndex, { 
                      name: item.name, 
                      call_id: callId,
                      arguments: '' 
                    })
                  }
                }

                if (eventType === 'response.function_call_arguments.delta') {
                  const outputIndex = (event as any).output_index ?? 0
                  const pending = pendingCalls.get(outputIndex)
                  if (pending) {
                    pending.arguments += (event as any).delta || ''
                  }
                }

                if (eventType === 'response.function_call_arguments.done') {
                  const outputIndex = (event as any).output_index ?? 0
                  const pending = pendingCalls.get(outputIndex)
                  
                  if (pending?.name) {
                    let parsedArgs: Record<string, unknown> = {}
                    try {
                      parsedArgs = JSON.parse(pending.arguments || '{}')
                    } catch (e) {
                      console.error('Failed to parse tool args:', pending.arguments)
                    }

                    iterationToolCalls.push({
                      name: pending.name,
                      call_id: pending.call_id,
                      arguments: parsedArgs
                    })
                  }
                }
              }

              fullContent += iterationContent

              if (iterationToolCalls.length === 0) {
                break
              }

              controller.enqueue(encoder.encode(JSON.stringify({ k: 'tools_start' }) + '\n'))

              const toolResultsForNextCall: string[] = []

              for (const toolCall of iterationToolCalls) {
                controller.enqueue(encoder.encode(JSON.stringify({ 
                  k: 'tool_executing', 
                  name: toolCall.name 
                }) + '\n'))

                try {
                  console.log(`[crm-ai] Calling MCP tool: ${toolCall.name}`, JSON.stringify(toolCall.arguments))
                  const result = await callCrmMCPTool(toolCall.name, toolCall.arguments, user.token)
                  console.log(`[crm-ai] MCP tool result for ${toolCall.name}:`, JSON.stringify(result).substring(0, 500))
                  
                  toolCall.result = result
                  allToolCalls.push(toolCall)

                  controller.enqueue(encoder.encode(JSON.stringify({
                    k: 'tool_result',
                    name: toolCall.name,
                    result
                  }) + '\n'))

                  toolResultsForNextCall.push(
                    `[Tool: ${toolCall.name}]\nArgumentos: ${JSON.stringify(toolCall.arguments)}\nResultado: ${JSON.stringify(result)}`
                  )
                } catch (err) {
                  console.error('Tool execution error:', toolCall.name, err)
                  const errorResult = { error: err instanceof Error ? err.message : 'Unknown error' }
                  toolCall.result = errorResult
                  allToolCalls.push(toolCall)

                  controller.enqueue(encoder.encode(JSON.stringify({
                    k: 'tool_error',
                    name: toolCall.name,
                    error: err instanceof Error ? err.message : 'Unknown error'
                  }) + '\n'))

                  toolResultsForNextCall.push(
                    `[Tool: ${toolCall.name}]\nErro: ${err instanceof Error ? err.message : 'Unknown error'}`
                  )
                }
              }

              controller.enqueue(encoder.encode(JSON.stringify({ k: 'tools_end' }) + '\n'))

              currentInput = `${conversationInput}

---
RESULTADOS DAS TOOLS EXECUTADAS:

${toolResultsForNextCall.join('\n\n')}

---

Com base nos resultados acima, responda ao usuário de forma clara e estruturada.
Use emojis para destacar pontos importantes.
Se houver ações recomendadas, liste-as claramente.`

              maxLoops--
            }

            if (fullContent) {
              await saveMessage(
                user.supabase,
                currentSessionId,
                'assistant',
                fullContent,
                allToolCalls.length > 0 ? allToolCalls : undefined
              )
            }

            controller.enqueue(encoder.encode(JSON.stringify({ 
              k: 'done', 
              full: fullContent
            }) + '\n'))
            controller.close()

          } catch (error) {
            console.error('CRM AI stream error:', error)
            controller.enqueue(encoder.encode(JSON.stringify({
              k: 'err',
              d: error instanceof Error ? error.message : 'Unknown error'
            }) + '\n'))
            controller.close()
          }
        }
      })

      return new Response(streamResponse, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'x-trace-id': traceId,
          'x-session-id': currentSessionId,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'x-trace-id, x-session-id'
        }
      })
    }

    // Non-streaming response
    const allToolCalls: ToolCall[] = []
    let maxIterations = 5
    let currentInput = conversationInput
    let finalContent = ''

    while (maxIterations > 0) {
      const response = await openai.responses.create({
        model: 'gpt-5.1',
        instructions: getCrmSystemPromptWithTime(),
        input: currentInput,
        tools: RESPONSES_TOOLS
      })

      finalContent += response.output_text || ''

      const functionCalls = response.output?.filter((o: any) => o.type === 'function_call') || []
      
      if (functionCalls.length === 0) {
        break
      }

      const toolResultsForNextCall: string[] = []
      
      for (const fc of functionCalls) {
        const toolName = (fc as any).name
        const toolArgs = JSON.parse((fc as any).arguments || '{}')
        const callId = (fc as any).call_id || `call_${crypto.randomUUID()}`
        
        const toolResult = await callCrmMCPTool(toolName, toolArgs, user.token)
        allToolCalls.push({ name: toolName, call_id: callId, arguments: toolArgs, result: toolResult })
        
        toolResultsForNextCall.push(
          `[Tool: ${toolName}]\nArgumentos: ${JSON.stringify(toolArgs)}\nResultado: ${JSON.stringify(toolResult)}`
        )
      }

      currentInput = `${conversationInput}

---
RESULTADOS DAS TOOLS EXECUTADAS:

${toolResultsForNextCall.join('\n\n')}

---

Com base nos resultados acima, responda ao usuário.`

      maxIterations--
    }

    await saveMessage(
      user.supabase,
      currentSessionId,
      'assistant',
      finalContent,
      allToolCalls.length > 0 ? allToolCalls : undefined
    )

    return NextResponse.json(
      {
        reply: finalContent,
        tool_calls: allToolCalls.length > 0 ? allToolCalls : undefined,
        session_id: currentSessionId
      },
      {
        headers: {
          'x-trace-id': traceId,
          'x-session-id': currentSessionId,
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  } catch (error) {
    console.error('CRM AI chat error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: error instanceof Error && error.message.includes('autenticação') ? 401 : 500, headers: { 'x-trace-id': traceId } }
    )
  }
}

