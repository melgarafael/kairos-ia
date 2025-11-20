// Supabase Edge Function: provision-subscription
// Cria/atualiza usuário em saas_users + assinatura em saas_subscriptions
// Env: MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY
declare const Deno: {
  env: { get(name: string): string | undefined }
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
}

function getCorsHeaders(req: Request): HeadersInit {
  const allowedOrigins = (Deno.env.get('CORS_ORIGINS') || Deno.env.get('CORS_ORIGIN') || '')
    .split(',').map(s => s.trim()).filter(Boolean)
  const origin = req.headers.get('Origin') || ''
  const allowOrigin = allowedOrigins.length === 0 ? '*' : (allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
    'Access-Control-Max-Age': '86400'
  }
}

function generateRandomPassword(length = 14): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()_+'
  const arr = new Uint32Array(length)
  crypto.getRandomValues(arr)
  let out = ''
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length]
  return out
}

type ProvisionPayload = {
  email: string
  plan_id?: string
  // Target organization (prefer organization_id). Accepts master org id or client org id.
  organization_id?: string
  org_slug?: string
  gateway?: 'pagarme' | 'hotmart' | 'ticto' | 'stripe' | string
  external_subscription_id?: string
  external_customer_id?: string
  external_plan_code?: string
  current_period_start?: string
  current_period_end?: string
  redirect_to?: string
  enqueue_email?: boolean
  email_template?: string
  account_type?: 'profissional' | 'agencia' | 'usuario' | 'empresa'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })

  const MASTER_SUPABASE_URL = Deno.env.get('MASTER_SUPABASE_URL')
  const MASTER_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('MASTER_SUPABASE_SERVICE_ROLE_KEY')
  if (!MASTER_SUPABASE_URL || !MASTER_SUPABASE_SERVICE_ROLE_KEY) {
    return new Response('Missing env', { status: 500, headers: getCorsHeaders(req) })
  }

  let body: ProvisionPayload
  try { body = await req.json() } catch { return new Response('Invalid JSON', { status: 400, headers: getCorsHeaders(req) }) }
  if (!body.email || !body.plan_id) {
    return new Response('email and plan_id are required', { status: 400, headers: getCorsHeaders(req) })
  }

  const idempotencyKey = req.headers.get('Idempotency-Key') || undefined

  // @ts-ignore -- Remote import resolvido pelo runtime Deno (Supabase Edge)
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
  const supabase = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY)

  try {
    // Resolver planId (somente por plan_id)
    let planId: string | null = (body.plan_id || '').toString().trim() || null
    if (!planId) return new Response('plan_id is required', { status: 400, headers: getCorsHeaders(req) })

    // Garantir usuário
    let userId: string | null = null
    const { data: userRow } = await supabase.from('saas_users').select('id').eq('email', body.email).maybeSingle()
    if (userRow?.id) {
      userId = userRow.id
    } else {
      const password = generateRandomPassword()
      const admin = supabase.auth.admin
      const created = await admin.createUser({ email: body.email, password, email_confirm: true, user_metadata: { plan_id: planId } })
      if ((created as any).error) return new Response(`auth_create_failed: ${(created as any).error.message}`, { status: 400, headers: getCorsHeaders(req) })
      userId = (created as any).data.user?.id || null
    }
    if (!userId || !planId) return new Response('user or plan missing', { status: 400, headers: getCorsHeaders(req) })

    // Resolver organização alvo (Master)
    let masterOrgId: string | null = null
    const rawOrg = (body.organization_id || '').toString().trim()
    const rawSlug = (body.org_slug || '').toString().trim().toLowerCase()
    if (rawOrg) {
      // Tentar por id master; se não existir, tentar por client_org_id
      const byId = await supabase.from('saas_organizations').select('id').eq('id', rawOrg).maybeSingle()
      if (!byId.error && byId.data?.id) {
        masterOrgId = byId.data.id
      } else {
        const byClient = await supabase.from('saas_organizations').select('id').eq('client_org_id', rawOrg).maybeSingle()
        if (!byClient.error && byClient.data?.id) masterOrgId = byClient.data.id
      }
    }
    if (!masterOrgId && rawSlug) {
      const bySlug = await supabase.from('saas_organizations').select('id').eq('slug', rawSlug).maybeSingle()
      if (!bySlug.error && bySlug.data?.id) masterOrgId = bySlug.data.id
    }

    // Sempre gravar plano no usuário (será herdado pela primeira organização via trigger)
    const userUpdate: any = { plan_id: planId, updated_at: new Date().toISOString() }
    if (body.account_type && ['profissional', 'agencia', 'usuario', 'empresa'].includes(body.account_type)) {
      userUpdate.account_type = body.account_type
    }
    await supabase
      .from('saas_users')
      .update(userUpdate)
      .eq('id', userId)

    // Horários padrão
    const nowIso = new Date().toISOString()
    const end30Iso = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()

    // Se a organização foi informada, aplicar plano diretamente e registrar assinatura
    if (masterOrgId) {
      await supabase.from('saas_organizations').update({ plan_id: planId, updated_at: new Date().toISOString() }).eq('id', masterOrgId)
      await supabase.from('saas_subscriptions').upsert({
        user_id: userId,
        organization_id: masterOrgId,
        plan_id: planId,
        status: 'active',
        gateway: body.gateway || null,
        external_subscription_id: body.external_subscription_id || null,
        external_customer_id: body.external_customer_id || null,
        external_plan_code: body.external_plan_code || null,
        current_period_start: body.current_period_start || nowIso,
        current_period_end: body.current_period_end || end30Iso,
        cancel_at_period_end: false,
        updated_at: nowIso
      })

      // Registrar token já resgatado (auditoria e consistência com inventário)
      // APENAS para planos Starter (8b5a1000-957c-4eaf-beca-954a78187337) ou PRO (d4836a79-186f-4905-bfac-77ec52fa1dde)
      // Não criar tokens para planos Trial
      const STARTER_PLAN_ID = '8b5a1000-957c-4eaf-beca-954a78187337'
      const PRO_PLAN_ID = 'd4836a79-186f-4905-bfac-77ec52fa1dde'
      if (planId === STARTER_PLAN_ID || planId === PRO_PLAN_ID) {
        try {
          await supabase
            .from('saas_plan_tokens')
            .insert({
              owner_user_id: userId,
              plan_id: planId,
              status: 'redeemed',
              purchased_at: nowIso,
              valid_until: end30Iso,
              gateway: body.gateway || null,
              external_order_id: null,
              external_subscription_id: body.external_subscription_id || null,
              issued_by: 'provision-subscription',
              applied_organization_id: masterOrgId,
              applied_at: nowIso
            })
        } catch (_) { /* best-effort */ }
      }
    }
    
    // Se nenhuma organização foi informada, emitir token "available" automaticamente para o usuário aplicar depois
    // APENAS para planos Starter ou PRO
    if (!masterOrgId) {
      const STARTER_PLAN_ID = '8b5a1000-957c-4eaf-beca-954a78187337'
      const PRO_PLAN_ID = 'd4836a79-186f-4905-bfac-77ec52fa1dde'
      if (planId === STARTER_PLAN_ID || planId === PRO_PLAN_ID) {
        try {
          const validUntil = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString()
          const ins = await supabase
            .from('saas_plan_tokens')
            .insert({
              owner_user_id: userId,
              plan_id: planId,
              status: 'available',
              purchased_at: nowIso,
              valid_until: validUntil,
              gateway: body.gateway || null,
              external_order_id: null,
              external_subscription_id: body.external_subscription_id || null,
              issued_by: 'provision-subscription'
            })
            .select('id')
            .maybeSingle()
          // Include token_id in response when generated
          if (!ins.error) {
            ;(globalThis as any).__last_token_id = ins.data?.id || null
          }
        } catch (_) { /* best-effort */ }
      }
    }

    // Conceder acesso à trilha de Monetização em condições específicas
    try {
      const { data: planRow } = await supabase.from('saas_plans').select('slug').eq('id', planId).maybeSingle()
      const planSlug = (planRow?.slug || '').toString()
      // Regra 1: quando o plano efetivo for trial
      // Regra 2: quando o plan_id for o plano específico que também deve liberar a trilha
      const SHOULD_GRANT_TRAIL_PLAN_ID = '4663da1a-b552-4127-b1af-4bc30c681682'
      const shouldGrantMonetizationTrail = (planSlug === 'trial') || (planId === SHOULD_GRANT_TRAIL_PLAN_ID)
      if (shouldGrantMonetizationTrail) {
        const monetizationId = '8b5e0e5e-1f9e-4db4-a1b1-1a3b9f63f0e1'
        const { data: u } = await supabase
          .from('saas_users')
          .select('trail_product_ids')
          .eq('id', userId)
          .maybeSingle()
        const current = (u?.trail_product_ids || '').split(',').map((s: string) => s.trim()).filter((s: string) => s)
        if (!current.includes(monetizationId)) {
          current.push(monetizationId)
          await supabase
            .from('saas_users')
            .update({ trail_product_ids: current.join(','), updated_at: nowIso })
            .eq('id', userId)
        }
      }
    } catch (_) {}

    // Buscar dados completos do usuário após todas as atualizações
    const { data: userData } = await supabase
      .from('saas_users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    // Gerar token reutilizável para definição de senha (pode ser usado múltiplas vezes até definir senha)
    let recoveryLink: string | undefined
    let linkGenerationError: string | undefined
    try {
      const edgeBase = (() => {
        const url = MASTER_SUPABASE_URL
        try {
          const u = new URL(url)
          const host = u.hostname.replace('.supabase.co', '.functions.supabase.co')
          return `${u.protocol}//${host}`
        } catch {
          return ''
        }
      })()
      
      if (!edgeBase) {
        linkGenerationError = 'Failed to build edge function base URL'
      } else {
        const response = await fetch(`${edgeBase}/password-setup?action=generate`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'apikey': MASTER_SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${MASTER_SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            user_id: userId,
            email: body.email,
            redirect_to: body.redirect_to || undefined
          })
        }).catch((err) => {
          linkGenerationError = `Fetch failed: ${err?.message || 'Unknown error'}`
          return null
        })
        
        if (response) {
          const tokenData = await response.json().catch(() => ({ error: 'json_parse_failed' }))
          
          if (tokenData?.error) {
            linkGenerationError = `Token generation error: ${tokenData.error}`
          } else if (tokenData?.setup_url) {
            recoveryLink = tokenData.setup_url
          } else {
            linkGenerationError = 'setup_url not found in response'
            console.error('password-setup response:', JSON.stringify(tokenData))
          }
        }
      }
    } catch (err: any) {
      linkGenerationError = `Exception: ${err?.message || 'Unknown error'}`
      console.error('Error generating recovery link:', err)
    }

    // Sempre enfileirar e-mail com o recovery link se foi gerado com sucesso
    // (independente de enqueue_email, pois é necessário para o usuário acessar)
    if (recoveryLink && recoveryLink.trim().length > 0) {
      try {
        const { error: queueErr } = await supabase.from('email_queue').insert({
          recipient_email: body.email,
          template: body.email_template || 'welcome_recovery_link',
          variables_json: { 
            email: body.email, 
            recovery_link: recoveryLink.trim(),
            link: recoveryLink.trim() // Fallback para compatibilidade
          }
        })
        
        if (queueErr) {
          console.error('Failed to enqueue email:', queueErr)
          // Não falhar a requisição, mas logar o erro
        } else {
          console.log(`Email queued successfully for ${body.email} with recovery link`)
        }
      } catch (queueEx: any) {
        console.error('Exception enqueueing email:', queueEx)
      }
    } else {
      // Log do erro de geração de link para debug
      console.error(`Failed to generate recovery link for user ${userId} (${body.email}):`, linkGenerationError || 'Unknown error')
      // Tentar usar método alternativo: gerar link de recovery direto do Supabase Auth
      try {
        const admin = supabase.auth.admin
        const appUrl = Deno.env.get('APP_PUBLIC_URL') || 'https://crm.automatiklabs.com.br'
        // Usar redirect_to do body se fornecido, senão usar default para /auth/recovery
        let redirectTo: string = `${appUrl}/auth/recovery`
        
        if (body.redirect_to) {
          try {
            if (body.redirect_to.startsWith('http://') || body.redirect_to.startsWith('https://')) {
              // Se for URL completa, usar diretamente (preserva localhost, porta, etc)
              redirectTo = body.redirect_to
            } else {
              // Se for apenas path, usar APP_PUBLIC_URL como base
              const path = body.redirect_to.startsWith('/') ? body.redirect_to : `/${body.redirect_to}`
              redirectTo = `${appUrl}${path}`
            }
          } catch {
            // Se falhar ao parsear, tentar como path
            const path = body.redirect_to.startsWith('/') ? body.redirect_to : `/${body.redirect_to}`
            redirectTo = `${appUrl}${path}`
          }
        }
        
        const { data: linkData, error: linkErr } = await admin.generateLink({
          type: 'recovery',
          email: body.email,
          options: { redirectTo }
        })
        
        if (!linkErr && linkData?.properties?.action_link) {
          recoveryLink = linkData.properties.action_link
          // Tentar enfileirar novamente com o link alternativo
          const { error: queueErr2 } = await supabase.from('email_queue').insert({
            recipient_email: body.email,
            template: body.email_template || 'welcome_recovery_link',
            variables_json: { 
              email: body.email, 
              recovery_link: recoveryLink,
              link: recoveryLink
            }
          })
          
          if (!queueErr2) {
            console.log(`Email queued with fallback recovery link for ${body.email}`)
            linkGenerationError = undefined // Limpar erro já que conseguimos gerar link alternativo
          }
        }
      } catch (fallbackErr: any) {
        console.error('Fallback recovery link generation also failed:', fallbackErr)
      }
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      user_id: userId, 
      user: userData || null,
      organization_id: masterOrgId, 
      plan_id: planId, 
      recovery_link: recoveryLink, 
      will_apply_on_first_org: !masterOrgId, 
      token_id: (globalThis as any).__last_token_id || null,
      email_queued: !!recoveryLink,
      link_generation_error: linkGenerationError || null
    }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  } catch (err: any) {
    return new Response(`Error: ${err?.message || err}`, { status: 400, headers: getCorsHeaders(req) })
  }
})



export {}