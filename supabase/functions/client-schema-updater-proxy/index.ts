// @ts-nocheck
// Master Edge Function: client-schema-updater-proxy
// Objetivo: Planejar e aplicar migrações no Client Supabase SEM precisar de function no projeto do cliente.
// Estratégia: usar o endpoint SQL HTTP do projeto do cliente com a service role armazenada no Master.
// Esta função executa migrations diretamente via HTTP, eliminando a necessidade de configuração no Supabase do cliente.
// 
// Busca credenciais de saas_supabases_connections baseado na organização atual do usuário.
// Suporta múltiplos Supabase por usuário, buscando a conexão correta para a organização ativa.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Migration = { id: string; name: string; sql: string; versionTag?: string; checksum?: string }
type Manifest = { version: string; migrations: Migration[] }

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

function deriveProjectRefFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname // <ref>.supabase.co
    const parts = host.split('.')
    if (parts.length >= 3 && parts[1] === 'supabase') return parts[0]
    return null
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
 * Executa SQL diretamente no Supabase do cliente via HTTP endpoint
 * Usa o endpoint /postgres/v1/query que está disponível em todos os projetos Supabase
 */
async function executeSqlOverHttp(projectRef: string, serviceRoleKey: string, sql: string) {
  const endpoints = [
    `https://${projectRef}.supabase.co/postgres/v1/query`,
    `https://${projectRef}.supabase.net/postgres/v1/query`
  ]
  let lastErr: any = null
  let lastResponseText: string | null = null
  let lastContentType: string | null = null
  
  for (const endpoint of endpoints) {
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
      
      // Capturar content-type e texto da resposta para debug
      lastContentType = res.headers.get('content-type') || 'unknown'
      lastResponseText = null
      
      // Tentar ler como texto primeiro para detectar respostas não-JSON
      let body: any = null
      const responseText = await res.text().catch(() => null)
      lastResponseText = responseText || null
      
      // Verificar se a resposta parece ser binária ou protocolo PostgreSQL
      if (responseText && (responseText.length < 2 || (!responseText.trim().startsWith('{') && !responseText.trim().startsWith('[')))) {
        // Verificar se é o erro específico "Unknown response for startup: N"
        if (responseText.includes('Unknown response for startup') || responseText.includes('startup: N')) {
          throw new Error(`PostgreSQL protocol error detected. The /postgres/v1/query endpoint may not be enabled in this Supabase project, or the service role key is invalid. Please verify: 1) The endpoint is enabled in your Supabase project settings, 2) The service role key is correct and has proper permissions.`)
        }
        // Pode ser uma resposta binária ou protocolo PostgreSQL
        const firstChars = responseText.substring(0, 50).replace(/[^\x20-\x7E]/g, '?')
        throw new Error(`Invalid response format from endpoint. Expected JSON but got: ${firstChars}... (content-type: ${lastContentType}). This usually means the /postgres/v1/query endpoint is not enabled or the service role key is invalid.`)
      }
      
      // Tentar parsear como JSON
      try {
        body = responseText ? JSON.parse(responseText) : null
      } catch (parseErr: any) {
        throw new Error(`Failed to parse JSON response: ${parseErr?.message}. Response preview: ${(responseText || '').substring(0, 200)}... (content-type: ${lastContentType})`)
      }
      
      if (!res.ok) {
        const msg = body?.error?.message || body?.message || body?.error || `HTTP ${res.status}`
        const detailedMsg = lastContentType !== 'application/json' 
          ? `${msg} (unexpected content-type: ${lastContentType})`
          : msg
        throw new Error(`${detailedMsg} @ ${endpoint}`)
      }
      
      return body
    } catch (e: any) {
      lastErr = e
      // Se não é um erro de JSON parsing que já tem mensagem detalhada, continuar para tentar próximo endpoint
      if (e?.message?.includes('Invalid response format') || e?.message?.includes('Failed to parse JSON')) {
        // Este é um erro crítico que indica problema de configuração, não tentar próximo endpoint
        throw e
      }
    }
  }
  
  // Construir mensagem de erro mais descritiva
  let errorMsg = lastErr?.message || 'sql_http_failed'
  if (lastResponseText && lastResponseText.length < 100) {
    errorMsg += `. Response preview: ${lastResponseText.substring(0, 100)}`
  }
  if (lastContentType && lastContentType !== 'application/json') {
    errorMsg += `. Content-Type: ${lastContentType}`
  }
  
  throw new Error(errorMsg)
}

/**
 * Garante que as tabelas de controle de migrations existem no cliente
 */
async function ensureTables(projectRef: string, key: string) {
  const sql = `
  create table if not exists public.tomikcrm_schema_migrations(
    id text primary key,
    name text,
    checksum text,
    applied_at timestamptz default now()
  );
  create table if not exists public.app_migrations(
    version text primary key,
    applied_at timestamptz default now()
  );
  `
  await executeSqlOverHttp(projectRef, key, sql)
}

