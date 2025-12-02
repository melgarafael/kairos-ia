import { NextRequest, NextResponse } from 'next/server'
import { resolveUser } from '@/lib/supabase'
import mammoth from 'mammoth'

// Types
interface PreparedFile {
  kind: 'text' | 'image'
  name: string
  mime: string
  content?: string
  dataUrl?: string
  size: number
}

// CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

function sanitizeText(input: string): string {
  return input.replace(/\u0000/g, '').slice(0, 250000) // 250k chars cap
}

async function readTextFile(buffer: Buffer, mime: string, name: string): Promise<string> {
  const text = buffer.toString('utf-8')
  if (mime.includes('html')) {
    return sanitizeText(
      text
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
    )
  }
  return sanitizeText(text)
}

async function readDocxFile(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer })
    return sanitizeText(result.value)
  } catch (error) {
    console.error('Error reading DOCX:', error)
    return 'Erro ao processar arquivo DOCX'
  }
}

function parseCSV(text: string): string {
  // Parse CSV and format as structured text for better AI comprehension
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length === 0) return text
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
    return headers.reduce((obj, header, i) => {
      obj[header] = values[i] || ''
      return obj
    }, {} as Record<string, string>)
  })
  
  // Format as readable text
  let formatted = `### Dados do CSV (${rows.length} registros)\n\n`
  formatted += `**Colunas:** ${headers.join(', ')}\n\n`
  formatted += `**Amostra dos dados:**\n`
  
  rows.slice(0, 20).forEach((row, i) => {
    formatted += `\n**Registro ${i + 1}:**\n`
    Object.entries(row).forEach(([key, value]) => {
      if (value) formatted += `- ${key}: ${value}\n`
    })
  })
  
  if (rows.length > 20) {
    formatted += `\n... e mais ${rows.length - 20} registros.`
  }
  
  return formatted
}

function parseMarkdown(text: string): string {
  // Markdown is already readable, just clean it up
  return sanitizeText(text)
}

export async function POST(request: NextRequest) {
  const traceId = crypto.randomUUID()
  
  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization')
    await resolveUser(authHeader)
    
    // Get form data
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400, headers: { 'x-trace-id': traceId } }
      )
    }
    
    // Check total size (max 20MB)
    const totalSize = files.reduce((acc, f) => acc + f.size, 0)
    if (totalSize > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Arquivos muito grandes (máx. 20MB total)' },
        { status: 413, headers: { 'x-trace-id': traceId } }
      )
    }
    
    const prepared: PreparedFile[] = []
    
    for (const file of files.slice(0, 6)) {
      const name = file.name || 'arquivo'
      const mime = file.type || 'application/octet-stream'
      const buffer = Buffer.from(await file.arrayBuffer())
      const ext = name.toLowerCase().split('.').pop() || ''
      
      // DOCX files
      if (ext === 'docx' || mime.includes('openxmlformats-officedocument.wordprocessingml')) {
        const text = await readDocxFile(buffer)
        prepared.push({
          kind: 'text',
          name,
          mime,
          content: text,
          size: file.size
        })
        continue
      }
      
      // CSV files
      if (ext === 'csv' || mime.includes('csv') || mime === 'application/vnd.ms-excel') {
        const text = buffer.toString('utf-8')
        const formatted = parseCSV(text)
        prepared.push({
          kind: 'text',
          name,
          mime,
          content: formatted,
          size: file.size
        })
        continue
      }
      
      // Markdown files
      if (ext === 'md' || mime.includes('markdown')) {
        const text = parseMarkdown(buffer.toString('utf-8'))
        prepared.push({
          kind: 'text',
          name,
          mime,
          content: text,
          size: file.size
        })
        continue
      }
      
      // Plain text files
      if (ext === 'txt' || mime.startsWith('text/') || mime.includes('json')) {
        const text = await readTextFile(buffer, mime, name)
        prepared.push({
          kind: 'text',
          name,
          mime,
          content: text,
          size: file.size
        })
        continue
      }
      
      // Images - convert to base64 data URL
      if (mime.startsWith('image/')) {
        const base64 = buffer.toString('base64')
        prepared.push({
          kind: 'image',
          name,
          mime,
          dataUrl: `data:${mime};base64,${base64}`,
          size: file.size
        })
        continue
      }
      
      // Unknown format
      prepared.push({
        kind: 'text',
        name,
        mime,
        content: `Arquivo "${name}" (${mime}) anexado, mas formato não suportado para leitura.`,
        size: file.size
      })
    }
    
    return NextResponse.json(
      { files: prepared },
      {
        headers: {
          'x-trace-id': traceId,
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  } catch (error) {
    console.error('File processing error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao processar arquivo' },
      { status: 500, headers: { 'x-trace-id': traceId } }
    )
  }
}

