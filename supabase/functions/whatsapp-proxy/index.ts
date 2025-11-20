// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

/**
 * Converte número para formato WuzAPI (remove o 9 extra em números móveis BR)
 * WuzAPI espera números móveis com 8 dígitos (formato antigo)
 */
function toWuzApiNumber(phone: string): string {
  if (!phone) return ''
  
  // Remove o + e caracteres não numéricos
  let number = phone.replace(/^\+/, '').replace(/[^\d]/g, '')
  
  // Se não for número brasileiro, retorna como está
  if (!number.startsWith('55')) {
    return number
  }
  
  // Analisa o número brasileiro
  const countryCode = number.substring(0, 2) // 55
  const remaining = number.substring(2) // DDD + número
  
  // Se não tiver pelo menos DDD + número
  if (remaining.length < 10) {
    return number
  }
  
  const ddd = remaining.substring(0, 2) // DDD (11-99)
  const localNumber = remaining.substring(2) // Número local
  
  // Verifica se é um DDD válido (11-99)
  const dddNum = parseInt(ddd)
  if (dddNum < 11 || dddNum > 99) {
    return number
  }
  
  // Se o número local tem 9 dígitos e começa com 9, remove o 9
  if (localNumber.length === 9 && localNumber.startsWith('9')) {
    // Verifica se o segundo dígito é válido para celular (6-9)
    const secondDigit = localNumber[1]
    if (['6', '7', '8', '9'].includes(secondDigit)) {
      // Remove o 9 do início
      const fixedLocalNumber = localNumber.substring(1)
      return countryCode + ddd + fixedLocalNumber
    }
  }
  
  // Caso contrário, retorna o número sem alterações
  return number
}

