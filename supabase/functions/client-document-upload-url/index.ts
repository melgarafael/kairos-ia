// @ts-nocheck
// Edge Function: Gerar signed URL para upload de documentos de clientes
// Formatos suportados: CSV, DOCX, TXT, MD, JSON
import { serve } from 'https://deno.land/std@0.181.0/http/server.ts'

function getCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin') || '*'
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': req.headers.get('access-control-request-headers') || '*',
    'access-control-allow-methods': 'POST,OPTIONS',
    'access-control-max-age': '86400',
    'vary': 'origin'
  }
}

// Tipos MIME permitidos
const ALLOWED_MIME_TYPES = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/json',
  'text/json'
]

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  const cors = getCorsHeaders(req)
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
        status: 405, 
        headers: { ...cors, 'content-type': 'application/json' } 
      })
    }

    const url = new URL(req.url)
    const projectUrl = url.origin.replace('.functions.supabase.co', '.supabase.co')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE') || Deno.env.get('UPDATE_SERVICE_ROLE_KEY') || ''
    
    if (!serviceRole) {
      return new Response(JSON.stringify({ error: 'missing_service_role' }), { 
        status: 500, 
        headers: { ...cors, 'content-type': 'application/json' } 
      })
    }

    const { filename, mime_type, file_size_bytes } = await req.json().catch(() => ({}))
    
    if (!filename) {
      return new Response(JSON.stringify({ error: 'filename_required' }), { 
        status: 400, 
        headers: { ...cors, 'content-type': 'application/json' } 
      })
    }

    // Validar tipo MIME
    if (mime_type && !ALLOWED_MIME_TYPES.includes(mime_type)) {
      return new Response(JSON.stringify({ 
        error: 'invalid_mime_type', 
        message: `Tipo MIME não permitido. Tipos permitidos: ${ALLOWED_MIME_TYPES.join(', ')}` 
      }), { 
        status: 400, 
        headers: { ...cors, 'content-type': 'application/json' } 
      })
    }

    // Validar tamanho (50MB)
    const MAX_SIZE = 50 * 1024 * 1024 // 50MB
    if (file_size_bytes && file_size_bytes > MAX_SIZE) {
      return new Response(JSON.stringify({ 
        error: 'file_too_large', 
        message: 'Arquivo muito grande. Tamanho máximo: 50MB' 
      }), { 
        status: 400, 
        headers: { ...cors, 'content-type': 'application/json' } 
      })
    }

    const bucket = 'client-documents'
    const path = `${crypto.randomUUID()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const storagePath = `${bucket}/${path}`

    // Garantir bucket (idempotente)
    const createBucket = await fetch(`${projectUrl}/storage/v1/bucket`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${serviceRole}`, 
        'apikey': serviceRole, 
        'content-type': 'application/json' 
      },
      body: JSON.stringify({ 
        name: bucket, 
        public: false,
        file_size_limit: MAX_SIZE,
        allowed_mime_types: ALLOWED_MIME_TYPES
      })
    })
    
    if (!createBucket.ok && createBucket.status !== 409) {
      const err = await createBucket.text().catch(() => '')
      return new Response(JSON.stringify({ 
        error: `create_bucket_failed: ${err || createBucket.status}` 
      }), { 
        status: 500, 
        headers: { ...cors, 'content-type': 'application/json' } 
      })
    }

    // Assinar upload (v1 REST) - 15 minutos de validade
    const signRes = await fetch(
      `${projectUrl}/storage/v1/object/upload/sign/${bucket}/${encodeURIComponent(path)}?expiresIn=900&upsert=true`, 
      {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${serviceRole}`, 
          'apikey': serviceRole 
        }
      }
    )
    
    const signJson = await signRes.json()
    
    if (!signRes.ok) {
      return new Response(JSON.stringify({ 
        error: signJson?.message || 'sign_upload_failed' 
      }), { 
        status: 500, 
        headers: { ...cors, 'content-type': 'application/json' } 
      })
    }

    return new Response(JSON.stringify({ 
      signedUrl: signJson?.signedUrl || signJson?.url, 
      token: signJson?.token, 
      storagePath: storagePath,
      bucket: bucket,
      path: path
    }), {
      headers: { ...cors, 'content-type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ 
      error: String(e?.message || e) 
    }), { 
      status: 500, 
      headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } 
    })
  }
})

