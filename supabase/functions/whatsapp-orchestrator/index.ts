// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

interface WuzAPIWebhookPayload {
  event?: string
  instanceId?: string
  token?: string
  jsonData?: {
    Chat?: string
    Sender?: string
    IsFromMe?: boolean
    IsGroup?: boolean
    SenderName?: string
    RecipientAlt?: string
    BroadcastListOwner?: string
    Type?: string
    State?: string
    composing?: string
    Media?: string
    Body?: string
    Id?: string
    Timestamp?: number
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const organizationId = url.searchParams.get('organization_id')
    const instanceId = url.searchParams.get('instance_id') || 'internal'

    if (!organizationId) {
      console.error('[ORCHESTRATOR] Missing organization_id')
      return new Response(JSON.stringify({ error: 'organization_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse webhook payload (supports both JSON and x-www-form-urlencoded from WuzAPI)
    let payload: any = {}
    const ctype = (req.headers.get('content-type') || '').toLowerCase()
    if (ctype.includes('application/x-www-form-urlencoded')) {
      const txt = await req.text().catch(() => '')
      const params = new URLSearchParams(txt)
      const raw = Object.fromEntries(params.entries())
      // WuzAPI sends jsonData as a JSON string
      if (typeof raw.jsonData === 'string' && raw.jsonData.trim()) {
        try {
          const parsed = JSON.parse(raw.jsonData)
          // on form data, parsed looks like: { event: {...}, type: 'Message' | 'ReadReceipt' | 'ChatPresence' | 'HistorySync' }
          payload = { ...parsed }
        } catch {
          payload = { jsonData: { raw: raw.jsonData } }
        }
      } else {
        payload = raw
      }
    } else {
      payload = await req.json().catch(() => ({}))
    }

    // Normalize common WuzAPI shapes
    // Cases:
    // 1) { jsonData: { event: {...}, type: 'Message' } }
    // 2) { event: {...}, type: 'Message' }
    // 3) { jsonData: {... already event ...} }
    // 4) { ...legacy fields... }
    const nested = payload?.jsonData && typeof payload.jsonData === 'object' ? payload.jsonData : undefined
    const eventDataRaw = (nested?.event && typeof nested.event === 'object')
      ? nested.event
      : (payload?.event && typeof payload.event === 'object')
        ? payload.event
        : (nested && Object.keys(nested).length ? nested : {})
    const topType = (payload?.type || payload?.Type || nested?.type || nested?.Type || eventDataRaw?.type || eventDataRaw?.Type || '').toString()
    const eventData: any = { ...eventDataRaw }
    if (topType && !eventData.Type) eventData.Type = topType

    console.log('[ORCHESTRATOR] Received webhook:', {
      organizationId,
      instanceId,
      isFromMe: eventData?.IsFromMe,
      type: eventData?.Type || eventData?.type,
      state: eventData?.State || eventData?.state
    })

    // Get Master Supabase credentials
    const masterUrl = Deno.env.get('SUPABASE_URL')!
    const masterServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const masterSupabase = createClient(masterUrl, masterServiceKey)

    // Get client credentials from master (prefer service_role_encrypted; fallback to supabase_key_encrypted for legacy)
    const { data: userRow } = await masterSupabase
      .from('saas_users')
      .select('supabase_url, supabase_key_encrypted, service_role_encrypted')
      .eq('organization_id', organizationId)
      .not('supabase_url', 'is', null)
      .or('service_role_encrypted.not.is.null,supabase_key_encrypted.not.is.null')
      .limit(1)
      .maybeSingle()

    if (!userRow?.supabase_url || (!userRow?.service_role_encrypted && !userRow?.supabase_key_encrypted)) {
      console.error('[ORCHESTRATOR] Client credentials not found for org:', organizationId)
      return new Response(JSON.stringify({ error: 'Client credentials not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const clientUrl = userRow.supabase_url
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
    const clientKey = safeDecodeBase64(userRow.service_role_encrypted || userRow.supabase_key_encrypted)
    const clientSupabase = createClient(clientUrl, clientKey)

    // Process different event types
    const eventType = 'event' // unify
    const jsonData = eventData || {}
    
    // Store raw event in whatsapp_events table
    await clientSupabase
      .from('whatsapp_events')
      .insert({
        organization_id: organizationId,
        provider: 'wuzapi',
        event_type: eventType,
        payload: payload,
        created_at: new Date().toISOString()
      })

    // Process specific event types
    const typeNorm = (jsonData?.Type || jsonData?.type || '').toString()
    if (/message/i.test(typeNorm)) {
      await processMessage(clientSupabase, organizationId, instanceId, jsonData)
    } else if (/readreceipt/i.test(typeNorm)) {
      await processReadReceipt(clientSupabase, organizationId, jsonData)
    } else if (/chatpresence|presence/i.test(typeNorm)) {
      await processPresence(clientSupabase, organizationId, jsonData)
    } else if (/historysync/i.test(typeNorm)) {
      await processHistorySync(clientSupabase, organizationId, jsonData)
    }

    // Trigger user webhooks if configured
    await triggerUserWebhooks(clientSupabase, organizationId, eventType, jsonData)

    // Best-effort: trigger client's webhook processor to deliver queued events
    try {
      await clientSupabase.functions.invoke('webhook-processor', {
        body: { organizationId }
      })
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('[ORCHESTRATOR] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function processMessage(supabase: any, organizationId: string, instanceId: string, data: any) {
  try {
    const phone = extractPhoneNumber(data.Chat || data.Sender)
    if (!phone) {
      console.warn('[ORCHESTRATOR] No phone number in message')
      return
    }

    const phoneE164 = normalizePhone(phone)
    const isFromMe = data.IsFromMe || false
    const messageBody = data.Body || ''
    const mediaUrl = data.Media || null

    // Ensure contact exists
    const { data: contact } = await supabase
      .from('whatsapp_contacts')
      .upsert({
        organization_id: organizationId,
        phone_e164: phoneE164,
        name: data.SenderName || phoneE164,
        is_whatsapp: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'organization_id,phone_e164' })
      .select('*')
      .single()

    // Ensure conversation exists
    const { data: conversation } = await supabase
      .from('whatsapp_conversations')
      .upsert({
        organization_id: organizationId,
        contact_id: contact.id,
        last_message: messageBody || 'Media',
        last_message_at: new Date().toISOString(),
        unread_count: isFromMe ? 0 : 1,
        updated_at: new Date().toISOString()
      }, { onConflict: 'organization_id,contact_id' })
      .select('*')
      .single()

    // Store message
    const { data: message } = await supabase
      .from('whatsapp_messages')
      .insert({
        organization_id: organizationId,
        conversation_id: conversation.id,
        instance_id: instanceId,
        direction: isFromMe ? 'outbound' : 'inbound',
        type: mediaUrl ? 'media' : 'text',
        body: messageBody,
        media_url: mediaUrl,
        status: 'received',
        provider_message_id: data.Id,
        timestamp: data.Timestamp ? new Date(data.Timestamp * 1000).toISOString() : new Date().toISOString()
      })
      .select('*')
      .single()

    console.log('[ORCHESTRATOR] Message stored:', message.id)

    // Update conversation's unread count if inbound
    if (!isFromMe) {
      await supabase
        .from('whatsapp_conversations')
        .update({
          unread_count: conversation.unread_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation.id)
    }

  } catch (error: any) {
    console.error('[ORCHESTRATOR] Error processing message:', error)
  }
}

async function processReadReceipt(supabase: any, organizationId: string, data: any) {
  try {
    const messageId = data.Id
    if (!messageId) return

    // Update message status
    await supabase
      .from('whatsapp_messages')
      .update({
        status: 'read',
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', organizationId)
      .eq('provider_message_id', messageId)

    console.log('[ORCHESTRATOR] Read receipt processed for message:', messageId)
  } catch (error: any) {
    console.error('[ORCHESTRATOR] Error processing read receipt:', error)
  }
}

async function processPresence(supabase: any, organizationId: string, data: any) {
  try {
    const phone = extractPhoneNumber(data.Chat || data.Sender)
    if (!phone) return

    const phoneE164 = normalizePhone(phone)
    const state = data.State || data.composing

    // Store presence event
    await supabase
      .from('whatsapp_events')
      .insert({
        organization_id: organizationId,
        provider: 'wuzapi',
        event_type: 'presence',
        payload: {
          phone: phoneE164,
          state: state,
          timestamp: new Date().toISOString()
        }
      })

    console.log('[ORCHESTRATOR] Presence event stored:', phoneE164, state)
  } catch (error: any) {
    console.error('[ORCHESTRATOR] Error processing presence:', error)
  }
}

async function processHistorySync(supabase: any, organizationId: string, data: any) {
  try {
    // Store history sync event for later processing
    await supabase
      .from('whatsapp_events')
      .insert({
        organization_id: organizationId,
        provider: 'wuzapi',
        event_type: 'history_sync',
        payload: data,
        created_at: new Date().toISOString()
      })

    console.log('[ORCHESTRATOR] History sync event stored')
  } catch (error: any) {
    console.error('[ORCHESTRATOR] Error processing history sync:', error)
  }
}

async function triggerUserWebhooks(supabase: any, organizationId: string, eventType: string, data: any) {
  try {
    // Map WuzAPI events to user webhook event types
    let webhookEventType = null
    
    if (eventType === 'event' && data.Type === 'Message' && !data.IsFromMe) {
      webhookEventType = 'whatsapp_message_received'
    } else if (eventType === 'event' && data.Type === 'Message' && data.IsFromMe) {
      webhookEventType = 'whatsapp_message_sent'
    } else if (eventType === 'event' && data.Type === 'ReadReceipt') {
      webhookEventType = 'whatsapp_message_read'
    } else if (eventType === 'event' && data.Type === 'ChatPresence') {
      webhookEventType = 'whatsapp_presence'
    }

    if (!webhookEventType) return

    // Get active webhook configurations for this event type
    const { data: webhooks } = await supabase
      .from('webhook_configurations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .contains('event_types', [webhookEventType])

    if (!webhooks || webhooks.length === 0) return

    // Prepare webhook payload
    const webhookPayload = {
      event_type: webhookEventType,
      timestamp: new Date().toISOString(),
      organization_id: organizationId,
      data: {
        phone: extractPhoneNumber(data.Chat || data.Sender),
        message: data.Body,
        media_url: data.Media,
        is_from_me: data.IsFromMe,
        message_id: data.Id,
        raw_data: data
      }
    }

    // Queue webhook events for each configuration
    for (const webhook of webhooks) {
      await supabase
        .from('webhook_events')
        .insert({
          organization_id: organizationId,
          webhook_config_id: webhook.id,
          event_type: webhookEventType,
          event_data: webhookPayload,
          webhook_url: webhook.webhook_url,
          request_payload: webhookPayload,
          status: 'pending',
          created_at: new Date().toISOString()
        })
    }

    console.log(`[ORCHESTRATOR] Queued ${webhooks.length} user webhooks for event:`, webhookEventType)
  } catch (error: any) {
    console.error('[ORCHESTRATOR] Error triggering user webhooks:', error)
  }
}

function extractPhoneNumber(input: string): string | null {
  if (!input) return null
  // Extract phone from WhatsApp JID format (e.g., "5511999999999@s.whatsapp.net")
  const match = input.match(/(\d+)@/)
  return match ? match[1] : input.replace(/[^\d]/g, '')
}

function normalizePhone(phone: string): string {
  if (!phone) return ''
  
  // Remove non-digits
  phone = phone.replace(/[^\d]/g, '')
  
  // Add + prefix if not present
  if (!phone.startsWith('+')) {
    // Assume Brazil if 11 digits
    if (phone.length === 11 || phone.length === 10) {
      phone = '+55' + phone
    } else if (!phone.startsWith('55')) {
      phone = '+' + phone
    } else {
      phone = '+' + phone
    }
  }
  
  return phone
}
