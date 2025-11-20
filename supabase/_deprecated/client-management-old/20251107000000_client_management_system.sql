-- =====================================================
-- CLIENT MANAGEMENT SYSTEM - Gestão de Clientes de Automação
-- =====================================================
-- Sistema completo para gestores de automação gerenciarem seus clientes
-- Inspirado nos princípios de Steve Jobs: simplicidade, integração e excelência
-- =====================================================

-- =====================================================
-- 1. AUTOMATION CLIENTS - Clientes de Automação
-- =====================================================
CREATE TABLE IF NOT EXISTS public.automation_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  
  -- Informações básicas
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'onboarding', 'paused', 'churned')),
  
  -- Relacionamentos
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL, -- Integração com CRM
  
  -- Campos customizados
  industry TEXT,
  company_size TEXT,
  website TEXT,
  notes TEXT,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  
  -- Índices para performance
  CONSTRAINT automation_clients_org_company_unique UNIQUE(organization_id, company_name)
);

CREATE INDEX idx_automation_clients_org ON public.automation_clients(organization_id);
CREATE INDEX idx_automation_clients_status ON public.automation_clients(status);
CREATE INDEX idx_automation_clients_client ON public.automation_clients(client_id);

-- RLS Policies
ALTER TABLE public.automation_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_clients_select_policy ON public.automation_clients
  FOR SELECT USING (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_clients_insert_policy ON public.automation_clients
  FOR INSERT WITH CHECK (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_clients_update_policy ON public.automation_clients
  FOR UPDATE USING (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_clients_delete_policy ON public.automation_clients
  FOR DELETE USING (organization_id::text = current_setting('app.organization_id', true));

-- =====================================================
-- 2. AUTOMATION CONTRACTS - Contratos
-- =====================================================
CREATE TABLE IF NOT EXISTS public.automation_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  automation_client_id UUID NOT NULL REFERENCES public.automation_clients(id) ON DELETE CASCADE,
  
  -- Informações do contrato
  contract_name TEXT NOT NULL,
  contract_number TEXT,
  
  -- Valores
  setup_value NUMERIC(12,2) DEFAULT 0,
  recurring_value NUMERIC(12,2) DEFAULT 0,
  recurring_period TEXT DEFAULT 'monthly' CHECK (recurring_period IN ('monthly', 'quarterly', 'annual')),
  
  -- Ferramentas incluídas (array de strings)
  included_tools TEXT[] DEFAULT '{}',
  
  -- Datas
  start_date DATE,
  end_date DATE,
  renewal_date DATE,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'expired', 'cancelled')),
  
  -- Integração com Financeiro
  financial_record_id UUID, -- Link para registros financeiros
  
  -- Anexos e observações
  contract_file_url TEXT,
  terms TEXT,
  notes TEXT,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_automation_contracts_org ON public.automation_contracts(organization_id);
CREATE INDEX idx_automation_contracts_client ON public.automation_contracts(automation_client_id);
CREATE INDEX idx_automation_contracts_status ON public.automation_contracts(status);

-- RLS Policies
ALTER TABLE public.automation_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_contracts_select_policy ON public.automation_contracts
  FOR SELECT USING (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_contracts_insert_policy ON public.automation_contracts
  FOR INSERT WITH CHECK (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_contracts_update_policy ON public.automation_contracts
  FOR UPDATE USING (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_contracts_delete_policy ON public.automation_contracts
  FOR DELETE USING (organization_id::text = current_setting('app.organization_id', true));

-- =====================================================
-- 3. AUTOMATION PROCESSES - Processos de Cliente
-- =====================================================
CREATE TABLE IF NOT EXISTS public.automation_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  automation_client_id UUID NOT NULL REFERENCES public.automation_clients(id) ON DELETE CASCADE,
  
  -- Tipo de processo
  process_type TEXT NOT NULL CHECK (process_type IN ('onboarding', 'implementation', 'monitoring', 'support')),
  
  -- Informações
  title TEXT NOT NULL,
  description TEXT,
  
  -- Status e progresso
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'cancelled')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- Datas
  start_date DATE,
  due_date DATE,
  completed_date DATE,
  
  -- Responsável
  assigned_to UUID,
  
  -- Prioridade
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Checklist (JSON array)
  checklist JSONB DEFAULT '[]',
  
  -- Integração com workflows
  workflow_id UUID, -- Link para fluxos de trabalho n8n
  
  -- Observações
  notes TEXT,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_automation_processes_org ON public.automation_processes(organization_id);
CREATE INDEX idx_automation_processes_client ON public.automation_processes(automation_client_id);
CREATE INDEX idx_automation_processes_type ON public.automation_processes(process_type);
CREATE INDEX idx_automation_processes_status ON public.automation_processes(status);

-- RLS Policies
ALTER TABLE public.automation_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_processes_select_policy ON public.automation_processes
  FOR SELECT USING (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_processes_insert_policy ON public.automation_processes
  FOR INSERT WITH CHECK (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_processes_update_policy ON public.automation_processes
  FOR UPDATE USING (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_processes_delete_policy ON public.automation_processes
  FOR DELETE USING (organization_id::text = current_setting('app.organization_id', true));

-- =====================================================
-- 4. AUTOMATION BRIEFINGS - Briefings dos Clientes
-- =====================================================
CREATE TABLE IF NOT EXISTS public.automation_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  automation_client_id UUID NOT NULL REFERENCES public.automation_clients(id) ON DELETE CASCADE,
  
  -- Informações
  title TEXT NOT NULL,
  content TEXT,
  
  -- Tipo de briefing
  briefing_type TEXT DEFAULT 'general' CHECK (briefing_type IN ('general', 'project', 'pain_points', 'goals', 'requirements')),
  
  -- Estrutura de dados (JSON)
  data JSONB DEFAULT '{}',
  
  -- Tags para organização
  tags TEXT[] DEFAULT '{}',
  
  -- Integração com Base de Conhecimento
  indexed_for_rag BOOLEAN DEFAULT false,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_automation_briefings_org ON public.automation_briefings(organization_id);
CREATE INDEX idx_automation_briefings_client ON public.automation_briefings(automation_client_id);
CREATE INDEX idx_automation_briefings_type ON public.automation_briefings(briefing_type);

-- RLS Policies
ALTER TABLE public.automation_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_briefings_select_policy ON public.automation_briefings
  FOR SELECT USING (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_briefings_insert_policy ON public.automation_briefings
  FOR INSERT WITH CHECK (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_briefings_update_policy ON public.automation_briefings
  FOR UPDATE USING (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_briefings_delete_policy ON public.automation_briefings
  FOR DELETE USING (organization_id::text = current_setting('app.organization_id', true));

-- =====================================================
-- 5. AUTOMATION MEETING_TRANSCRIPTIONS - Transcrições de Reuniões
-- =====================================================
CREATE TABLE IF NOT EXISTS public.automation_meeting_transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  automation_client_id UUID NOT NULL REFERENCES public.automation_clients(id) ON DELETE CASCADE,
  
  -- Informações da reunião
  meeting_title TEXT NOT NULL,
  meeting_date TIMESTAMPTZ,
  duration_minutes INTEGER,
  
  -- Participantes
  participants TEXT[] DEFAULT '{}',
  
  -- Transcrição
  transcription TEXT,
  summary TEXT,
  action_items JSONB DEFAULT '[]',
  key_points TEXT[] DEFAULT '{}',
  
  -- Anexos
  recording_url TEXT,
  attachments TEXT[] DEFAULT '{}',
  
  -- Integração com Agenda
  calendar_event_id UUID,
  
  -- Integração com Base de Conhecimento
  indexed_for_rag BOOLEAN DEFAULT false,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_automation_meetings_org ON public.automation_meeting_transcriptions(organization_id);
CREATE INDEX idx_automation_meetings_client ON public.automation_meeting_transcriptions(automation_client_id);
CREATE INDEX idx_automation_meetings_date ON public.automation_meeting_transcriptions(meeting_date DESC);

-- RLS Policies
ALTER TABLE public.automation_meeting_transcriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_meetings_select_policy ON public.automation_meeting_transcriptions
  FOR SELECT USING (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_meetings_insert_policy ON public.automation_meeting_transcriptions
  FOR INSERT WITH CHECK (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_meetings_update_policy ON public.automation_meeting_transcriptions
  FOR UPDATE USING (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_meetings_delete_policy ON public.automation_meeting_transcriptions
  FOR DELETE USING (organization_id::text = current_setting('app.organization_id', true));

-- =====================================================
-- 6. AUTOMATION CLIENT_FEEDBACKS - Feedbacks dos Clientes
-- =====================================================
CREATE TABLE IF NOT EXISTS public.automation_client_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  automation_client_id UUID NOT NULL REFERENCES public.automation_clients(id) ON DELETE CASCADE,
  
  -- Informações do feedback
  feedback_type TEXT DEFAULT 'general' CHECK (feedback_type IN ('general', 'satisfaction', 'feature_request', 'issue', 'praise')),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  
  -- Conteúdo
  title TEXT,
  content TEXT NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'implemented')),
  
  -- Relacionamentos
  related_process_id UUID REFERENCES public.automation_processes(id) ON DELETE SET NULL,
  
  -- Resposta
  response TEXT,
  responded_by UUID,
  responded_at TIMESTAMPTZ,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_automation_feedbacks_org ON public.automation_client_feedbacks(organization_id);
CREATE INDEX idx_automation_feedbacks_client ON public.automation_client_feedbacks(automation_client_id);
CREATE INDEX idx_automation_feedbacks_type ON public.automation_client_feedbacks(feedback_type);
CREATE INDEX idx_automation_feedbacks_status ON public.automation_client_feedbacks(status);

-- RLS Policies
ALTER TABLE public.automation_client_feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_feedbacks_select_policy ON public.automation_client_feedbacks
  FOR SELECT USING (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_feedbacks_insert_policy ON public.automation_client_feedbacks
  FOR INSERT WITH CHECK (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_feedbacks_update_policy ON public.automation_client_feedbacks
  FOR UPDATE USING (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_feedbacks_delete_policy ON public.automation_client_feedbacks
  FOR DELETE USING (organization_id::text = current_setting('app.organization_id', true));

-- =====================================================
-- 7. AUTOMATION CLIENT_DOCUMENTS - Documentos dos Clientes
-- =====================================================
CREATE TABLE IF NOT EXISTS public.automation_client_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  automation_client_id UUID NOT NULL REFERENCES public.automation_clients(id) ON DELETE CASCADE,
  
  -- Informações do documento
  document_name TEXT NOT NULL,
  document_type TEXT CHECK (document_type IN ('product_sheet', 'lead_sheet', 'qna_sheet', 'contract', 'proposal', 'other')),
  
  -- Arquivo
  file_url TEXT,
  file_size INTEGER,
  file_type TEXT,
  
  -- Integração com sistemas
  integrated_to_products BOOLEAN DEFAULT false,
  integrated_to_leads BOOLEAN DEFAULT false,
  integrated_to_qna BOOLEAN DEFAULT false,
  integrated_to_kb BOOLEAN DEFAULT false,
  
  -- Dados estruturados (para planilhas migradas)
  structured_data JSONB DEFAULT '{}',
  
  -- Tags e categorização
  tags TEXT[] DEFAULT '{}',
  category TEXT,
  
  -- Observações
  notes TEXT,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_automation_documents_org ON public.automation_client_documents(organization_id);
CREATE INDEX idx_automation_documents_client ON public.automation_client_documents(automation_client_id);
CREATE INDEX idx_automation_documents_type ON public.automation_client_documents(document_type);

-- RLS Policies
ALTER TABLE public.automation_client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_documents_select_policy ON public.automation_client_documents
  FOR SELECT USING (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_documents_insert_policy ON public.automation_client_documents
  FOR INSERT WITH CHECK (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_documents_update_policy ON public.automation_client_documents
  FOR UPDATE USING (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_documents_delete_policy ON public.automation_client_documents
  FOR DELETE USING (organization_id::text = current_setting('app.organization_id', true));

-- =====================================================
-- 8. AUTOMATION CLIENT_APPOINTMENTS - Compromissos
-- =====================================================
CREATE TABLE IF NOT EXISTS public.automation_client_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  automation_client_id UUID NOT NULL REFERENCES public.automation_clients(id) ON DELETE CASCADE,
  
  -- Informações do compromisso
  title TEXT NOT NULL,
  description TEXT,
  
  -- Tipo
  appointment_type TEXT CHECK (appointment_type IN ('meeting', 'call', 'demo', 'training', 'followup', 'other')),
  
  -- Datas e horários
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ,
  
  -- Localização
  location TEXT,
  meeting_url TEXT,
  
  -- Participantes
  participants TEXT[] DEFAULT '{}',
  
  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  
  -- Integração com Agenda
  calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  
  -- Lembretes
  reminder_sent BOOLEAN DEFAULT false,
  
  -- Observações e resultado
  notes TEXT,
  outcome TEXT,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_automation_appointments_org ON public.automation_client_appointments(organization_id);
CREATE INDEX idx_automation_appointments_client ON public.automation_client_appointments(automation_client_id);
CREATE INDEX idx_automation_appointments_date ON public.automation_client_appointments(start_datetime);
CREATE INDEX idx_automation_appointments_status ON public.automation_client_appointments(status);

-- RLS Policies
ALTER TABLE public.automation_client_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_appointments_select_policy ON public.automation_client_appointments
  FOR SELECT USING (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_appointments_insert_policy ON public.automation_client_appointments
  FOR INSERT WITH CHECK (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_appointments_update_policy ON public.automation_client_appointments
  FOR UPDATE USING (organization_id::text = current_setting('app.organization_id', true));

CREATE POLICY automation_appointments_delete_policy ON public.automation_client_appointments
  FOR DELETE USING (organization_id::text = current_setting('app.organization_id', true));

-- =====================================================
-- 9. RPCs - Funções para operações
-- =====================================================

-- RPC para listar clientes de automação
CREATE OR REPLACE FUNCTION automation_clients_list(
  p_organization_id UUID
)
RETURNS SETOF automation_clients
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  RETURN QUERY
  SELECT ac.*
  FROM automation_clients ac
  WHERE ac.organization_id = p_organization_id
  ORDER BY ac.created_at DESC;
END;
$$;

-- RPC para upsert de cliente
CREATE OR REPLACE FUNCTION automation_client_upsert(
  p_organization_id UUID,
  p_id UUID DEFAULT NULL,
  p_company_name TEXT DEFAULT NULL,
  p_contact_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'active',
  p_client_id UUID DEFAULT NULL,
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
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  INSERT INTO automation_clients (
    id, organization_id, company_name, contact_name, email, phone, 
    status, client_id, industry, company_size, website, notes, updated_at
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_organization_id, p_company_name, p_contact_name, 
    p_email, p_phone, p_status, p_client_id, p_industry, p_company_size, p_website, p_notes, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    company_name = COALESCE(EXCLUDED.company_name, automation_clients.company_name),
    contact_name = COALESCE(EXCLUDED.contact_name, automation_clients.contact_name),
    email = COALESCE(EXCLUDED.email, automation_clients.email),
    phone = COALESCE(EXCLUDED.phone, automation_clients.phone),
    status = COALESCE(EXCLUDED.status, automation_clients.status),
    client_id = COALESCE(EXCLUDED.client_id, automation_clients.client_id),
    industry = COALESCE(EXCLUDED.industry, automation_clients.industry),
    company_size = COALESCE(EXCLUDED.company_size, automation_clients.company_size),
    website = COALESCE(EXCLUDED.website, automation_clients.website),
    notes = COALESCE(EXCLUDED.notes, automation_clients.notes),
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

-- RPC para deletar cliente
CREATE OR REPLACE FUNCTION automation_client_delete(
  p_organization_id UUID,
  p_client_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  DELETE FROM automation_clients
  WHERE id = p_client_id AND organization_id = p_organization_id;
  
  RETURN FOUND;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION automation_clients_list TO anon, authenticated;
GRANT EXECUTE ON FUNCTION automation_client_upsert TO anon, authenticated;
GRANT EXECUTE ON FUNCTION automation_client_delete TO anon, authenticated;

-- =====================================================
-- 10. Triggers para updated_at
-- =====================================================

-- Função genérica para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_automation_clients_updated_at BEFORE UPDATE ON automation_clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_contracts_updated_at BEFORE UPDATE ON automation_contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_processes_updated_at BEFORE UPDATE ON automation_processes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_briefings_updated_at BEFORE UPDATE ON automation_briefings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_meetings_updated_at BEFORE UPDATE ON automation_meeting_transcriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_feedbacks_updated_at BEFORE UPDATE ON automation_client_feedbacks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_documents_updated_at BEFORE UPDATE ON automation_client_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_appointments_updated_at BEFORE UPDATE ON automation_client_appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FIM DA MIGRATION - CLIENT MANAGEMENT SYSTEM
-- =====================================================
-- A magia começa aqui! ✨
-- "Design is not just what it looks like and feels like. 
--  Design is how it works." - Steve Jobs
-- =====================================================

