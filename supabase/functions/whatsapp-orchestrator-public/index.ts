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
      console.error('[ORCHESTRATOR-PUBLIC] Missing organization_id')
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
      if (typeof raw.jsonData === 'string' && raw.jsonData.trim()) {
        try {
          const parsed = JSON.parse(raw.jsonData)
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

    const nested = payload?.jsonData && typeof payload.jsonData === 'object' ? payload.jsonData : undefined
    const eventDataRaw = (nested?.event && typeof nested.event === 'object')
      ? nested.event
      : (payload?.event && typeof payload.event === 'object')
        ? payload.event
        : (nested && Object.keys(nested).length ? nested : {})
    const topType = (payload?.type || payload?.Type || nested?.type || nested?.Type || eventDataRaw?.type || eventDataRaw?.Type || '').toString()
    const eventData: any = { ...eventDataRaw }
    if (topType && !eventData.Type) eventData.Type = topType

    console.log('[ORCHESTRATOR-PUBLIC] Received webhook:', {
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

    // Resolve client credentials from master (prefer per-organization; fallback to saas_users legacy)
    let clientUrl = ''
    let encrypted = ''
    try {
      const { data: orgRow } = await masterSupabase
        .from('saas_organizations')
        .select('client_supabase_url, client_service_key_encrypted, client_anon_key_encrypted')
        .eq('client_org_id', organizationId)
        .maybeSingle()
      if (orgRow?.client_supabase_url && (orgRow?.client_service_key_encrypted || orgRow?.client_anon_key_encrypted)) {
        clientUrl = orgRow.client_supabase_url
        encrypted = String(orgRow.client_service_key_encrypted || orgRow.client_anon_key_encrypted || '')
      }
    } catch {}
    if (!clientUrl || !encrypted) {
      const { data: userRow } = await masterSupabase
        .from('saas_users')
        .select('supabase_url, supabase_key_encrypted, service_role_encrypted')
        .eq('organization_id', organizationId)
        .not('supabase_url', 'is', null)
        .or('service_role_encrypted.not.is.null,supabase_key_encrypted.not.is.null')
        .limit(1)
        .maybeSingle()
      if (userRow?.supabase_url && (userRow?.service_role_encrypted || userRow?.supabase_key_encrypted)) {
        clientUrl = userRow.supabase_url
        encrypted = String(userRow.service_role_encrypted || userRow.supabase_key_encrypted || '')
      }
    }

    if (!clientUrl || !encrypted) {
      console.error('[ORCHESTRATOR-PUBLIC] Client credentials not found for org:', organizationId)
      return new Response(JSON.stringify({ error: 'Client credentials not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    function safeDecodeBase64(b64: string): string {
      try {
        let s = (b64 || '').toString().trim().replace(/[\s\r\n]+/g, '')
        s = s.replace(/-/g, '+').replace(/_/g, '/')
        while (s.length % 4 !== 0) s += '='
        return atob(s)
      } catch {
        return b64
      }
    }
    const clientKey = safeDecodeBase64(encrypted)
    const clientSupabase = createClient(clientUrl, clientKey)

    const eventType = 'event'
    const jsonData = eventData || {}

    await clientSupabase
      .from('whatsapp_events')
      .insert({
        organization_id: organizationId,
        provider: 'wuzapi',
        event_type: eventType,
        payload: payload,
        created_at: new Date().toISOString()
      })

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

    await triggerUserWebhooks(clientSupabase, organizationId, eventType, jsonData)

    try {
      await clientSupabase.functions.invoke('webhook-processor', { body: { organizationId } })
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('[ORCHESTRATOR-PUBLIC] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function processMessage(supabase: any, organizationId: string, instanceId: string, data: any) {
  try {
    // Normalize common fields from several provider shapes
    const rawPhone = data.Chat || data.Sender || data.Phone || data.phone || null
    const phone = extractPhoneNumber(rawPhone as any)
    if (!phone) return

    const phoneE164 = normalizePhone(phone)
    // Business rule (WuzAPI reported by project): IsFromMe=true => inbound (mensagem recebida)
    const isFromMe = (data.IsFromMe ?? data.from_me ?? data.FromMe ?? false) as boolean
    const direction = isFromMe ? 'inbound' : 'outbound'
    const messageBody = (data.Body || data.body || data.Text || data.text || '').toString()
    const mediaUrl = data.Media || data.media || data.MediaUrl || data.media_url || null
    const { type: inferredType, mime: inferredMime } = inferMessageType({ ...data, Media: mediaUrl })
    const providerId = data.Id || data.id || data.MessageID || data.message_id || null
    const tsIso = data.Timestamp ? new Date((Number(data.Timestamp) || 0) * 1000).toISOString() : new Date().toISOString()

    const { data: contact, error: contactError } = await supabase
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
    if (contactError) { console.error('[ORCHESTRATOR-PUBLIC] upsert contact error:', contactError); return }

    const { data: conversation, error: convError } = await supabase
      .from('whatsapp_conversations')
      .upsert({
        organization_id: organizationId,
        contact_id: contact.id,
        last_message: messageBody || (inferredType !== 'text' ? inferredType : 'Media'),
        last_message_at: tsIso,
        unread_count: direction === 'inbound' ? 1 : 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'organization_id,contact_id' })
      .select('*')
      .single()
    if (convError) { console.error('[ORCHESTRATOR-PUBLIC] upsert conversation error:', convError); return }

    const { error: msgError } = await supabase
      .from('whatsapp_messages')
      .insert({
        organization_id: organizationId,
        conversation_id: conversation.id,
        instance_id: instanceId,
        direction: direction,
        type: inferredType,
        body: messageBody,
        media_url: mediaUrl,
        media_mime: inferredMime || null,
        status: 'success',
        error: null,
        provider_message_id: providerId,
        timestamp: tsIso
      })
    if (msgError) { console.error('[ORCHESTRATOR-PUBLIC] insert message error:', msgError) }
  } catch (error: any) {
    console.error('[ORCHESTRATOR-PUBLIC] Error processing message:', error)
  }
}

async function processReadReceipt(supabase: any, organizationId: string, data: any) {
  try {
    const messageId = data.Id
    if (!messageId) return

    await supabase
      .from('whatsapp_messages')
      .update({ status: 'read', updated_at: new Date().toISOString() })
      .eq('organization_id', organizationId)
      .eq('provider_message_id', messageId)
  } catch (error: any) {
    console.error('[ORCHESTRATOR-PUBLIC] Error processing read receipt:', error)
  }
}

async function processPresence(supabase: any, organizationId: string, data: any) {
  try {
    const phone = extractPhoneNumber(data.Chat || data.Sender)
    if (!phone) return

    const phoneE164 = normalizePhone(phone)
    const state = data.State || data.composing

    await supabase
      .from('whatsapp_events')
      .insert({
        organization_id: organizationId,
        provider: 'wuzapi',
        event_type: 'presence',
        payload: { phone: phoneE164, state, timestamp: new Date().toISOString() }
      })
  } catch (error: any) {
    console.error('[ORCHESTRATOR-PUBLIC] Error processing presence:', error)
  }
}

async function processHistorySync(supabase: any, organizationId: string, data: any) {
  try {
    await supabase
      .from('whatsapp_events')
      .insert({ organization_id: organizationId, provider: 'wuzapi', event_type: 'history_sync', payload: data, created_at: new Date().toISOString() })
  } catch (error: any) {
    console.error('[ORCHESTRATOR-PUBLIC] Error processing history sync:', error)
  }
}

async function triggerUserWebhooks(supabase: any, organizationId: string, eventType: string, data: any) {
  try {
    let webhookEventType = null
    if (eventType === 'event' && data.Type === 'Message' && !data.IsFromMe) webhookEventType = 'whatsapp_message_received'
    else if (eventType === 'event' && data.Type === 'Message' && data.IsFromMe) webhookEventType = 'whatsapp_message_sent'
    else if (eventType === 'event' && data.Type === 'ReadReceipt') webhookEventType = 'whatsapp_message_read'
    else if (eventType === 'event' && data.Type === 'ChatPresence') webhookEventType = 'whatsapp_presence'

    if (!webhookEventType) return

    const { data: webhooks } = await supabase
      .from('webhook_configurations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .contains('event_types', [webhookEventType])

    if (!webhooks || webhooks.length === 0) return

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
  } catch (error: any) {
    console.error('[ORCHESTRATOR-PUBLIC] Error triggering user webhooks:', error)
  }
}

function extractPhoneNumber(input: string): string | null {
  if (!input) return null
  const match = input.match(/(\d+)@/)
  return match ? match[1] : input.replace(/[^\d]/g, '')
}

function normalizePhone(phone: string): string {
  if (!phone) return ''
  phone = phone.replace(/[^\d]/g, '')
  if (!phone.startsWith('+')) {
    if (phone.length === 11 || phone.length === 10) phone = '+55' + phone
    else if (!phone.startsWith('55')) phone = '+' + phone
    else phone = '+' + phone
  }
  return phone
}

function inferMessageType(data: any): { type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'media', mime?: string } {
  const media: string | null = data?.Media || data?.media || null
  const body: string = (data?.Body || '').toString()
  const mimeCandidates = [data?.MediaMime, data?.MimeType, data?.Mimetype, data?.Mime, data?.media_mime].filter(Boolean)
  let mime: string | undefined = undefined
  if (typeof media === 'string' && /^data:[^;]+;/.test(media)) {
    mime = media.substring(5, media.indexOf(';'))
  } else if (mimeCandidates.length) {
    mime = String(mimeCandidates[0])
  }

  // If there is no media, it's text
  if (!media) {
    return { type: 'text' }
  }

  const m = (mime || '').toLowerCase()
  if (m.startsWith('image/')) return { type: 'image', mime: m }
  if (m.startsWith('audio/')) return { type: 'audio', mime: m }
  if (m.startsWith('video/')) return { type: 'video', mime: m }
  if (m === 'application/pdf' || m.startsWith('application/')) return { type: 'document', mime: m }

  // Fallback by inspecting body or media extension
  const mediaStr = String(media)
  if (/\.(png|jpe?g|gif|webp)(\?|$)/i.test(mediaStr)) return { type: 'image' }
  if (/\.(mp3|ogg|opus|m4a|wav)(\?|$)/i.test(mediaStr)) return { type: 'audio' }
  if (/\.(mp4|3gpp?|mov)(\?|$)/i.test(mediaStr)) return { type: 'video' }
  if (/\.(pdf|docx?|xlsx?|pptx?)(\?|$)/i.test(mediaStr)) return { type: 'document' }

  return { type: 'media', mime }
}
