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
    const redirectToRaw = (body?.redirect_url as string || body?.redirect_to as string || '')

    if (!email) {
      return new Response('Missing email', { status: 400, headers: getCorsHeaders(req) })
    }

    // Build redirect URL to /reset-password on the app
    let redirectTo = ''
    try {
      redirectTo = redirectToRaw || (DEFAULT_APP_URL ? new URL('/reset-password', DEFAULT_APP_URL).toString() : '')
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

    // Basic abuse guard: throttle repeated sends per email within 60s and per IP (3/min)
    const supabaseSrv = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY)
    try {
      const { data: last } = await supabaseSrv
        .from('saas_events')
        .select('created_at')
        .eq('event_name', 'recovery_link_sent')
        .eq('props->>email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (last?.created_at) {
        const elapsedMs = Date.now() - new Date(last.created_at).getTime()
        const remaining = Math.max(0, 60 - Math.floor(elapsedMs / 1000))
        if (remaining > 0) {
          try {
            const email_hash = await sha256Hex(email)
            await supabaseSrv
              .from('saas_events')
              .insert({ event_name: 'recovery_rate_limited', props: { email, email_hash, ip, retry_after_seconds: remaining }, created_at: new Date().toISOString() })
          } catch {}
          return new Response(JSON.stringify({ error: 'rate_limited', retry_after_seconds: remaining }), { status: 429, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }
      }
      if (ip) {
        const since = new Date(Date.now() - 60 * 1000).toISOString()
        const { count } = await supabaseSrv
          .from('saas_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_name', 'recovery_link_sent')
          .eq('props->>ip', ip)
          .gte('created_at', since)
        if (Number(count || 0) >= 3) {
          try {
            const email_hash = await sha256Hex(email)
            await supabaseSrv
              .from('saas_events')
              .insert({ event_name: 'recovery_rate_limited', props: { email, email_hash, ip, retry_after_seconds: 60 }, created_at: new Date().toISOString() })
          } catch {}
          return new Response(JSON.stringify({ error: 'rate_limited', retry_after_seconds: 60 }), { status: 429, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }
      }
    } catch {}

    // Ensure the email exists (avoid info leak in response; treat as success but skip send)
    let emailExists = false
    try {
      const { data } = await supabaseSrv
        .from('saas_users')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      emailExists = !!data
    } catch {}

    // Generate recovery link
    let actionLink = ''
    if (emailExists) {
      const { data: linkData, error: linkErr } = await supabaseSrv.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: redirectTo || undefined
        }
      })
      if (linkErr) {
        // Don't reveal user existence; convert to generic error
        return new Response(linkErr.message || 'Failed to generate link', { status: 400, headers: getCorsHeaders(req) })
      }
      actionLink = (linkData as any)?.properties?.action_link || ''
    }

    // Compose email body (generic even if user does not exist)
    const subject = 'Redefina sua senha no TomikCRM'
    const html = `
      <div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#0f172a">
        <h2 style="margin:0 0 12px">Recuperação de senha</h2>
        <p style="margin:0 0 16px">Clique no botão abaixo para redefinir sua senha. O link é válido por 24 horas e pode ser usado múltiplas vezes até expirar.</p>
        <p style="margin:24px 0">
          <a href="${actionLink || redirectTo}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px">Redefinir senha</a>
        </p>
        <p style="margin:16px 0 0;color:#475569;font-size:14px">Se você não solicitou, ignore este e‑mail.</p>
      </div>
    `

    // Send email via Resend (always)
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
        await supabaseSrv
          .from('saas_events')
          .insert({ event_name: 'recovery_link_error', props: { email, email_hash, ip, error: 'resend_failed', status: resendRes.status, body: (txt || '').slice(0,200) }, created_at: new Date().toISOString() })
      } catch {}
      return new Response(`Resend error: ${txt || resendRes.statusText}`, { status: 502, headers: getCorsHeaders(req) })
    }

    // Log event (best effort) com hash de email e IP (quando disponível)
    try {
      const email_hash = await sha256Hex(email)
      await supabaseSrv
        .from('saas_events')
        .insert({ event_name: 'recovery_link_sent', props: { email, email_hash, ip }, created_at: new Date().toISOString() })
    } catch {}

    return new Response(JSON.stringify({ ok: true, sent: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  } catch (err: any) {
    return new Response(err?.message || 'Unexpected error', { status: 500, headers: getCorsHeaders(req) })
  }
})


