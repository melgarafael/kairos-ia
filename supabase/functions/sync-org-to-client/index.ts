// @ts-nocheck
/* eslint-disable */
// Edge Function: sync-org-to-client
// Called from MASTER (via DB trigger) to propagate org metadata changes to CLIENT Supabase

function getCorsHeaders(req: Request): HeadersInit {
  const allowedOrigins = (Deno.env.get('CORS_ORIGINS') || Deno.env.get('CORS_ORIGIN') || '')
    .split(',').map(s => s.trim()).filter(Boolean)
  const origin = req.headers.get('Origin') || ''
  const allowOrigin = allowedOrigins.length === 0 ? '*' : (allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  }
}

function cleanBase64(str: string) {
  let s = (str || '').toString().trim().replace(/\s+/g, '')
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4 !== 0) s += '='
  return s
}

type MasterNotify = {
  event: 'insert' | 'update'
  master_org_id: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })

  const MASTER_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('MASTER_SUPABASE_URL')
  const MASTER_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('MASTER_SUPABASE_SERVICE_ROLE_KEY')
  if (!MASTER_URL || !MASTER_SERVICE) {
    return new Response(JSON.stringify({ error: 'Missing MASTER env' }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  }
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
  const master = createClient(MASTER_URL, MASTER_SERVICE)

  let body: MasterNotify
  try { body = await req.json() } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } }) }
  const masterOrgId = (body?.master_org_id || '').toString().trim()
  if (!masterOrgId) return new Response(JSON.stringify({ error: 'master_org_id is required' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })

  try {
    // Load org and client credentials from MASTER
    const { data: org, error: orgErr } = await master
      .from('saas_organizations')
      .select('id, owner_id, client_org_id, name, slug, active, client_supabase_url, client_service_key_encrypted')
      .eq('id', masterOrgId)
      .maybeSingle()
    if (orgErr) throw new Error(orgErr.message)
    if (!org?.client_org_id || !org?.client_supabase_url || !org?.client_service_key_encrypted) {
      return new Response(JSON.stringify({ ok: false, skipped: true, reason: 'Missing client linkage or credentials' }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    const clientUrl = String(org.client_supabase_url)
    let serviceKey = ''
    try { serviceKey = atob(cleanBase64(String(org.client_service_key_encrypted))) } catch {}
    if (!clientUrl || !serviceKey) {
      return new Response(JSON.stringify({ ok: false, skipped: true, reason: 'Invalid client credentials' }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    const client = createClient(clientUrl, serviceKey)
    const payload: Record<string, any> = {}
    if (org?.name) payload.name = String(org.name)
    if (org?.slug) payload.slug = String(org.slug)
    if (typeof org?.active !== 'undefined') payload.is_active = !!org.active

    // Try update first
    const { data: upd, error: updErr } = await client
      .from('saas_organizations')
      .update(payload)
      .eq('id', org.client_org_id)
      .select('id')
      .maybeSingle()
    if (updErr) throw new Error(updErr.message)

    // If not found, insert (idempotent upsert by id)
    if (!upd?.id) {
      const { error: insErr } = await client
        .from('saas_organizations')
        .upsert({ id: org.client_org_id, owner_id: org.owner_id, ...payload }, { onConflict: 'id' })
      if (insErr) throw new Error(insErr.message)
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  }
})

export {}