type Provider = 'zapi' | 'evolution'
type InternalAction = 'internal-start-session' | 'internal-get-status' | 'internal-get-qr' | 'internal-logout'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const masterUrl = Deno.env.get('SUPABASE_URL')!
    const masterServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const masterSupabase = createClient(masterUrl, masterServiceKey)

    const anonAuth = req.headers.get('authorization')
    const clientTokenHeader = req.headers.get('x-whatsapp-client-token') || req.headers.get('x-client-token') || req.headers.get('client-token') || ''
    const instanceTokenHeader = req.headers.get('x-instance-token') || ''
    if (!anonAuth && !clientTokenHeader && !instanceTokenHeader) {
      return json({ success: false, error: 'Authorization, client-token or instance-token header required' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const action: string = body.action
    const organizationId: string = body.organizationId
    const to_e164: string | undefined = body.to_e164

    if (!action) return json({ success: false, error: 'action is required' }, 400)
    if (!organizationId) return json({ success: false, error: 'organizationId is required' }, 400)

    // Load active integration for org
    // Resolve client Supabase credentials from master DB (similar to automation-trigger)
    const accessToken = (req.headers.get('authorization') || '').replace('Bearer ', '')
    let requesterOrgOk = false
    if (anonAuth) {
      try {
        const { data: userInfo } = await masterSupabase.auth.getUser(accessToken)
        const requesterId = userInfo?.user?.id
        if (requesterId) {
          const { data: requester } = await masterSupabase
            .from('saas_users')
            .select('organization_id')
            .eq('id', requesterId)
            .maybeSingle()
          requesterOrgOk = requester?.organization_id === organizationId
        }
      } catch {}
    }

    // Get client credentials by organization (prefer per-org on master.saas_organizations; fallback to master.saas_users legacy)
    let clientUrl = ''
    let encrypted = ''
    let instanceLimits: number | null = null
    try {
      const { data: orgRow } = await masterSupabase
        .from('saas_organizations')
        .select('client_supabase_url, client_anon_key_encrypted, client_service_key_encrypted')
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
        .select('supabase_url, supabase_key_encrypted, instance_limits')
        .eq('organization_id', organizationId)
        .not('supabase_url', 'is', null)
        .not('supabase_key_encrypted', 'is', null)
        .limit(1)
        .maybeSingle()
      if (userRow?.supabase_url && userRow?.supabase_key_encrypted) {
        clientUrl = userRow.supabase_url
        encrypted = String(userRow.supabase_key_encrypted)
        instanceLimits = Number((userRow as any)?.instance_limits || 1) || 1
      }
    }
    if (!clientUrl || !encrypted) {
      return json({ success: false, error: 'Client Supabase credentials not found for organization', details: organizationId }, 400)
    }

    const clientKey = atob(encrypted)
    const clientSupabase = createClient(clientUrl, clientKey)

    // Public automation validation: allow either client-token (integration) or instance-token (instances)
    if (!anonAuth) {
      let allowed = false
      if (clientTokenHeader) {
        const { data: integByToken } = await clientSupabase
          .from('whatsapp_integrations')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('client_token', clientTokenHeader)
          .eq('is_active', true)
          .maybeSingle()
        allowed = !!integByToken
      }
      if (!allowed && instanceTokenHeader) {
        const { data: instByToken } = await clientSupabase
          .from('whatsapp_instances')
          .select('id')
          .eq('organization_id', organizationId)
          .or(`instance_token.eq.${instanceTokenHeader},client_token.eq.${instanceTokenHeader}`)
          .eq('is_active', true)
          .maybeSingle()
        allowed = !!instByToken
      }
      if (!allowed) {
        return json({ success: false, error: 'Invalid client or instance token for organization' }, 401)
      }
    }

    // Internal actions should not require an existing integration row
    if (action && action.startsWith('internal-')) {
      const internalBase = Deno.env.get('INTERNAL_WA_CORE_URL') || 'http://localhost:8088'
      const internalToken = Deno.env.get('INTERNAL_API_TOKEN') || ''
      const useWuzapi = !!Deno.env.get('WUZAPI_URL')
      const wuzapiBase = Deno.env.get('WUZAPI_URL') || ''
      const wuzapiAdminToken = Deno.env.get('WUZAPI_ADMIN_TOKEN') || ''
      // Resolve per-organization WuzAPI user token; provision if missing
      async function resolveWuzapiToken(): Promise<string> {
        // First check if we have a token already stored
        try {
          const { data: integRow } = await clientSupabase
            .from('whatsapp_integrations')
            .select('id, client_token, device_jid, provider, is_active')
            .eq('organization_id', organizationId)
            .eq('provider', 'internal')
            .eq('is_active', true)
            .maybeSingle()
          
          console.log('[whatsapp-proxy] Found integration:', { 
            hasIntegration: !!integRow,
            hasToken: !!(integRow?.client_token && integRow.client_token !== 'internal'),
            hasDeviceJid: !!integRow?.device_jid
          })
          
          // Check if we have a valid token stored
          if (integRow?.client_token && integRow.client_token !== 'internal' && integRow.client_token.length >= 16) {
            console.log('[whatsapp-proxy] Using existing token from integration')
            return integRow.client_token
          }
          
          // If we don't have a valid token, we need to create one
          // Use the default WuzAPI token if available
          const defaultToken = Deno.env.get('WUZAPI_USER_TOKEN')
          if (defaultToken) {
            console.log('[whatsapp-proxy] Using default WUZAPI_USER_TOKEN')
            // Update the integration with this token
            try {
              await clientSupabase
                .from('whatsapp_integrations')
                .upsert({ 
                  organization_id: organizationId, 
                  provider: 'internal', 
                  instance_id: 'internal', 
                  client_token: defaultToken, 
                  is_active: true 
                }, { onConflict: 'organization_id,provider' })
            } catch (e) {
              console.error('[whatsapp-proxy] Failed to update integration with token:', e)
            }
            return defaultToken
          }
          
          // If we have admin token, create a new user in WuzAPI
          if (wuzapiAdminToken && wuzapiBase) {
            const newToken = generateHexToken(24)
            console.log('[whatsapp-proxy] Creating new WuzAPI user with admin token')
            
            try {
              const createRes = await fetch(`${wuzapiBase.replace(/\/$/, '')}/admin/users`, {
                method: 'POST', 
                headers: { 
                  'Authorization': `Bearer ${wuzapiAdminToken}`, 
                  'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                  name: `org-${organizationId.slice(0, 8)}`, 
                  token: newToken, 
                  webhook: '', 
                  expiration: 0, 
                  events: 'All' 
                })
              })
              
              if (createRes.ok || createRes.status === 409) {
                // Save the token to integration
                await clientSupabase
                  .from('whatsapp_integrations')
                  .upsert({ 
                    organization_id: organizationId, 
                    provider: 'internal', 
                    instance_id: 'internal', 
                    client_token: newToken, 
                    is_active: true 
                  }, { onConflict: 'organization_id,provider' })
                console.log('[whatsapp-proxy] Created and saved new WuzAPI token')
                return newToken
              }
            } catch (e) {
              console.error('[whatsapp-proxy] Failed to create WuzAPI user:', e)
            }
          }
          
          // No token available
          console.error('[whatsapp-proxy] No valid WuzAPI token available')
          throw new Error('No valid WuzAPI token configured')
        } catch (error) {
          console.error('[whatsapp-proxy] Error resolving WuzAPI token:', error)
          // Last resort fallback
          return Deno.env.get('WUZAPI_USER_TOKEN') || ''
        }
      }

      async function ensureActiveInstance(): Promise<{ instance_id: string, instance_token: string, client_token: string }> {
        // Try load active instance
        const { data: inst, error: loadError } = await clientSupabase
          .from('whatsapp_instances')
          .select('instance_id, instance_token, client_token')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .maybeSingle()
        
        if (loadError) {
          console.error('[whatsapp-proxy] Error loading active instance:', loadError)
        }
        
        if (inst?.instance_token && inst?.client_token) {
          console.log('[whatsapp-proxy] Found active instance:', inst.instance_id)
          return inst as any
        }
        
        console.log('[whatsapp-proxy] No active instance found, creating new one...')
        
        // Create new instance
        const newInst = {
          organization_id: organizationId,
          instance_id: `inst_${crypto.randomUUID().split('-')[0]}`,
          instance_token: generateHexToken(24),
          client_token: generateHexToken(24),
          is_active: true
        }
        
        const { data: created, error: createError } = await clientSupabase
          .from('whatsapp_instances')
          .insert(newInst)
          .select('instance_id, instance_token, client_token')
          .single()
        
        if (createError || !created) {
          console.error('[whatsapp-proxy] Failed to create instance:', createError)
          throw new Error(`Failed to create instance: ${createError?.message || 'Unknown error'}`)
        }
        
        console.log('[whatsapp-proxy] Created new instance:', created.instance_id)
        
        // Mirror into integration row by FKs for easier join
        try {
          await clientSupabase
            .from('whatsapp_integrations')
            .upsert({ 
              organization_id: organizationId, 
              provider: 'internal', 
              instance_id: created.instance_id, 
              instance_token: created.instance_token, 
              client_token: 'internal', 
              is_active: true 
            }, { onConflict: 'organization_id,provider' })
          console.log('[whatsapp-proxy] Mirrored instance to integrations table')
        } catch (mirrorError) { 
          console.error('[whatsapp-proxy] Failed to mirror to integrations:', mirrorError)
        }
        
        return created as any
      }
      const authHeader = { 'Authorization': `Bearer ${internalToken}` }
      if (!internalToken) {
        return json({ success: false, provider: 'internal', error: 'INTERNAL_API_TOKEN not configured', data: {} }, 200)
      }
      if (action === 'internal-start-session') {
        if (useWuzapi) {
          console.log('[whatsapp-proxy] Starting session for org:', organizationId)
          // Ensure instance exists; store tokens for future automation
          const inst = await ensureActiveInstance()
          const wuzapiToken = await resolveWuzapiToken()
          const url = `${wuzapiBase.replace(/\/$/, '')}/session/connect`
          console.log('[whatsapp-proxy] Calling WuzAPI connect endpoint...')
          try {
            const res = await fetch(url, { 
              method: 'POST', 
              headers: { 
                'Content-Type': 'application/json', 
                token: wuzapiToken 
              }, 
              body: JSON.stringify({ 
                Subscribe: ['All'], 
                Immediate: false  // Changed to false to wait for actual connection status
              }) 
            })
            const text = await res.text()
            let data: any = {}
            try { data = JSON.parse(text) } catch { data = { raw: text } }
            console.log('[whatsapp-proxy] WuzAPI connect response:', { 
              status: res.status, 
              ok: res.ok,
              error: data?.error,
              details: data?.data?.details,
              jid: data?.data?.jid
            })
            
            if (!res.ok) {
              if (res.status === 404) {
                // Graceful fallback to internal core
              } else if (res.status === 500 && /already\s*connected/i.test(data?.error || '')) {
                // Already connected - this is actually success
                console.log('[whatsapp-proxy] Already connected, updating status')
                
                // Get actual JID from status endpoint
                try {
                  const statusRes = await fetch(`${wuzapiBase.replace(/\/$/, '')}/session/status`, { 
                    headers: { token: wuzapiToken } 
                  })
                  if (statusRes.ok) {
                    const statusData = await statusRes.json()
                    // Try to get JID from admin endpoint if available
                    let jid = null
                    if (wuzapiAdminToken) {
                      try {
                        const adminRes = await fetch(`${wuzapiBase.replace(/\/$/, '')}/admin/users`, { 
                          headers: { 'Authorization': `Bearer ${wuzapiAdminToken}` } 
                        })
                        if (adminRes.ok) {
                          const adminData = await adminRes.json()
                          const userMatch = (adminData?.instances || []).find((i: any) => i?.token === wuzapiToken)
                          jid = userMatch?.jid || null
                        }
                      } catch {}
                    }
                    
                    await clientSupabase
                      .from('whatsapp_integrations')
                      .update({ 
                        pairing_status: 'connected', 
                        device_jid: jid, 
                        connected_at: new Date().toISOString(), 
                        updated_at: new Date().toISOString() 
                      })
                      .eq('organization_id', organizationId)
                      .eq('provider', 'internal')
                      .eq('is_active', true)
                  }
                } catch {}
                
                return json({ success: true, provider: 'internal', data: { 
                  code: 200,
                  data: { details: 'Already connected', status: 'connected' },
                  success: true
                }})
              } else {
                return json({ success: false, provider: 'internal', status: res.status, error: data?.error || 'WuzAPI connect error', request_url: url, data }, 200)
              }
            } else {
              // Success - extract real JID from response
              const extractedJid = data?.data?.jid || null
              console.log('[whatsapp-proxy] Connection successful, JID:', extractedJid)
              
              // Update integration with connection details
              try {
                const updatePayload: any = { 
                  pairing_status: extractedJid ? 'connected' : 'waiting_qr',
                  updated_at: new Date().toISOString() 
                }
                
                if (extractedJid) {
                  updatePayload.device_jid = extractedJid
                  updatePayload.connected_at = new Date().toISOString()
                }
                
                await clientSupabase
                  .from('whatsapp_integrations')
                  .update(updatePayload)
                  .eq('organization_id', organizationId)
                  .eq('provider', 'internal')
                  .eq('is_active', true)
                  
                console.log('[whatsapp-proxy] Updated integration with connection details')
              } catch (e) {
                console.error('[whatsapp-proxy] Failed to update integration:', e)
              }
              
              // Configure webhook to our orchestrator (client-directed)
              try {
                const webhookUrl = `${masterUrl.replace(/\/$/, '')}/functions/v1/whatsapp-orchestrator-public?organization_id=${encodeURIComponent(organizationId)}&instance_id=${encodeURIComponent(inst.instance_id || 'internal')}`
                console.log('[whatsapp-proxy] Setting webhook to:', webhookUrl)
                
                await fetch(`${wuzapiBase.replace(/\/$/, '')}/webhook`, { 
                  method: 'POST', 
                  headers: { 
                    'Content-Type': 'application/json', 
                    token: wuzapiToken 
                  }, 
                  body: JSON.stringify({ 
                    webhook: webhookUrl, 
                    events: ['All'] 
                  }) 
                })
              } catch (e) {
                console.error('[whatsapp-proxy] Failed to set webhook:', e)
              }
              
              return json({ success: true, provider: 'internal', data })
            }
          } catch (e: any) {
            return json({ success: false, provider: 'internal', error: e?.message || 'fetch_failed', request_url: url, data: {} }, 200)
          }
        }
        const url = `${internalBase}/sessions/start`
        try {
          const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ organization_id: organizationId }) })
          const text = await res.text()
          let data: any = {}
          try { data = JSON.parse(text) } catch { data = { raw: text } }
          if (!res.ok) return json({ success: false, provider: 'internal', status: res.status, error: data?.error || `Internal core error`, request_url: url, data }, 200)
          return json({ success: true, provider: 'internal', data })
        } catch (e: any) {
          return json({ success: false, provider: 'internal', error: e?.message || 'fetch_failed', request_url: url, data: {} }, 200)
        }
      }
      if (action === 'internal-get-status') {
        if (useWuzapi) {
          console.log('[whatsapp-proxy] Getting status for org:', organizationId)
          const inst = await ensureActiveInstance()
          const wuzapiToken = await resolveWuzapiToken()
          const url = `${wuzapiBase.replace(/\/$/, '')}/session/status`
          console.log('[whatsapp-proxy] Calling WuzAPI status endpoint with token:', wuzapiToken ? 'token_present' : 'no_token')
          try {
            const res = await fetch(url, { headers: { token: wuzapiToken } })
            const text = await res.text()
            let data: any = {}
            try { data = JSON.parse(text) } catch { data = { raw: text } }
            
            console.log('[whatsapp-proxy] WuzAPI status response:', { 
              status: res.status,
              ok: res.ok,
              error: data?.error,
              data: data?.data
            })
            
            // Handle "No session" error - need to create session first
            if (!res.ok && res.status === 500 && data?.error === 'No session') {
              console.log('[whatsapp-proxy] No session found, need to call /session/connect first')
              // Return disconnected status to prompt user to start session
              return json({ 
                success: true, 
                provider: 'internal', 
                data: { 
                  code: 200,
                  data: {
                    Connected: false,
                    LoggedIn: false,
                    status: 'disconnected'
                  },
                  success: true
                }
              })
            }
            
            // Normalize provider payload -> ensure data.status follows our UI contract
            try {
              const connected = (data?.data?.Connected ?? data?.Connected ?? false) as boolean
              const loggedIn = (data?.data?.LoggedIn ?? data?.LoggedIn ?? false) as boolean
              const status = connected ? (loggedIn ? 'connected' : 'waiting_qr') : 'disconnected'
              
              console.log('[whatsapp-proxy] Status interpretation:', { connected, loggedIn, status })
              if (typeof data === 'object') {
                data.data = { ...(data.data || {}), status }
              }
              // persist minimal state
              try {
                let jid = data?.data?.jid || data?.jid || null
                // If connected and jid not present, try admin/users
                if (status === 'connected' && !jid && wuzapiAdminToken) {
                  try {
                    const adminRes = await fetch(`${wuzapiBase.replace(/\/$/, '')}/admin/users`, { headers: { 'Authorization': `Bearer ${wuzapiAdminToken}` } })
                    const adminText = await adminRes.text()
                    const adminJson = JSON.parse(adminText)
                    const match = (adminJson?.instances || []).find((i: any) => i?.token === wuzapiToken)
                    jid = match?.jid || jid
                  } catch { /* ignore */ }
                }
                const payload: any = { pairing_status: status, updated_at: new Date().toISOString() }
                if (status === 'connected') {
                  payload.connected_at = new Date().toISOString()
                }
                if (jid) payload.device_jid = jid
                await clientSupabase
                  .from('whatsapp_integrations')
                  .update(payload)
                  .eq('organization_id', organizationId)
                  .eq('provider', 'internal')
                  .eq('is_active', true)
              } catch {}
            } catch { /* noop */ }
            if (!res.ok) {
              if (res.status === 404) {
                // Fallback to internal core below
              } else {
                return json({ success: false, provider: 'internal', status: res.status, error: data?.error || 'WuzAPI status error', request_url: url, data }, 200)
              }
            } else {
              // Best-effort ensure webhook stays configured whenever we poll status
              try {
                const wuzapiToken = await resolveWuzapiToken()
                const webhookUrl = `${masterUrl.replace(/\/$/, '')}/functions/v1/whatsapp-orchestrator-public?organization_id=${encodeURIComponent(organizationId)}&instance_id=${encodeURIComponent(inst.instance_id || 'internal')}`
                const base = (Deno.env.get('WUZAPI_URL') || '').replace(/\/$/, '')
                await fetch(`${base}/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', token: wuzapiToken }, body: JSON.stringify({ webhook: webhookUrl, events: ['All'] }) }).catch(() => {})
              } catch { /* ignore */ }
              return json({ success: true, provider: 'internal', data })
            }
          } catch (e: any) {
            return json({ success: false, provider: 'internal', error: e?.message || 'fetch_failed', request_url: url, data: {} }, 200)
          }
        }
        const url = `${internalBase}/sessions/${organizationId}/status`
        try {
          const res = await fetch(url, { headers: { ...authHeader } })
          const text = await res.text()
          let data: any = {}
          try { data = JSON.parse(text) } catch { data = { raw: text } }
          if (!res.ok) return json({ success: false, provider: 'internal', status: res.status, error: data?.error || 'Internal core error', request_url: url, data }, 200)
          return json({ success: true, provider: 'internal', data })
        } catch (e: any) {
          return json({ success: false, provider: 'internal', error: e?.message || 'fetch_failed', request_url: url, data: {} }, 200)
        }
      }
      if (action === 'internal-get-qr') {
        if (useWuzapi) {
          console.log('[whatsapp-proxy] Getting QR code for org:', organizationId)
          await ensureActiveInstance()
          const wuzapiToken = await resolveWuzapiToken()
          const url = `${wuzapiBase.replace(/\/$/, '')}/session/qr`
          console.log('[whatsapp-proxy] Calling WuzAPI QR endpoint...')
          try {
            const res = await fetch(url, { headers: { token: wuzapiToken } })
            const text = await res.text()
            let raw: any = {}
            try { raw = JSON.parse(text) } catch { raw = { raw: text } }
            console.log('[whatsapp-proxy] WuzAPI QR response:', { 
              status: res.status,
              hasQRCode: !!(raw?.data?.QRCode || raw?.QRCode),
              error: raw?.error
            })
            // If provider reports already logged in, surface as connected instead of error
            if (/already\s*login|already\s*logged|already\s*connected/i.test(raw?.error || '')) {
              const data = { status: 'connected' }
              // persist connected state
              try {
                let jid: string | null = null
                if (wuzapiAdminToken) {
                  try {
                    const adminRes = await fetch(`${wuzapiBase.replace(/\/$/, '')}/admin/users`, { headers: { 'Authorization': `Bearer ${wuzapiAdminToken}` } })
                    const adminText = await adminRes.text()
                    const adminJson = JSON.parse(adminText)
                    const match = (adminJson?.instances || []).find((i: any) => i?.token === wuzapiToken)
                    jid = match?.jid || null
                  } catch { /* ignore */ }
                }
                await clientSupabase
                  .from('whatsapp_integrations')
                  .update({ pairing_status: 'connected', device_jid: jid, connected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                  .eq('organization_id', organizationId)
                  .eq('provider', 'internal')
                  .eq('is_active', true)
              } catch {}
              return json({ success: true, provider: 'internal', data })
            }
            const data = normalizeQRPayload(raw)
            // if QR exists, mark waiting_qr
            try {
              const hasQr = !!(data?.qr_png_base64 || data?.data?.qr_png_base64 || data?.data?.qrcode || data?.qrcode)
              if (hasQr) {
                await clientSupabase
                  .from('whatsapp_integrations')
                  .update({ pairing_status: 'waiting_qr', updated_at: new Date().toISOString() })
                  .eq('organization_id', organizationId)
                  .eq('provider', 'internal')
                  .eq('is_active', true)
              }
            } catch {}
            if (!res.ok) {
              if (res.status === 404) {
                // Fallback to internal core below
              } else {
                return json({ success: false, provider: 'internal', status: res.status, error: data?.error || 'WuzAPI qr error', request_url: url, data }, 200)
              }
            } else {
              return json({ success: true, provider: 'internal', data })
            }
          } catch (e: any) {
            return json({ success: false, provider: 'internal', error: e?.message || 'fetch_failed', request_url: url, data: {} }, 200)
          }
        }
        const url = `${internalBase}/sessions/${organizationId}/qr`
        try {
          const res = await fetch(url, { headers: { ...authHeader } })
          const text = await res.text()
          let raw: any = {}
          try { raw = JSON.parse(text) } catch { raw = { raw: text } }
          const data = normalizeQRPayload(raw)
          if (!res.ok) return json({ success: false, provider: 'internal', status: res.status, error: data?.error || 'Internal core error', request_url: url, data }, 200)
          return json({ success: true, provider: 'internal', data })
        } catch (e: any) {
          return json({ success: false, provider: 'internal', error: e?.message || 'fetch_failed', request_url: url, data: {} }, 200)
        }
      }
      if (action === 'internal-logout') {
        if (useWuzapi) {
          await ensureActiveInstance()
          const wuzapiToken = await resolveWuzapiToken()
          const url = `${wuzapiBase.replace(/\/$/, '')}/session/logout`
          try {
            const res = await fetch(url, { method: 'POST', headers: { token: wuzapiToken } })
            const text = await res.text()
            let data: any = {}
            try { data = JSON.parse(text) } catch { data = { raw: text } }
            if (!res.ok) {
              if (res.status === 404) {
                // Fallback to internal core below
              } else {
                return json({ success: false, provider: 'internal', status: res.status, error: data?.error || 'WuzAPI logout error', request_url: url, data }, 200)
              }
            } else {
              try {
                await clientSupabase
                  .from('whatsapp_integrations')
                  .update({ pairing_status: 'unpaired', device_jid: null, updated_at: new Date().toISOString() })
                  .eq('organization_id', organizationId)
                  .eq('provider', 'internal')
                  .eq('is_active', true)
              } catch {}
              return json({ success: true, provider: 'internal', data })
            }
          } catch (e: any) {
            return json({ success: false, provider: 'internal', error: e?.message || 'fetch_failed', request_url: url, data: {} }, 200)
          }
        }
        const url = `${internalBase}/sessions/${organizationId}/logout`
        try {
          const res = await fetch(url, { method: 'POST', headers: { ...authHeader } })
          const text = await res.text()
          let data: any = {}
          try { data = JSON.parse(text) } catch { data = { raw: text } }
          if (!res.ok) return json({ success: false, provider: 'internal', status: res.status, error: data?.error || 'Internal core error', request_url: url, data }, 200)
          return json({ success: true, provider: 'internal', data })
        } catch (e: any) {
          return json({ success: false, provider: 'internal', error: e?.message || 'fetch_failed', request_url: url, data: {} }, 200)
        }
      }
    }

    // Webhook management (WuzAPI) - does not require existing integration
    if (['webhook-get', 'webhook-set', 'webhook-delete', 'webhook-update'].includes(action)) {
      const useWuzapi = !!Deno.env.get('WUZAPI_URL')
      const wuzapiBase = Deno.env.get('WUZAPI_URL') || ''
      if (!useWuzapi || !wuzapiBase) return json({ success: false, provider: 'internal', error: 'WuzAPI not configured' }, 400)
      // resolve token per org
      const { data: inst } = await clientSupabase
        .from('whatsapp_instances')
        .select('client_token')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .maybeSingle()
      const wuzapiToken = inst?.client_token || Deno.env.get('WUZAPI_USER_TOKEN') || ''
      const base = wuzapiBase.replace(/\/$/, '')
      try {
        if (action === 'webhook-get') {
          // Read current configured webhook from WuzAPI
          const res = await fetch(`${base}/webhook`, { headers: { token: wuzapiToken } })
          const data = await res.json().catch(() => ({}))
          const currentUrl = (data?.webhook || data?.data?.webhook || data?.url || data?.data?.url || '').toString()

          // Ensure webhook points to PUBLIC orchestrator with correct org and instance
          let needUpdate = false
          const inst = await (async () => { try { return await ensureActiveInstance() } catch { return null as any } })()
          const expectedUrl = `${masterUrl.replace(/\/$/, '')}/functions/v1/whatsapp-orchestrator-public?organization_id=${encodeURIComponent(organizationId)}&instance_id=${encodeURIComponent(inst?.instance_id || 'internal')}`
          if (!currentUrl) needUpdate = true
          else if (!currentUrl.includes('/whatsapp-orchestrator-public')) needUpdate = true
          else if (!currentUrl.includes(`organization_id=${encodeURIComponent(organizationId)}`)) needUpdate = true
          else if (!currentUrl.includes('instance_id=')) needUpdate = true

          if (needUpdate) {
            try {
              const setRes = await fetch(`${base}/webhook`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', token: wuzapiToken }, 
                body: JSON.stringify({ webhook: expectedUrl, events: ['All'] }) 
              })
              const setData = await setRes.json().catch(() => ({}))
              return json({ success: setRes.ok, provider: 'internal', data: setData })
            } catch (e: any) {
              return json({ success: false, provider: 'internal', error: e?.message || 'webhook_set_failed' }, 200)
            }
          }
          return json({ success: res.ok, provider: 'internal', data })
        }
        if (action === 'webhook-set') {
          const payload = { webhook: body.webhook, events: body.events || ['All'] }
          const res = await fetch(`${base}/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', token: wuzapiToken }, body: JSON.stringify(payload) })
          const data = await res.json().catch(() => ({}))
          return json({ success: res.ok, provider: 'internal', data })
        }
        if (action === 'webhook-delete') {
          const res = await fetch(`${base}/webhook`, { method: 'DELETE', headers: { token: wuzapiToken } })
          const data = await res.json().catch(() => ({}))
          return json({ success: res.ok, provider: 'internal', data })
        }
        if (action === 'webhook-update') {
          const payload = { webhook: body.webhook, events: body.events || ['All'], active: body.active !== false }
          const res = await fetch(`${base}/webhook/update`, { method: 'PUT', headers: { 'Content-Type': 'application/json', token: wuzapiToken }, body: JSON.stringify(payload) })
          const data = await res.json().catch(() => ({}))
          return json({ success: res.ok, provider: 'internal', data })
        }
      } catch (e: any) {
        return json({ success: false, provider: 'internal', error: e?.message || 'webhook_error' }, 200)
      }
    }

    // Instance management - does not require loading an active integration
    // Handle BEFORE provider-specific routing to avoid "Unknown action for internal provider" errors
    if (['instance-create', 'instance-list', 'instance-rotate', 'instance-set-active'].includes(action)) {
      if (action === 'instance-create') {
        // Enforce instance limits from master.saas_users
        const limit = Number(instanceLimits || 1) || 1
        try {
          const { count } = await clientSupabase
            .from('whatsapp_instances')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
          if ((count || 0) >= limit) {
            return json({ success: false, provider: 'internal', error: 'instance_limit_reached', limit }, 200)
          }
        } catch { /* ignore and continue */ }
        const newInst = {
          organization_id: organizationId,
          instance_id: `inst_${crypto.randomUUID().split('-')[0]}`,
          instance_token: generateHexToken(24),
          client_token: generateHexToken(24),
          is_active: true
        }
        const { data, error } = await clientSupabase
          .from('whatsapp_instances')
          .insert(newInst)
          .select('*')
          .single()
        if (error) {
          return json({ success: false, provider: 'internal', error: error.message || 'insert_failed' }, 200)
        }
        return json({ success: true, provider: 'internal', data })
      }
      if (action === 'instance-list') {
        console.log('[whatsapp-proxy] Listing instances for org:', organizationId)
        const { data, error } = await clientSupabase
          .from('whatsapp_instances')
          .select('id, instance_id, status, device_jid, connected_at, created_at, updated_at, is_active')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
        
        if (error) {
          console.error('[whatsapp-proxy] Error listing instances:', error)
          return json({ success: false, error: error.message }, 500)
        }
        
        console.log('[whatsapp-proxy] Found instances:', data?.length || 0)
        return json({ success: true, provider: 'internal', data: data || [] })
      }
      if (action === 'instance-rotate') {
        const instanceId: string = body.instance_id
        const rotate: 'instance_token' | 'client_token' | 'both' = body.rotate || 'both'
        if (!instanceId) return json({ success: false, error: 'instance_id is required' }, 400)
        const updates: any = { updated_at: new Date().toISOString() }
        if (rotate === 'instance_token' || rotate === 'both') updates.instance_token = generateHexToken(24)
        if (rotate === 'client_token' || rotate === 'both') updates.client_token = generateHexToken(24)
        const { data } = await clientSupabase
          .from('whatsapp_instances')
          .update(updates)
          .eq('organization_id', organizationId)
          .eq('instance_id', instanceId)
          .select('instance_id, instance_token, client_token, updated_at')
          .single()
        return json({ success: true, provider: 'internal', data })
      }
      if (action === 'instance-set-active') {
        const instanceId: string = body.instance_id
        if (!instanceId) return json({ success: false, error: 'instance_id is required' }, 400)
        try {
          // deactivate others
          await clientSupabase.from('whatsapp_instances').update({ is_active: false }).eq('organization_id', organizationId)
          // activate selected
          await clientSupabase.from('whatsapp_instances').update({ is_active: true }).eq('organization_id', organizationId).eq('instance_id', instanceId)
          // mirror into integration row if internal provider exists
          await clientSupabase
            .from('whatsapp_integrations')
            .upsert({ organization_id: organizationId, provider: 'internal', instance_id: instanceId, client_token: 'internal', is_active: true }, { onConflict: 'organization_id,provider' })
          return json({ success: true, provider: 'internal', data: { instance_id: instanceId } })
        } catch (e: any) {
          return json({ success: false, provider: 'internal', error: e?.message || 'set_active_failed' }, 200)
        }
      }
    }

    // Load active integration from CLIENT supabase
    const { data: integration, error: integError } = await clientSupabase
      .from('whatsapp_integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (integError || !integration) {
      console.error('No active integration or query error:', integError?.message)
      return json({ success: false, error: 'No active WhatsApp integration found', details: integError?.message }, 400)
    }

    const provider: Provider | 'internal' = integration.provider as any
    const baseResult = { provider }

    // INTERNAL provider routing
    if (provider === 'internal') {
      const internalBase = Deno.env.get('INTERNAL_WA_CORE_URL') || 'http://localhost:8088'
      const authHeader = { 'Authorization': `Bearer ${Deno.env.get('INTERNAL_API_TOKEN') || ''}` }
      const useWuzapi = !!Deno.env.get('WUZAPI_URL')
      const wuzapiBase = (Deno.env.get('WUZAPI_URL') || '').replace(/\/$/, '')
      async function resolveWuzapiTokenLocal(): Promise<string> {
        try {
          // Prefer the integration token to ensure we use the same session token used to connect
          const { data: integ } = await clientSupabase
            .from('whatsapp_integrations')
            .select('client_token')
            .eq('organization_id', organizationId)
            .eq('provider', 'internal')
            .eq('is_active', true)
            .maybeSingle()
          if (integ?.client_token && integ.client_token !== 'internal') {
            return integ.client_token
          }
          // Fallback to active instance token
          const { data: inst } = await clientSupabase
            .from('whatsapp_instances')
            .select('client_token')
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .maybeSingle()
          if (inst?.client_token) return inst.client_token
        } catch { /* ignore and fallback */ }
        return Deno.env.get('WUZAPI_USER_TOKEN') || ''
      }
      // Helper: normalize external/remote URL to data URL (download) or pass-through if already data URL
      async function toDataUrlIfNeeded(input: string | undefined, fallbackMime: string): Promise<string | undefined> {
        if (!input) return undefined
        if (/^data:/i.test(input)) return input
        try {
          const res = await fetch(input)
          const buf = await res.arrayBuffer()
          const bytes = new Uint8Array(buf)
          const b64 = btoa(String.fromCharCode(...bytes))
          const mime = res.headers.get('content-type') || fallbackMime
          return `data:${mime};base64,${b64}`
        } catch {
          // fallback to provided string
          return input
        }
      }
      async function fetchAsDataUrl(url: string, fallbackMime: string): Promise<string> {
        const res = await fetch(url)
        const buf = await res.arrayBuffer()
        const bytes = new Uint8Array(buf)
        const b64 = btoa(String.fromCharCode(...bytes))
        const mime = res.headers.get('content-type') || fallbackMime
        return `data:${mime};base64,${b64}`
      }
      switch (action as InternalAction | string) {
        case 'internal-start-session': {
          const res = await fetch(`${internalBase}/sessions/start`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ organization_id: organizationId }) })
          const data = await res.json().catch(() => ({}))
          // Persist minimal status on integration
          await clientSupabase.from('whatsapp_integrations').update({ pairing_status: data?.status || 'waiting_qr', updated_at: new Date().toISOString() }).eq('id', integration.id)
          return json({ success: res.ok, ...baseResult, data })
        }
        case 'internal-get-status': {
          const res = await fetch(`${internalBase}/sessions/${organizationId}/status`, { headers: { ...authHeader } })
          const raw = await res.json().catch(() => ({}))
          // Normalize into a stable status field for the UI
          const connected = (raw?.data?.Connected ?? raw?.Connected ?? false) as boolean
          const loggedIn = (raw?.data?.LoggedIn ?? raw?.LoggedIn ?? false) as boolean
          const status = connected ? (loggedIn ? 'connected' : 'waiting_qr') : 'disconnected'
          const data = { ...raw, data: { ...(raw?.data || {}), status } }
          // Mirror fields to DB
          await clientSupabase.from('whatsapp_integrations').update({ pairing_status: status, device_jid: raw?.jid || null, last_seen: raw?.last_seen ? new Date(raw.last_seen).toISOString() : null, updated_at: new Date().toISOString() }).eq('id', integration.id)
          return json({ success: res.ok, ...baseResult, data })
        }
        case 'internal-get-qr': {
          const res = await fetch(`${internalBase}/sessions/${organizationId}/qr`, { headers: { ...authHeader } })
          const raw = await res.json().catch(() => ({}))
          const data = normalizeQRPayload(raw)
          return json({ success: res.ok, ...baseResult, data })
        }
        case 'internal-logout': {
          const res = await fetch(`${internalBase}/sessions/${organizationId}/logout`, { method: 'POST', headers: { ...authHeader } })
          const data = await res.json().catch(() => ({}))
          await clientSupabase.from('whatsapp_integrations').update({ pairing_status: 'unpaired', device_jid: null, updated_at: new Date().toISOString() }).eq('id', integration.id)
          return json({ success: res.ok, ...baseResult, data })
        }
        case 'send-text':
        case 'send-image':
        case 'send-audio':
        case 'send-video':
        case 'send-document':
        case 'send-contact': {
          if (useWuzapi) {
            const token = await resolveWuzapiTokenLocal()
            let url = ''
            let payload: any = { Phone: toWuzApiNumber(to_e164 || '') }
            // Block sends to numbers that are not on WhatsApp (strict mode only)
            if ((Deno.env.get('WHATSAPP_STRICT_CHECK') || '').toLowerCase() === 'true') {
              try {
                const base = wuzapiBase
                const checkRes = await fetch(`${base}/user/check`, { method: 'POST', headers: { 'Content-Type': 'application/json', token }, body: JSON.stringify({ Phone: [ payload.Phone ] }) })
                const checkJson = await checkRes.json().catch(() => ({}))
                const isOnWA = !!(checkJson?.data?.Users?.[0]?.IsInWhatsapp || checkJson?.Users?.[0]?.IsInWhatsapp)
                if (checkRes.ok && isOnWA === false) {
                  return json({ success: false, provider: 'internal', error: 'number_not_in_whatsapp', data: checkJson })
                }
              } catch { /* non-blocking on network errors */ }
            }
            if (action === 'send-text') {
              url = `${wuzapiBase}/chat/send/text`
              payload.Body = body.text
            }
            if (action === 'send-image') {
              url = `${wuzapiBase}/chat/send/image`
              payload.Image = await toDataUrlIfNeeded(body.image_url, 'image/jpeg')
              if (body.caption) payload.Caption = body.caption
            }
            if (action === 'send-audio') {
              url = `${wuzapiBase}/chat/send/audio`
              payload.Audio = await toDataUrlIfNeeded(body.audio_url, 'audio/ogg')
            }
            if (action === 'send-video') {
              url = `${wuzapiBase}/chat/send/video`
              payload.Video = await toDataUrlIfNeeded(body.video_url, 'video/mp4')
              if (body.caption) payload.Caption = body.caption
            }
            if (action === 'send-contact') {
              url = `${wuzapiBase}/chat/send/contact`
              payload.Name = body.name
              payload.Vcard = body.vcard
            }
            if (action === 'send-document') {
              url = `${wuzapiBase}/chat/send/document`
              payload.Document = await toDataUrlIfNeeded(body.document_url, 'application/octet-stream')
              if (body.file_name) payload.FileName = body.file_name
            }
            const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', token: token }, body: JSON.stringify(payload) })
            const data = await res.json().catch(() => ({}))
            // Use active instance id for internal provider
            let activeInstId: string | undefined
            try {
              const { data: inst } = await clientSupabase
                .from('whatsapp_instances')
                .select('instance_id')
                .eq('organization_id', organizationId)
                .eq('is_active', true)
                .maybeSingle()
              activeInstId = inst?.instance_id
            } catch { /* ignore */ }
            if (action === 'send-text') await persistOutboundMessage(clientSupabase, organizationId, body.conversationId, to_e164!, 'text', body.text || null, data, undefined, activeInstId)
            if (action === 'send-image') await persistOutboundMessage(clientSupabase, organizationId, body.conversationId, to_e164!, 'image', body.caption || null, data, body.image_url, activeInstId)
            if (action === 'send-audio') await persistOutboundMessage(clientSupabase, organizationId, body.conversationId, to_e164!, 'audio', null, data, body.audio_url, activeInstId)
            if (action === 'send-video') await persistOutboundMessage(clientSupabase, organizationId, body.conversationId, to_e164!, 'document', body.caption || null, data, body.video_url, activeInstId)
            if (action === 'send-document') await persistOutboundMessage(clientSupabase, organizationId, body.conversationId, to_e164!, 'document', body.file_name || null, data, body.document_url, activeInstId)
            return json({ success: res.ok, ...baseResult, data })
          }
          // Internal core fallback
          const payload2: any = { organization_id: organizationId, to_e164: toWuzApiNumber(to_e164 || ''), type: action === 'send-text' ? 'text' : action === 'send-image' ? 'image' : action === 'send-audio' ? 'audio' : 'document', text: body.text, media_url: body.image_url || body.audio_url || body.video_url || body.document_url, caption: body.caption, reply_to: body.reply_to }
          const res2 = await fetch(`${internalBase}/messages/send`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify(payload2) })
          const data2 = await res2.json().catch(() => ({}))
          let activeInstId2: string | undefined
          try {
            const { data: inst } = await clientSupabase
              .from('whatsapp_instances')
              .select('instance_id')
              .eq('organization_id', organizationId)
              .eq('is_active', true)
              .maybeSingle()
            activeInstId2 = inst?.instance_id
          } catch { }
          if (action === 'send-text') await persistOutboundMessage(clientSupabase, organizationId, body.conversationId, to_e164!, 'text', body.text || null, data2, undefined, activeInstId2)
          if (action === 'send-image') await persistOutboundMessage(clientSupabase, organizationId, body.conversationId, to_e164!, 'image', body.caption || null, data2, body.image_url, activeInstId2)
          if (action === 'send-audio') await persistOutboundMessage(clientSupabase, organizationId, body.conversationId, to_e164!, 'audio', null, data2, body.audio_url, activeInstId2)
          if (action === 'send-video') await persistOutboundMessage(clientSupabase, organizationId, body.conversationId, to_e164!, 'document', body.caption || null, data2, body.video_url, activeInstId2)
          if (action === 'send-document') await persistOutboundMessage(clientSupabase, organizationId, body.conversationId, to_e164!, 'document', body.file_name || null, data2, body.document_url, activeInstId2)
          return json({ success: res2.ok, ...baseResult, data: data2 })
        }
        default:
          return json({ success: false, error: `Unknown action for internal provider: ${action}` }, 400)
      }
    }

    switch (action) {
      case 'delete-conversation': {
        const convId: string | undefined = body.conversation_id
        const contactPhone: string | undefined = body.to_e164
        if (!convId && !contactPhone) return json({ success: false, error: 'conversation_id or to_e164 required' }, 400)
        try {
          if (convId) {
            await clientSupabase.from('whatsapp_messages').delete().eq('organization_id', organizationId).eq('conversation_id', convId)
            await clientSupabase.from('whatsapp_conversations').delete().eq('organization_id', organizationId).eq('id', convId)
          } else if (contactPhone) {
            const { data: contact } = await clientSupabase
              .from('whatsapp_contacts')
              .select('id')
              .eq('organization_id', organizationId)
              .eq('phone_e164', contactPhone)
              .maybeSingle()
            if (contact?.id) {
              const { data: conv } = await clientSupabase
                .from('whatsapp_conversations')
                .select('id')
                .eq('organization_id', organizationId)
                .eq('contact_id', contact.id)
                .maybeSingle()
              if (conv?.id) {
                await clientSupabase.from('whatsapp_messages').delete().eq('organization_id', organizationId).eq('conversation_id', conv.id)
                await clientSupabase.from('whatsapp_conversations').delete().eq('organization_id', organizationId).eq('id', conv.id)
              }
            }
          }
          return json({ success: true, ...baseResult })
        } catch (e: any) {
          return json({ success: false, error: e?.message || 'delete_failed' }, 200)
        }
      }
      case 'instance-create': {
        const newInst = {
          organization_id: organizationId,
          instance_id: `inst_${crypto.randomUUID().split('-')[0]}`,
          instance_token: generateHexToken(24),
          client_token: generateHexToken(24),
          is_active: true
        }
        const { data, error } = await clientSupabase
          .from('whatsapp_instances')
          .insert(newInst)
          .select('*')
          .single()
        if (error) {
          return json({ success: false, ...baseResult, error: error.message || 'insert_failed' })
        }
        return json({ success: true, ...baseResult, data })
      }
      case 'instance-list': {
        const { data } = await clientSupabase
          .from('whatsapp_instances')
          .select('id, instance_id, status, device_jid, connected_at, created_at, updated_at, is_active')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
        return json({ success: true, ...baseResult, data })
      }
      case 'instance-rotate': {
        const instanceId: string = body.instance_id
        const rotate: 'instance_token' | 'client_token' | 'both' = body.rotate || 'both'
        if (!instanceId) return json({ success: false, error: 'instance_id is required' }, 400)
        const updates: any = { updated_at: new Date().toISOString() }
        if (rotate === 'instance_token' || rotate === 'both') updates.instance_token = generateHexToken(24)
        if (rotate === 'client_token' || rotate === 'both') updates.client_token = generateHexToken(24)
        const { data } = await clientSupabase
          .from('whatsapp_instances')
          .update(updates)
          .eq('organization_id', organizationId)
          .eq('instance_id', instanceId)
          .select('instance_id, instance_token, client_token, updated_at')
          .single()
        return json({ success: true, ...baseResult, data })
      }
      case 'send-text': {
        const text: string = body.text
        if (!to_e164 || !text) return json({ success: false, error: 'to_e164 and text are required' }, 400)
        const apiRes = await providerSendText(provider, integration, toWuzApiNumber(to_e164), text)
        await persistOutboundMessage(clientSupabase, organizationId, body.conversationId, to_e164, 'text', text, apiRes, undefined, integration.instance_id)
        return json({ success: true, ...baseResult, data: apiRes })
      }
      case 'send-video': {
        const videoUrl: string = body.video_url
        const caption: string | undefined = body.caption
        if (!to_e164 || !videoUrl) return json({ success: false, error: 'to_e164 and video_url are required' }, 400)
        const apiRes = await providerSendVideo(provider, integration, toWuzApiNumber(to_e164), videoUrl, caption)
        await persistOutboundMessage(clientSupabase, organizationId, body.conversationId, to_e164, 'document', caption || null, apiRes, videoUrl, integration.instance_id)
        return json({ success: true, ...baseResult, data: apiRes })
      }
      case 'send-pix': {
        const pixKey: string = body.pix_key
        const value: number = body.value
        const description: string | undefined = body.description
        if (!to_e164 || !pixKey || !value) return json({ success: false, error: 'to_e164, pix_key and value are required' }, 400)
        const apiRes = await providerSendPix(provider, integration, toWuzApiNumber(to_e164), pixKey, value, description)
        return json({ success: apiRes?.status === 200, ...baseResult, data: apiRes })
      }
      case 'reply-message': {
        const reply_to: string = body.reply_to
        const text: string = body.text
        if (!to_e164 || !reply_to || !text) return json({ success: false, error: 'to_e164, reply_to and text are required' }, 400)
        const apiRes = await providerReplyMessage(provider, integration, toWuzApiNumber(to_e164), reply_to, text)
        return json({ success: apiRes?.status === 200, ...baseResult, data: apiRes })
      }
      case 'list-chats': {
        const page: number = body.page || 1
        const pageSize: number = body.pageSize || 50
        const data = await providerListChats(provider, integration, page, pageSize)
        return json({ success: data?.status === 200, ...baseResult, data })
      }
      case 'chat-metadata': {
        if (!to_e164) return json({ success: false, error: 'to_e164 is required' }, 400)
        const data = await providerChatMetadata(provider, integration, toWuzApiNumber(to_e164))
        return json({ success: data?.status === 200, ...baseResult, data })
      }
      case 'read-chat': {
        if (!to_e164) return json({ success: false, error: 'to_e164 is required' }, 400)
        const data = await providerReadChat(provider, integration, toWuzApiNumber(to_e164))
        return json({ success: data?.status === 200, ...baseResult, data })
      }
      case 'add-contact': {
        const name: string = body.name || ''
        if (!to_e164) return json({ success: false, error: 'to_e164 is required' }, 400)
        const data = await providerAddContact(provider, integration, toWuzApiNumber(to_e164), name)
        return json({ success: data?.status === 200, ...baseResult, data })
      }
      case 'is-whatsapp': {
        if (!to_e164) return json({ success: false, error: 'to_e164 is required' }, 400)
        // When provider is internal and WuzAPI enabled, call WuzAPI /user/check
        if (integration.provider === 'internal' && Deno.env.get('WUZAPI_URL')) {
          try {
            // Prefer integration token to align with the active connected session
            let token = integration?.client_token && integration.client_token !== 'internal' 
              ? integration.client_token 
              : ''
            if (!token) {
              const { data: inst } = await clientSupabase
                .from('whatsapp_instances')
                .select('client_token')
                .eq('organization_id', organizationId)
                .eq('is_active', true)
                .maybeSingle()
              token = inst?.client_token || ''
            }
            if (!token) token = Deno.env.get('WUZAPI_USER_TOKEN') || ''
            const base = (Deno.env.get('WUZAPI_URL') || '').replace(/\/$/, '')
            const res = await fetch(`${base}/user/check`, { method: 'POST', headers: { 'Content-Type': 'application/json', token }, body: JSON.stringify({ Phone: [ toWuzApiNumber(to_e164 || '') ] }) })
            const payload = await res.json().catch(() => ({}))
            return json({ success: res.ok, provider: 'internal', data: payload })
          } catch (e: any) {
            return json({ success: false, provider: 'internal', error: e?.message || 'wuzapi_iswhatsapp_error' }, 200)
          }
        }
        const data = await providerIsWhatsapp(provider, integration, toWuzApiNumber(to_e164))
        return json({ success: data?.status === 200, ...baseResult, data })
      }
      case 'list-contacts': {
        const data = await providerListContacts(provider, integration)
        return json({ success: data?.status === 200, ...baseResult, data })
      }
      case 'read-message': {
        const messageId: string = body.message_id
        if (!messageId) return json({ success: false, error: 'message_id is required' }, 400)
        const data = await providerReadMessage(provider, integration, messageId)
        return json({ success: data?.status === 200, ...baseResult, data })
      }
      case 'send-image': {
        const imageUrl: string = body.image_url
        const caption: string | undefined = body.caption
        if (!to_e164 || !imageUrl) return json({ success: false, error: 'to_e164 and image_url are required' }, 400)
        const apiRes = await providerSendImage(provider, integration, toWuzApiNumber(to_e164), imageUrl, caption)
        await persistOutboundMessage(clientSupabase, organizationId, body.conversationId, to_e164, 'image', caption || null, apiRes, imageUrl, integration.instance_id)
        return json({ success: true, ...baseResult, data: apiRes })
      }
      case 'send-audio': {
        const audioUrl: string = body.audio_url
        if (!to_e164 || !audioUrl) return json({ success: false, error: 'to_e164 and audio_url are required' }, 400)
        const apiRes = await providerSendAudio(provider, integration, toWuzApiNumber(to_e164), audioUrl)
        await persistOutboundMessage(clientSupabase, organizationId, body.conversationId, to_e164, 'audio', null, apiRes, audioUrl, integration.instance_id)
        return json({ success: true, ...baseResult, data: apiRes })
      }
      case 'get-messages': {
        const since: string | undefined = body.since
        if (!to_e164) return json({ success: false, error: 'to_e164 is required' }, 400)
        const data = await providerGetMessages(provider, integration, toWuzApiNumber(to_e164), since)
        return json({ success: true, ...baseResult, data })
      }
      case 'sync-chats': {
        const page: number = body.page || 1
        const pageSize: number = body.pageSize || 50
        const res = await providerListChats(provider, integration, page, pageSize)
        const chats = res?.data || []
        for (const ch of chats) {
          try {
            const contactPhone = normalizePhone(ch.phone)
            // upsert contact
            const { data: contact } = await clientSupabase
              .from('whatsapp_contacts')
              .upsert({ organization_id: organizationId, phone_e164: contactPhone, name: ch.name || null }, { onConflict: 'organization_id,phone_e164' })
              .select('*')
              .single()
            const lastIso = epochToISO(ch.lastMessageTime)
            await clientSupabase
              .from('whatsapp_conversations')
              .upsert({ organization_id: organizationId, contact_id: contact.id, status: 'open', last_message_at: lastIso }, { onConflict: 'organization_id,contact_id' })
          } catch (e) { console.warn('sync-chats upsert error', e) }
        }
        return json({ success: true, ...baseResult, count: chats.length })
      }
      case 'sync-messages': {
        const since: string | undefined = body.since
        if (!to_e164) return json({ success: false, error: 'to_e164 is required' }, 400)
        const res = await providerGetMessages(provider, integration, toWuzApiNumber(to_e164), since)
        const msgs = res?.data || []
        // ensure contact and conversation
        const { data: contact } = await clientSupabase
          .from('whatsapp_contacts')
          .upsert({ organization_id: organizationId, phone_e164: normalizePhone(to_e164) }, { onConflict: 'organization_id,phone_e164' })
          .select('*')
          .single()
        const conv = await ensureConversation(clientSupabase, organizationId, contact.id)
        let inserted = 0
        for (const m of msgs) {
          try {
            const direction = (m.fromMe || m.direction === 'outbound') ? 'outbound' : 'inbound'
            const type = inferTypeFromMessage(m)
            const bodyText = m.text?.message || m.message || m.body || null
            const media = m.image?.url || m.audio?.url || m.video?.url || m.document?.url || null
            const providerId = m.id || m.messageId || null
            const ts = toISO(m.timestamp)
            const { error } = await clientSupabase.from('whatsapp_messages').insert({
              organization_id: organizationId,
              conversation_id: conv.id,
              direction,
              type,
              body: bodyText,
              media_url: media,
              status: 'delivered',
              provider_message_id: providerId,
              timestamp: ts,
              instance_id: integration.instance_id || null
            })
            if (!error) inserted++
          } catch (e) { /* ignore duplicates */ }
        }
        return json({ success: true, ...baseResult, inserted })
      }
      default:
        return json({ success: false, error: `Unknown action: ${action}` }, 400)
    }
  } catch (error: any) {
    console.error('❌ [WHATSAPP-PROXY] Error:', error)
    return json({ success: false, error: error.message }, 500)
  }
})

