// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json().catch(() => ({}))
    const userId = body.user_id || body.userId || null
    const organizationId = body.organization_id || body.organizationId || null
    const key = body.service_role_key || body.serviceRoleKey || ''

    if (!key || typeof key !== 'string' || key.split('.').length !== 3) {
      return new Response(JSON.stringify({ error: 'Invalid service_role_key' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    if (!userId && !organizationId) {
      return new Response(JSON.stringify({ error: 'user_id or organization_id is required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const masterUrl = Deno.env.get('SUPABASE_URL')!
    const masterKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const master = createClient(masterUrl, masterKey)

    const encrypted = btoa(key)

    // Prefer per-organization storage when organization_id is provided
    if (organizationId) {
      // Update master.saas_organizations (scoped per owner if userId provided)
      let query = master
        .from('saas_organizations')
        .update({ client_service_key_encrypted: encrypted, updated_at: new Date().toISOString() })
        .eq('client_org_id', organizationId)
      if (userId) query = query.eq('owner_id', userId)
      const { error } = await query
      if (error) throw error
      // Also best-effort update repository row for this owner+url
      try {
        let supabaseUrl = ''
        const { data: orgRow } = await master
          .from('saas_organizations')
          .select('client_supabase_url, owner_id')
          .eq('client_org_id', organizationId)
          .maybeSingle()
        supabaseUrl = orgRow?.client_supabase_url || ''
        const owner = userId || orgRow?.owner_id || null
        if (owner && supabaseUrl) {
          await master
            .from('saas_supabases_connections')
            .upsert({
              owner_id: owner,
              supabase_url: supabaseUrl,
              service_role_encrypted: encrypted,
              updated_at: new Date().toISOString()
            }, { onConflict: 'owner_id, supabase_url' })
        }
      } catch (_) {}
      return new Response(JSON.stringify({ success: true, scope: 'organization' }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // Fallback: store on saas_users (legacy scope)
    let q = master.from('saas_users').update({ service_role_encrypted: encrypted, updated_at: new Date().toISOString() })
    if (userId) q = q.eq('id', userId)
    const { error } = await q
    if (error) throw error
    // Also best-effort update repository row by (owner_id + supabase_url)
    try {
      const { data: su } = await master
        .from('saas_users')
        .select('id, supabase_url')
        .eq('id', userId)
        .maybeSingle()
      if (su?.id && su?.supabase_url) {
        await master
          .from('saas_supabases_connections')
          .upsert({
            owner_id: su.id,
            supabase_url: su.supabase_url,
            service_role_encrypted: encrypted,
            updated_at: new Date().toISOString()
          }, { onConflict: 'owner_id, supabase_url' })
      }
    } catch (_) {}
    return new Response(JSON.stringify({ success: true, scope: 'user' }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'internal_error' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})


