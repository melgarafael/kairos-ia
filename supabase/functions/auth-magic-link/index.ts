// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

function getCorsHeaders(req: Request): HeadersInit {
  const allowed = (Deno.env.get('CORS_ORIGINS') || Deno.env.get('CORS_ORIGIN') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const origin = req.headers.get('Origin') || ''
  const allowOrigin = allowed.length === 0 ? '*' : (allowed.includes(origin) ? origin : allowed[0] || '*')
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

    const MASTER_SUPABASE_URL = Deno.env.get('MASTER_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')
    const MASTER_SUPABASE_ANON_KEY = Deno.env.get('MASTER_SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY')
    const MASTER_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('MASTER_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!MASTER_SUPABASE_URL || !MASTER_SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: 'missing_env' }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    const body = await req.json().catch(() => ({})) as any
    const email = String(body?.email || '').trim().toLowerCase()
    const redirectTo = String(body?.redirect_to || '')
    const createIfNotExists = Boolean(body?.create_if_not_exists || false)
    const sendEmail = Boolean(body?.send_email ?? true)
    const flowType = String(body?.type || 'magiclink') as 'magiclink' | 'otp' | 'recovery' | 'signup'

    if (!email) return new Response(JSON.stringify({ error: 'email_required' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })

    // Build admin client for generateLink when service role exists
    if (MASTER_SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY)

      // Supabase Admin API: generateLink
      const type = ((): string => {
        if (flowType === 'otp') return 'otp'
        if (flowType === 'recovery') return 'recovery'
        if (flowType === 'signup') return 'signup'
        return 'magiclink'
      })()
      const params: any = { type, email }
      if (redirectTo) params.options = { redirectTo }

      const { data, error } = await admin.auth.admin.generateLink(params)
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      // Optionally dispatch email via Resend if sendEmail=true and provider not sending
      if (sendEmail) {
        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
        const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || ''
        try {
          if (RESEND_API_KEY && FROM_EMAIL && data?.properties?.action_link) {
            const subject = (() => {
              if (type === 'recovery') return 'Recupere sua senha do TomikCRM'
              if (type === 'signup') return 'Confirme seu email no TomikCRM'
              return 'Seu link de acesso ao TomikCRM'
            })()
            const link = String(data.properties.action_link)
            const cta = (() => {
              if (type === 'recovery') return 'Criar nova senha'
              if (type === 'signup') return 'Confirmar email'
              return 'Entrar agora'
            })()
            const title = (() => {
              if (type === 'recovery') return 'Recuperação de senha'
              if (type === 'signup') return 'Confirmação de email'
              return 'Acesse com link mágico'
            })()
            const expiryText = type === 'recovery' 
              ? 'O link é válido por 24 horas e pode ser usado múltiplas vezes até expirar.'
              : 'O link é válido por 24 horas e pode ser usado múltiplas vezes até expirar.'
            const html = `
              <div style="font-family: Inter, Arial, sans-serif; line-height:1.6; color:#0f172a">
                <h2 style="margin:0 0 8px">${title}</h2>
                <p>Clique no botão abaixo:</p>
                <p><a href="${link}" style="display:inline-block;background:#3b82f6;color:white;padding:10px 16px;border-radius:10px;text-decoration:none;border-radius:10px">${cta}</a></p>
                <p style="font-size:12px;color:#64748b;margin-top:12px">${expiryText}</p>
                <p style="font-size:12px;color:#64748b">Se o botão não funcionar, copie e cole este link: ${link}</p>
              </div>`
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'authorization': `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
              body: JSON.stringify({ from: FROM_EMAIL, to: email, subject, html })
            })
          }
        } catch {}
      }

      return new Response(JSON.stringify({ ok: true, action_link: data?.properties?.action_link || null, type }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // Fallback without service role: call appropriate public auth flow (may hit Supabase rate limiting)
    const supabase = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_ANON_KEY)
    if (flowType === 'recovery') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo || undefined } as any)
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      return new Response(JSON.stringify({ ok: true, sent: true, type: 'recovery' }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }
    const options: any = { emailRedirectTo: redirectTo || undefined, shouldCreateUser: createIfNotExists }
    const { data, error } = await supabase.auth.signInWithOtp({ email, options })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    return new Response(JSON.stringify({ ok: true, sent: true, type: 'otp' }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'internal_error' }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  }
})