function json(payload: any, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function normalizePhone(input: string) {
  const digits = ('' + input).replace(/\D/g, '')
  if (digits.startsWith('55')) return `+${digits}`
  if (digits.length >= 10 && digits.length <= 12) return `+55${digits}`
  return `+${digits}`
}

function epochToISO(val: any): string | null {
  if (val == null) return null
  const n = Number(val)
  // if seconds, convert; if ms, use directly
  const ms = n < 1e12 ? n * 1000 : n
  try { return new Date(ms).toISOString() } catch { return null }
}

function inferTypeFromMessage(m: any): 'text' | 'image' | 'audio' | 'document' {
  if (m?.image || /image/.test(m?.mimetype || '')) return 'image'
  if (m?.audio || /audio/.test(m?.mimetype || '')) return 'audio'
  if (m?.video || /video/.test(m?.mimetype || '')) return 'document'
  if (m?.document || /application\//.test(m?.mimetype || '')) return 'document'
  return 'text'
}

function toISO(ts: any): string {
  const n = Number(ts)
  if (Number.isFinite(n)) {
    return epochToISO(n) || new Date().toISOString()
  }
  try { return new Date(ts).toISOString() } catch { return new Date().toISOString() }
}

function normalizeQRPayload(input: any) {
  const out: any = { ...input }
  const nested = (input && typeof input === 'object' && typeof input.data === 'object') ? input.data : null
  const candidates = [
    input?.qr_png_base64,
    input?.qr,
    input?.QRCode,
    input?.qrcode,
    nested?.qr_png_base64,
    nested?.qr,
    nested?.QRCode,
    nested?.qrcode,
    typeof input?.data === 'string' ? input.data : null,
    typeof nested?.data === 'string' ? nested.data : null,
  ].filter(Boolean)
  const first = candidates?.[0]
  if (first && typeof first === 'string') {
    const normalized = first.startsWith('data:') ? first : `data:image/png;base64,${first}`
    out.qr_png_base64 = normalized
    // also expose inside nested block if present for maximum compatibility
    if (nested && typeof nested === 'object') {
      out.data = { ...nested, qr_png_base64: normalized }
    }
  }
  return out
}

function generateHexToken(lenBytes: number): string {
  const bytes = new Uint8Array(lenBytes)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function providerSendText(provider: Provider, integ: any, to: string, text: string) {
  if (provider === 'zapi') {
    const url = `https://api.z-api.io/instances/${integ.instance_id}/token/${integ.instance_token}/send-text`
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'client-token': integ.client_token, 'Client-Token': integ.client_token }, body: JSON.stringify({ phone: to, message: text }) })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  }
  // evolution
  const url = `${integ.base_url || 'http://localhost:8080'}/message/sendText/${integ.instance_id}`
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': integ.client_token }, body: JSON.stringify({ number: to, text: text }) })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function providerSendImage(provider: Provider, integ: any, to: string, imageUrl: string, caption?: string) {
  if (provider === 'zapi') {
    const url = `https://api.z-api.io/instances/${integ.instance_id}/token/${integ.instance_token}/send-image`
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'client-token': integ.client_token, 'Client-Token': integ.client_token }, body: JSON.stringify({ phone: to, image: imageUrl, caption }) })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  }
  const url = `${integ.base_url || 'http://localhost:8080'}/message/sendImage/${integ.instance_id}`
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': integ.client_token }, body: JSON.stringify({ number: to, url: imageUrl, caption }) })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function providerSendAudio(provider: Provider, integ: any, to: string, audioUrl: string) {
  if (provider === 'zapi') {
    const url = `https://api.z-api.io/instances/${integ.instance_id}/token/${integ.instance_token}/send-audio`
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'client-token': integ.client_token, 'Client-Token': integ.client_token }, body: JSON.stringify({ phone: to, audio: audioUrl }) })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  }
  const url = `${integ.base_url || 'http://localhost:8080'}/message/sendAudio/${integ.instance_id}`
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': integ.client_token }, body: JSON.stringify({ number: to, url: audioUrl }) })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function providerSendVideo(provider: Provider, integ: any, to: string, videoUrl: string, caption?: string) {
  if (provider === 'zapi') {
    const url = `https://api.z-api.io/instances/${integ.instance_id}/token/${integ.instance_token}/send-video`
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'client-token': integ.client_token, 'Client-Token': integ.client_token }, body: JSON.stringify({ phone: to, video: videoUrl, caption }) })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  }
  const url = `${integ.base_url || 'http://localhost:8080'}/message/sendVideo/${integ.instance_id}`
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': integ.client_token }, body: JSON.stringify({ number: to, url: videoUrl, caption }) })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function providerSendPix(provider: Provider, integ: any, to: string, pixKey: string, value: number, description?: string) {
  if (provider === 'zapi') {
    const url = `https://api.z-api.io/instances/${integ.instance_id}/token/${integ.instance_token}/send-button-pix`
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'client-token': integ.client_token, 'Client-Token': integ.client_token }, body: JSON.stringify({ phone: to, pixKey, value, description }) })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  }
  // Evolution não possui PIX nativo: retornar 400
  return { status: 400, data: { error: 'PIX not supported on Evolution' } }
}

