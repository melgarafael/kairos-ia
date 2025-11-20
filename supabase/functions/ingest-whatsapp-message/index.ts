// @ts-expect-error Remote Deno std import resolved by Edge runtime
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

// Local type shim so TS recognizes Deno in editor; no runtime impact
declare const Deno: { env: { get(name: string): string | undefined } }

function getCorsHeaders(req: Request): HeadersInit {
  const reqHeaders = req.headers.get('Access-Control-Request-Headers') || 'authorization, x-client-info, apikey, content-type'
  return {
    'Access-Control-Allow-Origin': '*',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': reqHeaders,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  }
}

function normalizePhoneE164(phone: string | null | undefined): string | null {
  if (!phone) return null
  let p = phone.trim()
  if (!p.startsWith('+')) {
    // assume BR if missing +
    p = '+' + p.replace(/\D/g, '')
  }
  return p
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: getCorsHeaders(req) })
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })

    // @ts-expect-error Remote ESM import is resolved by Deno at runtime (Supabase Edge)
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return new Response('Missing env', { status: 500, headers: getCorsHeaders(req) })
    const supabase = createClient(supabaseUrl, serviceKey)

    const body = await req.json().catch(() => ({})) as any

    const provider = String(body?.provider || '') || null
    const direction = (String(body?.direction || '').toLowerCase() === 'outbound') ? 'outbound' : 'inbound'
    const sender_type = ((): 'cliente' | 'ia' | 'humano' => {
      const s = String(body?.sender_type || '').toLowerCase()
      if (s === 'ia') return 'ia'
      if (s === 'humano') return 'humano'
      return 'cliente'
    })()
    const whatsapp_cliente = normalizePhoneE164(body?.whatsapp_cliente)
    const whatsapp_empresa = normalizePhoneE164(body?.whatsapp_empresa)
    const content_text = (typeof body?.content_text === 'string') ? body.content_text : null
    const content_raw = (typeof body?.content_raw === 'object' && body?.content_raw) ? body.content_raw : null
    const has_media = Boolean(body?.has_media)
    const media_type = body?.media_type || null
    const media_url = body?.media_url || null
    const media_size_bytes = Number.isFinite(body?.media_size_bytes) ? Number(body.media_size_bytes) : null
    const provider_message_id = body?.provider_message_id || null
    const thread_id = body?.thread_id || null
    const reply_to_provider_message_id = body?.reply_to_provider_message_id || null
    const language = body?.language || null
    const labels = Array.isArray(body?.labels) ? body.labels : []
    const ai_model = body?.ai_model || null
    const ai_agent_id = body?.ai_agent_id || null
    const human_operator_id = body?.human_operator_id || null

    if (!whatsapp_cliente || !whatsapp_empresa) {
      return new Response('Missing whatsapp numbers', { status: 400, headers: getCorsHeaders(req) })
    }

    const payload = {
      provider,
      direction,
      sender_type,
      whatsapp_cliente,
      whatsapp_empresa,
      content_text,
      content_raw,
      has_media,
      media_type,
      media_url,
      media_size_bytes,
      provider_message_id,
      thread_id,
      reply_to_provider_message_id,
      language,
      labels,
      ai_model,
      ai_agent_id,
      human_operator_id,
      organization_id: (body?.organization_id || null)
    }

    const { data, error } = await supabase
      .from('repositorio_de_mensagens')
      .upsert(payload, { onConflict: 'provider_message_id' })
      .select()
      .limit(1)

    if (error) {
      return new Response(`Error: ${error.message}`, { status: 400, headers: getCorsHeaders(req) })
    }

    return new Response(JSON.stringify({ ok: true, data: data?.[0] || null }), {
      status: 200,
      headers: { 'content-type': 'application/json', ...getCorsHeaders(req) }
    })
  } catch (err: any) {
    return new Response(`Error: ${err?.message || err}`, { status: 500, headers: getCorsHeaders(req) })
  }
})