/**
 * Busca as migrations já aplicadas no cliente
 */
async function getAppliedMigrations(projectRef: string, key: string): Promise<Set<string>> {
  try {
    const rows = await executeSqlOverHttp(projectRef, key, 'select id from public.tomikcrm_schema_migrations;')
    const set = new Set<string>()
    const list = Array.isArray(rows) ? rows : (rows?.[0]?.result || [])
    for (const r of list) {
      const id = r?.id || r?.ID || r?.Id
      if (id) set.add(String(id))
    }
    return set
  } catch {
    // Se a tabela não existir ainda, retorna set vazio
    return new Set<string>()
  }
}

/**
 * Planeja quais migrations precisam ser aplicadas
 */
async function plan(projectRef: string, key: string, manifest: Manifest) {
  await ensureTables(projectRef, key)
  const applied = await getAppliedMigrations(projectRef, key)
  const pending = (manifest.migrations || []).filter(m => !applied.has(m.id))
  return {
    ok: true,
    currentVersion: manifest.version,
    totalMigrations: manifest.migrations.length,
    pendingCount: pending.length,
    pending: pending.map(p => ({ id: p.id, name: p.name }))
  }
}

/**
 * Aplica todas as migrations pendentes no cliente
 */
async function applyAll(projectRef: string, key: string, manifest: Manifest) {
  await ensureTables(projectRef, key)
  const applied = await getAppliedMigrations(projectRef, key)
  const steps: Array<{ id: string; name: string; status: 'success' | 'error'; error?: string }> = []
  
  for (const m of manifest.migrations) {
    if (applied.has(m.id)) {
      steps.push({ id: m.id, name: m.name, status: 'success' })
      continue
    }
    
    try {
      // Executar SQL da migração (já vem com timeout injetado quando chamado)
      await executeSqlOverHttp(projectRef, key, m.sql)
      
      // Registrar aplicação na tabela de controle
      const ins = `insert into public.tomikcrm_schema_migrations(id, name, checksum) values ('${m.id.replace(/'/g, "''")}', '${m.name.replace(/'/g, "''")}', ${m.checksum ? `'${m.checksum.replace(/'/g, "''")}'` : 'null'}) on conflict (id) do nothing;`
      await executeSqlOverHttp(projectRef, key, ins)
      
      // Registrar versão se houver versionTag
      if (m.versionTag) {
        const v = m.versionTag.replace(/'/g, "''")
        await executeSqlOverHttp(projectRef, key, `insert into public.app_migrations(version, applied_at) values ('${v}', now()) on conflict(version) do nothing;`)
      }
      
      steps.push({ id: m.id, name: m.name, status: 'success' })
    } catch (e: any) {
      steps.push({ id: m.id, name: m.name, status: 'error', error: e?.message || 'unknown_error' })
      // Interrompe a execução em caso de erro
      break
    }
  }
  
  return { ok: true, steps }
}