async function providerReplyMessage(provider: Provider, integ: any, to: string, replyTo: string, text: string) {
  if (provider === 'zapi') {
    const url = `https://api.z-api.io/instances/${integ.instance_id}/token/${integ.instance_token}/reply-message`
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'client-token': integ.client_token, 'Client-Token': integ.client_token }, body: JSON.stringify({ phone: to, messageId: replyTo, message: text }) })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  }
  return { status: 400, data: { error: 'Reply not implemented' } }
}

async function providerListChats(provider: Provider, integ: any, page: number, pageSize: number) {
  if (provider === 'zapi') {
    const url = `https://api.z-api.io/instances/${integ.instance_id}/token/${integ.instance_token}/chats?page=${page}&pageSize=${pageSize}`
    const res = await fetch(url, { headers: { 'client-token': integ.client_token, 'Client-Token': integ.client_token } })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  }
  return { status: 400, data: { error: 'list-chats not implemented for Evolution' } }
}

async function providerChatMetadata(provider: Provider, integ: any, to: string) {
  if (provider === 'zapi') {
    const url = `https://api.z-api.io/instances/${integ.instance_id}/token/${integ.instance_token}/chats/metadata?phone=${encodeURIComponent(to)}`
    const res = await fetch(url, { headers: { 'client-token': integ.client_token, 'Client-Token': integ.client_token } })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  }
  return { status: 400, data: { error: 'chat-metadata not implemented for Evolution' } }
}

