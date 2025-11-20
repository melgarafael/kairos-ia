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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || ''

    const MASTER_URL = Deno.env.get('SUPABASE_URL')!
    const MASTER_ANON = Deno.env.get('SUPABASE_ANON_KEY')!
    const MASTER_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Auth user via anon+Bearer
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''
    const authClient = createClient(MASTER_URL, MASTER_ANON, { global: { headers: { Authorization: `Bearer ${bearer || MASTER_ANON}` } } })
    const { data: userData, error: userErr } = await authClient.auth.getUser()

    const body = await req.json().catch(() => ({})) as any
    let saasUserId: string | null = null

    if (!userErr && userData?.user?.id) {
      saasUserId = userData.user.id
    } else {
      const ownerIdFromBody = typeof body?.owner_id === 'string' ? body.owner_id.trim() : ''
      const isGatewayCall = bearer === MASTER_SERVICE
      if (isGatewayCall && ownerIdFromBody) {
        saasUserId = ownerIdFromBody
      } else {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
    }

    if (!saasUserId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    const master = createClient(MASTER_URL, MASTER_SERVICE)
    const clientUrl = String(body?.url || '')
    const clientKey = String(body?.key || '')
    const organizationId = String(body?.organization_id || '') // client org id (when applying per-organization)
    if (!clientUrl || !clientKey) {
      return new Response(JSON.stringify({ error: 'Missing url/key' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    const client = createClient(clientUrl, clientKey)

    async function testClientSchema() {
      // Basic connectivity test
      const { error: pingErr } = await client.from('clients' as any).select('count', { count: 'exact', head: true })
      if (pingErr) {
        // Detectar projeto não encontrado ou deletado
        const isProjectNotFound = 
          pingErr.code === 'PGRST301' ||
          pingErr.status === 404 ||
          pingErr.status === 0 ||
          (pingErr.message && (
            pingErr.message.toLowerCase().includes('project not found') ||
            pingErr.message.toLowerCase().includes('projeto não encontrado') ||
            pingErr.message.toLowerCase().includes('not found') ||
            pingErr.message.toLowerCase().includes('does not exist')
          ))
        
        if (isProjectNotFound) {
          throw new Error('O projeto Supabase não foi encontrado. Verifique se a URL está correta e se o projeto ainda existe.')
        }
        
        // Erros de tabela não existente são OK (PGRST116 = table doesn't exist)
        if (pingErr.code !== 'PGRST116' && pingErr.code !== '42P01') {
          // Verificar se é erro de credenciais inválidas
          const isInvalidCredentials = 
            pingErr.status === 401 ||
            pingErr.status === 403 ||
            (pingErr.message && (
              pingErr.message.toLowerCase().includes('invalid') ||
              pingErr.message.toLowerCase().includes('unauthorized') ||
              pingErr.message.toLowerCase().includes('forbidden')
            ))
          
          if (isInvalidCredentials) {
            throw new Error('Credenciais inválidas. Verifique se a URL e a chave anon/public estão corretas.')
          }
          
          throw new Error(`Conexão falhou: ${pingErr.message || 'Erro desconhecido'}`)
        }
      }
      // Helpers to classify errors
      const isMissing = (err: any) => {
        const msg = String(err?.message || '').toLowerCase()
        const code = String(err?.code || '')
        return (
          code === 'PGRST116' || code === '42P01' ||
          /does not exist|relation .* does not exist|undefined table/i.test(msg)
        )
      }
      const isPermission = (err: any) => {
        const msg = String(err?.message || '').toLowerCase()
        const code = String(err?.code || '')
        const status = Number(err?.status || 0)
        return (
          code === '42501' || status === 401 || status === 403 ||
          /permission denied|rls|policy|not authorized|denied/i.test(msg)
        )
      }
      // Required tables (tolerate RLS/permission errors as "exists")
      let sqlMissing = false
      try {
        const { error: orgErr } = await client.from('saas_organizations' as any).select('id', { head: true }).limit(1)
        if (orgErr && !isPermission(orgErr)) sqlMissing = sqlMissing || isMissing(orgErr)
      } catch (e) { sqlMissing = true }
      try {
        const { error: migErr } = await client.from('app_migrations' as any).select('id', { head: true }).limit(1)
        if (migErr && !isPermission(migErr)) sqlMissing = sqlMissing || isMissing(migErr)
      } catch (e) { sqlMissing = true }
      return { sqlMissing }
    }

    if (action === 'test') {
      try {
        const { sqlMissing } = await testClientSchema()
        return new Response(JSON.stringify({ ok: true, sqlMissing }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch (testError: any) {
        // Retornar erro descritivo
        return new Response(JSON.stringify({ ok: false, error: testError.message || 'Erro ao testar conexão' }), { 
          status: 400, 
          headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
        })
      }
    }

    if (action === 'apply') {
      const { sqlMissing } = await testClientSchema()
      if (sqlMissing) {
        // Em casos de clientes já existentes (migrações parciais), permitir salvar as credenciais mesmo sem todo o schema,
        // para que possam concluir o setup depois. Volta ok=true mas sinaliza sqlMissing.
        // return 400 seria bloqueante para quem precisa recuperar acesso.
      }

      const enc = btoa(clientKey)

      // Se a requisição especifica uma organization_id, salvar as credenciais atreladas à organização (Master.saas_organizations)
      if (organizationId) {
        try {
          // Validação branda de ownership: tentar verificar no Client se a organização pertence ao usuário atual
          let ownerOk = true
          try {
            const { data: own, error: ownErr } = await client
              .from('saas_organizations' as any)
              .select('id, owner_id')
              .eq('id', organizationId)
              .maybeSingle()
            if (!ownErr && own?.owner_id && String(own.owner_id) !== String(saasUserId)) {
              ownerOk = false
            }
          } catch { /* ignore permission errors */ }

          if (!ownerOk) {
            return new Response(JSON.stringify({ ok: false, error: 'not_owner_of_organization' }), { status: 403, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
          }

          // Upsert em master.saas_organizations por (owner_id, client_org_id)
          const { error: upErr } = await master
            .from('saas_organizations')
            .upsert({
              owner_id: saasUserId,
              client_org_id: organizationId,
              client_supabase_url: clientUrl,
              client_anon_key_encrypted: enc,
              updated_at: new Date().toISOString()
            }, { onConflict: 'owner_id, client_org_id' })

          if (upErr) {
            return new Response(JSON.stringify({ ok: false, error: upErr.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
          }

          // Registrar/atualizar também no repositório de conexões do usuário (Master)
          try {
            await master
              .from('saas_supabases_connections')
              .upsert({
                owner_id: saasUserId,
                supabase_url: clientUrl,
                anon_key_encrypted: enc,
                last_used_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }, { onConflict: 'owner_id, supabase_url' })
          } catch (_) { /* best-effort */ }

          return new Response(JSON.stringify({ ok: true, sqlMissing }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: e?.message || 'apply_failed' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }
      }

      // Caso contrário, manter compat: salvar em master.saas_users (escopo do usuário)
      const { error: updErr } = await master
        .from('saas_users')
        .update({ supabase_url: clientUrl, supabase_key_encrypted: enc, setup_completed: true, updated_at: new Date().toISOString() })
        .eq('id', saasUserId)
      if (updErr) {
        return new Response(JSON.stringify({ ok: false, error: updErr.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
      // Registrar/atualizar também no repositório de conexões do usuário (Master)
      try {
        await master
          .from('saas_supabases_connections')
          .upsert({
            owner_id: saasUserId,
            supabase_url: clientUrl,
            anon_key_encrypted: enc,
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'owner_id, supabase_url' })
      } catch (_) { /* best-effort */ }
      return new Response(JSON.stringify({ ok: true, sqlMissing }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // Novo: conectar um NOVO Supabase para uma NOVA organização (isolado por org)
    if (action === 'apply_for_org') {
      const orgNameRaw = (body?.org_name ?? '').toString().trim()
      const orgSlugRaw = (body?.org_slug ?? '').toString().trim().toLowerCase()
      if (!orgNameRaw || !orgSlugRaw) {
        return new Response(JSON.stringify({ error: 'Missing org_name/org_slug' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      // Basic connectivity test
      try {
        const { error: pingErr } = await client.from('clients' as any).select('count', { count: 'exact', head: true })
        if (pingErr && pingErr.code !== 'PGRST116' && pingErr.code !== '42P01') {
          throw new Error(`Conexão falhou: ${pingErr.message}`)
        }
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e?.message || 'test_failed' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      // Enforce minimal client schema: require saas_organizations table to exist
      try {
        const { error: headErr } = await client
          .from('saas_organizations' as any)
          .select('id', { head: true })
          .limit(1)
        if (headErr) {
          const code = String((headErr as any).code || '').toUpperCase()
          const status = Number((headErr as any).status || 0)
          const msg = String((headErr as any).message || '').toLowerCase()
          const missing = status === 404 || code === '404' || code === 'PGRST116' || code === '42P01' || /does not exist|relation .* does not exist|undefined table/.test(msg)
          if (missing) {
            return new Response(JSON.stringify({ error: 'client_schema_missing' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
          }
        }
      } catch (e: any) {
        return new Response(JSON.stringify({ error: 'client_schema_missing' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      // Upsert organization row in Master with org-scoped credentials (não altera saas_users)
      const enc = btoa(clientKey)
      let upOrg: any = null
      try {
        const nowIso = new Date().toISOString()
        const trialEndsIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        const { data, error } = await master
          .from('saas_organizations')
          .upsert({
            name: orgNameRaw,
            slug: orgSlugRaw,
            owner_id: saasUserId,
            // Plano padrão (trial por 14 dias)
            plan_id: '4663da1a-b552-4127-b1af-4bc30c681682',
            client_supabase_url: clientUrl,
            client_anon_key_encrypted: enc,
            // Trial/flags defaults on creation
            trial_started_at: nowIso,
            trial_ends_at: trialEndsIso,
            setup_completed: true,
            active: true,
            onboarding_experience_completed: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'owner_id,slug', ignoreDuplicates: false })
          .select('id, slug, name')
          .maybeSingle()
        if (error) throw error
        upOrg = data
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e?.message || 'org_upsert_failed' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      // Registrar/atualizar também no repositório de conexões do usuário
      try {
        await master
          .from('saas_supabases_connections')
          .upsert({
            owner_id: saasUserId,
            supabase_url: clientUrl,
            anon_key_encrypted: enc,
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'owner_id, supabase_url' })
      } catch (_) { /* best-effort */ }

      // Resolver SEMPRE o client_org_id no Master a partir do id primário no Client
      try {
        let clientOrgId: string | null = null

        // 1) Tentar encontrar a organização no Client por slug
        try {
          const { data: found, error: findErr } = await client
            .from('saas_organizations' as any)
            .select('id')
            .eq('slug', orgSlugRaw)
            .maybeSingle()
          if (!findErr && found?.id) {
            clientOrgId = String(found.id)
          }
        } catch { /* ignore */ }

        // 2) Se não encontrou, tentar criar/atualizar por slug (upsert) e retornar o id
        if (!clientOrgId) {
          try {
            const up = await client
              .from('saas_organizations' as any)
              .upsert({ name: orgNameRaw, slug: orgSlugRaw, owner_id: saasUserId }, { onConflict: 'slug' })
              .select('id')
              .maybeSingle()
            if (!up.error && up.data?.id) {
              clientOrgId = String(up.data.id)
            } else if (up.error) {
              // Se houve conflito/duplicidade, tentar ler novamente por slug
              const msg = String(up.error?.message || '').toLowerCase()
              const code = String((up.error as any)?.code || '').toUpperCase()
              if (/duplicate|unique|conflict|already exists|409/.test(msg) || code === '23505') {
                try {
                  const { data: again } = await client
                    .from('saas_organizations' as any)
                    .select('id')
                    .eq('slug', orgSlugRaw)
                    .maybeSingle()
                  if (again?.id) clientOrgId = String(again.id)
                } catch { /* ignore */ }
              }
            }
          } catch { /* ignore */ }
        }

        // 3) Se obteve o id do Client, atualizar o espelho no Master
        if (clientOrgId && upOrg?.id) {
          await master
            .from('saas_organizations')
            .update({ client_org_id: clientOrgId, updated_at: new Date().toISOString() })
            .eq('id', upOrg.id)
        }
      } catch { /* best-effort */ }

      return new Response(JSON.stringify({ ok: true, org_id: upOrg?.id || null }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    if (action === 'can_open_orgs') {
      let c = client
      try {
        // Se url/key não foram enviados, tentar credenciais já salvas no Master
        if (!clientUrl || !clientKey) {
          const { data, error } = await master
            .from('saas_users')
            .select('supabase_url, supabase_key_encrypted')
            .eq('id', saasUserId)
            .single()
          if (!error && data?.supabase_url && data?.supabase_key_encrypted) {
            const dec = atob((data.supabase_key_encrypted || '').toString().trim())
            c = createClient(data.supabase_url, dec)
          }
        }
      } catch {}
      if (!c) return new Response(JSON.stringify({ ok: true, allowed: false }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      try {
        // Tabela deve existir (tratar RLS como "existe")
        const { error: orgTableErr } = await c.from('saas_organizations' as any).select('id', { head: true }).limit(1)
        if (orgTableErr) {
          const msg = String(orgTableErr?.message || '').toLowerCase()
          const code = String(orgTableErr?.code || '')
          const status = Number(orgTableErr?.status || 0)
          const permission = (code === '42501' || status === 401 || status === 403 || /permission denied|rls|policy/i.test(msg))
          if (!permission) {
            return new Response(JSON.stringify({ ok: true, allowed: false }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
          }
        }
        // Dono tem ao menos uma org; se RLS bloquear, permitir seguir (o front fará a seleção/criação de org)
        const { data: orgs, error } = await c.from('saas_organizations').select('id').eq('owner_id', saasUserId).limit(1)
        if (error) {
          const msg = String(error?.message || '').toLowerCase()
          const code = String((error as any)?.code || '')
          const status = Number((error as any)?.status || 0)
          const permission = (code === '42501' || status === 401 || status === 403 || /permission denied|rls|policy/i.test(msg))
          const allowed = permission ? true : false
          return new Response(JSON.stringify({ ok: true, allowed }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }
        const allowed = Array.isArray(orgs) && orgs.length > 0
        return new Response(JSON.stringify({ ok: true, allowed }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      } catch {
        return new Response(JSON.stringify({ ok: true, allowed: true }), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), { status: 500, headers: getCorsHeaders(req) })
  }
})


