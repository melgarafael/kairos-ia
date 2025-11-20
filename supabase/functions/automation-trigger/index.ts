// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const allowedOrigins = (Deno.env.get('CORS_ORIGINS') || Deno.env.get('CORS_ORIGIN') || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

function getCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('Origin') || ''
  const allowOrigin = allowedOrigins.length === 0
    ? '*'
    : (allowedOrigins.includes(origin) ? origin : '')
  return {
    'Access-Control-Allow-Origin': allowOrigin || 'null',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const origin = req.headers.get('Origin') || ''
    if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
      return new Response('Origin not allowed', { status: 403, headers: getCorsHeaders(req) })
    }

    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return new Response('Unauthorized', { status: 401, headers: getCorsHeaders(req) })
    }

    const { eventType, data, organizationId } = await req.json()
    
    console.log(`🎯 [AUTOMATION-TRIGGER] Event: ${eventType} for org: ${organizationId}`)
    
    // Initialize Master Supabase client to get organization credentials
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const masterSupabase = createClient(supabaseUrl, supabaseKey)

    // Validate JWT and resolve user
    const accessToken = authHeader.replace('Bearer ', '')
    const { data: userInfo, error: userErr } = await masterSupabase.auth.getUser(accessToken)
    if (userErr || !userInfo?.user) {
      return new Response('Invalid token', { status: 401, headers: getCorsHeaders(req) })
    }

    const requesterUserId = userInfo.user.id
    // Ensure requester belongs to organizationId
    const { data: requester, error: requesterErr } = await masterSupabase
      .from('saas_users')
      .select('organization_id')
      .eq('id', requesterUserId)
      .single()
    if (requesterErr || !requester || requester.organization_id !== organizationId) {
      return new Response('Forbidden', { status: 403, headers: getCorsHeaders(req) })
    }

    // Get client Supabase credentials from master database
    const { data: orgData, error: orgError } = await masterSupabase
      .from('saas_organizations')
      .select('owner_id')
      .eq('id', organizationId)
      .single()

    if (orgError || !orgData) {
      throw new Error(`Organization not found: ${orgError?.message || 'Unknown error'}`)
    }

    const { data: userData, error: userError } = await masterSupabase
      .from('saas_users')
      .select('supabase_url, supabase_key_encrypted')
      .eq('id', orgData.owner_id)
      .single()

    if (userError || !userData || !userData.supabase_url || !userData.supabase_key_encrypted) {
      throw new Error(`Client Supabase credentials not found: ${userError?.message || 'Missing credentials'}`)
    }

    // Decrypt the client's Supabase key (simple base64 decode for now)
    const clientSupabaseKey = atob(userData.supabase_key_encrypted)
    
    // Initialize client Supabase instance
    const clientSupabase = createClient(userData.supabase_url, clientSupabaseKey)

    // 1. Buscar workflows ativos que escutam este evento
    const { data: workflows, error: workflowsError } = await clientSupabase
      .from('n8n_workflows')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)

    if (workflowsError) {
      throw new Error(`Error fetching workflows: ${workflowsError.message}`)
    }

    console.log(`🔍 [AUTOMATION-TRIGGER] Found ${workflows?.length || 0} active workflows`)

    const results: any[] = []

    // 2. Para cada workflow, verificar se tem trigger para este evento
    for (const workflow of workflows || []) {
      const triggers = workflow.triggers || []
      const relevantTriggers = triggers.filter((trigger: any) => 
        trigger.event_type === eventType && trigger.is_active
      )

      if (relevantTriggers.length === 0) continue

      console.log(`🎯 [AUTOMATION-TRIGGER] Workflow "${workflow.name}" has ${relevantTriggers.length} relevant triggers`)

      // 3. Para cada trigger relevante, executar
      for (const trigger of relevantTriggers) {
        try {
          // Verificar condições do trigger
          if (trigger.conditions && !evaluateConditions(trigger.conditions, data)) {
            console.log(`⏭️ [AUTOMATION-TRIGGER] Trigger conditions not met, skipping`)
            continue
          }

          // Preparar payload baseado no data mapping
          const payload = await prepareWebhookPayload(workflow, data, eventType)

          // Executar webhook
          if (workflow.webhook_url) {
            const webhookResult = await executeWebhook(
              workflow.webhook_url, 
              payload, 
              workflow.webhook_method || 'POST',
              workflow.webhook_headers || {}
            )

            // Salvar execução no banco
            await saveExecution(clientSupabase, {
              workflow_id: workflow.id,
              trigger_event: eventType,
              trigger_data: data,
              webhook_payload: payload,
              webhook_response: webhookResult,
              execution_time_ms: webhookResult.executionTime,
              status: webhookResult.success ? 'success' : 'failed',
              error_message: webhookResult.success ? null : webhookResult.error,
              organization_id: organizationId
            })

            results.push({
              workflowId: workflow.id,
              workflowName: workflow.name,
              success: webhookResult.success,
              executionTime: webhookResult.executionTime,
              response: webhookResult
            })

            console.log(`${webhookResult.success ? '✅' : '❌'} [AUTOMATION-TRIGGER] Workflow "${workflow.name}" executed`)
          }
        } catch (triggerError: any) {
          console.error(`❌ [AUTOMATION-TRIGGER] Error in trigger execution:`, triggerError)
          
          // Salvar erro no banco
          await saveExecution(clientSupabase, {
            workflow_id: workflow.id,
            trigger_event: eventType,
            trigger_data: data,
            webhook_payload: {},
            execution_time_ms: 0,
            status: 'failed',
            error_message: triggerError.message,
            organization_id: organizationId
          })

          results.push({
            workflowId: workflow.id,
            workflowName: workflow.name,
            success: false,
            error: triggerError.message
          })
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        eventType,
        organizationId,
        workflowsTriggered: results.length,
        results,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ [AUTOMATION-TRIGGER] Error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
      }
    )
  }
})

