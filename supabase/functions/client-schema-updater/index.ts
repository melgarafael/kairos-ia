// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

// Use the official Postgres driver for Deno to execute raw SQL
import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts'

type Migration = {
  id: string
  name: string
  sql?: string
  sqlUrl?: string
  versionTag?: string
  checksum?: string
}

type Manifest = {
  version: string
  migrations: Migration[]
}

type RequestBody = {
  action: 'plan' | 'apply' | 'status' | 'status_public' | 'get_code'
  manifest?: Manifest
  manifestUrl?: string
}

function stripOuterTransactionWrappers(sqlText: string): string {
  // Robustly remove an outer BEGIN/COMMIT pair that may be preceded by comments
  // or SET statements at the top of the script. We avoid touching BEGIN/END
  // inside plpgsql bodies ($$ ... $$) by only checking the very beginning and
  // very end of the script after skipping harmless prelude/epilogue lines.
  let text = (sqlText || '').replace(/^\uFEFF/, '')

  const lines = text.split(/\r?\n/)

  // Move past leading comments/blank lines and common SET lines
  let i = 0
  while (i < lines.length) {
    const t = lines[i].trim()
    if (t === '' || t.startsWith('--')) { i++; continue }
    if (/^set\s+(local\s+)?search_path\b/i.test(t)) { i++; continue }
    if (/^set\s+(local\s+)?statement_timeout\b/i.test(t)) { i++; continue }
    break
  }

  // Remove a single leading BEGIN; right after the prelude
  if (i < lines.length && /^begin;?$/i.test(lines[i].trim())) {
    lines.splice(i, 1)
    // Trim following empty lines
    while (i < lines.length && lines[i].trim() === '') lines.splice(i, 1)
  }

  // Find last meaningful line (ignoring trailing comments/whitespace)
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

const allowedOrigins = (Deno.env.get('CORS_ORIGINS') || Deno.env.get('CORS_ORIGIN') || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

function getCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('Origin') || ''
  const allowOrigin = allowedOrigins.length === 0
    ? '*'
    : (allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  }
}

// Normalizar connection string para garantir SSL, porta e formato compatível com o driver
function normalizeDatabaseUrl(url: string): string {
  if (!url) return url
  try {
    // Normalizar esquema para "postgres://" (alguns drivers não aceitam "postgresql://")
    let normalized = url.trim().replace(/^postgresql:\/\//i, 'postgres://')

    // Tentar fazer o parsing para manipular porta e querystring
    const u = new URL(normalized)

    // Garantir sslmode=require
    u.searchParams.set('sslmode', 'require')

    // Remover parâmetros que podem não ser reconhecidos pelo driver
    // (o pgbouncer continua funcional apenas pela porta 6543)
    if (u.searchParams.has('pgbouncer')) u.searchParams.delete('pgbouncer')

    // Se a porta não estiver definida, usar a 6543 (pool/pgbouncer do Supabase)
    // Caso a URL esteja na porta 5432, manter; se já estiver 6543, manter.
    if (!u.port) {
      u.port = '6543'
    }

    // Garantir que o caminho (database) exista
    if (!u.pathname || u.pathname === '/') {
      u.pathname = '/postgres'
    }

    return u.toString()
  } catch {
    // Fallback: apenas garantir sslmode=require sem quebrar a string original
    if (url.includes('sslmode=')) return url
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}sslmode=require`
  }
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  // Priorizar DATABASE_URL (oficial do Supabase). Manter SUPABASE_DB_URL como compatibilidade.
  const dbUrlRaw = Deno.env.get('DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL')
  if (!dbUrlRaw) {
    throw new Error('Missing SUPABASE_DB_URL (or DATABASE_URL) env var')
  }
  
  // Normalizar URL para garantir SSL
  const dbUrl = normalizeDatabaseUrl(dbUrlRaw)
  
  const client = new Client(dbUrl)
  try {
    await client.connect()
    return await fn(client)
  } catch (err: any) {
    // Melhorar mensagem de erro para "Unknown response for startup: N"
    const errorMsg = err?.message || String(err)
    const errorStr = String(err)
    
    // Log detalhado para debug (sem expor a senha)
    const urlForLog = dbUrl.replace(/:[^:@]+@/, ':****@') // Ocultar senha no log
    console.error(`[DB Connection Error] URL: ${urlForLog}, Error: ${errorMsg}`)
    
    if (errorMsg.includes('Unknown response for startup') || errorStr.includes('Unknown response for startup')) {
      // Verificar se a URL tem sslmode
      const hasSslMode = dbUrl.includes('sslmode=')
      const hasSslModeRequire = dbUrl.includes('sslmode=require')
      
      let suggestions = []
      if (!hasSslMode) {
        suggestions.push('A URL não inclui parâmetro SSL. Adicione ?sslmode=require no final da URL.')
      } else if (!hasSslModeRequire) {
        suggestions.push('A URL tem sslmode mas não está como "require". Use ?sslmode=require')
      }
      suggestions.push('Verifique se a senha está correta (mesmo sem caracteres especiais)')
      suggestions.push('Verifique se o formato está correto: postgresql://postgres:[SENHA]@db.[PROJECT_REF].supabase.co:6543/postgres?sslmode=require')
      
      throw new Error(`Erro de conexão ao banco de dados: ${errorMsg}. ${suggestions.join(' ')}`)
    }
    throw err
  } finally {
    try {
      await client.end()
    } catch {
      // Ignorar erros ao fechar conexão
    }
  }
}

async function ensureMigrationsTable(client: Client) {
  await client.queryObject`
    create table if not exists public.tomikcrm_schema_migrations (
      id text primary key,
      name text not null,
      version text,
      checksum text,
      status text not null default 'applied',
      applied_at timestamptz not null default now()
    );
  `
}

async function getAppliedIds(client: Client): Promise<Set<string>> {
  const result = await client.queryObject<{ id: string }>`
    select id from public.tomikcrm_schema_migrations order by applied_at asc;
  `
  return new Set((result.rows || []).map(r => r.id))
}

async function getAppMigrationVersions(client: Client): Promise<Set<string>> {
  try {
    const exists = await client.queryObject<{ exists: boolean }>`
      select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'app_migrations'
      ) as exists;
    `
    if (!exists.rows?.[0]?.exists) return new Set()
    const res = await client.queryObject<{ version: string }>`
      select version from public.app_migrations;
    `
    return new Set((res.rows || []).map(r => r.version))
  } catch {
    return new Set()
  }
}

async function acquireLock(client: Client): Promise<boolean> {
  const res = await client.queryObject<{ pg_try_advisory_lock: boolean }>`
    select pg_try_advisory_lock(hashtext('tomikcrm_schema_upgrade')::bigint);
  `
  return Boolean(res.rows?.[0]?.pg_try_advisory_lock)
}

async function releaseLock(client: Client) {
  await client.queryArray(`select pg_advisory_unlock(hashtext('tomikcrm_schema_upgrade')::bigint);`)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody
    // Public status: allow without auth just to detect function existence
    if (body?.action === 'status_public') {
      return new Response(JSON.stringify({ ok: true, function: true }), {
        headers: { 'content-type': 'application/json', ...getCorsHeaders(req) },
        status: 200
      })
    }

    // Get current function code - allow without auth for comparison
    if (body?.action === 'get_code') {
      try {
        // Try to read the current file's code
        // In Supabase Edge Functions, the file is typically at ./index.ts relative to the function directory
        let code = ''
        try {
          // Try reading from the current file path
          const currentFile = new URL(import.meta.url)
          if (currentFile.protocol === 'file:') {
            code = await Deno.readTextFile(currentFile.pathname)
          } else {
            // If running in Supabase, try relative path
            code = await Deno.readTextFile('./index.ts')
          }
        } catch {
          // Fallback: try reading from Deno.cwd()
          try {
            const cwd = Deno.cwd()
            code = await Deno.readTextFile(`${cwd}/index.ts`)
          } catch {
            // Last resort: try just index.ts
            code = await Deno.readTextFile('index.ts')
          }
        }
        
        if (!code) {
          throw new Error('Could not read function code')
        }
        
        // Return code hash for comparison (simple hash)
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
        const hashArray = Array.from(new Uint8Array(hash))
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
        return new Response(JSON.stringify({ 
          ok: true, 
          code: code,
          hash: hashHex.substring(0, 16) // First 16 chars for comparison
        }), {
          headers: { 'content-type': 'application/json', ...getCorsHeaders(req) },
          status: 200
        })
      } catch (err: any) {
        return new Response(JSON.stringify({ 
          ok: false, 
          error: err?.message || 'Failed to read code' 
        }), {
          headers: { 'content-type': 'application/json', ...getCorsHeaders(req) },
          status: 500
        })
      }
    }

    if (!body?.action) {
      return new Response('Missing action', { status: 400, headers: getCorsHeaders(req) })
    }

    if (body.action === 'status') {
      const hasDbUrl = Boolean(Deno.env.get('SUPABASE_DB_URL') || Deno.env.get('DATABASE_URL'))
      let canConnect = false
      let connectionError: string | null = null
      let errorType: 'auth' | 'network' | 'other' | null = null
      
      if (hasDbUrl) {
        try {
          await withClient(async (client) => {
            await client.queryArray('select 1;')
          })
          canConnect = true
        } catch (err: any) {
          canConnect = false
          const errorMsg = err?.message || String(err)
          connectionError = errorMsg
          
          // Detectar tipo de erro baseado na mensagem
          const msgLower = errorMsg.toLowerCase()
          // "Unknown response for startup: N" geralmente indica senha incorreta ou formato inválido
          if (msgLower.includes('password') || 
              msgLower.includes('authentication') || 
              msgLower.includes('password authentication failed') ||
              msgLower.includes('invalid password') ||
              msgLower.includes('wrong password') ||
              msgLower.includes('unknown response for startup') ||
              msgLower.includes('startup: n')) {
            errorType = 'auth'
          } else if (msgLower.includes('timeout') || 
                     msgLower.includes('connection') || 
                     msgLower.includes('network') ||
                     msgLower.includes('econnrefused') ||
                     msgLower.includes('enotfound')) {
            errorType = 'network'
          } else {
            errorType = 'other'
          }
        }
      }
      return new Response(JSON.stringify({ 
        ok: true, 
        function: true, 
        dbConfigured: hasDbUrl, 
        dbConnectable: canConnect,
        connectionError: connectionError || undefined,
        errorType: errorType || undefined
      }), {
        headers: { 'content-type': 'application/json', ...getCorsHeaders(req) },
        status: 200
      })
    }
    let manifest: Manifest | undefined = body.manifest
    if (body.action === 'auto_apply') {
      // Unauthenticated auto apply (triggered by app login or scheduler). Idempotent.
      const result = await withClient(async (client) => {
        await ensureMigrationsTable(client)
        const appliedIds = await getAppliedIds(client)
        // Support optional manifestUrl or manifest; fallback to error if missing
        let manifestLocal: Manifest | undefined = body.manifest
        if (!manifestLocal && body.manifestUrl) {
          const res = await fetch(body.manifestUrl, { headers: { 'cache-control': 'no-cache' } })
          if (res.ok) manifestLocal = await res.json() as Manifest
        }
        if (!manifestLocal) {
          return { ok: false, error: 'Missing manifest for auto_apply' }
        }
        const pending = manifestLocal.migrations.filter(m => !appliedIds.has(m.id))
        const steps: Array<{ id: string; name: string; status: 'success' | 'error'; error?: string }> = []
        try {
          for (const m of pending) {
            try {
              await client.queryArray('begin;')
              await client.queryArray(`set local statement_timeout to '300s';`)
              const sql = stripOuterTransactionWrappers(m.sql || '')
              await client.queryArray(sql)
              await client.queryObject`
                insert into public.tomikcrm_schema_migrations(id, name, version, checksum, status)
                values(${m.id}, ${m.name}, ${manifestLocal.version}, ${m.checksum || null}, 'applied')
                on conflict (id) do nothing;
              `
              await client.queryArray('commit;')
              steps.push({ id: m.id, name: m.name, status: 'success' })
            } catch (e: any) {
              await client.queryArray('rollback;')
              steps.push({ id: m.id, name: m.name, status: 'error', error: e?.message || String(e) })
              return { ok: false, steps, error: `Migration failed: ${m.id}` }
            }
          }
        } catch {}
        return { ok: true, steps }
      })
      return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json', ...getCorsHeaders(req) }, status: 200 })
    }

    const auth = req.headers.get('authorization') || ''
    if (!auth.toLowerCase().startsWith('bearer ')) {
      return new Response('Missing bearer token', { status: 401, headers: getCorsHeaders(req) })
    }

    if (!manifest && body.manifestUrl) {
      const res = await fetch(body.manifestUrl, { headers: { 'cache-control': 'no-cache' } })
      if (!res.ok) {
        return new Response(`Failed to fetch manifest: HTTP ${res.status}`, { status: 400, headers: getCorsHeaders(req) })
      }
      manifest = await res.json() as Manifest
    }
    if (!manifest) {
      return new Response('Missing manifest (provide manifest or manifestUrl)', { status: 400, headers: getCorsHeaders(req) })
    }

    if (!manifest.migrations || !Array.isArray(manifest.migrations)) {
      return new Response('Invalid manifest', { status: 400, headers: getCorsHeaders(req) })
    }

    const result = await withClient(async (client) => {
      await ensureMigrationsTable(client)
      const appliedIds = await getAppliedIds(client)
      const appliedVersions = await getAppMigrationVersions(client)
      // Infer highest numeric version (e.g., '5' => 5). Treat non-numeric as 0.
      let highest = 0
      for (const v of appliedVersions) {
        const n = parseInt(String(v), 10)
        if (!isNaN(n)) highest = Math.max(highest, n)
      }

      const pending = manifest!.migrations.filter(m => {
        if (appliedIds.has(m.id)) return false
        if (m.versionTag && appliedVersions.has(m.versionTag)) return false
        // If we have a highest applied version, skip any migration with versionTag <= highest
        if (m.versionTag) {
          const n = parseInt(String(m.versionTag), 10)
          if (!isNaN(n) && n <= highest) return false
        }
        return true
      })

      if (body.action === 'plan') {
        return {
          ok: true,
          currentVersion: manifest!.version,
          totalMigrations: manifest!.migrations.length,
          pendingCount: pending.length,
          pending: pending.map(m => ({ id: m.id, name: m.name }))
        }
      }

      // action === 'apply'
      const locked = await acquireLock(client)
      if (!locked) {
        return { ok: false, error: 'Another migration process is running (lock busy)' }
      }

      const steps: Array<{ id: string; name: string; status: 'success' | 'error'; error?: string }> = []

      try {
        for (const m of pending) {
          try {
            await client.queryArray('begin;')
            // Optional: set statement timeout per migration
            await client.queryArray(`set local statement_timeout to '300s';`)
            let sqlText = m.sql
            if (!sqlText && m.sqlUrl) {
              const fetched = await fetch(m.sqlUrl, { headers: { 'cache-control': 'no-cache' } })
              if (!fetched.ok) throw new Error(`Failed to fetch SQL: ${m.sqlUrl} (HTTP ${fetched.status})`)
              sqlText = await fetched.text()
            }
            if (!sqlText) throw new Error('Missing SQL for migration')
            const normalized = stripOuterTransactionWrappers(sqlText)
            await client.queryArray(normalized)
            await client.queryObject`
              insert into public.tomikcrm_schema_migrations(id, name, version, checksum, status)
              values(${m.id}, ${m.name}, ${manifest!.version}, ${m.checksum || null}, 'applied')
              on conflict (id) do nothing;
            `
            await client.queryArray('commit;')
            steps.push({ id: m.id, name: m.name, status: 'success' })
          } catch (e: any) {
            await client.queryArray('rollback;')
            steps.push({ id: m.id, name: m.name, status: 'error', error: e?.message || String(e) })
            return { ok: false, steps, error: `Migration failed: ${m.id}` }
          }
        }
      } finally {
        await releaseLock(client)
      }

      return { ok: true, steps }
    })

    return new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json', ...getCorsHeaders(req) },
      status: 200
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || String(err) }), {
      headers: { 'content-type': 'application/json', ...getCorsHeaders(req) },
      status: 500
    })
  }
})


