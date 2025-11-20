// @ts-nocheck
// Edge Function: password-setup
// Gerencia tokens reutilizáveis para definição de senha inicial
// Permite que usuários usem o mesmo link múltiplas vezes até definir a senha
declare const Deno: {
  env: { get(name: string): string | undefined }
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
}

function getBooleanEnv(name: string): boolean {
  const v = (Deno.env.get(name) || '').toLowerCase().trim()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

function getTokenExpiryIso(): string {
  // Permite tornar o token "vitalício" (na prática, expira em 9999-12-31) até que a senha seja definida
  if (getBooleanEnv('PASSWORD_SETUP_TOKEN_NO_EXPIRY')) {
    return '9999-12-31T23:59:59.000Z'
  }
  // TTL em dias (fallback para 30). Também aceita PASSWORD_SETUP_TOKEN_TTL como alias.
  const raw = Deno.env.get('PASSWORD_SETUP_TOKEN_TTL_DAYS') || Deno.env.get('PASSWORD_SETUP_TOKEN_TTL') || '30'
  const days = Math.max(1, Number(raw) || 30)
  const ms = days * 24 * 60 * 60 * 1000
  return new Date(Date.now() + ms).toISOString()
}

function getCorsHeaders(req?: Request | null): HeadersInit {
  const allowedOrigins = (Deno.env.get('CORS_ORIGINS') || Deno.env.get('CORS_ORIGIN') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const origin = (req as any)?.headers?.get?.('Origin') || ''
  const allowOrigin = allowedOrigins.length === 0 ? '*' : (allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400'
  }
}

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const arr = new Uint32Array(32)
  crypto.getRandomValues(arr)
  let out = ''
  for (let i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length]
  return out
}

// Função auxiliar para criar sessão de recovery quando não consegue extrair tokens do link
async function createRecoverySessionFallback(admin: any, userId: string, email: string): Promise<Response> {
  try {
    console.log('[password-setup] validate: using fallback method to create recovery session')
    
    // Verificar se admin está disponível
    if (!admin) {
      console.error('[password-setup] validate: admin is undefined in fallback')
      return new Response(JSON.stringify({ 
        error: 'admin_unavailable',
        details: 'Admin API is not available for fallback method.'
      }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders({} as Request) } })
    }
    
    // Método alternativo: usar generateLink com tipo 'magiclink' ou criar sessão temporária
    // Primeiro, tentar gerar um magic link que pode ser usado para criar sessão
    const appUrl = Deno.env.get('APP_PUBLIC_URL') || 'https://crm.automatiklabs.com.br'
    const redirectTo = `${appUrl}/reset-password`
    
    // Tentar gerar um link de signup temporário que pode ser usado para criar sessão
    // Ou usar o método de criar uma sessão diretamente via admin API
    const { data: magicLinkData, error: magicErr } = await admin.generateLink({
      type: 'magiclink',
      email,
      options: { 
        emailRedirectTo: redirectTo,
        shouldCreateUser: false // Não criar usuário, apenas gerar link
      }
    })
    
    if (!magicErr && magicLinkData?.properties?.action_link) {
      const magicUrl = new URL(magicLinkData.properties.action_link)
      const hash = magicUrl.hash.replace('#', '')
      const hashParams = new URLSearchParams(hash)
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      
      if (accessToken && refreshToken) {
        console.log('[password-setup] validate: fallback method succeeded with magiclink')
        return new Response(JSON.stringify({ 
          ok: true, 
          user_id: userId, 
          email,
          access_token: accessToken,
          refresh_token: refreshToken
        }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders({} as Request) } })
      }
    }
    
    // Se magiclink não funcionou, tentar criar uma senha temporária e fazer login
    // Isso é mais invasivo, mas garante que funcione
    const tempPassword = generateToken() + 'A1!'
    
    try {
      // Atualizar senha temporariamente
      const { data: updateData, error: updateErr } = await admin.updateUserById(userId, {
        password: tempPassword
      })
      
      if (!updateErr) {
        // Criar sessão usando a senha temporária
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
        const MASTER_SUPABASE_URL = Deno.env.get('MASTER_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')
        const MASTER_SUPABASE_ANON_KEY = Deno.env.get('MASTER_SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || ''
        
        if (MASTER_SUPABASE_URL && MASTER_SUPABASE_ANON_KEY) {
          const tempClient = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_ANON_KEY, {
            auth: {
              autoRefreshToken: false,
              persistSession: false
            }
          })
          const { data: signInData, error: signInErr } = await tempClient.auth.signInWithPassword({
            email,
            password: tempPassword
          })
          
          if (!signInErr && signInData?.session) {
            console.log('[password-setup] validate: fallback method succeeded with temp password')
            // IMPORTANTE: Marcar que o usuário precisa trocar a senha
            return new Response(JSON.stringify({ 
              ok: true, 
              user_id: userId, 
              email,
              access_token: signInData.session.access_token,
              refresh_token: signInData.session.refresh_token,
              requires_password_change: true // Flag para indicar que precisa trocar senha
            }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders({} as Request) } })
          }
        }
      }
    } catch (tempPwdErr) {
      console.error('[password-setup] validate: temp password method failed:', tempPwdErr)
    }
    
    // Último recurso: retornar erro mas com informações úteis
    console.error('[password-setup] validate: all fallback methods failed')
    return new Response(JSON.stringify({ 
      error: 'failed_to_create_recovery_session',
      details: 'Unable to create recovery session using any available method. Please request a new password reset link.'
    }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders({} as Request) } })
    
  } catch (fallbackErr: any) {
    console.error('[password-setup] validate: fallback exception:', fallbackErr)
    return new Response(JSON.stringify({ 
      error: 'fallback_failed',
      details: fallbackErr?.message || 'Fallback method failed'
    }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders({} as Request) } })
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
    const MASTER_SUPABASE_URL = Deno.env.get('MASTER_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')
    const MASTER_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('MASTER_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!MASTER_SUPABASE_URL || !MASTER_SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'missing_env' }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // Criar cliente Supabase com service role key
    // IMPORTANTE: Esta função não verifica permissões de usuário - ela usa service role para operações administrativas
    const supabase = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || ''

    // Action: generate - Gera um novo token para um usuário
    if (action === 'generate' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      const userId = String(body?.user_id || '').trim()
      const email = String(body?.email || '').trim().toLowerCase()
      const redirectToRaw = String(body?.redirect_to || body?.redirectTo || '').trim()

      if (!userId || !email) {
        return new Response(JSON.stringify({ error: 'user_id and email are required' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      // Resolver URL base e caminho de redirect
      const appUrl = Deno.env.get('APP_PUBLIC_URL') || 'https://crm.automatiklabs.com.br'
      let setupUrlBase: string = appUrl
      let redirectPath = '/reset-password' // Default
      
      if (redirectToRaw) {
        try {
          // Se for uma URL completa (http:// ou https://), usar ela diretamente como base
          if (redirectToRaw.startsWith('http://') || redirectToRaw.startsWith('https://')) {
            const redirectUrl = new URL(redirectToRaw)
            // Usar a URL completa como base (incluindo protocolo, host, porta se houver)
            setupUrlBase = `${redirectUrl.protocol}//${redirectUrl.host}`
            redirectPath = redirectUrl.pathname + redirectUrl.search
          } else {
            // Se for apenas um path, usar APP_PUBLIC_URL como base
            redirectPath = redirectToRaw.startsWith('/') ? redirectToRaw : `/${redirectToRaw}`
          }
        } catch {
          // Se falhar ao parsear, tentar usar como path
          redirectPath = redirectToRaw.startsWith('/') ? redirectToRaw : `/${redirectToRaw}`
        }
      }

      // Verificar se já existe um token válido não usado
      const { data: existing } = await supabase
        .from('password_setup_tokens')
        .select('id, token, expires_at')
        .eq('user_id', userId)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing?.token) {
        const setupUrl = `${setupUrlBase}${redirectPath}${redirectPath.includes('?') ? '&' : '?'}token=${existing.token}`
        return new Response(JSON.stringify({ ok: true, token: existing.token, setup_url: setupUrl, reused: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      // Gerar novo token
      const token = generateToken()
      const expiresAt = getTokenExpiryIso()

      const { data: inserted, error } = await supabase
        .from('password_setup_tokens')
        .insert({
          user_id: userId,
          email,
          token,
          expires_at: expiresAt
        })
        .select('id, token')
        .single()

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      const setupUrl = `${setupUrlBase}${redirectPath}${redirectPath.includes('?') ? '&' : '?'}token=${inserted.token}`

      return new Response(JSON.stringify({ ok: true, token: inserted.token, setup_url: setupUrl, reused: false }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    // Action: validate - Valida um token e retorna sessão de recovery do Supabase
    if (action === 'validate' && req.method === 'GET') {
      const token = url.searchParams.get('token') || ''
      
      if (!token) {
        console.error('[password-setup] validate: token is required')
        return new Response(JSON.stringify({ error: 'token is required' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      console.log('[password-setup] validate: validating token:', token.substring(0, 10) + '...')

      const { data, error } = await supabase.rpc('validate_password_setup_token', { p_token: token })

      if (error) {
        console.error('[password-setup] validate: RPC error:', error)
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      if (!data || data.length === 0) {
        console.error('[password-setup] validate: token not found or expired')
        return new Response(JSON.stringify({ error: 'invalid_or_expired_token' }), { status: 404, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      const userId = data[0].user_id
      const email = data[0].email
      console.log('[password-setup] validate: token valid for user:', userId, email)

      // Gerar link de recovery do Supabase para criar sessão
      // IMPORTANTE: Esta função não verifica permissões de admin - ela apenas valida o token e gera o link
      try {
        // Resolver redirectTo baseado no token customizado (se houver contexto)
        // Por padrão, usar /reset-password, mas pode ser customizado
        const appUrl = Deno.env.get('APP_PUBLIC_URL') || 'https://crm.automatiklabs.com.br'
        const redirectTo = `${appUrl}/reset-password`
        
        console.log('[password-setup] validate: generating recovery link for:', email, 'redirectTo:', redirectTo)
        
        // Verificar se admin está disponível no cliente principal
        // Usar try-catch para capturar qualquer erro de inicialização
        let admin: any = null
        try {
          if (supabase.auth && supabase.auth.admin) {
            admin = supabase.auth.admin
          } else {
            console.warn('[password-setup] validate: admin not available on main client, creating new client')
            // Se não estiver disponível, criar um novo cliente dedicado com as mesmas configurações
            const adminClient = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_ROLE_KEY, {
              auth: {
                autoRefreshToken: false,
                persistSession: false
              }
            })
            admin = adminClient.auth?.admin
          }
        } catch (adminInitErr: any) {
          console.error('[password-setup] validate: error initializing admin:', adminInitErr)
          return new Response(JSON.stringify({ 
            error: 'admin_init_failed',
            details: adminInitErr?.message || 'Failed to initialize admin API'
          }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }
        
        if (!admin) {
          console.error('[password-setup] validate: admin API not available')
          return new Response(JSON.stringify({ 
            error: 'admin_api_unavailable',
            details: 'Admin API is not available. Please check service role key configuration.'
          }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }
        
        // Método 1: Tentar gerar link de recovery via generateLink
        let linkData: any = null
        let linkErr: any = null
        
        try {
          console.log('[password-setup] validate: calling generateLink')
          // Garantir que os parâmetros estão corretos antes de chamar
          if (!email || typeof email !== 'string') {
            throw new Error('Invalid email parameter')
          }
          if (!redirectTo || typeof redirectTo !== 'string') {
            throw new Error('Invalid redirectTo parameter')
          }
          
          // Chamar generateLink com tratamento de erro mais específico
          // O erro "Cannot read properties of undefined (reading 'get')" pode vir de dentro do Supabase JS
          const generateLinkParams = {
            type: 'recovery' as const,
            email: String(email).trim(),
            options: { 
              redirectTo: String(redirectTo).trim()
            }
          }
          
          console.log('[password-setup] validate: generateLink params:', {
            type: generateLinkParams.type,
            email: generateLinkParams.email.substring(0, 5) + '...',
            hasOptions: !!generateLinkParams.options,
            redirectTo: (generateLinkParams.options?.redirectTo || '').substring(0, 30) + '...'
          })
          
          const result = await admin.generateLink(generateLinkParams)
          console.log('[password-setup] validate: generateLink completed', {
            hasData: !!result?.data,
            hasError: !!result?.error
          })
          linkData = result?.data
          linkErr = result?.error
        } catch (generateErr: any) {
          console.error('[password-setup] validate: generateLink exception:', {
            message: generateErr?.message,
            stack: generateErr?.stack,
            name: generateErr?.name,
            error: String(generateErr),
            cause: generateErr?.cause
          })
          linkErr = generateErr
        }

        if (linkErr) {
          console.error('[password-setup] validate: generateLink error:', linkErr)
          // Fallback: tentar criar sessão diretamente sem link
          return await createRecoverySessionFallback(admin, userId, email)
        }

        // Verificar múltiplos formatos de resposta
        const actionLink = linkData?.properties?.action_link 
          || (linkData as any)?.action_link 
          || (linkData as any)?.link
          || ''

        if (!actionLink) {
          console.error('[password-setup] validate: action_link missing in response:', JSON.stringify(linkData))
          // Fallback: tentar criar sessão diretamente
          return await createRecoverySessionFallback(admin, userId, email)
        }

        console.log('[password-setup] validate: recovery link generated successfully, action_link length:', actionLink.length)

        // Extrair tokens do link de recovery - tentar múltiplos formatos
        try {
          const recoveryUrl = new URL(actionLink)
          
          // Tentar extrair do hash primeiro
          let accessToken: string | null = null
          let refreshToken: string | null = null
          
          if (recoveryUrl.hash) {
            const hash = recoveryUrl.hash.replace('#', '')
            const hashParams = new URLSearchParams(hash)
            accessToken = hashParams.get('access_token')
            refreshToken = hashParams.get('refresh_token')
          }
          
          // Se não encontrou no hash, tentar na query string
          if (!accessToken || !refreshToken) {
            accessToken = recoveryUrl.searchParams.get('access_token') || accessToken
            refreshToken = recoveryUrl.searchParams.get('refresh_token') || refreshToken
          }
          
          // Se ainda não encontrou, tentar parsear o hash de forma mais flexível
          if (!accessToken || !refreshToken) {
            const fullHash = recoveryUrl.hash || ''
            // Tentar extrair tokens usando regex como fallback
            const accessMatch = fullHash.match(/access_token=([^&]+)/)
            const refreshMatch = fullHash.match(/refresh_token=([^&]+)/)
            
            if (accessMatch) accessToken = decodeURIComponent(accessMatch[1])
            if (refreshMatch) refreshToken = decodeURIComponent(refreshMatch[1])
          }

          if (accessToken && refreshToken) {
            console.log('[password-setup] validate: tokens extracted successfully from link')
            return new Response(JSON.stringify({ 
              ok: true, 
              user_id: userId, 
              email,
              access_token: accessToken,
              refresh_token: refreshToken
            }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
          }
          
          // Se não conseguiu extrair tokens, usar fallback
          console.warn('[password-setup] validate: tokens not found in link, using fallback method')
          return await createRecoverySessionFallback(admin, userId, email)
          
        } catch (urlErr: any) {
          console.error('[password-setup] validate: URL parsing error:', urlErr)
          // Fallback: tentar criar sessão diretamente
          return await createRecoverySessionFallback(admin, userId, email)
        }
      } catch (e: any) {
        console.error('[password-setup] validate: exception:', e)
        // Último fallback: tentar criar sessão diretamente
        try {
          // Usar admin do cliente principal
          if (supabase.auth?.admin) {
            return await createRecoverySessionFallback(supabase.auth.admin, userId, email)
          }
          throw new Error('Admin API not available')
        } catch (fallbackErr: any) {
          return new Response(JSON.stringify({ error: e?.message || 'failed_to_create_session', details: String(e) }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
        }
      }
    }

    // Action: complete - Marca o token como usado após definir senha
    if (action === 'complete' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      const token = String(body?.token || '').trim()

      if (!token) {
        return new Response(JSON.stringify({ error: 'token is required' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      const { error } = await supabase.rpc('mark_password_setup_token_used', { p_token: token })

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
    }

    return new Response(JSON.stringify({ error: 'invalid_action' }), { status: 400, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  } catch (e: any) {
    console.error('[password-setup] top-level error:', {
      message: e?.message,
      stack: e?.stack,
      name: e?.name,
      error: String(e),
      cause: e?.cause
    })
    return new Response(JSON.stringify({ 
      error: e?.message || 'internal_error',
      details: String(e),
      stack: e?.stack
    }), { status: 500, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } })
  }
})

