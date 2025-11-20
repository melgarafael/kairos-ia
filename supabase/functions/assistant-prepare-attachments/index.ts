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

type PreparedAttachment = {
  kind: 'text' | 'image'
  name: string
  mime: string
  content?: string // text
  dataUrl?: string // image
  size: number
}

function sanitizeText(input: string): string {
  return input.replace(/\u0000/g, '').slice(0, 250000) // 250k chars cap
}

async function readTextFile(f: File, mime: string): Promise<string> {
  const text = await f.text()
  if (mime.includes('html')) {
    // remove tags simples
    return sanitizeText(text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' '))
  }
  return sanitizeText(text)
}

async function readPdfAsText(f: File): Promise<string> {
  // Simple approach: try to use pdfjs-dist via esm
  try {
    // @ts-ignore - dynamic import via ESM on Deno
    const pdfjs = await import('https://esm.sh/pdfjs-dist@4.4.168')
    const buf = new Uint8Array(await f.arrayBuffer())
    // @ts-ignore
    const loadingTask = pdfjs.getDocument({ data: buf })
    // @ts-ignore
    const pdf = await loadingTask.promise
    let text = ''
    const maxPages = Math.min(pdf.numPages, 30)
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items.map((it: any) => it.str).join(' ')
      text += `\n\n[Page ${i}]\n${pageText}`
    }
    return sanitizeText(text)
  } catch (e) {
    return sanitizeText((await f.text()).slice(0, 200000))
  }
}

// Converte bytes em Base64 sem usar spreads enormes (evita "Maximum call stack size exceeded")
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000 // 32KB para manter o uso de memória/stack sob controle
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    let chunkStr = ''
    for (let j = 0; j < chunk.length; j++) {
      chunkStr += String.fromCharCode(chunk[j])
    }
    binary += chunkStr
  }
  return btoa(binary)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

    const form = await req.formData()
    const files = form.getAll('files') as File[]
    if (!files || files.length === 0) return new Response('No files', { status: 400, headers: getCorsHeaders(req) })

    const prepared: PreparedAttachment[] = []
    const totalSize = files.reduce((acc, f) => acc + f.size, 0)
    if (totalSize > 20 * 1024 * 1024) {
      return new Response('Total attachments too large', { status: 413, headers: getCorsHeaders(req) })
    }

    for (const f of files.slice(0, 6)) {
      const name = f.name || 'file'
      const mime = f.type || 'application/octet-stream'
      if (mime.startsWith('image/')) {
        const b64 = bytesToBase64(new Uint8Array(await f.arrayBuffer()))
        prepared.push({ kind: 'image', name, mime, dataUrl: `data:${mime};base64,${b64}`, size: f.size })
        continue
      }
      if (mime.includes('pdf')) {
        const text = await readPdfAsText(f)
        prepared.push({ kind: 'text', name, mime, content: text, size: f.size })
        continue
      }
      // Treat CSV and Excel-uploaded-CSV as text too (use filename fallback when mime is generic)
      if (mime.includes('json') || mime.includes('markdown') || mime.includes('md') || mime.includes('html') || mime.includes('csv') || mime === 'application/vnd.ms-excel' || mime.startsWith('text/') || name.toLowerCase().endsWith('.csv')) {
        const text = await readTextFile(f, mime)
        prepared.push({ kind: 'text', name, mime, content: text, size: f.size })
        continue
      }
      // default: treat as opaque; skip large binaries
      prepared.push({ kind: 'text', name, mime, content: `Arquivo ${name} (${mime}) anexado, mas não processado.`, size: f.size })
    }

    return new Response(JSON.stringify({ attachments: prepared }), {
      headers: { 'content-type': 'application/json', ...getCorsHeaders(req) }
    })
  } catch (err: any) {
    return new Response(`Error: ${err?.message || err}`, { status: 500, headers: getCorsHeaders(req) })
  }
})


