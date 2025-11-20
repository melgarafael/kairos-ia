// @ts-nocheck
/* eslint-disable */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

function getCorsHeaders(req: Request): HeadersInit {
  const allowedOrigins = (Deno.env.get('CORS_ORIGINS') || Deno.env.get('CORS_ORIGIN') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const origin = req.headers.get('Origin') || ''
  const allowOrigin = allowedOrigins.length === 0 ? '*' : (allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  }
}

function cleanBase64(str: string): string {
  return str.replace(/\s/g, '').trim()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4')
    
    const MASTER_URL = Deno.env.get('SUPABASE_URL')!
    const MASTER_ANON = Deno.env.get('SUPABASE_ANON_KEY')!
    const MASTER_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Auth user via anon+Bearer
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''
    const authClient = createClient(MASTER_URL, MASTER_ANON, { 
      global: { headers: { Authorization: `Bearer ${bearer || MASTER_ANON}` } } 
    })
    const { data: userData, error: userErr } = await authClient.auth.getUser()
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
      })
    }
    const saasUserId = userData.user.id

    const master = createClient(MASTER_URL, MASTER_SERVICE)
    const body = await req.json().catch(() => ({})) as any

    const masterOrgId = String(body?.master_org_id || '').trim()
    const clientSupabaseUrl = String(body?.client_supabase_url || '').trim()
    const clientAnonKey = String(body?.client_anon_key || '').trim()
    const clientServiceKey = String(body?.client_service_key || '').trim()
    const clientOrgId = String(body?.client_org_id || '').trim() // Opcional: se fornecido, usa esta org; senão cria nova
    const orgName = String(body?.org_name || '').trim() // Opcional: nome da org se criar nova
    const orgSlug = String(body?.org_slug || '').trim() // Opcional: slug da org se criar nova

    if (!masterOrgId) {
      return new Response(JSON.stringify({ error: 'master_org_id is required' }), { 
        status: 400, 
        headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
      })
    }

    if (!clientSupabaseUrl || !clientAnonKey) {
      return new Response(JSON.stringify({ error: 'client_supabase_url and client_anon_key are required' }), { 
        status: 400, 
        headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
      })
    }

    // 1. Verificar ownership da organização no Master
    const { data: masterOrg, error: orgErr } = await master
      .from('saas_organizations')
      .select('id, owner_id, name, slug, client_org_id, client_supabase_url')
      .eq('id', masterOrgId)
      .maybeSingle()

    if (orgErr) {
      return new Response(JSON.stringify({ error: `Error fetching organization: ${orgErr.message}` }), { 
        status: 400, 
        headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
      })
    }

    if (!masterOrg) {
      return new Response(JSON.stringify({ error: 'Organization not found in Master' }), { 
        status: 404, 
        headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
      })
    }

    // Verificar ownership
    if (String(masterOrg.owner_id) !== String(saasUserId)) {
      return new Response(JSON.stringify({ error: 'You are not the owner of this organization' }), { 
        status: 403, 
        headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
      })
    }

    // 2. Validar conexão com o Client Supabase
    const client = createClient(clientSupabaseUrl, clientAnonKey)
    
    // Teste básico de conectividade
    const { error: pingError } = await client
      .from('clients' as any)
      .select('count', { count: 'exact', head: true })
      .limit(0)

    if (pingError) {
      const isDeleted = 
        pingError.code === 'PGRST301' ||
        (pingError.code === 'PGRST116' && pingError.message?.includes('not found')) ||
        pingError.message?.toLowerCase().includes('project not found') ||
        pingError.status === 404 ||
        pingError.status === 0

      if (isDeleted) {
        return new Response(JSON.stringify({ error: 'Client Supabase project appears to be deleted or inaccessible' }), { 
          status: 400, 
          headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
        })
      }
      
      return new Response(JSON.stringify({ error: `Client Supabase connection error: ${pingError.message}` }), { 
        status: 400, 
        headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
      })
    }

    // 3. Resolver ou criar organização no Client Supabase
    let finalClientOrgId: string | null = null

    if (clientOrgId) {
      // Usar organização existente fornecida
      const { data: existingOrg, error: checkErr } = await client
        .from('saas_organizations')
        .select('id, owner_id')
        .eq('id', clientOrgId)
        .maybeSingle()

      if (checkErr) {
        return new Response(JSON.stringify({ error: `Error checking organization: ${checkErr.message}` }), { 
          status: 400, 
          headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
        })
      }

      if (!existingOrg) {
        return new Response(JSON.stringify({ error: 'Specified client organization not found' }), { 
          status: 404, 
          headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
        })
      }

      // Verificar ownership no Client (se possível)
      if (existingOrg.owner_id && String(existingOrg.owner_id) !== String(saasUserId)) {
        return new Response(JSON.stringify({ error: 'You are not the owner of the specified client organization' }), { 
          status: 403, 
          headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
        })
      }

      finalClientOrgId = clientOrgId
    } else if (orgName && orgSlug) {
      // Criar nova organização no Client
      const { data: newOrg, error: createErr } = await client
        .from('saas_organizations')
        .insert({
          name: orgName,
          slug: orgSlug,
          owner_id: saasUserId,
          plan_type: masterOrg.plan_type || 'trial',
          is_active: true
        })
        .select('id')
        .single()

      if (createErr) {
        // Se slug já existe, tentar buscar por slug
        if (createErr.code === '23505' || createErr.message?.toLowerCase().includes('duplicate')) {
          const { data: existingBySlug } = await client
            .from('saas_organizations')
            .select('id, owner_id')
            .eq('slug', orgSlug)
            .maybeSingle()

          if (existingBySlug?.id) {
            if (String(existingBySlug.owner_id) === String(saasUserId)) {
              finalClientOrgId = existingBySlug.id
            } else {
              return new Response(JSON.stringify({ error: 'Slug already exists and belongs to another user' }), { 
                status: 409, 
                headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
              })
            }
          } else {
            return new Response(JSON.stringify({ error: `Error creating organization: ${createErr.message}` }), { 
              status: 400, 
              headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
            })
          }
        } else {
          return new Response(JSON.stringify({ error: `Error creating organization: ${createErr.message}` }), { 
            status: 400, 
            headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
          })
        }
      } else {
        finalClientOrgId = newOrg.id
      }
    } else {
      // Tentar encontrar organização existente no Client por slug do Master
      if (masterOrg.slug) {
        const { data: foundBySlug } = await client
          .from('saas_organizations')
          .select('id, owner_id')
          .eq('slug', masterOrg.slug)
          .maybeSingle()

        if (foundBySlug?.id && String(foundBySlug.owner_id) === String(saasUserId)) {
          finalClientOrgId = foundBySlug.id
        }
      }

      // Se não encontrou, criar nova com dados do Master
      if (!finalClientOrgId) {
        const slugToUse = masterOrg.slug || `org-${masterOrgId.slice(0, 8)}`
        const nameToUse = masterOrg.name || `Organization ${masterOrgId.slice(0, 8)}`

        const { data: newOrg, error: createErr } = await client
          .from('saas_organizations')
          .insert({
            name: nameToUse,
            slug: slugToUse,
            owner_id: saasUserId,
            plan_type: 'trial',
            is_active: true
          })
          .select('id')
          .single()

        if (createErr) {
          // Se falhou por conflito, tentar buscar novamente
          if (createErr.code === '23505') {
            const { data: retry } = await client
              .from('saas_organizations')
              .select('id, owner_id')
              .eq('slug', slugToUse)
              .maybeSingle()
            
            if (retry?.id && String(retry.owner_id) === String(saasUserId)) {
              finalClientOrgId = retry.id
            } else {
              return new Response(JSON.stringify({ error: `Error creating organization: ${createErr.message}` }), { 
                status: 400, 
                headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
              })
            }
          } else {
            return new Response(JSON.stringify({ error: `Error creating organization: ${createErr.message}` }), { 
              status: 400, 
              headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
            })
          }
        } else {
          finalClientOrgId = newOrg.id
        }
      }
    }

    if (!finalClientOrgId) {
      return new Response(JSON.stringify({ error: 'Failed to resolve or create client organization' }), { 
        status: 500, 
        headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
      })
    }

    // 4. Atualizar Master com novas credenciais e client_org_id
    // Se o client_org_id está mudando, usar função RPC especial que permite a mudança
    const oldClientOrgId = masterOrg.client_org_id
    const isChangingClientOrgId = oldClientOrgId && String(oldClientOrgId) !== String(finalClientOrgId)

    if (isChangingClientOrgId) {
      // Usar função RPC para permitir mudança de client_org_id
      const { error: relinkErr } = await master.rpc('relink_client_organization', {
        p_master_org_id: masterOrgId,
        p_new_client_org_id: finalClientOrgId,
        p_user_id: saasUserId
      })

      if (relinkErr) {
        return new Response(JSON.stringify({ error: `Error relinking client organization: ${relinkErr.message}` }), { 
          status: 500, 
          headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
        })
      }
    }

    // Atualizar outras credenciais (URL e keys)
    const updateData: any = {
      client_supabase_url: clientSupabaseUrl,
      client_anon_key_encrypted: btoa(cleanBase64(clientAnonKey)),
      updated_at: new Date().toISOString()
    }

    // Se não mudou o client_org_id, incluir na atualização normal
    if (!isChangingClientOrgId) {
      updateData.client_org_id = finalClientOrgId
    }

    // IMPORTANTE: Sempre atualizar service key para evitar usar service key do projeto antigo deletado
    if (clientServiceKey && clientServiceKey.trim()) {
      updateData.client_service_key_encrypted = btoa(cleanBase64(clientServiceKey))
    } else {
      // Se não fornecido, limpar o service key antigo para evitar usar credenciais do projeto deletado
      // Isso força o usuário a fornecer o service key depois se necessário
      updateData.client_service_key_encrypted = null
    }

    const { error: updateErr } = await master
      .from('saas_organizations')
      .update(updateData)
      .eq('id', masterOrgId)

    if (updateErr) {
      return new Response(JSON.stringify({ error: `Error updating Master organization: ${updateErr.message}` }), { 
        status: 500, 
        headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
      })
    }

    // 5. Sincronizar dados da organização do Master para o Client (best-effort)
    try {
      const clientWithService = clientServiceKey 
        ? createClient(clientSupabaseUrl, clientServiceKey)
        : client

      const syncPayload: any = {
        name: masterOrg.name,
        slug: masterOrg.slug || `org-${finalClientOrgId.slice(0, 8)}`,
        is_active: true
      }

      await clientWithService
        .from('saas_organizations')
        .update(syncPayload)
        .eq('id', finalClientOrgId)
    } catch (syncErr) {
      // Best-effort: não falhar se sincronização falhar
      console.warn('Failed to sync organization data to Client:', syncErr)
    }

    // 6. Atualizar organization_id do usuário se mudou o client_org_id
    // Isso garante que o frontend use o novo client_org_id automaticamente
    if (isChangingClientOrgId) {
      try {
        const { error: updateUserOrgErr } = await master.rpc('update_user_organization', {
          p_user_id: saasUserId,
          p_organization_id: finalClientOrgId
        })
        if (updateUserOrgErr) {
          console.warn('Failed to update user organization_id:', updateUserOrgErr)
          // Não falhar o resync por isso, mas avisar
        }
      } catch (userOrgErr) {
        console.warn('Error updating user organization_id:', userOrgErr)
        // Best-effort: não falhar o resync
      }
    }

    // 7. Atualizar repositório de conexões (best-effort)
    try {
      const connPayload: any = {
        owner_id: saasUserId,
        supabase_url: clientSupabaseUrl,
        anon_key_encrypted: btoa(cleanBase64(clientAnonKey)),
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      if (clientServiceKey) {
        connPayload.service_role_encrypted = btoa(cleanBase64(clientServiceKey))
      }

      await master
        .from('saas_supabases_connections')
        .upsert(connPayload, { onConflict: 'owner_id, supabase_url' })
    } catch (connErr) {
      // Best-effort: não falhar se atualização de conexão falhar
      console.warn('Failed to update connection repository:', connErr)
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      master_org_id: masterOrgId,
      client_org_id: finalClientOrgId,
      client_supabase_url: clientSupabaseUrl,
      user_organization_id_updated: isChangingClientOrgId
    }), { 
      status: 200, 
      headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
    })

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), { 
      status: 500, 
      headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } 
    })
  }
})

