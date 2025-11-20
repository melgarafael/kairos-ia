// @ts-nocheck
// Edge Function: admin-users
// API administrativa para gerenciar usuários, organizações e tokens
// Requer autenticação com service role ou token de admin

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
}

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
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
    'Access-Control-Max-Age': '86400'
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
    const MASTER_SUPABASE_URL = Deno.env.get('MASTER_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')
    const MASTER_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('MASTER_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!MASTER_SUPABASE_URL || !MASTER_SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'missing_env' }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // Usar service role para bypass RLS
    const supabase = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY)
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || ''

    // ===== UPSERT saas_organizations (atualizar plan_id)
    if (action === 'upsert_organization' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      const organizationId = String(body?.organization_id || body?.id || '').trim()
      const planId = String(body?.plan_id || '').trim()

      if (!organizationId) {
        return new Response(JSON.stringify({ error: 'organization_id is required' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      if (!planId) {
        return new Response(JSON.stringify({ error: 'plan_id is required' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      // Verificar se organização existe
      const { data: orgExists } = await supabase
        .from('saas_organizations')
        .select('id')
        .eq('id', organizationId)
        .maybeSingle()

      if (!orgExists) {
        return new Response(JSON.stringify({ error: 'organization not found' }), { status: 404, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      // Verificar se plano existe
      const { data: planExists } = await supabase
        .from('saas_plans')
        .select('id')
        .eq('id', planId)
        .maybeSingle()

      if (!planExists) {
        return new Response(JSON.stringify({ error: 'plan_id not found' }), { status: 404, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      // Atualizar plan_id
      const { data: updated, error } = await supabase
        .from('saas_organizations')
        .update({
          plan_id: planId,
          updated_at: new Date().toISOString()
        })
        .eq('id', organizationId)
        .select()
        .single()

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      return new Response(JSON.stringify({ ok: true, organization: updated }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // ===== UPSERT saas_users (atualizar account_type e/ou trail_product_ids)
    if (action === 'upsert_user' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      const userId = String(body?.user_id || body?.id || '').trim()
      const accountType = body?.account_type !== undefined ? String(body.account_type).trim() : undefined
      const trailProductIds = body?.trail_product_ids !== undefined ? String(body.trail_product_ids).trim() : undefined

      if (!userId) {
        return new Response(JSON.stringify({ error: 'user_id is required' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      // Verificar se usuário existe
      const { data: userExists } = await supabase
        .from('saas_users')
        .select('id')
        .eq('id', userId)
        .maybeSingle()

      if (!userExists) {
        return new Response(JSON.stringify({ error: 'user not found' }), { status: 404, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      // Validar account_type se fornecido
      if (accountType !== undefined && accountType !== null && accountType !== '') {
        const validAccountTypes = ['profissional', 'agencia', 'usuario', 'empresa', 'estudante']
        if (!validAccountTypes.includes(accountType)) {
          return new Response(JSON.stringify({ error: `account_type must be one of: ${validAccountTypes.join(', ')} or null` }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }
      }

      // Preparar dados de atualização
      const updateData: any = {
        updated_at: new Date().toISOString()
      }

      if (accountType !== undefined) {
        updateData.account_type = accountType === '' ? null : accountType
      }

      if (trailProductIds !== undefined) {
        updateData.trail_product_ids = trailProductIds === '' ? null : trailProductIds
      }

      // Atualizar usuário
      const { data: updated, error } = await supabase
        .from('saas_users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single()

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      return new Response(JSON.stringify({ ok: true, user: updated }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // ===== DELETE saas_plan_tokens
    if (action === 'delete_token' && (req.method === 'POST' || req.method === 'DELETE')) {
      const body = await req.json().catch(() => ({}))
      const tokenId = String(body?.token_id || body?.id || '').trim()

      if (!tokenId) {
        return new Response(JSON.stringify({ error: 'token_id is required' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      // Verificar se token existe
      const { data: tokenExists } = await supabase
        .from('saas_plan_tokens')
        .select('id, status, applied_organization_id')
        .eq('id', tokenId)
        .maybeSingle()

      if (!tokenExists) {
        return new Response(JSON.stringify({ error: 'token not found' }), { status: 404, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      // Deletar token
      const { error } = await supabase
        .from('saas_plan_tokens')
        .delete()
        .eq('id', tokenId)

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      return new Response(JSON.stringify({ ok: true, deleted_token_id: tokenId }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // ===== GET user by email
    if (action === 'get_user_by_email' && req.method === 'GET') {
      const email = url.searchParams.get('email') || ''
      const emailLower = email.trim().toLowerCase()

      if (!emailLower) {
        return new Response(JSON.stringify({ error: 'email parameter is required' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      // Buscar usuário por email (case-insensitive)
      const { data: user, error } = await supabase
        .from('saas_users')
        .select('*')
        .eq('email', emailLower)
        .maybeSingle()

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      if (!user) {
        return new Response(JSON.stringify({ error: 'user not found' }), { status: 404, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      return new Response(JSON.stringify({ ok: true, user }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // ===== GET organizations by owner_id
    if (action === 'get_organizations_by_owner' && req.method === 'GET') {
      const ownerId = url.searchParams.get('owner_id') || ''

      if (!ownerId.trim()) {
        return new Response(JSON.stringify({ error: 'owner_id parameter is required' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      // Buscar todas as organizações do owner
      const { data: organizations, error } = await supabase
        .from('saas_organizations')
        .select('*')
        .eq('owner_id', ownerId.trim())
        .order('created_at', { ascending: false })

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      return new Response(JSON.stringify({ 
        ok: true, 
        owner_id: ownerId.trim(),
        count: organizations?.length || 0,
        organizations: organizations || []
      }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    return new Response(JSON.stringify({ error: 'invalid_action', available_actions: ['upsert_organization', 'upsert_user', 'delete_token', 'get_user_by_email', 'get_organizations_by_owner'] }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'internal_error' }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  }
})

