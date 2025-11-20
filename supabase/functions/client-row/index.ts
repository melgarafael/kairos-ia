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

type RowFilter =
  | { type: 'eq'; column: string; value: unknown }
  | { type: 'neq'; column: string; value: unknown }
  | { type: 'ilike'; column: string; value: string }
  | { type: 'in'; column: string; values: unknown[] }
  | { type: 'gt' | 'gte' | 'lt' | 'lte'; column: string; value: number | string | Date }
  | { type: 'is'; column: string; value: any }

type Payload = {
  saas_user_id?: string
  organization_id?: string
  table: string
  operation: 'get' | 'getMany' | 'create' | 'update' | 'delete'
  select?: string
  filters?: RowFilter[]
  orderBy?: { column: string; ascending?: boolean }
  limit?: number
  data?: Record<string, unknown> | Record<string, unknown>[]
  confirm?: boolean
}

const allowedTables = new Set([
  'entradas',
  'saidas',
  'clients',
  'collaborators',
  'appointments',
  'crm_leads',
  'crm_stages',
  'crm_lead_activities',
  'crm_leads_activities',
  'crm_funnel',
  'produtos_servicos',
  'repositorio_de_mensagens',
  'notifications',
  'webhook_configurations',
  'vw_rm_insights_diarios',
  'vw_rm_conversas'
])

const allowedWriteTables = new Set([
  'entradas', 'saidas', 'clients', 'collaborators', 'crm_leads', 'crm_stages', 'crm_lead_activities', 'produtos_servicos'
])

function normalizeTableName(t: string): string {
  if (t === 'crm_leads_activities') return 'crm_lead_activities'
  return t
}

