// @ts-nocheck
import { serve } from 'https://deno.land/std@0.181.0/http/server.ts'

const cors: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: cors })
    }

    const { base_url, api_key, workflow } = await req.json().catch(() => ({}))
    if (!base_url || !api_key || !workflow) {
      return new Response(JSON.stringify({ error: 'base_url, api_key e workflow são obrigatórios.' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // Log para debug: verificar qual workflow está chegando
    console.log('🔍 [n8n-create-workflow] Workflow recebido')
    if (typeof workflow === 'object' && workflow !== null) {
      const workflowName = (workflow as any)?.name || 'sem nome'
      const nodeCount = Array.isArray((workflow as any)?.nodes) ? (workflow as any).nodes.length : 0
      console.log(`  - Nome: ${workflowName}`)
      console.log(`  - Número de nodes: ${nodeCount}`)
      // Verificar se há algum node que identifique o tipo de workflow
      if (Array.isArray((workflow as any)?.nodes)) {
        const firstNode = (workflow as any).nodes[0]
        console.log(`  - Primeiro node type: ${firstNode?.type || 'N/A'}`)
        console.log(`  - Primeiro node name: ${firstNode?.name || 'N/A'}`)
      }
    }

    // Normaliza o payload do workflow para atender ao schema do n8n
    const workflowObject: Record<string, unknown> = typeof workflow === 'string'
      ? (() => { try { return JSON.parse(workflow) } catch { return {} } })()
      : (workflow as Record<string, unknown>)

    if (!workflowObject || typeof workflowObject !== 'object') {
      return new Response(JSON.stringify({ error: 'workflow inválido: esperado objeto JSON.' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // Garante campos mínimos exigidos pela API do n8n
    if (!('name' in workflowObject) || !workflowObject.name) {
      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      workflowObject.name = `James - Tomik CRM (${yyyy}-${mm}-${dd})`
    }
    // 'active' não é aceito em alguns ambientes na criação; não forçar aqui
    if ('active' in workflowObject) {
      delete (workflowObject as any).active
    }
    // settings é exigido pela API do n8n; aplicamos defaults seguros caso ausente
    if (typeof (workflowObject as any).settings !== 'object' || (workflowObject as any).settings === null) {
      (workflowObject as any).settings = {
        saveExecutionProgress: true,
        saveManualExecutions: true,
        saveDataErrorExecution: 'all',
        saveDataSuccessExecution: 'all',
        executionTimeout: 3600,
        timezone: 'America/Sao_Paulo',
        executionOrder: 'v1'
      }
    }
    if (!Array.isArray((workflowObject as any).nodes)) {
      return new Response(JSON.stringify({ error: 'workflow inválido: campo nodes ausente ou não é uma lista.' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    if (typeof (workflowObject as any).connections !== 'object' || (workflowObject as any).connections === null) {
      return new Response(JSON.stringify({ error: 'workflow inválido: campo connections ausente ou inválido.' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // Alguns templates trazem chaves extras (pinData, meta, etc.).
    // A API do n8n rejeita propriedades adicionais no root. Vamos fazer whitelist.
    const allowedRootKeys = new Set(['name', 'nodes', 'connections', 'settings', 'staticData', 'shared'])
    const sanitized: Record<string, unknown> = {}
    for (const key of Object.keys(workflowObject)) {
      if (allowedRootKeys.has(key)) {
        ;(sanitized as any)[key] = (workflowObject as any)[key]
      }
    }
    // Garante obrigatórios
    sanitized.name = (workflowObject as any).name
    sanitized.nodes = (workflowObject as any).nodes
    sanitized.connections = (workflowObject as any).connections
    sanitized.settings = (workflowObject as any).settings
    if ((workflowObject as any).staticData && typeof (workflowObject as any).staticData === 'object') {
      sanitized.staticData = (workflowObject as any).staticData
    }

    const endpoint = String(base_url).replace(/\/$/, '') + '/api/v1/workflows'

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': String(api_key),
        'Content-Type': 'application/json',
        'Accept': '*/*'
      },
      body: JSON.stringify(sanitized)
    })

    const out = await resp.json().catch(() => ({}))

    // Se criou com sucesso, buscar detalhes completos do workflow pelo ID
    let details: Record<string, unknown> | null = null
    let openUrl: string | null = null
    try {
      const workflowId = (out as any)?.id
      if (resp.ok && workflowId) {
        const getEndpoint = String(base_url).replace(/\/$/, '') + `/api/v1/workflows/${encodeURIComponent(workflowId)}`
        const getResp = await fetch(getEndpoint, {
          method: 'GET',
          headers: {
            'X-N8N-API-KEY': String(api_key),
            'Accept': '*/*'
          }
        })
        details = await getResp.json().catch(() => null)
        openUrl = String(base_url).replace(/\/$/, '') + `/workflow/${workflowId}`
      }
    } catch {}

    return new Response(
      JSON.stringify({ created: out, workflow: details, open_url: openUrl }),
      { status: resp.status, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'unknown error' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})


