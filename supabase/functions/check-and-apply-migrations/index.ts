// @ts-nocheck
// Master Edge Function: check-and-apply-migrations
// Objetivo: Verificar versão do cliente vs. versão master e aplicar migrations pendentes
// Somente backend: usa a service_role do cliente salva no MASTER (saas_organizations ou saas_supabases_connections)
// Segurança: sem exposição de chaves; usa token do usuário autenticado no MASTER para autorização
// Confiabilidade: lock por organização (pg_try_advisory_lock) e cooldown por organização
//
// Retorno (exemplo):
// {
//   ok: true,
//   master_version: 85,
//   client_version_before: 82,
//   client_version_after: 85,
//   pending: 3,
//   auto_applied: true,
//   steps: [{ version: 83, status: 'success' }, ...]
// }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Client as PgClient } from 'https://deno.land/x/postgres@v0.17.0/mod.ts'

type Step = { version: number; name?: string; status: 'success' | 'error'; error?: string }
type Mode = 'status' | 'apply' | 'auto'
type FallbackStep = { id: string; name: string; status: 'success' | 'error'; error?: string }

const corsHeaders: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function cleanBase64(s: string): string {
  return (s || '').replace(/\s+/g, '').replace(/[\r\n]/g, '')
}

function deriveProjectRefFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname // <ref>.supabase.co
    const parts = host.split('.')
    if (parts.length >= 3 && parts[1] === 'supabase') return parts[0]
    if (parts.length >= 3 && parts[1] === 'supabase' && parts[2] === 'net') return parts[0]
    return parts[0] || null
  } catch {
    return null
  }
}

function stripOuterTransaction(sqlText: string): string {
  let text = (sqlText || '').replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const t = lines[i].trim()
    if (t === '' || t.startsWith('--')) { i++; continue }
    if (/^set\s+(local\s+)?search_path\b/i.test(t)) { i++; continue }
    if (/^set\s+(local\s+)?statement_timeout\b/i.test(t)) { i++; continue }
    break
  }
  if (i < lines.length && /^begin;?$/i.test(lines[i].trim())) {
    lines.splice(i, 1)
    while (i < lines.length && lines[i].trim() === '') lines.splice(i, 1)
  }
  let j = lines.length - 1
  while (j >= 0) {
    const t = lines[j].trim()
    if (t === '' || t.startsWith('--')) { j--; continue }
    break
  }
  if (j >= 0 && /^commit;?$/i.test(lines[j].trim())) {
    lines.splice(j, 1)
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()
  }
  return lines.join('\n')
}

/**
 * Executa SQL diretamente no Supabase do cliente usando Supabase JS client
 * Requer service_role key do cliente.
 * Usa a biblioteca do Supabase para executar SQL via RPC ou queries diretas.
 */
