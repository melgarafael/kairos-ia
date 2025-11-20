// Edge Function: grant-trial-bonus
// Extende trial_ends_at do usuário autenticado em +7 dias a partir do maior entre agora e a data atual
// Telemetria: insere evento em saas_events (best-effort)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

function getCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin') || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })

  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
  const MASTER_SUPABASE_URL = Deno.env.get('MASTER_SUPABASE_URL')
  const MASTER_SUPABASE_ANON_KEY = Deno.env.get('MASTER_SUPABASE_ANON_KEY')
  const MASTER_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('MASTER_SUPABASE_SERVICE_ROLE_KEY')
  if (!MASTER_SUPABASE_URL || !MASTER_SUPABASE_ANON_KEY || !MASTER_SUPABASE_SERVICE_ROLE_KEY) {
    return new Response('Missing env', { status: 500, headers: getCorsHeaders(req) })
  }

  const authHeader = req.headers.get('authorization') || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''
  const supabaseUser = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${bearer || MASTER_SUPABASE_ANON_KEY}` } } })
  const supabaseSrv = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY)

  // Authenticate user
  const { data: userData, error: userErr } = await supabaseUser.auth.getUser()
  if (userErr || !userData?.user?.id) {
    return new Response('Not authenticated', { status: 401, headers: getCorsHeaders(req) })
  }
  const userId = userData.user.id

  // Extend trial_ends_at: GREATEST(trial_ends_at, now()) + 7 days
  const { data: row, error: updErr } = await supabaseSrv.rpc('grant_trial_bonus_internal', { p_user_id: userId, p_days: 7 })
  if (updErr) {
    return new Response(updErr.message || 'update_failed', { status: 400, headers: getCorsHeaders(req) })
  }

  // Telemetry (best-effort)
  try {
    await supabaseSrv.from('saas_events').insert({ user_id: userId, event_name: 'trial_bonus_granted', props: { days: 7, extended_to: row?.trial_ends_at || null } })
  } catch {}

  return new Response(JSON.stringify({ ok: true, extended_to: row?.trial_ends_at || null }), {
    status: 200,
    headers: { 'content-type': 'application/json', ...getCorsHeaders(req) }
  })
})


