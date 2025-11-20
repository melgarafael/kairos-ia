// Supabase Edge Function: create-checkout-session
// POST { user_id, plan_slug, interval: 'monthly'|'yearly', success_url, cancel_url }
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  }
}

type Payload = {
  user_id: string
  plan_slug: 'basic' | 'professional' | 'org-extra-1' | 'org-extra-5' | 'org-extra-10' | 'seats-extra-1' | 'seats-extra-5' | 'seats-extra-10'
  interval: 'monthly' | 'yearly'
  success_url?: string
  cancel_url?: string
  customer_email?: string
  organization_id?: string // optional: to attribute add-on seats to a specific org in future
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
    const MASTER_SUPABASE_URL = Deno.env.get('MASTER_SUPABASE_URL')
    const MASTER_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('MASTER_SUPABASE_SERVICE_ROLE_KEY')
    if (!STRIPE_SECRET_KEY || !MASTER_SUPABASE_URL || !MASTER_SUPABASE_SERVICE_ROLE_KEY) {
      return new Response('Missing env', { status: 500, headers: getCorsHeaders(req) })
    }

    const body = (await req.json()) as Payload
    if (!body?.user_id || !body?.plan_slug || !body?.interval) {
      return new Response('Invalid payload', { status: 400 })
    }

    // Fetch price from saas_plans
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
    const supabase = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY)

    const priceColumn = body.interval === 'yearly' ? 'stripe_price_id_yearly' : 'stripe_price_id_monthly'
    const { data: plan, error } = await supabase
      .from('saas_plans')
      .select(`id, name, slug, ${priceColumn}`)
      .eq('slug', body.plan_slug)
      .single()
    if (error || !plan || !plan[priceColumn]) {
      return new Response('Plan or price not found', { status: 400, headers: getCorsHeaders(req) })
    }

    // Create Stripe Checkout Session
    const stripeMod = await import('https://esm.sh/stripe@14.24.0?target=deno')
    // Em alguns bundles Deno/esm.sh, createFetchHttpClient não está no namespace raiz.
    // Garante compatibilidade usando o export default (classe Stripe) para criar o httpClient.
    const StripeCtor = stripeMod.default as any
    const httpClient = (StripeCtor && typeof StripeCtor.createFetchHttpClient === 'function')
      ? StripeCtor.createFetchHttpClient()
      : undefined
    const stripe = new StripeCtor(STRIPE_SECRET_KEY, {
      // Se não houver createFetchHttpClient disponível, Stripe SDK usará o fetch padrão.
      ...(httpClient ? { httpClient } : {}),
    })

    const url = new URL(req.url)
    const reqOrigin = req.headers.get('Origin') || ''
    const envAppUrl = Deno.env.get('APP_PUBLIC_URL') || ''
    const baseUrl = (envAppUrl && envAppUrl.trim().length > 0)
      ? envAppUrl
      : (reqOrigin || `${url.protocol}//${url.hostname}`)

    // If this is an add-on, update existing base subscription instead of creating a new one
    const isOrgAddon = typeof plan.slug === 'string' && plan.slug.startsWith('org-extra-')
    const isSeatsAddon = typeof plan.slug === 'string' && plan.slug.startsWith('seats-extra-')
    if (isOrgAddon || isSeatsAddon) {
      // Find user's base subscription (prefer basic/professional; ignore add-ons)
      const { data: subs } = await supabase
        .from('saas_subscriptions')
        .select('stripe_subscription_id, plan_id, status, updated_at')
        .eq('user_id', body.user_id)
        .order('updated_at', { ascending: false })
        .limit(10)
      const planIds = (subs || []).map(s => s.plan_id).filter(Boolean)
      let baseSubscriptionId: string | null = null
      if (planIds.length > 0) {
        const { data: plansInfo } = await supabase
          .from('saas_plans')
          .select('id, slug')
          .in('id', planIds as any)
        // Prefer explicit basic/professional
        const ordered = (subs || [])
          .map(s => ({
            sub: s,
            slug: (plansInfo || []).find(p => p.id === s.plan_id)?.slug || ''
          }))
          .filter(x => x.slug && !x.slug.startsWith('org-extra-'))
        const basePref = ordered.find(x => x.slug === 'professional' || x.slug === 'basic') || ordered[0]
        baseSubscriptionId = basePref?.sub?.stripe_subscription_id || null
      }

      // If still not found, try retrieving via Stripe by customer email
      if (!baseSubscriptionId) {
        let userEmail: string | null = null
        const { data: userRow } = await supabase
          .from('saas_users')
          .select('email')
          .eq('id', body.user_id)
          .single()
        userEmail = userRow?.email || null

        if (userEmail) {
          // Fetch base plan price ids to identify base subscription in Stripe
          const { data: basePlans } = await supabase
            .from('saas_plans')
            .select('slug, stripe_price_id_monthly, stripe_price_id_yearly')
            .in('slug', ['basic', 'professional'])
          const basePriceIds = new Set<string>((basePlans || []).flatMap(p => [p.stripe_price_id_monthly, p.stripe_price_id_yearly]).filter(Boolean) as string[])

          // Search Stripe customer by email
          const customers = await stripe.customers.search({ query: `email:'${userEmail.replace(/'/g, "\\'")}'` })
          const cust = customers?.data?.[0]
          if (cust?.id) {
            const subsList = await stripe.subscriptions.list({ customer: cust.id, status: 'all', limit: 10 })
            const candidate = subsList.data.find(s => {
              const goodStatus = ['active', 'trialing', 'past_due', 'unpaid'].includes((s as any).status || '')
              const hasBaseItem = Array.isArray((s as any).items?.data) && (s as any).items.data.some((it: any) => basePriceIds.has(it.price?.id))
              return goodStatus && hasBaseItem
            })
            baseSubscriptionId = candidate?.id || null
          }
        }
      }

      if (!baseSubscriptionId) {
        // Fallback: create a normal Checkout session for the add-on (user is likely on trial/no base plan)
        const session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          line_items: [{ price: plan[priceColumn], quantity: 1 }],
          customer_email: body.customer_email,
          success_url: body.success_url || `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: body.cancel_url || `${baseUrl}/checkout/cancel`,
          metadata: {
            user_id: body.user_id,
            plan_slug: body.plan_slug,
            interval: body.interval,
            plan_id: plan.id,
          },
        })
        return new Response(JSON.stringify({ url: session.url }), {
          headers: { 'content-type': 'application/json', ...getCorsHeaders(req) },
          status: 200,
        })
      }

      // Add add-on as a new subscription item to the existing subscription (non-destructive)
      await stripe.subscriptionItems.create({
        subscription: baseSubscriptionId,
        price: plan[priceColumn],
        quantity: 1,
      })

      // Optimistic local increment (webhook will reconcile on updates as well)
      if (isOrgAddon) {
        const qty = plan.slug === 'org-extra-10' ? 10 : plan.slug === 'org-extra-5' ? 5 : 1
        const { error: addErr } = await supabase.rpc('perform_orgs_extra_increment', { p_user_id: body.user_id, p_delta: qty })
        if (addErr) {
          const { data: u } = await supabase.from('saas_users').select('organizations_extra').eq('id', body.user_id).single()
          const current = (u?.organizations_extra || 0) as number
          await supabase.from('saas_users').update({ organizations_extra: current + qty, updated_at: new Date().toISOString() }).eq('id', body.user_id)
        }
      } else if (isSeatsAddon) {
        const qty = plan.slug === 'seats-extra-10' ? 10 : plan.slug === 'seats-extra-5' ? 5 : 1
        const { error: addErr2 } = await supabase.rpc('perform_member_seats_increment', { p_user_id: body.user_id, p_delta: qty })
        if (addErr2) {
          const { data: u2 } = await supabase.from('saas_users').select('member_seats_extra').eq('id', body.user_id).single()
          const current2 = (u2?.member_seats_extra || 0) as number
          await supabase.from('saas_users').update({ member_seats_extra: current2 + qty, updated_at: new Date().toISOString() }).eq('id', body.user_id)
        }
      }

      const successUrl = body.success_url || `${baseUrl}/checkout/success`
      return new Response(JSON.stringify({ url: successUrl }), {
        headers: { 'content-type': 'application/json', ...getCorsHeaders(req) },
        status: 200,
      })
    }

    // Default flow: base subscription checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: plan[priceColumn], quantity: 1 }],
      customer_email: body.customer_email,
      // Dica: se quiser atrelar ao email já cadastrado, passe customer_email via front
      success_url: body.success_url || `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: body.cancel_url || `${baseUrl}/checkout/cancel`,
      metadata: {
        user_id: body.user_id,
        plan_slug: body.plan_slug,
        interval: body.interval,
        plan_id: plan.id,
      },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 'content-type': 'application/json', ...getCorsHeaders(req) },
      status: 200,
    })
  } catch (err) {
    return new Response(`Error: ${err?.message || err}`, { status: 500, headers: getCorsHeaders(req) })
  }
})


