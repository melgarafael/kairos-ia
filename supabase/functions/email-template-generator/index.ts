// @ts-nocheck
import { serve } from 'https://deno.land/std@0.181.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

function getCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin') || '*'
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': req.headers.get('access-control-request-headers') || '*',
    'access-control-allow-methods': 'POST,OPTIONS',
    'access-control-max-age': '86400',
    'vary': 'origin'
  }
}

function extractOutputText(obj: any): string {
  try {
    if (!obj) return ''
    // Try output_text first (most direct)
    if (typeof obj.output_text === 'string' && obj.output_text.trim()) return obj.output_text.trim()
    // Try output array with content structure
    if (Array.isArray(obj.output) && obj.output.length) {
      const texts: string[] = []
      for (const item of obj.output) {
        const contents = (item && item.content) || []
        if (Array.isArray(contents)) {
          for (const c of contents) {
            const t = c?.text?.value || c?.text || c?.value || c?.content || ''
            if (typeof t === 'string' && t.trim()) texts.push(t)
          }
        } else if (item?.type === 'text' && item?.text) {
          texts.push(item.text)
        } else if (typeof item === 'string') {
          texts.push(item)
        }
      }
      if (texts.length) return texts.join('\n').trim()
    }
    // Legacy fallback (chat.completions-like)
    if (Array.isArray(obj.choices) && obj.choices.length) {
      const t = obj.choices[0]?.message?.content || obj.choices[0]?.text || ''
      if (typeof t === 'string') return t.trim()
    }
    // Simple text field
    if (typeof obj.text === 'string' && obj.text.trim()) return obj.text.trim()
    // String directly
    if (typeof obj === 'string') return obj.trim()
  } catch (e) {
    console.error('extractOutputText error:', e)
  }
  return ''
}

async function openAIResponses(apiKey: string, payload: Record<string, any>) {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  const cors = getCorsHeaders(req)
  const traceId = crypto.randomUUID()
  
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: { ...cors, 'x-trace-id': traceId } })
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || ''
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY' }), { 
        status: 500, 
        headers: { ...cors, 'content-type': 'application/json', 'x-trace-id': traceId } 
      })
    }

    const body = await req.json().catch(() => ({})) as { 
      objective?: string
      user_context?: string
    }
    
    const objective = String(body?.objective || '').trim()
    if (!objective) {
      return new Response(JSON.stringify({ error: 'Missing objective' }), { 
        status: 400, 
        headers: { ...cors, 'content-type': 'application/json', 'x-trace-id': traceId } 
      })
    }

    // System prompt com conhecimento contextual do Tomik CRM e design mágico
    const systemPrompt = `Você é um especialista em design de emails HTML com estilo Apple/Steve Jobs. Você tem conhecimento completo sobre o Tomik CRM, um sistema SaaS multi-tenant de CRM.

CONTEXTO DO TOMIK CRM:
- Arquitetura: Sistema multi-tenant com Master Supabase (gerenciamento) e Client Supabase (dados isolados por organização)
- Features principais:
  * CRM: Gestão de leads com Kanban, estágios customizáveis, automações
  * Agenda: Agendamentos, calendário, integração com WhatsApp
  * Financeiro: Controle de entradas/saídas, relatórios, integração com pagamentos
  * Automações: Integração nativa com n8n para workflows personalizados
  * Webhooks: Sistema de webhooks para integrações externas
  * WhatsApp: Integração completa para atendimento e vendas
  * Q&A: Sistema de perguntas e respostas com IA
  * Gestor de Prompts: Biblioteca de prompts para agentes de IA
  * Biblioteca de Nodes: Templates prontos de nodes Supabase para n8n
- Planos e Monetização:
  * Sistema de tokens (saas_plan_tokens) para controle de acesso
  * Add-ons: Assentos extras (member_seats_extra), trilhas de estudo (trail_product_ids)
  * Tipos de conta (account_type) com diferentes níveis de acesso
- Integrações:
  * n8n: Automações avançadas com workflows visuais
  * Supabase: BYO (Bring Your Own) Supabase para isolamento de dados
  * WhatsApp: Integração via WuzAPI para comunicação
- Benefícios principais:
  * Multi-tenant seguro com isolamento de dados
  * Automações poderosas com n8n
  * Interface elegante estilo Apple
  * Escalável e customizável

A MAGIA DO DESIGN STEVE JOBS:
Steve Jobs não vendia produtos, ele vendia sonhos. Cada elemento visual deve criar profundidade, luz e sombra para guiar o olhar e criar emoção.

PROFUNDIDADE VISUAL (Depth):
- Use sombras em camadas: box-shadow com múltiplas camadas cria profundidade real
- Exemplo: box-shadow: 0 2px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.12);
- Cards devem "flutuar" acima do fundo com sombras suaves
- Crie hierarquia visual: elementos importantes têm mais profundidade

LUZ E SOMBRA (Light & Shadow):
- Gradientes sutis simulam luz natural vindo de cima
- Exemplo: background: linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%);
- Sombras mais escuras embaixo criam sensação de elevação
- Use rgba com opacidade baixa (0.05-0.15) para sombras elegantes

COMUNICAÇÃO MÁGICA:
- Não liste features, conte histórias sobre transformação
- Use linguagem inspiradora: "Imagine", "Descubra", "Transforme"
- Foque em benefícios emocionais, não apenas funcionais
- Cada palavra deve criar conexão emocional

DESTACAR FEATURES VISUALMENTE:
Quando listar features, SEMPRE use cards/seções visuais com:
- Background branco ou gradiente sutil (#ffffff a #f8f9fa)
- Bordas arredondadas (16-20px)
- Sombras elegantes (box-shadow: 0 4px 12px rgba(0,0,0,0.08))
- Espaçamento generoso entre cards (24-32px)
- Ícones ou elementos visuais quando possível
- Cada feature em seu próprio card/container destacado

PRINCÍPIOS DE DESIGN APPLE:
- Simplicidade: Menos é mais. Espaço em branco é poderoso (40-60px entre seções).
- Tipografia: Use fontes do sistema (-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif).
  * Títulos principais: 36-40px, font-weight: 600-700, line-height: 1.1
  * Subtítulos: 24-28px, font-weight: 600, line-height: 1.2
  * Corpo: 17px, font-weight: 400, line-height: 1.6
  * Texto secundário: 15px, color: #86868b
- Cores: Paleta minimalista e elegante.
  * Fundo principal: #f5f5f7 ou #ffffff
  * Texto primário: #1d1d1f
  * Texto secundário: #86868b
  * Gradientes sutis: linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%)
  * Acentos: Use cores suaves como #007aff (azul Apple) ou gradientes roxo-azul sutis
- Espaçamento: Generoso e respirável.
  * Padding de seções: 48-64px
  * Espaçamento entre elementos: 24-32px
  * Margem entre cards: 20-24px
- Hierarquia Visual: Crie profundidade com tamanhos, pesos e espaçamento.
- Elementos Visuais:
  * Bordas arredondadas: 16-20px para cards, 12px para botões
  * Sombras em camadas: box-shadow: 0 2px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.12)
  * Gradientes sutis para profundidade
- CTA (Call to Action):
  * Botões com gradiente elegante: linear-gradient(180deg, #007aff 0%, #0051d5 100%)
  * Padding generoso: 16px 40px
  * Border-radius: 12px
  * Sombra: box-shadow: 0 4px 12px rgba(0,122,255,0.3)
  * Hover effect: box-shadow: 0 6px 16px rgba(0,122,255,0.4)

ESTRUTURA DO EMAIL MÁGICO:
1. Header com gradiente elegante e profundidade (opcional, mas recomendado)
2. Hero section: Título inspirador grande (36-40px) com espaçamento generoso
3. Conteúdo principal: Bem espaçado (48-64px padding)
4. Features destacadas: Cada feature em card próprio com:
   - Background branco (#ffffff)
   - Sombra elegante (box-shadow: 0 4px 12px rgba(0,0,0,0.08))
   - Bordas arredondadas (16-20px)
   - Padding interno (24-32px)
   - Espaçamento entre cards (20-24px)
5. CTA button destacado com gradiente e sombra
6. Footer minimalista

IMPORTANTE:
- Retorne APENAS o HTML, sem markdown, sem explicações, sem código entre backticks
- Use inline styles (email clients não suportam CSS externo)
- Suporte variáveis {nome}, {name}, {email} para personalização
- Max-width: 600px para o container principal
- Design responsivo e compatível com clientes de email
- Use tabelas quando necessário para compatibilidade (emails antigos)
- SEMPRE destaque features em cards/seções visuais separadas, nunca apenas texto corrido
- Cada feature deve ter seu próprio card com background, sombra e espaçamento
- Use gradientes sutis para criar profundidade
- Sombras devem ser suaves e elegantes (rgba com opacidade 0.08-0.12)
- Linguagem inspiradora e emocional, não apenas informativa
- Crie hierarquia visual clara com tamanhos de fonte e espaçamento`

    // Construir input para a API
    const input: any[] = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Objetivo do email: ${objective}

