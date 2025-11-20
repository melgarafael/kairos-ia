// @ts-nocheck
import { serve } from 'https://deno.land/std@0.181.0/http/server.ts'

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  const cors = getCorsHeaders(req)
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors })

    const { query, source_id, category, limit = 10 } = await req.json().catch(() => ({}))
    if (!query) return new Response(JSON.stringify({ error: 'query_required' }), { status: 400, headers: { ...cors, 'content-type': 'application/json' } })

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || ''
    if (!OPENAI_API_KEY) return new Response(JSON.stringify({ error: 'missing_openai_key' }), { status: 500, headers: { ...cors, 'content-type': 'application/json' } })

    // Embedding da query
    const embResp = await fetch('https://api.openai.com/v1/embeddings', { method: 'POST', headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: 'text-embedding-3-small', input: query }) })
    const embJson = await embResp.json()
    const queryEmbedding = embJson?.data?.[0]?.embedding
    if (!queryEmbedding) return new Response(JSON.stringify({ error: 'embedding_failed' }), { status: 500, headers: { ...cors, 'content-type': 'application/json' } })

    const url = new URL(req.url)
    const projectUrl = url.origin.replace('.functions.supabase.co', '.supabase.co')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE') || Deno.env.get('UPDATE_SERVICE_ROLE_KEY') || ''

    const body = { p_query_embedding: queryEmbedding, p_source_id: source_id || null, p_category: category || null, p_limit: limit }
    const res = await fetch(`${projectUrl}/rest/v1/rpc/match_rag`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${serviceRole}`, 'apikey': serviceRole, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
    const matches = await res.json()
    return new Response(JSON.stringify({ ok: true, matches }), { headers: { ...cors, 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...cors, 'content-type': 'application/json' } })
  }
})



