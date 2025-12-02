// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { resolveClientOrgId } from '../_shared/orgCredentials.ts'

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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  }
}

function cleanBase64(str: string) {
  let s = (str || '').toString().trim().replace(/\s+/g, '')
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4 !== 0) s += '='
  return s
}

/**
 * Encrypt a key value using pgcrypto via RPC
 * IMPORTANT: No base64 fallback - must use proper encryption for security
 */
async function encryptKeyWithRpc(masterClient: any, plaintext: string | null | undefined): Promise<string | null> {
  const value = typeof plaintext === 'string' ? plaintext.trim() : ''
  if (!value) return null
  
  try {
    const { data, error } = await masterClient.rpc('encrypt_key', { plaintext: value })
    if (error) {
      console.error('[admin-analytics] encrypt_key RPC error:', error.message)
      throw new Error(`Encryption failed: ${error.message}`)
    }
    const encrypted = typeof data === 'string' ? data.trim() : ''
    if (!encrypted) {
      throw new Error('Encryption returned empty result')
    }
    return encrypted
  } catch (err: any) {
    console.error('[admin-analytics] encryptKeyWithRpc exception:', err.message)
    throw err
  }
}

function randomCharFromSet(set: string) {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return set[array[0] % set.length]
}

function shuffleArray<T>(input: T[]) {
  const arr = [...input]
  for (let i = arr.length - 1; i > 0; i--) {
    const randArray = new Uint32Array(1)
    crypto.getRandomValues(randArray)
    const j = randArray[0] % (i + 1)
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

function generateSecurePassword(length = 16) {
  const minLength = 12
  const maxLength = 64
  const targetLength = Math.max(minLength, Math.min(maxLength, Math.floor(length)))
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const symbols = '@#$%&*!?'
  const pools = [upper, lower, digits, symbols]
  const chars: string[] = pools.map(set => randomCharFromSet(set))
  const allChars = pools.join('')
  while (chars.length < targetLength) {
    chars.push(randomCharFromSet(allChars))
  }
  return shuffleArray(chars).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
    const MASTER_SUPABASE_URL = Deno.env.get('MASTER_SUPABASE_URL')
    const MASTER_SUPABASE_ANON_KEY = Deno.env.get('MASTER_SUPABASE_ANON_KEY')
    const MASTER_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('MASTER_SUPABASE_SERVICE_ROLE_KEY')
    if (!MASTER_SUPABASE_URL || !MASTER_SUPABASE_ANON_KEY || !MASTER_SUPABASE_SERVICE_ROLE_KEY) {
      return new Response('Missing env', { status: 500, headers: getCorsHeaders(req) })
    }
    const authHeader = req.headers.get('authorization') || ''
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || ''
    // Service-to-service secret bypass
    const ADMIN_ANALYTICS_SECRET = Deno.env.get('ADMIN_ANALYTICS_SECRET') || ''
    const adminSecretHeader = req.headers.get('x-admin-secret') || ''
    const isServiceCall = Boolean(ADMIN_ANALYTICS_SECRET && adminSecretHeader === ADMIN_ANALYTICS_SECRET)

    // Validate requesting user with anon+Bearer unless using service secret
    const supabaseUser = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${bearer || MASTER_SUPABASE_ANON_KEY}` } } })
    let userData: any = null
    let userErr: any = null
    if (!isServiceCall) {
      const authRes = await supabaseUser.auth.getUser()
      userData = authRes.data
      userErr = authRes.error
      if (userErr || !userData?.user?.id) {
        return new Response('Unauthorized', { status: 401, headers: getCorsHeaders(req) })
      }
    } else {
      // Synthetic user for service calls
      userData = { user: { id: 'service', email: 'service@internal' } }
    }

    // Admin ACL: allow actions if user_id is in saas_admins, is statically allowed, or is the fallback ALLOWED_USER_ID
    const ALLOWED_USER_ID = '1726f3a7-a8ec-479e-b8a6-d079fbf94e2a'
    const selfAllowed = new Set(['mirror_org_self', 'is_admin'])
    const STATIC_ADMIN_EMAILS = new Set<string>([
      'gloria@automatiklabs.com.br'
    ])
    const supabase = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY)
    let isAdmin = false
    if (isServiceCall) {
      isAdmin = true
    } else {
      try {
        const email = (userData.user.email || '').toLowerCase()
        if (STATIC_ADMIN_EMAILS.has(email)) {
          isAdmin = true
        } else if (userData.user.id === ALLOWED_USER_ID) {
          isAdmin = true
        } else {
          // Prefer user_id-based check with quick index
          const { data: row } = await supabase
            .from('saas_admins')
            .select('user_id')
            .eq('user_id', userData.user.id)
            .maybeSingle()
          if (row?.user_id) {
            isAdmin = true
          } else if (email) {
            // Backward compatibility: allow by email while older rows exist
            const { data: rowByEmail } = await supabase
              .from('saas_admins')
              .select('email')
              .eq('email', email)
              .maybeSingle()
            isAdmin = !!rowByEmail
          }
        }
      } catch {}
    }
    if (!isAdmin && !selfAllowed.has(action)) {
      return new Response('Forbidden', { status: 403, headers: getCorsHeaders(req) })
    }

    // Quick check endpoint
    if (action === 'is_admin') {
      return new Response(JSON.stringify({ is_admin: isAdmin }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // Service client already defined above as supabase

    // Filters and actions
    const dateFrom = url.searchParams.get('date_from')
    const dateTo = url.searchParams.get('date_to')
    const feature = url.searchParams.get('feature') || undefined

    const now = new Date()
    const d7 = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString()
    const d30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString()
    const from = dateFrom || d30
    const to = dateTo || now.toISOString()
    // Ensure p_to is inclusive end-of-day when client passes a date-only value
    const toInclusive = (() => {
      try {
        const t = new Date(to)
        // If the time is exactly 00:00:00Z (typical from <input type="date">), extend to end-of-day
        const isStartOfDay = t.getUTCHours() === 0 && t.getUTCMinutes() === 0 && t.getUTCSeconds() === 0 && t.getUTCMilliseconds() === 0
        return isStartOfDay ? new Date(t.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString() : to
      } catch {
        return to
      }
    })()

    // Admin actions: users management
    if (action === 'list_admins') {
      try {
        // Return both email and user_id for UI
        const { data, error } = await supabase.from('saas_admins').select('email, user_id, created_at').order('created_at', { ascending: true })
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ admins: data || [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error listing admins', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'list_plans') {
      try {
        const { data, error } = await supabase
          .from('saas_plans')
          .select('id, name, slug, price_monthly, price_yearly, features, limits, active, max_members_per_org, stripe_price_id_monthly, stripe_price_id_yearly')
          .eq('active', true)
          .order('price_monthly', { ascending: true })
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        // Ocultar add-ons de organizações (orgs_extra)
        const filtered = (data || []).filter((p: any) => {
          const slug = String(p?.slug || '')
          const addonType = (p?.limits && typeof p.limits === 'object') ? (p.limits as any).addon_type : null
          return addonType !== 'orgs_extra' && addonType !== 'member_seats_extra' && !slug.startsWith('org-extra-') && !slug.startsWith('seats-extra-')
        })
        return new Response(JSON.stringify({ plans: filtered }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error listing plans', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'list_special_plans') {
      // Helper endpoint: ensure trial_expired is visible even if not active
      try {
        const { data } = await supabase
          .from('saas_plans')
          .select('id, name, slug, price_monthly, price_yearly, active')
          .in('slug', ['trial_expired'])
        return new Response(JSON.stringify({ plans: data || [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error listing special plans', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ---- Auth observability
    if (action === 'auth_events' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const days = Math.max(1, Math.min(90, Number(body?.days || 7)))
        const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()
        const groupBy = String(body?.group_by || 'event_name')
        const allowed = new Set(['event_name', 'email_hash', 'ip'])
        const key = allowed.has(groupBy) ? groupBy : 'event_name'
        const rows: any[] = []
        // Simple aggregation by key and day
        const { data, error } = await supabase
          .from('saas_events')
          .select('event_name, created_at, props')
          .gte('created_at', since)
          .order('created_at', { ascending: true })
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        const map: Record<string, Record<string, number>> = {}
        for (const r of (data || [])) {
          const day = (r.created_at || '').slice(0, 10)
          const props = (r as any).props || {}
          const bucket = key === 'event_name' ? (r.event_name || 'unknown') : (String(props?.[key] || 'unknown'))
          if (!map[bucket]) map[bucket] = {}
          map[bucket][day] = (map[bucket][day] || 0) + 1
        }
        for (const bucket of Object.keys(map)) {
          rows.push({ bucket, days: map[bucket] })
        }
        return new Response(JSON.stringify({ items: rows }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error loading auth events', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ---- Features: catálogo
    if (action === 'list_features') {
      try {
        const { data, error } = await supabase
          .from('saas_features')
          .select('key, type, default_value, enum_options, category, description, ui_schema, dev_only, deprecated_at, created_at, updated_at')
          .order('category', { ascending: true })
          .order('key', { ascending: true })
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ features: data || [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error listing features', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== Trails catalog
    if (action === 'list_trails') {
      try {
        const { data, error } = await supabase
          .from('saas_trail_products')
          .select('id, slug, name, active')
          .order('name', { ascending: true })
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ trails: data || [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error listing trails', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'upsert_trail' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const row: any = {
          id: body?.id || undefined,
          slug: String(body?.slug || '').trim(),
          name: String(body?.name || '').trim(),
          active: Boolean(body?.active ?? true)
        }
        if (!row.slug || !row.name) return new Response('Missing slug/name', { status: 400, headers: getCorsHeaders(req) })
        const { error } = await supabase.from('saas_trail_products').upsert(row, { onConflict: 'slug' })
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error upserting trail', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'add_user_trail' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        let userId = (body?.user_id as string || '').trim()
        const email = (body?.email as string || '').trim().toLowerCase()
        let trailId = (body?.trail_id as string || '').trim()
        const trailSlug = (body?.trail_slug as string || '').trim()

        if (!trailId && trailSlug) {
          const { data: t } = await supabase.from('saas_trail_products').select('id').eq('slug', trailSlug).maybeSingle()
          trailId = t?.id || ''
        }
        if (!trailId) return new Response('Missing trail_id or trail_slug', { status: 400, headers: getCorsHeaders(req) })

        if (!userId && email) {
          const { data: u } = await supabase.from('saas_users').select('id').eq('email', email).maybeSingle()
          userId = u?.id || ''
        }
        if (!userId) return new Response('Missing user_id or email', { status: 400, headers: getCorsHeaders(req) })

        const { data: row } = await supabase
          .from('saas_users')
          .select('trail_product_ids')
          .eq('id', userId)
          .maybeSingle()
        const list = (row?.trail_product_ids || '').split(',').map((s: string) => s.trim()).filter((s: string) => s)
        if (!list.includes(trailId)) list.push(trailId)
        const csv = list.join(',')
        const { error } = await supabase
          .from('saas_users')
          .update({ trail_product_ids: csv || null, updated_at: new Date().toISOString() })
          .eq('id', userId)
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true, user_id: userId, trail_product_ids: csv }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error adding user trail', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'remove_user_trail' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        let userId = (body?.user_id as string || '').trim()
        const email = (body?.email as string || '').trim().toLowerCase()
        let trailId = (body?.trail_id as string || '').trim()
        const trailSlug = (body?.trail_slug as string || '').trim()

        if (!trailId && trailSlug) {
          const { data: t } = await supabase.from('saas_trail_products').select('id').eq('slug', trailSlug).maybeSingle()
          trailId = t?.id || ''
        }
        if (!trailId) return new Response('Missing trail_id or trail_slug', { status: 400, headers: getCorsHeaders(req) })

        if (!userId && email) {
          const { data: u } = await supabase.from('saas_users').select('id').eq('email', email).maybeSingle()
          userId = u?.id || ''
        }
        if (!userId) return new Response('Missing user_id or email', { status: 400, headers: getCorsHeaders(req) })

        const { data: row } = await supabase
          .from('saas_users')
          .select('trail_product_ids')
          .eq('id', userId)
          .maybeSingle()
        const list = (row?.trail_product_ids || '').split(',').map((s: string) => s.trim()).filter((s: string) => s)
        const next = list.filter((x: string) => x !== trailId)
        const csv = next.join(',')
        const { error } = await supabase
          .from('saas_users')
          .update({ trail_product_ids: csv || null, updated_at: new Date().toISOString() })
          .eq('id', userId)
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true, user_id: userId, trail_product_ids: csv }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error removing user trail', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'upsert_feature' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const payload: any = {
          key: String(body?.key || '').trim(),
          type: body?.type,
          default_value: body?.default_value ?? null,
          enum_options: body?.enum_options ?? null,
          category: body?.category ?? null,
          description: body?.description ?? null,
          ui_schema: body?.ui_schema ?? null,
          dev_only: Boolean(body?.dev_only || false),
          deprecated_at: body?.deprecated_at || null
        }
        if (!payload.key || !payload.type) return new Response('Missing key/type', { status: 400, headers: getCorsHeaders(req) })
        const { error } = await supabase.from('saas_features').upsert(payload)
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error upserting feature', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'delete_feature' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const key = String(body?.key || '').trim()
        if (!key) return new Response('Missing key', { status: 400, headers: getCorsHeaders(req) })
        const { error } = await supabase.from('saas_features').delete().eq('key', key)
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error deleting feature', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ---- Backfill: saas_supabases_connections (repo)
    if (action === 'backfill_connections_user' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const userId = (body?.user_id as string || '').trim()
        if (!userId) return new Response('Missing user_id', { status: 400, headers: getCorsHeaders(req) })
        const { data: u, error: uErr } = await supabase
          .from('saas_users')
          .select('id, supabase_url, supabase_key_encrypted, service_role_encrypted')
          .eq('id', userId)
          .maybeSingle()
        if (uErr) return new Response(uErr.message, { status: 400, headers: getCorsHeaders(req) })
        const urlc = u?.supabase_url
        const encAnon = u?.supabase_key_encrypted
        const encSrv = u?.service_role_encrypted || null
        if (!urlc || !encAnon) return new Response(JSON.stringify({ ok: true, inserted: 0, skipped: 1 }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        const row = {
          owner_id: userId,
          supabase_url: urlc,
          anon_key_encrypted: encAnon,
          service_role_encrypted: encSrv,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        const { error: insErr } = await supabase
          .from('saas_supabases_connections')
          .upsert(row, { onConflict: 'owner_id,supabase_url' })
        if (insErr) return new Response(insErr.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true, inserted: 1 }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error backfilling user connections', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'backfill_connections_all') {
      try {
        const batchSize = Math.max(1, Math.min(200, Number(url.searchParams.get('batch_size') || '100')))
        const offset = Math.max(0, Number(url.searchParams.get('offset') || '0'))
        const { data: users, error: listErr, count } = await supabase
          .from('saas_users')
          .select('id, supabase_url, supabase_key_encrypted, service_role_encrypted', { count: 'exact' })
          .not('supabase_url', 'is', null)
          .not('supabase_key_encrypted', 'is', null)
          .neq('supabase_url', '')
          .neq('supabase_key_encrypted', '')
          .order('id', { ascending: true })
          .range(offset, offset + batchSize - 1)
        if (listErr) return new Response(listErr.message, { status: 400, headers: getCorsHeaders(req) })
        const total = Number(count || 0)
        const results: any[] = []
        for (const u of users || []) {
          try {
            const row = {
              owner_id: u.id,
              supabase_url: u.supabase_url,
              anon_key_encrypted: u.supabase_key_encrypted,
              service_role_encrypted: u.service_role_encrypted || null,
              last_used_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
            const { error: upErr } = await supabase
              .from('saas_supabases_connections')
              .upsert(row, { onConflict: 'owner_id,supabase_url' })
            if (upErr) throw new Error(upErr.message)
            results.push({ user_id: u.id, ok: true })
          } catch (e: any) {
            results.push({ user_id: u.id, ok: false, error: e?.message || 'upsert_failed' })
          }
        }
        const processed = (users || []).length
        const nextOffset = (offset + processed) < total ? (offset + processed) : null
        return new Response(JSON.stringify({ ok: true, processed, total, next_offset: nextOffset, results }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error backfilling connections', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ---- Planos (CRUD)
    if (action === 'upsert_plan' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const row: any = {
          id: body?.id || undefined,
          name: String(body?.name || '').trim(),
          slug: String(body?.slug || '').trim(),
          price_monthly: Number(body?.price_monthly || 0),
          price_yearly: Number(body?.price_yearly || 0),
          features: Array.isArray(body?.marketing_bullets) ? body.marketing_bullets : (Array.isArray(body?.features) ? body.features : []),
          limits: body?.limits ?? {},
          active: Boolean(body?.active ?? true),
          stripe_price_id_monthly: body?.stripe_price_id_monthly || null,
          stripe_price_id_yearly: body?.stripe_price_id_yearly || null,
          currency: body?.currency || 'BRL',
          max_members_per_org: (body?.max_members_per_org != null) ? Number(body.max_members_per_org) : undefined
        }
        if (!row.name || !row.slug) return new Response('Missing name/slug', { status: 400, headers: getCorsHeaders(req) })
        const { error } = await supabase.from('saas_plans').upsert(row, { onConflict: 'slug' })
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error upserting plan', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ---- Seats extras (member_seats_extra) por owner
    if (action === 'update_member_seats_extra' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const userId = (body?.user_id as string || '').trim()
        const email = (body?.email as string || '').trim().toLowerCase()
        const seats = Number(body?.member_seats_extra)
        if (!Number.isFinite(seats) || seats < 0) return new Response('Invalid member_seats_extra', { status: 400, headers: getCorsHeaders(req) })
        let targetId = userId
        if (!targetId && email) {
          const { data: u } = await supabase.from('saas_users').select('id').eq('email', email).maybeSingle()
          targetId = u?.id || ''
        }
        if (!targetId) return new Response('Missing user_id or email', { status: 400, headers: getCorsHeaders(req) })
        const { error } = await supabase.from('saas_users').update({ member_seats_extra: seats, updated_at: new Date().toISOString() }).eq('id', targetId)
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true, user_id: targetId, member_seats_extra: seats }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error updating member_seats_extra', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'update_account_type' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const userId = (body?.user_id as string || '').trim()
        const email = (body?.email as string || '').trim().toLowerCase()
        const accountType = (body?.account_type as string || '').trim()
        
        // Validar account_type
        const validTypes = ['padrao', 'profissional', 'estudante']
        if (!validTypes.includes(accountType)) {
          return new Response('Invalid account_type. Must be one of: padrao, profissional, estudante', { status: 400, headers: getCorsHeaders(req) })
        }
        
        let targetId = userId
        if (!targetId && email) {
          const { data: u } = await supabase.from('saas_users').select('id').eq('email', email).maybeSingle()
          targetId = u?.id || ''
        }
        if (!targetId) return new Response('Missing user_id or email', { status: 400, headers: getCorsHeaders(req) })
        
        const { error } = await supabase
          .from('saas_users')
          .update({ account_type: accountType, updated_at: new Date().toISOString() })
          .eq('id', targetId)
        
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true, user_id: targetId, account_type: accountType }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error updating account_type', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ---- Plano × Features
    if (action === 'list_plan_features') {
      try {
        const planId = (new URL(req.url)).searchParams.get('plan_id') || ''
        if (!planId) return new Response('Missing plan_id', { status: 400, headers: getCorsHeaders(req) })
        const { data, error } = await supabase
          .from('saas_plan_features')
          .select('feature_key, value, enforced, updated_at')
          .eq('plan_id', planId)
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        // Also include catalog for convenience
        const { data: catalog } = await supabase
          .from('saas_features')
          .select('key, type, default_value, enum_options, category, description')
          .order('category', { ascending: true })
          .order('key', { ascending: true })
        return new Response(JSON.stringify({ items: data || [], catalog: catalog || [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error listing plan features', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'upsert_plan_feature' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const plan_id = String(body?.plan_id || '').trim()
        const feature_key = String(body?.feature_key || '').trim()
        const enforced = Boolean(body?.enforced ?? true)
        const value = body?.value ?? null
        if (!plan_id || !feature_key) return new Response('Missing plan_id/feature_key', { status: 400, headers: getCorsHeaders(req) })
        const { error } = await supabase
          .from('saas_plan_features')
          .upsert({ plan_id, feature_key, value, enforced }, { onConflict: 'plan_id,feature_key' })
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error upserting plan feature', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'delete_plan_feature' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const plan_id = String(body?.plan_id || '').trim()
        const feature_key = String(body?.feature_key || '').trim()
        if (!plan_id || !feature_key) return new Response('Missing plan_id/feature_key', { status: 400, headers: getCorsHeaders(req) })
        const { error } = await supabase.from('saas_plan_features').delete().eq('plan_id', plan_id).eq('feature_key', feature_key)
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error deleting plan feature', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ---- Overrides (org)
    if (action === 'list_overrides') {
      try {
        const orgId = (new URL(req.url)).searchParams.get('organization_id') || ''
        if (!orgId) return new Response('Missing organization_id', { status: 400, headers: getCorsHeaders(req) })
        const { data, error } = await supabase
          .from('saas_org_feature_overrides')
          .select('feature_key, value, expires_at, reason, created_at')
          .eq('organization_id', orgId)
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ items: data || [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error listing overrides', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'upsert_override' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const organization_id = String(body?.organization_id || '').trim()
        const feature_key = String(body?.feature_key || '').trim()
        const value = body?.value ?? null
        const expires_at = body?.expires_at || null
        const reason = body?.reason || null
        if (!organization_id || !feature_key) return new Response('Missing organization_id/feature_key', { status: 400, headers: getCorsHeaders(req) })
        const { error } = await supabase.from('saas_org_feature_overrides').upsert({ organization_id, feature_key, value, expires_at, reason })
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error upserting override', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'delete_override' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const organization_id = String(body?.organization_id || '').trim()
        const feature_key = String(body?.feature_key || '').trim()
        if (!organization_id || !feature_key) return new Response('Missing organization_id/feature_key', { status: 400, headers: getCorsHeaders(req) })
        const { error } = await supabase.from('saas_org_feature_overrides').delete().eq('organization_id', organization_id).eq('feature_key', feature_key)
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error deleting override', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // Get single user details including instance_limits and plan
    if (action === 'user_details') {
      try {
        const userId = (url.searchParams.get('user_id') || '').trim()
        if (!userId) return new Response('Missing user_id', { status: 400, headers: getCorsHeaders(req) })
        const { data: u } = await supabase
          .from('saas_users')
          .select('id, email, name, organization_id, plan_id, instance_limits, organizations_extra, account_type, member_seats_extra, trail_product_ids, created_at, updated_at')
          .eq('id', userId)
          .maybeSingle()
        if (!u) return new Response('User not found', { status: 404, headers: getCorsHeaders(req) })
        const { data: plan } = await supabase
          .from('saas_plans')
          .select('id, name, slug')
          .eq('id', u.plan_id)
          .maybeSingle()
        const { data: orgs } = await supabase
          .from('saas_organizations')
          .select('id, name, slug')
          .eq('owner_id', userId)
        return new Response(JSON.stringify({ user: u, plan, organizations: orgs || [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error loading user details', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // Update instance_limits for a user
    if (action === 'update_instance_limits' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const userId = (body?.user_id as string || '').trim()
        const limits = Number(body?.instance_limits)
        if (!userId || !Number.isFinite(limits) || limits < 0) return new Response('Invalid payload', { status: 400, headers: getCorsHeaders(req) })
        const { error } = await supabase
          .from('saas_users')
          .update({ instance_limits: limits, updated_at: new Date().toISOString() })
          .eq('id', userId)
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true, user_id: userId, instance_limits: limits }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error updating instance limits', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'add_admin' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const email = (body?.email as string || '').trim().toLowerCase()
        const userIdRaw = (body?.user_id as string || '').trim()
        if (!email && !userIdRaw) return new Response('Missing email or user_id', { status: 400, headers: getCorsHeaders(req) })
        let userId = userIdRaw
        if (!userId && email) {
          const { data: u } = await supabase.from('saas_users').select('id').eq('email', email).maybeSingle()
          userId = u?.id || ''
        }
        const payload: any = { email: email || null }
        if (userId) payload.user_id = userId
        const { error } = await supabase.from('saas_admins').upsert(payload)
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true, user_id: userId || null, email: email || null }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error adding admin', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'remove_admin' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const email = (body?.email as string || '').trim().toLowerCase()
        const userId = (body?.user_id as string || '').trim()
        if (!email && !userId) return new Response('Missing email or user_id', { status: 400, headers: getCorsHeaders(req) })
        let q = supabase.from('saas_admins').delete()
        if (userId) q = q.eq('user_id', userId)
        else q = q.eq('email', email)
        const { error } = await q
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error removing admin', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'update_organizations_extra' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const userId = (body?.user_id as string || '').trim()
        const email = (body?.email as string || '').trim().toLowerCase()
        const orgs = Number(body?.organizations_extra)
        if (!Number.isFinite(orgs)) return new Response('Invalid organizations_extra', { status: 400, headers: getCorsHeaders(req) })
        let targetId = userId
        if (!targetId && email) {
          const { data: u } = await supabase.from('saas_users').select('id').eq('email', email).maybeSingle()
          targetId = u?.id || ''
        }
        if (!targetId) return new Response('Missing user_id or email', { status: 400, headers: getCorsHeaders(req) })
        const { error } = await supabase.from('saas_users').update({ organizations_extra: orgs, updated_at: new Date().toISOString() }).eq('id', targetId)
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true, user_id: targetId, organizations_extra: orgs }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error updating organizations_extra', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'update_user_plan' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const userId = (body?.user_id as string || '').trim()
        const email = (body?.email as string || '').trim().toLowerCase()
        const planId = (body?.plan_id as string || '').trim()
        if (!planId) return new Response('Missing plan_id', { status: 400, headers: getCorsHeaders(req) })
        let targetId = userId
        if (!targetId && email) {
          const { data: u } = await supabase.from('saas_users').select('id').eq('email', email).maybeSingle()
          targetId = u?.id || ''
        }
        if (!targetId) return new Response('Missing user_id or email', { status: 400, headers: getCorsHeaders(req) })

        // Verify plan exists
        const { data: plan, error: planErr } = await supabase.from('saas_plans').select('id, name, slug').eq('id', planId).maybeSingle()
        if (planErr || !plan) return new Response('Plan not found', { status: 400, headers: getCorsHeaders(req) })

        const { error } = await supabase.from('saas_users').update({ plan_id: planId, updated_at: new Date().toISOString() }).eq('id', targetId)
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true, user_id: targetId, plan_id: planId, plan_name: plan.name, plan_slug: plan.slug }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error updating user plan', { status: 500, headers: getCorsHeaders(req) })
      }

    // Update organization plan (org-level plan assignment)
    if (action === 'update_org_plan' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const organizationId = (body?.organization_id as string || '').trim()
        const planId = (body?.plan_id as string || '').trim()
        if (!organizationId || !planId) return new Response('Missing organization_id/plan_id', { status: 400, headers: getCorsHeaders(req) })
        // Verify plan exists
        const { data: plan, error: planErr } = await supabase.from('saas_plans').select('id, name, slug').eq('id', planId).maybeSingle()
        if (planErr || !plan) return new Response('Plan not found', { status: 400, headers: getCorsHeaders(req) })
        const { error } = await supabase.from('saas_organizations').update({ plan_id: planId, updated_at: new Date().toISOString() }).eq('id', organizationId)
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true, organization_id: organizationId, plan_id: planId, plan_name: plan.name, plan_slug: plan.slug }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error updating org plan', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== Trails access (per user)
    if (action === 'get_user_trails') {
      try {
        const email = (url.searchParams.get('email') || '').trim().toLowerCase()
        if (!email) return new Response('Missing email', { status: 400, headers: getCorsHeaders(req) })
        const { data: u } = await supabase
          .from('saas_users')
          .select('id, email, trail_product_ids')
          .eq('email', email)
          .maybeSingle()
        if (!u) return new Response('User not found', { status: 404, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ user_id: u.id, email: u.email, trail_product_ids: u.trail_product_ids || '' }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error loading user trails', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'update_user_trails' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        let userId = (body?.user_id as string || '').trim()
        const email = (body?.email as string || '').trim().toLowerCase()
        let raw = (body?.trail_product_ids as string || '').trim()
        // Normalize: commas, strip spaces, allow empty
        raw = raw.split(',').map((s: string) => s.trim()).filter((s: string) => s).join(',')
        if (!userId && email) {
          const { data: u } = await supabase.from('saas_users').select('id').eq('email', email).maybeSingle()
          userId = u?.id || ''
        }
        if (!userId) return new Response('Missing user_id or email', { status: 400, headers: getCorsHeaders(req) })
        const { error } = await supabase
          .from('saas_users')
          .update({ trail_product_ids: raw || null, updated_at: new Date().toISOString() })
          .eq('id', userId)
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true, user_id: userId, trail_product_ids: raw }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error updating user trails', { status: 500, headers: getCorsHeaders(req) })
      }
    }
    }

    if (action === 'bulk_update_orgs_extra' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        // Payload can be an array of { email, organizations_extra }
        const rows = Array.isArray(body?.rows) ? body.rows : []
        if (!rows.length) return new Response('Missing rows', { status: 400, headers: getCorsHeaders(req) })
        const results: any[] = []
        for (const r of rows) {
          const email = (r?.email || '').trim().toLowerCase()
          const orgs = Number(r?.organizations_extra)
          if (!email || !Number.isFinite(orgs)) {
            results.push({ email, ok: false, error: 'invalid_row' })
            continue
          }
          try {
            const { data: u } = await supabase.from('saas_users').select('id').eq('email', email).maybeSingle()
            const id = u?.id
            if (!id) {
              results.push({ email, ok: false, error: 'user_not_found' })
              continue
            }
            const { error } = await supabase.from('saas_users').update({ organizations_extra: orgs, updated_at: new Date().toISOString() }).eq('id', id)
            if (error) throw new Error(error.message)
            results.push({ email, ok: true, user_id: id, organizations_extra: orgs })
          } catch (e: any) {
            results.push({ email, ok: false, error: e?.message || 'update_failed' })
          }
        }
        return new Response(JSON.stringify({ ok: true, results }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error in bulk update', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'bulk_update_plans' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        // Payload can be an array of { email, plan_id }
        const rows = Array.isArray(body?.rows) ? body.rows : []
        if (!rows.length) return new Response('Missing rows', { status: 400, headers: getCorsHeaders(req) })
        const results: any[] = []
        for (const r of rows) {
          const email = (r?.email || '').trim().toLowerCase()
          const planId = (r?.plan_id as string || '').trim()
          if (!email || !planId) {
            results.push({ email, ok: false, error: 'invalid_row' })
            continue
          }
          try {
            // Verify plan exists first
            const { data: plan, error: planErr } = await supabase.from('saas_plans').select('id, name, slug').eq('id', planId).maybeSingle()
            if (planErr || !plan) {
              results.push({ email, ok: false, error: 'plan_not_found' })
              continue
            }

            const { data: u } = await supabase.from('saas_users').select('id').eq('email', email).maybeSingle()
            const id = u?.id
            if (!id) {
              results.push({ email, ok: false, error: 'user_not_found' })
              continue
            }
            const { error } = await supabase.from('saas_users').update({ plan_id: planId, updated_at: new Date().toISOString() }).eq('id', id)
            if (error) throw new Error(error.message)
            results.push({ email, ok: true, user_id: id, plan_id: planId, plan_name: plan.name, plan_slug: plan.slug })
          } catch (e: any) {
            results.push({ email, ok: false, error: e?.message || 'update_failed' })
          }
        }
        return new Response(JSON.stringify({ ok: true, results }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error in bulk plan update', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'search_users_for_email' && req.method === 'GET') {
      try {
        const search = (url.searchParams.get('search') || '').trim().toLowerCase()
        const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') || '10')))

        if (!search || search.length < 2) {
          return new Response(JSON.stringify({ users: [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }

        // Buscar usuários que têm nome e email, filtrando por busca
        const { data: users, error } = await supabase
          .from('saas_users')
          .select('id, email, name')
          .or(`email.ilike.%${search}%,name.ilike.%${search}%`)
          .limit(limit)

        if (error) {
          console.error('Error searching users:', error)
          return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }

        const formattedUsers = (users || [])
          .map(u => ({
            id: u.id,
            email: (u.email || '').toLowerCase().trim(),
            name: (u.name || '').trim() || u.email.split('@')[0]
          }))
          .filter(u => u.email)

        return new Response(JSON.stringify({
          ok: true,
          users: formattedUsers
        }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'Error searching users' }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
    }

    if (action === 'verify_users_for_email' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const emails = Array.isArray(body?.emails) ? body.emails : []
        
        if (emails.length === 0) {
          return new Response(JSON.stringify({ error: 'Missing emails array' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }

        if (emails.length > 1000) {
          return new Response(JSON.stringify({ error: 'Maximum 1000 emails per request' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }

        // Buscar usuários que existem no sistema e têm nome e email
        const emailSet = new Set(emails.map((e: string) => String(e).trim().toLowerCase()))
        const validUsers: any[] = []

        // Buscar em lotes para evitar queries muito grandes
        const batchSize = 100
        const emailArray = Array.from(emailSet)
        
        for (let i = 0; i < emailArray.length; i += batchSize) {
          const batch = emailArray.slice(i, i + batchSize)
          const { data: users, error } = await supabase
            .from('saas_users')
            .select('email, name')
            .in('email', batch)
            .not('name', 'is', null)
            .neq('name', '')

          if (error) {
            console.error('Error fetching users:', error)
            continue
          }

          if (users) {
            for (const user of users) {
              const email = (user.email || '').toLowerCase().trim()
              const name = (user.name || '').trim()
              if (email && name && emailSet.has(email)) {
                validUsers.push({ email, name })
              }
            }
          }
        }

        return new Response(JSON.stringify({
          ok: true,
          total_requested: emails.length,
          valid_count: validUsers.length,
          valid_users: validUsers
        }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'Error verifying users' }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
    }

    if (action === 'bulk_send_emails' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const subject = String(body?.subject || '').trim()
        const htmlContent = String(body?.html_content || '').trim()
        const users = Array.isArray(body?.users) ? body.users : []

        if (!subject) {
          return new Response(JSON.stringify({ error: 'Subject is required' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }

        if (!htmlContent) {
          return new Response(JSON.stringify({ error: 'HTML content is required' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }

        if (users.length === 0) {
          return new Response(JSON.stringify({ error: 'At least one user is required' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }

        if (users.length > 100) {
          return new Response(JSON.stringify({ error: 'Maximum 100 users per batch' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }

        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
        const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || Deno.env.get('FROM_EMAIL') || 'TomikCRM <no-reply@automatiklabs.com.br>'

        if (!RESEND_API_KEY) {
          return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }

        const results: any[] = []

        // Enviar emails em lote usando a API do Resend
        // A API do Resend permite enviar para múltiplos destinatários com personalização
        for (const user of users) {
          const email = (user.email || '').trim().toLowerCase()
          const name = (user.name || '').trim() || email.split('@')[0]

          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            results.push({ email: email || 'unknown', ok: false, error: 'Invalid email format' })
            continue
          }

          try {
            // Personalizar conteúdo e assunto
            let personalizedSubject = subject
            personalizedSubject = personalizedSubject.replace(/\{nome\}/gi, name)
            personalizedSubject = personalizedSubject.replace(/\{name\}/gi, name)
            personalizedSubject = personalizedSubject.replace(/\{email\}/gi, email)

            let personalizedHtml = htmlContent
            personalizedHtml = personalizedHtml.replace(/\{nome\}/gi, name)
            personalizedHtml = personalizedHtml.replace(/\{name\}/gi, name)
            personalizedHtml = personalizedHtml.replace(/\{email\}/gi, email)

            // Enviar via Resend
            const resendRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: RESEND_FROM_EMAIL,
                to: [email],
                subject: personalizedSubject,
                html: personalizedHtml
              })
            })

            if (!resendRes.ok) {
              const errorText = await resendRes.text().catch(() => '')
              let errorMessage = `HTTP ${resendRes.status}`
              try {
                const errorJson = JSON.parse(errorText)
                errorMessage = errorJson?.message || errorText || errorMessage
              } catch {
                errorMessage = errorText || errorMessage
              }
              results.push({ email, ok: false, error: errorMessage })
              continue
            }

            results.push({ email, ok: true })
          } catch (err: any) {
            results.push({ email, ok: false, error: err?.message || 'Unknown error' })
          }

          // Delay de 500ms entre emails para respeitar rate limit do Resend (2 requests/segundo)
          await new Promise(resolve => setTimeout(resolve, 500))
        }

        const successCount = results.filter(r => r.ok).length
        const errorCount = results.length - successCount

        return new Response(JSON.stringify({
          ok: true,
          total: users.length,
          success_count: successCount,
          error_count: errorCount,
          results
        }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'Error sending emails' }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
    }

    if (action === 'bulk_update_users' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const rows = Array.isArray(body?.rows) ? body.rows : []
        if (!rows.length) {
          return new Response(JSON.stringify({ error: 'Missing rows array' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }

        if (rows.length > 100) {
          return new Response(JSON.stringify({ error: 'Maximum 100 users per batch' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }

        const validAccountTypes = new Set(['padrao', 'profissional', 'estudante', 'agencia', 'usuario', 'empresa'])
        const results: any[] = []

        for (const r of rows) {
          const email = (r?.email || '').trim().toLowerCase()
          
          if (!email) {
            results.push({ email: email || 'unknown', ok: false, error: 'Email é obrigatório' })
            continue
          }

          // Validate email format
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            results.push({ email, ok: false, error: 'Formato de email inválido' })
            continue
          }

          try {
            // Find user by email in saas_users
            let { data: u } = await supabase.from('saas_users').select('id').eq('email', email).maybeSingle()
            
            // If not found in saas_users, try to find in auth.users and create saas_users entry
            if (!u?.id) {
              // Try to find user in auth.users by email
              let foundAuthUser: any = null
              
              // Method 1: Try getUserByEmail (available in Supabase v2+)
              try {
                const authUserResponse = await supabase.auth.admin.getUserByEmail(email)
                if (authUserResponse?.data?.user) {
                  foundAuthUser = authUserResponse.data.user
                }
              } catch (err1) {
                // Method 2: Fallback to listing users and filtering (less efficient but works)
                // This is needed for users without Supabase connection who may not be in saas_users
                try {
                  const { data: authUserList, error: listError } = await supabase.auth.admin.listUsers()
                  if (!listError && authUserList?.users) {
                    foundAuthUser = authUserList.users.find((au: any) => 
                      au.email?.toLowerCase() === email.toLowerCase()
                    )
                  }
                } catch (err2) {
                  // If both methods fail, user will be reported as not found
                }
              }
              
              if (foundAuthUser?.id) {
                // Get trial plan ID
                const { data: trialPlan } = await supabase
                  .from('saas_plans')
                  .select('id')
                  .eq('slug', 'trial')
                  .maybeSingle()
                
                // Create saas_users entry
                const { data: newSaasUser, error: createErr } = await supabase
                  .from('saas_users')
                  .insert({
                    id: foundAuthUser.id,
                    email: foundAuthUser.email || email,
                    name: foundAuthUser.user_metadata?.name || foundAuthUser.raw_user_meta_data?.name || email.split('@')[0],
                    role: 'owner',
                    active: true,
                    email_verified: !!foundAuthUser.email_confirmed_at,
                    plan_id: trialPlan?.id || null,
                    setup_completed: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  })
                  .select('id')
                  .single()
                
                if (createErr) {
                  // If insert fails (e.g., conflict), try to get existing user
                  const { data: existingUser } = await supabase
                    .from('saas_users')
                    .select('id')
                    .eq('id', foundAuthUser.id)
                    .maybeSingle()
                  
                  if (existingUser?.id) {
                    u = existingUser
                  } else {
                    results.push({ email, ok: false, error: `Erro ao criar registro: ${createErr.message}` })
                    continue
                  }
                } else {
                  u = newSaasUser
                }
              } else {
                results.push({ email, ok: false, error: 'Usuário não encontrado em auth.users nem em saas_users' })
                continue
              }
            }

            const updateData: any = { updated_at: new Date().toISOString() }
            let hasUpdate = false

            // Process account_type
            if (r.account_type !== undefined && r.account_type !== null && r.account_type !== '') {
              const accountType = String(r.account_type).trim().toLowerCase()
              if (validAccountTypes.has(accountType)) {
                updateData.account_type = accountType
                hasUpdate = true
              } else if (accountType !== '') {
                results.push({ email, ok: false, error: `Tipo de conta inválido: ${accountType}. Valores válidos: ${Array.from(validAccountTypes).join(', ')}` })
                continue
              }
            }

            // Process member_seats_extra (aceita ambos seats_extra e member_seats_extra)
            const seatsValue = r.member_seats_extra !== undefined && r.member_seats_extra !== null && r.member_seats_extra !== '' 
              ? r.member_seats_extra 
              : (r.seats_extra !== undefined && r.seats_extra !== null && r.seats_extra !== '' ? r.seats_extra : null)
            
            if (seatsValue !== null) {
              const seats = Number(seatsValue)
              if (Number.isFinite(seats) && seats >= 0) {
                updateData.member_seats_extra = seats
                hasUpdate = true
              } else {
                results.push({ email, ok: false, error: 'member_seats_extra deve ser um número maior ou igual a 0' })
                continue
              }
            }

            // Process name
            if (r.name !== undefined && r.name !== null && r.name !== '') {
              const nameValue = String(r.name).trim()
              if (nameValue) {
                updateData.name = nameValue
                hasUpdate = true
              }
            }

            // Process phone
            if (r.phone !== undefined && r.phone !== null && r.phone !== '') {
              const phoneValue = String(r.phone).trim()
              if (phoneValue) {
                updateData.phone = phoneValue
                hasUpdate = true
              }
            }

            // Process trail_product_ids (aceita ambos trial_product_ids e trail_product_ids para compatibilidade)
            const productIdsValue = r.trail_product_ids !== undefined && r.trail_product_ids !== null && r.trail_product_ids !== ''
              ? r.trail_product_ids
              : (r.trial_product_ids !== undefined && r.trial_product_ids !== null && r.trial_product_ids !== '' ? r.trial_product_ids : null)
            
            if (productIdsValue !== null) {
              const productIds = String(productIdsValue).trim()
              // Validate UUIDs if provided (comma-separated)
              if (productIds) {
                const ids = productIds.split(',').map(id => id.trim()).filter(Boolean)
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                const invalidIds = ids.filter(id => !uuidRegex.test(id))
                if (invalidIds.length > 0) {
                  results.push({ email, ok: false, error: `IDs de produtos inválidos: ${invalidIds.join(', ')}. Devem ser UUIDs válidos separados por vírgula.` })
                  continue
                }
                updateData.trail_product_ids = ids.join(',')
                hasUpdate = true
              } else {
                // Empty string means clear the field
                updateData.trail_product_ids = null
                hasUpdate = true
              }
            }

            if (!hasUpdate) {
              results.push({ email, ok: false, error: 'Nenhum campo válido para atualizar. Forneça account_type, member_seats_extra, trail_product_ids, name ou phone' })
              continue
            }

            // Update user
            const { error: updateErr } = await supabase
              .from('saas_users')
              .update(updateData)
              .eq('id', u.id)

            if (updateErr) {
              results.push({ email, ok: false, error: `Erro ao atualizar: ${updateErr.message}` })
              continue
            }

            results.push({ 
              email, 
              ok: true, 
              user_id: u.id,
              updated_fields: Object.keys(updateData).filter(k => k !== 'updated_at')
            })
          } catch (e: any) {
            results.push({ email, ok: false, error: e?.message || 'Erro desconhecido' })
          }
        }

        const successCount = results.filter(r => r.ok).length
        const errorCount = results.length - successCount

        return new Response(JSON.stringify({
          ok: true,
          total: rows.length,
          success_count: successCount,
          error_count: errorCount,
          results
        }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'Error in bulk update users' }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
    }

    // ===== Update frozen token status (admin-only)
    if (action === 'update_frozen_token' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const tokenId = (body?.token_id as string || '').trim()
        const isFrozen = Boolean(body?.is_frozen ?? false)
        const licenseDurationDays = body?.license_duration_days ? Number(body.license_duration_days) : null
        
        if (!tokenId) return new Response('Missing token_id', { status: 400, headers: getCorsHeaders(req) })
        
        // Validate: if frozen, license_duration_days must be provided and positive
        if (isFrozen && (!licenseDurationDays || licenseDurationDays <= 0)) {
          return new Response('License duration (days) is required and must be positive for frozen tokens', { status: 400, headers: getCorsHeaders(req) })
        }
        
        // Use RPC function to update token
        const { data, error } = await supabase.rpc('update_frozen_token', {
          p_token_id: tokenId,
          p_is_frozen: isFrozen,
          p_license_duration_days: licenseDurationDays
        })
        
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        
        if (!data?.success) {
          return new Response(data?.error || 'Failed to update token', { status: 400, headers: getCorsHeaders(req) })
        }
        
        return new Response(JSON.stringify({ ok: true, ...data }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error updating frozen token', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== Issue plan tokens to a user (admin-only)
    if (action === 'issue_tokens' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        let userId = (body?.user_id as string || '').trim()
        const email = (body?.email as string || '').trim().toLowerCase()
        let planId = (body?.plan_id as string || '').trim()
        const planSlugRaw = (body?.plan_slug as string || '').trim().toLowerCase()
        const quantity = Math.max(1, Math.min(100, Number(body?.quantity || 1)))
        // Use valid_days from body, default to 30 (mensal) if not provided
        // This matches the frontend default behavior
        const validDays = Math.max(1, Math.min(3650, Number(body?.valid_days || 30)))

        // Get the admin user ID who is issuing the tokens
        const adminUserId = userData?.user?.id || null
        if (!adminUserId) {
          return new Response('Admin authentication required', { status: 401, headers: getCorsHeaders(req) })
        }

        // Resolve user by email if needed
        if (!userId && email) {
          const { data: u } = await supabase.from('saas_users').select('id').eq('email', email).maybeSingle()
          userId = u?.id || ''
        }
        if (!userId) return new Response('Missing user_id or email', { status: 400, headers: getCorsHeaders(req) })

        // Resolve plan by id or slug and restrict to Starter/Pro
        let planRow: any = null
        if (planId) {
          const { data } = await supabase.from('saas_plans').select('id, slug, name').eq('id', planId).maybeSingle()
          planRow = data || null
        } else if (planSlugRaw) {
          const { data } = await supabase.from('saas_plans').select('id, slug, name').eq('slug', planSlugRaw).maybeSingle()
          planRow = data || null
          planId = planRow?.id || ''
        }
        if (!planRow || !planId) return new Response('Plan not found', { status: 400, headers: getCorsHeaders(req) })
        const allowedPlanIds = new Set([
          'd4836a79-186f-4905-bfac-77ec52fa1dde', // PRO
          '8b5a1000-957c-4eaf-beca-954a78187337', // Starter
          '4663da1a-b552-4127-b1af-4bc30c681682'  // Trial
        ])
        const allowedSlugs = new Set(['basic', 'starter', 'professional', 'pro'])
        const planSlug = String(planRow.slug || '').toLowerCase()
        const isPlanAllowed = allowedPlanIds.has(planId) || allowedSlugs.has(planSlug)
        if (!isPlanAllowed) {
          return new Response('Plan not allowed for token issuance', { status: 400, headers: getCorsHeaders(req) })
        }

        const nowIso = new Date().toISOString()
        const validUntil = new Date(Date.now() + validDays * 24 * 3600 * 1000).toISOString()
        
        // Support for frozen tokens
        const isFrozen = Boolean(body?.is_frozen || false)
        // For frozen tokens, use the valid_days from the form as license_duration_days
        // This way, the duration (e.g., 30 days) is stored and will be applied from attribution date
        const licenseDurationDays = isFrozen ? validDays : null
        
        // Validate: if frozen, we should have a valid duration (validDays should be set)
        if (isFrozen && (!licenseDurationDays || licenseDurationDays <= 0)) {
          return new Response('Valid duration (days) is required for frozen tokens', { status: 400, headers: getCorsHeaders(req) })
        }
        
        const rows = Array.from({ length: quantity }).map(() => ({
          owner_user_id: userId,
          plan_id: planId,
          status: 'available',
          purchased_at: nowIso,
          valid_until: isFrozen ? null : validUntil, // Frozen tokens don't have valid_until until attributed
          is_frozen: isFrozen,
          license_duration_days: licenseDurationDays, // Store duration in days, will be applied from attribution date
          issued_by: 'admin', // Keep legacy field for backward compatibility
          issued_by_user_id: adminUserId, // Store admin user ID in new column
          gateway: 'admin'
        }))
        const { error } = await supabase.from('saas_plan_tokens').insert(rows)
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ ok: true, issued: quantity, user_id: userId, plan_id: planId }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error issuing tokens', { status: 500, headers: getCorsHeaders(req) })
      }
    }
    if (action === 'list_users') {
      try {
        const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('page_size') || '20')))
        const search = (url.searchParams.get('search') || '').trim()
        const orderBy = (url.searchParams.get('order_by') || '').toLowerCase()
        const orderDir = ((url.searchParams.get('order_dir') || 'asc').toLowerCase() === 'desc') ? 'desc' : 'asc'
        
        // When searching, first find users by email, then filter by Supabase credentials
        // This ensures users without Supabase credentials can still be found when searched
        // UPDATED: Now checks both legacy saas_users fields AND new saas_supabases_connections table
        let explicitIds: string[] | null = null

        if (search) {
          // First, search users by email (without filters)
          const { data: searchResults, error: searchErr } = await supabase
            .from('saas_users')
            .select('id, supabase_url, supabase_key_encrypted')
            .ilike('email', `%${search}%`)
          if (searchErr) return new Response(searchErr.message, { status: 400, headers: getCorsHeaders(req) })
          
          const candidates = searchResults || []
          if (candidates.length === 0) {
            return new Response(JSON.stringify({ page, page_size: pageSize, total: 0, users: [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
          }
          
          // Check connection records for these users to support modern connection method
          const candidateIds = candidates.map((u: any) => u.id)
          let hasConnectionId = new Set<string>()
          if (candidateIds.length > 0) {
             const { data: connections } = await supabase
                .from('saas_supabases_connections')
                .select('owner_id')
                .in('owner_id', candidateIds)
             
             for (const c of connections || []) {
                hasConnectionId.add(c.owner_id)
             }
          }

          // Filter candidates: Must have legacy Supabase fields OR a connection record
          explicitIds = candidates
             .filter((u: any) => {
                const hasLegacy = u.supabase_url && u.supabase_key_encrypted
                const hasNew = hasConnectionId.has(u.id)
                return hasLegacy || hasNew
             })
             .map((u: any) => u.id)
             
          if (explicitIds.length === 0) {
             return new Response(JSON.stringify({ page, page_size: pageSize, total: 0, users: [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
          }
        }
        
        // First, get total count efficiently
        let countQ = supabase
          .from('saas_users')
          .select('id', { count: 'exact', head: true })
          
        if (explicitIds) {
          countQ = countQ.in('id', explicitIds)
        } else {
          countQ = countQ
            .not('supabase_url', 'is', null)
            .not('supabase_key_encrypted', 'is', null)
            .neq('supabase_url', '')
            .neq('supabase_key_encrypted', '')
        }
        
        const { count: totalCount, error: countErr } = await countQ
        if (countErr) return new Response(countErr.message, { status: 400, headers: getCorsHeaders(req) })
        const total = totalCount || 0

        // Base candidate set from saas_users with proper ordering
        let baseQ = supabase
          .from('saas_users')
          .select('id, email, organization_id, role, active, created_at, updated_at')
          
        if (explicitIds) {
          baseQ = baseQ.in('id', explicitIds)
        } else {
          baseQ = baseQ
            .not('supabase_url', 'is', null)
            .not('supabase_key_encrypted', 'is', null)
            .neq('supabase_url', '')
            .neq('supabase_key_encrypted', '')
        }
        
        // Apply ordering before pagination
        const allowedSort = new Set(['name', 'email', 'created_at', 'last_sign_in_at', 'orgs_count', 'last_event_at'])
        const sortKey = allowedSort.has(orderBy) ? orderBy : 'email'
        if (sortKey === 'email' || sortKey === 'name') {
          baseQ = baseQ.order('email', { ascending: orderDir === 'asc' })
        } else if (sortKey === 'created_at') {
          baseQ = baseQ.order('created_at', { ascending: orderDir === 'asc' })
        } else {
          baseQ = baseQ.order('email', { ascending: true })
        }
        
        // Apply pagination at database level
        const start = (page - 1) * pageSize
        baseQ = baseQ.range(start, start + pageSize - 1)
        
        const { data: baseUsers, error: baseErr } = await baseQ
        if (baseErr) return new Response(baseErr.message, { status: 400, headers: getCorsHeaders(req) })
        const all = baseUsers || []
        const allIds = all.map((u: any) => u.id)

        // Aggregations to support orgs_count and last_event_at
        let orgsCountByUser: Record<string, number> = {}
        if (allIds.length) {
          // Count organizations ONLY from MASTER saas_organizations table based on owner_id
          // This ensures we always show the true count from the master database
          const CHUNK = 100
          for (let i = 0; i < allIds.length; i += CHUNK) {
            const batch = allIds.slice(i, i + CHUNK)
            try {
              const { data: masterOrgs, error: masterErr } = await supabase
                .from('saas_organizations')
                .select('owner_id, id')
                .in('owner_id', batch)
              if (!masterErr && masterOrgs) {
                for (const row of masterOrgs) {
                  orgsCountByUser[row.owner_id] = (orgsCountByUser[row.owner_id] || 0) + 1
                }
              }
            } catch (err: any) {
              // Log error but continue - users without orgs will have count 0
              console.error(`Error counting orgs for batch: ${err?.message || err}`)
            }
          }
          // All users not found in the query above will have count 0 (default behavior)
        }

        let lastEventByUser: Record<string, string> = {}
        if (allIds.length) {
          const CHUNK = 100
          for (let i = 0; i < allIds.length; i += CHUNK) {
            const batch = allIds.slice(i, i + CHUNK)
            const { data: lastEv, error: evErr } = await supabase
              .from('saas_events')
              .select('user_id, created_at')
              .in('user_id', batch)
              .order('created_at', { ascending: false })
            if (evErr) return new Response(evErr.message, { status: 400, headers: getCorsHeaders(req) })
            for (const row of lastEv || []) {
              if (!lastEventByUser[row.user_id]) lastEventByUser[row.user_id] = row.created_at
            }
          }
        }

        // Last sign-in approximation from sessions (last_seen_at or created_at)
        let lastSeenByUser: Record<string, string> = {}
        if (allIds.length) {
          const CHUNK = 100
          for (let i = 0; i < allIds.length; i += CHUNK) {
            const batch = allIds.slice(i, i + CHUNK)
            const { data: seen, error: seenErr } = await supabase
              .from('saas_sessions')
              .select('user_id, last_seen_at, created_at')
              .in('user_id', batch)
              .order('last_seen_at', { ascending: false })
            if (seenErr) return new Response(seenErr.message, { status: 400, headers: getCorsHeaders(req) })
            for (const row of seen || []) {
              const when = row.last_seen_at || row.created_at
              if (when && !lastSeenByUser[row.user_id]) lastSeenByUser[row.user_id] = when
            }
          }
        }

        // Load organizations_extra for all users to compose display count
        const orgsExtraByUser: Record<string, number> = {}
        if (allIds.length) {
          const { data: extras } = await supabase
            .from('saas_users')
            .select('id, organizations_extra')
            .in('id', allIds)
          for (const r of extras || []) {
            orgsExtraByUser[r.id] = Number(r.organizations_extra || 0)
          }
        }

        // Build enriched list (already paginated and sorted at DB level for basic fields)
        let enriched = all.map((u: any) => ({
          id: u.id,
          email: u.email,
          name: u.email,
          created_at: u.created_at || null,
          last_sign_in_at: lastSeenByUser[u.id] || null,
          orgs_count: (orgsCountByUser[u.id] || 0),
          organizations_extra: orgsExtraByUser[u.id] || 0,
          last_event_at: lastEventByUser[u.id] || null
        }))

        // Re-sort for fields that require enrichment (orgs_count, last_event_at, last_sign_in_at)
        // These can't be sorted at DB level efficiently, so we sort in memory for the current page
        const needsMemorySort = ['orgs_count', 'last_event_at', 'last_sign_in_at'].includes(sortKey)
        if (needsMemorySort) {
          const compareStrings = (sa: any, sb: any) => {
            const a = (sa || '').toString()
            const b = (sb || '').toString()
            return a.localeCompare(b, 'pt', { sensitivity: 'base' })
          }
          const toTs = (v: any) => {
            try { return new Date(v).getTime() || 0 } catch { return 0 }
          }
          enriched.sort((a: any, b: any) => {
            const va = a[sortKey]
            const vb = b[sortKey]
            if (va == null && vb == null) return 0
            if (va == null) return -1
            if (vb == null) return 1
            if (sortKey === 'orgs_count') return Number(va) - Number(vb)
            if (sortKey === 'last_event_at' || sortKey === 'last_sign_in_at') {
              return toTs(va) - toTs(vb)
            }
            return compareStrings(va, vb)
          })
          if (orderDir === 'desc') enriched.reverse()
        }

        const pageUsers = enriched
        const pageIds = pageUsers.map(u => u.id)

        // Hydrate auth data for only the current page
        const authUsers: Record<string, any> = {}
        for (const id of pageIds) {
          const { data: au } = await supabase.auth.admin.getUserById(id)
          if (au?.user) authUsers[id] = au.user
        }
        const users = pageUsers.map(u => {
          const authUser = authUsers[u.id]
          const lastAuth = authUser?.last_sign_in_at || null
          return {
            ...u,
            created_at: authUser?.created_at || u.created_at,
            // Keep sessions-derived value for sorting; if missing, fallback to auth last_sign_in_at
            last_sign_in_at: u.last_sign_in_at || lastAuth || null,
            name: authUser?.user_metadata?.name || u.name || u.email
          }
        })

        const payload = { page, page_size: pageSize, total, users }
        return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error listing users', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // List users WITHOUT Supabase connection (no organization_id or no supabase connection)
    if (action === 'list_users_without_supabase') {
      try {
        const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('page_size') || '20')))
        const search = (url.searchParams.get('search') || '').trim()
        const orderBy = (url.searchParams.get('order_by') || '').toLowerCase()
        const orderDir = ((url.searchParams.get('order_dir') || 'asc').toLowerCase() === 'desc') ? 'desc' : 'asc'
        
        // Get all users first (without pagination) to filter properly
        // This ensures we catch users that might have supabase_url but no connection record
        let baseQ = supabase
          .from('saas_users')
          .select('id, email, organization_id, role, active, created_at, updated_at, supabase_url, supabase_key_encrypted')
        if (search) baseQ = baseQ.ilike('email', `%${search}%`)
        
        // Apply ordering
        const allowedSort = new Set(['name', 'email', 'created_at', 'last_sign_in_at'])
        const sortKey = allowedSort.has(orderBy) ? orderBy : 'email'
        if (sortKey === 'email' || sortKey === 'name') {
          baseQ = baseQ.order('email', { ascending: orderDir === 'asc' })
        } else if (sortKey === 'created_at') {
          baseQ = baseQ.order('created_at', { ascending: orderDir === 'asc' })
        } else {
          baseQ = baseQ.order('email', { ascending: true })
        }
        
        // Get all users (we'll filter and paginate after filtering)
        const { data: allUsers, error: baseErr } = await baseQ
        if (baseErr) return new Response(baseErr.message, { status: 400, headers: getCorsHeaders(req) })
        const all = allUsers || []
        const allIds = all.map((u: any) => u.id)

        // Check which users have connections in saas_supabase_connections
        const hasConnectionByUser: Record<string, boolean> = {}
        if (allIds.length) {
          const CHUNK = 100
          for (let i = 0; i < allIds.length; i += CHUNK) {
            const batch = allIds.slice(i, i + CHUNK)
            const { data: conns } = await supabase
              .from('saas_supabases_connections')
              .select('owner_id')
              .in('owner_id', batch)
            for (const row of conns || []) {
              hasConnectionByUser[row.owner_id] = true
            }
          }
        }

        // Filter: only users that:
        // 1. Don't have connection in saas_supabase_connections AND
        // 2. (Don't have organization_id OR don't have supabase_url/supabase_key_encrypted)
        const filtered = all.filter((u: any) => {
          const hasConnection = hasConnectionByUser[u.id]
          const hasOrg = !!u.organization_id
          const hasSupabaseCreds = !!(u.supabase_url && u.supabase_key_encrypted)
          // Include if: no connection AND (no org OR no supabase creds)
          return !hasConnection && (!hasOrg || !hasSupabaseCreds)
        })

        // Apply pagination after filtering
        const total = filtered.length
        const start = (page - 1) * pageSize
        const paginatedFiltered = filtered.slice(start, start + pageSize)

        // Last sign-in from sessions
        let lastSeenByUser: Record<string, string> = {}
        if (paginatedFiltered.length) {
          const filteredIds = paginatedFiltered.map((u: any) => u.id)
          const CHUNK = 100
          for (let i = 0; i < filteredIds.length; i += CHUNK) {
            const batch = filteredIds.slice(i, i + CHUNK)
            const { data: seen } = await supabase
              .from('saas_sessions')
              .select('user_id, last_seen_at, created_at')
              .in('user_id', batch)
              .order('last_seen_at', { ascending: false })
            for (const row of seen || []) {
              const when = row.last_seen_at || row.created_at
              if (when && !lastSeenByUser[row.user_id]) lastSeenByUser[row.user_id] = when
            }
          }
        }

        // Build enriched list
        let enriched = paginatedFiltered.map((u: any) => ({
          id: u.id,
          email: u.email,
          name: u.email,
          created_at: u.created_at || null,
          last_sign_in_at: lastSeenByUser[u.id] || null,
          has_org: !!u.organization_id,
          has_supabase_url: !!(u.supabase_url && u.supabase_key_encrypted)
        }))

        // Re-sort if needed
        const needsMemorySort = ['last_sign_in_at'].includes(sortKey)
        if (needsMemorySort) {
          const toTs = (v: any) => {
            try { return new Date(v).getTime() || 0 } catch { return 0 }
          }
          enriched.sort((a: any, b: any) => {
            const va = a[sortKey]
            const vb = b[sortKey]
            if (va == null && vb == null) return 0
            if (va == null) return -1
            if (vb == null) return 1
            if (sortKey === 'last_sign_in_at') {
              return toTs(va) - toTs(vb)
            }
            return 0
          })
          if (orderDir === 'desc') enriched.reverse()
        }

        const pageUsers = enriched
        const pageIds = pageUsers.map(u => u.id)

        // Hydrate auth data
        const authUsers: Record<string, any> = {}
        for (const id of pageIds) {
          const { data: au } = await supabase.auth.admin.getUserById(id)
          if (au?.user) authUsers[id] = au.user
        }
        const users = pageUsers.map(u => {
          const authUser = authUsers[u.id]
          const lastAuth = authUser?.last_sign_in_at || null
          return {
            ...u,
            created_at: authUser?.created_at || u.created_at,
            last_sign_in_at: u.last_sign_in_at || lastAuth || null,
            name: authUser?.user_metadata?.name || u.name || u.email
          }
        })

        const payload = { page, page_size: pageSize, total: filtered.length, users }
        return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error listing users without Supabase', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // List users WITHOUT Supabase for email (all, no pagination)
    if (action === 'list_users_without_supabase_for_email') {
      try {
        // Get all users
        let baseQ = supabase
          .from('saas_users')
          .select('id, email, organization_id, supabase_url, supabase_key_encrypted')
        
        const { data: allUsers, error: baseErr } = await baseQ
        if (baseErr) return new Response(baseErr.message, { status: 400, headers: getCorsHeaders(req) })
        const all = allUsers || []
        const allIds = all.map((u: any) => u.id)

        // Check which users have connections in saas_supabase_connections
        const hasConnectionByUser: Record<string, boolean> = {}
        if (allIds.length) {
          const CHUNK = 100
          for (let i = 0; i < allIds.length; i += CHUNK) {
            const batch = allIds.slice(i, i + CHUNK)
            const { data: conns } = await supabase
              .from('saas_supabases_connections')
              .select('owner_id')
              .in('owner_id', batch)
            for (const row of conns || []) {
              hasConnectionByUser[row.owner_id] = true
            }
          }
        }

        // Filter: only users that:
        // 1. Don't have connection in saas_supabase_connections AND
        // 2. (Don't have organization_id OR don't have supabase_url/supabase_key_encrypted)
        const filtered = all.filter((u: any) => {
          const hasConnection = hasConnectionByUser[u.id]
          const hasOrg = !!u.organization_id
          const hasSupabaseCreds = !!(u.supabase_url && u.supabase_key_encrypted)
          return !hasConnection && (!hasOrg || !hasSupabaseCreds)
        })

        // Get auth data for names
        const authUsers: Record<string, any> = {}
        for (const id of filtered.map((u: any) => u.id)) {
          const { data: au } = await supabase.auth.admin.getUserById(id)
          if (au?.user) authUsers[id] = au.user
        }

        const users = filtered.map((u: any) => {
          const authUser = authUsers[u.id]
          return {
            id: u.id,
            email: u.email,
            name: authUser?.user_metadata?.name || u.email.split('@')[0]
          }
        })

        return new Response(JSON.stringify({ users, total: users.length }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error listing users without Supabase for email', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // List users WITHOUT tokens in saas_plan_tokens
    if (action === 'list_users_without_tokens') {
      try {
        // Get all users
        const { data: allUsers, error: usersErr } = await supabase
          .from('saas_users')
          .select('id, email, created_at')
        
        if (usersErr) return new Response(usersErr.message, { status: 400, headers: getCorsHeaders(req) })
        
        const allUserIds = (allUsers || []).map((u: any) => u.id)
        
        // Get users that HAVE tokens
        const { data: tokensData } = await supabase
          .from('saas_plan_tokens')
          .select('owner_user_id')
          .in('owner_user_id', allUserIds)
        
        const usersWithTokens = new Set((tokensData || []).map((t: any) => t.owner_user_id))
        
        // Filter: users without tokens
        const usersWithoutTokens = (allUsers || []).filter((u: any) => !usersWithTokens.has(u.id))
        
        // Get auth data for names
        const authUsers: Record<string, any> = {}
        for (const id of usersWithoutTokens.map((u: any) => u.id)) {
          const { data: au } = await supabase.auth.admin.getUserById(id)
          if (au?.user) authUsers[id] = au.user
        }
        
        const users = usersWithoutTokens.map((u: any) => {
          const authUser = authUsers[u.id]
          return {
            id: u.id,
            email: u.email,
            name: authUser?.user_metadata?.name || u.email.split('@')[0],
            created_at: authUser?.created_at || u.created_at
          }
        })
        
        return new Response(JSON.stringify({ users, total: users.length }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error listing users without tokens', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // List users with tokens expiring in less than 7 days
    if (action === 'list_users_tokens_expiring_soon') {
      try {
        const now = new Date()
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        const nowISO = now.toISOString()
        const sevenDaysISO = sevenDaysFromNow.toISOString()
        
        // Get tokens expiring in next 7 days
        const { data: expiringTokens, error: tokensErr } = await supabase
          .from('saas_plan_tokens')
          .select('owner_user_id, valid_until')
          .not('valid_until', 'is', null)
          .gte('valid_until', nowISO)
          .lte('valid_until', sevenDaysISO)
          .eq('status', 'active')
        
        if (tokensErr) return new Response(tokensErr.message, { status: 400, headers: getCorsHeaders(req) })
        
        // Get unique user IDs
        const userIds = [...new Set((expiringTokens || []).map((t: any) => t.owner_user_id))]
        
        if (userIds.length === 0) {
          return new Response(JSON.stringify({ users: [], total: 0 }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }
        
        // Get user data
        const { data: usersData, error: usersErr } = await supabase
          .from('saas_users')
          .select('id, email, created_at')
          .in('id', userIds)
        
        if (usersErr) return new Response(usersErr.message, { status: 400, headers: getCorsHeaders(req) })
        
        // Get auth data for names
        const authUsers: Record<string, any> = {}
        for (const id of userIds) {
          const { data: au } = await supabase.auth.admin.getUserById(id)
          if (au?.user) authUsers[id] = au.user
        }
        
        // Build map of earliest expiration per user
        const earliestExpiration: Record<string, string> = {}
        for (const token of expiringTokens || []) {
          const userId = token.owner_user_id
          const validUntil = token.valid_until
          if (!earliestExpiration[userId] || validUntil < earliestExpiration[userId]) {
            earliestExpiration[userId] = validUntil
          }
        }
        
        const users = (usersData || []).map((u: any) => {
          const authUser = authUsers[u.id]
          return {
            id: u.id,
            email: u.email,
            name: authUser?.user_metadata?.name || u.email.split('@')[0],
            created_at: authUser?.created_at || u.created_at,
            token_expires_at: earliestExpiration[u.id] || null
          }
        })
        
        return new Response(JSON.stringify({ users, total: users.length }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error listing users with expiring tokens', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // Connect Supabase for a user (create entry in saas_supabase_connections)
    if (action === 'connect_supabase_for_user' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const userId = (body?.user_id as string || '').trim()
        const organizationId = (body?.organization_id as string || '').trim()
        const supabaseUrl = (body?.supabase_url as string || '').trim()
        const anonKey = (body?.anon_key as string || '').trim()
        const serviceRoleKey = (body?.service_role_key as string || '').trim()
        
        if (!userId || !supabaseUrl || !anonKey) {
          return new Response('Missing user_id, supabase_url, or anon_key', { status: 400, headers: getCorsHeaders(req) })
        }

        // Test connection
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
        const testClient = createClient(supabaseUrl, anonKey)
        const { error: testErr } = await testClient.from('clients' as any).select('count', { count: 'exact', head: true })
        if (testErr && testErr.code !== 'PGRST116' && testErr.code !== '42P01') {
          return new Response(`Connection test failed: ${testErr.message}`, { status: 400, headers: getCorsHeaders(req) })
        }

        let clientOrgId = organizationId
        if (!clientOrgId) {
          try {
            clientOrgId = await resolveClientOrgId(supabase, userId)
          } catch {
            clientOrgId = null
          }
        }
        if (!clientOrgId) {
          return new Response('organization_id is required to bind credentials', { status: 400, headers: getCorsHeaders(req) })
        }

        // Use pgcrypto encryption via RPC (not base64!)
        let encryptedAnon: string | null
        let encryptedService: string | null = null
        try {
          encryptedAnon = await encryptKeyWithRpc(supabase, anonKey)
          if (serviceRoleKey) {
            encryptedService = await encryptKeyWithRpc(supabase, serviceRoleKey)
          }
        } catch (encErr: any) {
          return new Response(`Encryption failed: ${encErr.message}`, { status: 500, headers: getCorsHeaders(req) })
        }

        const { error: orgErr } = await supabase
          .from('saas_organizations')
          .upsert({
            owner_id: userId,
            client_org_id: clientOrgId,
            client_supabase_url: supabaseUrl,
            client_anon_key_encrypted: encryptedAnon,
            client_service_key_encrypted: encryptedService,
            setup_completed: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'owner_id,client_org_id' })
        if (orgErr) return new Response(orgErr.message, { status: 400, headers: getCorsHeaders(req) })

        const { error: connErr } = await supabase
          .from('saas_supabases_connections')
          .upsert({
            owner_id: userId,
            supabase_url: supabaseUrl,
            anon_key_encrypted: encryptedAnon,
            service_role_encrypted: encryptedService,
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'owner_id,supabase_url' })

        if (connErr) return new Response(connErr.message, { status: 400, headers: getCorsHeaders(req) })

        return new Response(JSON.stringify({ ok: true, user_id: userId, organization_id: clientOrgId }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error connecting Supabase', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // Create organization for user using their Supabase connection
    // Create new user and send password setup email
    if (action === 'create_user' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const email = (body?.email as string || '').trim().toLowerCase()
        const name = (body?.name as string || '').trim()
        const accountType = (body?.account_type as string || '').trim() || 'padrao'
        const memberSeatsExtra = Number(body?.member_seats_extra || 0)
        const redirectToRaw = (body?.redirect_url as string || '').trim()
        const passwordStrategyRaw = (body?.password_strategy || body?.password_mode || '').trim().toLowerCase()
        const providedPassword = (body?.password as string || '').trim()
        const passwordLengthRaw = Number(body?.password_length || 16)
        const generatePasswordFlag = body?.generate_password === true

        if (!email) {
          return new Response('Missing email', { status: 400, headers: getCorsHeaders(req) })
        }

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return new Response('Invalid email format', { status: 400, headers: getCorsHeaders(req) })
        }

        // Check if user already exists
        const { data: existing } = await supabase
          .from('saas_users')
          .select('id, email')
          .eq('email', email)
          .maybeSingle()
        if (existing?.id) {
          return new Response('User already exists', { status: 409, headers: getCorsHeaders(req) })
        }

        // Build redirect URL for recovery strategy
        const DEFAULT_APP_URL = Deno.env.get('APP_PUBLIC_URL') || Deno.env.get('VITE_APP_PUBLIC_URL') || ''
        let redirectTo = ''
        try {
          redirectTo = redirectToRaw || (DEFAULT_APP_URL ? new URL('/auth/recovery', DEFAULT_APP_URL).toString() : '')
        } catch {
          redirectTo = ''
        }

        // Resolve password strategy
        const normalizedStrategy = passwordStrategyRaw || ''
        let passwordStrategy: 'recovery_link' | 'custom' | 'random' = 'recovery_link'
        if (normalizedStrategy === 'custom' || normalizedStrategy === 'manual' || normalizedStrategy === 'set_password') {
          passwordStrategy = 'custom'
        } else if (normalizedStrategy === 'random') {
          passwordStrategy = 'random'
        } else if (!normalizedStrategy) {
          if (providedPassword) {
            passwordStrategy = 'custom'
          } else if (generatePasswordFlag) {
            passwordStrategy = 'random'
          }
        }

        let finalPassword: string | null = null
        if (passwordStrategy === 'custom') {
          if (!providedPassword) {
            return new Response('password is required when password_strategy=custom', { status: 400, headers: getCorsHeaders(req) })
          }
          if (providedPassword.length < 8) {
            return new Response('Password must be at least 8 characters', { status: 400, headers: getCorsHeaders(req) })
          }
          finalPassword = providedPassword
        } else if (passwordStrategy === 'random') {
          const requestedLength = Number.isFinite(passwordLengthRaw) ? passwordLengthRaw : 16
          finalPassword = generateSecurePassword(requestedLength)
        }

        // Create user in Supabase Auth
        const createPayload: any = {
          email,
          email_confirm: passwordStrategy !== 'recovery_link', // Allow immediate login when password is defined
          user_metadata: {
            name: name || email.split('@')[0],
            account_type: accountType
          }
        }
        if (finalPassword) {
          createPayload.password = finalPassword
        }

        const { data: createdUser, error: createErr } = await supabase.auth.admin.createUser(createPayload)

        if (createErr || !createdUser?.user?.id) {
          return new Response(`Failed to create user: ${createErr?.message || 'Unknown error'}`, { status: 400, headers: getCorsHeaders(req) })
        }

        const userId = createdUser.user.id

        // Wait a bit for trigger to create saas_users entry
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Update saas_users with additional fields if provided
        if (accountType !== 'padrao' || memberSeatsExtra > 0 || name) {
          const updateData: any = { updated_at: new Date().toISOString() }
          if (accountType !== 'padrao') updateData.account_type = accountType
          if (memberSeatsExtra > 0) updateData.member_seats_extra = memberSeatsExtra
          if (name) updateData.name = name
          
          await supabase
            .from('saas_users')
            .update(updateData)
            .eq('id', userId)
        }

        let emailSent = false
        let passwordSetupLink: string | null = null

        if (passwordStrategy === 'recovery_link') {
          // Generate recovery link for password setup
          const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
            type: 'recovery',
            email,
            options: {
              redirectTo: redirectTo || undefined
            }
          })

          if (linkErr || !linkData) {
            // User created but failed to generate link - still return success but log error
            console.error('Failed to generate recovery link:', linkErr)
            return new Response(JSON.stringify({
              ok: true,
              user_id: userId,
              email,
              password_strategy: passwordStrategy,
              warning: 'User created but failed to generate password setup link. You may need to send recovery email manually.'
            }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
          }

          // Extract action_link - try multiple possible paths
          const actionLink = (linkData as any)?.properties?.action_link 
            || (linkData as any)?.action_link 
            || (linkData as any)?.link
            || ''

          if (!actionLink) {
            console.error('Failed to extract action_link from linkData:', JSON.stringify(linkData))
            return new Response(JSON.stringify({
              ok: false,
              user_id: userId,
              email,
              password_strategy: passwordStrategy,
              error: 'Failed to extract password setup link. User created but email not sent.'
            }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
          }

          passwordSetupLink = actionLink

          if (body?.send_recovery_email === false) {
            // Skip email dispatch, return link to the caller
            return new Response(JSON.stringify({
              ok: true,
              user_id: userId,
              email,
              password_strategy: passwordStrategy,
              password_setup_link: passwordSetupLink,
              message: 'User created successfully. Share the password setup link manually.'
            }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
          }

          // Send email via Resend
          const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
          const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'TomikCRM <no-reply@automatiklabs.com.br>'
          
          if (!RESEND_API_KEY) {
            console.error('RESEND_API_KEY not configured')
            return new Response(JSON.stringify({
              ok: false,
              user_id: userId,
              email,
              password_strategy: passwordStrategy,
              error: 'Email service not configured. User created but email not sent.'
            }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
          }

          const subject = 'Bem-vindo ao TomikCRM - Defina sua senha'
          const html = `
            <div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#0f172a; max-width:600px; margin:0 auto">
              <h2 style="margin:0 0 12px; color:#1e293b">Bem-vindo ao TomikCRM!</h2>
              <p style="margin:0 0 16px; color:#475569; line-height:1.6">
                Sua conta foi criada com sucesso. Clique no botão abaixo para definir sua senha e começar a usar o sistema.
              </p>
              <p style="margin:24px 0">
                <a href="${actionLink}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:500">Definir senha</a>
              </p>
              <p style="margin:16px 0 0;color:#64748b;font-size:14px;line-height:1.5">
                Este link é válido por 24 horas. Se você não solicitou esta conta, ignore este e-mail.
              </p>
              <p style="margin:16px 0 0;color:#64748b;font-size:12px;line-height:1.5">
                Se o botão não funcionar, copie e cole este link no navegador:<br>
                <a href="${actionLink}" style="color:#3b82f6;word-break:break-all">${actionLink}</a>
              </p>
            </div>
          `

          try {
            const resendRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: RESEND_FROM_EMAIL,
                to: [email],
                subject,
                html
              })
            })

            if (!resendRes.ok) {
              const txt = await resendRes.text().catch(() => '')
              console.error('Resend error:', resendRes.status, txt)
              return new Response(JSON.stringify({
                ok: false,
                user_id: userId,
                email,
                password_strategy: passwordStrategy,
                error: `Failed to send email: ${txt || resendRes.statusText}. User created but email not sent.`
              }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
            }
            emailSent = true
          } catch (emailErr: any) {
            console.error('Failed to send email:', emailErr)
            return new Response(JSON.stringify({
              ok: false,
              user_id: userId,
              email,
              password_strategy: passwordStrategy,
              error: `Failed to send email: ${emailErr?.message || 'Unknown error'}. User created but email not sent.`
            }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
          }
        }

        const responsePayload: any = {
          ok: true,
          user_id: userId,
          email,
          password_strategy: passwordStrategy
        }

        if (passwordStrategy === 'recovery_link') {
          responsePayload.password_setup_link = passwordSetupLink
          responsePayload.password_email_sent = emailSent
          responsePayload.message = emailSent
            ? 'User created successfully. Password setup email sent.'
            : 'User created successfully.'
        } else if (passwordStrategy === 'random') {
          responsePayload.generated_password = finalPassword
          responsePayload.message = 'User created with a temporary password.'
        } else {
          responsePayload.message = 'User created with the provided password.'
        }

        return new Response(JSON.stringify(responsePayload), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error creating user', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'generate_magic_link' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const email = (body?.email as string || '').trim().toLowerCase()
        const redirectToRaw = (body?.redirect_url as string || '').trim()
        const sendEmail = body?.send_email === true
        const flowTypeRaw = (body?.flow_type as string || body?.type as string || '').trim().toLowerCase()

        if (!email) {
          return new Response('Missing email', { status: 400, headers: getCorsHeaders(req) })
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return new Response('Invalid email format', { status: 400, headers: getCorsHeaders(req) })
        }

        // Ensure user exists
        const { data: userRow, error: userErr } = await supabase
          .from('saas_users')
          .select('id, email, name')
          .eq('email', email)
          .maybeSingle()

        if (userErr) {
          return new Response(userErr.message, { status: 400, headers: getCorsHeaders(req) })
        }
        if (!userRow?.id) {
          return new Response('User not found for the provided email', { status: 404, headers: getCorsHeaders(req) })
        }

        const DEFAULT_APP_URL = Deno.env.get('APP_PUBLIC_URL') || Deno.env.get('VITE_APP_PUBLIC_URL') || ''
        let redirectTo = ''
        try {
          redirectTo = redirectToRaw || (DEFAULT_APP_URL ? new URL('/', DEFAULT_APP_URL).toString() : '')
        } catch {
          redirectTo = redirectToRaw || DEFAULT_APP_URL || ''
        }

        const allowedTypes = new Set(['magiclink', 'signup', 'recovery', 'otp'])
        const linkType = allowedTypes.has(flowTypeRaw) ? flowTypeRaw : 'magiclink'

        const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
          type: linkType,
          email,
          options: redirectTo ? { redirectTo } : undefined
        } as any)

        if (linkErr || !linkData) {
          return new Response(`Failed to generate link: ${linkErr?.message || 'Unknown error'}`, { status: 400, headers: getCorsHeaders(req) })
        }

        const actionLink = (linkData as any)?.properties?.action_link
          || (linkData as any)?.action_link
          || ''

        if (!actionLink) {
          return new Response('Failed to retrieve action link from Supabase', { status: 500, headers: getCorsHeaders(req) })
        }

        let emailSent = false
        if (sendEmail) {
          const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
          const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'TomikCRM <no-reply@automatiklabs.com.br>'

          if (!RESEND_API_KEY) {
            return new Response('Email service not configured (RESEND_API_KEY missing)', { status: 500, headers: getCorsHeaders(req) })
          }

          const subject = (() => {
            if (linkType === 'recovery') return 'Recupere sua senha do TomikCRM'
            if (linkType === 'signup') return 'Confirme seu email no TomikCRM'
            return 'Seu link de acesso ao TomikCRM'
          })()
          const cta = (() => {
            if (linkType === 'recovery') return 'Criar nova senha'
            if (linkType === 'signup') return 'Confirmar email'
            return 'Entrar agora'
          })()
          const title = (() => {
            if (linkType === 'recovery') return 'Recuperação de senha'
            if (linkType === 'signup') return 'Confirmação de email'
            return 'Acesse com link mágico'
          })()
          const html = `
            <div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#0f172a; max-width:600px; margin:0 auto">
              <h2 style="margin:0 0 12px; color:#1e293b">${title}</h2>
              <p style="margin:0 0 16px; color:#475569; line-height:1.6">
                Clique no botão abaixo para continuar.
              </p>
              <p style="margin:24px 0">
                <a href="${actionLink}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:500">${cta}</a>
              </p>
              <p style="margin:16px 0 0;color:#64748b;font-size:12px;line-height:1.5">
                O link é válido por 24 horas. Se você não solicitou este acesso, ignore este email.
              </p>
              <p style="margin:16px 0 0;color:#64748b;font-size:12px;line-height:1.5">
                Se o botão não funcionar, copie e cole este link no navegador:<br>
                <a href="${actionLink}" style="color:#3b82f6;word-break:break-all">${actionLink}</a>
              </p>
            </div>
          `

          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: RESEND_FROM_EMAIL,
              to: [email],
              subject,
              html
            })
          })

          if (!resendRes.ok) {
            const txt = await resendRes.text().catch(() => '')
            return new Response(`Failed to send email: ${txt || resendRes.statusText}`, { status: 500, headers: getCorsHeaders(req) })
          }
          emailSent = true
        }

        return new Response(JSON.stringify({
          ok: true,
          user_id: userRow.id,
          email,
          type: linkType,
          action_link: actionLink,
          redirect_url: redirectTo || null,
          email_sent: emailSent
        }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error generating magic link', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'bulk_create_users' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const users = body.users || [] // Array of { email, name?, account_type?, member_seats_extra? }
        
        if (!Array.isArray(users) || users.length === 0) {
          return new Response(JSON.stringify({ error: 'users array is required' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }

        if (users.length > 100) {
          return new Response(JSON.stringify({ error: 'Maximum 100 users per batch' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }

        const DEFAULT_APP_URL = Deno.env.get('APP_PUBLIC_URL') || Deno.env.get('VITE_APP_PUBLIC_URL') || ''
        let redirectTo = ''
        try {
          redirectTo = DEFAULT_APP_URL ? new URL('/auth/recovery', DEFAULT_APP_URL).toString() : ''
        } catch {
          redirectTo = ''
        }

        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
        const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'TomikCRM <no-reply@automatiklabs.com.br>'

        const results = {
          success: [] as Array<{ email: string; user_id: string }>,
          errors: [] as Array<{ email: string; error: string }>,
          skipped: [] as Array<{ email: string; reason: string }>
        }

        // Process users sequentially to avoid rate limits
        for (const userData of users) {
          const email = (userData.email || '').trim().toLowerCase()
          const name = (userData.name || '').trim()
          const accountType = (userData.account_type || 'padrao') as string
          const memberSeatsExtra = Number(userData.member_seats_extra) || 0

          if (!email) {
            results.errors.push({ email: email || 'unknown', error: 'Email is required' })
            continue
          }

          // Validate email format
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            results.errors.push({ email, error: 'Invalid email format' })
            continue
          }

          try {
            // Check if user already exists
            const { data: existing } = await supabase
              .from('saas_users')
              .select('id, email')
              .eq('email', email)
              .maybeSingle()
            
            if (existing?.id) {
              results.skipped.push({ email, reason: 'User already exists' })
              continue
            }

            // Create user in Supabase Auth
            const { data: createdUser, error: createErr } = await supabase.auth.admin.createUser({
              email,
              email_confirm: false,
              user_metadata: {
                name: name || email.split('@')[0],
                account_type: accountType
              }
            })

            if (createErr || !createdUser?.user?.id) {
              results.errors.push({ email, error: `Failed to create user: ${createErr?.message || 'Unknown error'}` })
              continue
            }

            const userId = createdUser.user.id

            // Wait a bit for trigger to create saas_users entry
            await new Promise(resolve => setTimeout(resolve, 1000))

            // Update saas_users with additional fields if provided
            if (accountType !== 'padrao' || memberSeatsExtra > 0 || name) {
              const updateData: any = { updated_at: new Date().toISOString() }
              if (accountType !== 'padrao') updateData.account_type = accountType
              if (memberSeatsExtra > 0) updateData.member_seats_extra = memberSeatsExtra
              if (name) updateData.name = name
              
              await supabase
                .from('saas_users')
                .update(updateData)
                .eq('id', userId)
            }

            // Generate recovery link for password setup
            const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
              type: 'recovery',
              email,
              options: {
                redirectTo: redirectTo || undefined
              }
            })

            if (linkErr || !linkData) {
              results.errors.push({ email, error: 'Failed to generate password setup link' })
              continue
            }

            // Extract action_link - try multiple possible paths
            const actionLink = (linkData as any)?.properties?.action_link 
              || (linkData as any)?.action_link 
              || (linkData as any)?.link
              || ''

            if (!actionLink) {
              console.error(`Failed to extract action_link for ${email}:`, JSON.stringify(linkData))
              results.errors.push({ email, error: 'Failed to extract password setup link' })
              continue
            }

            // Send email via Resend
            if (!RESEND_API_KEY) {
              console.error('RESEND_API_KEY not configured')
              results.errors.push({ email, error: 'Email service not configured' })
              continue
            }

            const subject = 'Bem-vindo ao TomikCRM - Defina sua senha'
            const html = `
              <div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#0f172a; max-width:600px; margin:0 auto">
                <h2 style="margin:0 0 12px; color:#1e293b">Bem-vindo ao TomikCRM!</h2>
                <p style="margin:0 0 16px; color:#475569; line-height:1.6">
                  ${name ? `Olá ${name},` : 'Olá,'}<br>
                  Sua conta foi criada com sucesso. Clique no botão abaixo para definir sua senha e começar a usar o sistema.
                </p>
                <p style="margin:24px 0">
                  <a href="${actionLink}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:500">Definir senha</a>
                </p>
                <p style="margin:16px 0 0;color:#64748b;font-size:14px;line-height:1.5">
                  Este link é válido por 24 horas. Se você não solicitou esta conta, ignore este e-mail.
                </p>
                <p style="margin:16px 0 0;color:#64748b;font-size:12px;line-height:1.5">
                  Se o botão não funcionar, copie e cole este link no navegador:<br>
                  <a href="${actionLink}" style="color:#3b82f6;word-break:break-all">${actionLink}</a>
                </p>
              </div>
            `

            try {
              const resendRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${RESEND_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  from: RESEND_FROM_EMAIL,
                  to: [email],
                  subject,
                  html
                })
              })

              if (!resendRes.ok) {
                const txt = await resendRes.text().catch(() => '')
                console.error(`Resend error for ${email}:`, resendRes.status, txt)
                results.errors.push({ email, error: `Failed to send email: ${txt || resendRes.statusText}` })
                continue
              }
            } catch (emailErr: any) {
              console.error(`Failed to send email to ${email}:`, emailErr)
              results.errors.push({ email, error: `Failed to send email: ${emailErr?.message || 'Unknown error'}` })
              continue
            }

            results.success.push({ email, user_id: userId })
          } catch (err: any) {
            results.errors.push({ email, error: err?.message || 'Unknown error' })
          }

          // Small delay between users to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 200))
        }

        return new Response(JSON.stringify({
          ok: true,
          total: users.length,
          success_count: results.success.length,
          error_count: results.errors.length,
          skipped_count: results.skipped.length,
          results
        }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'Error bulk creating users' }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
    }

    if (action === 'create_org_for_user' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const userId = (body?.user_id as string || '').trim()
        const orgName = (body?.org_name as string || '').trim()
        const orgSlug = (body?.org_slug as string || '').trim().toLowerCase()
        
        if (!userId || !orgName || !orgSlug) {
          return new Response('Missing user_id, org_name, or org_slug', { status: 400, headers: getCorsHeaders(req) })
        }

        // Get user's Supabase connection
        const { data: conn, error: connErr } = await supabase
          .from('saas_supabases_connections')
          .select('supabase_url, anon_key_encrypted')
          .eq('owner_id', userId)
          .eq('is_active', true)
          .order('last_used_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (connErr || !conn || !conn.supabase_url || !conn.anon_key_encrypted) {
          return new Response('User does not have an active Supabase connection. Please connect Supabase first.', { status: 400, headers: getCorsHeaders(req) })
        }

        // Decode key
        let clientKey = ''
        try { clientKey = atob(conn.anon_key_encrypted) } catch {
          return new Response('Invalid Supabase key format', { status: 400, headers: getCorsHeaders(req) })
        }

        // Connect to client Supabase
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
        const client = createClient(conn.supabase_url, clientKey)

        // Check if slug exists in Client
        const { data: existingClient } = await client
          .from('saas_organizations')
          .select('id')
          .eq('slug', orgSlug)
          .maybeSingle()
        if (existingClient?.id) {
          return new Response('Slug already exists in client database', { status: 409, headers: getCorsHeaders(req) })
        }

        // Check if slug exists in Master (by owner)
        const { data: existingMaster } = await supabase
          .from('saas_organizations')
          .select('id')
          .eq('owner_id', userId)
          .eq('slug', orgSlug)
          .maybeSingle()
        if (existingMaster?.id) {
          return new Response('Slug already exists for this user', { status: 409, headers: getCorsHeaders(req) })
        }

        // Create organization in Client
        const { data: clientOrg, error: clientOrgErr } = await client
          .from('saas_organizations')
          .insert({
            name: orgName,
            slug: orgSlug,
            owner_id: userId,
            plan_type: 'trial',
            is_active: true
          })
          .select('id, name, slug, created_at, updated_at')
          .single()

        if (clientOrgErr || !clientOrg) {
          return new Response(`Failed to create organization in client: ${clientOrgErr?.message || 'Unknown error'}`, { status: 400, headers: getCorsHeaders(req) })
        }

        // Create organization in Master with client_org_id
        const { data: masterOrg, error: masterOrgErr } = await supabase
          .from('saas_organizations')
          .insert({
            name: orgName,
            slug: orgSlug,
            owner_id: userId,
            client_org_id: clientOrg.id,
            client_supabase_url: conn.supabase_url,
            client_anon_key_encrypted: conn.anon_key_encrypted,
            active: true
          })
          .select('id, name, slug, client_org_id')
          .single()

        if (masterOrgErr || !masterOrg) {
          // Try to clean up client org if master creation failed
          try {
            await client.from('saas_organizations').delete().eq('id', clientOrg.id)
          } catch {}
          return new Response(`Failed to create organization in master: ${masterOrgErr?.message || 'Unknown error'}`, { status: 400, headers: getCorsHeaders(req) })
        }

        // Update user's organization_id via RPC
        const { error: updErr } = await supabase.rpc('update_user_organization', {
          p_user_id: userId,
          p_organization_id: clientOrg.id
        })

        if (updErr) {
          console.warn('Failed to update user organization_id:', updErr)
          // Non-fatal, continue
        }

        // Best-effort: run setup SQL on client
        try {
          await client.rpc('setup_crm_database')
        } catch {}

        return new Response(JSON.stringify({
          ok: true,
          master_org: masterOrg,
          client_org: clientOrg
        }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error creating organization', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'update_email' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const userId = body?.user_id as string
        const newEmail = (body?.new_email as string || '').trim()
        if (!userId || !newEmail) return new Response('Missing user_id or new_email', { status: 400, headers: getCorsHeaders(req) })

        const { data: upd, error: updErr } = await supabase.auth.admin.updateUserById(userId, { email: newEmail, email_confirm: true })
        if (updErr) return new Response(updErr.message, { status: 400, headers: getCorsHeaders(req) })

        // Mirror to saas_users
        await supabase.from('saas_users').update({ email: newEmail, updated_at: new Date().toISOString() }).eq('id', userId)

        return new Response(JSON.stringify({ ok: true, user: upd?.user || null }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error updating email', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'mirror_org_self' && req.method === 'POST') {
      // Limited self-service: current user can mirror their own orgs
      try {
        const body = await req.json().catch(() => ({}))
        const ownerId = (body?.owner_id as string || '').trim()
        if (!ownerId || ownerId !== (userData.user.id)) {
          return new Response('Forbidden', { status: 403, headers: getCorsHeaders(req) })
        }
        // Reuse resync_orgs logic
        const proxyReq = new Request(new URL(req.url).toString(), { method: 'POST', headers: req.headers, body: JSON.stringify({ owner_id: ownerId }) })
        const cloned = new Request(proxyReq)
        const handler = async () => {
          // Inline call to resync_orgs logic
          const { data: credRow } = await supabase
            .from('saas_users')
            .select('id, supabase_url, supabase_key_encrypted')
            .eq('id', ownerId)
            .maybeSingle()
          const urlc = credRow?.supabase_url
          const enc = credRow?.supabase_key_encrypted
          if (!urlc || !enc) return new Response('Client credentials not found', { status: 400, headers: getCorsHeaders(req) })
          let keyc = ''
          try { keyc = atob(enc) } catch {}
          if (!keyc) return new Response('Invalid client key', { status: 400, headers: getCorsHeaders(req) })
          const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
          const client = createClient(urlc, keyc)
          const { data: clientOrgs, error: clientErr } = await client
            .from('saas_organizations')
            .select('id, name, slug, created_at, updated_at')
          if (clientErr) return new Response(clientErr.message, { status: 400, headers: getCorsHeaders(req) })
          for (const o of clientOrgs || []) {
            const row = { name: o.name, slug: o.slug, owner_id: ownerId, client_org_id: o.id, created_at: o.created_at || new Date().toISOString(), updated_at: o.updated_at || new Date().toISOString() }
            const { error: upErr } = await supabase
              .from('saas_organizations')
              .upsert(row, { onConflict: 'owner_id,client_org_id', ignoreDuplicates: false })
            if (upErr) return new Response(upErr.message, { status: 400, headers: getCorsHeaders(req) })
          }
          return new Response(JSON.stringify({ ok: true, synced: (clientOrgs || []).length }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }
        return await handler()
      } catch (err: any) {
        return new Response(err?.message || 'Error mirroring orgs', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'send_recovery' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const email = (body?.email as string || '').trim()
        const redirectTo = (body?.redirect_url as string || '')
        if (!email) return new Response('Missing email', { status: 400, headers: getCorsHeaders(req) })

        const { error: recErr } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo || undefined })
        if (recErr) return new Response(recErr.message, { status: 400, headers: getCorsHeaders(req) })

        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error sending recovery email', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'user_activity') {
      try {
        const userId = url.searchParams.get('user_id') || ''
        if (!userId) return new Response('Missing user_id', { status: 400, headers: getCorsHeaders(req) })
        const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') || '30')))
        const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()

        const { data: events, error: evErr } = await supabase
          .from('saas_events')
          .select('id, event_name, created_at, props')
          .eq('user_id', userId)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(200)
        if (evErr) return new Response(evErr.message, { status: 400, headers: getCorsHeaders(req) })

        const { data: orgs, error: orgErr } = await supabase
          .from('saas_organizations')
          .select('id, name, slug, owner_id, created_at')
          .eq('owner_id', userId)
        if (orgErr) return new Response(orgErr.message, { status: 400, headers: getCorsHeaders(req) })

        const { data: suser } = await supabase
          .from('saas_users')
          .select('id, email, role, organization_id, last_login_at, created_at, updated_at')
          .eq('id', userId)
          .maybeSingle()

        const { data: auth } = await supabase.auth.admin.getUserById(userId)

        const payload = {
          user: {
            id: userId,
            email: suser?.email || auth?.user?.email || null,
            name: auth?.user?.user_metadata?.name || auth?.user?.email || null,
            created_at: auth?.user?.created_at || suser?.created_at || null,
            last_sign_in_at: auth?.user?.last_sign_in_at || suser?.last_login_at || null,
            role: suser?.role || null,
            organization_id: suser?.organization_id || null,
          },
          organizations: orgs || [],
          events: events || []
        }
        return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error loading activity', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'resync_orgs' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const ownerId = (body?.owner_id as string || '').trim()
        if (!ownerId) return new Response('Missing owner_id', { status: 400, headers: getCorsHeaders(req) })

        // Load client credentials from master saas_users
        const { data: credRow, error: credErr } = await supabase
          .from('saas_users')
          .select('id, supabase_url, supabase_key_encrypted')
          .eq('id', ownerId)
          .maybeSingle()
        if (credErr) return new Response(credErr.message, { status: 400, headers: getCorsHeaders(req) })
        const url = credRow?.supabase_url
        const enc = credRow?.supabase_key_encrypted
        if (!url || !enc) return new Response('Client credentials not found', { status: 400, headers: getCorsHeaders(req) })

        let key = ''
        try { key = atob(enc) } catch {}
        if (!key) return new Response('Invalid client key', { status: 400, headers: getCorsHeaders(req) })

        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
        const client = createClient(url, key)
        // Fetch all client orgs
        const { data: clientOrgs, error: clientErr } = await client
          .from('saas_organizations')
          .select('id, name, slug, created_at, updated_at')
        if (clientErr) return new Response(clientErr.message, { status: 400, headers: getCorsHeaders(req) })

        // Upsert into master saas_organizations with owner_id
        const rows = (clientOrgs || []).map((o: any) => ({
          name: o.name,
          slug: o.slug,
          owner_id: ownerId,
          client_org_id: o.id,
          created_at: o.created_at || new Date().toISOString(),
          updated_at: o.updated_at || new Date().toISOString()
        }))

        // Idempotent upsert by (owner_id, client_org_id)
        for (const r of rows) {
          const { error: upErr } = await supabase
            .from('saas_organizations')
            .upsert(r, { onConflict: 'owner_id,client_org_id', ignoreDuplicates: false })
          if (upErr) return new Response(upErr.message, { status: 400, headers: getCorsHeaders(req) })
        }

        return new Response(JSON.stringify({ ok: true, synced: rows.length }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error syncing orgs', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'resync_orgs_all') {
      try {
        const batchSize = Math.max(1, Math.min(50, Number(url.searchParams.get('batch_size') || '20')))
        const offset = Math.max(0, Number(url.searchParams.get('offset') || '0'))

        // Fetch owners with credentials
        const { data: owners, error: ownErr, count } = await supabase
          .from('saas_users')
          .select('id, supabase_url, supabase_key_encrypted', { count: 'exact' })
          .not('supabase_url', 'is', null)
          .not('supabase_key_encrypted', 'is', null)
          .order('id', { ascending: true })
          .range(offset, offset + batchSize - 1)
        if (ownErr) return new Response(ownErr.message, { status: 400, headers: getCorsHeaders(req) })

        const total = Number(count || 0)
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')

        const results: { owner_id: string; ok: boolean; error?: string; synced?: number }[] = []
        for (const o of owners || []) {
          const ownerId = o.id
          const urlClient = o.supabase_url
          const enc = o.supabase_key_encrypted
          if (!urlClient || !enc) {
            results.push({ owner_id: ownerId, ok: false, error: 'missing_credentials' })
            continue
          }
          let key = ''
          try { key = atob(enc) } catch { key = '' }
          if (!key) {
            results.push({ owner_id: ownerId, ok: false, error: 'invalid_key' })
            continue
          }
          try {
            const client = createClient(urlClient, key)
            const { data: clientOrgs, error: clientErr } = await client
              .from('saas_organizations')
              .select('id, name, slug, created_at, updated_at')
            if (clientErr) throw new Error(clientErr.message)
            const rows = (clientOrgs || []).map((r: any) => ({
              name: r.name,
              slug: r.slug,
              owner_id: ownerId,
              client_org_id: r.id,
              created_at: r.created_at || new Date().toISOString(),
              updated_at: r.updated_at || new Date().toISOString()
            }))
            for (const r of rows) {
              const { error: upErr } = await supabase
                .from('saas_organizations')
                .upsert(r, { onConflict: 'owner_id,client_org_id', ignoreDuplicates: false })
              if (upErr) throw new Error(upErr.message)
            }
            results.push({ owner_id: ownerId, ok: true, synced: rows.length })
          } catch (e: any) {
            results.push({ owner_id: ownerId, ok: false, error: e?.message || 'sync_failed' })
          }
        }

        const processed = (owners || []).length
        const nextOffset = (offset + processed) < total ? (offset + processed) : null
        const payload = { processed, total, next_offset: nextOffset, results }
        return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error syncing all orgs', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'save_client_credentials' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const userId = (body?.user_id as string || '').trim()
        const url = (body?.url as string || '').trim()
        const key = (body?.key as string || '').trim()
        if (!userId || !url || !key) return new Response('Missing user_id, url or key', { status: 400, headers: getCorsHeaders(req) })

        // Basic validation
        try { new URL(url) } catch { return new Response('Invalid URL', { status: 400, headers: getCorsHeaders(req) }) }
        const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/
        if (!jwtRegex.test(key)) return new Response('Invalid key format', { status: 400, headers: getCorsHeaders(req) })

        // Use pgcrypto encryption via RPC (not base64!)
        let enc: string | null
        try {
          enc = await encryptKeyWithRpc(supabase, key)
        } catch (encErr: any) {
          return new Response(`Encryption failed: ${encErr.message}`, { status: 500, headers: getCorsHeaders(req) })
        }
        
        const { error } = await supabase
          .from('saas_users')
          .update({ supabase_url: url, supabase_key_encrypted: enc, updated_at: new Date().toISOString() })
          .eq('id', userId)
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })

        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error saving credentials', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // List trail products
    if (action === 'list_trail_products') {
      try {
        const { data: products, error } = await supabase
          .from('saas_trail_products')
          .select('id, name, slug')
          .order('name', { ascending: true })
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ products: products || [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error listing trail products', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // Surveys ranking
    if (action === 'survey_rank') {
      try {
        const { data: rows, error } = await supabase
          .from('pesquisa')
          .select('id, created_at, user_id, nome, email, phone, score')
          .order('score', { ascending: false })
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        // compute priority label
        const ranked = (rows || []).map((r: any, idx: number) => ({
          pos: idx + 1,
          ...r,
          prioridade: ((): string => {
            const s = Number(r.score || 0)
            if (s >= 7) return 'Alta'
            if (s >= 4) return 'Média'
            return 'Baixa'
          })()
        }))
        return new Response(JSON.stringify({ items: ranked }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error loading survey rank', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // Trail Feedback Analytics - Jobsian: métricas que importam
    if (action === 'trail_feedback_analytics') {
      try {
        const { data: feedbacks, error } = await supabase
          .from('monetization_trail_feedbacks')
          .select('id, completed_first_agent, guided_impl_rating, main_difficulties, liked_most, suggestions, bonus_granted, created_at')
          .order('created_at', { ascending: false })
        
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        
        const list = feedbacks || []
        const total = list.length
        
        // Taxa de conclusão
        const completed = list.filter(f => f.completed_first_agent).length
        const completionRate = total > 0 ? Math.round((completed / total) * 10000) / 100 : 0
        
        // Distribuição de ratings (1-5)
        const ratingDistribution = [1, 2, 3, 4, 5].map(r => ({
          rating: r,
          label: r === 1 ? 'Péssimo' : r === 2 ? 'Ruim' : r === 3 ? 'Ok' : r === 4 ? 'Bom' : 'Excelente',
          count: list.filter(f => f.guided_impl_rating === r).length,
          percentage: total > 0 ? Math.round((list.filter(f => f.guided_impl_rating === r).length / total) * 10000) / 100 : 0
        }))
        
        // Rating médio
        const ratings = list.map(f => f.guided_impl_rating).filter(r => r !== null && r >= 1 && r <= 5) as number[]
        const avgRating = ratings.length > 0 
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 
          : null
        
        // Taxa de bônus concedido
        const bonusGranted = list.filter(f => f.bonus_granted).length
        const bonusRate = total > 0 ? Math.round((bonusGranted / total) * 10000) / 100 : 0
        
        // Feedbacks com texto (análise qualitativa)
        const withTextFeedback = list.filter(f => 
          (f.suggestions && f.suggestions.trim()) || 
          (f.main_difficulties && f.main_difficulties.trim()) || 
          (f.liked_most && f.liked_most.trim())
        ).length
        const textFeedbackRate = total > 0 ? Math.round((withTextFeedback / total) * 10000) / 100 : 0
        
        // Série temporal (feedbacks por dia)
        const dailySeries: Record<string, { date: string; total: number; completed: number; ratings: number[] }> = {}
        list.forEach(f => {
          const date = new Date(f.created_at).toISOString().split('T')[0]
          if (!dailySeries[date]) {
            dailySeries[date] = { date, total: 0, completed: 0, ratings: [] }
          }
          dailySeries[date].total++
          if (f.completed_first_agent) dailySeries[date].completed++
          if (f.guided_impl_rating && f.guided_impl_rating >= 1 && f.guided_impl_rating <= 5) {
            dailySeries[date].ratings.push(f.guided_impl_rating)
          }
        })
        const dailyData = Object.values(dailySeries).map(d => ({
          date: d.date,
          total: d.total,
          completed: d.completed,
          completionRate: d.total > 0 ? Math.round((d.completed / d.total) * 10000) / 100 : 0,
          avgRating: d.ratings.length > 0 
            ? Math.round((d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length) * 100) / 100 
            : null
        })).sort((a, b) => a.date.localeCompare(b.date))
        
        // Últimos feedbacks (para análise qualitativa)
        const recentFeedbacks = list.slice(0, 20).map(f => ({
          id: f.id || null,
          completed: f.completed_first_agent,
          rating: f.guided_impl_rating,
          feedback: f.suggestions || f.main_difficulties || f.liked_most || null,
          bonusGranted: f.bonus_granted,
          createdAt: f.created_at
        }))
        
        const payload = {
          summary: {
            total,
            completed,
            completionRate,
            avgRating,
            bonusGranted,
            bonusRate,
            withTextFeedback,
            textFeedbackRate
          },
          ratingDistribution,
          dailySeries: dailyData,
          recentFeedbacks
        }
        
        return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error loading trail feedback analytics', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // Audience aggregates for discovery dashboard
    if (action === 'survey_audience') {
      try {
        const { data: rows, error } = await supabase
          .from('pesquisa')
          .select('answers')
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        const list = (rows || []).map(r => (r?.answers || {}))
        const countBy = (key: string) => {
          const map: Record<string, number> = {}
          for (const a of list) {
            const v = (a?.[key] ?? '').toString() || 'Não informado'
            map[v] = (map[v] || 0) + 1
          }
          return Object.entries(map).map(([name, value]) => ({ name, value }))
        }
        const countMulti = (key: string) => {
          const map: Record<string, number> = {}
          for (const a of list) {
            const arr = Array.isArray(a?.[key]) ? a[key] as string[] : []
            for (const v of arr) { map[v] = (map[v] || 0) + 1 }
          }
          return Object.entries(map).map(([name, value]) => ({ name, value }))
        }
        const payload = {
          papel: countBy('papel'),
          segmento: countBy('segmento'),
          volume_leads: countBy('volume_leads'),
          gargalo: countBy('gargalo'),
          ferramentas: countMulti('tools')
        }
        return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error loading audience', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== List inactive unconnected emails (admin)
    if (action === 'list_inactive_unconnected_emails') {
      try {
        const thirty = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
        // 30+ days since created and missing connection credentials (null or empty)
        const { data, error } = await supabase
          .from('saas_users')
          .select('email, created_at')
          .lte('created_at', thirty)
          .or('supabase_url.is.null,supabase_url.eq.,supabase_key_encrypted.is.null,supabase_key_encrypted.eq.')
          .order('created_at', { ascending: true })
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        const list = (data || []).filter((r: any) => (r?.email || '').trim())
        return new Response(JSON.stringify({ items: list }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error listing inactive emails', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== Enqueue reactivation emails (admin)
    if (action === 'enqueue_reactivation_emails' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const limit = Math.max(1, Math.min(1000, Number(body?.limit || 500)))
        const cooldownDays = Math.max(1, Math.min(90, Number(body?.cooldown_days || 14)))
        const dryRun = Boolean(body?.dry_run || false)
        const now = Date.now()
        const thirtyIso = new Date(now - 30 * 24 * 3600 * 1000).toISOString()
        const cooldownIso = new Date(now - cooldownDays * 24 * 3600 * 1000).toISOString()

        // Candidates: 30+ days and without connection
        const { data: candidates, error: candErr } = await supabase
          .from('saas_users')
          .select('email, created_at')
          .lte('created_at', thirtyIso)
          .or('supabase_url.is.null,supabase_url.eq.,supabase_key_encrypted.is.null,supabase_key_encrypted.eq.')
          .limit(limit * 3) // fetch more then filter by cooldown below

        if (candErr) return new Response(candErr.message, { status: 400, headers: getCorsHeaders(req) })
        const emails = (candidates || []).map((r: any) => (r?.email || '').trim()).filter((e: string) => e)
        if (!emails.length) return new Response(JSON.stringify({ candidates: 0, enqueued: 0, skipped_recently: 0 }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })

        // Skip recipients with recent pending/sent within cooldown window
        const { data: recentRows } = await supabase
          .from('email_queue')
          .select('recipient_email, status, sent_at, created_at, updated_at')
          .gte('created_at', cooldownIso)
          .in('recipient_email', emails)
        const recentMap = new Set((recentRows || []).map((r: any) => (r?.recipient_email || '').toLowerCase()))

        const toInsert: any[] = []
        let skipped = 0
        for (const e of emails) {
          if (recentMap.has(e.toLowerCase())) { skipped++; continue }
          toInsert.push({ recipient_email: e, template: 'reactivation_v1', variables_json: { email: e } })
          if (toInsert.length >= limit) break
        }

        if (dryRun) {
          return new Response(JSON.stringify({ candidates: emails.length, enqueued: toInsert.length, skipped_recently: skipped, dry_run: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }

        let enqueued = 0
        if (toInsert.length) {
          const { error: insErr } = await supabase.from('email_queue').insert(toInsert)
          if (insErr) return new Response(insErr.message, { status: 400, headers: getCorsHeaders(req) })
          enqueued = toInsert.length
        }

        return new Response(JSON.stringify({ candidates: emails.length, enqueued, skipped_recently: skipped }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error enqueueing reactivation emails', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== Supabase Connections overview (admin)
    if (action === 'supabase_connections') {
      try {
        // Total de usuários no Master (saas_users)
        const { count: totalCount, error: totalErr } = await supabase
          .from('saas_users')
          .select('id', { count: 'exact', head: true })
        if (totalErr) return new Response(totalErr.message, { status: 400, headers: getCorsHeaders(req) })

        // Conectados: possuem url e key preenchidos (não nulos e não vazios)
        const { count: connectedCount, error: connErr } = await supabase
          .from('saas_users')
          .select('id', { count: 'exact', head: true })
          .not('supabase_url', 'is', null)
          .not('supabase_key_encrypted', 'is', null)
          .neq('supabase_url', '')
          .neq('supabase_key_encrypted', '')
        if (connErr) return new Response(connErr.message, { status: 400, headers: getCorsHeaders(req) })

        // Inativos: criados há > 30 dias e sem conexão
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
        const { count: olderCount, error: oldErr } = await supabase
          .from('saas_users')
          .select('id', { count: 'exact', head: true })
          .lte('created_at', thirtyDaysAgo)
        if (oldErr) return new Response(oldErr.message, { status: 400, headers: getCorsHeaders(req) })
        const { count: olderConnected, error: oldConnErr } = await supabase
          .from('saas_users')
          .select('id', { count: 'exact', head: true })
          .lte('created_at', thirtyDaysAgo)
          .not('supabase_url', 'is', null)
          .not('supabase_key_encrypted', 'is', null)
          .neq('supabase_url', '')
          .neq('supabase_key_encrypted', '')
        if (oldConnErr) return new Response(oldConnErr.message, { status: 400, headers: getCorsHeaders(req) })
        const inactiveUnconnected = Math.max(0, Number(olderCount || 0) - Number(olderConnected || 0))

        const total = Number(totalCount || 0)
        const connected = Number(connectedCount || 0)
        const pct = total > 0 ? Math.round((connected / total) * 10000) / 100 : 0

        // Concluíram a Trilha de Monetização (flag no Master)
        let trailCompleted = 0
        try {
          const { count: trailCount } = await supabase
            .from('saas_users')
            .select('id', { count: 'exact', head: true })
            .eq('monetization_trail_completed', true)
          trailCompleted = Number(trailCount || 0)
        } catch {}

        const payload = {
          total_users: total,
          connected_users: connected,
          connection_pct: pct,
          inactive_unconnected_users: inactiveUnconnected,
          monetization_trail_completed_users: trailCompleted,
          updated_at: new Date().toISOString()
        }
        return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error computing connections', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== Metrics/Overview endpoint =====
    if (action === 'metrics' || action === 'overview' || action === '') {
      try {
        // Pre-calculate date ranges needed for parallel queries
        const today = new Date().toISOString().slice(0,10)
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
        const threeMinAgo = new Date(now.getTime() - 3 * 60 * 1000).toISOString()

        // Parallelize all independent queries to reduce cold start latency and avoid timeouts
        // Execute all data fetching operations concurrently instead of sequentially
        const [
          dauResult,
          wauResult,
          mauResult,
          sessionsResult,
          featureUsageResult,
          featureRankResult
        ] = await Promise.all([
          // DAU series via optimized RPC function (filters BEFORE grouping to avoid timeout)
          // Fallback to view if RPC doesn't exist yet
          (async () => {
            try {
              const rpcResult = await supabase
                .rpc('daily_active_users_features', {
                  p_from: from,
                  p_to: toInclusive
                })
              // If RPC exists but returns error about function not found, fallback to view
              if (rpcResult.error && (
                rpcResult.error.message?.includes('Could not find the function') ||
                rpcResult.error.message?.includes('function') && rpcResult.error.message?.includes('does not exist')
              )) {
                console.warn('[admin-analytics] RPC daily_active_users_features not found, falling back to view')
                return await supabase
                  .from('v_daily_active_users_features')
                  .select('*')
                  .gte('day', from)
                  .lte('day', to)
                  .order('day', { ascending: true })
              }
              return rpcResult
            } catch (err: any) {
              // If RPC call fails completely, fallback to view
              console.warn('[admin-analytics] RPC daily_active_users_features failed, falling back to view:', err?.message)
              return await supabase
                .from('v_daily_active_users_features')
                .select('*')
                .gte('day', from)
                .lte('day', to)
                .order('day', { ascending: true })
            }
          })(),
          
          // WAU (distinct users last 7 days with at least one feature_used)
          // Use RPC function to count distinct users efficiently without loading all data
          supabase
            .rpc('count_distinct_users', {
              p_event_name: 'feature_used',
              p_from: sevenDaysAgo.toISOString(),
              p_to: now.toISOString()
            })
            .single(),
          
          // MAU (distinct users last 30 days with at least one feature_used)
          supabase
            .rpc('count_distinct_users', {
              p_event_name: 'feature_used',
              p_from: thirtyDaysAgo.toISOString(),
              p_to: now.toISOString()
            })
            .single(),
          
          // Active sessions (combined: count + distinct users in one parallel batch)
          Promise.all([
            supabase
              .from('saas_sessions')
              .select('id', { count: 'exact', head: true })
              .eq('active', true)
              .gt('expires_at', new Date().toISOString())
              .gte('last_seen_at', threeMinAgo),
            supabase
              .from('saas_sessions')
              .select('user_id')
              .eq('active', true)
              .gt('expires_at', new Date().toISOString())
              .gte('last_seen_at', threeMinAgo)
          ]),
          
          // Feature usage series (optimized RPC - filters BEFORE grouping to avoid timeout)
          // Fallback to view if RPC doesn't exist yet
          (async () => {
            try {
              const rpcResult = await supabase
                .rpc('feature_usage_daily', {
                  p_from: from,
                  p_to: toInclusive,
                  p_event_name: feature || null
                })
              // If RPC exists but returns error about function not found, fallback to view
              if (rpcResult.error && (
                rpcResult.error.message?.includes('Could not find the function') ||
                rpcResult.error.message?.includes('function') && rpcResult.error.message?.includes('does not exist')
              )) {
                console.warn('[admin-analytics] RPC feature_usage_daily not found, falling back to view')
                let featureQ = supabase
                  .from('v_feature_usage_daily')
                  .select('*')
                  .gte('day', from)
                  .lte('day', to)
                  .order('day', { ascending: true })
                if (feature) featureQ = featureQ.eq('event_name', feature)
                return await featureQ
              }
              return rpcResult
            } catch (err: any) {
              // If RPC call fails completely, fallback to view
              console.warn('[admin-analytics] RPC feature_usage_daily failed, falling back to view:', err?.message)
              let featureQ = supabase
                .from('v_feature_usage_daily')
                .select('*')
                .gte('day', from)
                .lte('day', to)
                .order('day', { ascending: true })
              if (feature) featureQ = featureQ.eq('event_name', feature)
              return await featureQ
            }
          })(),
          
          // Feature ranking (top N) - optimized function with timeout handling
          (async () => {
            try {
              // Add timeout wrapper for feature_rank query
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Feature rank query timeout after 25 seconds')), 25000)
              })
              const queryPromise = supabase.rpc('feature_rank', { p_from: from, p_to: toInclusive })
              return await Promise.race([queryPromise, timeoutPromise]) as any
            } catch (err: any) {
              // If timeout or other error, return empty result instead of crashing
              console.error('[admin-analytics] Feature rank query failed or timed out:', err?.message)
              return { data: [], error: { message: err?.message || 'Feature rank query failed' } }
            }
          })()
        ])

        // Unpack results and handle errors
        const { data: dauSeries, error: dauErr } = dauResult
        if (dauErr) return new Response(`DAU query error: ${dauErr.message}`, { status: 400, headers: getCorsHeaders(req) })

        // Active users based on feature usage only (event_name = 'feature_used')
        const dauToday = (dauSeries || []).find((r: any) => (r.day || '').slice(0,10) === today)?.dau || 0

        // Process WAU with fallback
        const { data: wauData, error: wauErr } = wauResult
        let wauEst = 0
        if (wauErr || !wauData) {
          // Fallback: Calculate from DAU series if RPC doesn't exist or fails
          const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10)
          const dauInWindow = (dauSeries || []).filter((r: any) => {
            const dayStr = (r.day || '').slice(0, 10)
            return dayStr >= sevenDaysAgoStr && dayStr <= today
          })
          // For accurate WAU, we need distinct users across all days, not sum of daily counts
          // But as fallback, we use sum (will be >= actual MAU)
          wauEst = dauInWindow.reduce((sum: number, r: any) => sum + (Number(r.dau) || 0), 0)
        } else {
          wauEst = Number(wauData?.count || 0)
        }

        // Process MAU with fallback
        const { data: mauData, error: mauErr } = mauResult
        let mauEst = 0
        if (mauErr || !mauData) {
          // Fallback: Calculate from DAU series if RPC doesn't exist or fails
          const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10)
          const dauInWindow = (dauSeries || []).filter((r: any) => {
            const dayStr = (r.day || '').slice(0, 10)
            return dayStr >= thirtyDaysAgoStr && dayStr <= today
          })
          // For accurate MAU, we need distinct users across all days, not sum of daily counts
          // But as fallback, we use sum (will be >= actual MAU)
          mauEst = dauInWindow.reduce((sum: number, r: any) => sum + (Number(r.dau) || 0), 0)
        } else {
          mauEst = Number(mauData?.count || 0)
        }
        
        // Ensure WAU >= DAU and MAU >= WAU (sanity check)
        if (wauEst < dauToday) wauEst = dauToday
        if (mauEst < wauEst) mauEst = wauEst

        // Process sessions results
        const [sessionsCountResult, sessionsUsersResult] = sessionsResult
        const { count: activeSessionsCount, error: sessErr } = sessionsCountResult
        if (sessErr) return new Response(`Sessions count error: ${sessErr.message}`, { status: 400, headers: getCorsHeaders(req) })
        
        const { data: activeUserRows, error: sessUsersErr } = sessionsUsersResult
        if (sessUsersErr) return new Response(`Sessions users error: ${sessUsersErr.message}`, { status: 400, headers: getCorsHeaders(req) })
        const activeUsersOnline = new Set((activeUserRows || []).map((r: any) => r.user_id)).size

        // Process feature usage series
        const { data: featureSeries, error: featErr } = featureUsageResult
        if (featErr) return new Response(`Feature usage error: ${featErr.message}`, { status: 400, headers: getCorsHeaders(req) })
        // Filter out deprecated/experimental metrics
        const filteredFeatureSeries = (featureSeries || []).filter((r: any) => (r.event_name || '') !== 'heartbeat')

        // Process feature rank (with graceful error handling)
        const { data: featureRank, error: rankErr } = featureRankResult
        // Don't fail entire request if feature_rank times out - just return empty array
        if (rankErr) {
          console.error('[admin-analytics] Feature rank error (non-fatal):', rankErr.message)
          // Check if it's a timeout error
          if (rankErr.message?.includes('timeout') || rankErr.message?.includes('canceling statement')) {
            console.warn('[admin-analytics] Feature rank timed out, returning empty result')
          }
        }
        const rankFiltered = (featureRank || []).filter((r: any) => (r.feature_key || '') !== 'heartbeat')
        const topRank = rankFiltered.slice(0, 20)

        const res = {
          filters: { from, to, feature: feature || null },
          kpis: {
            dau: dauToday,
            wau: wauEst,
            mau: mauEst,
            active_users_online: Number(activeUsersOnline || 0),
            active_sessions: Number(activeSessionsCount || 0)
          },
          dau_series: dauSeries || [],
          feature_usage: filteredFeatureSeries,
          feature_rank: topRank
        }

        return new Response(JSON.stringify(res), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        console.error('[admin-analytics] Metrics/Overview error:', err)
        return new Response(JSON.stringify({ error: `Metrics error: ${err?.message || 'Unknown'}` }), { 
          status: 500, 
          headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
        })
      }
    }

    // ===== Trail Comments Moderation (admin) =====
    if (action === 'trail_comments_list_pending') {
      try {
        const { data, error } = await supabase
          .from('trail_comments')
          .select(`
            id,
            user_id,
            trail_type,
            lesson_key,
            content,
            attachments,
            parent_id,
            created_at,
            moderator_id,
            moderator_note
          `)
          .eq('approved', false)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(100)
        
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        
        // Enriquecer com dados do usuário (via auth.users via service role)
        const userIds = [...new Set((data || []).map((c: any) => c.user_id).filter(Boolean))]
        const usersMap: Record<string, any> = {}
        if (userIds.length > 0) {
          // Query direto via service role
          const usersQuery = await supabase.auth.admin.listUsers()
          if (usersQuery.data?.users) {
            for (const u of usersQuery.data.users) {
              if (userIds.includes(u.id)) {
                usersMap[u.id] = {
                  email: u.email || '',
                  name: (u.user_metadata?.name || u.user_metadata?.full_name || (u.email || '').split('@')[0]) as string
                }
              }
            }
          }
        }
        
        const enriched = (data || []).map((c: any) => ({
          ...c,
          user_email: usersMap[c.user_id]?.email || '',
          user_name: usersMap[c.user_id]?.name || 'Usuário desconhecido'
        }))
        
        return new Response(JSON.stringify({ items: enriched }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error loading pending comments', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'trail_comments_moderate' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const commentId = body?.comment_id
        const actionType = body?.action // 'approve', 'reject', 'delete'
        const moderatorNote = body?.moderator_note || null

        if (!commentId || !actionType) {
          return new Response('Missing comment_id or action', { status: 400, headers: getCorsHeaders(req) })
        }

        if (!['approve', 'reject', 'delete'].includes(actionType)) {
          return new Response('Invalid action. Must be: approve, reject, or delete', { status: 400, headers: getCorsHeaders(req) })
        }

        // Use moderator ID only if it's a valid UUID (not 'service')
        const rawId = userData?.user?.id || null
        const moderatorId = (rawId && rawId !== 'service') ? rawId : null

        if (actionType === 'approve') {
          const { error } = await supabase
            .from('trail_comments')
            .update({
              approved: true,
              moderator_id: moderatorId,
              moderator_note: moderatorNote,
              updated_at: new Date().toISOString()
            })
            .eq('id', commentId)
          
          if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        } else if (actionType === 'reject') {
          const { error } = await supabase
            .from('trail_comments')
            .update({
              approved: false,
              moderator_id: moderatorId,
              moderator_note: moderatorNote,
              updated_at: new Date().toISOString()
            })
            .eq('id', commentId)
          
          if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        } else if (actionType === 'delete') {
          const { error } = await supabase
            .from('trail_comments')
            .update({
              deleted_at: new Date().toISOString(),
              moderator_id: moderatorId,
              moderator_note: moderatorNote,
              updated_at: new Date().toISOString()
            })
            .eq('id', commentId)
          
          if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
        }

        const headers = { 'content-type': 'application/json', ...getCorsHeaders(req) }
        return new Response(JSON.stringify({ success: true, action: actionType }), { status: 200, headers })
      } catch (err: any) {
        return new Response(err?.message || 'Error moderating comment', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== List plan tokens (admin-only)
    if (action === 'list_tokens' && req.method === 'GET') {
      try {
        const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('page_size') || '20')))
        const search = (url.searchParams.get('search') || '').trim()
        const statusFilter = (url.searchParams.get('status') || '').trim()
        const orderBy = (url.searchParams.get('order_by') || 'created_at').toLowerCase()
        const orderDir = ((url.searchParams.get('order_dir') || 'desc').toLowerCase() === 'desc') ? 'desc' : 'asc'

        // Build query
        let query = supabase
          .from('saas_plan_tokens')
          .select(`
            id,
            owner_user_id,
            plan_id,
            status,
            purchased_at,
            valid_until,
            is_frozen,
            license_duration_days,
            applied_organization_id,
            applied_at,
            created_at,
            updated_at,
            saas_users!saas_plan_tokens_owner_user_id_fkey(id, email, name),
            saas_plans!saas_plan_tokens_plan_id_fkey(id, name, slug),
            saas_organizations!saas_plan_tokens_applied_organization_id_fkey(id, name, slug)
          `, { count: 'exact' })

        // Apply filters
        if (statusFilter) {
          query = query.eq('status', statusFilter)
        }

        // Apply search (by user email)
        if (search) {
          // Need to join with saas_users for email search
          const { data: users } = await supabase
            .from('saas_users')
            .select('id')
            .ilike('email', `%${search}%`)
          const userIds = (users || []).map(u => u.id)
          if (userIds.length > 0) {
            query = query.in('owner_user_id', userIds)
          } else {
            // No users found, return empty result
            return new Response(JSON.stringify({ page, page_size: pageSize, total: 0, tokens: [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
          }
        }

        // Apply ordering
        const allowedSort = new Set(['created_at', 'purchased_at', 'valid_until', 'status'])
        const sortKey = allowedSort.has(orderBy) ? orderBy : 'created_at'
        query = query.order(sortKey, { ascending: orderDir === 'asc' })

        // Apply pagination
        const start = (page - 1) * pageSize
        query = query.range(start, start + pageSize - 1)

        const { data, error, count } = await query
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })

        // Transform data for frontend
        const tokens = (data || []).map((t: any) => ({
          id: t.id,
          owner_user_id: t.owner_user_id,
          owner_email: t.saas_users?.email || '',
          owner_name: t.saas_users?.name || null,
          plan_id: t.plan_id,
          plan_name: t.saas_plans?.name || '',
          plan_slug: t.saas_plans?.slug || '',
          status: t.status,
          purchased_at: t.purchased_at,
          valid_until: t.valid_until,
          is_frozen: t.is_frozen || false,
          license_duration_days: t.license_duration_days,
          applied_organization_id: t.applied_organization_id,
          applied_organization_name: t.saas_organizations?.name || null,
          applied_organization_slug: t.saas_organizations?.slug || null,
          applied_at: t.applied_at,
          created_at: t.created_at,
          updated_at: t.updated_at
        }))

        return new Response(JSON.stringify({ page, page_size: pageSize, total: count || 0, tokens }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error listing tokens', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== Unassign token from organization (admin-only)
    if (action === 'unassign_token' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const tokenId = (body?.token_id as string || '').trim()

        if (!tokenId) return new Response('Missing token_id', { status: 400, headers: getCorsHeaders(req) })

        // Get token to check if it's applied
        const { data: token, error: tokenErr } = await supabase
          .from('saas_plan_tokens')
          .select('id, applied_organization_id, status')
          .eq('id', tokenId)
          .maybeSingle()

        if (tokenErr) return new Response(tokenErr.message, { status: 400, headers: getCorsHeaders(req) })
        if (!token) return new Response('Token not found', { status: 404, headers: getCorsHeaders(req) })

        const orgId = token.applied_organization_id

        // Update token: remove organization assignment
        const { error: updateErr } = await supabase
          .from('saas_plan_tokens')
          .update({
            applied_organization_id: null,
            applied_at: null,
            status: 'available',
            updated_at: new Date().toISOString()
          })
          .eq('id', tokenId)

        if (updateErr) return new Response(updateErr.message, { status: 400, headers: getCorsHeaders(req) })

        // If organization had this token as attributed_token_id, clear it and set plan to trial
        if (orgId) {
          // Get trial plan ID
          const { data: trialPlan } = await supabase
            .from('saas_plans')
            .select('id')
            .eq('slug', 'trial')
            .maybeSingle()

          if (!trialPlan) {
            console.error('Trial plan not found')
          }

          const updateData: any = {
            attributed_token_id: null,
            updated_at: new Date().toISOString()
          }

          // Set plan_id to trial if trial plan exists
          if (trialPlan?.id) {
            updateData.plan_id = trialPlan.id
          }

          const { error: orgErr } = await supabase
            .from('saas_organizations')
            .update(updateData)
            .eq('id', orgId)
            .eq('attributed_token_id', tokenId)

          if (orgErr) {
            console.error('Error clearing attributed_token_id and updating plan:', orgErr)
            // Don't fail the request, just log
          }
        }

        return new Response(JSON.stringify({ success: true, token_id: tokenId }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error unassigning token', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== Delete token (admin-only)
    if (action === 'delete_token' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const tokenId = (body?.token_id as string || '').trim()

        if (!tokenId) return new Response('Missing token_id', { status: 400, headers: getCorsHeaders(req) })

        // Get token to check if it's applied
        const { data: token } = await supabase
          .from('saas_plan_tokens')
          .select('id, applied_organization_id')
          .eq('id', tokenId)
          .maybeSingle()

        const orgId = token?.applied_organization_id

        // Delete token (cascade will handle foreign keys)
        const { error: deleteErr } = await supabase
          .from('saas_plan_tokens')
          .delete()
          .eq('id', tokenId)

        if (deleteErr) return new Response(deleteErr.message, { status: 400, headers: getCorsHeaders(req) })

        // If organization had this token as attributed_token_id, clear it and set plan to trial
        if (orgId) {
          // Get trial plan ID
          const { data: trialPlan } = await supabase
            .from('saas_plans')
            .select('id')
            .eq('slug', 'trial')
            .maybeSingle()

          if (!trialPlan) {
            console.error('Trial plan not found')
          }

          const updateData: any = {
            attributed_token_id: null,
            updated_at: new Date().toISOString()
          }

          // Set plan_id to trial if trial plan exists
          if (trialPlan?.id) {
            updateData.plan_id = trialPlan.id
          }

          const { error: orgErr } = await supabase
            .from('saas_organizations')
            .update(updateData)
            .eq('id', orgId)
            .eq('attributed_token_id', tokenId)

          if (orgErr) {
            console.error('Error clearing attributed_token_id and updating plan:', orgErr)
            // Don't fail the request, just log
          }
        }

        return new Response(JSON.stringify({ success: true, token_id: tokenId }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error deleting token', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== Update token validity (admin-only)
    if (action === 'update_token_validity' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const tokenId = (body?.token_id as string || '').trim()
        const validUntil = body?.valid_until as string || null

        if (!tokenId) return new Response('Missing token_id', { status: 400, headers: getCorsHeaders(req) })

        // Validate valid_until if provided
        let validUntilDate: string | null = null
        if (validUntil) {
          const parsed = new Date(validUntil)
          if (isNaN(parsed.getTime())) {
            return new Response('Invalid valid_until date format', { status: 400, headers: getCorsHeaders(req) })
          }
          validUntilDate = parsed.toISOString()
        }

        // Update token
        const updateData: any = {
          updated_at: new Date().toISOString()
        }
        if (validUntilDate !== null) {
          updateData.valid_until = validUntilDate
        } else {
          updateData.valid_until = null
        }

        const { error: updateErr } = await supabase
          .from('saas_plan_tokens')
          .update(updateData)
          .eq('id', tokenId)

        if (updateErr) return new Response(updateErr.message, { status: 400, headers: getCorsHeaders(req) })

        return new Response(JSON.stringify({ success: true, token_id: tokenId, valid_until: validUntilDate }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error updating token validity', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== Get user tokens (admin-only)
    if (action === 'user_tokens' && req.method === 'GET') {
      try {
        const userId = (url.searchParams.get('user_id') || '').trim()
        if (!userId) return new Response('Missing user_id', { status: 400, headers: getCorsHeaders(req) })
        const purchasedFromRaw = (url.searchParams.get('purchased_at_from') || '').trim()
        const purchasedToRaw = (url.searchParams.get('purchased_at_to') || '').trim()
        const purchasedOnRaw = (url.searchParams.get('purchased_on') || '').trim()
        const statusFilter = (url.searchParams.get('status') || '').trim()
        const gatewayFilter = (url.searchParams.get('gateway') || '').trim()

        let query = supabase
          .from('saas_plan_tokens')
          .select(`
            id,
            plan_id,
            status,
            purchased_at,
            valid_until,
            is_frozen,
            license_duration_days,
            applied_organization_id,
            applied_at,
            created_at,
            saas_plans!saas_plan_tokens_plan_id_fkey(id, name, slug),
            saas_organizations!saas_plan_tokens_applied_organization_id_fkey(id, name, slug)
          `)
          .eq('owner_user_id', userId)

        if (statusFilter) {
          query = query.eq('status', statusFilter)
        }

        if (gatewayFilter) {
          query = query.eq('gateway', gatewayFilter)
        }

        if (purchasedOnRaw) {
          const onDate = new Date(purchasedOnRaw)
          if (Number.isNaN(onDate.getTime())) {
            return new Response('Invalid purchased_on', { status: 400, headers: getCorsHeaders(req) })
          }
          const start = new Date(Date.UTC(onDate.getUTCFullYear(), onDate.getUTCMonth(), onDate.getUTCDate(), 0, 0, 0))
          const end = new Date(start.getTime() + 24 * 3600 * 1000 - 1)
          query = query
            .gte('purchased_at', start.toISOString())
            .lte('purchased_at', end.toISOString())
        } else {
          if (purchasedFromRaw) {
            const fromDate = new Date(purchasedFromRaw)
            if (Number.isNaN(fromDate.getTime())) {
              return new Response('Invalid purchased_at_from', { status: 400, headers: getCorsHeaders(req) })
            }
            query = query.gte('purchased_at', fromDate.toISOString())
          }
          if (purchasedToRaw) {
            const toDate = new Date(purchasedToRaw)
            if (Number.isNaN(toDate.getTime())) {
              return new Response('Invalid purchased_at_to', { status: 400, headers: getCorsHeaders(req) })
            }
            query = query.lte('purchased_at', toDate.toISOString())
          }
        }

        const { data, error } = await query.order('created_at', { ascending: false })
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })

        const tokens = (data || []).map((t: any) => ({
          id: t.id,
          plan_id: t.plan_id,
          plan_name: t.saas_plans?.name || '',
          plan_slug: t.saas_plans?.slug || '',
          status: t.status,
          purchased_at: t.purchased_at,
          valid_until: t.valid_until,
          is_frozen: t.is_frozen || false,
          license_duration_days: t.license_duration_days,
          applied_organization_id: t.applied_organization_id,
          applied_organization_name: t.saas_organizations?.name || null,
          applied_at: t.applied_at,
          created_at: t.created_at
        }))

        return new Response(JSON.stringify({ tokens }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error loading user tokens', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== Bulk issue tokens from CSV (admin-only)
    if (action === 'bulk_issue_tokens' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const rows = body?.rows || []

        if (!Array.isArray(rows) || rows.length === 0) {
          return new Response('Missing or empty rows array', { status: 400, headers: getCorsHeaders(req) })
        }

        const adminUserId = userData?.user?.id || null
        if (!adminUserId) {
          return new Response('Admin authentication required', { status: 401, headers: getCorsHeaders(req) })
        }

        const results: any[] = []
        const nowIso = new Date().toISOString()

        for (const row of rows) {
          try {
            const email = (row.email || '').trim().toLowerCase()
            const planId = (row.plan_id || '').trim()
            const validDays = Math.max(1, Math.min(3650, Number(row.valid_days || 30)))
            const quantity = Math.max(1, Math.min(100, Number(row.quantity || 1)))

            if (!email || !planId) {
              results.push({ ok: false, email, error: 'Missing email or plan_id' })
              continue
            }

            // Resolve user by email
            const { data: u } = await supabase.from('saas_users').select('id').eq('email', email).maybeSingle()
            if (!u?.id) {
              results.push({ ok: false, email, error: 'User not found' })
              continue
            }

            // Verify plan exists
            const { data: plan } = await supabase.from('saas_plans').select('id, slug, name').eq('id', planId).maybeSingle()
            if (!plan) {
              results.push({ ok: false, email, error: 'Plan not found' })
              continue
            }

            const allowedSlugs = new Set(['basic', 'starter', 'professional', 'pro'])
            if (!allowedSlugs.has(String(plan.slug || '').toLowerCase())) {
              results.push({ ok: false, email, error: 'Plan not allowed for token issuance' })
              continue
            }

            const validUntil = new Date(Date.now() + validDays * 24 * 3600 * 1000).toISOString()

            // Create tokens
            const tokenRows = Array.from({ length: quantity }).map(() => ({
              owner_user_id: u.id,
              plan_id: planId,
              status: 'available',
              purchased_at: nowIso,
              valid_until: validUntil,
              is_frozen: false,
              license_duration_days: null,
              issued_by: 'admin',
              issued_by_user_id: adminUserId,
              gateway: 'admin'
            }))

            const { error: insertErr } = await supabase.from('saas_plan_tokens').insert(tokenRows)
            if (insertErr) {
              results.push({ ok: false, email, error: insertErr.message })
              continue
            }

            results.push({ ok: true, email, quantity, plan_id: planId })
          } catch (rowErr: any) {
            results.push({ ok: false, email: row.email || 'unknown', error: rowErr?.message || 'Unknown error' })
          }
        }

        const successCount = results.filter(r => r.ok).length
        const errorCount = results.length - successCount

        return new Response(JSON.stringify({
          success: true,
          processed: results.length,
          success_count: successCount,
          error_count: errorCount,
          results
        }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error processing bulk tokens', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== List organizations (admin-only)
    if (action === 'list_organizations' && req.method === 'GET') {
      try {
        const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('page_size') || '20')))
        const search = (url.searchParams.get('search') || '').trim()
        const orderBy = (url.searchParams.get('order_by') || 'created_at').toLowerCase()
        const orderDir = ((url.searchParams.get('order_dir') || 'desc').toLowerCase() === 'desc') ? 'desc' : 'asc'

        // Handle search: need to search by owner email OR org name
        let allOrgIds: string[] = []
        let totalCount = 0

        if (search) {
          // Search by owner email
          const { data: users } = await supabase
            .from('saas_users')
            .select('id')
            .ilike('email', `%${search}%`)
          const userIds = (users || []).map(u => u.id)

          // Search by org name
          const { data: orgsByName } = await supabase
            .from('saas_organizations')
            .select('id')
            .ilike('name', `%${search}%`)

          // Merge IDs (remove duplicates)
          const nameOrgIds = (orgsByName || []).map(o => o.id)
          const ownerOrgIds: string[] = []
          if (userIds.length > 0) {
            const { data: orgsByOwner } = await supabase
              .from('saas_organizations')
              .select('id')
              .in('owner_id', userIds)
            ownerOrgIds.push(...((orgsByOwner || []).map(o => o.id)))
          }
          allOrgIds = [...new Set([...ownerOrgIds, ...nameOrgIds])]
        }

        // Build query
        let query = supabase
          .from('saas_organizations')
          .select(`
            id,
            owner_id,
            name,
            slug,
            plan_id,
            trial_ends_at,
            attributed_token_id,
            client_org_id,
            client_supabase_url,
            client_service_key_encrypted,
            client_anon_key_encrypted,
            created_at,
            updated_at,
            saas_users!saas_organizations_owner_id_fkey(id, email, name),
            saas_plans!saas_organizations_plan_id_fkey(id, name, slug)
          `, { count: search ? false : 'exact' })

        // Apply search filter if we have IDs
        if (search && allOrgIds.length > 0) {
          query = query.in('id', allOrgIds)
        } else if (search && allOrgIds.length === 0) {
          // No matches, return empty
          return new Response(JSON.stringify({ page, page_size: pageSize, total: 0, organizations: [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }

        // Get total count if not searching
        if (!search) {
          const countQuery = supabase
            .from('saas_organizations')
            .select('id', { count: 'exact', head: true })
          const { count } = await countQuery
          totalCount = count || 0
        } else {
          // If searching, count the filtered results
          const countQuery = supabase
            .from('saas_organizations')
            .select('id', { count: 'exact', head: true })
          if (allOrgIds.length > 0) {
            countQuery.in('id', allOrgIds)
          } else {
            totalCount = 0
          }
          if (allOrgIds.length > 0) {
            const { count } = await countQuery
            totalCount = count || 0
          }
        }

        // Apply ordering
        const allowedSort = new Set(['created_at', 'name', 'updated_at'])
        const sortKey = allowedSort.has(orderBy) ? orderBy : 'created_at'
        query = query.order(sortKey, { ascending: orderDir === 'asc' })

        // Apply pagination
        const start = (page - 1) * pageSize
        query = query.range(start, start + pageSize - 1)

        const { data, error } = await query
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })

        // Helper function to get migration version from client supabase
        const getMigrationVersion = async (org: any): Promise<string | null> => {
          try {
            let clientUrl = org.client_supabase_url
            let encryptedKey = org.client_service_key_encrypted || org.client_anon_key_encrypted

            // If no credentials in org, try fallback: get credentials from saas_supabases_connections
            if (!clientUrl || !encryptedKey) {
              if (org.owner_id) {
                try {
                  const { data: connRow } = await supabase
                    .from('saas_supabases_connections')
                    .select('supabase_url, service_role_encrypted, anon_key_encrypted')
                    .eq('owner_id', org.owner_id)
                    .order('last_used_at', { ascending: false, nullsFirst: false })
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()
                  
                  if (connRow?.supabase_url) {
                    clientUrl = connRow.supabase_url
                    encryptedKey = connRow.service_role_encrypted || connRow.anon_key_encrypted
                  }
                } catch (e) {
                  console.error('[getMigrationVersion] Fallback query error:', e)
                }
              }
              
              if (!clientUrl || !encryptedKey) {
                return null
              }
            }

            // Decrypt service key
            let serviceKey = ''
            try {
              const cleanB64 = cleanBase64(String(encryptedKey || ''))
              serviceKey = atob(cleanB64)
            } catch (e) {
              console.error('[getMigrationVersion] Failed to decrypt key for org:', org.id, e)
              return null
            }

            if (!serviceKey) {
              return null
            }

            // Create client supabase connection
            const clientSupabase = createClient(String(clientUrl), serviceKey)

            // Query app_migrations for the latest version
            // Get all versions and find the maximum numeric value
            const { data: allMigrations, error: migError } = await clientSupabase
              .from('app_migrations')
              .select('version')

            if (migError) {
              console.error('[getMigrationVersion] Query error for org:', org.id, migError.message)
              return null
            }

            if (!allMigrations || allMigrations.length === 0) {
              return null
            }

            // Find the maximum numeric version
            const versions = allMigrations
              .map(m => {
                const v = m.version
                if (!v) return 0
                const num = parseInt(String(v), 10)
                return isNaN(num) ? 0 : num
              })
              .filter(v => v > 0)

            if (versions.length === 0) {
              return null
            }

            const maxVersion = Math.max(...versions)
            return String(maxVersion)
          } catch (e) {
            console.error('[getMigrationVersion] Exception for org:', org.id, e)
            return null
          }
        }

        // Get plan expiration and migration version for each org
        const orgs = await Promise.all((data || []).map(async (org: any) => {
          let planExpiration: string | null = null

          // Check if org has attributed_token_id (Pro/Starter via token)
          if (org.attributed_token_id) {
            const { data: token } = await supabase
              .from('saas_plan_tokens')
              .select('valid_until, plan_id')
              .eq('id', org.attributed_token_id)
              .maybeSingle()
            if (token?.valid_until) {
              planExpiration = token.valid_until
            }
          }

          // If no token expiration and plan is trial, use trial_ends_at
          if (!planExpiration && org.plan_id) {
            const planSlug = org.saas_plans?.slug || ''
            if (planSlug === 'trial' && org.trial_ends_at) {
              planExpiration = org.trial_ends_at
            }
          }

          // Get migration version from client supabase
          const migrationVersion = await getMigrationVersion(org)

          return {
            id: org.id,
            name: org.name,
            slug: org.slug,
            owner_id: org.owner_id,
            owner_email: org.saas_users?.email || '',
            owner_name: org.saas_users?.name || null,
            plan_id: org.plan_id,
            plan_name: org.saas_plans?.name || '',
            plan_slug: org.saas_plans?.slug || '',
            trial_ends_at: org.trial_ends_at,
            plan_expiration: planExpiration,
            migration_version: migrationVersion,
            created_at: org.created_at,
            updated_at: org.updated_at
          }
        }))

        return new Response(JSON.stringify({ page, page_size: pageSize, total: totalCount, organizations: orgs }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error listing organizations', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== Delete organization (admin-only)
    if (action === 'delete_organization' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const orgId = (body?.organization_id as string || '').trim()
        const confirmText = (body?.confirm_text as string || '').trim()

        if (!orgId) return new Response('Missing organization_id', { status: 400, headers: getCorsHeaders(req) })
        if (confirmText !== 'deletar') {
          return new Response('Confirmation text must be exactly "deletar"', { status: 400, headers: getCorsHeaders(req) })
        }

        // Verify organization exists
        const { data: org, error: orgErr } = await supabase
          .from('saas_organizations')
          .select('id, name')
          .eq('id', orgId)
          .maybeSingle()

        if (orgErr) return new Response(orgErr.message, { status: 400, headers: getCorsHeaders(req) })
        if (!org) return new Response('Organization not found', { status: 404, headers: getCorsHeaders(req) })

        // Delete organization (cascade will handle related records)
        const { error: deleteErr } = await supabase
          .from('saas_organizations')
          .delete()
          .eq('id', orgId)

        if (deleteErr) return new Response(deleteErr.message, { status: 400, headers: getCorsHeaders(req) })

        return new Response(JSON.stringify({ success: true, organization_id: orgId }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error deleting organization', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== List memberships (admin-only)
    if (action === 'list_memberships' && req.method === 'GET') {
      try {
        const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('page_size') || '20')))
        const search = (url.searchParams.get('search') || '').trim()
        const orderBy = (url.searchParams.get('order_by') || 'created_at').toLowerCase()
        const orderDir = ((url.searchParams.get('order_dir') || 'desc').toLowerCase() === 'desc') ? 'desc' : 'asc'

        // Handle search: need to search by member email OR organization name
        let allMembershipIds: string[] = []
        let totalCount = 0

        if (search) {
          // Search by member email
          const { data: users } = await supabase
            .from('saas_users')
            .select('id')
            .ilike('email', `%${search}%`)
          const userIds = (users || []).map(u => u.id)

          // Search by organization name
          const { data: orgsByName } = await supabase
            .from('saas_memberships')
            .select('id')
            .ilike('organization_name', `%${search}%`)

          // Merge IDs
          const nameMembershipIds = (orgsByName || []).map(m => m.id)
          const userMembershipIds: string[] = []
          if (userIds.length > 0) {
            const { data: membershipsByUser } = await supabase
              .from('saas_memberships')
              .select('id')
              .in('saas_user_id', userIds)
            userMembershipIds.push(...((membershipsByUser || []).map(m => m.id)))
          }
          allMembershipIds = [...new Set([...userMembershipIds, ...nameMembershipIds])]
        }

        // Build query (without join to avoid relationship cache issues)
        let query = supabase
          .from('saas_memberships')
          .select(`
            id,
            saas_user_id,
            organization_id_in_client,
            role,
            status,
            organization_name,
            created_at,
            updated_at
          `, { count: search ? false : 'exact' })

        // Apply search filter if we have IDs
        if (search && allMembershipIds.length > 0) {
          query = query.in('id', allMembershipIds)
        } else if (search && allMembershipIds.length === 0) {
          // No matches, return empty
          return new Response(JSON.stringify({ page, page_size: pageSize, total: 0, memberships: [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }

        // Get total count
        if (!search) {
          const countQuery = supabase
            .from('saas_memberships')
            .select('id', { count: 'exact', head: true })
          const { count } = await countQuery
          totalCount = count || 0
        } else {
          // If searching, count the filtered results
          if (allMembershipIds.length > 0) {
            const countQuery = supabase
              .from('saas_memberships')
              .select('id', { count: 'exact', head: true })
              .in('id', allMembershipIds)
            const { count } = await countQuery
            totalCount = count || 0
          } else {
            totalCount = 0
          }
        }

        // Apply ordering
        const allowedSort = new Set(['created_at', 'role', 'updated_at'])
        const sortKey = allowedSort.has(orderBy) ? orderBy : 'created_at'
        query = query.order(sortKey, { ascending: orderDir === 'asc' })

        // Apply pagination
        const start = (page - 1) * pageSize
        query = query.range(start, start + pageSize - 1)

        const { data, error } = await query
        if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })

        // Enrich with member and organization owner info
        const memberships = await Promise.all((data || []).map(async (m: any) => {
          // Get member info from saas_users
          let memberEmail = ''
          let memberName: string | null = null
          if (m.saas_user_id) {
            const { data: member } = await supabase
              .from('saas_users')
              .select('email, name')
              .eq('id', m.saas_user_id)
              .maybeSingle()
            if (member) {
              memberEmail = member.email || ''
              memberName = member.name || null
            }
          }

          // Find organization owner via client_org_id in saas_organizations
          let ownerEmail = ''
          let ownerName: string | null = null
          let orgName = m.organization_name || ''

          if (m.organization_id_in_client) {
            const { data: org } = await supabase
              .from('saas_organizations')
              .select('owner_id, name')
              .eq('client_org_id', m.organization_id_in_client)
              .maybeSingle()
            
            if (org) {
              if (!orgName && org.name) {
                orgName = org.name
              }
              if (org.owner_id) {
                const { data: owner } = await supabase
                  .from('saas_users')
                  .select('email, name')
                  .eq('id', org.owner_id)
                  .maybeSingle()
                if (owner) {
                  ownerEmail = owner.email || ''
                  ownerName = owner.name || null
                }
              }
            }
          }

          return {
            id: m.id,
            saas_user_id: m.saas_user_id,
            member_email: memberEmail,
            member_name: memberName,
            organization_id_in_client: m.organization_id_in_client,
            organization_name: orgName || m.organization_id_in_client,
            owner_email: ownerEmail,
            owner_name: ownerName,
            role: m.role,
            status: m.status,
            created_at: m.created_at,
            updated_at: m.updated_at
          }
        }))

        return new Response(JSON.stringify({ page, page_size: pageSize, total: totalCount, memberships }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error listing memberships', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== Update membership role (admin-only)
    if (action === 'update_membership_role' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const membershipId = (body?.membership_id as string || '').trim()
        const newRole = (body?.role as string || '').trim()

        if (!membershipId) return new Response('Missing membership_id', { status: 400, headers: getCorsHeaders(req) })
        if (!newRole) return new Response('Missing role', { status: 400, headers: getCorsHeaders(req) })

        const allowedRoles = ['owner', 'admin', 'member', 'viewer']
        if (!allowedRoles.includes(newRole)) {
          return new Response(`Invalid role. Must be one of: ${allowedRoles.join(', ')}`, { status: 400, headers: getCorsHeaders(req) })
        }

        // Update membership
        const { error: updateErr } = await supabase
          .from('saas_memberships')
          .update({
            role: newRole,
            updated_at: new Date().toISOString()
          })
          .eq('id', membershipId)

        if (updateErr) return new Response(updateErr.message, { status: 400, headers: getCorsHeaders(req) })

        return new Response(JSON.stringify({ success: true, membership_id: membershipId, role: newRole }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error updating membership role', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== Delete membership (admin-only)
    if (action === 'delete_membership' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const membershipId = (body?.membership_id as string || '').trim()

        if (!membershipId) return new Response('Missing membership_id', { status: 400, headers: getCorsHeaders(req) })

        // Verify membership exists
        const { data: membership, error: memErr } = await supabase
          .from('saas_memberships')
          .select('id, role')
          .eq('id', membershipId)
          .maybeSingle()

        if (memErr) return new Response(memErr.message, { status: 400, headers: getCorsHeaders(req) })
        if (!membership) return new Response('Membership not found', { status: 404, headers: getCorsHeaders(req) })

        // Delete membership
        const { error: deleteErr } = await supabase
          .from('saas_memberships')
          .delete()
          .eq('id', membershipId)

        if (deleteErr) return new Response(deleteErr.message, { status: 400, headers: getCorsHeaders(req) })

        return new Response(JSON.stringify({ success: true, membership_id: membershipId }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error deleting membership', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== Get user Supabase connections (admin-only)
    // 🔒 SECURITY: Uses decrypt_key() to return decrypted values for admin viewing
    if (action === 'user_supabase_connections' && req.method === 'GET') {
      try {
        const userId = url.searchParams.get('user_id') || ''
        if (!userId) return new Response('Missing user_id', { status: 400, headers: getCorsHeaders(req) })

        // Use RPC to decrypt keys server-side
        const { data: connections, error } = await supabase.rpc('admin_get_user_connections', { p_user_id: userId })

        if (error) {
          // Fallback to raw query if RPC doesn't exist yet
          const { data: rawConns, error: rawErr } = await supabase
            .from('saas_supabases_connections')
            .select('id, owner_id, supabase_url, anon_key_encrypted, service_role_encrypted, label, project_ref, is_active, last_used_at, created_at, updated_at')
            .eq('owner_id', userId)
            .order('updated_at', { ascending: false })
          
          if (rawErr) return new Response(rawErr.message, { status: 400, headers: getCorsHeaders(req) })
          return new Response(JSON.stringify({ connections: rawConns || [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }

        return new Response(JSON.stringify({ connections: connections || [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error fetching user connections', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== Get user organizations as owner (admin-only)
    // 🔒 SECURITY: Uses decrypt_key() to return decrypted values for admin viewing
    if (action === 'user_organizations' && req.method === 'GET') {
      try {
        const userId = url.searchParams.get('user_id') || ''
        if (!userId) return new Response('Missing user_id', { status: 400, headers: getCorsHeaders(req) })

        // Use RPC to decrypt keys server-side
        const { data: orgs, error } = await supabase.rpc('admin_get_user_organizations', { p_user_id: userId })

        if (error) {
          // Fallback to raw query if RPC doesn't exist yet
          const { data: rawOrgs, error: rawErr } = await supabase
            .from('saas_organizations')
            .select(`
              id,
              name,
              slug,
              owner_id,
              client_org_id,
              client_supabase_url,
              client_anon_key_encrypted,
              client_service_key_encrypted,
              created_at,
              updated_at
            `)
            .eq('owner_id', userId)
            .order('created_at', { ascending: false })
          
          if (rawErr) return new Response(rawErr.message, { status: 400, headers: getCorsHeaders(req) })
          return new Response(JSON.stringify({ organizations: rawOrgs || [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }

        return new Response(JSON.stringify({ organizations: orgs || [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error fetching user organizations', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== Update Supabase connection (admin-only)
    if (action === 'update_supabase_connection' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const connectionId = (body?.connection_id as string || '').trim()
        const supabaseUrl = (body?.supabase_url as string || '').trim()
        const anonKey = (body?.anon_key as string || '').trim()
        const serviceKey = (body?.service_key as string || '').trim()
        const label = (body?.label as string || '').trim()

        if (!connectionId) return new Response('Missing connection_id', { status: 400, headers: getCorsHeaders(req) })

        const updateData: any = {
          updated_at: new Date().toISOString()
        }

        if (supabaseUrl) updateData.supabase_url = supabaseUrl
        if (anonKey) {
          // 🔒 SECURITY: Pass plain text - the database trigger will encrypt with pgcrypto
          updateData.anon_key_encrypted = anonKey
        }
        if (serviceKey) {
          // 🔒 SECURITY: Pass plain text - the database trigger will encrypt with pgcrypto
          updateData.service_role_encrypted = serviceKey
        }
        if (label !== undefined) updateData.label = label || null

        const { error: updateErr } = await supabase
          .from('saas_supabases_connections')
          .update(updateData)
          .eq('id', connectionId)

        if (updateErr) return new Response(updateErr.message, { status: 400, headers: getCorsHeaders(req) })

        return new Response(JSON.stringify({ success: true, connection_id: connectionId }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error updating connection', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    // ===== Update organization Supabase credentials (admin-only)
    if (action === 'update_org_supabase_credentials' && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        const orgId = (body?.organization_id as string || '').trim()
        const supabaseUrl = (body?.supabase_url as string || '').trim()
        const anonKey = (body?.anon_key as string || '').trim()
        const serviceKey = (body?.service_key as string || '').trim()

        if (!orgId) return new Response('Missing organization_id', { status: 400, headers: getCorsHeaders(req) })

        const updateData: any = {
          updated_at: new Date().toISOString()
        }

        if (supabaseUrl) updateData.client_supabase_url = supabaseUrl
        
        // Use pgcrypto encryption via RPC (not base64!)
        try {
          if (anonKey) {
            updateData.client_anon_key_encrypted = await encryptKeyWithRpc(supabase, anonKey)
          }
          if (serviceKey) {
            updateData.client_service_key_encrypted = await encryptKeyWithRpc(supabase, serviceKey)
          }
        } catch (encErr: any) {
          return new Response(`Encryption failed: ${encErr.message}`, { status: 500, headers: getCorsHeaders(req) })
        }

        const { error: updateErr } = await supabase
          .from('saas_organizations')
          .update(updateData)
          .eq('id', orgId)

        if (updateErr) return new Response(updateErr.message, { status: 400, headers: getCorsHeaders(req) })

        return new Response(JSON.stringify({ success: true, organization_id: orgId }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(err?.message || 'Error updating organization credentials', { status: 500, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'check_emails') {
      try {
        const body = await req.json().catch(() => ({}))
        const emails = body.emails || []
        
        if (!Array.isArray(emails) || emails.length === 0) {
          return new Response(JSON.stringify({ error: 'emails array is required' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }

        // Buscar TODOS os emails existentes em saas_users (com paginação para garantir que pegamos todos)
        // Usar service_role para bypass RLS e garantir acesso completo
        const existingEmailsSet = new Set<string>()
        let page = 0
        const pageSize = 1000
        let hasMore = true

        while (hasMore) {
          const { data: existingUsers, error } = await supabase
            .from('saas_users')
            .select('email')
            .range(page * pageSize, (page + 1) * pageSize - 1)
          
          if (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
          }

          if (!existingUsers || existingUsers.length === 0) {
            hasMore = false
            break
          }

          // Normalizar emails existentes para lowercase para comparação
          for (const user of existingUsers) {
            const email = (user.email || '').toLowerCase().trim()
            if (email) {
              existingEmailsSet.add(email)
            }
          }

          // Se retornou menos que pageSize, chegamos ao fim
          if (existingUsers.length < pageSize) {
            hasMore = false
          } else {
            page++
          }
        }

        // Verificar quais emails não têm conta
        const emailsWithoutAccount = []
        const emailsWithAccount = []

        for (const email of emails) {
          const normalizedEmail = String(email).toLowerCase().trim()
          if (existingEmailsSet.has(normalizedEmail)) {
            emailsWithAccount.push(email)
          } else {
            emailsWithoutAccount.push(email)
          }
        }

        return new Response(JSON.stringify({
          ok: true,
          total_checked: emails.length,
          total_in_db: existingEmailsSet.size,
          with_account: emailsWithAccount.length,
          without_account: emailsWithoutAccount.length,
          emails_with_account: emailsWithAccount,
          emails_without_account: emailsWithoutAccount
        }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'Error checking emails' }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
    }

    // Unknown action - return error response
    return new Response('Unknown action', { status: 400, headers: getCorsHeaders(req) })
  } catch (err: any) {
    console.error('[admin-analytics] Top-level error:', err)
    return new Response(`Error: ${err?.message || err}`, { status: 500, headers: getCorsHeaders(req) })
  }
})


