// @ts-nocheck
import { serve } from 'https://deno.land/std@0.181.0/http/server.ts'

const cors: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: cors })
    }

    const json = await req.json().catch(() => ({})) as any

    // Modo 1: Proxy para API do n8n (base_url + api_key + path)
    if (!json.action || json.action === 'n8n-api') {
      const { base_url, api_key, method = 'GET', path = '', body } = json
      if (!base_url || !api_key || !path) {
        return new Response(JSON.stringify({ error: 'base_url, api_key e path são obrigatórios.' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
      }

      const endpoint = String(base_url).replace(/\/$/, '') + (String(path).startsWith('/') ? String(path) : `/${String(path)}`)

      const headers: HeadersInit = {
        'X-N8N-API-KEY': String(api_key),
        'Accept': '*/*',
      }
      let fetchBody: BodyInit | undefined = undefined
      if (method !== 'GET' && method !== 'HEAD' && body !== undefined) {
        headers['Content-Type'] = 'application/json'
        fetchBody = typeof body === 'string' ? body : JSON.stringify(body)
      }

      const resp = await fetch(endpoint, { method, headers, body: fetchBody })
      const text = await resp.text()
      const contentType = resp.headers.get('content-type') || ''
      const payload = contentType.includes('application/json') ? (() => { try { return JSON.parse(text) } catch { return text } })() : text

      return new Response(
        typeof payload === 'string' ? payload : JSON.stringify(payload),
        { status: resp.status, headers: { ...cors, 'Content-Type': contentType.includes('application/json') ? 'application/json' : 'text/plain' } }
      )
    }

    // Modo 2: Enviar webhook genérico (sem n8n API)
    if (json.action === 'send-webhook') {
      const { webhookUrl, payload, method = 'POST', headers: extraHeaders } = json
      if (!webhookUrl) {
        return new Response(JSON.stringify({ success: false, status: 400, error: 'webhookUrl é obrigatório' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(extraHeaders || {})
      }

      const start = Date.now()
      const resp = await fetch(String(webhookUrl), {
        method,
        headers,
        body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(payload ?? {})
      })
      const elapsed = Date.now() - start
      const dataText = await resp.text().catch(() => '')
      let data: any = dataText
      try { data = JSON.parse(dataText) } catch {}

      return new Response(JSON.stringify({ success: resp.ok, status: resp.status, data, executionTime: elapsed }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'unknown error' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})


