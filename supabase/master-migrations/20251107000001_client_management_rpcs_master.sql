-- =====================================================
-- CLIENT MANAGEMENT RPCs - MASTER SUPABASE
-- =====================================================
-- RPCs com autenticação automática via auth.uid()
-- Não precisa passar user_id - pega do JWT automaticamente!
-- =====================================================

-- =====================================================
-- CLIENTS - CRUD simplificado
-- =====================================================

-- Criar/Atualizar cliente
CREATE OR REPLACE FUNCTION automation_client_upsert(
  p_id UUID DEFAULT NULL,
  p_company_name TEXT DEFAULT NULL,
  p_contact_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'active',
  p_industry TEXT DEFAULT NULL,
  p_company_size TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS automation_clients
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result automation_clients;
BEGIN
  INSERT INTO automation_clients (
    id, user_id, company_name, contact_name, email, phone, 
    status, industry, company_size, website, notes, updated_at
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), 
    auth.uid(), -- Pega automaticamente do JWT!
    p_company_name, p_contact_name, p_email, p_phone, 
    p_status, p_industry, p_company_size, p_website, p_notes, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    company_name = COALESCE(EXCLUDED.company_name, automation_clients.company_name),
    contact_name = COALESCE(EXCLUDED.contact_name, automation_clients.contact_name),
    email = COALESCE(EXCLUDED.email, automation_clients.email),
    phone = COALESCE(EXCLUDED.phone, automation_clients.phone),
    status = COALESCE(EXCLUDED.status, automation_clients.status),
    industry = COALESCE(EXCLUDED.industry, automation_clients.industry),
    company_size = COALESCE(EXCLUDED.company_size, automation_clients.company_size),
    website = COALESCE(EXCLUDED.website, automation_clients.website),
    notes = COALESCE(EXCLUDED.notes, automation_clients.notes),
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Listar clientes
CREATE OR REPLACE FUNCTION automation_clients_list()
RETURNS SETOF automation_clients
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM automation_clients
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC;
END;
$$;

-- Deletar cliente
CREATE OR REPLACE FUNCTION automation_client_delete(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM automation_clients
  WHERE id = p_client_id AND user_id = auth.uid();
  RETURN FOUND;
END;
$$;

-- =====================================================
-- CONTRACTS
-- =====================================================

CREATE OR REPLACE FUNCTION automation_contract_upsert(
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
  INSERT INTO automation_contracts (
    id, user_id, automation_client_id, contract_name, contract_number,
    setup_value, recurring_value, recurring_period, included_tools,
    start_date, end_date, renewal_date, status, terms, notes, updated_at
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), auth.uid(), p_automation_client_id,
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

CREATE OR REPLACE FUNCTION automation_contracts_list()
RETURNS SETOF automation_contracts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM automation_contracts
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION automation_contract_delete(p_contract_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM automation_contracts
  WHERE id = p_contract_id AND user_id = auth.uid();
  RETURN FOUND;
END;
$$;

-- =====================================================
-- PROCESSES
-- =====================================================

CREATE OR REPLACE FUNCTION automation_process_upsert(
  p_id UUID DEFAULT NULL,
  p_automation_client_id UUID DEFAULT NULL,
  p_process_type TEXT DEFAULT 'onboarding',
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'pending',
  p_progress INTEGER DEFAULT 0,
  p_stage TEXT DEFAULT 'onboarding',
  p_position INTEGER DEFAULT 0,
  p_cover_color TEXT DEFAULT NULL,
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
  INSERT INTO automation_processes (
    id, user_id, automation_client_id, process_type, title, description,
    status, progress, stage, position, cover_color, start_date, due_date, 
    priority, checklist, updated_at
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), auth.uid(), p_automation_client_id,
    p_process_type, p_title, p_description, p_status, p_progress, p_stage,
    p_position, p_cover_color, p_start_date, p_due_date, p_priority, p_checklist, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    automation_client_id = COALESCE(EXCLUDED.automation_client_id, automation_processes.automation_client_id),
    title = COALESCE(EXCLUDED.title, automation_processes.title),
    description = COALESCE(EXCLUDED.description, automation_processes.description),
    status = COALESCE(EXCLUDED.status, automation_processes.status),
    progress = COALESCE(EXCLUDED.progress, automation_processes.progress),
    stage = COALESCE(EXCLUDED.stage, automation_processes.stage),
    cover_color = COALESCE(EXCLUDED.cover_color, automation_processes.cover_color),
    start_date = COALESCE(EXCLUDED.start_date, automation_processes.start_date),
    due_date = COALESCE(EXCLUDED.due_date, automation_processes.due_date),
    priority = COALESCE(EXCLUDED.priority, automation_processes.priority),
    checklist = COALESCE(EXCLUDED.checklist, automation_processes.checklist),
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION automation_processes_list()
RETURNS SETOF automation_processes
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM automation_processes
  WHERE user_id = auth.uid()
  ORDER BY stage, position, created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION automation_process_delete(p_process_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM automation_processes
  WHERE id = p_process_id AND user_id = auth.uid();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION automation_process_move_stage(
  p_process_id UUID,
  p_new_stage TEXT,
  p_new_position INTEGER
)
RETURNS automation_processes
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result automation_processes;
BEGIN
  UPDATE automation_processes
  SET 
    stage = p_new_stage,
    position = p_new_position,
    updated_at = NOW()
  WHERE id = p_process_id AND user_id = auth.uid()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- BRIEFINGS, TRANSCRIÇÕES, FEEDBACKS, DOCUMENTOS, APPOINTMENTS
-- =====================================================

CREATE OR REPLACE FUNCTION automation_briefing_upsert(
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
  INSERT INTO automation_briefings (id, user_id, automation_client_id, title, content, briefing_type, tags, indexed_for_rag, updated_at)
  VALUES (COALESCE(p_id, gen_random_uuid()), auth.uid(), p_automation_client_id, p_title, p_content, p_briefing_type, p_tags, p_indexed_for_rag, NOW())
  ON CONFLICT (id) DO UPDATE SET
    title = COALESCE(EXCLUDED.title, automation_briefings.title),
    content = COALESCE(EXCLUDED.content, automation_briefings.content),
    tags = COALESCE(EXCLUDED.tags, automation_briefings.tags),
    indexed_for_rag = COALESCE(EXCLUDED.indexed_for_rag, automation_briefings.indexed_for_rag),
    updated_at = NOW()
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION automation_briefings_list()
RETURNS SETOF automation_briefings
LANGUAGE plpgsql SECURITY DEFINER
AS $$ BEGIN RETURN QUERY SELECT * FROM automation_briefings WHERE user_id = auth.uid() ORDER BY created_at DESC; END; $$;

CREATE OR REPLACE FUNCTION automation_transcription_upsert(
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
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_result automation_meeting_transcriptions;
BEGIN
  INSERT INTO automation_meeting_transcriptions (id, user_id, automation_client_id, meeting_title, meeting_date, duration_minutes, participants, transcription, summary, action_items, key_points, indexed_for_rag, updated_at)
  VALUES (COALESCE(p_id, gen_random_uuid()), auth.uid(), p_automation_client_id, p_meeting_title, p_meeting_date, p_duration_minutes, p_participants, p_transcription, p_summary, p_action_items, p_key_points, p_indexed_for_rag, NOW())
  ON CONFLICT (id) DO UPDATE SET meeting_title = COALESCE(EXCLUDED.meeting_title, automation_meeting_transcriptions.meeting_title), updated_at = NOW()
  RETURNING * INTO v_result;
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION automation_transcriptions_list()
RETURNS SETOF automation_meeting_transcriptions
LANGUAGE plpgsql SECURITY DEFINER
AS $$ BEGIN RETURN QUERY SELECT * FROM automation_meeting_transcriptions WHERE user_id = auth.uid() ORDER BY meeting_date DESC NULLS LAST; END; $$;

CREATE OR REPLACE FUNCTION automation_feedback_upsert(
  p_id UUID DEFAULT NULL,
  p_automation_client_id UUID DEFAULT NULL,
  p_feedback_type TEXT DEFAULT 'general',
  p_rating INTEGER DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_content TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'pending'
)
RETURNS automation_client_feedbacks
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_result automation_client_feedbacks;
BEGIN
  INSERT INTO automation_client_feedbacks (id, user_id, automation_client_id, feedback_type, rating, title, content, status, updated_at)
  VALUES (COALESCE(p_id, gen_random_uuid()), auth.uid(), p_automation_client_id, p_feedback_type, p_rating, p_title, p_content, p_status, NOW())
  ON CONFLICT (id) DO UPDATE SET content = COALESCE(EXCLUDED.content, automation_client_feedbacks.content), updated_at = NOW()
  RETURNING * INTO v_result;
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION automation_feedbacks_list()
RETURNS SETOF automation_client_feedbacks
LANGUAGE plpgsql SECURITY DEFINER
AS $$ BEGIN RETURN QUERY SELECT * FROM automation_client_feedbacks WHERE user_id = auth.uid() ORDER BY created_at DESC; END; $$;

CREATE OR REPLACE FUNCTION automation_document_upsert(
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
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_result automation_client_documents;
BEGIN
  INSERT INTO automation_client_documents (id, user_id, automation_client_id, document_name, document_type, file_url, tags, notes, integrated_to_products, integrated_to_leads, integrated_to_qna, integrated_to_kb, updated_at)
  VALUES (COALESCE(p_id, gen_random_uuid()), auth.uid(), p_automation_client_id, p_document_name, p_document_type, p_file_url, p_tags, p_notes, p_integrated_to_products, p_integrated_to_leads, p_integrated_to_qna, p_integrated_to_kb, NOW())
  ON CONFLICT (id) DO UPDATE SET document_name = COALESCE(EXCLUDED.document_name, automation_client_documents.document_name), updated_at = NOW()
  RETURNING * INTO v_result;
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION automation_documents_list()
RETURNS SETOF automation_client_documents
LANGUAGE plpgsql SECURITY DEFINER
AS $$ BEGIN RETURN QUERY SELECT * FROM automation_client_documents WHERE user_id = auth.uid() ORDER BY created_at DESC; END; $$;

CREATE OR REPLACE FUNCTION automation_appointment_upsert(
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
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_result automation_client_appointments;
BEGIN
  INSERT INTO automation_client_appointments (id, user_id, automation_client_id, title, description, appointment_type, start_datetime, end_datetime, location, meeting_url, participants, status, notes, updated_at)
  VALUES (COALESCE(p_id, gen_random_uuid()), auth.uid(), p_automation_client_id, p_title, p_description, p_appointment_type, p_start_datetime, p_end_datetime, p_location, p_meeting_url, p_participants, p_status, p_notes, NOW())
  ON CONFLICT (id) DO UPDATE SET title = COALESCE(EXCLUDED.title, automation_client_appointments.title), updated_at = NOW()
  RETURNING * INTO v_result;
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION automation_appointments_list()
RETURNS SETOF automation_client_appointments
LANGUAGE plpgsql SECURITY DEFINER
AS $$ BEGIN RETURN QUERY SELECT * FROM automation_client_appointments WHERE user_id = auth.uid() ORDER BY start_datetime DESC; END; $$;

CREATE OR REPLACE FUNCTION automation_appointment_delete(p_appointment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$ BEGIN DELETE FROM automation_client_appointments WHERE id = p_appointment_id AND user_id = auth.uid(); RETURN FOUND; END; $$;

-- =====================================================
-- GRANT EXECUTE
-- =====================================================

GRANT EXECUTE ON FUNCTION automation_client_upsert TO authenticated;
GRANT EXECUTE ON FUNCTION automation_clients_list TO authenticated;
GRANT EXECUTE ON FUNCTION automation_client_delete TO authenticated;
GRANT EXECUTE ON FUNCTION automation_contract_upsert TO authenticated;
GRANT EXECUTE ON FUNCTION automation_contracts_list TO authenticated;
GRANT EXECUTE ON FUNCTION automation_contract_delete TO authenticated;
GRANT EXECUTE ON FUNCTION automation_process_upsert TO authenticated;
GRANT EXECUTE ON FUNCTION automation_processes_list TO authenticated;
GRANT EXECUTE ON FUNCTION automation_process_delete TO authenticated;
GRANT EXECUTE ON FUNCTION automation_process_move_stage TO authenticated;
GRANT EXECUTE ON FUNCTION automation_briefing_upsert TO authenticated;
GRANT EXECUTE ON FUNCTION automation_briefings_list TO authenticated;
GRANT EXECUTE ON FUNCTION automation_transcription_upsert TO authenticated;
GRANT EXECUTE ON FUNCTION automation_transcriptions_list TO authenticated;
GRANT EXECUTE ON FUNCTION automation_feedback_upsert TO authenticated;
GRANT EXECUTE ON FUNCTION automation_feedbacks_list TO authenticated;
GRANT EXECUTE ON FUNCTION automation_document_upsert TO authenticated;
GRANT EXECUTE ON FUNCTION automation_documents_list TO authenticated;
GRANT EXECUTE ON FUNCTION automation_appointment_upsert TO authenticated;
GRANT EXECUTE ON FUNCTION automation_appointments_list TO authenticated;
GRANT EXECUTE ON FUNCTION automation_appointment_delete TO authenticated;

-- =====================================================
-- FIM
-- =====================================================
-- Agora todas as operações usam auth.uid() automaticamente!
-- Não precisa passar user_id - seguro por padrão!
-- =====================================================