function applyFilters(q: any, filters?: RowFilter[]) {
  if (!filters || !Array.isArray(filters)) return q
  for (const f of filters) {
    switch (f.type) {
      case 'eq': q = q.eq(f.column, f.value); break
      case 'neq': q = q.neq(f.column, f.value); break
      case 'ilike': q = q.ilike(f.column, f.value); break
      case 'in': q = q.in(f.column, Array.isArray(f.values) ? f.values : []); break
      case 'gt': q = q.gt(f.column, f.value as any); break
      case 'gte': q = q.gte(f.column, f.value as any); break
      case 'lt': q = q.lt(f.column, f.value as any); break
      case 'lte': q = q.lte(f.column, f.value as any); break
      case 'is': q = q.is(f.column, f.value as any); break
    }
  }
  return q
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })

    const payload = await req.json() as Payload
    const tableRaw = String(payload?.table || '')
    const operation = String(payload?.operation || '') as Payload['operation']
    const select = String(payload?.select || '*')
    const limit = Math.min(500, Math.max(1, Number(payload?.limit || 50)))
    const orderBy = payload?.orderBy

    if (!tableRaw || !operation) {
      return new Response(JSON.stringify({ error: 'Missing table or operation' }), { status: 400, headers: getCorsHeaders(req) })
    }
    const table = normalizeTableName(tableRaw)
    if (!allowedTables.has(table)) {
      return new Response(JSON.stringify({ error: 'Table not allowed' }), { status: 400, headers: getCorsHeaders(req) })
    }

    const MASTER_URL = Deno.env.get('SUPABASE_URL')!
    const MASTER_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
    const master = createClient(MASTER_URL, MASTER_KEY)

    // Resolve user/org and client credentials
    const saasUserId = String(payload?.saas_user_id || '')
    const organizationId = String(payload?.organization_id || '')

    // Resolve credentials WITHOUT using saas_users as the source of organizations
    // Require organization_id to avoid ambiguity and follow new model
    if (!organizationId) {
      return new Response(JSON.stringify({ error: 'organization_id required' }), { status: 400, headers: getCorsHeaders(req) })
    }

    // Try per-organization credentials first (MASTER → public.saas_organizations)
    let clientUrl: string = ''
    let clientKeyB64: string = ''
    let orgId: string = organizationId
    const { data: orgRow } = await master
      .from('saas_organizations')
      .select('client_supabase_url, client_service_key_encrypted, client_anon_key_encrypted, owner_id, id, client_org_id')
      .or(`client_org_id.eq.${organizationId},id.eq.${organizationId}`)
      .maybeSingle()

    if (orgRow && (orgRow.client_supabase_url) && (orgRow.client_service_key_encrypted || orgRow.client_anon_key_encrypted)) {
      clientUrl = String(orgRow.client_supabase_url)
      clientKeyB64 = String(orgRow.client_service_key_encrypted || orgRow.client_anon_key_encrypted || '')
      orgId = String(orgRow.client_org_id || orgRow.id || organizationId)
    } else {
      // Fallback to the user's connections repository (saas_supabases_connections)
      let connectionRow: any = null
      const ownerId: string | null = (orgRow && (orgRow as any).owner_id) ? String((orgRow as any).owner_id) : null
      const orgUrl: string | null = (orgRow && (orgRow as any).client_supabase_url) ? String((orgRow as any).client_supabase_url) : null
      if (ownerId && orgUrl) {
        const { data: connByUrl } = await master
          .from('saas_supabases_connections')
          .select('supabase_url, service_role_encrypted, anon_key_encrypted')
          .eq('owner_id', ownerId)
          .eq('supabase_url', orgUrl)
          .maybeSingle()
        connectionRow = connByUrl
      }
      if (!connectionRow && ownerId) {
        const { data: connections } = await master
          .from('saas_supabases_connections')
          .select('supabase_url, service_role_encrypted, anon_key_encrypted')
          .eq('owner_id', ownerId)
          .not('service_role_encrypted', 'is', null)
          .order('last_used_at', { ascending: false, nullsFirst: false })
          .order('updated_at', { ascending: false })
          .limit(1)
        connectionRow = (connections || [])[0] || null
      }
      if (!connectionRow) {
        return new Response(JSON.stringify({ error: 'Client credentials not found' }), { status: 400, headers: getCorsHeaders(req) })
      }
      clientUrl = String(connectionRow.supabase_url)
      clientKeyB64 = String(connectionRow.service_role_encrypted || connectionRow.anon_key_encrypted || '')
    }

    function cleanBase64(str: string) {
      let s = (str || '').toString().trim().replace(/[\s\r\n]+/g, '')
      s = s.replace(/-/g, '+').replace(/_/g, '/')
      while (s.length % 4 !== 0) s += '='
      return s
    }
    let clientKey = ''
    try { clientKey = atob(cleanBase64(clientKeyB64)) } catch { return new Response(JSON.stringify({ error: 'Invalid client key' }), { status: 400, headers: getCorsHeaders(req) }) }
    const client = createClient(clientUrl, clientKey)

    // Validate membership (only when saas_user_id is provided to preserve legacy automations)
    if (saasUserId && orgId) {
      const { data: membership, error: membershipError } = await master
        .from('saas_memberships')
        .select('role,status')
        .eq('saas_user_id', saasUserId)
        .eq('organization_id_in_client', orgId)
        .maybeSingle()

      if (membershipError) {
        return new Response(JSON.stringify({ error: 'Membership validation failed' }), { status: 400, headers: getCorsHeaders(req) })
      }
      if (!membership || String(membership.status) !== 'active') {
        return new Response(JSON.stringify({ error: 'Access denied: no active membership for this organization' }), { status: 403, headers: getCorsHeaders(req) })
      }
    }

    // Helpers
    const needsOrgFilter = (t: string) => !(t.startsWith('vw_')) && t !== 'saas_organizations' && t !== 'crm_lead_activities'

    const doGetMany = async () => {
      if (table === 'crm_lead_activities') {
        let qLead = client.from('crm_leads').select('id').limit(2000)
        if (orgId) qLead = qLead.eq('organization_id', orgId)
        const { data: leadRows } = await qLead
        const ids = (leadRows || []).map((r: any) => r.id)
        let q = client.from('crm_lead_activities').select(select)
        if (ids.length) q = q.in('lead_id', ids as any)
        if (orderBy?.column) q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true })
        q = applyFilters(q, payload.filters)
        q = q.limit(limit)
        const { data, error } = await q
        if (error) throw error
        return data || []
      }
      let q: any = client.from(table).select(select)
      if (needsOrgFilter(table) && orgId) q = q.eq('organization_id', orgId)
      if (orderBy?.column) q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true })
      q = applyFilters(q, payload.filters)
      q = q.limit(limit)
      const { data, error } = await q
      if (error) throw error
      return data || []
    }

    const doGet = async () => {
      const rows = await doGetMany()
      return rows.length ? [rows[0]] : []
    }

    const doCreate = async () => {
      if (!allowedWriteTables.has(table)) return { error: 'Read-only table' }
      const rows = Array.isArray(payload.data) ? payload.data : [payload.data || {}]
      const scoped = rows.map(r => needsOrgFilter(table) && orgId ? { ...r, organization_id: (r as any).organization_id || orgId } : r)
      const { data, error } = await client.from(table).insert(scoped as any).select(select)
      if (error) throw error
      return data || []
    }

    const doUpdate = async () => {
      if (!allowedWriteTables.has(table)) return { error: 'Read-only table' }
      let q: any = client.from(table).update(payload.data || {})
      if (needsOrgFilter(table) && orgId) q = q.eq('organization_id', orgId)
      q = applyFilters(q, payload.filters)
      const { data, error } = await q.select(select)
      if (error) throw error
      return data || []
    }

    const doDelete = async () => {
      if (!allowedWriteTables.has(table)) return { error: 'Read-only table' }
      let q: any = client.from(table).delete()
      if (needsOrgFilter(table) && orgId) q = q.eq('organization_id', orgId)
      q = applyFilters(q, payload.filters)
      const { data, error } = await q.select(select)
      if (error) throw error
      return data || []
    }

    if (operation === 'get') {
      const rows = await doGet()
      return new Response(JSON.stringify({ rows }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }
    if (operation === 'getMany') {
      const rows = await doGetMany()
      return new Response(JSON.stringify({ rows }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }
    if (operation === 'create') {
      if (payload.confirm !== true) {
        return new Response(JSON.stringify({ preview: true, message: 'Confirme para criar (confirm=true).', table, data: payload.data }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      const rows = await doCreate()
      // audit minimal
      try { await master.from('audit_events').insert({ scope: 'client-row', action: 'create', table, saas_user_id: saasUserId || null, organization_id: orgId || null, count: Array.isArray(rows) ? rows.length : 0 }).select().single() } catch {}
      return new Response(JSON.stringify({ rows }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }
    if (operation === 'update') {
      if (payload.confirm !== true) {
        return new Response(JSON.stringify({ preview: true, message: 'Confirme para atualizar (confirm=true).', table, filters: payload.filters, data: payload.data }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      const rows = await doUpdate()
      try { await master.from('audit_events').insert({ scope: 'client-row', action: 'update', table, saas_user_id: saasUserId || null, organization_id: orgId || null, count: Array.isArray(rows) ? rows.length : 0 }).select().single() } catch {}
      return new Response(JSON.stringify({ rows }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }
    if (operation === 'delete') {
      if (payload.confirm !== true) {
        return new Response(JSON.stringify({ preview: true, message: 'Confirme para deletar (confirm=true).', table, filters: payload.filters }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      const rows = await doDelete()
      try { await master.from('audit_events').insert({ scope: 'client-row', action: 'delete', table, saas_user_id: saasUserId || null, organization_id: orgId || null, count: Array.isArray(rows) ? rows.length : 0 }).select().single() } catch {}
      return new Response(JSON.stringify({ rows }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    return new Response(JSON.stringify({ error: 'Invalid operation' }), { status: 400, headers: getCorsHeaders(req) })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), { status: 500, headers: getCorsHeaders(req) })
  }
})


