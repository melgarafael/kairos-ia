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

    if (action === 'user_exists') {
      // Minimal existence check protected by shared secret to avoid enumeration
      const secret = req.headers.get('x-issue-secret') || ''
      if (!ISSUE_SECRET || secret !== ISSUE_SECRET) {
        return new Response('Forbidden', { status: 403, headers: getCorsHeaders(req) })
      }
      let email = ''
      if (req.method === 'GET') {
        email = (url.searchParams.get('email') || '').trim().toLowerCase()
      } else {
        const body = await req.json().catch(() => ({}))
        email = (body?.email || '').toString().trim().toLowerCase()
      }
      if (!email) return new Response('Missing email', { status: 400, headers: getCorsHeaders(req) })
      const { data, error } = await supabase.from('saas_users').select('id').eq('email', email).maybeSingle()
      if (error && error.code !== 'PGRST116') return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
      const exists = Boolean(data?.id)
      return new Response(JSON.stringify({ exists }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    if (action === 'list') {
      if (!saasUserId) return new Response('Unauthorized', { status: 401, headers: getCorsHeaders(req) })
      const { data, error } = await supabase
        .from('saas_plan_tokens')
        .select('id, plan_id, status, purchased_at, valid_until, applied_organization_id, applied_at, created_at, updated_at, is_frozen, license_duration_days, saas_plans:plan_id(id, name, slug)')
        .eq('owner_user_id', saasUserId)
        .order('created_at', { ascending: false })
      if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
      return new Response(JSON.stringify({ ok: true, tokens: data || [] }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // Admin/self fetch: list tokens by explicit saas_users primary id (owner_user_id)
    if (action === 'list_by_user') {
      const targetUserId = (new URL(req.url)).searchParams.get('user_id') || ''
      if (!targetUserId) return new Response('Missing user_id', { status: 400, headers: getCorsHeaders(req) })
      const secret = req.headers.get('x-issue-secret') || ''
      const isSelf = Boolean(saasUserId && saasUserId === targetUserId)
      const isPrivileged = Boolean(ISSUE_SECRET && secret && secret === ISSUE_SECRET)
      if (!isSelf && !isPrivileged) {
        return new Response('Forbidden', { status: 403, headers: getCorsHeaders(req) })
      }
      const { data, error } = await supabase
        .from('saas_plan_tokens')
        .select('id, plan_id, status, purchased_at, valid_until, applied_organization_id, applied_at, created_at, updated_at, is_frozen, license_duration_days, saas_plans:plan_id(id, name, slug)')
        .eq('owner_user_id', targetUserId)
        .order('created_at', { ascending: false })
      if (error) return new Response(error.message, { status: 400, headers: getCorsHeaders(req) })
      return new Response(JSON.stringify({ ok: true, tokens: data || [] }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    if (action === 'applicable_orgs') {
      if (!saasUserId) return new Response('Unauthorized', { status: 401, headers: getCorsHeaders(req) })
      const { data: orgs } = await supabase
        .from('saas_organizations')
        .select('id, name, slug, plan_id')
        .eq('owner_id', saasUserId)
      const orgIds = (orgs || []).map(o => o.id)
      let activeMap: Record<string, boolean> = {}
      if (orgIds.length) {
        const { data: subs } = await supabase
          .from('saas_subscriptions')
          .select('organization_id, status, current_period_end')
          .in('organization_id', orgIds)
        ;(subs || []).forEach(s => {
          const active = s.status === 'active' && (!s.current_period_end || new Date(s.current_period_end) > new Date())
          activeMap[s.organization_id] = activeMap[s.organization_id] || active
        })
      }
      const { data: plans } = await supabase.from('saas_plans').select('id, slug')
      const slugById: Record<string, string> = {}
      ;(plans || []).forEach(p => { slugById[p.id] = p.slug })
      const payload = (orgs || []).map(o => {
        const slug = o.plan_id ? (slugById[o.plan_id] || null) : null
        const eligible = !activeMap[o.id] && (!slug || slug === 'trial' || slug === 'trial_expired')
        return { id: o.id, name: o.name, slug: o.slug, plan_slug: slug, eligible }
      })
      return new Response(JSON.stringify({ ok: true, organizations: payload }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    if (action === 'issue' && req.method === 'POST') {
      // Service entry-point: require shared secret
      const secret = req.headers.get('x-issue-secret') || ''
      if (!ISSUE_SECRET || secret !== ISSUE_SECRET) {
        return new Response('Forbidden', { status: 403, headers: getCorsHeaders(req) })
      }
      const body = await req.json().catch(() => ({}))
      const email = (body?.email || '').toString().trim().toLowerCase()
      const planId = (body?.plan_id || '').toString().trim()
      const accountType = body?.account_type && ['profissional', 'agencia', 'usuario', 'empresa'].includes(body.account_type) 
        ? body.account_type 
        : null
      // purchased_at sempre será o horário da emissão no servidor (ignorar payload do cliente)
      const nowIso = new Date().toISOString()
      const validDays = Number(body?.valid_days || 180)
      const validUntil = new Date(Date.now() + Math.max(1, validDays) * 24 * 3600 * 1000).toISOString()
      if (!email || !planId) return new Response('Missing email/plan_id', { status: 400, headers: getCorsHeaders(req) })

      // Ensure user exists
      let userId: string | null = null
      let createdNew = false
      const { data: u } = await supabase.from('saas_users').select('id').eq('email', email).maybeSingle()
      if (u?.id) {
        userId = u.id
        // Atualizar account_type se fornecido e diferente do atual
        if (accountType) {
          await supabase
            .from('saas_users')
            .update({ account_type: accountType, updated_at: nowIso })
            .eq('id', userId)
        }
      } else {
        const admin = supabase.auth.admin
        const password = Math.random().toString(36).slice(2) + 'A1!'
        const created = await admin.createUser({ email, password, email_confirm: true })
        if ((created as any).error) return new Response(`auth_create_failed: ${(created as any).error.message}`, { status: 400, headers: getCorsHeaders(req) })
        userId = (created as any).data.user?.id || null
        createdNew = Boolean(userId)
        // Se foi criado novo usuário e account_type foi fornecido, atualizar
        if (userId && accountType) {
          await supabase
            .from('saas_users')
            .update({ account_type: accountType, updated_at: nowIso })
            .eq('id', userId)
        }
      }
      if (!userId) return new Response('User not created', { status: 400, headers: getCorsHeaders(req) })

      const ins = await supabase
        .from('saas_plan_tokens')
        .insert({ owner_user_id: userId, plan_id: planId, status: 'available', purchased_at: nowIso, valid_until: validUntil, gateway: body?.gateway || null, external_order_id: body?.external_order_id || null, external_subscription_id: body?.external_subscription_id || null, issued_by: body?.issued_by || 'api' })
        .select('id')
        .maybeSingle()
      if (ins.error) return new Response(ins.error.message, { status: 400, headers: getCorsHeaders(req) })

      // If user was just created, generate a recovery link normalized to /reset-password
      let recoveryLink: string | undefined
      if (createdNew) {
        try {
          const DEFAULT_REDIRECT = (Deno.env.get('APP_REDIRECT_URL') || 'https://crm.automatiklabs.com.br/reset-password').toString()
          let redirectTo = (body?.redirect_to || DEFAULT_REDIRECT).toString().trim()
          try {
            const u = new URL(redirectTo)
            if (!/\/reset-password\/?$/i.test(u.pathname)) {
              u.pathname = '/reset-password'
              u.search = ''
              u.hash = ''
              redirectTo = u.toString()
            }
          } catch {
            if (!/reset-password/i.test(redirectTo)) redirectTo = DEFAULT_REDIRECT
          }
          const admin = supabase.auth.admin
          const { data: linkData, error: linkErr } = await (admin as any).generateLink({
            type: 'recovery',
            email,
            options: { redirectTo }
          })
          if (!linkErr) {
            recoveryLink = (linkData?.properties?.action_link) || (linkData?.action_link) || undefined
          }
        } catch (_) {}
      }

      return new Response(JSON.stringify({ ok: true, token_id: ins.data?.id || null, recovery_link: recoveryLink }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    if (action === 'transfer' && req.method === 'POST') {
      if (!saasUserId) return new Response('Unauthorized', { status: 401, headers: getCorsHeaders(req) })
      const body = await req.json().catch(() => ({}))
      const tokenId = (body?.token_id || '').toString().trim()
      const recipientEmail = (body?.recipient_email || '').toString().trim().toLowerCase()
      
      if (!tokenId || !recipientEmail) {
        return new Response('Missing token_id or recipient_email', { status: 400, headers: getCorsHeaders(req) })
      }

      // Load token and verify ownership
      const { data: token, error: tErr } = await supabase
        .from('saas_plan_tokens')
        .select('id, owner_user_id, plan_id, status, valid_until')
        .eq('id', tokenId)
        .maybeSingle()
      
      if (tErr || !token) {
        return new Response('Token not found', { status: 404, headers: getCorsHeaders(req) })
      }
      
      if (token.owner_user_id !== saasUserId) {
        return new Response('Forbidden', { status: 403, headers: getCorsHeaders(req) })
      }
      
      if (token.status !== 'available') {
        return new Response('Token not available for transfer', { status: 400, headers: getCorsHeaders(req) })
      }

      // Validate token has more than 31 days validity
      if (!token.valid_until) {
        return new Response('Token has no validity date', { status: 400, headers: getCorsHeaders(req) })
      }
      
      const validDate = new Date(token.valid_until)
      const now = new Date()
      const diffDays = (validDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      
      if (diffDays <= 31) {
        return new Response('Token must have more than 31 days validity to be transferred', { status: 400, headers: getCorsHeaders(req) })
      }

      // Check if recipient user exists
      const { data: recipientUser, error: userErr } = await supabase
        .from('saas_users')
        .select('id, email')
        .eq('email', recipientEmail)
        .maybeSingle()
      
      if (userErr && userErr.code !== 'PGRST116') {
        return new Response(`Error checking user: ${userErr.message}`, { status: 400, headers: getCorsHeaders(req) })
      }
      
      if (!recipientUser?.id) {
        return new Response('User not found. The recipient must have an account in the system.', { status: 404, headers: getCorsHeaders(req) })
      }

      // Prevent self-transfer
      if (recipientUser.id === saasUserId) {
        return new Response('Cannot transfer token to yourself', { status: 400, headers: getCorsHeaders(req) })
      }

      // Transfer token: update owner_user_id
      const { error: transferErr } = await supabase
        .from('saas_plan_tokens')
        .update({ owner_user_id: recipientUser.id, updated_at: new Date().toISOString() })
        .eq('id', tokenId)
      
      if (transferErr) {
        return new Response(`Transfer failed: ${transferErr.message}`, { status: 400, headers: getCorsHeaders(req) })
      }

      return new Response(JSON.stringify({ 
        ok: true, 
        token_id: tokenId, 
        recipient_user_id: recipientUser.id,
        recipient_email: recipientEmail
      }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    if (action === 'apply' && req.method === 'POST') {
      if (!saasUserId) return new Response('Unauthorized', { status: 401, headers: getCorsHeaders(req) })
      const body = await req.json().catch(() => ({}))
      const tokenId = (body?.token_id || '').toString().trim()
      const orgIdRaw = (body?.organization_id || '').toString().trim()
      if (!tokenId || !orgIdRaw) return new Response('Missing token_id/organization_id', { status: 400, headers: getCorsHeaders(req) })

      // Load token (including frozen token fields)
      const { data: token, error: tErr } = await supabase
        .from('saas_plan_tokens')
        .select('id, owner_user_id, plan_id, status, valid_until, is_frozen, license_duration_days')
        .eq('id', tokenId)
        .maybeSingle()
      if (tErr || !token) return new Response('Token not found', { status: 404, headers: getCorsHeaders(req) })
      if (token.owner_user_id !== saasUserId) return new Response('Forbidden', { status: 403, headers: getCorsHeaders(req) })
      if (token.status !== 'available') return new Response('Token not available', { status: 400, headers: getCorsHeaders(req) })
      // For frozen tokens, don't check valid_until (it will be calculated on attribution)
      if (!token.is_frozen && token.valid_until && new Date(token.valid_until) < new Date()) return new Response('Token expired', { status: 400, headers: getCorsHeaders(req) })

      // Resolve master org id (accepts master id or client id)
      let masterOrgId: string | null = null
      const byId = await supabase.from('saas_organizations').select('id, owner_id, plan_id').eq('id', orgIdRaw).maybeSingle()
      let org = byId.data
      if (!org?.id) {
        const byClient = await supabase.from('saas_organizations').select('id, owner_id, plan_id').eq('client_org_id', orgIdRaw).maybeSingle()
        org = byClient.data
      }
      if (!org?.id) return new Response('Organization not found', { status: 404, headers: getCorsHeaders(req) })
      if (org.owner_id !== saasUserId) return new Response('Not owner of organization', { status: 403, headers: getCorsHeaders(req) })

      // Check eligibility: no active subscription and plan is trial/trial_expired/null
      const { data: subs } = await supabase
        .from('saas_subscriptions')
        .select('status, current_period_end')
        .eq('organization_id', org.id)
      const hasActive = (subs || []).some(s => s.status === 'active' && (!s.current_period_end || new Date(s.current_period_end) > new Date()))
      const { data: planRow } = await supabase.from('saas_plans').select('id, slug').eq('id', org.plan_id).maybeSingle()
      const slug = planRow?.slug || null
      const eligible = !hasActive && (!slug || slug === 'trial' || slug === 'trial_expired')
      if (!eligible) return new Response('Organization has active plan', { status: 400, headers: getCorsHeaders(req) })

      // Apply: update org plan + create subscription
      const nowIso = new Date().toISOString()
      
      // Calculate subscription end date:
      // - For frozen tokens: use license_duration_days from attribution date (now)
      // - For regular tokens: use 30 days from now
      let endIso: string
      if (token.is_frozen && token.license_duration_days) {
        // Calculate expiration as now() + duration days
        const durationDays = Math.max(1, Number(token.license_duration_days) || 30)
        endIso = new Date(Date.now() + durationDays * 24 * 3600 * 1000).toISOString()
      } else {
        endIso = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
      }
      
      // Update organization: set plan_id and attributed_token_id
      const upd = await supabase.from('saas_organizations').update({ 
        plan_id: token.plan_id, 
        attributed_token_id: token.id,
        updated_at: nowIso 
      }).eq('id', org.id)
      if (upd.error) return new Response(upd.error.message, { status: 400, headers: getCorsHeaders(req) })
      const insSub = await supabase.from('saas_subscriptions').insert({ organization_id: org.id, plan_id: token.plan_id, status: 'active', current_period_start: nowIso, current_period_end: endIso, cancel_at_period_end: false, created_at: nowIso, updated_at: nowIso }).select('id').maybeSingle()
      if (insSub.error) return new Response(insSub.error.message, { status: 400, headers: getCorsHeaders(req) })
      
      // Update token: mark as redeemed and unfreeze if it was frozen
      // The trigger will automatically calculate valid_until as now() + license_duration_days when is_frozen changes to false
      const tokenUpdate: any = { status: 'redeemed', applied_organization_id: org.id, applied_at: nowIso }
      if (token.is_frozen) {
        tokenUpdate.is_frozen = false
        // license_duration_days stays the same (for reference), but valid_until will be calculated by trigger
      }
      
      const updToken = await supabase.from('saas_plan_tokens').update(tokenUpdate).eq('id', token.id)
      if (updToken.error) return new Response(updToken.error.message, { status: 400, headers: getCorsHeaders(req) })
      return new Response(JSON.stringify({ ok: true, organization_id: org.id, subscription_id: insSub.data?.id || null }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), { status: 500, headers: getCorsHeaders(req) })
  }
})