async function executeSqlOverHttp(projectRef: string, serviceRoleKey: string, sql: string) {
  const clientUrl = `https://${projectRef}.supabase.co`
  
  // Criar cliente Supabase com service role
  const client = createClient(clientUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    db: {
      schema: 'public'
    }
  })
  
  // Método 1: Tentar usar RPC genérica se existir (mais confiável)
  // Mas como não temos RPC genérica, vamos usar o método direto via Supabase JS
  
  // Método 2: Executar SQL diretamente usando Supabase JS via rpc ou query
  // Como não temos uma função RPC genérica, vamos tentar o endpoint HTTP primeiro
  // e se falhar, usar uma abordagem alternativa via Supabase JS client
  
  const endpoint = `https://${projectRef}.supabase.co/postgres/v1/query`
  
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'prefer': 'tx=read-write',
        'apikey': serviceRoleKey,
        'authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ query: stripOuterTransaction(sql) })
    })
    
    // Verificar se o endpoint retornou erro de path inválido ou não encontrado
    if (res.status === 404 || res.status === 400) {
      const text = await res.text().catch(() => '')
      if (text.includes('requested path is invalid') || text.includes('invalid') || text.includes('not found')) {
        throw new Error('SQL endpoint not available: requested path is invalid')
      }
    }
    
    const text = await res.text().catch(() => '')
    const contentType = res.headers.get('content-type') || ''
    
    // Detectar resposta binária inesperada (erro comum quando endpoint não está habilitado)
    if (contentType && !contentType.includes('json') && !contentType.includes('text')) {
      throw new Error('SQL endpoint returned non-JSON response. Postgres HTTP endpoint may not be enabled.')
    }
    
    // Detectar erro "Unknown response for startup" (resposta binária PostgreSQL)
    if (text && (text.includes('Unknown response') || text.length < 10 && !text.startsWith('{'))) {
      throw new Error('SQL endpoint returned unexpected binary response. Postgres HTTP endpoint may not be enabled.')
    }
    
    let body: any = null
    try {
      body = text ? JSON.parse(text) : null
    } catch (parseErr) {
      // Se não conseguir fazer parse e não for erro conhecido, lançar erro claro
      throw new Error('Invalid JSON response from SQL endpoint. Postgres HTTP endpoint may not be enabled or configured incorrectly.')
    }
    
    if (!res.ok) {
      const msg = body?.error?.message || body?.message || body?.error || `HTTP ${res.status}`
      if (msg.includes('requested path is invalid') || msg.includes('invalid')) {
        throw new Error('SQL endpoint not available: requested path is invalid')
      }
      throw new Error(`${msg} @ ${endpoint}`)
    }
    
    return Array.isArray(body) ? body : (body?.[0]?.result || body)
  } catch (e: any) {
    const msg = String(e?.message || '')
    
    // Detectar todos os tipos de erro que indicam endpoint não disponível
    const isEndpointUnavailable = 
      msg.includes('requested path is invalid') ||
      msg.includes('not available') ||
      msg.includes('not enabled') ||
      msg.includes('not configured') ||
      msg.includes('dns error') ||
      msg.includes('failed to lookup') ||
      msg.includes('Name or service not known') ||
      msg.includes('Connect') ||
      msg.includes('Unknown response') ||
      msg.includes('non-JSON response') ||
      msg.includes('unexpected binary') ||
      msg.includes('Invalid JSON') ||
      e?.cause?.code === 'ENOTFOUND' ||
      e?.cause?.code === 'ECONNREFUSED'
    
    if (isEndpointUnavailable) {
      // Endpoint não disponível - lançar erro específico para trigger do fallback
      throw new Error('SQL endpoint not available. The /postgres/v1/query endpoint may be disabled or unavailable.')
    }
    
    // Re-lançar outros erros
    throw e
  }
}

/**
 * Fallback: aplica migrations usando a Edge Function do CLIENTE (client-schema-updater)
 * Requer que o projeto do cliente tenha essa function publicada.
 */
async function applyViaClientFunction(
  projectRef: string,
  serviceRoleKey: string,
  pending: Array<{ version: number; name: string; sql: string }>,
  masterVersion: number
): Promise<{ ok: boolean; steps: FallbackStep[] }> {
  const endpoint = `https://${projectRef}.supabase.co/functions/v1/client-schema-updater`
  const manifest = {
    version: `v${String(masterVersion)}`,
    migrations: pending.map(m => ({
      id: `v${String(m.version)}`,
      name: m.name,
      sql: m.sql,
      versionTag: String(m.version)
    }))
  }
  
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'apikey': serviceRoleKey,
        'authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ action: 'apply', manifest })
    })
    
    // Verificar se a função não existe (404)
    if (res.status === 404) {
      throw new Error(`Edge Function 'client-schema-updater' não encontrada no projeto ${projectRef}. Esta função precisa ser criada no projeto do cliente para usar o fallback.`)
    }
    
    let body: any = null
    let responseText = ''
    try { 
      responseText = await res.text()
      body = responseText ? JSON.parse(responseText) : null 
    } catch (parseErr) {
      // Se não conseguir fazer parse, pode ser resposta binária inesperada
      if (responseText.includes('Unknown response') || responseText.length < 50) {
        throw new Error(`Edge Function retornou resposta inesperada. Verifique se a função 'client-schema-updater' está configurada corretamente no projeto ${projectRef}.`)
      }
      throw new Error(`Resposta inválida da Edge Function: ${parseErr?.message || String(parseErr)}`)
    }
    
    if (!res.ok || !body?.ok) {
      const msg = body?.error || body?.message || `HTTP ${res.status}`
      // Melhorar mensagem de erro comum
      if (msg.includes('Unknown response') || msg.includes('startup')) {
        throw new Error(`Edge Function 'client-schema-updater' não está configurada corretamente. Verifique se a variável DATABASE_URL está definida no projeto ${projectRef}.`)
      }
      throw new Error(`client_function_failed: ${msg}`)
    }
    
    const steps: FallbackStep[] = Array.isArray(body.steps) ? body.steps : []
    return { ok: true, steps }
  } catch (e: any) {
    // Se já é um erro formatado, re-lançar
    if (e?.message?.includes('não encontrada') || e?.message?.includes('não está configurada')) {
      throw e
    }
    // Caso contrário, adicionar contexto
    const msg = String(e?.message || e || 'unknown_error')
    throw new Error(`client_function_failed: ${msg}`)
  }
}

