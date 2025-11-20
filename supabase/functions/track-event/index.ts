// @ts-nocheck
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
    const MASTER_SUPABASE_URL = Deno.env.get('MASTER_SUPABASE_URL')
    const MASTER_SUPABASE_ANON_KEY = Deno.env.get('MASTER_SUPABASE_ANON_KEY')
    const MASTER_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('MASTER_SUPABASE_SERVICE_ROLE_KEY')
    if (!MASTER_SUPABASE_URL || !MASTER_SUPABASE_ANON_KEY) {
      return new Response('Missing env', { status: 500, headers: getCorsHeaders(req) })
    }
    // Parse body first to potentially use token as fallback for auth
    const body = await req.json().catch(() => ({})) as any
    const event_name = body?.event_name as string
    const props = (typeof body?.props === 'object' && body?.props) ? body.props : null
    const session_token = (body?.token as string) || null

    const authHeader = req.headers.get('authorization') || ''
    const headerBearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''
    const effectiveBearer = headerBearer || session_token || ''
    // Two clients: one to validate user (anon+Bearer), one service to insert bypassing RLS
    const supabaseUser = createClient(
      MASTER_SUPABASE_URL,
      MASTER_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${effectiveBearer || MASTER_SUPABASE_ANON_KEY}` } } }
    )
    const supabaseSrv = MASTER_SUPABASE_SERVICE_ROLE_KEY ? createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY) : null

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser()
    if (userErr || !userData?.user?.id) {
      // Em cenários de diagnóstico (ex.: safe_mode_activated chamado cedo no index.html)
      // evitamos ruidar o console com 401: retornamos 202 e ignoramos
      if (event_name === 'safe_mode_activated') {
        return new Response('unauthenticated_skip', { status: 202, headers: getCorsHeaders(req) })
      }
      return new Response('Not authenticated', { status: 401, headers: getCorsHeaders(req) })
    }
    if (!event_name) return new Response('Missing event_name', { status: 400, headers: getCorsHeaders(req) })

    let organization_id: string | null = null
    // Try to fetch org from saas_users
    let userRow: any = null
    if (supabaseSrv) {
      const { data: u } = await supabaseSrv.from('saas_users').select('id, organization_id').eq('id', userData.user.id).single()
      userRow = u
    } else {
      const { data: u } = await supabaseUser.from('saas_users').select('id, organization_id').eq('id', userData.user.id).single()
      userRow = u
    }
    if (!userRow?.id) {
      // Trigger may not have created saas_users yet; avoid FK error and accept
      return new Response('user_not_ready', { status: 202, headers: getCorsHeaders(req) })
    }
    // Org id vem de saas_users, mas pode não existir em uma tabela local de orgs no Master.
    // Para evitar FK/consistência cross-projeto, gravamos null (o painel não depende de org).
    organization_id = null

    let session_hash: string | null = null
    if (session_token) {
      const enc = new TextEncoder().encode(session_token)
      const digest = await crypto.subtle.digest('SHA-256', enc)
      const bytes = new Uint8Array(digest)
      session_hash = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    }

    const payload = {
      user_id: userData.user.id,
      organization_id,
      session_hash,
      event_name,
      props,
      created_at: new Date().toISOString()
    }
    // Try with service role first, then fallback to user client under RLS
    let insertError: any = null
    if (supabaseSrv) {
      const { error } = await supabaseSrv.from('saas_events').insert(payload)
      if (!error) return new Response('ok', { status: 200, headers: getCorsHeaders(req) })
      insertError = error
    }

    const { error: errorUser } = await supabaseUser.from('saas_events').insert(payload)
    if (!errorUser) return new Response('ok', { status: 200, headers: getCorsHeaders(req) })

    const msg = `insert_failed: ${insertError?.message || ''} | user_insert_failed: ${errorUser?.message || ''}`.trim()
    return new Response(msg, { status: 400, headers: getCorsHeaders(req) })
    return new Response('ok', { status: 200, headers: getCorsHeaders(req) })
  } catch (err: any) {
    return new Response(`Error: ${err?.message || err}`, { status: 500, headers: getCorsHeaders(req) })
  }
})


