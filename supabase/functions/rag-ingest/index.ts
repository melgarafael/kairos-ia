// @ts-nocheck
import { serve } from 'https://deno.land/std@0.181.0/http/server.ts'

function getCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin') || '*'
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': req.headers.get('access-control-request-headers') || '*',
    'access-control-allow-methods': 'POST,OPTIONS',
    'access-control-max-age': '86400',
    'vary': 'origin'
  }
}

// Util simples
function safeString(v: any): string { try { if (v == null) return ''; return String(v) } catch { return '' } }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  const cors = getCorsHeaders(req)
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors })
    const { source_id, mapping, options } = await req.json().catch(() => ({}))
    if (!source_id) return new Response(JSON.stringify({ error: 'source_id_required' }), { status: 400, headers: { ...cors, 'content-type': 'application/json' } })

    const url = new URL(req.url)
    const projectUrl = url.origin.replace('.functions.supabase.co', '.supabase.co')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE') || Deno.env.get('UPDATE_SERVICE_ROLE_KEY') || ''
    if (!serviceRole) return new Response(JSON.stringify({ error: 'missing_service_role' }), { status: 500, headers: { ...cors, 'content-type': 'application/json' } })

    // Buscar source para abrir arquivo
    const sourceResp = await fetch(`${projectUrl}/rest/v1/rag_sources?id=eq.${source_id}&select=*`, { headers: { 'Authorization': `Bearer ${serviceRole}`, 'apikey': serviceRole } })
    const [source] = await sourceResp.json()
    if (!source?.storage_path) return new Response(JSON.stringify({ error: 'source_not_found' }), { status: 404, headers: { ...cors, 'content-type': 'application/json' } })

    // Baixar arquivo
    const download = await fetch(`${projectUrl}/storage/v1/object/${encodeURIComponent(source.storage_path)}`, { headers: { 'Authorization': `Bearer ${serviceRole}`, 'apikey': serviceRole } })
    if (!download.ok) return new Response(JSON.stringify({ error: 'download_failed' }), { status: 500, headers: { ...cors, 'content-type': 'application/json' } })
    const buf = new Uint8Array(await download.arrayBuffer())

    const mime = source.mime_type || 'text/csv'
    let rows: any[] = []
    if (mime.includes('csv') || source.storage_path.endsWith('.csv')) {
      const text = new TextDecoder().decode(buf)
      const { parse } = await import('npm:papaparse@5.4.1') as any
      const result = parse(text, { header: true, skipEmptyLines: true })
      rows = Array.isArray(result?.data) ? result.data : []
    } else if (mime.includes('sheet') || source.storage_path.endsWith('.xlsx')) {
      const XLSX = await import('npm:xlsx@0.18.5') as any
      const wb = XLSX.read(buf, { type: 'buffer' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    } else {
      // TXT/MD: cada linha vira um registro básico
      const text = new TextDecoder().decode(buf)
      rows = text.split(/\n+/).map((line, idx) => ({ line, _row: idx + 1 }))
    }

    // Atualiza total_rows
    await fetch(`${projectUrl}/rest/v1/rag_sources?id=eq.${source_id}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${serviceRole}`, 'apikey': serviceRole, 'content-type': 'application/json' },
      body: JSON.stringify({ total_rows: rows.length, status: 'processing', schema_json: mapping || null })
    })

    const items: any[] = []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const fields: Record<string, any> = {}
      try {
        for (const k of Object.keys(r)) fields[k] = r[k]
      } catch {}
      const category = safeString(mapping?.categoryColumn ? r[mapping.categoryColumn] : mapping?.defaultCategory)
      const parts = [category ? `Categoria: ${category}` : '', `Campos: ${JSON.stringify(fields)}`].filter(Boolean)
      const content = parts.join(' | ')
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${source_id}:${i}:${content}`)).then(b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''))
      items.push({ organization_id: source.organization_id, source_id, row_index: i + 1, category: category || null, content, fields, metadata: { file: source.storage_path }, hash })
    }

    // Inserir em lotes sem embedding
    const chunk = Number(options?.insert_batch_size || 500)
    for (let i = 0; i < items.length; i += chunk) {
      const slice = items.slice(i, i + chunk)
      await fetch(`${projectUrl}/rest/v1/rag_items`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${serviceRole}`, 'apikey': serviceRole, 'content-type': 'application/json' },
        body: JSON.stringify(slice),
      })
      await fetch(`${projectUrl}/rest/v1/rag_sources?id=eq.${source_id}`, {
        method: 'PATCH', headers: { 'Authorization': `Bearer ${serviceRole}`, 'apikey': serviceRole, 'content-type': 'application/json' },
        body: JSON.stringify({ processed_rows: Math.min(items.length, i + slice.length) })
      })
    }

    // Sinalizar pronto
    await fetch(`${projectUrl}/rest/v1/rag_sources?id=eq.${source_id}`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${serviceRole}`, 'apikey': serviceRole, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'ready' }) })

    return new Response(JSON.stringify({ ok: true, inserted: items.length }), { headers: { ...cors, 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...cors, 'content-type': 'application/json' } })
  }
})



