// @ts-nocheck
/* eslint-disable */
// Edge Function: sync-org-to-master
// Receives webhook from CLIENT Supabase on org insert/update/delete
// Upserts mapping into MASTER public.saas_organizations (owner_id + client_org_id)

function getCorsHeaders(req: Request): HeadersInit {
  const allowedOrigins = (Deno.env.get('CORS_ORIGINS') || Deno.env.get('CORS_ORIGIN') || '')
    .split(',').map(s => s.trim()).filter(Boolean)
  const origin = req.headers.get('Origin') || ''
  const allowOrigin = allowedOrigins.length === 0 ? '*' : (allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  }
}

type ClientOrgPayload = {
  event: 'insert' | 'update' | 'delete'
  organization?: any
  org?: any
  owner_id?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })

  const secret = (req.headers.get('x-sync-secret') || '').trim()
  const expected = (Deno.env.get('SYNC_ORG_WEBHOOK_SECRET') || '').trim()
  if (!expected || secret !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  }

  const MASTER_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('MASTER_SUPABASE_URL')
  const MASTER_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('MASTER_SUPABASE_SERVICE_ROLE_KEY')
  if (!MASTER_URL || !MASTER_SERVICE) {
    return new Response(JSON.stringify({ error: 'Missing MASTER env' }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  }
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
  const master = createClient(MASTER_URL, MASTER_SERVICE)

  let payload: ClientOrgPayload
  try { payload = await req.json() } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } }) }

  const event = (payload?.event || '').toString() as 'insert'|'update'|'delete'
  const row = payload?.organization || payload?.org || {}
  const owner_id = (payload?.owner_id || row?.owner_id || '').toString()
  const client_org_id = (row?.id || row?.client_org_id || '').toString()
  const name = (row?.name || '').toString()
  const slug = (row?.slug || '').toString().toLowerCase()
  const nowIso = new Date().toISOString()

  if (!owner_id || !client_org_id) {
    return new Response(JSON.stringify({ error: 'owner_id and client_org_id required' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  }

  try {
    if (event === 'delete') {
      // Soft-disable mapping, do not delete (keeps linkage for recovery)
      await master
        .from('saas_organizations')
        .update({ active: false, updated_at: nowIso })
        .eq('owner_id', owner_id)
        .eq('client_org_id', client_org_id)
    } else {
      const upsertPayload: Record<string, any> = {
        owner_id,
        client_org_id,
        updated_at: nowIso
      }
      if (name) upsertPayload.name = name
      if (slug) upsertPayload.slug = slug
      if (typeof row?.is_active !== 'undefined') upsertPayload.active = !!row.is_active
      if (typeof row?.active !== 'undefined') upsertPayload.active = !!row.active

      const { error } = await master
        .from('saas_organizations')
        .upsert(upsertPayload, { onConflict: 'owner_id,client_org_id' })
      if (error) throw new Error(error.message)
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  }
})

export {}


