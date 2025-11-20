// @ts-nocheck
/* eslint-disable */
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

function cleanBase64(str: string) {
  let s = (str || '').toString().trim().replace(/\s+/g, '')
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4 !== 0) s += '='
  return s
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback: simple UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// Edge Function timeout: Supabase Edge Functions têm timeout padrão de 60s (free) a 300s (paid)
// Para migrações grandes, considere aumentar o timeout do projeto ou dividir em lotes menores
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || ''
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''

    const MASTER_URL = Deno.env.get('SUPABASE_URL')!
    const MASTER_ANON = Deno.env.get('SUPABASE_ANON_KEY')!
    const MASTER_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')

    // Auth user via anon+Bearer
    const authClient = createClient(MASTER_URL, MASTER_ANON, { global: { headers: { Authorization: `Bearer ${bearer || MASTER_ANON}` } } })
    const { data: userData, error: userErr } = await authClient.auth.getUser()
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }
    const saasUserId = userData.user.id

    const master = createClient(MASTER_URL, MASTER_SERVICE)
    const payload = await req.json().catch(() => ({})) as any

    async function getClientCredsByUser(userId: string) {
      const { data, error } = await master
        .from('saas_users')
        .select('supabase_url, supabase_key_encrypted, organization_id, plan_id')
        .eq('id', userId)
        .single()
      if (error || !data?.supabase_url || !data?.supabase_key_encrypted) return null
      let key = ''
      try { key = atob(cleanBase64(data.supabase_key_encrypted)) } catch { return null }
      return { url: data.supabase_url, key, organization_id: data.organization_id, plan_id: data.plan_id }
    }

    async function getClientCredsByOrg(userId: string, orgId: string) {
      // Prefer organization-scoped credentials stored in master.saas_organizations (owner_id, client_org_id)
      // IMPORTANTE: Sempre filtrar por owner_id para evitar conflitos quando múltiplos usuários
      // compartilham o mesmo Supabase (projetos de teste)
      try {
        // Primeiro tenta por client_org_id + owner_id (caso mais comum)
        let org = null
        const { data: orgByClientId } = await master
          .from('saas_organizations')
          .select('client_supabase_url, client_anon_key_encrypted, owner_id, id')
          .eq('client_org_id', orgId)
          .eq('owner_id', userId)
          .maybeSingle()
        if (orgByClientId) {
          org = orgByClientId
        } else {
          // Se não encontrou por client_org_id, tenta por id (UUID) + owner_id
          // Isso garante que mesmo se houver múltiplas organizações com mesmo client_org_id
          // (diferentes owners), só retorna a do owner correto
          const { data: orgById } = await master
            .from('saas_organizations')
            .select('client_supabase_url, client_anon_key_encrypted, owner_id, id')
            .eq('id', orgId)
            .eq('owner_id', userId)
            .maybeSingle()
          if (orgById) {
            org = orgById
          }
        }
        const url = (org as any)?.client_supabase_url || ''
        const enc = (org as any)?.client_anon_key_encrypted || ''
        // 🔐 Tentar descriptografar (pode ser criptografado ou base64 legacy)
        let key = ''
        if (enc) {
          try {
            const { data: decrypted } = await master.rpc('decrypt_key', { ciphertext: enc })
            key = decrypted || ''
          } catch (_e) {
            // Fallback para base64 se não conseguir descriptografar (legacy)
            try { key = atob(cleanBase64(enc)) } catch {}
          }
        }
        if (url && key) return { url, key }
      } catch { /* ignore */ }
      return null
    }

    async function getClientAdminCredsByOrg(userId: string, orgOrClientOrgId: string) {
      // Try organization-scoped service role first
      try {
        const { data: org } = await master
          .from('saas_organizations')
          .select('client_supabase_url, client_service_key_encrypted, owner_id, client_org_id, id')
          .or(`client_org_id.eq.${orgOrClientOrgId},id.eq.${orgOrClientOrgId}`)
          .eq('owner_id', userId)
          .maybeSingle()
        const url = (org as any)?.client_supabase_url || ''
        const encSrv = (org as any)?.client_service_key_encrypted || ''
        // 🔐 Tentar descriptografar (pode ser criptografado ou base64 legacy)
        let srv = ''
        if (encSrv) {
          try {
            const { data: decrypted } = await master.rpc('decrypt_key', { ciphertext: encSrv })
            srv = decrypted || ''
          } catch (_e) {
            // Fallback para base64 se não conseguir descriptografar (legacy)
            try { srv = atob(cleanBase64(encSrv)) } catch {}
          }
        }
        if (url && srv) return { url, key: srv }
      } catch { /* ignore */ }
      // Fallback: user-level service role (legacy)
      try {
        const { data } = await master
          .from('saas_users')
          .select('supabase_url, service_role_encrypted')
          .eq('id', userId)
          .maybeSingle()
        const url = (data as any)?.supabase_url || ''
        const encSrv = (data as any)?.service_role_encrypted || ''
        const srv = encSrv ? atob(cleanBase64(encSrv)) : ''
        if (url && srv) return { url, key: srv }
      } catch { /* ignore */ }
      // Fallback: latest connection from repository (owner-scoped) — SERVICE ROLE ONLY
      try {
        const { data: rows } = await master
          .from('saas_supabases_connections')
          .select('supabase_url, service_role_encrypted, updated_at')
          .eq('owner_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1)
        const conn = (rows || [])[0]
        if (conn?.supabase_url) {
          const url = String(conn.supabase_url)
          const encSrv = String(conn.service_role_encrypted || '')
          if (encSrv) {
            try { const srv = atob(cleanBase64(encSrv)); if (srv) return { url, key: srv } } catch {}
          }
        }
      } catch { /* ignore */ }
      return null
    }

    async function getClientForUser(userId: string, orgId?: string | null) {
      const creds = orgId ? await getClientCredsByOrg(userId, orgId) : await getClientCredsByUser(userId)
      if (!creds) {
        // Repository fallback (anon key)
        try {
          const { data: rows } = await master
            .from('saas_supabases_connections')
            .select('supabase_url, anon_key_encrypted, updated_at')
            .eq('owner_id', userId)
            .order('updated_at', { ascending: false })
            .limit(1)
          const conn = (rows || [])[0]
          if (conn?.supabase_url && conn?.anon_key_encrypted) {
            const url = String(conn.supabase_url)
            let key = ''
            try { key = atob(cleanBase64(String(conn.anon_key_encrypted))) } catch {}
            if (url && key) return createClient(url, key)
          }
        } catch { /* ignore */ }
        return null
      }
      try { return createClient(creds.url, creds.key) } catch { return null }
    }

    async function getClientAdminForUser(userId: string, orgOrClientOrgId?: string | null) {
      const creds = await getClientAdminCredsByOrg(userId, orgOrClientOrgId || '')
      if (!creds) return null
      try { return createClient(creds.url, creds.key) } catch { return null }
    }

    if (action === 'create') {
      const name = String(payload?.name || payload?.org_name || '')
      const slug = String(payload?.slug || payload?.org_slug || '')
      if (!name || !slug) return new Response(JSON.stringify({ error: 'Missing name/slug' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })

      // Connect to client's Supabase using credentials (prefer per-organization if available)
      const client = await getClientForUser(saasUserId, null)
      if (!client) return new Response(JSON.stringify({ error: 'Client credentials not configured' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })

      // Check duplicate slug
      const { data: existing } = await client.from('saas_organizations').select('id').eq('slug', slug).maybeSingle()
      if (existing?.id) return new Response(JSON.stringify({ error: 'Slug already in use' }), { status: 409, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })

      // Create organization on Client
      const { data: org, error: orgErr } = await client
        .from('saas_organizations')
        .insert({ name, slug, owner_id: saasUserId, plan_type: 'trial', is_active: true })
        .select('*')
        .single()
      if (orgErr) return new Response(JSON.stringify({ error: orgErr.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })

      // Update Master user organization_id via secured RPC (guarded by trigger)
      const { error: updErr } = await master.rpc('update_user_organization', {
        p_user_id: saasUserId,
        p_organization_id: org.id
      })
      if (updErr) return new Response(JSON.stringify({ error: updErr.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })

      // Best-effort: run setup SQL on client
      try { await client.rpc('setup_crm_database') } catch {}

      return new Response(JSON.stringify({ ok: true, org }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    if (action === 'select') {
      const orgId = String(payload?.organization_id || '')
      if (!orgId) return new Response(JSON.stringify({ error: 'Missing organization_id' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })

      // Validate membership OR ownership
      let isAllowed = false
      const { data: memb } = await master
        .from('saas_memberships')
        .select('status')
        .eq('saas_user_id', saasUserId)
        .eq('organization_id_in_client', orgId)
        .maybeSingle()
      if (memb && String(memb.status) === 'active') isAllowed = true
      if (!isAllowed) {
        // Ownership check: pode ser por client_org_id OU por id (UUID da organização no Master)
        // IMPORTANTE: Sempre filtrar por owner_id para evitar conflitos quando múltiplos usuários
        // compartilham o mesmo Supabase (projetos de teste)
        let ownMap = null
        
        // Primeiro tenta por client_org_id + owner_id (caso mais comum e mais seguro)
        const { data: ownMapByClientId } = await master
          .from('saas_organizations')
          .select('owner_id, id, client_org_id')
          .eq('client_org_id', orgId)
          .eq('owner_id', saasUserId)
          .maybeSingle()
        if (ownMapByClientId) {
          ownMap = ownMapByClientId
        } else {
          // Se não encontrou por client_org_id, tenta por id (UUID) + owner_id
          // Isso garante que mesmo se houver múltiplas organizações com mesmo client_org_id
          // (diferentes owners), só retorna a do owner correto
          const { data: ownMapById } = await master
            .from('saas_organizations')
            .select('owner_id, id, client_org_id')
            .eq('id', orgId)
            .eq('owner_id', saasUserId)
            .maybeSingle()
          if (ownMapById) {
            ownMap = ownMapById
          }
        }
        if (ownMap?.owner_id && String(ownMap.owner_id) === String(saasUserId)) isAllowed = true
      }
      if (!isAllowed) return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })

      // Não bloquear seleção por status de ativo; UI pode avisar, mas a autorização já foi checada.

      const { error: updErr } = await master.rpc('update_user_organization', {
        p_user_id: saasUserId,
        p_organization_id: orgId
      })
      if (updErr) return new Response(JSON.stringify({ error: updErr.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // Lightweight status endpoint to check whether an org is active on MASTER
    if (action === 'status') {
      const orgId = String(payload?.organization_id || '')
      if (orgId) {
        // Sempre filtrar por owner_id para evitar conflitos quando múltiplos usuários compartilham o mesmo Supabase
        let orgData = null
        const { data: dataByClientId } = await master
          .from('saas_organizations')
          .select('client_org_id, active, owner_id')
          .eq('client_org_id', orgId)
          .eq('owner_id', saasUserId)
          .maybeSingle()
        if (dataByClientId) {
          orgData = dataByClientId
        } else {
          // Se não encontrou por client_org_id, tenta por id (UUID) + owner_id
          const { data: dataById } = await master
            .from('saas_organizations')
            .select('client_org_id, active, owner_id')
            .eq('id', orgId)
            .eq('owner_id', saasUserId)
            .maybeSingle()
          if (dataById) {
            orgData = dataById
          }
        }
        const active = orgData ? Boolean(orgData.active) : true
        return new Response(JSON.stringify({ organization_id: orgId, active }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      // No org provided: return map of statuses for user's owner orgs (if any)
      const { data: rows } = await master
        .from('saas_organizations')
        .select('client_org_id, active')
        .eq('owner_id', saasUserId)
      const statuses: Record<string, boolean> = {}
      for (const r of (rows || [])) {
        if (r?.client_org_id) statuses[String(r.client_org_id)] = Boolean(r.active)
      }
      return new Response(JSON.stringify({ statuses }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // List client-side organizations for the current user's client Supabase
    if (action === 'list_client_orgs') {
      const client = await getClientAdminForUser(saasUserId, null) || await getClientForUser(saasUserId, null)
      if (!client) return new Response(JSON.stringify({ ok: false, error: 'Client credentials not configured' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      const { data, error } = await client.from('saas_organizations').select('id, name, slug, owner_id, is_active').order('created_at', { ascending: false })
      if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      return new Response(JSON.stringify({ ok: true, organizations: data || [] }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // List organizations safely (without exposing keys)
    if (action === 'list' || action === 'list_safe') {
      // Use the safe function that never exposes keys
      const { data: orgs, error: listErr } = await master.rpc('get_organizations_safe', {
        p_user_id: saasUserId
      })
      if (listErr) {
        // Fallback: manual query without sensitive fields
        const { data: owned, error: fallbackErr } = await master
          .from('saas_organizations')
          .select('id, client_org_id, name, slug, client_supabase_url, plan_id, setup_completed, active, created_at, updated_at, owner_id')
          .eq('owner_id', saasUserId)
          .order('created_at', { ascending: false })
        if (fallbackErr) {
          return new Response(JSON.stringify({ ok: false, error: fallbackErr.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }
        // Add has_key flags without exposing actual keys
        const safeOrgs = (owned || []).map((o: any) => ({
          ...o,
          has_anon_key: false, // Don't expose actual status
          has_service_key: false // Don't expose actual status
        }))
        return new Response(JSON.stringify({ ok: true, organizations: safeOrgs }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      return new Response(JSON.stringify({ ok: true, organizations: orgs || [] }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // ⚠️ REMOVIDO: get_credentials nunca deve retornar chaves descriptografadas ao frontend
    // Se o frontend precisa usar as chaves, deve ser feito via outras Edge Functions
    // que fazem o trabalho internamente sem expor as chaves
    if (action === 'get_credentials') {
      return new Response(JSON.stringify({ 
        error: 'Esta ação foi removida por segurança. Use outras Edge Functions que fazem o trabalho internamente.' 
      }), { status: 403, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // Master health: detect duplicates and missing mappings
    if (action === 'health') {
      const { data: owned } = await master
        .from('saas_organizations')
        .select('id, client_org_id, name, slug, active')
        .eq('owner_id', saasUserId)
        .order('created_at', { ascending: false })
      let anomalies: any[] = []
      try {
        const { data: rows } = await master.rpc('detect_orphan_organizations')
        anomalies = (rows || []).filter((r: any) => String(r.owner_id) === String(saasUserId))
      } catch {}
      return new Response(JSON.stringify({ ok: true, master_orgs: owned || [], anomalies }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // Re-link master organization to a new client_org_id
    if (action === 'relink') {
      const master_org_id = String((payload as any)?.master_org_id || '')
      const new_client_org_id = String((payload as any)?.new_client_org_id || '')
      if (!master_org_id || !new_client_org_id) return new Response(JSON.stringify({ ok: false, error: 'Missing master_org_id or new_client_org_id' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      // Validate ownership - sempre filtrar por owner_id para evitar conflitos quando múltiplos usuários compartilham o mesmo Supabase
      const { data: row, error: err } = await master
        .from('saas_organizations')
        .select('owner_id')
        .eq('id', master_org_id)
        .eq('owner_id', saasUserId)
        .maybeSingle()
      if (err || !row?.owner_id || String(row.owner_id) !== String(saasUserId)) return new Response(JSON.stringify({ ok: false, error: 'Not allowed' }), { status: 403, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      // Perform relink via RPC (controlled bypass inside DB)
      const { error: relErr } = await master.rpc('relink_client_organization', { p_master_org_id: master_org_id, p_new_client_org_id: new_client_org_id, p_user_id: saasUserId })
      if (relErr) return new Response(JSON.stringify({ ok: false, error: relErr.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // List all Supabase projects (with and without service role)
    if (action === 'list_supabase_projects') {
      const { data: connections } = await master
        .from('saas_supabases_connections')
        .select('id, supabase_url, project_ref, label, service_role_encrypted')
        .eq('owner_id', saasUserId)
        .order('updated_at', { ascending: false })
      const projects = (connections || []).map((c: any) => ({
        id: c.id,
        url: c.supabase_url,
        project_ref: c.project_ref || extractProjectRef(c.supabase_url),
        label: c.label || c.project_ref || extractProjectRef(c.supabase_url) || 'Sem nome',
        has_service_role: !!c.service_role_encrypted
      }))
      return new Response(JSON.stringify({ ok: true, projects }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // List only projects WITH service role (for migration)
    if (action === 'list_supabase_projects_with_service_role') {
      const { data: connections } = await master
        .from('saas_supabases_connections')
        .select('id, supabase_url, project_ref, label, service_role_encrypted')
        .eq('owner_id', saasUserId)
        .not('service_role_encrypted', 'is', null)
        .order('updated_at', { ascending: false })
      const projects = (connections || []).map((c: any) => ({
        id: c.id,
        url: c.supabase_url,
        project_ref: c.project_ref || extractProjectRef(c.supabase_url),
        label: c.label || c.project_ref || extractProjectRef(c.supabase_url) || 'Sem nome'
      }))
      return new Response(JSON.stringify({ ok: true, projects }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // Update/add service role key for a project
    if (action === 'update_service_role') {
      const connection_id = String((payload as any)?.connection_id || '')
      const service_role_key = String((payload as any)?.service_role_key || '').trim()
      
      if (!connection_id || !service_role_key) {
        return new Response(JSON.stringify({ ok: false, error: 'Missing connection_id or service_role_key' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      
      // Validate key format (basic JWT check)
      const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/
      if (!jwtRegex.test(service_role_key)) {
        return new Response(JSON.stringify({ ok: false, error: 'Invalid service role key format' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      
      // Verify ownership
      const { data: conn } = await master
        .from('saas_supabases_connections')
        .select('owner_id, supabase_url')
        .eq('id', connection_id)
        .maybeSingle()
      
      if (!conn || String(conn.owner_id) !== String(saasUserId)) {
        return new Response(JSON.stringify({ ok: false, error: 'Not allowed' }), { status: 403, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      
      // 🔐 Criptografar usando função real (não apenas base64)
      let encrypted: string
      try {
        const { data: encryptedData, error: encryptErr } = await master.rpc('encrypt_key', { plaintext: service_role_key })
        if (encryptErr || !encryptedData) {
          // Fallback para base64 se função não disponível (compatibilidade)
          encrypted = btoa(service_role_key)
        } else {
          encrypted = encryptedData
        }
      } catch (_e) {
        // Fallback para base64 se função não disponível (compatibilidade)
        encrypted = btoa(service_role_key)
      }
      
      const { error: updateErr } = await master
        .from('saas_supabases_connections')
        .update({ service_role_encrypted: encrypted, updated_at: new Date().toISOString() })
        .eq('id', connection_id)
      
      if (updateErr) {
        return new Response(JSON.stringify({ ok: false, error: updateErr.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      
      // Also update organization-scoped credentials on MASTER, when we can infer the target org(s)
      // Strategy: update any master.saas_organizations rows for this owner that point to the same supabase_url
      try {
        const url = String((conn as any)?.supabase_url || '')
        if (url) {
          await master
            .from('saas_organizations')
            .update({ client_service_key_encrypted: encrypted, updated_at: new Date().toISOString() })
            .eq('owner_id', saasUserId)
            .eq('client_supabase_url', url)
        }
      } catch (_e) {
        // best-effort; don't fail the request if this secondary update fails
      }
      
      return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // List organizations from a specific Supabase project
    if (action === 'list_orgs_from_project') {
      const project_id = String((payload as any)?.project_id || '')
      if (!project_id) return new Response(JSON.stringify({ ok: false, error: 'Missing project_id' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      
      const { data: conn } = await master
        .from('saas_supabases_connections')
        .select('supabase_url, service_role_encrypted')
        .eq('id', project_id)
        .eq('owner_id', saasUserId)
        .maybeSingle()
      
      if (!conn?.supabase_url || !conn?.service_role_encrypted) {
        return new Response(JSON.stringify({ ok: false, error: 'Project not found or missing service role' }), { status: 404, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      
      let key = ''
      try { key = atob(cleanBase64(String(conn.service_role_encrypted))) } catch {
        return new Response(JSON.stringify({ ok: false, error: 'Invalid service role key' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      
      const projectClient = createClient(String(conn.supabase_url), key)
      const { data: orgs, error: orgErr } = await projectClient
        .from('saas_organizations')
        .select('id, name, slug')
        .order('created_at', { ascending: false })
      
      if (orgErr) return new Response(JSON.stringify({ ok: false, error: orgErr.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      
      return new Response(JSON.stringify({ ok: true, organizations: orgs || [] }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // Migration: dry-run plan
    if (action === 'migration_plan') {
      const project_id = String((payload as any)?.project_id || '')
      const from_org = String((payload as any)?.from_client_org_id || '')
      const to_org = String((payload as any)?.to_client_org_id || '')
      
      if (!project_id || !from_org || !to_org) {
        return new Response(JSON.stringify({ ok: false, error: 'Missing project_id, from_org, or to_org' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      
      // Get project credentials
      const { data: conn } = await master
        .from('saas_supabases_connections')
        .select('supabase_url, service_role_encrypted')
        .eq('id', project_id)
        .eq('owner_id', saasUserId)
        .maybeSingle()
      
      if (!conn?.supabase_url || !conn?.service_role_encrypted) {
        return new Response(JSON.stringify({ ok: false, error: 'Project not found or missing service role' }), { status: 404, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      
      let key = ''
      try { key = atob(cleanBase64(String(conn.service_role_encrypted))) } catch {
        return new Response(JSON.stringify({ ok: false, error: 'Invalid service role key' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      
      const sourceClient = createClient(String(conn.supabase_url), key)
      
      // Get destination credentials (use destination org's Supabase)
      const destClientAdmin = await getClientAdminForUser(saasUserId, to_org)
      if (!destClientAdmin) {
        return new Response(JSON.stringify({ ok: false, error: 'Destination client admin credentials missing' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      
      // Do migration directly in Edge Function (we have access to both databases)
      // Dry-run: count records from source
      const tables: any[] = []
      let totalRecords = 0
      
      const countFromSource = async (table: string) => {
        const { count, error } = await sourceClient
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', from_org)
        if (!error && count !== null) {
          tables.push({ table, count })
          totalRecords += count
        }
      }
      
      await Promise.all([
        countFromSource('clients'),
        countFromSource('collaborators'),
        countFromSource('crm_stages'),
        countFromSource('crm_leads'),
        countFromSource('appointments'),
        countFromSource('entradas'),
        countFromSource('saidas'),
        countFromSource('produtos_servicos')
      ])
      
      return new Response(JSON.stringify({ 
        ok: true, 
        plan: {
          dry_run: true,
          tables,
          records_count: totalRecords,
          from_org_id: from_org,
          to_org_id: to_org
        }
      }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // Migration: apply
    if (action === 'migration_apply') {
      const project_id = String((payload as any)?.project_id || '')
      const from_org = String((payload as any)?.from_client_org_id || '')
      const to_org = String((payload as any)?.to_client_org_id || '')
      
      if (!project_id || !from_org || !to_org) {
        return new Response(JSON.stringify({ ok: false, error: 'Missing project_id, from_org, or to_org' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      
      // Get project credentials
      const { data: conn } = await master
        .from('saas_supabases_connections')
        .select('supabase_url, service_role_encrypted')
        .eq('id', project_id)
        .eq('owner_id', saasUserId)
        .maybeSingle()
      
      if (!conn?.supabase_url || !conn?.service_role_encrypted) {
        return new Response(JSON.stringify({ ok: false, error: 'Project not found or missing service role' }), { status: 404, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      
      let key = ''
      try { key = atob(cleanBase64(String(conn.service_role_encrypted))) } catch {
        return new Response(JSON.stringify({ ok: false, error: 'Invalid service role key' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      
      // Create source client
      const sourceClient = createClient(String(conn.supabase_url), key)
      
      // Get destination credentials
      const destClientAdmin = await getClientAdminForUser(saasUserId, to_org)
      if (!destClientAdmin) {
        return new Response(JSON.stringify({ ok: false, error: 'Destination client admin credentials missing' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      
      // Do migration directly in Edge Function
      // This will migrate data from source to destination, recreating IDs and adjusting FKs
      const migrationResult = await performMigration(sourceClient, destClientAdmin, from_org, to_org)
      
      return new Response(JSON.stringify({ ok: true, result: migrationResult }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    function extractProjectRef(url: string): string {
      try {
        const u = new URL(url)
        const host = u.hostname.replace('.supabase.co', '')
        return host.split('.')[0] || ''
      } catch {
        return ''
      }
    }

    async function performMigration(sourceClient: any, destClient: any, fromOrgId: string, toOrgId: string) {
      const mapping: Record<string, Record<string, string>> = {
        clients: {},
        collaborators: {},
        crm_stages: {},
        crm_leads: {},
        produtos_servicos: {}
      }
      const results: any[] = []

      // 1. Migrate CRM Stages first
      const { data: stages } = await sourceClient
        .from('crm_stages')
        .select('*')
        .eq('organization_id', fromOrgId)
      
      for (const stage of (stages || [])) {
        // Check if stage with same name exists in destination
        const { data: existing } = await destClient
          .from('crm_stages')
          .select('id')
          .eq('organization_id', toOrgId)
          .eq('name', stage.name)
          .maybeSingle()
        
        let newStageId = existing?.id
        if (!newStageId) {
          const newId = generateUUID()
          const { error } = await destClient
            .from('crm_stages')
            .insert({
              id: newId,
              organization_id: toOrgId,
              name: stage.name,
              order_index: stage.order_index || 0,
              color: stage.color || '#666666',
              created_at: stage.created_at,
              updated_at: stage.updated_at
            })
          if (error) throw new Error(`Failed to migrate stage: ${error.message}`)
          newStageId = newId
        }
        mapping.crm_stages[stage.id] = newStageId
      }
      results.push({ table: 'crm_stages', count: (stages || []).length })

      // 2. Migrate Clients
      const { data: clients } = await sourceClient
        .from('clients')
        .select('*')
        .eq('organization_id', fromOrgId)
      
      for (const client of (clients || [])) {
        const newId = crypto.randomUUID ? crypto.randomUUID() : (await import('https://deno.land/std@0.224.0/uuid/mod.ts')).v4.generate()
        const { error } = await destClient
          .from('clients')
          .insert({
            id: newId,
            organization_id: toOrgId,
            nome: client.nome,
            email: client.email,
            telefone: client.telefone,
            nascimento: client.nascimento,
            documentos: client.documentos,
            endereco: client.endereco,
            observacoes: client.observacoes,
            ativo: client.ativo !== false,
            valor_pago: client.valor_pago || 0,
            created_at: client.created_at,
            updated_at: client.updated_at
          })
        if (error) throw new Error(`Failed to migrate client: ${error.message}`)
        mapping.clients[client.id] = newId
      }
      results.push({ table: 'clients', count: (clients || []).length })

      // 3. Migrate Collaborators
      const { data: collaborators } = await sourceClient
        .from('collaborators')
        .select('*')
        .eq('organization_id', fromOrgId)
      
      for (const collab of (collaborators || [])) {
        const newId = crypto.randomUUID ? crypto.randomUUID() : (await import('https://deno.land/std@0.224.0/uuid/mod.ts')).v4.generate()
        const { error } = await destClient
          .from('collaborators')
          .insert({
            id: newId,
            organization_id: toOrgId,
            user_id: collab.user_id,
            name: collab.name,
            position: collab.position,
            email: collab.email,
            phone: collab.phone,
            credentials: collab.credentials,
            notes: collab.notes,
            active: collab.active !== false,
            total_consultations: collab.total_consultations || 0,
            consultations_this_month: collab.consultations_this_month || 0,
            upcoming_appointments: collab.upcoming_appointments || 0,
            average_rating: collab.average_rating,
            created_at: collab.created_at,
            updated_at: collab.updated_at
          })
        if (error) throw new Error(`Failed to migrate collaborator: ${error.message}`)
        mapping.collaborators[collab.id] = newId
      }
      results.push({ table: 'collaborators', count: (collaborators || []).length })

      // 4. Migrate Produtos/Serviços
      const { data: produtos } = await sourceClient
        .from('produtos_servicos')
        .select('*')
        .eq('organization_id', fromOrgId)
      
      for (const produto of (produtos || [])) {
        const newId = crypto.randomUUID ? crypto.randomUUID() : (await import('https://deno.land/std@0.224.0/uuid/mod.ts')).v4.generate()
        const { error } = await destClient
          .from('produtos_servicos')
          .insert({
            id: newId,
            organization_id: toOrgId,
            nome: produto.nome,
            descricao: produto.descricao,
            tipo: produto.tipo,
            categoria: produto.categoria,
            preco_base: produto.preco_base,
            ativo: produto.ativo !== false,
            tipo_cobranca: produto.tipo_cobranca,
            cobranca_tipo: produto.cobranca_tipo,
            tem_estoque: produto.tem_estoque || false,
            estoque_quantidade: produto.estoque_quantidade,
            created_at: produto.created_at,
            updated_at: produto.updated_at
          })
        if (error) throw new Error(`Failed to migrate produto: ${error.message}`)
        mapping.produtos_servicos[produto.id] = newId
      }
      results.push({ table: 'produtos_servicos', count: (produtos || []).length })

      // 5. Migrate CRM Leads (after stages, clients, collaborators, produtos)
      const { data: leads } = await sourceClient
        .from('crm_leads')
        .select('*')
        .eq('organization_id', fromOrgId)
      
      for (const lead of (leads || [])) {
        const newId = crypto.randomUUID ? crypto.randomUUID() : (await import('https://deno.land/std@0.224.0/uuid/mod.ts')).v4.generate()
        const stageName = lead.stage
        const createdById = mapping.collaborators[lead.created_by] || lead.created_by
        const assignedToId = lead.assigned_to ? (mapping.collaborators[lead.assigned_to] || lead.assigned_to) : null
        const convertedClientId = lead.converted_client_id ? (mapping.clients[lead.converted_client_id] || lead.converted_client_id) : null
        const soldProdutoId = lead.sold_produto_servico_id ? (mapping.produtos_servicos[lead.sold_produto_servico_id] || lead.sold_produto_servico_id) : null
        const interestProdutoId = lead.interest_produto_servico_id ? (mapping.produtos_servicos[lead.interest_produto_servico_id] || lead.interest_produto_servico_id) : null
        
        const { error } = await destClient
          .from('crm_leads')
          .insert({
            id: newId,
            organization_id: toOrgId,
            name: lead.name,
            whatsapp: lead.whatsapp,
            email: lead.email,
            stage: stageName,
            description: lead.description,
            value: lead.value,
            priority: lead.priority,
            source: lead.source,
            canal: lead.canal,
            created_by: createdById,
            assigned_to: assignedToId,
            has_payment: lead.has_payment || false,
            payment_value: lead.payment_value,
            is_highlight: lead.is_highlight || false,
            lost_reason: lead.lost_reason,
            converted_client_id: convertedClientId,
            converted_at: lead.converted_at,
            has_whatsapp: lead.has_whatsapp || false,
            instagram_username: lead.instagram_username,
            cnpj: lead.cnpj,
            company_name: lead.company_name,
            show_in_kanban: lead.show_in_kanban !== false,
            sold_produto_servico_id: soldProdutoId,
            sold_quantity: lead.sold_quantity,
            interests: lead.interests,
            interest_produto_servico_id: interestProdutoId,
            interest_quantity: lead.interest_quantity,
            created_at: lead.created_at,
            updated_at: lead.updated_at
          })
        if (error) throw new Error(`Failed to migrate lead: ${error.message}`)
        mapping.crm_leads[lead.id] = newId
      }
      results.push({ table: 'crm_leads', count: (leads || []).length })

      // 6. Migrate Appointments
      const { data: appointments } = await sourceClient
        .from('appointments')
        .select('*')
        .eq('organization_id', fromOrgId)
      
      for (const apt of (appointments || [])) {
        const newId = crypto.randomUUID ? crypto.randomUUID() : (await import('https://deno.land/std@0.224.0/uuid/mod.ts')).v4.generate()
        const clientId = apt.client_id ? (mapping.clients[apt.client_id] || apt.client_id) : null
        const leadId = apt.lead_id ? (mapping.crm_leads[apt.lead_id] || apt.lead_id) : null
        const collaboratorId = apt.collaborator_id ? (mapping.collaborators[apt.collaborator_id] || apt.collaborator_id) : null
        
        const { error } = await destClient
          .from('appointments')
          .insert({
            id: newId,
            organization_id: toOrgId,
            datetime: apt.datetime,
            duration_minutes: apt.duration_minutes,
            tipo: apt.tipo,
            status: apt.status,
            client_id: clientId,
            lead_id: leadId,
            collaborator_id: collaboratorId,
            title: apt.title,
            valor_consulta: apt.valor_consulta,
            anotacoes: apt.anotacoes,
            arquivos: apt.arquivos,
            metadata: apt.metadata,
            created_at: apt.created_at,
            updated_at: apt.updated_at
          })
        if (error) throw new Error(`Failed to migrate appointment: ${error.message}`)
      }
      results.push({ table: 'appointments', count: (appointments || []).length })

      // 7. Migrate Entradas
      const { data: entradas } = await sourceClient
        .from('entradas')
        .select('*')
        .eq('organization_id', fromOrgId)
      
      for (const entrada of (entradas || [])) {
        const newId = crypto.randomUUID ? crypto.randomUUID() : (await import('https://deno.land/std@0.224.0/uuid/mod.ts')).v4.generate()
        const clientId = entrada.cliente_id ? (mapping.clients[entrada.cliente_id] || entrada.cliente_id) : null
        const produtoId = entrada.produto_servico_id ? (mapping.produtos_servicos[entrada.produto_servico_id] || entrada.produto_servico_id) : null
        
        const { error } = await destClient
          .from('entradas')
          .insert({
            id: newId,
            organization_id: toOrgId,
            descricao: entrada.descricao,
            valor: entrada.valor,
            categoria: entrada.categoria,
            data_entrada: entrada.data_entrada,
            metodo_pagamento: entrada.metodo_pagamento,
            cliente_id: clientId,
            produto_servico_id: produtoId,
            observacoes: entrada.observacoes,
            created_at: entrada.created_at,
            updated_at: entrada.updated_at
          })
        if (error) throw new Error(`Failed to migrate entrada: ${error.message}`)
      }
      results.push({ table: 'entradas', count: (entradas || []).length })

      // 8. Migrate Saídas
      const { data: saidas } = await sourceClient
        .from('saidas')
        .select('*')
        .eq('organization_id', fromOrgId)
      
      for (const saida of (saidas || [])) {
        const newId = crypto.randomUUID ? crypto.randomUUID() : (await import('https://deno.land/std@0.224.0/uuid/mod.ts')).v4.generate()
        const { error } = await destClient
          .from('saidas')
          .insert({
            id: newId,
            organization_id: toOrgId,
            descricao: saida.descricao,
            valor: saida.valor,
            categoria: saida.categoria,
            data_saida: saida.data_saida,
            metodo_pagamento: saida.metodo_pagamento,
            fornecedor: saida.fornecedor,
            recorrente: saida.recorrente || false,
            observacoes: saida.observacoes,
            created_at: saida.created_at,
            updated_at: saida.updated_at
          })
        if (error) throw new Error(`Failed to migrate saida: ${error.message}`)
      }
      results.push({ table: 'saidas', count: (saidas || []).length })

      const totalRecords = results.reduce((sum, r) => sum + r.count, 0)
      return {
        dry_run: false,
        success: true,
        tables: results,
        records_count: totalRecords,
        from_org_id: fromOrgId,
        to_org_id: toOrgId
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), { status: 500, headers: getCorsHeaders(req) })
  }
})


