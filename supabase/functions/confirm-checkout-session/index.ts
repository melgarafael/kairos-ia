// Supabase Edge Function: confirm-checkout-session
// GET/POST { session_id } → valida no Stripe e aplica plano ao usuário como fallback ao webhook
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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
  const MASTER_SUPABASE_URL = Deno.env.get('MASTER_SUPABASE_URL')
  const MASTER_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('MASTER_SUPABASE_SERVICE_ROLE_KEY')
  if (!STRIPE_SECRET_KEY || !MASTER_SUPABASE_URL || !MASTER_SUPABASE_SERVICE_ROLE_KEY) {
    return new Response('Missing env', { status: 500, headers: getCorsHeaders(req) })
  }

  try {
    const url = new URL(req.url)
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const sessionId = (body?.session_id || url.searchParams.get('session_id') || '').toString()
    if (!sessionId) return new Response('Missing session_id', { status: 400, headers: getCorsHeaders(req) })

    const stripeMod = await import('https://esm.sh/stripe@14.24.0?target=deno')
    const StripeCtor = stripeMod.default as any
    const httpClient = (StripeCtor && typeof StripeCtor.createFetchHttpClient === 'function')
      ? StripeCtor.createFetchHttpClient()
      : undefined
    const stripe = new StripeCtor(STRIPE_SECRET_KEY, { ...(httpClient ? { httpClient } : {}) })

    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (!session || session.payment_status !== 'paid') {
      return new Response(JSON.stringify({ ok: false, paid: false }), {
        status: 200,
        headers: { 'content-type': 'application/json', ...getCorsHeaders(req) }
      })
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
    const supabase = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY)

    const userId: string | undefined = session.metadata?.user_id
    let planId: string | undefined = session.metadata?.plan_id
    const planSlug: string | undefined = session.metadata?.plan_slug
    if (!planId && planSlug) {
      const { data: p } = await supabase.from('saas_plans').select('id').eq('slug', planSlug).single()
      planId = p?.id || undefined
    }
    if (!userId || !planId) {
      return new Response('Missing user/plan', { status: 400, headers: getCorsHeaders(req) })
    }

    // Retrieve subscription for accurate periods
    let current_period_start = new Date().toISOString()
    let current_period_end = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
    let status: string = 'active'
    let cancel_at_period_end = false
    const subscriptionId: string | null = (session as any).subscription || null
    if (subscriptionId) {
      const stripeMod = await import('https://esm.sh/stripe@14.24.0?target=deno')
      const StripeCtor = stripeMod.default as any
      const httpClient = (StripeCtor && typeof StripeCtor.createFetchHttpClient === 'function') ? StripeCtor.createFetchHttpClient() : undefined
      const stripe = new StripeCtor(STRIPE_SECRET_KEY, { ...(httpClient ? { httpClient } : {}) })
      const subs = await stripe.subscriptions.retrieve(subscriptionId)
      if (subs) {
        status = (subs as any).status || status
        if ((subs as any).current_period_start) current_period_start = new Date((subs as any).current_period_start * 1000).toISOString()
        if ((subs as any).current_period_end) current_period_end = new Date((subs as any).current_period_end * 1000).toISOString()
        if (typeof (subs as any).cancel_at_period_end === 'boolean') cancel_at_period_end = (subs as any).cancel_at_period_end
      }
    }
    await supabase.from('saas_subscriptions').upsert({
      user_id: userId,
      plan_id: planId,
      status,
      current_period_start,
      current_period_end,
      cancel_at_period_end,
      stripe_subscription_id: subscriptionId,
      updated_at: new Date().toISOString()
    }, { onConflict: 'stripe_subscription_id' })

    // If add-on plan, increment organizations_extra; otherwise set base plan
    const isAddon = typeof planSlug === 'string' && planSlug.startsWith('org-extra-')
    if (isAddon) {
      const qty = planSlug === 'org-extra-10' ? 10 : planSlug === 'org-extra-5' ? 5 : 1
      const { error: addErr } = await supabase.rpc('perform_orgs_extra_increment', { p_user_id: userId, p_delta: qty })
      if (addErr) {
        const { data: u } = await supabase.from('saas_users').select('organizations_extra').eq('id', userId).single()
        const current = (u?.organizations_extra || 0) as number
        await supabase.from('saas_users').update({ organizations_extra: current + qty, updated_at: new Date().toISOString() }).eq('id', userId)
      }
    } else {
      // Base plan only; DO NOT touch organization_id
      const { error: updErr } = await supabase.from('saas_users').update({ plan_id: planId, updated_at: new Date().toISOString() }).eq('id', userId)
      if (updErr) console.log('[CONFIRM-CHECKOUT] saas_users update error:', updErr.message)
    }

    return new Response(JSON.stringify({ ok: true, paid: true }), {
      status: 200,
      headers: { 'content-type': 'application/json', ...getCorsHeaders(req) }
    })
  } catch (err) {
    return new Response(`Error: ${err?.message || err}`, { status: 500, headers: getCorsHeaders(req) })
  }
})


