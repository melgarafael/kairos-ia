import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { resolveUser, createAdminClient } from '@/lib/supabase'
import { MCP_TOOLS, callMCPTool } from '@/lib/mcp-tools'
import { getSystemPromptWithTime } from '@/lib/system-prompt'

// Types
interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: unknown[]
  tool_call_id?: string
}

interface FileAttachment {
  kind: 'text' | 'image'
  name: string
  mime: string
  content?: string
  dataUrl?: string
}

interface ChatRequest {
  session_id?: string
  messages?: ChatMessage[]
  stream?: boolean
  attachments?: FileAttachment[]
  audio_transcript?: string
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
const RESPONSES_TOOLS = MCP_TOOLS.map(tool => ({
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

// Session Management Functions
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

async function updateSessionTitle(supabase: ReturnType<typeof createAdminClient>, sessionId: string, firstMessage: string) {
  const title = firstMessage.length > 50 ? firstMessage.slice(0, 47) + '...' : firstMessage

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
  const { error } = await supabase
    .from('prompt_creator_messages')
    .insert({
      session_id: sessionId,
      role,
      content,
      tool_calls: toolCalls || null
    })

  if (error) {
    console.error('Failed to save message:', sessionId, error.message)
  }
}

// Build attachment context for AI
function buildAttachmentContext(attachments?: FileAttachment[], audioTranscript?: string): string {
  const parts: string[] = []
  
  if (audioTranscript) {
    parts.push(`\n---\n📎 TRANSCRIÇÃO DE ÁUDIO:\n${audioTranscript}\n---\n`)
  }
  
  if (attachments && attachments.length > 0) {
    parts.push('\n---\n📎 ARQUIVOS ANEXADOS:')
    
    for (const att of attachments) {
      if (att.kind === 'text' && att.content) {
        parts.push(`\n### Arquivo: ${att.name}\n\n${att.content}`)
      } else if (att.kind === 'image') {
        parts.push(`\n### Imagem: ${att.name} (${att.mime})`)
        // Note: For image analysis, you'd need vision model
      }
    }
    
    parts.push('\n---\n')
  }
  
  return parts.join('\n')
}

// Build conversation input for Responses API
function buildConversationInput(
  messages: ChatMessage[], 
  attachments?: FileAttachment[],
  audioTranscript?: string
): string {
  // Filter out tool messages and build conversation context
  const relevantMessages = messages.filter(m => m.role !== 'tool')
  
  // For Responses API, we combine previous context with current message
  const conversationParts: string[] = []
  
  // Add attachment context first if present
  const attachmentContext = buildAttachmentContext(attachments, audioTranscript)
  if (attachmentContext) {
    conversationParts.push(attachmentContext)
  }
  
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
    const { session_id, messages = [], stream = true, attachments, audio_transcript } = body

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

      // Update title with first message
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

    // Build input for Responses API (include attachments and audio transcript)
    const conversationInput = buildConversationInput(messages, attachments, audio_transcript)

    // Streaming response with Agentic Loop
    if (stream) {
      const encoder = new TextEncoder()
      
      const streamResponse = new ReadableStream({
        async start(controller) {
          try {
            // Send init event
            controller.enqueue(encoder.encode(JSON.stringify({ k: 'init', traceId }) + '\n'))

            // Agentic Loop State
            let fullContent = ''
            const allToolCalls: ToolCall[] = []
            let promptFinalized = false
            let promptInfo: { titulo: string; resumo: string } | null = null
            let maxLoops = 5
            let currentInput = conversationInput

            // Agentic Loop - continues until no more tool calls or max iterations
            while (maxLoops > 0) {
              // Track pending function calls for this iteration
              const pendingCalls: Map<number, { name: string; call_id: string; arguments: string }> = new Map()
              const iterationToolCalls: ToolCall[] = []
              let iterationContent = ''

              // Create streaming response
              const response = await openai.responses.create({
                model: 'gpt-5.1',
                instructions: getSystemPromptWithTime(),
                input: currentInput,
                tools: RESPONSES_TOOLS,
                stream: true
              })

              // Process stream events
              for await (const event of response) {
                const eventType = (event as any).type

                // Stream text deltas immediately to frontend
                if (eventType === 'response.output_text.delta') {
                  const delta = (event as any).delta || ''
                  iterationContent += delta
                  controller.enqueue(encoder.encode(JSON.stringify({ k: 't', d: delta }) + '\n'))
                }

                // Track function call start
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

                // Accumulate function call arguments
                if (eventType === 'response.function_call_arguments.delta') {
                  const outputIndex = (event as any).output_index ?? 0
                  const pending = pendingCalls.get(outputIndex)
                  if (pending) {
                    pending.arguments += (event as any).delta || ''
                  }
                }

                // Function call complete - collect it (don't execute yet)
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

              // Add iteration content to full content
              fullContent += iterationContent

              // If no tool calls, we're done - break the loop
              if (iterationToolCalls.length === 0) {
                break
              }

              // Execute all tool calls for this iteration
              controller.enqueue(encoder.encode(JSON.stringify({ k: 'tools_start' }) + '\n'))

              const toolResultsForNextCall: string[] = []

              for (const toolCall of iterationToolCalls) {
                // Special handling for prompt_finalizado - don't call MCP
                if (toolCall.name === 'prompt_finalizado') {
                  promptFinalized = true
                  promptInfo = {
                    titulo: (toolCall.arguments.titulo_prompt as string) || 'Prompt',
                    resumo: (toolCall.arguments.resumo as string) || ''
                  }
                  controller.enqueue(encoder.encode(JSON.stringify({ 
                    k: 'prompt_ready',
                    titulo: promptInfo.titulo,
                    resumo: promptInfo.resumo
                  }) + '\n'))
                  
                  // Add to all tool calls
                  allToolCalls.push({ ...toolCall, result: { success: true } })
                  continue
                }

                // Send tool execution indicator
                controller.enqueue(encoder.encode(JSON.stringify({ 
                  k: 'tool_executing', 
                  name: toolCall.name 
                }) + '\n'))

                try {
                  // Execute MCP tool
                  console.log(`[chat] Calling MCP tool: ${toolCall.name}`, JSON.stringify(toolCall.arguments))
                  const result = await callMCPTool(toolCall.name, toolCall.arguments, user.token)
                  console.log(`[chat] MCP tool result for ${toolCall.name}:`, JSON.stringify(result).substring(0, 500))
                  
                  // Store result
                  toolCall.result = result
                  allToolCalls.push(toolCall)

                  // Send result to frontend
                  controller.enqueue(encoder.encode(JSON.stringify({
                    k: 'tool_result',
                    name: toolCall.name,
                    result
                  }) + '\n'))

                  // Build tool result for next API call
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

              // If we had prompt_finalizado and no other tools, break
              if (promptFinalized && iterationToolCalls.length === 1) {
                break
              }

              // Build new input with tool results for next iteration
              // This follows the conversation flow pattern
              currentInput = `${conversationInput}

---
HISTÓRICO DE TOOLS EXECUTADAS:

${toolResultsForNextCall.join('\n\n')}

---

Com base nos resultados das tools acima, continue a conversa de forma natural. 
Se você tem todas as informações necessárias, gere a resposta completa.
Se precisar de mais dados, use as tools apropriadas.
LEMBRE-SE: Use o formato :::prompt title="Nome"::: para gerar prompts.`

              maxLoops--
            }

            // Save assistant message with all tool calls
            if (fullContent) {
              await saveMessage(
                user.supabase,
                currentSessionId,
                'assistant',
                fullContent,
                allToolCalls.length > 0 ? allToolCalls : undefined
              )
            }

            // Send done event
            controller.enqueue(encoder.encode(JSON.stringify({ 
              k: 'done', 
              full: fullContent,
              promptReady: promptFinalized,
              promptInfo
            }) + '\n'))
            controller.close()

          } catch (error) {
            console.error('Stream error:', error)
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

    // Non-streaming response using Agentic Loop
    const allToolCalls: ToolCall[] = []
    let maxIterations = 5
    // For non-streaming, we need to rebuild conversation input
    let currentInput = buildConversationInput(messages, attachments, audio_transcript)
    let finalContent = ''

    while (maxIterations > 0) {
      const response = await openai.responses.create({
        model: 'gpt-5.1',
        instructions: getSystemPromptWithTime(),
        input: currentInput,
        tools: RESPONSES_TOOLS
      })

      // Collect text content
      finalContent += response.output_text || ''

      // Check for function calls in output
      const functionCalls = response.output?.filter((o: any) => o.type === 'function_call') || []
      
      if (functionCalls.length === 0) {
        // No more tool calls - we're done
        break
      }

      // Execute tool calls
      const toolResultsForNextCall: string[] = []
      
      for (const fc of functionCalls) {
        const toolName = (fc as any).name
        const toolArgs = JSON.parse((fc as any).arguments || '{}')
        const callId = (fc as any).call_id || `call_${crypto.randomUUID()}`
        
        // Skip prompt_finalizado for execution
        if (toolName === 'prompt_finalizado') {
          allToolCalls.push({ 
            name: toolName, 
            call_id: callId, 
            arguments: toolArgs, 
            result: { success: true } 
          })
          continue
        }

        const toolResult = await callMCPTool(toolName, toolArgs, user.token)
        allToolCalls.push({ name: toolName, call_id: callId, arguments: toolArgs, result: toolResult })
        
        toolResultsForNextCall.push(
          `[Tool: ${toolName}]\nArgumentos: ${JSON.stringify(toolArgs)}\nResultado: ${JSON.stringify(toolResult)}`
        )
      }

      // Build new input with tool results
      currentInput = `${conversationInput}

---
HISTÓRICO DE TOOLS EXECUTADAS:

${toolResultsForNextCall.join('\n\n')}

---

Com base nos resultados das tools acima, continue a conversa.`

      maxIterations--
    }

    // Save assistant message
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
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: error instanceof Error && error.message.includes('autenticação') ? 401 : 500, headers: { 'x-trace-id': traceId } }
    )
  }
}