// 🧮 Evaluate trigger conditions
function evaluateConditions(conditions: any, data: any): boolean {
  try {
    if (!conditions) return true

    const { field, operator, value, logical_operator = 'AND' } = conditions

    if (Array.isArray(conditions)) {
      // Multiple conditions
      const results = conditions.map((condition: any) => evaluateConditions(condition, data))
      return logical_operator === 'AND' ? results.every(r => r) : results.some(r => r)
    }

    if (!field || !operator) return true

    const fieldValue = getNestedValue(data, field)

    switch (operator) {
      case 'equals':
        return fieldValue === value
      case 'not_equals':
        return fieldValue !== value
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(value).toLowerCase())
      case 'greater_than':
        return Number(fieldValue) > Number(value)
      case 'less_than':
        return Number(fieldValue) < Number(value)
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue)
      case 'not_in':
        return Array.isArray(value) && !value.includes(fieldValue)
      case 'is_null':
        return fieldValue == null
      case 'is_not_null':
        return fieldValue != null
      default:
        return true
    }
  } catch (error) {
    console.error('Error evaluating conditions:', error)
    return false
  }
}

// 🗺️ Get nested value from object
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

// 📦 Prepare webhook payload
async function prepareWebhookPayload(workflow: any, triggerData: any, eventType: string) {
  const payload: any = {
    event_type: eventType,
    organization_id: workflow.organization_id,
    timestamp: new Date().toISOString(),
    workflow_id: workflow.id,
    workflow_name: workflow.name,
    trigger_data: triggerData
  }

  // Apply data mappings
  const dataMappings = workflow.data_mapping || []
  
  for (const mapping of dataMappings) {
    try {
      const mappedData = applyDataMapping(mapping, triggerData)
      payload[mapping.source_table] = mappedData
    } catch (mappingError) {
      console.error('Error applying data mapping:', mappingError)
    }
  }

  return payload
}

