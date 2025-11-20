// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const organizationId = url.searchParams.get('organization_id')
    const provider = url.searchParams.get('provider') || 'internal'
    const instanceId = url.searchParams.get('instance_id')

    if (!organizationId) {
      return new Response(JSON.stringify({ error: 'organization_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get Master Supabase credentials
    const masterUrl = Deno.env.get('SUPABASE_URL')!
    const masterServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const masterSupabase = createClient(masterUrl, masterServiceKey)

    // Get client credentials from master
    const { data: userRow } = await masterSupabase
      .from('saas_users')
      .select('supabase_url, supabase_key_encrypted')
      .eq('organization_id', organizationId)
      .not('supabase_url', 'is', null)
      .not('supabase_key_encrypted', 'is', null)
      .limit(1)
      .maybeSingle()

    if (!userRow?.supabase_url || !userRow?.supabase_key_encrypted) {
      return new Response(JSON.stringify({ error: 'Client credentials not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const clientUrl = userRow.supabase_url
    const clientKey = atob(userRow.supabase_key_encrypted)
    const clientSupabase = createClient(clientUrl, clientKey)

    // Parse webhook payload
    const body = await req.json().catch(() => ({}))
    console.log('Webhook received:', JSON.stringify(body))

    // Handle WuzAPI webhook format
    if (body.Phone || body.phone) {
      const phone = (body.Phone || body.phone || '').replace(/[^\d]/g, '')
      const messageBody = body.Body || body.body || body.text || ''
      const messageType = body.Type || body.type || 'text'
      const messageId = body.Id || body.id || crypto.randomUUID()
      const timestamp = body.Timestamp || body.timestamp || new Date().toISOString()
      const fromMe = body.FromMe || body.from_me || false
      const mediaUrl = body.Media || body.media || body.MediaUrl || body.media_url || null

      if (!phone) {
        console.log('No phone number in webhook payload')
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Format phone with country code if needed
      let phoneE164 = phone
      if (!phoneE164.startsWith('+')) {
        // Assume Brazil if no country code
        if (phoneE164.length === 11 || phoneE164.length === 10) {
          phoneE164 = '+55' + phoneE164
        } else if (!phoneE164.startsWith('55')) {
          phoneE164 = '+' + phoneE164
        } else {
          phoneE164 = '+' + phoneE164
        }
      }

      // Ensure contact exists
      const { data: contact } = await clientSupabase
        .from('whatsapp_contacts')
        .upsert({
          organization_id: organizationId,
          phone_e164: phoneE164,
          name: body.Name || body.name || phoneE164,
          is_whatsapp: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'organization_id,phone_e164' })
        .select('*')
        .single()

      // Ensure conversation exists
      const { data: conversation } = await clientSupabase
        .from('whatsapp_conversations')
        .upsert({
          organization_id: organizationId,
          contact_id: contact.id,
          last_message: messageBody || 'Media',
          last_message_at: timestamp,
          unread_count: fromMe ? 0 : 1,
          updated_at: new Date().toISOString()
        }, { onConflict: 'organization_id,contact_id' })
        .select('*')
        .single()

      // Store message
      const { data: message } = await clientSupabase
        .from('whatsapp_messages')
        .insert({
          organization_id: organizationId,
          conversation_id: conversation.id,
          instance_id: instanceId,
          direction: fromMe ? 'outbound' : 'inbound',
          type: messageType,
          body: messageBody,
          media_url: mediaUrl,
          status: 'received',
          provider_message_id: messageId,
          timestamp: timestamp
        })
        .select('*')
        .single()

      console.log('Message stored:', message.id)

      // Update conversation's last message
      if (!fromMe) {
        await clientSupabase
          .from('whatsapp_conversations')
          .update({
            last_message: messageBody || 'Media',
            last_message_at: timestamp,
            unread_count: conversation.unread_count + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', conversation.id)
      }

      return new Response(JSON.stringify({ success: true, message_id: message.id }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Handle other webhook formats (Evolution, Z-API, etc)
    if (body.data?.message || body.message) {
      const msg = body.data?.message || body.message
      const phone = msg.key?.remoteJid?.replace('@s.whatsapp.net', '') || ''
      const fromMe = msg.key?.fromMe || false
      const messageBody = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
      
      if (phone) {
        let phoneE164 = phone
        if (!phoneE164.startsWith('+')) {
          phoneE164 = '+' + phoneE164
        }

        // Store similar to above
        const { data: contact } = await clientSupabase
          .from('whatsapp_contacts')
          .upsert({
            organization_id: organizationId,
            phone_e164: phoneE164,
            name: msg.pushName || phoneE164,
            is_whatsapp: true
          }, { onConflict: 'organization_id,phone_e164' })
          .select('*')
          .single()

        const { data: conversation } = await clientSupabase
          .from('whatsapp_conversations')
          .upsert({
            organization_id: organizationId,
            contact_id: contact.id,
            last_message: messageBody,
            last_message_at: new Date().toISOString(),
            unread_count: fromMe ? 0 : 1
          }, { onConflict: 'organization_id,contact_id' })
          .select('*')
          .single()

        await clientSupabase
          .from('whatsapp_messages')
          .insert({
            organization_id: organizationId,
            conversation_id: conversation.id,
            instance_id: instanceId,
            direction: fromMe ? 'outbound' : 'inbound',
            type: 'text',
            body: messageBody,
            status: 'received',
            provider_message_id: msg.key?.id,
            timestamp: new Date().toISOString()
          })
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})