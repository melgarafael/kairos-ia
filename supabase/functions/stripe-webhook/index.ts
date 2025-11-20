// Supabase Edge Function: stripe-webhook
// Config: STRIPE_WEBHOOK_SECRET, MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY
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

serve(async (req) => {
  const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
  const MASTER_SUPABASE_URL = Deno.env.get('MASTER_SUPABASE_URL')
  const MASTER_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('MASTER_SUPABASE_SERVICE_ROLE_KEY')
  if (!STRIPE_WEBHOOK_SECRET || !STRIPE_SECRET_KEY || !MASTER_SUPABASE_URL || !MASTER_SUPABASE_SERVICE_ROLE_KEY) {
    return new Response('Missing env', { status: 500, headers: getCorsHeaders(req) })
  }

  try {
    const stripeMod = await import('https://esm.sh/stripe@14.24.0?target=deno')
    const StripeCtor = stripeMod.default as any
    const httpClient = (StripeCtor && typeof StripeCtor.createFetchHttpClient === 'function')
      ? StripeCtor.createFetchHttpClient()
      : undefined
    const stripe = new StripeCtor(STRIPE_SECRET_KEY, {
      ...(httpClient ? { httpClient } : {}),
    })

    const sig = req.headers.get('stripe-signature')!
    const rawBody = await req.text()
    // Deno/Edge runtimes exigem a versão assíncrona
    const event = await stripe.webhooks.constructEventAsync(rawBody, sig, STRIPE_WEBHOOK_SECRET)

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
    const supabase = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY)

    const type = event.type
    console.log('[STRIPE-WEBHOOK] Event type:', type)
    if (type === 'checkout.session.completed') {
      const session: any = event.data.object
      console.log('[STRIPE-WEBHOOK] checkout.session.completed payload meta:', {
        user_id: session?.metadata?.user_id,
        plan_id: session?.metadata?.plan_id,
        plan_slug: session?.metadata?.plan_slug,
        subscription: session?.subscription
      })
      const userId: string | undefined = session.metadata?.user_id
      const planId: string | undefined = session.metadata?.plan_id
      const planSlug: string | undefined = session.metadata?.plan_slug
      if (userId && (planId || planSlug)) {
        // Resolve planId if only slug provided
        let finalPlanId = planId
        if (!finalPlanId && planSlug) {
          const { data: p } = await supabase.from('saas_plans').select('id').eq('slug', planSlug).single()
          finalPlanId = p?.id || null
        }
        if (!finalPlanId) {
          console.log('[STRIPE-WEBHOOK] Plan not found for slug:', planSlug)
          return new Response('Plan not found', { status: 400 })
        }
        // Retrieve the subscription from Stripe to get accurate period bounds
        const subscriptionId: string | null = session?.subscription || null
        let current_period_start = new Date().toISOString()
        let current_period_end = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
        let status: string = 'active'
        let cancel_at_period_end = false
        if (subscriptionId) {
          const subs = await stripe.subscriptions.retrieve(subscriptionId)
          if (subs) {
            status = (subs as any).status || status
            if ((subs as any).current_period_start) current_period_start = new Date((subs as any).current_period_start * 1000).toISOString()
            if ((subs as any).current_period_end) current_period_end = new Date((subs as any).current_period_end * 1000).toISOString()
            if (typeof (subs as any).cancel_at_period_end === 'boolean') cancel_at_period_end = (subs as any).cancel_at_period_end
          }
        }
        console.log('[STRIPE-WEBHOOK] Upserting subscription:', {
          subscriptionId, userId,
          current_period_start, current_period_end, status, cancel_at_period_end,
          finalPlanId
        })
        // Upsert subscription row with user_id linkage, conflict on stripe_subscription_id (text)
        const { data: upData, error: upErr } = await supabase.from('saas_subscriptions').upsert({
          user_id: userId,
          plan_id: finalPlanId,
          status,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          stripe_subscription_id: subscriptionId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'stripe_subscription_id' }).select('stripe_subscription_id')
        if (upErr) {
          console.log('[STRIPE-WEBHOOK] Upsert error:', upErr.message)
        } else {
          console.log('[STRIPE-WEBHOOK] Upsert OK for:', upData)
        }
        // If this is an add-on (org-extra-* or seats-extra-*) adjust extras; otherwise update base plan
        const isOrgAddon = typeof planSlug === 'string' && planSlug.startsWith('org-extra-')
        const isSeatsAddon = typeof planSlug === 'string' && planSlug.startsWith('seats-extra-')
        if (isOrgAddon) {
          const qty = planSlug === 'org-extra-10' ? 10 : planSlug === 'org-extra-5' ? 5 : 1
          console.log('[STRIPE-WEBHOOK] Add-on purchase detected. Increment organizations_extra by', qty)
          const { error: addErr } = await supabase.rpc('perform_orgs_extra_increment', { p_user_id: userId, p_delta: qty })
          if (addErr) {
            // Fallback if RPC not found: perform direct update
            const { data: u } = await supabase.from('saas_users').select('organizations_extra').eq('id', userId).single()
            const current = (u?.organizations_extra || 0) as number
            await supabase.from('saas_users').update({ organizations_extra: current + qty, updated_at: new Date().toISOString() }).eq('id', userId)
          }
        } else if (isSeatsAddon) {
          const qty = planSlug === 'seats-extra-10' ? 10 : planSlug === 'seats-extra-5' ? 5 : 1
          console.log('[STRIPE-WEBHOOK] Seats add-on detected. Increment member_seats_extra by', qty)
          const { error: addErr2 } = await supabase.rpc('perform_member_seats_increment', { p_user_id: userId, p_delta: qty })
          if (addErr2) {
            const { data: u2 } = await supabase.from('saas_users').select('member_seats_extra').eq('id', userId).single()
            const current2 = (u2?.member_seats_extra || 0) as number
            await supabase.from('saas_users').update({ member_seats_extra: current2 + qty, updated_at: new Date().toISOString() }).eq('id', userId)
          }
        } else {
          // Paid base plan (plan only; DO NOT touch organization_id)
          console.log('[STRIPE-WEBHOOK] Applying base plan to user:', { user_id: userId, plan_id: finalPlanId, plan_slug })
          const { error: updUserErr } = await supabase.from('saas_users').update({ plan_id: finalPlanId, updated_at: new Date().toISOString() }).eq('id', userId)
          if (updUserErr) console.log('[STRIPE-WEBHOOK] saas_users update error:', updUserErr.message)
        }
      }
    } else if (type === 'customer.subscription.updated' || type === 'invoice.paid' || type === 'invoice.payment_succeeded') {
      const object: any = event.data.object
      const subscriptionId = object.id || object.subscription
      const status: string = object.status || 'active'
      console.log('[STRIPE-WEBHOOK] sub update/invoice event:', { type, subscriptionId, status })
      const current_period_start = object?.current_period_start ? new Date(object.current_period_start * 1000).toISOString() : undefined
      const current_period_end = object?.current_period_end ? new Date(object.current_period_end * 1000).toISOString() : undefined
      const cancel_at_period_end = typeof object?.cancel_at_period_end === 'boolean' ? object.cancel_at_period_end : undefined
      const { error: updErr } = await supabase.from('saas_subscriptions').update({ status, current_period_start, current_period_end, cancel_at_period_end, updated_at: new Date().toISOString() }).eq('stripe_subscription_id', subscriptionId)
      if (updErr) console.log('[STRIPE-WEBHOOK] Update error:', updErr.message)

      // If the subscription transitioned to a terminal/canceled state, downgrade base plan to trial
      if (status === 'canceled' || status === 'incomplete_expired') {
        const { data: subRow2 } = await supabase
          .from('saas_subscriptions')
          .select('user_id, plan_id')
          .eq('stripe_subscription_id', subscriptionId)
          .single()
        if (subRow2?.user_id && subRow2?.plan_id) {
          const { data: plan2 } = await supabase
            .from('saas_plans')
            .select('slug')
            .eq('id', subRow2.plan_id)
            .single()
          const slug2 = plan2?.slug || ''
          if (!slug2.startsWith('org-extra-')) {
            const { data: trialPlan } = await supabase
              .from('saas_plans')
              .select('id')
              .eq('slug', 'trial')
              .single()
            if (trialPlan?.id) {
              const { error: downErr } = await supabase
                .from('saas_users')
                .update({ plan_id: trialPlan.id, updated_at: new Date().toISOString() })
                .eq('id', subRow2.user_id)
              if (downErr) console.log('[STRIPE-WEBHOOK] Trial downgrade error (updated):', downErr.message)
            }
          }
        }
      }
    } else if (type === 'customer.subscription.deleted') {
      const object: any = event.data.object
      const subscriptionId = object.id
      const { data: subRow } = await supabase.from('saas_subscriptions').select('user_id, plan_id').eq('stripe_subscription_id', subscriptionId).single()
      const { error: delErr } = await supabase.from('saas_subscriptions').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('stripe_subscription_id', subscriptionId)
      if (delErr) console.log('[STRIPE-WEBHOOK] Cancel update error:', delErr.message)
      // If this was an add-on plan, decrement organizations_extra
      if (subRow?.plan_id && subRow?.user_id) {
        const { data: plan } = await supabase.from('saas_plans').select('slug').eq('id', subRow.plan_id).single()
        const slug = plan?.slug || ''
        if (slug.startsWith('org-extra-')) {
          const qty = slug === 'org-extra-10' ? 10 : slug === 'org-extra-5' ? 5 : 1
          console.log('[STRIPE-WEBHOOK] Add-on canceled. Decrement organizations_extra by', qty)
          const { error: decErr } = await supabase.rpc('perform_orgs_extra_increment', { p_user_id: subRow.user_id, p_delta: -qty })
          if (decErr) {
            const { data: u } = await supabase.from('saas_users').select('organizations_extra').eq('id', subRow.user_id).single()
            const current = (u?.organizations_extra || 0) as number
            await supabase.from('saas_users').update({ organizations_extra: Math.max(0, current - qty), updated_at: new Date().toISOString() }).eq('id', subRow.user_id)
          }
        } else if (slug.startsWith('seats-extra-')) {
          const qty = slug === 'seats-extra-10' ? 10 : slug === 'seats-extra-5' ? 5 : 1
          console.log('[STRIPE-WEBHOOK] Seats add-on canceled. Decrement member_seats_extra by', qty)
          const { error: decErr2 } = await supabase.rpc('perform_member_seats_increment', { p_user_id: subRow.user_id, p_delta: -qty })
          if (decErr2) {
            const { data: u2 } = await supabase.from('saas_users').select('member_seats_extra').eq('id', subRow.user_id).single()
            const current2 = (u2?.member_seats_extra || 0) as number
            await supabase.from('saas_users').update({ member_seats_extra: Math.max(0, current2 - qty), updated_at: new Date().toISOString() }).eq('id', subRow.user_id)
          }
        } else {
          // Base plan canceled: downgrade to trial
          const { data: trialPlan } = await supabase
            .from('saas_plans')
            .select('id')
            .eq('slug', 'trial')
            .single()
          if (trialPlan?.id) {
            const { error: downErr } = await supabase
              .from('saas_users')
              .update({ plan_id: trialPlan.id, updated_at: new Date().toISOString() })
              .eq('id', subRow.user_id)
            if (downErr) console.log('[STRIPE-WEBHOOK] Trial downgrade error (deleted):', downErr.message)
          }
        }
      }
    }

    return new Response('ok', { status: 200, headers: getCorsHeaders(req) })
  } catch (err) {
    return new Response(`Webhook Error: ${err?.message || err}`, { status: 400, headers: getCorsHeaders(req) })
  }
})


