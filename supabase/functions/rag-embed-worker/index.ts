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

    const { limit = 500 } = await req.json().catch(() => ({}))
    const url = new URL(req.url)
    const projectUrl = url.origin.replace('.functions.supabase.co', '.supabase.co')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE') || Deno.env.get('UPDATE_SERVICE_ROLE_KEY') || ''
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || ''
    if (!serviceRole || !OPENAI_API_KEY) return new Response(JSON.stringify({ error: 'missing_env' }), { status: 500, headers: { ...cors, 'content-type': 'application/json' } })

    // Buscar itens sem embedding
    const res = await fetch(`${projectUrl}/rest/v1/rag_items?select=id,content&embedding=is.null&order=id.asc&limit=${encodeURIComponent(String(limit))}`, { headers: { 'Authorization': `Bearer ${serviceRole}`, 'apikey': serviceRole } })
    const items = await res.json()
    if (!Array.isArray(items) || items.length === 0) return new Response(JSON.stringify({ ok: true, updated: 0 }), { headers: { ...cors, 'content-type': 'application/json' } })

    // Embeddings em lotes
    const batchSize = 100
    let updated = 0
    for (let i = 0; i < items.length; i += batchSize) {
      const slice = items.slice(i, i + batchSize)
      const input = slice.map((r: any) => r.content)

      const resp = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'text-embedding-3-small', input })
      })
      const json = await resp.json()
      const vectors: number[][] = (json?.data || []).map((d: any) => d.embedding)

      // Atualizar
      for (let j = 0; j < slice.length; j++) {
        const it = slice[j]; const emb = vectors[j]
        if (!emb) continue
        await fetch(`${projectUrl}/rest/v1/rag_items?id=eq.${it.id}`, {
          method: 'PATCH', headers: { 'Authorization': `Bearer ${serviceRole}`, 'apikey': serviceRole, 'content-type': 'application/json' },
          body: JSON.stringify({ embedding: emb })
        })
        updated++
      }
    }

    return new Response(JSON.stringify({ ok: true, updated }), { headers: { ...cors, 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...cors, 'content-type': 'application/json' } })
  }
})



