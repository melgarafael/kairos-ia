// @ts-nocheck

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

type Action = 'start' | 'refresh' | 'end'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')

    const MASTER_SUPABASE_URL = Deno.env.get('MASTER_SUPABASE_URL')
    const MASTER_SUPABASE_ANON_KEY = Deno.env.get('MASTER_SUPABASE_ANON_KEY')
    if (!MASTER_SUPABASE_URL || !MASTER_SUPABASE_ANON_KEY) {
      return new Response('Missing env', { status: 500, headers: getCorsHeaders(req) })
    }

    const authHeader = req.headers.get('authorization') || ''
    const headerBearer = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : ''

    // Parse body early to potentially use token as authentication fallback
    const url = new URL(req.url)
    const action = (url.searchParams.get('action') || 'start') as Action
    const body = await req.json().catch(() => ({})) as any

    const bodyToken: string = body?.token || body?.access_token || ''
    const effectiveBearer = headerBearer || bodyToken || ''

    // Use the user bearer token if provided, else fall back to anon (will fail RPC if not authed)
    // Important: API key must be the anon key; JWT goes in Authorization header
    const supabase = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${effectiveBearer || MASTER_SUPABASE_ANON_KEY}` } }
    })

    // body already parsed above

    const userAgent = req.headers.get('user-agent') || body.user_agent || null
    const ip = (req.headers.get('cf-connecting-ip')
      || req.headers.get('x-forwarded-for')
      || req.headers.get('x-real-ip')
      || body.ip_address
      || '') as string

    // Helper: sha256 hex
    async function sha256Hex(input: string): Promise<string> {
      const enc = new TextEncoder().encode(input)
      const digest = await crypto.subtle.digest('SHA-256', enc)
      const bytes = new Uint8Array(digest)
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    }

    // Resolve current user id from JWT
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user?.id) {
      // Heartbeats e refresh podem ocorrer logo após app abrir; evitar ruído com 202
      if (action === 'refresh' || action === 'start') {
        return new Response('unauthenticated_skip', { status: 202, headers: getCorsHeaders(req) })
      }
      return new Response('Not authenticated', { status: 401, headers: getCorsHeaders(req) })
    }
    const userId = userData.user.id

    if (action === 'start') {
      const { token, refresh_token, expires_at } = body || {}
      if (!token || !refresh_token || !expires_at) {
        return new Response('Missing fields', { status: 400, headers: getCorsHeaders(req) })
      }
      const tokenHash = await sha256Hex(token)
      const refreshHash = await sha256Hex(refresh_token)
      const payload = {
        user_id: userId,
        token_hash: tokenHash,
        refresh_token_hash: refreshHash,
        expires_at: new Date(expires_at).toISOString(),
        ip_address: ip || null,
        user_agent: userAgent,
        active: true,
        created_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString()
      }
      const { error } = await supabase.from('saas_sessions').upsert(payload, { onConflict: 'token_hash' })
      if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
      return new Response('started', { status: 200, headers: getCorsHeaders(req) })
    }

    if (action === 'refresh') {
      const { old_token, token, refresh_token, expires_at } = body || {}
      if (!token || !refresh_token || !expires_at) {
        return new Response('Missing fields', { status: 400, headers: getCorsHeaders(req) })
      }
      const newHash = await sha256Hex(token)
      const newRefreshHash = await sha256Hex(refresh_token)
      const oldHash = old_token ? await sha256Hex(old_token) : null
      if (oldHash) {
        const { error: updErr } = await supabase
          .from('saas_sessions')
          .update({
            token_hash: newHash,
            refresh_token_hash: newRefreshHash,
            expires_at: new Date(expires_at).toISOString(),
            ip_address: ip || null,
            user_agent: userAgent,
            active: true,
            last_seen_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('token_hash', oldHash)
        if (!updErr) return new Response('refreshed', { status: 200, headers: getCorsHeaders(req) })
      }
      const { error } = await supabase.from('saas_sessions').upsert({
        user_id: userId,
        token_hash: newHash,
        refresh_token_hash: newRefreshHash,
        expires_at: new Date(expires_at).toISOString(),
        ip_address: ip || null,
        user_agent: userAgent,
        active: true,
        created_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString()
      }, { onConflict: 'token_hash' })
      if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
      return new Response('refreshed', { status: 200, headers: getCorsHeaders(req) })
    }

    if (action === 'end') {
      const tokenBody = (body || {}).token
      const tokenToEnd = tokenBody || headerBearer
      if (!tokenToEnd) return new Response('Missing token', { status: 400, headers: getCorsHeaders(req) })
      const hash = await sha256Hex(tokenToEnd)
      const { error } = await supabase
        .from('saas_sessions')
        .update({ active: false, ended_at: new Date().toISOString(), last_seen_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('token_hash', hash)
      if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
      return new Response('ended', { status: 200, headers: getCorsHeaders(req) })
    }

    return new Response('Unknown action', { status: 400, headers: getCorsHeaders(req) })
  } catch (err: any) {
    return new Response(`Error: ${err?.message || err}`, { status: 500, headers: getCorsHeaders(req) })
  }
})



