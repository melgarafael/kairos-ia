// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

// Allow multiple origins via env (comma separated). If empty, allow all.
const allowedOrigins = (Deno.env.get('CORS_ORIGINS') || Deno.env.get('CORS_ORIGIN') || '')
  .split(',')
  .map((s) => s.trim())
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')

    const MASTER_SUPABASE_URL = Deno.env.get('MASTER_SUPABASE_URL')
    const MASTER_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('MASTER_SUPABASE_SERVICE_ROLE_KEY')
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'TomikCRM <no-reply@automatiklabs.com.br>'
    const DEFAULT_APP_URL = Deno.env.get('APP_PUBLIC_URL') || Deno.env.get('VITE_APP_PUBLIC_URL') || ''

    if (!MASTER_SUPABASE_URL || !MASTER_SUPABASE_SERVICE_ROLE_KEY) {
      return new Response('Missing Supabase envs', { status: 500, headers: getCorsHeaders(req) })
    }
    if (!RESEND_API_KEY) {
      return new Response('Missing RESEND_API_KEY', { status: 500, headers: getCorsHeaders(req) })
    }

    const body = await req.json().catch(() => ({})) as any
    const email = (body?.email as string || '').trim().toLowerCase()
    const password = (body?.password as string || '')
    const name = (body?.name as string || '').trim()
    const phone = (body?.phone as string || '').trim()
    const planIdRaw = (body?.plan_id as string || body?.planId as string || 'trial').trim()
    const redirectToRaw = (body?.redirect_url as string || body?.emailRedirectTo as string || '')

    if (!email || !password) {
      return new Response('Missing email or password', { status: 400, headers: getCorsHeaders(req) })
    }

    // Build redirect URL
    let redirectTo = ''
    try {
      redirectTo = redirectToRaw || (DEFAULT_APP_URL ? new URL('/email-confirmed', DEFAULT_APP_URL).toString() : '')
    } catch {
      redirectTo = ''
    }

    // Helpers
    const sha256Hex = async (s: string): Promise<string> => {
      const enc = new TextEncoder().encode(s)
      const buf = await crypto.subtle.digest('SHA-256', enc)
      const arr = Array.from(new Uint8Array(buf))
      return arr.map(b => b.toString(16).padStart(2, '0')).join('')
    }
    const ip = (() => {
      const raw = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
      return raw.split(',')[0].trim() || ''
    })()

    // Normalize plan metadata
    const desiredPlan = planIdRaw || 'trial'
    const planId = (desiredPlan === 'basic' || desiredPlan === 'professional') ? 'trial' : desiredPlan

    // Basic abuse guard: throttle repeated sends per email within 60s and per IP (3/min)
    const supabaseSrv = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY)
    try {
      const { data: last } = await supabaseSrv
        .from('saas_events')
        .select('created_at')
        .eq('event_name', 'signup_link_sent')
        .eq('props->>email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (last?.created_at) {
        const elapsedMs = Date.now() - new Date(last.created_at).getTime()
        const remaining = Math.max(0, 60 - Math.floor(elapsedMs / 1000))
        if (remaining > 0) {
          return new Response(JSON.stringify({ error: 'rate_limited', retry_after_seconds: remaining }), { status: 429, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }
      }
      if (ip) {
        const since = new Date(Date.now() - 60 * 1000).toISOString()
        const { count } = await supabaseSrv
          .from('saas_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_name', 'signup_link_sent')
          .eq('props->>ip', ip)
          .gte('created_at', since)
        if (Number(count || 0) >= 3) {
          return new Response(JSON.stringify({ error: 'rate_limited', retry_after_seconds: 60 }), { status: 429, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }
      }
    } catch {}

    // Generate signup link with admin API (bypasses GoTrue email sender limits)
    const { data: linkData, error: linkErr } = await supabaseSrv.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        data: {
          name: name || null,
          phone: phone || null,
          plan_id: planId,
          desired_plan: desiredPlan
        },
        redirectTo: redirectTo || undefined
      }
    })
    if (linkErr) {
      try {
        const email_hash = await sha256Hex(email)
        await supabaseSrv.from('saas_events').insert({ event_name: 'signup_link_error', props: { email, email_hash, ip, error: linkErr.message || 'generate_link_failed' }, created_at: new Date().toISOString() })
      } catch {}
      return new Response(linkErr.message || 'Failed to generate link', { status: 400, headers: getCorsHeaders(req) })
    }

    // Extract action_link - try multiple possible paths
    const actionLink = (linkData as any)?.properties?.action_link 
      || (linkData as any)?.action_link 
      || (linkData as any)?.link
      || ''
    
    if (!actionLink) {
      try {
        const email_hash = await sha256Hex(email)
        await supabaseSrv.from('saas_events').insert({ 
          event_name: 'signup_link_error', 
          props: { 
            email, 
            email_hash, 
            ip, 
            error: 'could_not_resolve_action_link',
            linkData: JSON.stringify(linkData)
          }, 
          created_at: new Date().toISOString() 
        })
      } catch {}
      return new Response('Could not resolve action_link', { status: 500, headers: getCorsHeaders(req) })
    }

    // Send email via Resend
    const subject = 'Confirme sua conta no TomikCRM'
    const html = `
      <div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#0f172a; max-width:600px; margin:0 auto">
        <h2 style="margin:0 0 12px">${name ? 'Olá ' + name + ',' : 'Olá,'}</h2>
        <p style="margin:0 0 16px">Use o botão abaixo para confirmar sua conta e concluir o cadastro:</p>
        <p style="margin:24px 0">
          <a href="${actionLink}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px">Confirmar conta</a>
        </p>
        <p style="margin:16px 0 0;color:#475569;font-size:14px">Se você não solicitou este cadastro, pode ignorar este e‑mail.</p>
        <p style="margin:16px 0 0;color:#64748b;font-size:12px;line-height:1.5">
          Se o botão não funcionar, copie e cole este link no navegador:<br>
          <a href="${actionLink}" style="color:#3b82f6;word-break:break-all">${actionLink}</a>
        </p>
      </div>
    `

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from: RESEND_FROM_EMAIL, to: [email], subject, html })
    })
    if (!resendRes.ok) {
      const txt = await resendRes.text().catch(() => '')
      try {
        const email_hash = await sha256Hex(email)
        await supabaseSrv.from('saas_events').insert({ event_name: 'signup_link_error', props: { email, email_hash, ip, error: 'resend_failed', status: resendRes.status, body: (txt || '').slice(0, 200) }, created_at: new Date().toISOString() })
      } catch {}
      return new Response(`Resend error: ${txt || resendRes.statusText}`, { status: 502, headers: getCorsHeaders(req) })
    }

    // Log event (best effort)
    try {
      const email_hash = await sha256Hex(email)
      await supabaseSrv
        .from('saas_events')
        .insert({ event_name: 'signup_link_sent', props: { email, email_hash, ip }, created_at: new Date().toISOString() })
    } catch {}

    const userId = (linkData as any)?.user?.id || null
    const payload = { ok: true, sent: true, user_id: userId }
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  } catch (err: any) {
    return new Response(err?.message || 'Unexpected error', { status: 500, headers: getCorsHeaders(req) })
  }
})


