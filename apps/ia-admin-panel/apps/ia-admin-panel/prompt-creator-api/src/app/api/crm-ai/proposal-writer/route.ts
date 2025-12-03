import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { resolveUser } from '@/lib/supabase'
import { callCrmMCPTool } from '@/lib/crm-mcp-tools'
import { getProposalWriterPromptWithTime, buildProposalInput, ProposalContext } from '@/lib/proposal-writer-prompt'

// ============================================================================
// Proposal Writer API
// Generates personalized proposal text using AI with context from lead data
// ============================================================================

interface ProposalWriterRequest {
  lead_id: string
  products: Array<{
    id: string
    nome: string
    descricao?: string
    quantidade: number
    preco_unitario: number
  }>
  values: {
    subtotal: number
    discount_percent: number
    total: number
    validity_days: number
  }
  seller?: {
    name: string
    company: string
  }
  tom?: 'formal' | 'consultivo' | 'amigavel'
  foco?: string
  stream?: boolean
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

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

// Simple in-memory rate limiter (per-user, 1 request per 5 seconds)
const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_WINDOW_MS = 5000

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const lastRequest = rateLimitMap.get(userId)
  
  if (lastRequest && now - lastRequest < RATE_LIMIT_WINDOW_MS) {
    return false // Rate limited
  }
  
  rateLimitMap.set(userId, now)
  
  // Clean old entries periodically
  if (rateLimitMap.size > 1000) {
    const threshold = now - RATE_LIMIT_WINDOW_MS * 2
    for (const [key, timestamp] of rateLimitMap.entries()) {
      if (timestamp < threshold) rateLimitMap.delete(key)
    }
  }
  
  return true
}

// Main POST handler
export async function POST(request: NextRequest) {
  const traceId = crypto.randomUUID()
  const startTime = Date.now()

  try {
    // 1. Authenticate user
    const authHeader = request.headers.get('authorization')
    const user = await resolveUser(authHeader)

    // 1.5 Check rate limit
    if (!checkRateLimit(user.userId)) {
      return NextResponse.json(
        { error: 'Aguarde alguns segundos antes de gerar outro texto' },
        { status: 429, headers: { 'x-trace-id': traceId, 'Retry-After': '5' } }
      )
    }

    // 2. Parse request body
    const body: ProposalWriterRequest = await request.json()
    const { lead_id, products, values, seller, tom = 'consultivo', foco, stream = true } = body

    if (!lead_id) {
      return NextResponse.json(
        { error: 'lead_id é obrigatório' },
        { status: 400, headers: { 'x-trace-id': traceId } }
      )
    }

    if (!products || products.length === 0) {
      return NextResponse.json(
        { error: 'Pelo menos um produto é obrigatório' },
        { status: 400, headers: { 'x-trace-id': traceId } }
      )
    }

    // Validate products array (max 20 products, sanitize inputs)
    if (products.length > 20) {
      return NextResponse.json(
        { error: 'Máximo de 20 produtos permitido' },
        { status: 400, headers: { 'x-trace-id': traceId } }
      )
    }

    // Validate UUID format for lead_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(lead_id)) {
      return NextResponse.json(
        { error: 'lead_id inválido' },
        { status: 400, headers: { 'x-trace-id': traceId } }
      )
    }

    console.log(`[proposal-writer] Starting for lead ${lead_id}, ${products.length} products`)

    // 3. Get lead context using MCP tool
    const contextResult = await callCrmMCPTool(
      'gerar_contexto_proposta',
      {
        lead_id,
        produtos_ids: products.map(p => p.id),
        valor_total: values.total,
        desconto_percent: values.discount_percent,
        validade_dias: values.validity_days,
        tom,
        foco
      },
      user.token
    ) as any

    if (contextResult.error) {
      return NextResponse.json(
        { error: contextResult.error },
        { status: 400, headers: { 'x-trace-id': traceId } }
      )
    }

    // 4. Build context for AI
    const proposalContext: ProposalContext = {
      lead: {
        name: contextResult.contexto.lead.nome,
        company_name: contextResult.contexto.lead.empresa !== 'Não informada' 
          ? contextResult.contexto.lead.empresa 
          : undefined,
        email: contextResult.contexto.lead.email !== 'Não informado'
          ? contextResult.contexto.lead.email
          : undefined,
        description: contextResult.contexto.lead.descricao !== 'Não informada'
          ? contextResult.contexto.lead.descricao
          : undefined,
        stage: contextResult.contexto.lead.estagio,
        notes: contextResult.contexto.notas_historico.filter((n: string) => n !== 'Nenhuma nota registrada'),
        bant_score: contextResult.contexto.qualificacao_bant?.score ?? 0
      },
      products: products.map(p => ({
        nome: p.nome,
        descricao: p.descricao,
        quantidade: p.quantidade,
        preco_unitario: p.preco_unitario
      })),
      values: {
        subtotal: values.subtotal,
        discount_percent: values.discount_percent,
        total: values.total,
        validity_days: values.validity_days
      },
      seller,
      tom,
      foco
    }

    const proposalInput = buildProposalInput(proposalContext)

    // 5. Generate text with OpenAI
    if (stream) {
      const encoder = new TextEncoder()
      
      const streamResponse = new ReadableStream({
        async start(controller) {
          try {
            // Send init event
            controller.enqueue(encoder.encode(JSON.stringify({ 
              k: 'init', 
              traceId,
              lead: proposalContext.lead.name
            }) + '\n'))

            let fullContent = ''

            // Create streaming response
            const response = await openai.responses.create({
              model: 'gpt-5.1',
              instructions: getProposalWriterPromptWithTime(),
              input: proposalInput,
              stream: true
            })

            for await (const event of response) {
              const eventType = (event as any).type

              if (eventType === 'response.output_text.delta') {
                const delta = (event as any).delta || ''
                fullContent += delta
                controller.enqueue(encoder.encode(JSON.stringify({ 
                  k: 't', 
                  d: delta 
                }) + '\n'))
              }
            }

            const duration = Date.now() - startTime
            console.log(`[proposal-writer] Generated ${fullContent.length} chars in ${duration}ms`)

            // Send completion event
            controller.enqueue(encoder.encode(JSON.stringify({ 
              k: 'done', 
              full: fullContent,
              duration
            }) + '\n'))
            
            controller.close()

          } catch (error) {
            console.error('[proposal-writer] Stream error:', error)
            controller.enqueue(encoder.encode(JSON.stringify({
              k: 'err',
              d: error instanceof Error ? error.message : 'Erro ao gerar texto'
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
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'x-trace-id'
        }
      })
    }

    // Non-streaming response
    const response = await openai.responses.create({
      model: 'gpt-5.1',
      instructions: getProposalWriterPromptWithTime(),
      input: proposalInput
    })

    const generatedText = response.output_text || ''
    const duration = Date.now() - startTime
    console.log(`[proposal-writer] Generated ${generatedText.length} chars in ${duration}ms`)

    return NextResponse.json(
      {
        text: generatedText,
        lead: proposalContext.lead.name,
        duration
      },
      {
        headers: {
          'x-trace-id': traceId,
          'Access-Control-Allow-Origin': '*'
        }
      }
    )

  } catch (error) {
    console.error('[proposal-writer] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { 
        status: error instanceof Error && error.message.includes('autenticação') ? 401 : 500, 
        headers: { 'x-trace-id': traceId } 
      }
    )
  }
}

