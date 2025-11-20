// Supabase Edge Function: pagarme-webhook
// Env: MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY, PAGARME_WEBHOOK_SECRET, PAGARME_SIGNATURE_HEADER (opcional)
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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key, x-hub-signature, x-hmac-signature',
    'Access-Control-Max-Age': '86400'
  }
}

async function hmacSha256(secret: string, payload: string): Promise<{ hex: string, base64: string }> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  const bytes = new Uint8Array(sigBuf)
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const base64 = btoa(String.fromCharCode(...bytes))
  return { hex, base64 }
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
  try {
    return path.split('.').reduce((o, k) => (o && (k in o)) ? o[k] : undefined, obj) ?? def
  } catch { return def }
}

function generateRandomPassword(length = 14): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()_+' // sem confusos
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
  const PAGARME_WEBHOOK_SECRET = Deno.env.get('PAGARME_WEBHOOK_SECRET')
  const SIGN_HEADER = Deno.env.get('PAGARME_SIGNATURE_HEADER') || 'X-Hub-Signature'
  if (!MASTER_SUPABASE_URL || !MASTER_SUPABASE_SERVICE_ROLE_KEY || !PAGARME_WEBHOOK_SECRET) {
    return new Response('Missing env', { status: 500, headers: getCorsHeaders(req) })
  }

  const idempotencyKey = req.headers.get('Idempotency-Key') || undefined
  const rawBody = await req.text()

  // Validação de assinatura (HMAC-SHA256). Pagar.me pode enviar como sha1= ou sha256=; suportamos hex/base64.
  try {
    const provided = req.headers.get(SIGN_HEADER) || ''
    const normalized = provided.toLowerCase().startsWith('sha1=') || provided.toLowerCase().startsWith('sha256=')
      ? provided.split('=')[1]
      : provided
    const { hex, base64 } = await hmacSha256(PAGARME_WEBHOOK_SECRET, rawBody)
    const ok = safeEqual(normalized, hex) || safeEqual(normalized, base64)
    if (!ok) {
      return new Response('Invalid signature', { status: 401, headers: getCorsHeaders(req) })
    }
  } catch (e) {
    return new Response('Signature check failed', { status: 401, headers: getCorsHeaders(req) })
  }

  const payload = (() => { try { return JSON.parse(rawBody) } catch { return {} } })()

  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
  const supabase = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY)

  // Registrar log com idempotência
  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from('webhooks_log')
      .select('id, status')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
    if (existing) {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        status: 200,
        headers: { 'content-type': 'application/json', ...getCorsHeaders(req) }
      })
    }
  }

  const eventType: string = pick(payload, 'event', '') || pick(payload, 'type', '') || 'unknown'
  const externalId: string = pick(payload, 'id', '') || pick(payload, 'data.id', '') || pick(payload, 'subscription.id', '') || ''
  await supabase.from('webhooks_log').insert({
    gateway: 'pagarme',
    event_type: eventType,
    external_id: externalId || null,
    idempotency_key: idempotencyKey || null,
    status: 'received',
    raw_payload_json: payload,
  })

  try {
    // Determinar status pago/cancelado
    const statusRaw: string = (pick(payload, 'current_status', '') || pick(payload, 'status', '') || '').toString().toLowerCase()
    const isPaid = /paid|captured|authorized/.test(statusRaw) || /subscription_payment_(paid|received)/.test(eventType)
    const isCanceled = /canceled|canceled_by_merchant|refunded|chargeback/.test(statusRaw) || /subscription_(canceled|cancelled)/.test(eventType)

    // Extrair email e produto/plano
    const email: string | undefined = pick(payload, 'customer.email') || pick(payload, 'data.customer.email') || pick(payload, 'transaction.customer.email')
    const productCode: string | undefined = pick(payload, 'plan.id') || pick(payload, 'subscription.plan.id') || pick(payload, 'data.plan.id') || pick(payload, 'transaction.metadata.plan_code')
    const planSlugMeta: string | undefined = pick(payload, 'metadata.plan_slug') || pick(payload, 'transaction.metadata.plan_slug')
    if (!email) {
      throw new Error('missing_customer_email')
    }

    // Resolver plano
    let planId: string | null = null
    if (planSlugMeta) {
      const { data: p } = await supabase.from('saas_plans').select('id').eq('slug', planSlugMeta).maybeSingle()
      planId = p?.id || null
    }
    if (!planId && productCode) {
      const { data: p2 } = await supabase.from('saas_plans').select('id').eq('pagarme_product_id', productCode).maybeSingle()
      planId = p2?.id || null
    }
    if (!planId) {
      throw new Error('plan_not_found')
    }

    // Garantir usuário (por email)
    let userId: string | null = null
    {
      const { data: u } = await supabase.from('saas_users').select('id').eq('email', email).maybeSingle()
      if (u?.id) {
        userId = u.id
      } else {
        // criar no Auth + enviar senha aleatória por e-mail
        const password = generateRandomPassword()
        const admin = supabase.auth.admin
        const created = await admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { plan_id: planId }
        })
        if ((created as any).error) throw new Error(`auth_create_failed: ${(created as any).error.message}`)
        userId = (created as any).data.user?.id || null
        // Enfileirar e-mail
        await supabase.from('email_queue').insert({
          recipient_email: email,
          template: 'welcome_credentials',
          variables_json: { email, password },
        })
      }
    }

    // Upsert assinatura
    const externalSubscriptionId: string | null = pick(payload, 'subscription.id') || pick(payload, 'data.subscription.id') || pick(payload, 'id') || null
    const nowIso = new Date().toISOString()
    const periodStart = pick<string>(payload, 'current_period.start') || nowIso
    const periodEnd = pick<string>(payload, 'current_period.end') || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()

    if (!userId) throw new Error('user_missing')

    if (isPaid) {
      await supabase.from('saas_subscriptions').upsert({
        user_id: userId,
        plan_id: planId,
        status: 'active',
        gateway: 'pagarme',
        external_subscription_id: externalSubscriptionId,
        external_customer_id: pick(payload, 'customer.id') || null,
        external_plan_code: productCode || null,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: false,
        updated_at: nowIso
      }, { onConflict: 'external_subscription_id' })
    }

    if (isCanceled && externalSubscriptionId) {
      await supabase
        .from('saas_subscriptions')
        .update({ status: 'canceled', updated_at: nowIso })
        .eq('external_subscription_id', externalSubscriptionId)
    }

    await supabase.from('webhooks_log').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('idempotency_key', idempotencyKey)

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json', ...getCorsHeaders(req) }
    })
  } catch (err: any) {
    await supabase.from('webhooks_log').update({ status: 'failed', error_message: err?.message || String(err), processed_at: new Date().toISOString() }).eq('idempotency_key', idempotencyKey)
    return new Response(`Error: ${err?.message || err}`, { status: 400, headers: getCorsHeaders(req) })
  }
})


