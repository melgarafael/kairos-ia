-- =====================================================
-- CLIENT MANAGEMENT SYSTEM - MASTER SUPABASE
-- =====================================================
-- Sistema de Gestão de Clientes de Automação
-- Armazenado no MASTER (não Client)
-- Autenticação por user_id (saas_users), não organization_id
-- =====================================================

-- =====================================================
-- 1. AUTOMATION CLIENTS - Clientes de Automação
-- =====================================================
CREATE TABLE IF NOT EXISTS public.automation_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.saas_users(id) ON DELETE CASCADE,
  
  -- Informações básicas
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'onboarding', 'paused', 'churned')),
  
  -- Campos customizados
  industry TEXT,
  company_size TEXT,
  website TEXT,
  notes TEXT,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices para performance
  CONSTRAINT automation_clients_user_company_unique UNIQUE(user_id, company_name)
);

CREATE INDEX idx_automation_clients_user ON public.automation_clients(user_id);
CREATE INDEX idx_automation_clients_status ON public.automation_clients(status);

-- RLS Policies (autenticação por JWT)
ALTER TABLE public.automation_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_clients_policy ON public.automation_clients
  FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- 2. AUTOMATION CONTRACTS - Contratos
-- =====================================================
CREATE TABLE IF NOT EXISTS public.automation_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.saas_users(id) ON DELETE CASCADE,
  automation_client_id UUID NOT NULL REFERENCES public.automation_clients(id) ON DELETE CASCADE,
  
  -- Informações do contrato
  contract_name TEXT NOT NULL,
  contract_number TEXT,
  
  -- Valores
  setup_value NUMERIC(12,2) DEFAULT 0,
  recurring_value NUMERIC(12,2) DEFAULT 0,
  recurring_period TEXT DEFAULT 'monthly' CHECK (recurring_period IN ('monthly', 'quarterly', 'annual')),
  
  -- Ferramentas incluídas
  included_tools TEXT[] DEFAULT '{}',
  
  -- Datas
  start_date DATE,
  end_date DATE,
  renewal_date DATE,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'expired', 'cancelled')),
  
  -- Anexos e observações
  terms TEXT,
  notes TEXT,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_automation_contracts_user ON public.automation_contracts(user_id);
CREATE INDEX idx_automation_contracts_client ON public.automation_contracts(automation_client_id);
CREATE INDEX idx_automation_contracts_status ON public.automation_contracts(status);

ALTER TABLE public.automation_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_contracts_policy ON public.automation_contracts
  FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- 3. AUTOMATION PROCESSES - Processos
-- =====================================================
CREATE TABLE IF NOT EXISTS public.automation_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.saas_users(id) ON DELETE CASCADE,
  automation_client_id UUID NOT NULL REFERENCES public.automation_clients(id) ON DELETE CASCADE,
  
  -- Tipo e informações
  process_type TEXT NOT NULL CHECK (process_type IN ('onboarding', 'implementation', 'monitoring', 'support')),
  title TEXT NOT NULL,
  description TEXT,
  
  -- Status e progresso
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'cancelled')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- Kanban
  stage TEXT DEFAULT 'onboarding' CHECK (stage IN ('onboarding', 'implementation', 'monitoring')),
  position INTEGER DEFAULT 0,
  cover_color TEXT,
  
  -- Datas
  start_date DATE,
  due_date DATE,
  completed_date DATE,
  
  -- Prioridade
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Checklist
  checklist JSONB DEFAULT '[]',
  
  -- Menções
  mentioned_appointments UUID[] DEFAULT '{}',
  mentioned_transcriptions UUID[] DEFAULT '{}',
  mentioned_briefings UUID[] DEFAULT '{}',
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_automation_processes_user ON public.automation_processes(user_id);
CREATE INDEX idx_automation_processes_client ON public.automation_processes(automation_client_id);
CREATE INDEX idx_automation_processes_stage ON public.automation_processes(stage, position);

ALTER TABLE public.automation_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_processes_policy ON public.automation_processes
  FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- 4. AUTOMATION BRIEFINGS - Briefings
-- =====================================================
CREATE TABLE IF NOT EXISTS public.automation_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.saas_users(id) ON DELETE CASCADE,
  automation_client_id UUID NOT NULL REFERENCES public.automation_clients(id) ON DELETE CASCADE,
  
  -- Informações
  title TEXT NOT NULL,
  content TEXT,
  briefing_type TEXT DEFAULT 'general' CHECK (briefing_type IN ('general', 'project', 'pain_points', 'goals', 'requirements')),
  
  -- Estrutura
  data JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  
  -- Integração
  indexed_for_rag BOOLEAN DEFAULT false,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_automation_briefings_user ON public.automation_briefings(user_id);
