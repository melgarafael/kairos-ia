// Supabase Edge Function: hotmart-webhook
// Env: MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY, HOTMART_WEBHOOK_SECRET
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key, x-hotmart-hmac-sha256',
    'Access-Control-Max-Age': '86400'
  }
}

async function hmacSha256Base64(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  const bytes = new Uint8Array(sig)
  return btoa(String.fromCharCode(...bytes))
}

function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const aBytes = enc.encode(a)
  const bBytes = enc.encode(b)
  if (aBytes.length !== bBytes.length) return false
  let result = 0
  for (let i = 0; i < aBytes.length; i++) result |= aBytes[i] ^ bBytes[i]
  return result === 0
}

function pick<T = any>(obj: any, path: string, def?: T): T | undefined {
  try { return path.split('.').reduce((o, k) => (o && (k in o)) ? o[k] : undefined, obj) ?? def } catch { return def }
}

function generateRandomPassword(length = 14): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()_+'
  const arr = new Uint32Array(length)
  crypto.getRandomValues(arr)
  let out = ''
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length]
  return out
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const MASTER_SUPABASE_URL = Deno.env.get('MASTER_SUPABASE_URL')
  const MASTER_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('MASTER_SUPABASE_SERVICE_ROLE_KEY')
  const HOTMART_WEBHOOK_SECRET = Deno.env.get('HOTMART_WEBHOOK_SECRET')
  if (!MASTER_SUPABASE_URL || !MASTER_SUPABASE_SERVICE_ROLE_KEY || !HOTMART_WEBHOOK_SECRET) {
    return new Response('Missing env', { status: 500, headers: getCorsHeaders(req) })
  }

  const rawBody = await req.text()
  const signature = req.headers.get('X-Hotmart-Hmac-SHA256') || req.headers.get('x-hotmart-hmac-sha256') || ''
  try {
    const expected = await hmacSha256Base64(HOTMART_WEBHOOK_SECRET, rawBody)
    if (!safeEqual(signature, expected)) {
      return new Response('Invalid signature', { status: 401, headers: getCorsHeaders(req) })
    }
  } catch (e) {
    return new Response('Signature check failed', { status: 401, headers: getCorsHeaders(req) })
  }

  const idempotencyKey = req.headers.get('Idempotency-Key') || undefined
  const payload = (() => { try { return JSON.parse(rawBody) } catch { return {} } })()

  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
  const supabase = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY)

  if (idempotencyKey) {
    const { data: existing } = await supabase.from('webhooks_log').select('id').eq('idempotency_key', idempotencyKey).maybeSingle()
    if (existing) return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  }

  const eventType: string = pick(payload, 'event', '') || pick(payload, 'data.event', '') || pick(payload, 'status', '') || 'unknown'
  const externalId: string = pick(payload, 'purchase.transaction') || pick(payload, 'data.purchase.transaction') || pick(payload, 'id') || ''
  await supabase.from('webhooks_log').insert({
    gateway: 'hotmart',
    event_type: eventType,
    external_id: externalId || null,
    idempotency_key: idempotencyKey || null,
    status: 'received',
    raw_payload_json: payload,
  })

  try {
    // Hotmart status examples: approved, completed, refunded, chargeback, canceled
    const statusRaw = (pick(payload, 'purchase.status', '') || pick(payload, 'status', '')).toString().toLowerCase()
    const isPaid = /approved|completed|paid/.test(statusRaw)
    const isCanceled = /canceled|cancelled|refunded|chargeback/.test(statusRaw)

    // Extract email and offer/product code
    const email: string | undefined = pick(payload, 'buyer.email') || pick(payload, 'data.buyer.email')
    const offerCode: string | undefined = pick(payload, 'purchase.offer.code') || pick(payload, 'offer.code') || pick(payload, 'data.purchase.offer.code')
    const planSlugMeta: string | undefined = pick(payload, 'purchase.plan_slug') || pick(payload, 'data.metadata.plan_slug')
    if (!email) throw new Error('missing_buyer_email')

    // Resolve plan
    let planId: string | null = null
    if (planSlugMeta) {
      const { data: p } = await supabase.from('saas_plans').select('id').eq('slug', planSlugMeta).maybeSingle()
      planId = p?.id || null
    }
    if (!planId && offerCode) {
      const { data: p2 } = await supabase.from('saas_plans').select('id').eq('hotmart_offer_code', offerCode).maybeSingle()
      planId = p2?.id || null
    }
    if (!planId) throw new Error('plan_not_found')

    // Ensure user
    let userId: string | null = null
    {
      const { data: u } = await supabase.from('saas_users').select('id').eq('email', email).maybeSingle()
      if (u?.id) {
        userId = u.id
      } else {
        const password = generateRandomPassword()
        const admin = supabase.auth.admin
        const created = await admin.createUser({ email, password, email_confirm: true, user_metadata: { plan_id: planId } })
        if ((created as any).error) throw new Error(`auth_create_failed: ${(created as any).error.message}`)
        userId = (created as any).data.user?.id || null
        await supabase.from('email_queue').insert({ recipient_email: email, template: 'welcome_credentials', variables_json: { email, password } })
      }
    }

    const externalSubscriptionId: string | null = pick(payload, 'subscription.id') || pick(payload, 'purchase.subscription.id') || pick(payload, 'purchase.transaction') || null
    const nowIso = new Date().toISOString()
    const periodEndGuess = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()

    if (!userId) throw new Error('user_missing')

    if (isPaid) {
      await supabase.from('saas_subscriptions').upsert({
        user_id: userId,
        plan_id: planId,
        status: 'active',
        gateway: 'hotmart',
        external_subscription_id: externalSubscriptionId,
        external_customer_id: pick(payload, 'buyer.id') || null,
        external_plan_code: offerCode || null,
        current_period_start: nowIso,
        current_period_end: periodEndGuess,
        cancel_at_period_end: false,
        updated_at: nowIso
      }, { onConflict: 'external_subscription_id' })
    }

    if (isCanceled && externalSubscriptionId) {
      await supabase.from('saas_subscriptions').update({ status: 'canceled', updated_at: nowIso }).eq('external_subscription_id', externalSubscriptionId)
    }

    await supabase.from('webhooks_log').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('idempotency_key', idempotencyKey)
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  } catch (err: any) {
    await supabase.from('webhooks_log').update({ status: 'failed', error_message: err?.message || String(err), processed_at: new Date().toISOString() }).eq('idempotency_key', idempotencyKey)
    return new Response(`Error: ${err?.message || err}`, { status: 400, headers: getCorsHeaders(req) })
  }
})


