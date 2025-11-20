// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

function getCorsHeaders(req: Request): HeadersInit {
  const allowedOrigins = (Deno.env.get('CORS_ORIGINS') || Deno.env.get('CORS_ORIGIN') || '')
    .split(',').map(s => s.trim()).filter(Boolean)
  const origin = req.headers.get('Origin') || ''
  const allowOrigin = allowedOrigins.length === 0 ? '*' : (allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-issue-secret, idempotency-key',
    'Access-Control-Max-Age': '86400'
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || ''

    const MASTER_URL = Deno.env.get('SUPABASE_URL')!
    const MASTER_ANON = Deno.env.get('SUPABASE_ANON_KEY')!
    const MASTER_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ISSUE_SECRET = Deno.env.get('ISSUE_TOKEN_SECRET') || ''

    // Auth via anon+Bearer
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''
    const authClient = createClient(MASTER_URL, MASTER_ANON, { global: { headers: { Authorization: `Bearer ${bearer || MASTER_ANON}` } } })
    const { data: userData } = await authClient.auth.getUser()
    const saasUserId = userData?.user?.id || null

    const supabase = createClient(MASTER_URL, MASTER_SERVICE)

    if (action === 'list') {
      if (!saasUserId) return new Response('Unauthorized', { status: 401, headers: getCorsHeaders(req) })
      const { data, error } = await supabase
        .from('saas_member_seats_grants')
        .select('id, quantity, status, granted_at, valid_until, gateway, external_order_id, external_subscription_id, issued_by, created_at, updated_at')
        .eq('owner_user_id', saasUserId)
        .order('created_at', { ascending: false })
      if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
      return new Response(JSON.stringify({ ok: true, grants: data || [] }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    if (action === 'issue' && req.method === 'POST') {
      // Service entry-point: require shared secret
      const secret = req.headers.get('x-issue-secret') || ''
      if (!ISSUE_SECRET || secret !== ISSUE_SECRET) {
        return new Response('Forbidden', { status: 403, headers: getCorsHeaders(req) })
      }
      const idempotencyKey = req.headers.get('Idempotency-Key') || undefined
      const body = await req.json().catch(() => ({}))
      const email = (body?.email || '').toString().trim().toLowerCase()
      const userIdRaw = (body?.user_id || '').toString().trim()
      const qty = Number(body?.seats || body?.quantity || 0)
      const validDays = body?.valid_days != null ? Number(body?.valid_days) : null
      let validUntilStr = (body?.valid_until || '').toString().trim()
      const gateway = body?.gateway || null
      const externalOrderId = body?.external_order_id || null
      const externalSubscriptionId = body?.external_subscription_id || null
      const issuedBy = (body?.issued_by || 'api').toString()

      if ((!email && !userIdRaw) || !Number.isFinite(qty) || qty <= 0) {
        return new Response('Missing email/user_id or invalid seats', { status: 400, headers: getCorsHeaders(req) })
      }

      // Resolve valid_until
      if (!validUntilStr) {
        const days = validDays != null && Number.isFinite(validDays) ? Math.max(1, validDays as number) : 180
        validUntilStr = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString()
      } else {
        // Validate date
        const t = Date.parse(validUntilStr)
        if (!Number.isFinite(t)) return new Response('Invalid valid_until', { status: 400, headers: getCorsHeaders(req) })
      }

      // Ensure user exists (by id or by email)
      let ownerId: string | null = null
      if (userIdRaw) {
        const { data: u } = await supabase.from('saas_users').select('id').eq('id', userIdRaw).maybeSingle()
        if (!u?.id) return new Response('User not found', { status: 404, headers: getCorsHeaders(req) })
        ownerId = u.id
      } else {
        const { data: u } = await supabase.from('saas_users').select('id').eq('email', email).maybeSingle()
        if (u?.id) ownerId = u.id
        else {
          const admin = supabase.auth.admin
          const password = Math.random().toString(36).slice(2) + 'A1!'
          const created = await admin.createUser({ email, password, email_confirm: true })
          if ((created as any).error) return new Response(`auth_create_failed: ${(created as any).error.message}`, { status: 400, headers: getCorsHeaders(req) })
          ownerId = (created as any).data.user?.id || null
        }
      }
      if (!ownerId) return new Response('User not created', { status: 400, headers: getCorsHeaders(req) })

      // Idempotency: if key provided, check existing
      if (idempotencyKey) {
        const { data: existing } = await supabase
          .from('saas_member_seats_grants')
          .select('id')
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle()
        if (existing?.id) {
          // Return current totals for convenience
          const { data: u2 } = await supabase.from('saas_users').select('member_seats_extra').eq('id', ownerId).maybeSingle()
          return new Response(JSON.stringify({ ok: true, user_id: ownerId, grant_id: existing.id, member_seats_extra: Number(u2?.member_seats_extra || 0), idempotent: true }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }
      }

      // Insert grant first (to leverage unique idempotency_key) then increment atomically via RPC
      const nowIso = new Date().toISOString()
      const ins = await supabase
        .from('saas_member_seats_grants')
        .insert({ owner_user_id: ownerId, quantity: qty, status: 'active', granted_at: nowIso, valid_until: validUntilStr, gateway: gateway, external_order_id: externalOrderId, external_subscription_id: externalSubscriptionId, issued_by: issuedBy, idempotency_key: idempotencyKey || null })
        .select('id')
        .maybeSingle()
      if (ins.error) {
        // On unique violation, behave idempotently
        if ((ins.error as any).code === '23505' && idempotencyKey) {
          const { data: existing } = await supabase
            .from('saas_member_seats_grants')
            .select('id')
            .eq('idempotency_key', idempotencyKey)
            .maybeSingle()
          const { data: u2 } = await supabase.from('saas_users').select('member_seats_extra').eq('id', ownerId).maybeSingle()
          return new Response(JSON.stringify({ ok: true, user_id: ownerId, grant_id: existing?.id || null, member_seats_extra: Number(u2?.member_seats_extra || 0), idempotent: true }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }
        return new Response(ins.error.message, { status: 400, headers: getCorsHeaders(req) })
      }

      // Atomic increment via RPC (service-only). Fallback to direct update if RPC missing
      let incrementOk = true
      try {
        const { error: rpcErr } = await supabase.rpc('perform_member_seats_increment', { p_user_id: ownerId, p_delta: qty })
        if (rpcErr) throw rpcErr
      } catch (_) {
        // Fallback: read-modify-write guarded as best-effort
        try {
          const { data: current } = await supabase.from('saas_users').select('member_seats_extra').eq('id', ownerId).maybeSingle()
          const currentVal = Number(current?.member_seats_extra || 0)
          const { error: updErr } = await supabase.from('saas_users').update({ member_seats_extra: currentVal + qty, updated_at: nowIso }).eq('id', ownerId)
          if (updErr) throw updErr
        } catch (e) {
          incrementOk = false
        }
      }

      if (!incrementOk) {
        // Rollback grant insert best-effort
        await supabase.from('saas_member_seats_grants').delete().eq('id', ins.data?.id || '')
        return new Response('Failed to increment seats', { status: 500, headers: getCorsHeaders(req) })
      }

      const { data: u3 } = await supabase.from('saas_users').select('member_seats_extra').eq('id', ownerId).maybeSingle()
      return new Response(JSON.stringify({ ok: true, user_id: ownerId, grant_id: ins.data?.id || null, member_seats_extra: Number(u3?.member_seats_extra || 0) }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    if (action === 'expire_due') {
      // Protected by shared secret
      const secret = req.headers.get('x-issue-secret') || ''
      if (!ISSUE_SECRET || secret !== ISSUE_SECRET) {
        return new Response('Forbidden', { status: 403, headers: getCorsHeaders(req) })
      }
      const now = new Date()
      // Fetch all active grants that expired
      const { data: grants, error } = await supabase
        .from('saas_member_seats_grants')
        .select('id, owner_user_id, quantity, valid_until')
        .eq('status', 'active')
        .lt('valid_until', now.toISOString())
      if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })

      let processed = 0
      for (const g of (grants || [])) {
        // Decrement seats and mark expired. Best-effort and idempotent per grant id.
        try {
          const { error: rpcErr } = await supabase.rpc('perform_member_seats_increment', { p_user_id: g.owner_user_id, p_delta: -Number(g.quantity || 0) })
          if (rpcErr) throw rpcErr
        } catch (_) {
          try {
            const { data: current } = await supabase.from('saas_users').select('member_seats_extra').eq('id', g.owner_user_id).maybeSingle()
            const currentVal = Number(current?.member_seats_extra || 0)
            const newVal = Math.max(0, currentVal - Number(g.quantity || 0))
            const { error: updErr } = await supabase.from('saas_users').update({ member_seats_extra: newVal, updated_at: new Date().toISOString() }).eq('id', g.owner_user_id)
            if (updErr) throw updErr
          } catch (_) {
            continue
          }
        }
        await supabase.from('saas_member_seats_grants').update({ status: 'expired' }).eq('id', g.id)
        processed++
      }
      return new Response(JSON.stringify({ ok: true, processed }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), { status: 500, headers: getCorsHeaders(req) })
  }
})