CREATE INDEX idx_automation_briefings_client ON public.automation_briefings(automation_client_id);

ALTER TABLE public.automation_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_briefings_policy ON public.automation_briefings
  FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- 5. AUTOMATION MEETING_TRANSCRIPTIONS - Transcrições
-- =====================================================
CREATE TABLE IF NOT EXISTS public.automation_meeting_transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.saas_users(id) ON DELETE CASCADE,
  automation_client_id UUID NOT NULL REFERENCES public.automation_clients(id) ON DELETE CASCADE,
  
  -- Informações
  meeting_title TEXT NOT NULL,
  meeting_date TIMESTAMPTZ,
  duration_minutes INTEGER,
  participants TEXT[] DEFAULT '{}',
  
  -- Conteúdo
  transcription TEXT,
  summary TEXT,
  action_items JSONB DEFAULT '[]',
  key_points TEXT[] DEFAULT '{}',
  
  -- Integração
  indexed_for_rag BOOLEAN DEFAULT false,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_automation_meetings_user ON public.automation_meeting_transcriptions(user_id);
CREATE INDEX idx_automation_meetings_client ON public.automation_meeting_transcriptions(automation_client_id);

ALTER TABLE public.automation_meeting_transcriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_meetings_policy ON public.automation_meeting_transcriptions
  FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- 6. AUTOMATION CLIENT_FEEDBACKS - Feedbacks
-- =====================================================
CREATE TABLE IF NOT EXISTS public.automation_client_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.saas_users(id) ON DELETE CASCADE,
  automation_client_id UUID NOT NULL REFERENCES public.automation_clients(id) ON DELETE CASCADE,
  
  -- Informações
  feedback_type TEXT DEFAULT 'general' CHECK (feedback_type IN ('general', 'satisfaction', 'feature_request', 'issue', 'praise')),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'implemented')),
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_automation_feedbacks_user ON public.automation_client_feedbacks(user_id);
CREATE INDEX idx_automation_feedbacks_client ON public.automation_client_feedbacks(automation_client_id);

ALTER TABLE public.automation_client_feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_feedbacks_policy ON public.automation_client_feedbacks
  FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- 7. AUTOMATION CLIENT_DOCUMENTS - Documentos
-- =====================================================
CREATE TABLE IF NOT EXISTS public.automation_client_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.saas_users(id) ON DELETE CASCADE,
  automation_client_id UUID NOT NULL REFERENCES public.automation_clients(id) ON DELETE CASCADE,
  
  -- Informações
  document_name TEXT NOT NULL,
  document_type TEXT CHECK (document_type IN ('product_sheet', 'lead_sheet', 'qna_sheet', 'contract', 'proposal', 'other')),
  
  -- Arquivo
  file_url TEXT,
  
  -- Integração
  integrated_to_products BOOLEAN DEFAULT false,
  integrated_to_leads BOOLEAN DEFAULT false,
  integrated_to_qna BOOLEAN DEFAULT false,
  integrated_to_kb BOOLEAN DEFAULT false,
  
  -- Dados estruturados
  structured_data JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_automation_documents_user ON public.automation_client_documents(user_id);
CREATE INDEX idx_automation_documents_client ON public.automation_client_documents(automation_client_id);

ALTER TABLE public.automation_client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_documents_policy ON public.automation_client_documents
  FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- 8. AUTOMATION CLIENT_APPOINTMENTS - Compromissos
-- =====================================================
CREATE TABLE IF NOT EXISTS public.automation_client_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.saas_users(id) ON DELETE CASCADE,
  automation_client_id UUID NOT NULL REFERENCES public.automation_clients(id) ON DELETE CASCADE,
  
  -- Informações
  title TEXT NOT NULL,
  description TEXT,
  appointment_type TEXT CHECK (appointment_type IN ('meeting', 'call', 'demo', 'training', 'followup', 'other')),
  
  -- Datas
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ,
  
  -- Localização
  location TEXT,
  meeting_url TEXT,
  participants TEXT[] DEFAULT '{}',
  
  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  
  -- Observações
  notes TEXT,
  outcome TEXT,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_automation_appointments_user ON public.automation_client_appointments(user_id);
CREATE INDEX idx_automation_appointments_client ON public.automation_client_appointments(automation_client_id);

ALTER TABLE public.automation_client_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_appointments_policy ON public.automation_client_appointments
  FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- 9. Triggers para updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
-- FIM DAS TABELAS
-- =====================================================
-- Gestão de Clientes agora vive no MASTER! ✨
-- Autenticação automática via auth.uid()
-- Sem necessidade de passar organization_id
-- Dados pessoais do gestor de automação
-- =====================================================

