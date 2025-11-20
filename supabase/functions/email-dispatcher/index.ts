// @ts-nocheck
// Edge Function: email-dispatcher
// Objetivo: Consumir a tabela public.email_queue e enviar e-mails transacionais.
// Provider suportado: Resend (simples e robusto para Deno via fetch)
// Env necessários:
// - MASTER_SUPABASE_URL
// - MASTER_SUPABASE_SERVICE_ROLE_KEY
// - RESEND_API_KEY
// - FROM_EMAIL (ex.: "Tomik CRM <no-reply@seu-dominio.com>")
// - APP_PUBLIC_URL (opcional, usado em links)

function json(res: unknown, init: number | ResponseInit = 200) {
  const status = typeof init === 'number' ? init : (init as ResponseInit).status || 200
  const headers = typeof init === 'number' ? {} : ((init as ResponseInit).headers || {})
  return new Response(JSON.stringify(res), { status, headers: { 'content-type': 'application/json', ...headers } })
}

type QueueRow = {
  id: string
  recipient_email: string
  template: string
  variables_json: Record<string, unknown>
}

async function buildEmail(template: string, vars: Record<string, any>): Promise<{ subject: string; html: string; text?: string }> {
  const appUrl = Deno.env.get('APP_PUBLIC_URL') || ''
  const base = (appUrl && appUrl.trim()) || ''
  if (template === 'reactivation_v1') {
    const root = base.replace(/\/$/, '')
    const connect = `${root}/#connect-supabase`
    const trails = `${root}/#trails`
    const subject = 'Ative seu Tomik CRM em 2 minutos — novidades e suporte dentro do app'
    const preheader = 'Vimos que sua conta ainda não conectou ao Supabase. Configuração guiada e suporte inclusos.'
    const html = `<!doctype html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1"/>
          <meta name="color-scheme" content="light dark"/>
          <meta name="supported-color-schemes" content="light dark"/>
          <title>${subject}</title>
          <style>
            @media (prefers-color-scheme: dark) {
              body { background: #0b1220; color: #e5e7eb; }
              .card { background:#0f172a; border-color:#1f2937; }
              .muted { color:#9aa4b2; }
              .btn { background:#3b82f6; color:#fff; }
              a { color:#93c5fd; }
            }
          </style>
        </head>
        <body style="margin:0;font-family:Inter,Arial,sans-serif;background:#0b1220;color:#0f172a">
          <div style="max-width:640px;margin:0 auto;padding:0 20px">
            <div style="height:4px;background:linear-gradient(90deg,#3b82f6,#6366f1,#8b5cf6);"></div>
            <div class="card" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;margin:20px 0;padding:28px">
              <div class="muted" style="font-size:12px">${preheader}</div>
              <h1 style="margin:6px 0 12px;font-size:24px;line-height:1.25">Seu Tomik CRM está pronto — falta só conectar seu Supabase</h1>
              <p style="margin:0 0 10px">Percebemos que você criou sua conta, mas ainda não conectou o Supabase. Em menos de <strong>2 minutos</strong> você habilita:</p>
              <ul style="margin:10px 0 16px; padding-left:18px">
                <li>Trilhas guiadas para monetização e growth</li>
                <li>Recursos com IA e automações nativas</li>
                <li>Design moderno com suporte integrado dentro do app</li>
              </ul>
              <div style="margin:18px 0 22px">
                <a class="btn" href="${connect}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:600">Conectar meu Supabase agora</a>
              </div>
              <div class="muted" style="font-size:13px">Prefere ver as novidades primeiro? <a href="${trails}" style="text-decoration:none">Explore as Trilhas</a>.</div>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0" />
              <p class="muted" style="font-size:12px;margin:0">Precisa de ajuda? Responda este e-mail ou fale com o suporte pelo app.</p>
            </div>
            <div style="text-align:center;color:#94a3b8;font-size:11px;margin:8px 0 24px">Tomik CRM • Feito pela Automatik Labs</div>
          </div>
        </body>
      </html>`
    const text = `Vimos que você ainda não conectou seu Supabase. Ative agora: ${connect}\nNovidades e trilhas: ${trails}`
    return { subject, html, text }
  }
  if (template === 'invite_v1') {
    const link = String(vars?.link || '')
    const subject = 'Você foi convidado para o Tomik CRM'
    const html = `
      <div style="font-family: Inter, Arial, sans-serif; line-height:1.6; color:#0f172a">
        <h2 style="margin:0 0 8px">Convite para acessar uma organização</h2>
        <p>Você recebeu um convite para participar de uma organização no Tomik CRM.</p>
        <p><a href="${link}" style="display:inline-block;background:#3b82f6;color:white;padding:10px 16px;border-radius:10px;text-decoration:none">Aceitar Convite</a></p>
        ${base ? `<p style="font-size:12px;color:#64748b">Se o botão não funcionar, copie e cole este link: ${link}</p>` : ''}
      </div>`
    const text = `Você foi convidado para o Tomik CRM. Aceite em: ${link}`
    return { subject, html, text }
  }
  if (template === 'welcome_recovery_link') {
    const recoveryLink = String(vars?.recovery_link || vars?.link || '')
    const email = String(vars?.email || '')
    const subject = 'Seu acesso ao Tomik OS'
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light dark"/>
    <meta name="supported-color-schemes" content="light dark"/>
    <title>${subject}</title>
    <style>
      @media (prefers-color-scheme: dark) {
        body { background: #0b1220; color: #e5e7eb; }
        .card { background:#1e293b; border-color:#334155; }
        .muted { color:#94a3b8; }
        .btn { background:#3b82f6; color:#fff; }
        a { color:#60a5fa; }
      }
    </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0b1220; color: #e5e7eb; line-height: 1.6;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="margin: 0 0 16px; color: #ffffff; font-size: 32px; font-weight: 600; letter-spacing: -0.5px;">
                Seu acesso ao Tomik OS
            </h1>
            <p style="margin: 0; color: #94a3b8; font-size: 16px;">
                Bem-vindo(a)! Em poucos minutos você vai ativar seu acesso e iniciar a implementação guiada do seu agente de IA humanizado. Siga os passos abaixo.
            </p>
        </div>

        <!-- Aviso sobre spam/promoções - NO INÍCIO -->
        <div class="card" style="background-color: #1e293b; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 16px; margin-bottom: 32px; border: 1px solid #334155;">
            <p style="margin: 0; color: #cbd5e1; font-size: 14px; line-height: 1.6;">
                <strong style="color: #ffffff;">💡 Dica importante:</strong> Se você não recebeu este e-mail na sua caixa de entrada, verifique sua caixa de <strong>spam</strong> ou a pasta <strong>"Promoções"</strong>. Alguns provedores de email podem filtrar mensagens automaticamente.
            </p>
        </div>

        <!-- Passo 1 -->
        <div class="card" style="background-color: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #334155;">
            <h2 style="margin: 0 0 12px; color: #ffffff; font-size: 20px; font-weight: 600;">
                Passo 1 — Defina sua senha
            </h2>
            <p style="margin: 0 0 20px; color: #cbd5e1; font-size: 15px; line-height: 1.6;">
                Clique no botão abaixo para criar sua senha de acesso. Este link é pessoal e expira após um tempo por segurança.
            </p>
            <p style="margin: 0 0 12px; color: #94a3b8; font-size: 13px;">
                <strong>Importante:</strong> Use o mesmo e-mail que você cadastrou na compra para criar a senha.
            </p>
            ${recoveryLink ? `<p style="margin: 0 0 16px; color: #94a3b8; font-size: 13px;">
                Se o botão não funcionar, copie e cole este link no navegador:
            </p>
            <p style="margin: 0 0 24px; color: #60a5fa; font-size: 12px; word-break: break-all; font-family: monospace;">
                ${recoveryLink}
            </p>` : ''}
        </div>

        <!-- Passo 2 -->
        <div class="card" style="background-color: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #334155;">
            <h2 style="margin: 0 0 12px; color: #ffffff; font-size: 20px; font-weight: 600;">
                Passo 2 — Faça login e siga o passo a passo dentro do software
            </h2>
            <p style="margin: 0; color: #cbd5e1; font-size: 15px; line-height: 1.6;">
                Após criar sua senha e entrar no Tomik OS, você encontrará um guia completo de implementação do Supabase, diretamente dentro da plataforma. Basta seguir o passo a passo guiado para configurar tudo corretamente.
            </p>
        </div>

        <!-- Passo 3 -->
        <div class="card" style="background-color: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 32px; border: 1px solid #334155;">
            <h2 style="margin: 0 0 12px; color: #ffffff; font-size: 20px; font-weight: 600;">
                Passo 3 — Inicie a Trilha de Monetização
            </h2>
            <p style="margin: 0; color: #cbd5e1; font-size: 15px; line-height: 1.6;">
                Com tudo configurado, acesse a seção Trilha de Monetização no software. Lá você encontrará o roteiro prático para ativar e rentabilizar seu agente de IA humanizado.
            </p>
        </div>

        <!-- Dicas rápidas -->
        <div class="card" style="background-color: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 32px; border: 1px solid #334155;">
            <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 20px; font-weight: 600;">
                Dicas rápidas
            </h2>
            <ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 15px; line-height: 1.8;">
                <li style="margin-bottom: 8px;">Use o mesmo e-mail que você cadastrou na compra para criar a senha.</li>
                <li style="margin-bottom: 8px;">Guarde suas chaves e variáveis do Supabase com segurança.</li>
                <li style="margin-bottom: 8px;">Dentro da Trilha de Monetização, siga os blocos na ordem sugerida.</li>
            </ul>
        </div>

        <!-- Botão CTA - DEPOIS DE TODOS OS PASSOS -->
        ${recoveryLink ? `<div style="text-align: center; margin-bottom: 40px;">
            <a href="${recoveryLink}" class="btn" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-size: 17px; font-weight: 600; letter-spacing: -0.3px; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4); transition: all 0.2s;">
                Defina sua senha aqui
            </a>
        </div>` : ''}

        <!-- Footer -->
        <div style="text-align: center; padding-top: 32px; border-top: 1px solid #334155;">
            <p style="margin: 0 0 8px; color: #94a3b8; font-size: 14px;">
                Precisa de ajuda? Fale com a gente em
            </p>
            <p style="margin: 0 0 24px;">
                <a href="mailto:suporte@automatiklabs.com.br" style="color: #60a5fa; text-decoration: none; font-size: 14px;">
                    suporte@automatiklabs.com.br
                </a>
            </p>
            <p style="margin: 0; color: #64748b; font-size: 12px;">
                © Tomik OS — Todos os direitos reservados.
            </p>
        </div>
    </div>
</body>
</html>`
    const text = `Seu acesso ao Tomik OS\n\nBem-vindo(a)! Em poucos minutos você vai ativar seu acesso.\n\nPasso 1 - Defina sua senha: ${recoveryLink || 'Link não disponível'}\n\nPasso 2 - Faça login e siga o passo a passo dentro do software\nPasso 3 - Inicie a Trilha de Monetização\n\nDicas: Use o mesmo e-mail da compra, guarde suas chaves do Supabase com segurança, e siga os blocos da Trilha na ordem sugerida.\n\nPrecisa de ajuda? suporte@automatiklabs.com.br`
    return { subject, html, text }
  }
  if (template === 'welcome_credentials') {
    const email = String(vars?.email || '')
    const password = String(vars?.password || '')
    const subject = 'Bem-vindo ao Tomik CRM'
    const html = `
      <div style="font-family: Inter, Arial, sans-serif; line-height:1.6; color:#0f172a">
        <h2 style="margin:0 0 8px">Bem-vindo!</h2>
        <p>Segue seu acesso inicial:</p>
        <ul>
          <li><strong>E-mail:</strong> ${email}</li>
          <li><strong>Senha:</strong> ${password}</li>
        </ul>
      </div>`
    const text = `Acesso inicial - Email: ${email} / Senha: ${password}`
    return { subject, html, text }
  }
  // Fallback
  return { subject: 'Notificação Tomik CRM', html: `<pre>${JSON.stringify(vars, null, 2)}</pre>` }
}

async function sendWithResend(to: string, subject: string, html: string, text?: string): Promise<boolean> {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
  const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || ''
  if (!RESEND_API_KEY || !FROM_EMAIL) return false
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'authorization': `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html, text })
  })
  return resp.ok
}

Deno.serve(async (req) => {
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
    const MASTER_SUPABASE_URL = Deno.env.get('MASTER_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')
    const MASTER_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('MASTER_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!MASTER_SUPABASE_URL || !MASTER_SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'missing_env' }, 500)
    const supabase = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY)

    // Pegar um pequeno lote de emails pendentes e marcar como "sending" para evitar concorrência
    const { data: rows, error } = await supabase
      .from('email_queue')
      .select('id, recipient_email, template, variables_json')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(20)

    if (error) return json({ error: error.message }, 400)
    if (!rows || rows.length === 0) return json({ ok: true, processed: 0 })

    let processed = 0
    for (const r of rows as QueueRow[]) {
      // Tentar travar marcando como sending
      const { error: lockErr } = await supabase
        .from('email_queue')
        .update({ status: 'sending', updated_at: new Date().toISOString() })
        .eq('id', r.id)
        .eq('status', 'pending')
      if (lockErr) continue

      try {
        const tpl = await buildEmail(r.template, (r as any).variables_json || {})
        const ok = await sendWithResend(r.recipient_email, tpl.subject, tpl.html, tpl.text)
        if (!ok) throw new Error('provider_failed')
        await supabase
          .from('email_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', r.id)
        processed++
      } catch (e: any) {
        await supabase
          .from('email_queue')
          .update({ status: 'failed', error_message: e?.message || String(e), updated_at: new Date().toISOString() })
          .eq('id', r.id)
      }
    }

    return json({ ok: true, processed })
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500)
  }
})


