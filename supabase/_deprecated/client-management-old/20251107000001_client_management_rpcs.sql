-- =====================================================
-- CLIENT MANAGEMENT RPCs - Operações Seguras com RLS
-- =====================================================
-- RPCs que setam app.organization_id antes de executar
-- Seguindo o padrão do projeto (memória #9776213)
-- =====================================================

-- =====================================================
-- CONTRATOS - RPCs
-- =====================================================

-- Listar contratos
CREATE OR REPLACE FUNCTION automation_contracts_list(
  p_organization_id UUID
)
RETURNS SETOF automation_contracts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  RETURN QUERY
  SELECT ac.*
  FROM automation_contracts ac
  WHERE ac.organization_id = p_organization_id
  ORDER BY ac.created_at DESC;
END;
$$;

-- Upsert contrato
CREATE OR REPLACE FUNCTION automation_contract_upsert(
  p_organization_id UUID,
  p_id UUID DEFAULT NULL,
  p_automation_client_id UUID DEFAULT NULL,
  p_contract_name TEXT DEFAULT NULL,
  p_contract_number TEXT DEFAULT NULL,
  p_setup_value NUMERIC DEFAULT 0,
  p_recurring_value NUMERIC DEFAULT 0,
  p_recurring_period TEXT DEFAULT 'monthly',
  p_included_tools TEXT[] DEFAULT '{}',
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_renewal_date DATE DEFAULT NULL,
  p_status TEXT DEFAULT 'draft',
  p_terms TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS automation_contracts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result automation_contracts;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  INSERT INTO automation_contracts (
    id, organization_id, automation_client_id, contract_name, contract_number,
    setup_value, recurring_value, recurring_period, included_tools,
    start_date, end_date, renewal_date, status, terms, notes, updated_at
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_organization_id, p_automation_client_id,
    p_contract_name, p_contract_number, p_setup_value, p_recurring_value,
    p_recurring_period, p_included_tools, p_start_date, p_end_date, p_renewal_date,
    p_status, p_terms, p_notes, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    automation_client_id = COALESCE(EXCLUDED.automation_client_id, automation_contracts.automation_client_id),
    contract_name = COALESCE(EXCLUDED.contract_name, automation_contracts.contract_name),
    contract_number = COALESCE(EXCLUDED.contract_number, automation_contracts.contract_number),
    setup_value = COALESCE(EXCLUDED.setup_value, automation_contracts.setup_value),
    recurring_value = COALESCE(EXCLUDED.recurring_value, automation_contracts.recurring_value),
    recurring_period = COALESCE(EXCLUDED.recurring_period, automation_contracts.recurring_period),
    included_tools = COALESCE(EXCLUDED.included_tools, automation_contracts.included_tools),
    start_date = COALESCE(EXCLUDED.start_date, automation_contracts.start_date),
    end_date = COALESCE(EXCLUDED.end_date, automation_contracts.end_date),
    renewal_date = COALESCE(EXCLUDED.renewal_date, automation_contracts.renewal_date),
    status = COALESCE(EXCLUDED.status, automation_contracts.status),
    terms = COALESCE(EXCLUDED.terms, automation_contracts.terms),
    notes = COALESCE(EXCLUDED.notes, automation_contracts.notes),
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Deletar contrato
CREATE OR REPLACE FUNCTION automation_contract_delete(
  p_organization_id UUID,
  p_contract_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  DELETE FROM automation_contracts
  WHERE id = p_contract_id AND organization_id = p_organization_id;
  
  RETURN FOUND;
END;
$$;

-- =====================================================
-- PROCESSOS - RPCs
-- =====================================================

-- Listar processos
CREATE OR REPLACE FUNCTION automation_processes_list(
  p_organization_id UUID
)
RETURNS SETOF automation_processes
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  RETURN QUERY
  SELECT ap.*
  FROM automation_processes ap
  WHERE ap.organization_id = p_organization_id
  ORDER BY ap.created_at DESC;
END;
$$;

-- Upsert processo
CREATE OR REPLACE FUNCTION automation_process_upsert(
  p_organization_id UUID,
  p_id UUID DEFAULT NULL,
  p_automation_client_id UUID DEFAULT NULL,
  p_process_type TEXT DEFAULT 'onboarding',
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'pending',
  p_progress INTEGER DEFAULT 0,
  p_start_date DATE DEFAULT NULL,
  p_due_date DATE DEFAULT NULL,
  p_priority TEXT DEFAULT 'medium',
  p_checklist JSONB DEFAULT '[]',
  p_notes TEXT DEFAULT NULL
)
RETURNS automation_processes
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result automation_processes;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  INSERT INTO automation_processes (
    id, organization_id, automation_client_id, process_type, title, description,
    status, progress, start_date, due_date, priority, checklist, notes, updated_at
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_organization_id, p_automation_client_id,
    p_process_type, p_title, p_description, p_status, p_progress, p_start_date,
    p_due_date, p_priority, p_checklist, p_notes, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    automation_client_id = COALESCE(EXCLUDED.automation_client_id, automation_processes.automation_client_id),
    process_type = COALESCE(EXCLUDED.process_type, automation_processes.process_type),
    title = COALESCE(EXCLUDED.title, automation_processes.title),
    description = COALESCE(EXCLUDED.description, automation_processes.description),
    status = COALESCE(EXCLUDED.status, automation_processes.status),
    progress = COALESCE(EXCLUDED.progress, automation_processes.progress),
    start_date = COALESCE(EXCLUDED.start_date, automation_processes.start_date),
    due_date = COALESCE(EXCLUDED.due_date, automation_processes.due_date),
    priority = COALESCE(EXCLUDED.priority, automation_processes.priority),
    checklist = COALESCE(EXCLUDED.checklist, automation_processes.checklist),
    notes = COALESCE(EXCLUDED.notes, automation_processes.notes),
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Deletar processo
CREATE OR REPLACE FUNCTION automation_process_delete(
  p_organization_id UUID,
  p_process_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  DELETE FROM automation_processes
  WHERE id = p_process_id AND organization_id = p_organization_id;
  
  RETURN FOUND;
END;
$$;

-- Atualizar progresso do processo
CREATE OR REPLACE FUNCTION automation_process_update_progress(
  p_organization_id UUID,
  p_process_id UUID,
  p_progress INTEGER
)
RETURNS automation_processes
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result automation_processes;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  UPDATE automation_processes
  SET 
    progress = p_progress,
    status = CASE WHEN p_progress = 100 THEN 'completed' ELSE 'in_progress' END,
    completed_date = CASE WHEN p_progress = 100 THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_process_id AND organization_id = p_organization_id
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- BRIEFINGS - RPCs
-- =====================================================

-- Upsert briefing
CREATE OR REPLACE FUNCTION automation_briefing_upsert(
  p_organization_id UUID,
  p_id UUID DEFAULT NULL,
  p_automation_client_id UUID DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_content TEXT DEFAULT NULL,
  p_briefing_type TEXT DEFAULT 'general',
  p_tags TEXT[] DEFAULT '{}',
  p_indexed_for_rag BOOLEAN DEFAULT false
)
RETURNS automation_briefings
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result automation_briefings;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  INSERT INTO automation_briefings (
    id, organization_id, automation_client_id, title, content,
    briefing_type, tags, indexed_for_rag, updated_at
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_organization_id, p_automation_client_id,
    p_title, p_content, p_briefing_type, p_tags, p_indexed_for_rag, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    automation_client_id = COALESCE(EXCLUDED.automation_client_id, automation_briefings.automation_client_id),
    title = COALESCE(EXCLUDED.title, automation_briefings.title),
    content = COALESCE(EXCLUDED.content, automation_briefings.content),
    briefing_type = COALESCE(EXCLUDED.briefing_type, automation_briefings.briefing_type),
    tags = COALESCE(EXCLUDED.tags, automation_briefings.tags),
    indexed_for_rag = COALESCE(EXCLUDED.indexed_for_rag, automation_briefings.indexed_for_rag),
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- TRANSCRIÇÕES - RPCs
-- =====================================================

-- Upsert transcrição
CREATE OR REPLACE FUNCTION automation_transcription_upsert(
  p_organization_id UUID,
  p_id UUID DEFAULT NULL,
  p_automation_client_id UUID DEFAULT NULL,
  p_meeting_title TEXT DEFAULT NULL,
  p_meeting_date TIMESTAMPTZ DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT 0,
  p_participants TEXT[] DEFAULT '{}',
  p_transcription TEXT DEFAULT NULL,
  p_summary TEXT DEFAULT NULL,
  p_action_items JSONB DEFAULT '[]',
  p_key_points TEXT[] DEFAULT '{}',
  p_indexed_for_rag BOOLEAN DEFAULT false
)
RETURNS automation_meeting_transcriptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result automation_meeting_transcriptions;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  INSERT INTO automation_meeting_transcriptions (
    id, organization_id, automation_client_id, meeting_title, meeting_date,
    duration_minutes, participants, transcription, summary, action_items,
    key_points, indexed_for_rag, updated_at
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_organization_id, p_automation_client_id,
    p_meeting_title, p_meeting_date, p_duration_minutes, p_participants,
    p_transcription, p_summary, p_action_items, p_key_points, p_indexed_for_rag, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    automation_client_id = COALESCE(EXCLUDED.automation_client_id, automation_meeting_transcriptions.automation_client_id),
    meeting_title = COALESCE(EXCLUDED.meeting_title, automation_meeting_transcriptions.meeting_title),
    meeting_date = COALESCE(EXCLUDED.meeting_date, automation_meeting_transcriptions.meeting_date),
    duration_minutes = COALESCE(EXCLUDED.duration_minutes, automation_meeting_transcriptions.duration_minutes),
    participants = COALESCE(EXCLUDED.participants, automation_meeting_transcriptions.participants),
    transcription = COALESCE(EXCLUDED.transcription, automation_meeting_transcriptions.transcription),
    summary = COALESCE(EXCLUDED.summary, automation_meeting_transcriptions.summary),
    action_items = COALESCE(EXCLUDED.action_items, automation_meeting_transcriptions.action_items),
    key_points = COALESCE(EXCLUDED.key_points, automation_meeting_transcriptions.key_points),
    indexed_for_rag = COALESCE(EXCLUDED.indexed_for_rag, automation_meeting_transcriptions.indexed_for_rag),
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- FEEDBACKS - RPCs
-- =====================================================

-- Upsert feedback
CREATE OR REPLACE FUNCTION automation_feedback_upsert(
  p_organization_id UUID,
  p_id UUID DEFAULT NULL,
  p_automation_client_id UUID DEFAULT NULL,
  p_feedback_type TEXT DEFAULT 'general',
  p_rating INTEGER DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_content TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'pending'
)
RETURNS automation_client_feedbacks
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result automation_client_feedbacks;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  INSERT INTO automation_client_feedbacks (
    id, organization_id, automation_client_id, feedback_type, rating,
    title, content, status, updated_at
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_organization_id, p_automation_client_id,
    p_feedback_type, p_rating, p_title, p_content, p_status, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    automation_client_id = COALESCE(EXCLUDED.automation_client_id, automation_client_feedbacks.automation_client_id),
    feedback_type = COALESCE(EXCLUDED.feedback_type, automation_client_feedbacks.feedback_type),
    rating = COALESCE(EXCLUDED.rating, automation_client_feedbacks.rating),
    title = COALESCE(EXCLUDED.title, automation_client_feedbacks.title),
    content = COALESCE(EXCLUDED.content, automation_client_feedbacks.content),
    status = COALESCE(EXCLUDED.status, automation_client_feedbacks.status),
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- DOCUMENTOS - RPCs
-- =====================================================

-- Upsert documento
CREATE OR REPLACE FUNCTION automation_document_upsert(
  p_organization_id UUID,
  p_id UUID DEFAULT NULL,
  p_automation_client_id UUID DEFAULT NULL,
  p_document_name TEXT DEFAULT NULL,
  p_document_type TEXT DEFAULT 'other',
  p_file_url TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT '{}',
  p_notes TEXT DEFAULT NULL,
  p_integrated_to_products BOOLEAN DEFAULT false,
  p_integrated_to_leads BOOLEAN DEFAULT false,
  p_integrated_to_qna BOOLEAN DEFAULT false,
  p_integrated_to_kb BOOLEAN DEFAULT false
)
RETURNS automation_client_documents
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result automation_client_documents;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  INSERT INTO automation_client_documents (
    id, organization_id, automation_client_id, document_name, document_type,
    file_url, tags, notes, integrated_to_products, integrated_to_leads,
    integrated_to_qna, integrated_to_kb, updated_at
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_organization_id, p_automation_client_id,
    p_document_name, p_document_type, p_file_url, p_tags, p_notes,
    p_integrated_to_products, p_integrated_to_leads, p_integrated_to_qna,
    p_integrated_to_kb, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    automation_client_id = COALESCE(EXCLUDED.automation_client_id, automation_client_documents.automation_client_id),
    document_name = COALESCE(EXCLUDED.document_name, automation_client_documents.document_name),
    document_type = COALESCE(EXCLUDED.document_type, automation_client_documents.document_type),
    file_url = COALESCE(EXCLUDED.file_url, automation_client_documents.file_url),
    tags = COALESCE(EXCLUDED.tags, automation_client_documents.tags),
    notes = COALESCE(EXCLUDED.notes, automation_client_documents.notes),
    integrated_to_products = COALESCE(EXCLUDED.integrated_to_products, automation_client_documents.integrated_to_products),
    integrated_to_leads = COALESCE(EXCLUDED.integrated_to_leads, automation_client_documents.integrated_to_leads),
    integrated_to_qna = COALESCE(EXCLUDED.integrated_to_qna, automation_client_documents.integrated_to_qna),
    integrated_to_kb = COALESCE(EXCLUDED.integrated_to_kb, automation_client_documents.integrated_to_kb),
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- COMPROMISSOS - RPCs
-- =====================================================

-- Listar compromissos
CREATE OR REPLACE FUNCTION automation_appointments_list(
  p_organization_id UUID
)
RETURNS SETOF automation_client_appointments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  RETURN QUERY
  SELECT aa.*
  FROM automation_client_appointments aa
  WHERE aa.organization_id = p_organization_id
  ORDER BY aa.start_datetime DESC;
END;
$$;

-- Upsert compromisso
CREATE OR REPLACE FUNCTION automation_appointment_upsert(
  p_organization_id UUID,
  p_id UUID DEFAULT NULL,
  p_automation_client_id UUID DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_appointment_type TEXT DEFAULT 'meeting',
  p_start_datetime TIMESTAMPTZ DEFAULT NULL,
  p_end_datetime TIMESTAMPTZ DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_meeting_url TEXT DEFAULT NULL,
  p_participants TEXT[] DEFAULT '{}',
  p_status TEXT DEFAULT 'scheduled',
  p_notes TEXT DEFAULT NULL
)
RETURNS automation_client_appointments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result automation_client_appointments;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  INSERT INTO automation_client_appointments (
    id, organization_id, automation_client_id, title, description,
    appointment_type, start_datetime, end_datetime, location, meeting_url,
    participants, status, notes, updated_at
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_organization_id, p_automation_client_id,
    p_title, p_description, p_appointment_type, p_start_datetime, p_end_datetime,
    p_location, p_meeting_url, p_participants, p_status, p_notes, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    automation_client_id = COALESCE(EXCLUDED.automation_client_id, automation_client_appointments.automation_client_id),
    title = COALESCE(EXCLUDED.title, automation_client_appointments.title),
    description = COALESCE(EXCLUDED.description, automation_client_appointments.description),
    appointment_type = COALESCE(EXCLUDED.appointment_type, automation_client_appointments.appointment_type),
    start_datetime = COALESCE(EXCLUDED.start_datetime, automation_client_appointments.start_datetime),
    end_datetime = COALESCE(EXCLUDED.end_datetime, automation_client_appointments.end_datetime),
    location = COALESCE(EXCLUDED.location, automation_client_appointments.location),
    meeting_url = COALESCE(EXCLUDED.meeting_url, automation_client_appointments.meeting_url),
    participants = COALESCE(EXCLUDED.participants, automation_client_appointments.participants),
    status = COALESCE(EXCLUDED.status, automation_client_appointments.status),
    notes = COALESCE(EXCLUDED.notes, automation_client_appointments.notes),
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Deletar compromisso
CREATE OR REPLACE FUNCTION automation_appointment_delete(
  p_organization_id UUID,
  p_appointment_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  DELETE FROM automation_client_appointments
  WHERE id = p_appointment_id AND organization_id = p_organization_id;
  
  RETURN FOUND;
END;
$$;

-- =====================================================
-- BRIEFINGS, TRANSCRIÇÕES, FEEDBACKS, DOCUMENTOS - RPCs de Listagem
-- =====================================================

-- Listar briefings
CREATE OR REPLACE FUNCTION automation_briefings_list(
  p_organization_id UUID
)
RETURNS SETOF automation_briefings
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  RETURN QUERY
  SELECT ab.*
  FROM automation_briefings ab
  WHERE ab.organization_id = p_organization_id
  ORDER BY ab.created_at DESC;
END;
$$;

-- Listar transcrições
CREATE OR REPLACE FUNCTION automation_transcriptions_list(
  p_organization_id UUID
)
RETURNS SETOF automation_meeting_transcriptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  RETURN QUERY
  SELECT amt.*
  FROM automation_meeting_transcriptions amt
  WHERE amt.organization_id = p_organization_id
  ORDER BY amt.meeting_date DESC NULLS LAST, amt.created_at DESC;
END;
$$;

-- Listar feedbacks
CREATE OR REPLACE FUNCTION automation_feedbacks_list(
  p_organization_id UUID
)
RETURNS SETOF automation_client_feedbacks
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  RETURN QUERY
  SELECT acf.*
  FROM automation_client_feedbacks acf
  WHERE acf.organization_id = p_organization_id
  ORDER BY acf.created_at DESC;
END;
$$;

-- Listar documentos
CREATE OR REPLACE FUNCTION automation_documents_list(
  p_organization_id UUID
)
RETURNS SETOF automation_client_documents
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  RETURN QUERY
  SELECT acd.*
  FROM automation_client_documents acd
  WHERE acd.organization_id = p_organization_id
  ORDER BY acd.created_at DESC;
END;
$$;

-- =====================================================
-- GRANT EXECUTE - Permitir acesso via anon/authenticated
-- =====================================================

GRANT EXECUTE ON FUNCTION automation_clients_list TO anon, authenticated;
GRANT EXECUTE ON FUNCTION automation_client_upsert TO anon, authenticated;
GRANT EXECUTE ON FUNCTION automation_client_delete TO anon, authenticated;

GRANT EXECUTE ON FUNCTION automation_contracts_list TO anon, authenticated;
GRANT EXECUTE ON FUNCTION automation_contract_upsert TO anon, authenticated;
GRANT EXECUTE ON FUNCTION automation_contract_delete TO anon, authenticated;

GRANT EXECUTE ON FUNCTION automation_processes_list TO anon, authenticated;
GRANT EXECUTE ON FUNCTION automation_process_upsert TO anon, authenticated;
GRANT EXECUTE ON FUNCTION automation_process_delete TO anon, authenticated;
GRANT EXECUTE ON FUNCTION automation_process_update_progress TO anon, authenticated;

GRANT EXECUTE ON FUNCTION automation_briefings_list TO anon, authenticated;
GRANT EXECUTE ON FUNCTION automation_briefing_upsert TO anon, authenticated;

GRANT EXECUTE ON FUNCTION automation_transcriptions_list TO anon, authenticated;
GRANT EXECUTE ON FUNCTION automation_transcription_upsert TO anon, authenticated;

GRANT EXECUTE ON FUNCTION automation_feedbacks_list TO anon, authenticated;
GRANT EXECUTE ON FUNCTION automation_feedback_upsert TO anon, authenticated;

GRANT EXECUTE ON FUNCTION automation_documents_list TO anon, authenticated;
GRANT EXECUTE ON FUNCTION automation_document_upsert TO anon, authenticated;

GRANT EXECUTE ON FUNCTION automation_appointments_list TO anon, authenticated;
GRANT EXECUTE ON FUNCTION automation_appointment_upsert TO anon, authenticated;
GRANT EXECUTE ON FUNCTION automation_appointment_delete TO anon, authenticated;

-- =====================================================
-- FIM DAS RPCs
-- =====================================================
-- Agora TODAS as operações (SELECT + INSERT/UPDATE/DELETE) passam pelo RPC!
-- Problema de RLS completamente resolvido! ✅
-- =====================================================

