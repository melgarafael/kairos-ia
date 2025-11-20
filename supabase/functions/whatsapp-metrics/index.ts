// @ts-expect-error Remote Deno std import resolved by Edge runtime
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

// Local type shim so TS recognizes Deno in editor; no runtime impact
declare const Deno: { env: { get(name: string): string | undefined } }

function getCorsHeaders(req: Request): HeadersInit {
  const reqHeaders = req.headers.get('Access-Control-Request-Headers') || 'authorization, x-client-info, apikey, content-type'
  return {
    'Access-Control-Allow-Origin': '*',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': reqHeaders,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  }
}

function cleanBase64(str: string): string { if (!str) return ''; let c = str.replace(/[^A-Za-z0-9+/=]/g, ''); while (c.length % 4 !== 0) c += '='; return c }
function tryDecryptKey(encrypted: string | null | undefined): string | null { if (!encrypted) return null; try { return atob(cleanBase64(encrypted)) } catch { return encrypted } }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: getCorsHeaders(req) })
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })

    // @ts-expect-error Remote ESM import is resolved by Deno at runtime (Supabase Edge)
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
    const MASTER_SUPABASE_URL = Deno.env.get('MASTER_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')
    const MASTER_SUPABASE_ANON_KEY = Deno.env.get('MASTER_SUPABASE_ANON_KEY')
    const MASTER_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('MASTER_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!MASTER_SUPABASE_URL || !MASTER_SUPABASE_ANON_KEY || !MASTER_SUPABASE_SERVICE_ROLE_KEY) {
      return new Response('Missing master env', { status: 500, headers: getCorsHeaders(req) })
    }

    const authHeader = req.headers.get('authorization') || ''
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''
    const masterUserClient = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${bearer || MASTER_SUPABASE_ANON_KEY}` } } })
    const masterSrv = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY)

    const { data: userInfo, error: userErr } = await masterUserClient.auth.getUser()
    if (userErr || !userInfo?.user?.id) return new Response('Not authenticated', { status: 401, headers: getCorsHeaders(req) })

    const { data: su, error: suErr } = await masterSrv
      .from('saas_users')
      .select('supabase_url, supabase_key_encrypted, service_role_encrypted, organization_id')
      .eq('id', userInfo.user.id)
      .single()
    if (suErr || !su?.supabase_url) {
      console.error('[whatsapp-metrics] Client credentials not found:', { suErr, hasSupabaseUrl: !!su?.supabase_url, userId: userInfo.user.id })
      return new Response(JSON.stringify({ success: false, error: 'Client credentials not found', details: suErr?.message || 'Missing supabase_url' }), { status: 400, headers: getCorsHeaders(req) })
    }

    const clientUrl = su.supabase_url as string
    const clientServiceKey = tryDecryptKey(su.service_role_encrypted) || tryDecryptKey(su.supabase_key_encrypted)
    if (!clientServiceKey) {
      console.error('[whatsapp-metrics] Service key decryption failed:', { userId: userInfo.user.id, hasServiceRole: !!su.service_role_encrypted, hasAnonKey: !!su.supabase_key_encrypted })
      return new Response(JSON.stringify({ success: false, error: 'Failed to decrypt service key' }), { status: 500, headers: getCorsHeaders(req) })
    }
    
    const client = createClient(clientUrl, clientServiceKey as string)

    const body = await req.json().catch(() => ({})) as any
    const fromIso = body?.p_inicio ? new Date(body.p_inicio).toISOString() : new Date(0).toISOString()
    const toIso = body?.p_fim ? new Date(body.p_fim).toISOString() : new Date().toISOString()
    const orgId = body?.organization_id || su.organization_id || null
    
    if (!orgId) {
      console.error('[whatsapp-metrics] organization_id is null:', { userId: userInfo.user.id, bodyOrgId: body?.organization_id, suOrgId: su.organization_id })
      return new Response(JSON.stringify({ success: false, error: 'organization_id is required', details: 'No organization_id found in request body or user record' }), { status: 400, headers: getCorsHeaders(req) })
    }

    // Validate date range to prevent excessive processing
    const fromDate = new Date(fromIso)
    const toDate = new Date(toIso)
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
    
    // If range is too large, suggest using a smaller period
    if (daysDiff > 90) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Date range too large', 
        details: `Range of ${daysDiff} days exceeds limit. Please select a period of 90 days or less.`,
        suggestedMaxDays: 90
      }), { status: 400, headers: getCorsHeaders(req) })
    }
    const types = Array.isArray(body?.types) && body.types.length > 0
      ? body.types as string[]
      : ['summary', 'daily']
    const backfill: boolean = Boolean(body?.backfill)

    const results: Record<string, any> = {}

    // Optional backfill before metrics read
    if (backfill) {
      try {
        const oldestRes = await client
          .from('repositorio_de_mensagens')
          .select('created_at')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        const oldest = oldestRes?.data?.created_at ? new Date(oldestRes.data.created_at).toISOString() : fromIso
        await client.rpc('ai_agent_metrics_backfill_daily', { p_org: orgId, p_from: oldest, p_to: toIso })
      } catch (_) {
        // noop – best effort
      }
    }

    // Execute selected metrics in batches to avoid resource limits
    // Process in smaller batches instead of all at once
    // Track which metrics failed so we can use fallback only for those specific ones
    const failedMetrics = new Set<string>()
    
    // Batch 1: Core metrics (summary, daily)
    const batch1: Promise<void>[] = []
    if (types.includes('summary')) {
      batch1.push((async () => {
        try {
          const r = await client.rpc('ai_agent_metrics_summary', { p_org: orgId, p_from: fromIso, p_to: toIso })
          if (r.error) {
            console.error('[whatsapp-metrics] RPC summary error:', r.error)
            throw r.error
          }
          const base = Array.isArray(r.data) ? (r.data[0] || null) : null
          results.summary = base || { total_messages: 0, human_messages: 0, cliente_messages: 0, users_attended: 0 }
        } catch (err) {
          console.error('[whatsapp-metrics] Failed to get summary metrics:', err)
          failedMetrics.add('summary')
        }
      })())
    }
    if (types.includes('daily')) {
      batch1.push((async () => {
        try {
          const r = await client.rpc('ai_agent_metrics_daily', { p_org: orgId, p_from: fromIso, p_to: toIso })
          if (r.error) {
            console.error('[whatsapp-metrics] RPC daily error:', r.error)
            throw r.error
          }
          results.daily = Array.isArray(r.data) ? r.data : []
        } catch (err) {
          console.error('[whatsapp-metrics] Failed to get daily metrics:', err)
          failedMetrics.add('daily')
        }
      })())
    }
    await Promise.all(batch1)

    // Batch 2: Conversation metrics
    const batch2: Promise<void>[] = []
    if (types.includes('conversation_counts')) {
      batch2.push((async () => {
        try {
          const r = await client.rpc('ai_agent_metrics_conversation_counts', { p_org: orgId, p_from: fromIso, p_to: toIso })
          if (r.error) {
            console.error('[whatsapp-metrics] RPC conversation_counts error:', r.error)
            throw r.error
          }
          results.conversation_counts = Array.isArray(r.data) ? r.data : []
        } catch (err) {
          console.error('[whatsapp-metrics] Failed to get conversation_counts:', err)
          failedMetrics.add('conversation_counts')
        }
      })())
    }
    if (types.includes('conversation_dynamics')) {
      batch2.push((async () => {
        try {
          const r = await client.rpc('ai_agent_metrics_conversation_dynamics', { p_org: orgId, p_from: fromIso, p_to: toIso })
          if (r.error) {
            console.error('[whatsapp-metrics] RPC conversation_dynamics error:', r.error)
            throw r.error
          }
          results.conversation_dynamics = Array.isArray(r.data) ? r.data : []
        } catch (err) {
          console.error('[whatsapp-metrics] Failed to get conversation_dynamics:', err)
          failedMetrics.add('conversation_dynamics')
        }
      })())
    }
    await Promise.all(batch2)

    // Batch 3: Advanced metrics
    const batch3: Promise<void>[] = []
    if (types.includes('depth')) {
      batch3.push((async () => {
        try {
          const r = await client.rpc('ai_agent_metrics_depth', { p_org: orgId, p_from: fromIso, p_to: toIso })
          if (r.error) {
            console.error('[whatsapp-metrics] RPC depth error:', r.error)
            throw r.error
          }
          results.depth = Array.isArray(r.data) ? (r.data[0] || null) : null
        } catch (err) {
          console.error('[whatsapp-metrics] Failed to get depth:', err)
          failedMetrics.add('depth')
        }
      })())
    }
    if (types.includes('involvement')) {
      batch3.push((async () => {
        try {
          const r = await client.rpc('ai_agent_metrics_human_involvement', { p_org: orgId, p_from: fromIso, p_to: toIso })
          if (r.error) {
            console.error('[whatsapp-metrics] RPC involvement error:', r.error)
            throw r.error
          }
          results.involvement = Array.isArray(r.data) ? (r.data[0] || null) : null
        } catch (err) {
          console.error('[whatsapp-metrics] Failed to get involvement:', err)
          failedMetrics.add('involvement')
        }
      })())
    }
    if (types.includes('handoff')) {
      batch3.push((async () => {
        try {
          const r = await client.rpc('ai_agent_metrics_time_to_handoff', { p_org: orgId, p_from: fromIso, p_to: toIso })
          if (r.error) {
            console.error('[whatsapp-metrics] RPC handoff error:', r.error)
            throw r.error
          }
          results.handoff = Array.isArray(r.data) ? (r.data[0] || null) : null
        } catch (err) {
          console.error('[whatsapp-metrics] Failed to get handoff:', err)
          failedMetrics.add('handoff')
        }
      })())
    }
    await Promise.all(batch3)

    // Batch 4: Optional metrics (heavier processing)
    const batch4: Promise<void>[] = []
    if (types.includes('top_terms')) {
      batch4.push((async () => {
        try {
          const r = await client.rpc('ai_agent_metrics_top_terms', { p_org: orgId, p_from: fromIso, p_to: toIso, p_limit: 20, p_min_len: 3, p_ngram: 1 })
          if (r.error) {
            console.error('[whatsapp-metrics] RPC top_terms error:', r.error)
            throw r.error
          }
          results.top_terms = Array.isArray(r.data) ? r.data : []
        } catch (err) {
          console.error('[whatsapp-metrics] Failed to get top_terms:', err)
          failedMetrics.add('top_terms')
        }
      })())
    }
    if (types.includes('by_instance')) {
      batch4.push((async () => {
        try {
          const r = await client.rpc('ai_agent_metrics_by_instance', { p_org: orgId, p_from: fromIso, p_to: toIso })
          if (r.error) {
            console.error('[whatsapp-metrics] RPC by_instance error:', r.error)
            throw r.error
          }
          results.by_instance = Array.isArray(r.data) ? r.data : []
        } catch (err) {
          console.error('[whatsapp-metrics] Failed to get by_instance:', err)
          failedMetrics.add('by_instance')
        }
      })())
    }
    await Promise.all(batch4)

    // JS fallback ONLY for failed metrics - prefer RPCs for accuracy and performance
    // RPCs process millions of rows efficiently in PostgreSQL, Edge Functions have limits
    let rows: any[] = []
    let estimatedMaxMessages = 0
    if (failedMetrics.size > 0) {
      console.warn(`[whatsapp-metrics] Some RPCs failed (${Array.from(failedMetrics).join(', ')}), attempting fallback for those metrics only`)
      
      // Calculate safety limit only for very large date ranges to avoid WORKER_LIMIT
      // With date filters working, we can safely fetch all messages in the period
      // Only limit if period is very large (close to 90 days) as a safety measure
      estimatedMaxMessages = daysDiff >= 80 ? 20000 : 0 // Only limit if >= 80 days
      
      // Fetch all messages in the date range with automatic pagination
      // Supabase has a default limit of 1000, so we need to paginate transparently
      const pageSize = 1000
      let offset = 0
      let hasMore = true
      
      while (hasMore) {
        // Apply limit only if we have a safety limit and haven't reached it yet
        const query = client
          .from('repositorio_de_mensagens')
          .select('id, created_at, sender_type, whatsapp_cliente, whatsapp_empresa')
          .eq('organization_id', orgId)
          .gte('created_at', fromIso)
          .lte('created_at', toIso)
          .order('created_at', { ascending: true })
          .range(offset, offset + pageSize - 1)
        
        const r = await query
        
        if (r.error) {
          console.error('[whatsapp-metrics] Fallback query error:', r.error)
          break
        }
        
        const batch = Array.isArray(r.data) ? r.data : []
        rows.push(...batch)
        
        // Stop if we got fewer results than requested (end of data)
        // Or if we hit the safety limit (only applies to very large periods)
        hasMore = batch.length === pageSize && (estimatedMaxMessages === 0 || rows.length < estimatedMaxMessages)
        offset += pageSize
      }
      
      // If we hit the safety limit, warn that results may be incomplete
      if (estimatedMaxMessages > 0 && rows.length >= estimatedMaxMessages) {
        console.warn('[whatsapp-metrics] Fallback processed maximum allowed messages, results may be incomplete')
      }

      // Only calculate failed metrics in fallback
      if (failedMetrics.has('summary')) {
        const totalMessages = rows.length
        const users = new Set<string>()
        let humanMessages = 0
        let clienteMessages = 0
        for (const m of rows) { if (m?.whatsapp_cliente) users.add(m.whatsapp_cliente) }
        for (const m of rows) { 
          if (m?.sender_type === 'cliente' || m?.sender_type === 'humano') humanMessages++
          if (m?.sender_type === 'cliente') clienteMessages++
        }
        results.summary = { total_messages: totalMessages, human_messages: humanMessages, cliente_messages: clienteMessages, users_attended: users.size }
      }

      if (failedMetrics.has('daily')) {
        const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
        const dailyMap = new Map<string, { messages_total: number; users: Set<string> }>()
        for (const m of rows) {
          const key = fmt.format(new Date(m.created_at))
          const ref = dailyMap.get(key) || { messages_total: 0, users: new Set<string>() }
          ref.messages_total += 1
          if (m?.whatsapp_cliente) ref.users.add(m.whatsapp_cliente)
          dailyMap.set(key, ref)
        }
        results.daily = Array.from(dailyMap.entries())
          .map(([day, v]) => ({ day, messages_total: v.messages_total, users_attended: v.users.size }))
          .sort((a, b) => a.day.localeCompare(b.day))
      }

      // Calculate conversation_counts only if it failed
      const ccMap = new Map<string, { whatsapp_cliente: string; whatsapp_empresa: string; total: number; ia: number; human: number; last: string }>()
      if (failedMetrics.has('conversation_counts') || failedMetrics.has('depth') || failedMetrics.has('involvement') || failedMetrics.has('handoff') || failedMetrics.has('by_instance')) {
        for (const m of rows) {
          const c = m.whatsapp_cliente || ''
          const e = m.whatsapp_empresa || ''
          if (!c || !e) continue
          const key = `${c}__${e}`
          const ref = ccMap.get(key) || { whatsapp_cliente: c, whatsapp_empresa: e, total: 0, ia: 0, human: 0, last: '' }
          ref.total += 1
          if (m.sender_type === 'ia') ref.ia += 1
          if (m.sender_type === 'cliente' || m.sender_type === 'humano') ref.human += 1
          ref.last = m.created_at
          ccMap.set(key, ref)
        }
      }
      
      if (failedMetrics.has('conversation_counts')) {
        results.conversation_counts = Array.from(ccMap.values())
          .map(v => ({
            whatsapp_cliente: v.whatsapp_cliente,
            whatsapp_empresa: v.whatsapp_empresa,
            total_messages: v.total,
            ia_messages: v.ia,
            human_messages: v.human,
            last_message_at: v.last
          }))
          .sort((a, b) => (b.total_messages - a.total_messages) || (new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()))
      }

      if (failedMetrics.has('conversation_dynamics')) {
        const byConv: Record<string, any[]> = {}
        for (const m of rows) {
          if (m.sender_type !== 'cliente') continue
          const c = m.whatsapp_cliente || ''
          const e = m.whatsapp_empresa || ''
          if (!c || !e) continue
          const key = `${c}__${e}`
          ;(byConv[key] ||= []).push(m)
        }
        const dynamics: any[] = []
        for (const key of Object.keys(byConv)) {
          const arr = byConv[key].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          const gaps: number[] = []
          for (let i = 1; i < arr.length; i++) {
            const prev = new Date(arr[i - 1].created_at).getTime()
            const cur = new Date(arr[i].created_at).getTime()
            const sec = Math.max(0, Math.round((cur - prev) / 1000))
            gaps.push(sec)
          }
          if (gaps.length === 0) continue
          const avg = gaps.reduce((s, v) => s + v, 0) / gaps.length
          const sorted = gaps.slice().sort((a, b) => a - b)
          const mid = Math.floor(sorted.length / 2)
          const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
          const p90Index = Math.floor(0.90 * (sorted.length - 1))
          const p90 = sorted[p90Index]
          const [whatsapp_cliente, whatsapp_empresa] = key.split('__')
          dynamics.push({
            whatsapp_cliente,
            whatsapp_empresa,
            messages_from_user: arr.length,
            avg_interval_seconds: avg,
            median_interval_seconds: median,
            p90_interval_seconds: p90
          })
        }
        results.conversation_dynamics = dynamics.sort((a, b) => b.messages_from_user - a.messages_from_user)
      }

      if (failedMetrics.has('depth')) {
        const msgsPerConv = Array.from(ccMap.values()).map(v => v.total)
        const conversations = msgsPerConv.length
        const messages_total = msgsPerConv.reduce((s, v) => s + v, 0)
        const avg_msgs = conversations > 0 ? messages_total / conversations : 0
        const sortedDepth = msgsPerConv.slice().sort((a, b) => a - b)
        const p50Depth = conversations ? sortedDepth[Math.floor(0.5 * (conversations - 1))] : 0
        const p90Depth = conversations ? sortedDepth[Math.floor(0.9 * (conversations - 1))] : 0
        results.depth = {
          conversations,
          messages_total,
          avg_msgs_per_conversation: avg_msgs,
          p50_msgs_per_conversation: p50Depth,
          p90_msgs_per_conversation: p90Depth
        }
      }

      if (failedMetrics.has('involvement')) {
        const conversations_with_human = Array.from(ccMap.keys()).filter(k => {
          const [c, e] = k.split('__');
          return rows.some(m => (m.whatsapp_cliente === c && m.whatsapp_empresa === e && (m.sender_type === 'cliente' || m.sender_type === 'humano')))
        }).length
        const conversations = ccMap.size
        results.involvement = {
          conversations,
          conversations_with_human,
          involvement_rate: conversations > 0 ? (100 * conversations_with_human / conversations) : 0
        }
      }

      if (failedMetrics.has('handoff')) {
        const grouped: Record<string, any[]> = {}
        for (const m of rows) {
          const c = m.whatsapp_cliente || ''
          const e = m.whatsapp_empresa || ''
          if (!c || !e) continue
          const key = `${c}__${e}`
          ;(grouped[key] ||= []).push(m)
        }
        const firstHandoffCounts: number[] = []
        for (const key of Object.keys(grouped)) {
          const arr = grouped[key].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          let count = 0
          let found = false
          for (const m of arr) {
            count += 1
            if (m.sender_type === 'cliente' || m.sender_type === 'humano') { found = true; break }
          }
          if (found) firstHandoffCounts.push(count)
        }
        const with_handoff = firstHandoffCounts.length
        const avg_msgs_until_handoff = with_handoff > 0 ? (firstHandoffCounts.reduce((s, v) => s + v, 0) / with_handoff) : 0
        const sortedH = firstHandoffCounts.slice().sort((a, b) => a - b)
        const p50H = with_handoff ? sortedH[Math.floor(0.5 * (with_handoff - 1))] : 0
        const p90H = with_handoff ? sortedH[Math.floor(0.9 * (with_handoff - 1))] : 0
        results.handoff = {
          conversations: ccMap.size,
          with_handoff,
          avg_msgs_until_handoff,
          p50_msgs_until_handoff: p50H,
          p90_msgs_until_handoff: p90H
        }
      }

      if (failedMetrics.has('by_instance')) {
        const instMap: Record<string, { messages_total: number; convSet: Set<string>; convWithHuman: Set<string>; msgsPerConv: Record<string, number> }> = {}
        for (const m of rows) {
          const inst = m.whatsapp_empresa || ''
          const convKey = `${m.whatsapp_cliente || ''}__${inst}`
          if (!instMap[inst]) instMap[inst] = { messages_total: 0, convSet: new Set(), convWithHuman: new Set(), msgsPerConv: {} }
          const bucket = instMap[inst]
          bucket.messages_total += 1
          bucket.convSet.add(convKey)
          bucket.msgsPerConv[convKey] = (bucket.msgsPerConv[convKey] || 0) + 1
          if (m.sender_type === 'cliente' || m.sender_type === 'humano') bucket.convWithHuman.add(convKey)
        }
        results.by_instance = Object.entries(instMap).map(([whatsapp_empresa, b]) => {
          const conversations = b.convSet.size
          const conversations_with_human = b.convWithHuman.size
          const avg_msgs_per_conversation = conversations > 0 ? (Object.values(b.msgsPerConv).reduce((s, v) => s + v, 0) / conversations) : 0
          const involvement_rate = conversations > 0 ? (100 * conversations_with_human / conversations) : 0
          return { whatsapp_empresa, messages_total: b.messages_total, conversations, conversations_with_human, involvement_rate, avg_msgs_per_conversation }
        }).sort((a, b) => (b.messages_total - a.messages_total) || (b.conversations - a.conversations))
      }
    }

    // Include warning if fallback was used and may have incomplete data
    const responseData: any = { success: true, data: results }
    if (failedMetrics.size > 0) {
      if (estimatedMaxMessages > 0 && rows.length >= estimatedMaxMessages) {
        responseData.warning = `Some metrics (${Array.from(failedMetrics).join(', ')}) were calculated using fallback method. Results may be incomplete for large date ranges.`
      } else {
        responseData.warning = `Some metrics (${Array.from(failedMetrics).join(', ')}) were calculated using fallback method. Consider checking RPC functions if this persists.`
      }
    }
    
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'content-type': 'application/json' }
    })
  } catch (err: any) {
    console.error('[whatsapp-metrics] Unhandled error:', err)
    const errorMessage = err?.message || String(err)
    const errorStack = err?.stack || ''
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage,
      stack: errorStack,
      type: err?.name || 'UnknownError'
    }), { 
      status: 500, 
      headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } 
    })
  }
})



