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

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    s = '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function cleanBase64(str: string): string {
  if (!str) return ''
  let cleaned = str.replace(/[^A-Za-z0-9+/=]/g, '')
  while (cleaned.length % 4 !== 0) cleaned += '='
  return cleaned
}

function tryDecryptKey(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null
  try {
    const cleaned = cleanBase64(encrypted)
    // atob may throw if not base64; catch and fallback to raw
    return atob(cleaned)
  } catch {
    return encrypted
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: getCorsHeaders(req) })
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })

    // @ts-expect-error Remote ESM import is resolved by Deno at runtime (Supabase Edge)
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')

    // Validate master user
    const MASTER_SUPABASE_URL = Deno.env.get('MASTER_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')
    const MASTER_SUPABASE_ANON_KEY = Deno.env.get('MASTER_SUPABASE_ANON_KEY')
    const MASTER_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('MASTER_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!MASTER_SUPABASE_URL || !MASTER_SUPABASE_ANON_KEY || !MASTER_SUPABASE_SERVICE_ROLE_KEY) {
      return new Response('Missing master env', { status: 500, headers: getCorsHeaders(req) })
    }

    const authHeader = req.headers.get('authorization') || ''
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''

    const masterUserClient = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${bearer || MASTER_SUPABASE_ANON_KEY}` } }
    })
    const masterSrv = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY)

    const { data: userInfo, error: userErr } = await masterUserClient.auth.getUser()
    if (userErr || !userInfo?.user?.id) {
      return new Response('Not authenticated', { status: 401, headers: getCorsHeaders(req) })
    }

    // Fetch client's Supabase credentials from master.saas_users
    const { data: su, error: suErr } = await masterSrv
      .from('saas_users')
      .select('supabase_url, supabase_key_encrypted, service_role_encrypted, organization_id')
      .eq('id', userInfo.user.id)
      .single()
    if (suErr || !su?.supabase_url) {
      return new Response('Client credentials not found', { status: 400, headers: getCorsHeaders(req) })
    }

    const clientUrl = su.supabase_url as string
    const clientServiceKey = tryDecryptKey(su.service_role_encrypted) || tryDecryptKey(su.supabase_key_encrypted)
    if (!clientUrl || !clientServiceKey) {
      return new Response('Client key missing', { status: 400, headers: getCorsHeaders(req) })
    }

    const client = createClient(clientUrl, clientServiceKey)

    const body = await req.json().catch(() => ({})) as any
    const { p_inicio, p_fim, p_sender, p_numero, p_query, organization_id } = body || {}

    const fromIso = p_inicio ? new Date(p_inicio).toISOString() : new Date(0).toISOString()
    const toIso = p_fim ? new Date(p_fim).toISOString() : new Date().toISOString()
    const orgId = organization_id || su.organization_id || null

    const columns = [
      'id','created_at','whatsapp_cliente','whatsapp_empresa','sender_type','direction','provider','provider_message_id','thread_id','conversation_id','reply_to_provider_message_id','language','labels','has_media','media_type','media_url','media_size_bytes','content_text'
    ] as const

    const header = columns.join(',') + '\n'
    let csv = header

    const pageSize = 1000
    let page = 0
    while (true) {
      const offset = page * pageSize
      const { data, error } = await client.rpc('rm_buscar', {
        p_inicio: fromIso,
        p_fim: toIso,
        p_sender: p_sender || null,
        p_numero: p_numero || null,
        p_query: p_query || null,
        p_limit: pageSize,
        p_offset: offset,
        p_org: orgId
      })
      if (error) {
        return new Response(`Error: ${error.message}`, { status: 400, headers: getCorsHeaders(req) })
      }
      const rows = (data || []) as any[]
      if (rows.length === 0) break
      for (const r of rows) {
        const line = [
          r.id,
          r.created_at,
          r.whatsapp_cliente,
          r.whatsapp_empresa,
          r.sender_type,
          r.direction,
          r.provider,
          r.provider_message_id,
          r.thread_id,
          r.conversation_id,
          r.reply_to_provider_message_id,
          r.language,
          Array.isArray(r.labels) ? r.labels.join('|') : '',
          r.has_media,
          r.media_type,
          r.media_url,
          r.media_size_bytes,
          r.content_text,
        ].map(csvEscape).join(',')
        csv += line + '\n'
      }
      if (rows.length < pageSize) break
      page += 1
      if (page > 5000) break
    }

    const filename = `whatsapp-mensagens-${new Date().toISOString().slice(0,10)}.csv`
    return new Response(csv, {
      status: 200,
      headers: {
        ...getCorsHeaders(req),
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (err: any) {
    return new Response(`Error: ${err?.message || err}`, { status: 500, headers: getCorsHeaders(req) })
  }
})