async function providerReadChat(provider: Provider, integ: any, to: string) {
  if (provider === 'zapi') {
    const url = `https://api.z-api.io/instances/${integ.instance_id}/token/${integ.instance_token}/chats/read`
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'client-token': integ.client_token, 'Client-Token': integ.client_token }, body: JSON.stringify({ phone: to }) })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  }
  return { status: 400, data: { error: 'read-chat not implemented for Evolution' } }
}

async function providerAddContact(provider: Provider, integ: any, to: string, name: string) {
  if (provider === 'zapi') {
    const url = `https://api.z-api.io/instances/${integ.instance_id}/token/${integ.instance_token}/contacts`
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'client-token': integ.client_token, 'Client-Token': integ.client_token }, body: JSON.stringify({ phone: to, name }) })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  }
  return { status: 400, data: { error: 'add-contact not implemented for Evolution' } }
}

async function providerIsWhatsapp(provider: Provider, integ: any, to: string) {
  if (provider === 'zapi') {
    const url = `https://api.z-api.io/instances/${integ.instance_id}/token/${integ.instance_token}/contacts/iswhatsapp?phone=${encodeURIComponent(to)}`
    const res = await fetch(url, { headers: { 'client-token': integ.client_token, 'Client-Token': integ.client_token } })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  }
  return { status: 400, data: { error: 'is-whatsapp not implemented for Evolution' } }
}

