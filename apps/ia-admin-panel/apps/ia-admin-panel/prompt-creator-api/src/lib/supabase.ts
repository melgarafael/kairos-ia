import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!

// ============================================================================
// Types for credential resolution
// ============================================================================

export interface ClientCredentials {
  url: string
  serviceKey: string
  clientOrgId: string
}

export interface ClientCredentialsResult {
  credentials: ClientCredentials
  source: 'saas_organizations' | 'saas_supabases_connections'
}

// Create admin client with service role
export function createAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  })
}

// Create user client from token
export function createUserClient(token: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${token}` }
    }
  })
}

// Resolve user from auth token
export async function resolveUser(authHeader: string | null) {
  if (!authHeader) {
    throw new Error('Token de autenticação não fornecido')
  }
  
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  
  if (!token) {
    throw new Error('Token de autenticação inválido')
  }
  
  const adminClient = createAdminClient()
  const userClient = createUserClient(token)
  
  // Get user from token
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  
  if (authError || !user) {
    throw new Error('Usuário não autenticado')
  }
  
  // Verify user exists in saas_users
  const { data: saasUser, error: userError } = await adminClient
    .from('saas_users')
    .select('id, email, organization_id')
    .eq('id', user.id)
    .maybeSingle()
  
  if (userError || !saasUser) {
    throw new Error('Usuário não encontrado no sistema')
  }
  
  return {
    userId: saasUser.id,
    email: saasUser.email,
    organizationId: saasUser.organization_id,
    supabase: adminClient,
    token
  }
}

// ============================================================================
// Get Client Supabase Credentials with Fallback Logic
// Following the database doctrine: 
// 1. Primary: saas_organizations (client_supabase_url, client_service_key_encrypted)
// 2. Fallback: saas_supabases_connections (repository of Supabase projects)
// ============================================================================

export async function getClientCredentials(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string | null
): Promise<ClientCredentialsResult | null> {
  
  // ========== STEP 1: Try saas_organizations (primary source) ==========
  // Search by BOTH 'id' and 'client_org_id' since organizationId might be either
  if (organizationId) {
    console.log('[getClientCredentials] Trying saas_organizations for org:', organizationId)
    
    // First try by id, then by client_org_id
    let orgData = null
    let orgError = null
    
    // Try by id first
    const { data: byId, error: errById } = await supabase
      .from('saas_organizations')
      .select('id, client_supabase_url, client_service_key_encrypted, client_org_id')
      .eq('id', organizationId)
      .maybeSingle()
    
    if (!errById && byId) {
      orgData = byId
    } else {
      // Try by client_org_id
      const { data: byClientOrgId, error: errByClientOrgId } = await supabase
        .from('saas_organizations')
        .select('id, client_supabase_url, client_service_key_encrypted, client_org_id')
        .eq('client_org_id', organizationId)
        .maybeSingle()
      
      if (!errByClientOrgId && byClientOrgId) {
        orgData = byClientOrgId
      } else {
        orgError = errByClientOrgId || errById
      }
    }

    if (orgData?.client_supabase_url && orgData?.client_service_key_encrypted) {
      // Decrypt service key
      const { data: decryptedKey, error: decryptError } = await supabase.rpc('decrypt_key', {
        ciphertext: orgData.client_service_key_encrypted
      })

      if (!decryptError && decryptedKey) {
        // Use client_org_id if available, otherwise use the organizationId passed in
        const clientOrgId = orgData.client_org_id || organizationId
        
        console.log('[getClientCredentials] SUCCESS via saas_organizations | URL:', orgData.client_supabase_url)
        return {
          credentials: {
            url: orgData.client_supabase_url,
            serviceKey: decryptedKey,
            clientOrgId: clientOrgId!
          },
          source: 'saas_organizations'
        }
      } else {
        console.log('[getClientCredentials] Failed to decrypt service key:', decryptError?.message)
      }
    } else {
      console.log('[getClientCredentials] saas_organizations missing credentials:', {
        hasUrl: !!orgData?.client_supabase_url,
        hasKey: !!orgData?.client_service_key_encrypted,
        error: orgError?.message
      })
    }
  }

  // ========== STEP 2: Fallback - Get org's Supabase URL first, then find matching connection ==========
  console.log('[getClientCredentials] Trying fallback: find org URL then match connection')
  
  // First, get the organization's Supabase URL from saas_organizations
  let targetSupabaseUrl: string | null = null
  
  if (organizationId) {
    const { data: orgUrlData } = await supabase
      .from('saas_organizations')
      .select('client_supabase_url')
      .or(`id.eq.${organizationId},client_org_id.eq.${organizationId}`)
      .maybeSingle()
    
    if (orgUrlData?.client_supabase_url) {
      targetSupabaseUrl = orgUrlData.client_supabase_url.replace(/\/$/, '') // Normalize URL
      console.log('[getClientCredentials] Found target Supabase URL from organization:', targetSupabaseUrl)
    }
  }

  // Now find connection matching the organization's URL (or fall back to most recent)
  let connection = null
  
  if (targetSupabaseUrl) {
    // Find connection matching the organization's Supabase URL
    const { data: matchingConn, error: matchErr } = await supabase
      .from('saas_supabases_connections')
      .select('supabase_url, service_role_encrypted')
      .eq('owner_id', userId)
      .maybeSingle()
    
    // Check all connections for the user and find the matching one
    const { data: allConns } = await supabase
      .from('saas_supabases_connections')
      .select('supabase_url, service_role_encrypted')
      .eq('owner_id', userId)
    
    if (allConns) {
      connection = allConns.find(conn => 
        conn.supabase_url?.replace(/\/$/, '') === targetSupabaseUrl
      )
      
      if (connection) {
        console.log('[getClientCredentials] Found matching connection for URL:', targetSupabaseUrl)
      }
    }
  }
  
  // If no matching connection found, fall back to most recent (original behavior)
  if (!connection) {
    console.log('[getClientCredentials] No matching connection, falling back to most recent')
    const { data: recentConn, error: connError } = await supabase
      .from('saas_supabases_connections')
      .select('supabase_url, service_role_encrypted')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    
    connection = recentConn
  }

  if (!connection?.supabase_url || !connection?.service_role_encrypted) {
    console.log('[getClientCredentials] saas_supabases_connections fallback failed: no valid connection')
    return null
  }

  // Decrypt service role key from connections
  const { data: decryptedConnKey, error: decryptConnError } = await supabase.rpc('decrypt_key', {
    ciphertext: connection.service_role_encrypted
  })

  if (decryptConnError || !decryptedConnKey) {
    console.log('[getClientCredentials] Failed to decrypt connection service key:', decryptConnError?.message)
    return null
  }

  // Resolve clientOrgId: use organizationId if available, otherwise query client Supabase
  let clientOrgId = organizationId
  
  if (!clientOrgId) {
    console.log('[getClientCredentials] organizationId is null, attempting to resolve from client Supabase')
    clientOrgId = await resolveClientOrgId(connection.supabase_url, decryptedConnKey, null)
  }
  
  if (!clientOrgId) {
    console.log('[getClientCredentials] Could not resolve client_org_id from any source')
    return null
  }
  
  console.log('[getClientCredentials] SUCCESS via saas_supabases_connections | URL:', connection.supabase_url, '| clientOrgId:', clientOrgId)

  return {
    credentials: {
      url: connection.supabase_url,
      serviceKey: decryptedConnKey,
      clientOrgId
    },
    source: 'saas_supabases_connections'
  }
}

// ============================================================================
// Resolve client_org_id by querying the client Supabase
// Tries multiple table names for compatibility with different setups
// ============================================================================

async function resolveClientOrgId(
  clientUrl: string, 
  serviceKey: string, 
  fallbackOrgId?: string | null
): Promise<string | null> {
  try {
    const clientSupabase = createClient(clientUrl, serviceKey, {
      auth: { persistSession: false }
    })

    // Try 1: saas_organizations table (most common in client setups)
    const { data: saasOrgs, error: saasError } = await clientSupabase
      .from('saas_organizations')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (!saasError && saasOrgs?.id) {
      console.log('[resolveClientOrgId] Found org via saas_organizations:', saasOrgs.id)
      return saasOrgs.id
    }

    // Try 2: organizations table (alternative naming)
    const { data: orgs, error: orgsError } = await clientSupabase
      .from('organizations')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (!orgsError && orgs?.id) {
      console.log('[resolveClientOrgId] Found org via organizations:', orgs.id)
      return orgs.id
    }

    // Fallback: use the provided organizationId
    if (fallbackOrgId) {
      console.log('[resolveClientOrgId] Using fallback organizationId:', fallbackOrgId)
      return fallbackOrgId
    }

    console.log('[resolveClientOrgId] Could not find organization in client Supabase')
    return null
  } catch (err: any) {
    console.log('[resolveClientOrgId] Exception:', err.message)
    
    // On exception, still try to use fallback
    if (fallbackOrgId) {
      console.log('[resolveClientOrgId] Using fallback after exception:', fallbackOrgId)
      return fallbackOrgId
    }
    return null
  }
}

// ============================================================================
// Create a client Supabase connection from credentials
// ============================================================================

export function createClientSupabase(credentials: ClientCredentials): SupabaseClient {
  return createClient(credentials.url, credentials.serviceKey, {
    auth: { persistSession: false }
  })
}

export { SUPABASE_URL }