// 🗺️ Apply data mapping
function applyDataMapping(mapping: any, data: any) {
  const { source_fields, field_transformations = [] } = mapping
  
  let result: any = {}

  // Extract specified fields
  if (source_fields && Array.isArray(source_fields)) {
    for (const field of source_fields) {
      const value = getNestedValue(data, field)
      if (value !== undefined) {
        result[field] = value
      }
    }
  } else {
    result = { ...data }
  }

  // Apply transformations
  for (const transformation of field_transformations) {
    try {
      result = applyFieldTransformation(result, transformation)
    } catch (transformError) {
      console.error('Error applying transformation:', transformError)
    }
  }

  return result
}

// 🔄 Apply field transformation
function applyFieldTransformation(data: any, transformation: any) {
  const { source_field, destination_field, transformation_type, transformation_config } = transformation
  
  const sourceValue = data[source_field]
  let transformedValue = sourceValue

  switch (transformation_type) {
    case 'rename':
      data[destination_field] = sourceValue
      if (destination_field !== source_field) {
        delete data[source_field]
      }
      break
      
    case 'format':
      if (transformation_config?.format) {
        transformedValue = formatValue(sourceValue, transformation_config.format)
        data[destination_field || source_field] = transformedValue
      }
      break
      
    case 'calculate':
      if (transformation_config?.calculation) {
        transformedValue = evaluateCalculation(data, transformation_config.calculation)
        data[destination_field || source_field] = transformedValue
      }
      break
      
    case 'conditional':
      if (transformation_config?.condition) {
        const condition = transformation_config.condition
        const conditionMet = evaluateConditions(condition.if, data)
        transformedValue = conditionMet ? condition.then : condition.else
        data[destination_field || source_field] = transformedValue
      }
      break
  }

  return data
}

// 📅 Format value based on type
function formatValue(value: any, format: string): any {
  if (!value) return value

  switch (format) {
    case 'DD/MM/YYYY':
      return new Date(value).toLocaleDateString('pt-BR')
    case 'currency':
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    case 'phone':
      return value.replace(/\D/g, '') // Remove non-digits
    case 'uppercase':
      return String(value).toUpperCase()
    case 'lowercase':
      return String(value).toLowerCase()
    default:
      return value
  }
}

// 🧮 Evaluate calculation
function evaluateCalculation(data: any, calculation: string): any {
  try {
    // Simple calculation evaluator (extend as needed)
    // For security, only allow basic math operations
    const safeCalculation = calculation.replace(/[^a-zA-Z0-9+\-*/.() ]/g, '')
    
    // Replace field references with actual values
    let expression = safeCalculation
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`\\b${key}\\b`, 'g')
      expression = expression.replace(regex, String(data[key] || 0))
    })

    // Evaluate safely (in production, use a proper expression evaluator)
    return eval(expression)
  } catch (error) {
    console.error('Error evaluating calculation:', error)
    return 0
  }
}

// 🚀 Execute webhook
async function executeWebhook(url: string, payload: any, method: string, headers: any = {}) {
  const startTime = Date.now()
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TomikCRM-Automation/1.0',
        ...headers
      },
      body: method !== 'GET' ? JSON.stringify(payload) : undefined
    })

    const executionTime = Date.now() - startTime
    const responseData = await response.json().catch(() => ({}))

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: responseData,
      executionTime,
      headers: Object.fromEntries(response.headers.entries())
    }
  } catch (error: any) {
    const executionTime = Date.now() - startTime
    
    return {
      success: false,
      error: error.message,
      executionTime,
      status: 0,
      statusText: 'Network Error'
    }
  }
}

// 💾 Save execution to database
async function saveExecution(supabase: any, execution: any) {
  try {
    const { error } = await supabase
      .from('automation_executions')
      .insert([{
        ...execution,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString()
      }])

    if (error) {
      console.error('Error saving execution:', error)
    }
  } catch (error) {
    console.error('Error saving execution:', error)
  }
}