// Removido: callClientFunction - não precisamos mais chamar edge function do cliente
// Executamos migrations diretamente via HTTP sempre

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const masterUrl = Deno.env.get('SUPABASE_URL')!
    const masterKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const master = createClient(masterUrl, masterKey)

    // Autenticação: verificar token do usuário
    const auth = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return json({ ok: false, error: 'Unauthorized' }, 401)

    const { data: authUser, error: authErr } = await master.auth.getUser(token)
    if (authErr || !authUser?.user) return json({ ok: false, error: 'Invalid token' }, 401)
    const userId = authUser.user.id

    // Parse do payload
    const payload = await req.json().catch(() => ({})) as { 
      action?: 'plan' | 'apply'
      projectRef?: string
      manifest?: Manifest
      manifestUrl?: string
      organization_id?: string
    }
    const action = payload.action || 'plan'

    // Buscar organização atual do usuário: agora REQUER organization_id explícito (não usar saas_users)
    const organizationId: string | null = payload.organization_id ? String(payload.organization_id) : null

    if (!organizationId) {
      return json({ ok: false, error: 'organization_id is required' }, 400)
    }

    // Verificar se o usuário é o owner da organização
    // Importante: organizationId pode ser o ID do MASTER OU o client_org_id (ID do Client)
    const { data: orgRow, error: orgErr } = await master
      .from('saas_organizations')
      .select('owner_id, client_supabase_url, client_service_key_encrypted, client_anon_key_encrypted, id, client_org_id')
      .eq('client_org_id', organizationId)
      .eq('owner_id', userId)
      .maybeSingle()

    if (orgErr || !orgRow) {
      return json({ ok: false, error: 'Organization not found (expecting client_org_id)' }, 400)
    }

    // Prioridade 1: credenciais por organização (MASTER -> public.saas_organizations)
    // Se existir client_service_key_encrypted/anon_key_encrypted aqui, usar estas credenciais
    let serviceKeyFromOrg = ''
    if (orgRow.client_service_key_encrypted) {
      try { serviceKeyFromOrg = atob(String(orgRow.client_service_key_encrypted)) } catch {}
    } else if (orgRow.client_anon_key_encrypted) {
      try { serviceKeyFromOrg = atob(String(orgRow.client_anon_key_encrypted)) } catch {}
    }

    // Resolver projectRef preferindo o salvo na org
    const orgProjectRef = orgRow.client_supabase_url ? deriveProjectRefFromUrl(String(orgRow.client_supabase_url)) : null

    // Fallback: buscar credenciais no repositório de conexões do usuário
    // Prioridade: conexão que corresponde à URL da organização (se existir), senão a mais recente com service_role
    let connectionRow: any = null
    if (!serviceKeyFromOrg) {
      if (orgRow.client_supabase_url) {
        const { data: connByUrl } = await master
          .from('saas_supabases_connections')
          .select('supabase_url, service_role_encrypted, anon_key_encrypted')
          .eq('owner_id', userId)
          .eq('supabase_url', orgRow.client_supabase_url)
          .maybeSingle()
        connectionRow = connByUrl
      }

      if (!connectionRow) {
        const { data: connections } = await master
          .from('saas_supabases_connections')
          .select('supabase_url, service_role_encrypted, anon_key_encrypted')
          .eq('owner_id', userId)
          .not('service_role_encrypted', 'is', null)
          .order('last_used_at', { ascending: false, nullsFirst: false })
          .order('updated_at', { ascending: false })
          .limit(1)
        connectionRow = connections?.[0] || null
      }
      if (!connectionRow) {
        return json({ ok: false, error: 'No Supabase connection found for this user/organization. Please configure a connection or set credentials on the organization.' }, 400)
      }
    }

    // Resolver projectRef (pode vir do payload ou ser derivado da URL da org/conexão)
    const storedProjectRef = orgProjectRef || (connectionRow ? deriveProjectRefFromUrl(connectionRow.supabase_url) : null)
    const effectiveProjectRef = payload.projectRef || storedProjectRef
    if (!effectiveProjectRef) return json({ ok: false, error: 'projectRef not resolved' }, 400)
    if (storedProjectRef && payload.projectRef && storedProjectRef !== payload.projectRef) {
      return json({ ok: false, error: 'projectRef mismatch with stored supabase_url' }, 400)
    }

    // Determinar a chave a ser usada
    let serviceKey = serviceKeyFromOrg
    if (!serviceKey) {
      // Descriptografar service role key (preferir service_role_encrypted, fallback para anon_key_encrypted)
      const serviceKeyB64 = connectionRow.service_role_encrypted || connectionRow.anon_key_encrypted
      if (!serviceKeyB64) {
        return json({ ok: false, error: 'service role not configured. Set it on organization or in connections repository.' }, 400)
      }
      // Base64 safe-decoding
      function safeB64Decode(s: string) {
        try {
          let v = (s || '').toString().trim().replace(/\s+/g, '')
          v = v.replace(/-/g, '+').replace(/_/g, '/')
          while (v.length % 4 !== 0) v += '='
          return atob(v)
        } catch { return s }
      }
      serviceKey = safeB64Decode(serviceKeyB64)
    }

    // Carregar manifest (pode vir no payload ou de uma URL)
    let manifest: Manifest | null = null
    if (payload.manifest && Array.isArray(payload.manifest.migrations)) {
      manifest = payload.manifest
    } else if (payload.manifestUrl) {
      const r = await fetch(payload.manifestUrl).catch(() => null)
      if (!r || !r.ok) return json({ ok: false, error: 'Failed to fetch manifest url' }, 400)
      manifest = await r.json().catch(() => null)
    }
    if (!manifest) return json({ ok: false, error: 'manifest required' }, 400)

    // Executar migrations diretamente via HTTP (SEM depender de edge function no cliente)
    // Isso elimina a necessidade do cliente ter que criar secrets e edge functions
    try {
      if (action === 'apply') {
        // Injetar timeout maior em cada migração para evitar timeouts
        const boosted: typeof manifest = {
          ...manifest,
          migrations: (manifest.migrations || []).map(m => ({
            ...m,
            sql: `set statement_timeout = '300s';\n${m.sql}`
          }))
        }
        const result = await applyAll(effectiveProjectRef, serviceKey, boosted)
        return json(result)
      } else {
        // action === 'plan'
        const planResult = await plan(effectiveProjectRef, serviceKey, manifest)
        return json(planResult)
      }
    } catch (err: any) {
      const errMsg = String(err?.message || 'unknown_error')
      return json({ ok: false, error: `Migration execution failed: ${errMsg}` }, 500)
    }

  } catch (e: any) {
    console.error('Error in client-schema-updater-proxy:', e)
    return json({ ok: false, error: e?.message || 'internal_error' }, 500)
  }
})


