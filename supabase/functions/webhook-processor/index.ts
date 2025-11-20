// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    // Payload may contain explicit organizationId and/or userId (owner). If not provided, we try to infer.
    let requestJson: any = {}
    try {
      if (req.method !== 'GET') {
        requestJson = await req.json()
      }
    } catch (_) {
      requestJson = {}
    }

    const organizationId: string | undefined = requestJson?.organizationId
    const requestUserId: string | undefined = requestJson?.userId || requestJson?.user_id

    // Initialize Master Supabase client (where we store saas_* tables)
    const masterUrl = Deno.env.get('SUPABASE_URL')!
    const masterKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const master = createClient(masterUrl, masterKey)

    if (!organizationId) {
      console.log('⚠️ [WEBHOOK-PROCESSOR] No organizationId provided, nothing to process')
      return new Response(JSON.stringify({ success: true, processed_events: 0 }), { headers: getCorsHeaders(req) })
    }

    // Resolve client Supabase credentials from master (owner of the organization)
    // Tentar resolver via saas_organizations; se falhar, tentar via saas_users.organization_id; fallback para userId informado
    let ownerId: string | null = null
    if (organizationId) {
      // Primeiro tentar buscar pelo client_org_id (ID da organização no Client Supabase)
      const { data: orgDataByClientId } = await master
        .from('saas_organizations')
        .select('owner_id')
        .eq('client_org_id', organizationId)
        .maybeSingle()

      if (orgDataByClientId?.owner_id) {
        ownerId = orgDataByClientId.owner_id
      } else {
        // Fallback: tentar buscar pelo id diretamente (caso seja passado um ID do Master)
        const { data: orgData } = await master
          .from('saas_organizations')
          .select('owner_id')
          .eq('id', organizationId)
          .maybeSingle()

        if (orgData?.owner_id) {
          ownerId = orgData.owner_id
        } else {
          // Fallback adicional: buscar usuário por organization_id na tabela saas_users
          const { data: userByOrg } = await master
            .from('saas_users')
            .select('id')
            .eq('organization_id', organizationId)
            .maybeSingle()
          if (userByOrg?.id) ownerId = userByOrg.id
        }
      }
    }
    if (!ownerId && requestUserId) ownerId = requestUserId

    if (!ownerId) {
      throw new Error('Organization not found: could not resolve owner')
    }

    const { data: userData, error: userError } = await master
      .from('saas_users')
      .select('supabase_url, supabase_key_encrypted, service_role_encrypted')
      .eq('id', ownerId)
      .single()

    if (userError || !userData?.supabase_url || (!userData?.service_role_encrypted && !userData?.supabase_key_encrypted)) {
      throw new Error(`Client Supabase credentials not found: ${userError?.message || 'missing'}`)
    }

    // Decrypt client key (base64 for now)
    function safeDecodeBase64(b64: string): string {
      try {
        let s = (b64 || '').toString().trim().replace(/[\s\r\n]+/g, '')
        s = s.replace(/-/g, '+').replace(/_/g, '/');
        while (s.length % 4 !== 0) s += '='
        return atob(s)
      } catch {
        return b64
      }
    }
    const clientServiceKey = safeDecodeBase64(userData.service_role_encrypted || userData.supabase_key_encrypted)
    const client = createClient(userData.supabase_url, clientServiceKey)

    console.log(`🔗 [WEBHOOK-PROCESSOR] Processing webhook events for org ${organizationId}`)

    // Buscar eventos pendentes da organização no Supabase do cliente
    const { data: pendingEvents, error: eventsError } = await client
      .from('webhook_events')
      .select(`
        *,
        webhook_config:webhook_configurations(*)
      `)
      .eq('status', 'pending')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true })
      .limit(50)

    if (eventsError) {
      throw new Error(`Error fetching pending events: ${eventsError.message}`)
    }

    console.log(`🔍 [WEBHOOK-PROCESSOR] Found ${pendingEvents?.length || 0} pending events`)

    const results: any[] = []

    // Processar cada evento
    for (const event of pendingEvents || []) {
      const startTime = Date.now()
      
      try {
        console.log(`🚀 [WEBHOOK-PROCESSOR] Processing event: ${event.event_type} for ${event.webhook_config.name}`)

        // Preparar headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'TomikCRM-Webhook/1.0',
          ...event.webhook_config.headers
        }

        // Adicionar autenticação
        if (event.webhook_config.authentication_type === 'api_key') {
          headers['X-API-Key'] = event.webhook_config.authentication_config.api_key
        } else if (event.webhook_config.authentication_type === 'bearer_token') {
          headers['Authorization'] = `Bearer ${event.webhook_config.authentication_config.bearer_token}`
        } else if (event.webhook_config.authentication_type === 'basic_auth') {
          const credentials = btoa(`${event.webhook_config.authentication_config.username}:${event.webhook_config.authentication_config.password}`)
          headers['Authorization'] = `Basic ${credentials}`
        }

        // Executar webhook
        const response = await fetch(event.webhook_url, {
          method: 'POST',
          headers,
          body: JSON.stringify(event.request_payload),
          signal: AbortSignal.timeout(event.webhook_config.timeout_seconds * 1000)
        })

        const executionTime = Date.now() - startTime
        const responseData = await response.json().catch(() => ({}))
        const responseHeaders = Object.fromEntries(response.headers.entries())

        // Atualizar evento com resultado
        const { error: updateError } = await client
          .from('webhook_events')
          .update({
            status: response.ok ? 'success' : 'failed',
            response_status: response.status,
            response_data: responseData,
            response_headers: responseHeaders,
            execution_time_ms: executionTime,
            error_message: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`
          })
          .eq('id', event.id)

        if (updateError) {
          console.error('Error updating event:', updateError)
        }

        // Atualizar estatísticas da configuração
        const { error: statsError } = await client
          .from('webhook_configurations')
          .update({
            last_triggered_at: new Date().toISOString(),
            successful_triggers: response.ok 
              ? (event.webhook_config.successful_triggers || 0) + 1
              : event.webhook_config.successful_triggers || 0,
            failed_triggers: !response.ok 
              ? (event.webhook_config.failed_triggers || 0) + 1
              : event.webhook_config.failed_triggers || 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', event.webhook_config_id)

        if (statsError) {
          console.error('Error updating webhook stats:', statsError)
        }

        results.push({
          eventId: event.id,
          eventType: event.event_type,
          webhookName: event.webhook_config.name,
          success: response.ok,
          status: response.status,
          executionTime,
          error: response.ok ? null : `HTTP ${response.status}`
        })

        console.log(`${response.ok ? '✅' : '❌'} [WEBHOOK-PROCESSOR] Event processed: ${event.event_type} - ${response.status}`)

      } catch (eventError: any) {
        const executionTime = Date.now() - startTime
        
        console.error(`❌ [WEBHOOK-PROCESSOR] Error processing event ${event.id}:`, eventError)

        // Atualizar evento com erro
        await client
          .from('webhook_events')
          .update({
            status: eventError.name === 'TimeoutError' ? 'timeout' : 'failed',
            execution_time_ms: executionTime,
            error_message: eventError.message,
            retry_count: (event.retry_count || 0) + 1
          })
          .eq('id', event.id)

        // Atualizar estatísticas de falha
        await client
          .from('webhook_configurations')
          .update({
            failed_triggers: (event.webhook_config.failed_triggers || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', event.webhook_config_id)

        results.push({
          eventId: event.id,
          eventType: event.event_type,
          webhookName: event.webhook_config.name,
          success: false,
          executionTime,
          error: eventError.message
        })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        processed_events: results.length,
        successful_events: results.filter(r => r.success).length,
        failed_events: results.filter(r => !r.success).length,
        results,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ [WEBHOOK-PROCESSOR] Error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
      }
    )
  }
})