async function withMasterPg<T>(fn: (client: PgClient) => Promise<T>): Promise<T> {
  const dbUrl = Deno.env.get('SUPABASE_DB_URL') || Deno.env.get('DATABASE_URL')
  if (!dbUrl) throw new Error('Missing SUPABASE_DB_URL')
  const client = new PgClient(dbUrl)
  await client.connect()
  try {
    return await fn(client)
  } finally {
    try { await client.end() } catch {}
  }
}

async function tryLockOrg(client: PgClient, orgId: string): Promise<boolean> {
  const key = `client_migration:${orgId}`
  const res = await client.queryObject<{ ok: boolean }>`select pg_try_advisory_lock(hashtext(${key})::bigint) as ok;`
  return Boolean(res.rows?.[0]?.ok)
}
async function releaseLockOrg(client: PgClient, orgId: string) {
  const key = `client_migration:${orgId}`
  await client.queryArray`select pg_advisory_unlock(hashtext(${key})::bigint);`
}

type MasterMigration = { version: number; name: string; sql: string }

async function loadMasterMigrations(client: PgClient): Promise<MasterMigration[]> {
  // Preferir master_migrations (nova tabela). Fallback: tabela app_migrations com colunas name/sql (se existirem).
  try {
    const rows = await client.queryObject<{ version: number; name: string; sql: string }>`
      select version::int as version, coalesce(name, 'v'||version::text) as name, sql
      from public.master_migrations
      order by version::int asc;
    `
    return rows.rows.filter((r) => r.sql && String(r.sql).trim() !== '')
  } catch {
    // Fallback: tentar app_migrations caso tenha colunas name/sql
    try {
      const rows = await client.queryObject<{ version: number; name: string; sql: string }>`
        select version::int as version, coalesce(name, 'v'||version::text) as name, sql
        from public.app_migrations
        where sql is not null
        order by version::int asc;
      `
      return rows.rows.filter((r) => r.sql && String(r.sql).trim() !== '')
    } catch {
      return []
    }
  }
}

async function getMasterMaxVersion(client: PgClient): Promise<number> {
  try {
    const rows = await client.queryObject<{ v: number }>`
      select coalesce(max(version::int),0)::int as v from public.master_migrations;
    `
    return Number(rows.rows?.[0]?.v || 0)
  } catch {
    try {
      const rows = await client.queryObject<{ v: number }>`
        select coalesce(max(version::int),0)::int as v from public.app_migrations;
      `
      return Number(rows.rows?.[0]?.v || 0)
    } catch {
      return 0
    }
  }
}

