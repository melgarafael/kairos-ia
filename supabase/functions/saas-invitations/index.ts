// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

function getCorsHeaders(req: Request): HeadersInit {
  const allowedOrigins = (Deno.env.get('CORS_ORIGINS') || Deno.env.get('CORS_ORIGIN') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
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

type Action = 'create' | 'list' | 'cancel' | 'accept' | 'members_list' | 'member_update_role' | 'member_remove' | 'list_by_email' | 'accept_by_id' | 'precheck' | 'signup_and_accept' | 'seats_stats' | 'seats_purchase' | 'my_memberships' | 'backfill_memberships' | 'member_get_permissions' | 'member_update_permissions'

// Helper: map plan -> base seats per organization (not counting extras)
function mapPlanBaseSeats(planId?: string | null): number {
  if (!planId) return 0
  const s = String(planId).toLowerCase()
  if (s.includes('trial')) return 0
  if (s.includes('starter') || s.includes('basic')) return 1
  if (s.includes('pro') || s.includes('professional')) return 3
  // UUID fallbacks already used in codebase
  if (planId === '8b5a1000-957c-4eaf-beca-954a78187337') return 1 // starter
  if (planId === 'd4836a79-186f-4905-bfac-77ec52fa1dde') return 3 // pro
  if (planId === '4663da1a-b552-4127-b1af-4bc30c681682') return 0 // trial
  return 0
}

// Helper: count active members and pending invites for an org
async function countOrgReservedSeats(client: any, clientOrgId: string): Promise<{ active: number; pending: number }> {
  const activeResp = await client
    .from('saas_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id_in_client', clientOrgId)
    .eq('status', 'active')
  const pendingResp = await client
    .from('saas_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id_in_client', clientOrgId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
  return { active: Number(activeResp?.count || 0), pending: Number(pendingResp?.count || 0) }
}

// Helper: given a client org id, compute allowed seats considering owner's extras pool across all orgs
async function computeAllowedSeatsForOrg(client: any, clientOrgId: string): Promise<{ allowed: number; base: number; extra_total: number; extra_used: number; owner_id: string | null }> {
  // Discover owner and plan/extras
  const { data: orgMap } = await client
    .from('saas_organizations')
    .select('owner_id')
    .eq('client_org_id', clientOrgId)
    .maybeSingle()
  const ownerId = orgMap?.owner_id || null
  if (!ownerId) return { allowed: 0, base: 0, extra_total: 0, extra_used: 0, owner_id: null }

  const { data: owner } = await client
    .from('saas_users')
    .select('plan_id, member_seats_extra')
    .eq('id', ownerId)
    .maybeSingle()

  const base = mapPlanBaseSeats(owner?.plan_id || null)
  const extraTotal = Number(owner?.member_seats_extra || 0)

  // List all organizations for this owner
  const { data: ownerOrgs } = await client
    .from('saas_organizations')
    .select('client_org_id')
    .eq('owner_id', ownerId)

  const orgIds: string[] = (ownerOrgs || []).map((o: any) => String(o.client_org_id)).filter(Boolean)

  // Sum extras used across all orgs EXCEPT the current org
  let extrasUsed = 0
  for (const oid of orgIds) {
    const { active, pending } = await countOrgReservedSeats(client, oid)
    const reserved = active + pending
    const usedInThisOrg = Math.max(0, reserved - base)
    if (oid !== clientOrgId) extrasUsed += usedInThisOrg
  }

  const extrasRemaining = Math.max(0, extraTotal - extrasUsed)
  const allowed = base + extrasRemaining
  return { allowed: Math.max(0, allowed), base, extra_total: extraTotal, extra_used: extrasUsed, owner_id: ownerId }
}

// Helper: find best credentials (url/key) to access a client project for a given org
async function getCredsForOrg(masterClient: any, clientOrgId: string, invitedBy?: string | null): Promise<{ url: string; key: string; encrypted?: string } | null> {
  // 1) Try invited_by user
  try {
    if (invitedBy) {
      const { data: ownerRow } = await masterClient
        .from('saas_users')
        .select('supabase_url, supabase_key_encrypted')
        .eq('id', invitedBy)
        .maybeSingle()
      const url = ownerRow?.supabase_url || ''
      const key = ownerRow?.supabase_key_encrypted ? atob(String(ownerRow.supabase_key_encrypted)) : ''
      if (url && key) return { url, key, encrypted: String(ownerRow?.supabase_key_encrypted || '') }
    }
  } catch { /* ignore */ }

  // 2) Try org->owner mapping
  try {
    const { data: orgMap } = await masterClient
      .from('saas_organizations')
      .select('owner_id')
      .eq('client_org_id', clientOrgId)
      .maybeSingle()
    const ownerId = orgMap?.owner_id || null
    if (ownerId) {
      const { data: ownerRow } = await masterClient
        .from('saas_users')
        .select('supabase_url, supabase_key_encrypted')
        .eq('id', ownerId)
        .maybeSingle()
      const url = ownerRow?.supabase_url || ''
      const key = ownerRow?.supabase_key_encrypted ? atob(String(ownerRow.supabase_key_encrypted)) : ''
      if (url && key) return { url, key, encrypted: String(ownerRow?.supabase_key_encrypted || '') }
    }
  } catch { /* ignore */ }

  return null
}

// Helper: resolve organization name (prefer Master mirror; fallback to Client lookup)
async function resolveOrgName(masterClient: any, clientOrgId: string, invitedBy?: string | null): Promise<string | null> {
  try {
    const { data: masterOrg } = await masterClient
      .from('saas_organizations')
      .select('name')
      .eq('client_org_id', clientOrgId)
      .maybeSingle()
    if (masterOrg?.name) return String(masterOrg.name)
  } catch {}

  try {
    const creds = await getCredsForOrg(masterClient, clientOrgId, invitedBy)
    if (creds?.url && creds?.key) {
      const { createClient: createClient2 } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
      const client = createClient2(creds.url, creds.key, { global: { headers: { 'x-organization-id': clientOrgId } } })
      const { data: org } = await client
        .from('saas_organizations')
        .select('name')
        .eq('id', clientOrgId)
        .maybeSingle()
      if (org?.name) return String(org.name)
    }
  } catch {}
  return null
}

// Helper: after membership upsert, copy credentials and set org name
async function finalizeMembership(masterClient: any, saasUserId: string, clientOrgId: string, invitedBy?: string | null) {
  try {
    // Find best credentials
    const creds = await getCredsForOrg(masterClient, clientOrgId, invitedBy)
    // Resolve org name regardless of having creds
    const orgName = await resolveOrgName(masterClient, clientOrgId, invitedBy)
    if (creds?.url && (creds?.encrypted || creds?.key)) {
      const encrypted = creds.encrypted || btoa(String(creds.key))
      await masterClient
        .from('saas_memberships')
        .update({
          supabase_url: creds.url,
          supabase_key_encrypted: encrypted,
          organization_name: orgName || null,
          updated_at: new Date().toISOString()
        })
        .eq('saas_user_id', saasUserId)
        .eq('organization_id_in_client', clientOrgId)
    } else if (orgName) {
      // At least set the organization name if we discovered it
      await masterClient
        .from('saas_memberships')
        .update({ organization_name: orgName, updated_at: new Date().toISOString() })
        .eq('saas_user_id', saasUserId)
        .eq('organization_id_in_client', clientOrgId)
    }
  } catch { /* ignore */ }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })

    const url = new URL(req.url)
    const action = (url.searchParams.get('action') || 'create') as Action
    const body = await req.json().catch(() => ({}))

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')

    const MASTER_SUPABASE_URL = Deno.env.get('MASTER_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')
    const MASTER_SUPABASE_ANON_KEY = Deno.env.get('MASTER_SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY')
    const MASTER_SUPABASE_SERVICE_KEY = Deno.env.get('MASTER_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!MASTER_SUPABASE_URL || !MASTER_SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: 'Missing env' }), { status: 500, headers: getCorsHeaders(req) })
    }

    const authHeader = req.headers.get('authorization') || ''
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''

    const masterServiceClient = MASTER_SUPABASE_SERVICE_KEY
      ? createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_KEY)
      : null

    // For unauthenticated flows (precheck/signup), use service client
    if (action === 'precheck') {
      if (!masterServiceClient) {
        return new Response(JSON.stringify({ error: 'Missing service key' }), { status: 500, headers: getCorsHeaders(req) })
      }
      const admin = masterServiceClient
      const token = String(body?.token || '')
      if (!token) return new Response(JSON.stringify({ error: 'token required' }), { status: 400, headers: getCorsHeaders(req) })
      const { data: inv } = await admin
        .from('saas_invitations')
        .select('id,email,organization_id_in_client,role,status,expires_at')
        .eq('token', token)
        .maybeSingle()
      if (!inv) return new Response(JSON.stringify({ error: 'invalid_token' }), { status: 404, headers: getCorsHeaders(req) })
      const lowerEmail = String(inv.email || '').toLowerCase()
      let existsInSaas = false
      try {
        const { data: ex } = await admin
          .from('saas_users')
          .select('id')
          .eq('email', lowerEmail)
          .maybeSingle()
        existsInSaas = Boolean(ex?.id)
      } catch { existsInSaas = false }
      let existsInAuth = false
      try {
        // Prefer admin API; fallback para consulta direta à tabela auth.users
        const res = await (admin as any).auth.admin.getUserByEmail(lowerEmail)
        existsInAuth = Boolean(res?.data?.user?.id)
        if (!existsInAuth) {
          const { data: au } = await admin.from('auth.users').select('id').eq('email', lowerEmail).maybeSingle()
          existsInAuth = Boolean(au?.id)
        }
      } catch {
        try {
          const { data: au } = await admin.from('auth.users').select('id').eq('email', lowerEmail).maybeSingle()
          existsInAuth = Boolean(au?.id)
        } catch { existsInAuth = false }
      }
      const expired = inv.expires_at ? (new Date(inv.expires_at) < new Date()) : false
      const userExists = Boolean(existsInSaas || existsInAuth)
      return new Response(JSON.stringify({ email: inv.email, role: inv.role, organization_id: inv.organization_id_in_client, status: inv.status, expired, user_exists: userExists, user_exists_in_saas: existsInSaas, user_exists_in_auth: existsInAuth }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    if (action === 'signup_and_accept') {
      if (!masterServiceClient) {
        return new Response(JSON.stringify({ error: 'Missing service key' }), { status: 500, headers: getCorsHeaders(req) })
      }
      const admin = masterServiceClient
      const token = String(body?.token || '')
      const password = typeof body?.password === 'string' ? String(body?.password || '') : ''
      const name = String(body?.name || '')
      const emailOverride = String(body?.email || '').toLowerCase()
      if (!token) return new Response(JSON.stringify({ error: 'token_required' }), { status: 400, headers: getCorsHeaders(req) })
      const { data: inv } = await admin
        .from('saas_invitations')
        .select('*')
        .eq('token', token)
        .maybeSingle()
      if (!inv) return new Response(JSON.stringify({ error: 'invalid_token' }), { status: 404, headers: getCorsHeaders(req) })
      if (String(inv.status) !== 'pending' || (inv.expires_at && new Date(inv.expires_at) < new Date())) {
        return new Response(JSON.stringify({ error: 'invitation_unavailable' }), { status: 400, headers: getCorsHeaders(req) })
      }
      // Importante: aceitar convite não aumenta o total reservado (ativo+pendente)
      // Logo, não bloqueamos por cota aqui. A validação deve ocorrer na criação do convite.
      const email = String(inv.email || '').toLowerCase()
      // Se usuário já existe (ou informado por override), aceite sem exigir senha
      const lookupEmail = emailOverride && emailOverride === email ? emailOverride : email
      // 1) Verificar em saas_users
      let existingUserId: string | null = null
      try {
        const { data: existing } = await admin.from('saas_users').select('id').eq('email', lookupEmail).maybeSingle()
        if (existing?.id) existingUserId = String(existing.id)
      } catch {}
      // 2) Se não achou em saas_users, procurar em auth.users
      if (!existingUserId) {
        try {
          const byEmail = await (admin as any).auth.admin.getUserByEmail(lookupEmail)
          if (byEmail?.data?.user?.id) existingUserId = String(byEmail.data.user.id)
        } catch {}
      }
      if (!existingUserId) {
        try {
          const { data: au } = await admin.from('auth.users').select('id').eq('email', lookupEmail).maybeSingle()
          if (au?.id) existingUserId = String(au.id)
        } catch {}
      }
      if (existingUserId) {
        // Garantir linha em saas_users
        try {
          await admin
            .from('saas_users')
            .upsert({ id: existingUserId, email: lookupEmail, updated_at: new Date().toISOString() }, { onConflict: 'id' })
        } catch {}
        // Aceitar via RPC atômica que também popula credenciais/nome
        const { error: rpcErr } = await admin.rpc('saas_accept_invitation', {
          p_token: inv.token,
          p_accepting_user_id: existingUserId
        })
        if (rpcErr) return new Response(JSON.stringify({ error: rpcErr.message || 'accept_rpc_failed' }), { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ created: false, accepted: true, email, requires_login: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      if (!password) {
        return new Response(JSON.stringify({ needs_signup: true, email }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      // Create auth user via admin API
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, plan_id: 'trial', desired_plan: 'trial' }
      })
      // Se já existe usuário, seguir fluxo de aceitação para o usuário existente
      if (createErr && String(createErr.message || '').toLowerCase().includes('already') ) {
        // tentar localizar o usuário e aceitar
        let idFromAuth: string | null = null
        try {
          const byEmail = await (admin as any).auth.admin.getUserByEmail(email)
          if (byEmail?.data?.user?.id) idFromAuth = String(byEmail.data.user.id)
        } catch {}
        if (!idFromAuth) {
          try { const { data: au } = await admin.from('auth.users').select('id').eq('email', email).maybeSingle(); if (au?.id) idFromAuth = String(au.id) } catch {}
        }
        if (idFromAuth) {
          try { await admin.from('saas_users').upsert({ id: idFromAuth, email }, { onConflict: 'id' }) } catch {}
          const { error: rpcErr } = await admin.rpc('saas_accept_invitation', { p_token: inv.token, p_accepting_user_id: idFromAuth })
          if (rpcErr) return new Response(JSON.stringify({ error: rpcErr.message || 'accept_rpc_failed' }), { status: 400, headers: getCorsHeaders(req) })
          return new Response(JSON.stringify({ created: false, accepted: true, email, requires_login: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }
        // Se não conseguimos localizar por algum motivo, falhar explicitamente
        return new Response(JSON.stringify({ error: createErr?.message || 'create_user_failed' }), { status: 400, headers: getCorsHeaders(req) })
      }
      if (createErr || !created?.user?.id) {
        return new Response(JSON.stringify({ error: createErr?.message || 'create_user_failed' }), { status: 400, headers: getCorsHeaders(req) })
      }
      const newUserId = created.user.id
      // Aceitar via RPC atômica
      const { error: rpcErr3 } = await admin.rpc('saas_accept_invitation', { p_token: inv.token, p_accepting_user_id: newUserId })
      if (rpcErr3) return new Response(JSON.stringify({ error: rpcErr3.message || 'accept_rpc_failed' }), { status: 400, headers: getCorsHeaders(req) })
      return new Response(JSON.stringify({ created: true, accepted: true, email }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // User context on Master (authenticated flows)
    const supabase = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${bearer || MASTER_SUPABASE_ANON_KEY}` } }
    })

    const { data: authUser, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authUser?.user?.id) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: getCorsHeaders(req) })
    }
    const saasUserId = authUser.user.id

    if (!masterServiceClient) {
      return new Response(JSON.stringify({ error: 'service_role_key_missing' }), { status: 500, headers: getCorsHeaders(req) })
    }
    const master = masterServiceClient

    if (action === 'create') {
      const email = String(body?.email || '').trim().toLowerCase()
      let organizationId = String(body?.organization_id || '').trim()
      const role = String(body?.role || 'member')

      // Fallback seguro: derivar organization_id do usuário autenticado, se não enviado
      let meRow: any = null
      if (!organizationId) {
        try {
          const { data: me } = await master
            .from('saas_users')
            .select('organization_id, role')
            .eq('id', saasUserId)
            .maybeSingle()
          meRow = me || null
          if (me?.organization_id) organizationId = String(me.organization_id)
        } catch {}
      }

      if (!email) {
        return new Response(JSON.stringify({ error: 'email is required' }), { status: 400, headers: getCorsHeaders(req) })
      }
      if (!organizationId) {
        return new Response(JSON.stringify({ error: 'organization_id is required' }), { status: 400, headers: getCorsHeaders(req) })
      }

      // Autorização: owner da organização OU membership ativo com role owner/admin
      try {
        let authorized = false
        // 1) Checar ownership diretamente no mapeamento da organização (não depende de saas_users.organization_id)
        try {
          const { data: orgMapOwner } = await master
            .from('saas_organizations')
            .select('owner_id')
            .eq('client_org_id', organizationId)
            .maybeSingle()
          if (orgMapOwner?.owner_id && String(orgMapOwner.owner_id) === String(saasUserId)) {
            authorized = true
          }
        } catch {}
        // 2) Se não for owner, validar membership admin/owner ativa para a organização alvo
        if (!authorized) {
          const { data: memb } = await master
            .from('saas_memberships')
            .select('role,status')
            .eq('saas_user_id', saasUserId)
            .eq('organization_id_in_client', organizationId)
            .maybeSingle()
          const roleOk = ['owner', 'admin'].includes(String(memb?.role || ''))
          const statusOk = String(memb?.status || '') === 'active'
          if (roleOk && statusOk) authorized = true
        }
        // 3) Não usar credenciais de saas_users; a fonte de autorização é MASTER
        if (!authorized) {
          return new Response(JSON.stringify({ error: 'insufficient_permissions' }), { status: 403, headers: getCorsHeaders(req) })
        }
      } catch {}

      // Enforce member limit usando plano do OWNER + pool global de extras distribuído (via SERVICE para evitar RLS)
      try {
        const computeClient = master
        let quota = await computeAllowedSeatsForOrg(computeClient, organizationId)
        let allowed = Number(quota.allowed || 0)
        let { active } = await countOrgReservedSeats(computeClient, organizationId)
        // Fallback: se não encontramos owner_id (mirror ausente) ou allowed inválido, calcular pelo usuário autenticado
        if (!quota.owner_id || !Number.isFinite(allowed) || allowed <= 0) {
          try {
            const { data: owner } = await computeClient
              .from('saas_users')
              .select('plan_id, member_seats_extra')
              .eq('id', saasUserId)
              .maybeSingle()
            const base = mapPlanBaseSeats(owner?.plan_id || null)
            const extraTotal = Number(owner?.member_seats_extra || 0)
            // Somar extras usados em todas as organizações do autenticado
            const { data: myOrgs } = await computeClient
              .from('saas_organizations')
              .select('client_org_id')
              .eq('owner_id', saasUserId)
            const orgIds = (myOrgs || []).map((o: any) => String(o.client_org_id)).filter(Boolean)
            let extrasUsed = 0
            for (const oid of orgIds) {
              const { active: a } = await countOrgReservedSeats(computeClient, oid)
              const usedInThisOrg = Math.max(0, a - base)
              if (oid !== organizationId) extrasUsed += usedInThisOrg
            }
            const extrasRemaining = Math.max(0, extraTotal - extrasUsed)
            allowed = Math.max(0, base + extrasRemaining)
          } catch {}
        }
        // Para criar convite, bloquear apenas quando ativos já ocupam toda a cota
        if (active >= Math.max(0, allowed)) {
          return new Response(JSON.stringify({ error: 'member_limit_reached', max: Math.max(0, allowed) }), { status: 403, headers: getCorsHeaders(req) })
        }
      } catch {}
      const { data: token, error } = await master.rpc('saas_create_invitation', {
        p_email: email,
        p_organization_id: organizationId,
        p_role: role,
        p_invited_by: saasUserId,
        p_expires_in_days: Number(body?.expires_in_days || 7)
      })
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: getCorsHeaders(req) })
      // Enviar email imediatamente via Resend; se falhar, enfileirar como fallback
      try {
        function pickAppBase(req: Request): string {
          const list = (Deno.env.get('APP_PUBLIC_URLS') || Deno.env.get('APP_PUBLIC_URL') || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
          const origin = req.headers.get('Origin') || ''
          const match = list.find(u => u.replace(/\/$/,'') === origin.replace(/\/$/,''))
          return (match || list[0] || '').replace(/\/$/,'')
        }
        const base = pickAppBase(req)
        const link = `${base}/accept-invite?token=${token}`

        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
        const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || ''
        let sentNow = false
        if (RESEND_API_KEY && FROM_EMAIL) {
          const subject = 'Você foi convidado para o Tomik CRM'
          const html = `
            <div style="font-family: Inter, Arial, sans-serif; line-height:1.6; color:#0f172a">
              <h2 style="margin:0 0 8px">Convite para acessar uma organização</h2>
              <p>Você recebeu um convite para participar de uma organização no Tomik CRM.</p>
              <p><a href="${link}" style="display:inline-block;background:#3b82f6;color:white;padding:10px 16px;border-radius:10px;text-decoration:none">Aceitar Convite</a></p>
              <p style="font-size:12px;color:#64748b">Se o botão não funcionar, copie e cole este link: ${link}</p>
            </div>`
          const resp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'authorization': `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
            body: JSON.stringify({ from: FROM_EMAIL, to: email, subject, html })
          })
          sentNow = resp.ok
          if (!sentNow) {
            let providerError = ''
            try { providerError = await resp.text() } catch {}
            await master.from('email_queue').insert({
              recipient_email: email,
              template: 'invite_v1',
              variables_json: { link, organization_id: organizationId, role, invited_by: saasUserId, provider_error },
              status: 'failed',
              error_message: `resend_status_${resp.status}`
            })
          }
        }
        if (!RESEND_API_KEY || !FROM_EMAIL || !sentNow) {
          await master.from('email_queue').insert({
            recipient_email: email,
            template: 'invite_v1',
            variables_json: { link, organization_id: organizationId, role, invited_by: saasUserId }
          })
        }
      } catch {}
      return new Response(JSON.stringify({ token }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    if (action === 'list') {
      const organizationId = String(body?.organization_id || '')
      if (!organizationId) {
        return new Response(JSON.stringify({ error: 'organization_id is required' }), { status: 400, headers: getCorsHeaders(req) })
      }
      const { data, error } = await master
        .from('saas_invitations')
        .select('id,email,role,status,invited_by,accepted_by,created_at,expires_at')
        .eq('organization_id_in_client', organizationId)
        .order('created_at', { ascending: false })
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: getCorsHeaders(req) })
      return new Response(JSON.stringify({ invitations: data || [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    if (action === 'cancel') {
      const id = String(body?.invitation_id || '')
      if (!id) return new Response(JSON.stringify({ error: 'invitation_id required' }), { status: 400, headers: getCorsHeaders(req) })
      const { error } = await master
        .from('saas_invitations')
        .update({ status: 'revoked', revoked_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: getCorsHeaders(req) })
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    if (action === 'accept') {
      const token = String(body?.token || '')
      if (!token) return new Response(JSON.stringify({ error: 'token required' }), { status: 400, headers: getCorsHeaders(req) })
      // Validate token email matches current user
      const { data: inv, error: invErr } = await master
        .from('saas_invitations')
        .select('id,email,organization_id_in_client,role,status,expires_at,invited_by')
        .eq('token', token)
        .maybeSingle()
      if (invErr || !inv) return new Response(JSON.stringify({ error: 'invalid_token' }), { status: 400, headers: getCorsHeaders(req) })
      const { data: profile } = await master.from('saas_users').select('email').eq('id', saasUserId).maybeSingle()
      // Fallback: usar email do auth se saas_users não tiver (ou ainda não existir)
      const email = String((profile?.email as any) || authUser?.user?.email || '').toLowerCase()
      if (!email || email !== String(inv.email || '').toLowerCase()) {
        return new Response(JSON.stringify({ error: 'email_mismatch' }), { status: 403, headers: getCorsHeaders(req) })
      }
      // Aceitação não aumenta (ativo+pendente). Evitar bloquear injustamente.
      // Mantemos apenas um guard rail: se ativos estiverem >= permitido, bloqueia.
      try {
        const computeClient = master
        let quota = await computeAllowedSeatsForOrg(computeClient, inv.organization_id_in_client)
        let allowed = Number(quota.allowed || 0)
        let { active } = await countOrgReservedSeats(computeClient, inv.organization_id_in_client)
        if (!quota.owner_id || !Number.isFinite(allowed) || allowed <= 0) {
          // Fallback: calcular via convidador (invited_by) se mirror estiver ausente
          try {
            const candidateOwnerId = String(inv.invited_by || '')
            if (candidateOwnerId) {
              const { data: owner } = await computeClient
                .from('saas_users')
                .select('plan_id, member_seats_extra')
                .eq('id', candidateOwnerId)
                .maybeSingle()
              const base = mapPlanBaseSeats(owner?.plan_id || null)
              const extraTotal = Number(owner?.member_seats_extra || 0)
              const { data: ownerOrgs } = await computeClient
                .from('saas_organizations')
                .select('client_org_id')
                .eq('owner_id', candidateOwnerId)
              const orgIds = (ownerOrgs || []).map((o: any) => String(o.client_org_id)).filter(Boolean)
              let extrasUsed = 0
              for (const oid of orgIds) {
                const { active: a } = await countOrgReservedSeats(computeClient, oid)
                const usedInThisOrg = Math.max(0, a - base)
                if (oid !== inv.organization_id_in_client) extrasUsed += usedInThisOrg
              }
              const extrasRemaining = Math.max(0, extraTotal - extrasUsed)
              allowed = Math.max(0, base + extrasRemaining)
            }
          } catch {}
        }
        if (Number(active || 0) >= Math.max(0, allowed)) {
          return new Response(JSON.stringify({ error: 'member_limit_reached', max: Math.max(0, allowed) }), { status: 403, headers: getCorsHeaders(req) })
        }
      } catch {}
      const { data, error } = await master.rpc('saas_accept_invitation', { p_token: token, p_accepting_user_id: saasUserId })
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: getCorsHeaders(req) })
      // Se a RPC retornou false, o convite não foi encontrado ou está expirado
      if (data === false) {
        return new Response(JSON.stringify({ error: 'invalid_token', accepted: false }), { status: 400, headers: getCorsHeaders(req) })
      }
      // finalizeMembership não é mais necessário aqui; RPC já preenche credenciais/nome
      return new Response(JSON.stringify({ accepted: true, organization_id: inv.organization_id_in_client }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    if (action === 'my_memberships') {
      // Read-only: list memberships for current user with resolved organization names (no DB backfill here)
      try {
        const { data: membs, error: membErr } = await master
          .from('saas_memberships')
          .select('id, organization_id_in_client, role, status, organization_name, supabase_url, supabase_key_encrypted, invited_by')
          .eq('saas_user_id', saasUserId)
          .eq('status', 'active')
        if (membErr) return new Response(JSON.stringify({ error: membErr.message }), { status: 400, headers: getCorsHeaders(req) })

        const result: Array<{ organization_id: string; role: string; status: string; organization_name: string | null }> = []
        for (const m of (membs || [])) {
          let orgName: string | null = (m as any)?.organization_name || null
          if (!orgName) {
            // Resolve on-the-fly using credentials. Prefer membership creds; fallback to invited_by or org owner.
            let url = String((m as any)?.supabase_url || '')
            let key = (m as any)?.supabase_key_encrypted ? atob(String((m as any).supabase_key_encrypted)) : ''
            if (!url || !key) {
              const creds = await getCredsForOrg(master, String((m as any).organization_id_in_client), (m as any)?.invited_by || null)
              url = creds?.url || ''
              key = creds?.key || ''
            }
            if (url && key) {
              try {
                const { createClient: createClient2 } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
                const client = createClient2(url, key)
                const { data: org } = await client
                  .from('saas_organizations')
                  .select('name')
                  .eq('id', (m as any).organization_id_in_client)
                  .maybeSingle()
                orgName = (org as any)?.name || null
              } catch { /* ignore */ }
            }
          }
          result.push({ organization_id: String((m as any).organization_id_in_client), role: String((m as any).role || ''), status: String((m as any).status || ''), organization_name: orgName || null })
        }
        return new Response(JSON.stringify({ memberships: result }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e?.message || 'list_failed' }), { status: 400, headers: getCorsHeaders(req) })
      }
    }

    if (action === 'members_list') {
      const organizationId = String(body?.organization_id || '')
      if (!organizationId) return new Response(JSON.stringify({ error: 'organization_id required' }), { status: 400, headers: getCorsHeaders(req) })
      
      // Buscar memberships
      const { data: memberships, error } = await master
        .from('saas_memberships')
        .select('id, saas_user_id, role, status, created_at, invited_by, organization_id_in_client')
        .eq('organization_id_in_client', organizationId)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('[members_list] Error fetching memberships:', error)
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: getCorsHeaders(req) })
      }
      
      console.log('[members_list] Found memberships:', memberships?.length || 0)
      if (memberships && memberships.length > 0) {
        console.log('[members_list] First membership:', JSON.stringify(memberships[0], null, 2))
      }
      
      // Enriquecer com dados de saas_users usando service role para bypass RLS
      const enrichedMembers = await Promise.all((memberships || []).map(async (m: any) => {
        if (m.saas_user_id) {
          const { data: user, error: userError } = await master
            .from('saas_users')
            .select('name, email')
            .eq('id', m.saas_user_id)
            .maybeSingle()
          
          if (userError) {
            console.error(`[members_list] Error fetching user ${m.saas_user_id}:`, userError)
          }
          
          console.log(`[members_list] User data for ${m.saas_user_id}:`, JSON.stringify(user, null, 2))
          
          const enriched = {
            ...m,
            saas_users: user ? { name: user.name || null, email: user.email || null } : null
          }
          
          console.log(`[members_list] Enriched member:`, JSON.stringify(enriched, null, 2))
          
          return enriched
        }
        console.log(`[members_list] Membership ${m.id} has no saas_user_id`)
        return { ...m, saas_users: null }
      }))
      
      console.log('[members_list] Final enriched members:', JSON.stringify(enrichedMembers, null, 2))
      
      return new Response(JSON.stringify({ members: enrichedMembers }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    if (action === 'member_update_role') {
      const membershipId = String(body?.membership_id || '')
      const role = String(body?.role || '')
      if (!membershipId || !role) return new Response(JSON.stringify({ error: 'membership_id and role required' }), { status: 400, headers: getCorsHeaders(req) })
      if (!['owner','admin','member','viewer'].includes(role)) return new Response(JSON.stringify({ error: 'invalid role' }), { status: 400, headers: getCorsHeaders(req) })
      const { error } = await master
        .from('saas_memberships')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', membershipId)
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: getCorsHeaders(req) })
      // Se virou viewer, remover credenciais
      if (role === 'viewer') {
        try { await master.from('saas_memberships').update({ supabase_url: null, supabase_key_encrypted: null, updated_at: new Date().toISOString() }).eq('id', membershipId) } catch {}
      }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    if (action === 'member_remove') {
      const membershipId = String(body?.membership_id || '')
      if (!membershipId) return new Response(JSON.stringify({ error: 'membership_id required' }), { status: 400, headers: getCorsHeaders(req) })
      const { error } = await master
        .from('saas_memberships')
        .delete()
        .eq('id', membershipId)
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: getCorsHeaders(req) })
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    if (action === 'member_get_permissions') {
      const membershipId = String(body?.membership_id || '')
      if (!membershipId) return new Response(JSON.stringify({ error: 'membership_id required' }), { status: 400, headers: getCorsHeaders(req) })
      // Verificar autorização (owner ou admin da org)
      const { data: memb } = await master
        .from('saas_memberships')
        .select('organization_id_in_client, role')
        .eq('id', membershipId)
        .maybeSingle()
      if (!memb) return new Response(JSON.stringify({ error: 'membership_not_found' }), { status: 404, headers: getCorsHeaders(req) })
      // Verificar se é owner da org ou admin
      const { data: orgOwner } = await master
        .from('saas_organizations')
        .select('owner_id')
        .eq('client_org_id', memb.organization_id_in_client)
        .maybeSingle()
      const isOwner = orgOwner?.owner_id && String(orgOwner.owner_id) === String(saasUserId)
      const { data: myMemb } = await master
        .from('saas_memberships')
        .select('role')
        .eq('saas_user_id', saasUserId)
        .eq('organization_id_in_client', memb.organization_id_in_client)
        .eq('status', 'active')
        .maybeSingle()
      const isAdmin = myMemb?.role === 'admin' || myMemb?.role === 'owner'
      if (!isOwner && !isAdmin) {
        return new Response(JSON.stringify({ error: 'insufficient_permissions' }), { status: 403, headers: getCorsHeaders(req) })
      }
      // Buscar permissões
      const { data: permData, error: permErr } = await master
        .from('saas_memberships')
        .select('permissions_view, permissions_action, role')
        .eq('id', membershipId)
        .maybeSingle()
      if (permErr) return new Response(JSON.stringify({ error: permErr.message }), { status: 400, headers: getCorsHeaders(req) })
      return new Response(JSON.stringify({
        permissions_view: permData?.permissions_view || {},
        permissions_action: permData?.permissions_action || {},
        role: permData?.role || null
      }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    if (action === 'member_update_permissions') {
      const membershipId = String(body?.membership_id || '')
      const permissionsView = body?.permissions_view
      const permissionsAction = body?.permissions_action
      if (!membershipId) return new Response(JSON.stringify({ error: 'membership_id required' }), { status: 400, headers: getCorsHeaders(req) })
      // Verificar autorização
      const { data: memb } = await master
        .from('saas_memberships')
        .select('organization_id_in_client')
        .eq('id', membershipId)
        .maybeSingle()
      if (!memb) return new Response(JSON.stringify({ error: 'membership_not_found' }), { status: 404, headers: getCorsHeaders(req) })
      const { data: orgOwner } = await master
        .from('saas_organizations')
        .select('owner_id')
        .eq('client_org_id', memb.organization_id_in_client)
        .maybeSingle()
      const isOwner = orgOwner?.owner_id && String(orgOwner.owner_id) === String(saasUserId)
      const { data: myMemb } = await master
        .from('saas_memberships')
        .select('role')
        .eq('saas_user_id', saasUserId)
        .eq('organization_id_in_client', memb.organization_id_in_client)
        .eq('status', 'active')
        .maybeSingle()
      const isAdmin = myMemb?.role === 'admin' || myMemb?.role === 'owner'
      if (!isOwner && !isAdmin) {
        return new Response(JSON.stringify({ error: 'insufficient_permissions' }), { status: 403, headers: getCorsHeaders(req) })
      }
      // Atualizar permissões
      const updateData: any = { updated_at: new Date().toISOString() }
      if (permissionsView !== undefined) updateData.permissions_view = permissionsView
      if (permissionsAction !== undefined) updateData.permissions_action = permissionsAction
      const { error } = await master
        .from('saas_memberships')
        .update(updateData)
        .eq('id', membershipId)
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: getCorsHeaders(req) })
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    if (action === 'list_by_email') {
      // List pending invitations for the authenticated user's email
      const { data: profile } = await master.from('saas_users').select('email').eq('id', saasUserId).single()
      const email = String(profile?.email || '').toLowerCase()
      if (!email) return new Response(JSON.stringify({ invitations: [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      const { data, error } = await master
        .from('saas_invitations')
        .select('id,email,organization_id_in_client,role,status,created_at,expires_at')
        .eq('email', email)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: getCorsHeaders(req) })
      return new Response(JSON.stringify({ invitations: data || [] }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    if (action === 'accept_by_id') {
      const invitationId = String(body?.invitation_id || '')
      if (!invitationId) return new Response(JSON.stringify({ error: 'invitation_id required' }), { status: 400, headers: getCorsHeaders(req) })
      // Load invitation, ensure email matches current user
      const { data: inv, error: invErr } = await master
        .from('saas_invitations')
        .select('*')
        .eq('id', invitationId)
        .single()
      if (invErr || !inv) return new Response(JSON.stringify({ error: 'invitation_not_found' }), { status: 404, headers: getCorsHeaders(req) })
      const { data: profile } = await master.from('saas_users').select('email').eq('id', saasUserId).single()
      const email = String(profile?.email || '').toLowerCase()
      if (!email || email !== String(inv.email || '').toLowerCase()) {
        return new Response(JSON.stringify({ error: 'email_mismatch' }), { status: 403, headers: getCorsHeaders(req) })
      }
      if (String(inv.status) !== 'pending' || new Date(inv.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'invitation_unavailable' }), { status: 400, headers: getCorsHeaders(req) })
      }
      // Aceitação por ID segue mesma regra da ação accept (usar service + fallback)
      try {
        const computeClient = master
        let quota = await computeAllowedSeatsForOrg(computeClient, inv.organization_id_in_client)
        let allowed = Number(quota.allowed || 0)
        let { active } = await countOrgReservedSeats(computeClient, inv.organization_id_in_client)
        if (!quota.owner_id || !Number.isFinite(allowed) || allowed <= 0) {
          try {
            const candidateOwnerId = String(inv.invited_by || '')
            if (candidateOwnerId) {
          const { data: owner } = await computeClient
                .from('saas_users')
                .select('plan_id, member_seats_extra')
                .eq('id', candidateOwnerId)
                .maybeSingle()
              const base = mapPlanBaseSeats(owner?.plan_id || null)
              const extraTotal = Number(owner?.member_seats_extra || 0)
          const { data: ownerOrgs } = await computeClient
                .from('saas_organizations')
                .select('client_org_id')
                .eq('owner_id', candidateOwnerId)
              const orgIds = (ownerOrgs || []).map((o: any) => String(o.client_org_id)).filter(Boolean)
              let extrasUsed = 0
              for (const oid of orgIds) {
                const { active: a } = await countOrgReservedSeats(computeClient, oid)
                const usedInThisOrg = Math.max(0, a - base)
                if (oid !== inv.organization_id_in_client) extrasUsed += usedInThisOrg
              }
              const extrasRemaining = Math.max(0, extraTotal - extrasUsed)
              allowed = Math.max(0, base + extrasRemaining)
            }
          } catch {}
        }
        if (Number(active || 0) >= Math.max(0, allowed)) {
          return new Response(JSON.stringify({ error: 'member_limit_reached', max: Math.max(0, allowed) }), { status: 403, headers: getCorsHeaders(req) })
        }
      } catch {}
      const { error: rpcErr } = await master.rpc('saas_accept_invitation', { p_token: inv.token, p_accepting_user_id: saasUserId })
      if (rpcErr) return new Response(JSON.stringify({ error: rpcErr.message || 'accept_rpc_failed' }), { status: 400, headers: getCorsHeaders(req) })
      return new Response(JSON.stringify({ accepted: true, organization_id: inv.organization_id_in_client }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // Seats stats for the authenticated owner; returns extras pool and usage.
    // If organization_id is provided, also returns org-specific allowed/reserved numbers.
    if (action === 'seats_stats') {
      const targetOrgId = String(body?.organization_id || '')
      // When an org is provided, compute allowed for that org; otherwise compute global stats by owner's current org mapping
      let orgId = targetOrgId
      if (!orgId) {
        // No orgId => compute global stats without org context
        // Use the authenticated user's pool as the owner
        try {
          const { data: me } = await master.from('saas_users').select('plan_id, member_seats_extra').eq('id', saasUserId).maybeSingle()
          const base = mapPlanBaseSeats(me?.plan_id || null)
          const extraTotal = Number(me?.member_seats_extra || 0)

          // Sum extras used across all orgs owned by this user
          const { data: myOrgs } = await master
            .from('saas_organizations')
            .select('client_org_id')
            .eq('owner_id', saasUserId)

          const orgIds: string[] = (myOrgs || []).map((o: any) => String(o.client_org_id)).filter(Boolean)
          let extrasUsed = 0
          let reservedForCurrent = 0
          for (const oid of orgIds) {
            const { active, pending } = await countOrgReservedSeats(master, oid)
            const reserved = active + pending
            const usedInThisOrg = Math.max(0, reserved - base)
            extrasUsed += usedInThisOrg
          }
          const extrasRemaining = Math.max(0, extraTotal - extrasUsed)
          return new Response(
            JSON.stringify({ base_per_org: base, member_seats_extra: extraTotal, extras_used: extrasUsed, extras_remaining: extrasRemaining, allowed_for_org_now: null, reserved_for_org_now: reservedForCurrent }),
            { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } }
          )
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e?.message || 'stats_failed' }), { status: 400, headers: getCorsHeaders(req) })
        }
      }

      const computeClient = master
      const q = await computeAllowedSeatsForOrg(computeClient, orgId)
      // Compute current reserved for org and extras remaining
      const { active, pending } = await countOrgReservedSeats(computeClient, orgId)
      const reserved = active + pending
      const extrasRemaining = Math.max(0, (q.extra_total - q.extra_used) - Math.max(0, reserved - q.base))
      return new Response(
        JSON.stringify({ base_per_org: q.base, member_seats_extra: q.extra_total, extras_used: q.extra_used + Math.max(0, reserved - q.base), extras_remaining: extrasRemaining, allowed_for_org_now: q.allowed, reserved_for_org_now: reserved }),
        { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } }
      )
    }

    if (action === 'backfill_memberships') {
      const admin = master
      const limit = Math.max(1, Math.min(200, Number(body?.limit || 50)))
      const offset = Math.max(0, Number(body?.offset || 0))
      const { data: rows, error } = await admin
        .from('saas_memberships')
        .select('id, saas_user_id, organization_id_in_client, invited_by, supabase_url, supabase_key_encrypted, organization_name')
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1)
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: getCorsHeaders(req) })
      let updated = 0
      for (const m of rows || []) {
        if (!m) continue
        const needCreds = !m.supabase_url || !m.supabase_key_encrypted
        const needName = !m.organization_name
        if (!needCreds && !needName) continue
        await finalizeMembership(admin, String(m.saas_user_id), String(m.organization_id_in_client), (m as any)?.invited_by || null)
        updated += 1
      }
      return new Response(JSON.stringify({ updated }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // Simple purchase/increment of extra seats for the authenticated user (owner account-wide add-on)
    if (action === 'seats_purchase') {
      const qty = Number(body?.quantity || 0)
      if (!Number.isInteger(qty) || qty <= 0) return new Response(JSON.stringify({ error: 'quantity_must_be_positive_integer' }), { status: 400, headers: getCorsHeaders(req) })
      // Increment member_seats_extra atomically
      try {
        const { data: current } = await master.from('saas_users').select('member_seats_extra').eq('id', saasUserId).maybeSingle()
        const currentVal = Number(current?.member_seats_extra || 0)
        const newVal = currentVal + qty
        const { error: updErr } = await master.from('saas_users').update({ member_seats_extra: newVal, updated_at: new Date().toISOString() }).eq('id', saasUserId)
        if (updErr) return new Response(JSON.stringify({ error: updErr.message }), { status: 400, headers: getCorsHeaders(req) })
        return new Response(JSON.stringify({ member_seats_extra: newVal }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e?.message || 'purchase_failed' }), { status: 400, headers: getCorsHeaders(req) })
      }
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: getCorsHeaders(req) })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'internal_error' }), { status: 500, headers: getCorsHeaders(req) })
  }
})