async function providerListContacts(provider: Provider, integ: any) {
  if (provider === 'zapi') {
    const url = `https://api.z-api.io/instances/${integ.instance_id}/token/${integ.instance_token}/contacts`
    const res = await fetch(url, { headers: { 'client-token': integ.client_token, 'Client-Token': integ.client_token } })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  }
  return { status: 400, data: { error: 'list-contacts not implemented for Evolution' } }
}

async function providerReadMessage(provider: Provider, integ: any, messageId: string) {
  if (provider === 'zapi') {
    const url = `https://api.z-api.io/instances/${integ.instance_id}/token/${integ.instance_token}/message/read`
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'client-token': integ.client_token, 'Client-Token': integ.client_token }, body: JSON.stringify({ messageId }) })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  }
  return { status: 400, data: { error: 'read-message not implemented for Evolution' } }
}
async function providerGetMessages(provider: Provider, integ: any, to: string, since?: string) {
  if (provider === 'zapi') {
    const url = `https://api.z-api.io/instances/${integ.instance_id}/token/${integ.instance_token}/get-messages?phone=${encodeURIComponent(to)}${since ? `&date=${encodeURIComponent(since)}` : ''}`
    const res = await fetch(url, { headers: { 'client-token': integ.client_token } })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  }
  const url = `${integ.base_url || 'http://localhost:8080'}/message/list/${integ.instance_id}?number=${encodeURIComponent(to)}${since ? `&fromDate=${encodeURIComponent(since)}` : ''}`
  const res = await fetch(url, { headers: { 'apikey': integ.client_token } })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function persistOutboundMessage(
  supabase: any,
  organizationId: string,
  conversationId: string | undefined,
  to: string,
  type: 'text' | 'image' | 'audio' | 'document',
  body: string | null,
  providerResponse: any,
  mediaUrl?: string
) {
  try {
    // Ensure contact and conversation
    const { data: contact } = await supabase
      .from('whatsapp_contacts')
      .upsert({ organization_id: organizationId, phone_e164: to }, { onConflict: 'organization_id,phone_e164' })
      .select('*')
      .single()

    const convId = conversationId || (await ensureConversation(supabase, organizationId, contact?.id)).id

    await supabase.from('whatsapp_messages').insert({
      organization_id: organizationId,
      conversation_id: convId,
      direction: 'outbound',
      type,
      body,
      media_url: mediaUrl || null,
      status: providerResponse?.status === 200 ? 'sent' : 'failed',
      provider_message_id: providerResponse?.data?.id || providerResponse?.data?.messageId || null,
      timestamp: new Date().toISOString()
    })
  } catch (e) {
    console.warn('⚠️ [WHATSAPP-PROXY] Persist message error:', e)
  }
}

async function ensureConversation(supabase: any, organizationId: string, contactId?: string) {
  if (!contactId) throw new Error('contactId required')
  const { data: existing } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('contact_id', contactId)
    .limit(1)
    .maybeSingle()

  if (existing) return existing
  const { data: created } = await supabase
    .from('whatsapp_conversations')
    .insert({ organization_id: organizationId, contact_id: contactId, status: 'open', last_message_at: new Date().toISOString() })
    .select('id')
    .single()
  return created
}