async function ensureClientMigrationsTable(projectRef: string, key: string) {
  const sql = `
  create table if not exists public.app_migrations(
    version text primary key,
    applied_at timestamptz not null default now()
  );
  `
  try {
    await executeSqlOverHttp(projectRef, key, sql)
  } catch (e: any) {
    const msg = String(e?.message || '')
    // Se o endpoint não estiver disponível, não podemos criar a tabela via HTTP
    // Mas isso não é crítico se a tabela já existir - vamos apenas logar o erro
    if (/requested path is invalid|not available|not enabled|endpoint.*disabled|dns error|failed to lookup|Name or service not known/i.test(msg)) {
      console.warn(`[check-and-apply-migrations] Cannot create migrations table via HTTP endpoint (endpoint unavailable). Table may already exist or will be created via fallback.`)
      // Não lançar erro aqui - a tabela pode já existir
    } else {
      throw e
    }
  }
}

async function getClientVersion(projectRef: string, key: string): Promise<number> {
  const clientUrl = `https://${projectRef}.supabase.co`
  
  // Tentar primeiro via Supabase JS client (mais confiável)
  try {
    const client = createClient(clientUrl, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
    
    // Consultar diretamente a tabela app_migrations usando Supabase JS
    const { data, error } = await client
      .from('app_migrations')
      .select('version')
      .order('applied_at', { ascending: false })
    
    if (error) {
      // Se a tabela não existir, retornar 0
      if (error.code === '42P01' || /does not exist|relation|table/i.test(error.message)) {
        return 0
      }
      throw error
    }
    
    if (!data || data.length === 0) {
      return 0
    }
    
    // Extrair números das versões e pegar o máximo
    const versions = data
      .map(row => {
        const v = String(row.version || '')
        // Extrair número da versão (pode ser '83', 'v83', etc.)
        const match = v.match(/^v?(\d+)/)
        return match ? parseInt(match[1], 10) : 0
      })
      .filter(v => v > 0)
    
    const maxVersion = versions.length > 0 ? Math.max(...versions) : 0
    return maxVersion
  } catch (e: any) {
    // Se falhar com Supabase JS, tentar via HTTP endpoint como fallback
    console.warn(`[check-and-apply-migrations] Failed to get version via Supabase client, trying HTTP endpoint:`, e?.message)
    
    try {
      // Query melhorada: extrair apenas números da versão e pegar o máximo
      const rs = await executeSqlOverHttp(projectRef, key, `
        select coalesce(
          max(
            case 
              when version ~ '^[0-9]+$' then version::int
              when version ~ '^v?[0-9]+' then (regexp_replace(version, '^v?([0-9]+).*', '\\1'))::int
              else 0
            end
          ),
          0
        )::int as v
        from public.app_migrations;
      `)
      
      // Processar resultado em diferentes formatos possíveis
      let row: any = null
      if (Array.isArray(rs)) {
        row = rs[0]
        if (Array.isArray(row)) {
          row = row[0]
        }
      } else if (rs && typeof rs === 'object') {
        row = rs
      }
      
      // Tentar diferentes formas de acessar o valor
      let v = 0
      if (row) {
        v = Number(row.v ?? row.V ?? row.version ?? row.VERSION ?? row[0] ?? 0)
      }
      
      if (!isFinite(v) && typeof rs === 'number') {
        v = rs
      }
      
      if (!isFinite(v) && Array.isArray(rs) && rs.length > 0) {
        const nums = rs.filter(x => typeof x === 'number' && isFinite(x))
        if (nums.length > 0) {
          v = Math.max(...nums)
        }
      }
      
      const finalVersion = isFinite(v) && v >= 0 ? v : 0
      
      // Log para debug se retornar 0
      if (finalVersion === 0) {
        console.log(`[check-and-apply-migrations] getClientVersion HTTP result:`, { rs, row, v, finalVersion })
      }
      
      return finalVersion
    } catch (httpErr: any) {
      const msg = String(httpErr?.message || '')
      if (/requested path is invalid|not available|not enabled|endpoint.*disabled|dns error|failed to lookup|Name or service not known/i.test(msg)) {
        console.warn(`[check-and-apply-migrations] Cannot get client version via HTTP endpoint (endpoint unavailable). Assuming version 0.`)
        return 0
      }
      console.error(`[check-and-apply-migrations] Error getting client version:`, httpErr?.message || String(httpErr))
      return 0
    }
  }
}

async function insertLog(master: any, log: {
  organization_id: string
  project_ref: string | null
  from_version: number
  to_version: number
  status: 'ok' | 'error'
  error?: string | null
  steps?: Step[]
}) {
  try {
    await master.from('client_migration_logs').insert({
      organization_id: log.organization_id,
      project_ref: log.project_ref,
      from_version: log.from_version,
      to_version: log.to_version,
      status: log.status,
      error: log.error || null,
      steps: log.steps ? JSON.stringify(log.steps) : null
    })
  } catch { /* ignore */ }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const masterUrl = Deno.env.get('SUPABASE_URL')!
    const masterKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const master = createClient(masterUrl, masterKey)

    // Auth user (must be logged into MASTER)
    const auth = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return json({ ok: false, error: 'Unauthorized' }, 401)
    const { data: authUser, error: authErr } = await master.auth.getUser(token)
    if (authErr || !authUser?.user) return json({ ok: false, error: 'Invalid token' }, 401)
    const userId = authUser.user.id

    // Parse input
    const url = new URL(req.url)
    const qOrg = url.searchParams.get('organization_id')
    const body = await req.json().catch(() => ({})) as { organization_id?: string, mode?: Mode, action?: Mode }
    const organizationId = body.organization_id || qOrg
    if (!organizationId) return json({ ok: false, error: 'organization_id required' }, 400)
    const mode: Mode = body.mode || body.action || 'auto'

    // Locate client credentials (prefer org-level)
    // Buscar organização no Master usando client_org_id OU id, garantindo que o usuário é o owner
    let orgRow: any = null
    {
      const { data, error: orgFetchErr } = await master
        .from('saas_organizations')
        .select('owner_id, client_supabase_url, client_service_key_encrypted, client_anon_key_encrypted, id, client_org_id')
        .or(`client_org_id.eq.${organizationId},id.eq.${organizationId}`)
        .eq('owner_id', userId)
        .maybeSingle()
      
      if (orgFetchErr) {
        console.error(`[check-and-apply-migrations] Erro ao buscar organização:`, orgFetchErr.message)
        return json({ ok: false, error: `organization_fetch_error: ${orgFetchErr.message}` }, 500)
      }
      
      orgRow = data || null
      if (!orgRow) {
        console.warn(`[check-and-apply-migrations] Organização não encontrada: orgId=${organizationId}, userId=${userId}`)
        return json({ ok: false, error: 'organization_not_found_or_not_owned' }, 404)
      }
      
      console.log(`[check-and-apply-migrations] Organização encontrada: id=${orgRow.id}, client_org_id=${orgRow.client_org_id}, owner_id=${orgRow.owner_id}, has_service_key=${Boolean(orgRow.client_service_key_encrypted)}`)
    }

    const projectRef = deriveProjectRefFromUrl(String(orgRow.client_supabase_url || '')) || null

    // Resolve service role key
    // Prioridade 1: saas_organizations.client_service_key_encrypted (escopo por organização)
    let serviceKey = ''
    if (orgRow.client_service_key_encrypted) {
      try { 
        serviceKey = atob(cleanBase64(String(orgRow.client_service_key_encrypted)))
        console.log(`[check-and-apply-migrations] Service role encontrada em saas_organizations para org ${organizationId}`)
      } catch (e: any) {
        console.warn(`[check-and-apply-migrations] Erro ao decodificar service role de saas_organizations:`, e?.message)
      }
    }
    
    // Prioridade 2: Fallback para saas_supabases_connections (repositório por owner+url)
    if (!serviceKey && orgRow.client_supabase_url) {
      try {
        const { data: conn, error: connErr } = await master
          .from('saas_supabases_connections')
          .select('service_role_encrypted')
          .eq('owner_id', userId)
          .eq('supabase_url', String(orgRow.client_supabase_url))
          .maybeSingle()
        
        if (connErr) {
          console.warn(`[check-and-apply-migrations] Erro ao buscar em saas_supabases_connections:`, connErr.message)
        } else if (conn?.service_role_encrypted) {
          try { 
            serviceKey = atob(cleanBase64(String(conn.service_role_encrypted)))
            console.log(`[check-and-apply-migrations] Service role encontrada em saas_supabases_connections para owner ${userId}`)
          } catch (e: any) {
            console.warn(`[check-and-apply-migrations] Erro ao decodificar service role de saas_supabases_connections:`, e?.message)
          }
        }
      } catch (e: any) {
        console.warn(`[check-and-apply-migrations] Erro ao buscar fallback em saas_supabases_connections:`, e?.message)
      }
    }
    
    if (!serviceKey) {
      console.error(`[check-and-apply-migrations] Service role não configurada para org ${organizationId}, owner ${userId}, url ${orgRow.client_supabase_url || 'N/A'}`)
      return json({ ok: false, error: 'service_role_not_configured' }, 400)
    }
    
    console.log(`[check-and-apply-migrations] Service role configurada e pronta para uso (org: ${organizationId})`)
    if (!projectRef) {
      return json({ ok: false, error: 'invalid_client_supabase_url' }, 400)
    }

    // Load master migrations + master version
    const masterVersion = await withMasterPg(getMasterMaxVersion)
    const masterMigrations = await withMasterPg(loadMasterMigrations)
    if (!masterMigrations || masterMigrations.length === 0) {
      return json({ ok: false, error: 'master_migrations_empty' }, 400)
    }

    // Ensure client table and read version
    await ensureClientMigrationsTable(projectRef, serviceKey)
    const clientVersionBefore = await getClientVersion(projectRef, serviceKey)
    
    // Log para debug: verificar o que está sendo detectado
    console.log(`[check-and-apply-migrations] Version check:`, {
      masterVersion,
      clientVersionBefore,
      masterMigrationsCount: masterMigrations.length,
      masterMigrationsVersions: masterMigrations.map(m => m.version).slice(0, 10) // primeiras 10 para não poluir
    })
    
    const pending = masterMigrations.filter(m => Number(m.version) > clientVersionBefore)

    if (pending.length === 0) {
      return json({
        ok: true,
        master_version: masterVersion,
        client_version_before: clientVersionBefore,
        client_version_after: clientVersionBefore,
        pending: 0,
        auto_applied: false
      })
    }

    if (mode === 'status') {
      return json({
        ok: true,
        master_version: masterVersion,
        client_version_before: clientVersionBefore,
        client_version_after: clientVersionBefore,
        pending: pending.length,
        auto_applied: false,
        pending_list: pending.map(p => ({ version: p.version, name: p.name }))
      })
    }

    // Acquire org lock
    let locked = false
    const pgClient = await (async () => {
      const dbUrl = Deno.env.get('SUPABASE_DB_URL') || Deno.env.get('DATABASE_URL')
      if (!dbUrl) throw new Error('Missing SUPABASE_DB_URL')
      const c = new PgClient(dbUrl)
      await c.connect()
      return c
    })()
    try {
      locked = await tryLockOrg(pgClient, String(orgRow.client_org_id || orgRow.id || organizationId))
      if (!locked) {
        return json({ ok: false, error: 'migration_in_progress' }, 409)
      }

      const steps: Step[] = []
      if (mode === 'apply' || mode === 'auto') {
        for (const m of pending) {
          try {
            // Remover BEGIN/COMMIT externos que possam ter vindo no SQL canônico
            const sanitized = stripOuterTransaction(String(m.sql || ''))
            const wrapped = `
            begin;
            set local statement_timeout = '300s';
            ${sanitized}
            insert into public.app_migrations(version, applied_at) values ('${String(m.version)}', now())
            on conflict (version) do nothing;
            commit;`
            await executeSqlOverHttp(projectRef, serviceKey, wrapped)
            steps.push({ version: m.version, name: m.name, status: 'success' })
          } catch (e: any) {
            const msg = String(e?.message || '')
            const isEndpointUnavailable = /requested path is invalid|Unknown response|non-JSON response|unexpected binary|Invalid JSON|not available|not enabled|not configured|Invalid response format|endpoint.*disabled|dns error|failed to lookup|Name or service not known|Connect.*error/i.test(msg)
            if (isEndpointUnavailable) {
              // Tentar fallback via Edge Function do CLIENTE aplicando o restante das migrations
              try {
                const remaining = [{ version: m.version, name: m.name, sql: String(m.sql || '') }]
                const index = pending.findIndex(p => p.version === m.version)
                if (index >= 0 && index + 1 < pending.length) {
                  for (let k = index + 1; k < pending.length; k++) {
                    remaining.push({ version: pending[k].version, name: pending[k].name, sql: String(pending[k].sql || '') })
                  }
                }
                const fb = await applyViaClientFunction(projectRef, serviceKey, remaining, masterVersion)
                // Mapear resultados do fallback em nossos steps
                for (const s of fb.steps) {
                  const v = Number(String(s.id || '').replace(/\D+/g, ''))
                  steps.push({ version: v || m.version, name: s.name, status: s.status, error: s.error })
                }
                // Parar loop após fallback (o restante foi aplicado em lote)
                break
              } catch (fallbackErr: any) {
                steps.push({ version: m.version, name: m.name, status: 'error', error: `fallback_failed: ${fallbackErr?.message || fallbackErr}` })
                await insertLog(master, {
                  organization_id: String(orgRow.client_org_id || orgRow.id || organizationId),
                  project_ref: projectRef,
                  from_version: clientVersionBefore,
                  to_version: masterVersion,
                  status: 'error',
                  error: `Migration ${m.version} failed (http endpoint unavailable) and fallback failed: ${String(fallbackErr?.message || fallbackErr)}`,
                  steps
                })
                return json({
                  ok: false,
                  master_version: masterVersion,
                  client_version_before: clientVersionBefore,
                  client_version_after: await getClientVersion(projectRef, serviceKey),
                  pending: pending.length,
                  auto_applied: false,
                  steps,
                  error: `migration_failed_${m.version}_and_fallback_failed`
                }, 500)
              }
            } else {
              steps.push({ version: m.version, name: m.name, status: 'error', error: msg || 'unknown_error' })
              // Log and stop on first failure
              await insertLog(master, {
                organization_id: String(orgRow.client_org_id || orgRow.id || organizationId),
                project_ref: projectRef,
                from_version: clientVersionBefore,
                to_version: masterVersion,
                status: 'error',
                error: `Migration ${m.version} failed: ${msg}`,
                steps
              })
              return json({
                ok: false,
                master_version: masterVersion,
                client_version_before: clientVersionBefore,
                client_version_after: await getClientVersion(projectRef, serviceKey),
                pending: pending.length,
                auto_applied: false,
                steps,
                error: `migration_failed_${m.version}`
              }, 500)
            }
          }
        }
      }

      const clientVersionAfter = await getClientVersion(projectRef, serviceKey)
      await insertLog(master, {
        organization_id: String(orgRow.client_org_id || orgRow.id || organizationId),
        project_ref: projectRef,
        from_version: clientVersionBefore,
        to_version: clientVersionAfter,
        status: 'ok',
        steps
      })

      return json({
        ok: true,
        master_version: masterVersion,
        client_version_before: clientVersionBefore,
        client_version_after: clientVersionAfter,
        pending: pending.length,
        auto_applied: mode !== 'status',
        steps
      })
    } finally {
      try {
        if (locked) await releaseLockOrg(pgClient, String(orgRow.client_org_id || orgRow.id || organizationId))
      } catch { /* ignore */ }
      try { await pgClient.end() } catch {}
    }
  } catch (e: any) {
    console.error('check-and-apply-migrations error:', e)
    return json({ ok: false, error: e?.message || 'internal_error' }, 500)
  }
})


