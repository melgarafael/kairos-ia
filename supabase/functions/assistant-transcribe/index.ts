import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const allowedOrigins = (Deno.env.get('CORS_ORIGINS') || Deno.env.get('CORS_ORIGIN') || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

function getCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('Origin') || ''
  const allowOrigin = allowedOrigins.length === 0
    ? '*'
    : (allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) {
      return new Response('Missing OPENAI_API_KEY', { status: 500, headers: getCorsHeaders(req) })
    }

    const form = await req.formData()
    const file = form.get('file') as File | null || (form.get('audio') as File | null)
    if (!file) return new Response('No file provided', { status: 400, headers: getCorsHeaders(req) })

    const upstream = new FormData()
    upstream.append('file', new Blob([await file.arrayBuffer()], { type: file.type || 'audio/webm' }), file.name || 'audio.webm')
    upstream.append('model', 'whisper-1')
    upstream.append('response_format', 'json')
    upstream.append('temperature', '0')

    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: upstream
    })

    if (!resp.ok) {
      const txt = await resp.text()
      return new Response(`OpenAI transcription error: ${txt}`, { status: 500, headers: getCorsHeaders(req) })
    }

    const json = await resp.json()
    return new Response(JSON.stringify({ text: json.text || '' }), {
      headers: { 'content-type': 'application/json', ...getCorsHeaders(req) }
    })
  } catch (err: any) {
    return new Response(`Error: ${err?.message || err}`, { status: 500, headers: getCorsHeaders(req) })
  }
})