${body?.user_context ? `Contexto adicional: ${body.user_context}\n\n` : ''}

Crie um template de email HTML elegante e mágico estilo Apple/Steve Jobs que incorpore informações relevantes do Tomik CRM de forma natural. O email deve ser profissional, inspirador e seguir os princípios de design minimalista da Apple.`
      }
    ]

    // Payload para OpenAI Responses API (sem tool_resources, pois não é suportado)
    const payload: any = {
      model: 'gpt-4.1-mini',
      input,
      temperature: 0.3,
      max_output_tokens: 2000
    }

    const { ok, status, json } = await openAIResponses(OPENAI_API_KEY, payload)
    
    if (!ok) {
      console.error('OpenAI API error:', status, json)
      return new Response(JSON.stringify({ error: 'openai_error', details: json, traceId }), { 
        status: 500, 
        headers: { ...cors, 'content-type': 'application/json', 'x-trace-id': traceId } 
      })
    }

    // Log response structure for debugging
    console.log('OpenAI response structure:', JSON.stringify(json).substring(0, 500))

    const text = extractOutputText(json)
    const finalText = (text && text.trim()) || ''

    if (!finalText) {
      console.error('Empty response extracted. Full JSON:', JSON.stringify(json).substring(0, 1000))
      return new Response(JSON.stringify({ 
        error: 'empty_response', 
        debug: { 
          hasJson: !!json, 
          jsonKeys: json ? Object.keys(json) : [],
          jsonPreview: JSON.stringify(json).substring(0, 500)
        },
        traceId 
      }), { 
        status: 500, 
        headers: { ...cors, 'content-type': 'application/json', 'x-trace-id': traceId } 
      })
    }

    return new Response(JSON.stringify({ reply: finalText, traceId }), { 
      status: 200, 
      headers: { ...cors, 'content-type': 'application/json', 'x-trace-id': traceId } 
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'internal_error', message: e?.message || String(e), traceId }), { 
      status: 500, 
      headers: { ...cors, 'content-type': 'application/json', 'x-trace-id': traceId } 
    })
  }
})

