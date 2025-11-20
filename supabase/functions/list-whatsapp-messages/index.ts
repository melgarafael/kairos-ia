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

function cleanBase64(str: string): string { if (!str) return ''; let c = str.replace(/[^A-Za-z0-9+/=]/g, ''); while (c.length % 4 !== 0) c += '='; return c }
function tryDecryptKey(encrypted: string | null | undefined): string | null { if (!encrypted) return null; try { return atob(cleanBase64(encrypted)) } catch { return encrypted } }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: getCorsHeaders(req) })
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })

    // @ts-expect-error Remote ESM import is resolved by Deno at runtime (Supabase Edge)
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
    const MASTER_SUPABASE_URL = Deno.env.get('MASTER_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')
    const MASTER_SUPABASE_ANON_KEY = Deno.env.get('MASTER_SUPABASE_ANON_KEY')
    const MASTER_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('MASTER_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!MASTER_SUPABASE_URL || !MASTER_SUPABASE_ANON_KEY || !MASTER_SUPABASE_SERVICE_ROLE_KEY) {
      return new Response('Missing master env', { status: 500, headers: getCorsHeaders(req) })
    }

    const authHeader = req.headers.get('authorization') || ''
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''
    const masterUserClient = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${bearer || MASTER_SUPABASE_ANON_KEY}` } } })
    const masterSrv = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY)

    const { data: userInfo, error: userErr } = await masterUserClient.auth.getUser()
    if (userErr || !userInfo?.user?.id) return new Response('Not authenticated', { status: 401, headers: getCorsHeaders(req) })

    const { data: su, error: suErr } = await masterSrv
      .from('saas_users')
      .select('supabase_url, supabase_key_encrypted, service_role_encrypted, organization_id')
      .eq('id', userInfo.user.id)
      .single()
    if (suErr || !su?.supabase_url) return new Response('Client credentials not found', { status: 400, headers: getCorsHeaders(req) })

    const clientUrl = su.supabase_url as string
    const clientServiceKey = tryDecryptKey(su.service_role_encrypted) || tryDecryptKey(su.supabase_key_encrypted)
    const client = createClient(clientUrl, clientServiceKey as string)

    const body = await req.json().catch(() => ({})) as any
    const fromIso = body?.p_inicio ? new Date(body.p_inicio).toISOString() : new Date(0).toISOString()
    const toIso = body?.p_fim ? new Date(body.p_fim).toISOString() : new Date().toISOString()
    const orgId = body?.organization_id || su.organization_id || null
    const p_sender = body?.p_sender || null
    const p_numero = body?.p_numero || null
    const p_query = body?.p_query || null
    const p_limit = Math.min(Math.max(parseInt(body?.p_limit || '50', 10) || 50, 1), 200)
    const p_offset = Math.max(parseInt(body?.p_offset || '0', 10) || 0, 0)

    let data: any[] | null = null
    let error: any = null

    // Global search across multiple columns using OR-ILIKE if p_query provided
    if (p_query && String(p_query).trim().length > 0) {
      try {
        const term: string = String(p_query).trim()
        const safe = '%' + term.replace(/[%_]/g, (m: string) => '\\' + m) + '%'

        let q = client
          .from('repositorio_de_mensagens')
          .select('*')
          .gte('created_at', fromIso)
          .lte('created_at', toIso)
          .eq('organization_id', orgId)

        if (p_sender) q = q.eq('sender_type', p_sender)
        if (p_numero) q = q.or(`whatsapp_cliente.eq.${p_numero},whatsapp_empresa.eq.${p_numero}`)

        // OR across relevant text columns
        q = q.or([
          `content_text.ilike.${safe}`,
          `whatsapp_cliente.ilike.${safe}`,
          `whatsapp_empresa.ilike.${safe}`,
          `provider.ilike.${safe}`,
          `provider_message_id.ilike.${safe}`,
          `thread_id.ilike.${safe}`,
          `conversation_id.ilike.${safe}`,
          `media_type.ilike.${safe}`,
          `media_url.ilike.${safe}`,
          `language.ilike.${safe}`,
          `ai_model.ilike.${safe}`,
          `ai_agent_id.ilike.${safe}`,
          `human_operator_id.ilike.${safe}`
        ].join(','))
          .order('created_at', { ascending: false })
          .range(p_offset, p_offset + p_limit - 1)

        const res = await q
        data = res.data as any[]
        error = res.error
      } catch (e: any) {
        error = e
      }
    } else {
      // Default optimized path via RPC (full-text on content_text)
      const res = await client.rpc('rm_buscar', {
        p_inicio: fromIso,
        p_fim: toIso,
        p_sender,
        p_numero,
        p_query,
        p_limit,
        p_offset,
        p_org: orgId
      })
      data = res.data as any[]
      error = res.error
    }

    if (error) return new Response(`Error: ${error.message || String(error)}`, { status: 400, headers: getCorsHeaders(req) })

    // Filtro mínimo: created_at, sender_type e content_text não vazio
    const rows = (data || []).filter((m: any) => {
      const text = (m?.content_text || '').trim()
      return Boolean(m?.created_at) && (m?.sender_type || '').length > 0 && text.length > 0
    })

    return new Response(JSON.stringify({ success: true, data: rows }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'content-type': 'application/json' }
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || String(err) }), { status: 500, headers: getCorsHeaders(req) })
  }
})


