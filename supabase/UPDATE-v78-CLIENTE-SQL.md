-- v78 – Kanban: Otimizações de Performance para Grandes Volumes
-- Objetivo:
--  1) Adicionar índices compostos para otimizar queries de paginação e filtros no kanban
--  2) Melhorar performance quando há mais de 1000 leads (evita travamentos)
--  3) Suportar paginação server-side com queries rápidas mesmo com milhões de leads

-- Índice composto para queries de paginação por estágio (query mais comum no kanban)
-- Usado por: SELECT * FROM crm_leads WHERE organization_id = ? AND stage = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
CREATE INDEX IF NOT EXISTS idx_crm_leads_kanban_pagination 
  ON public.crm_leads(organization_id, stage, created_at DESC);

-- Índice para filtros de busca (nome, whatsapp, email)
-- Usado por: WHERE organization_id = ? AND (name ILIKE ? OR whatsapp ILIKE ? OR email ILIKE ?)
-- Nota: Índices separados para cada coluna de busca para melhor performance com ILIKE
CREATE INDEX IF NOT EXISTS idx_crm_leads_org_name_search 
  ON public.crm_leads(organization_id, name text_pattern_ops) 
  WHERE name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_leads_org_whatsapp_search 
  ON public.crm_leads(organization_id, whatsapp text_pattern_ops) 
  WHERE whatsapp IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_leads_org_email_search 
  ON public.crm_leads(organization_id, email text_pattern_ops) 
  WHERE email IS NOT NULL;

-- Índice para filtro de prioridade combinado com organização
-- Usado por: WHERE organization_id = ? AND priority = ?
CREATE INDEX IF NOT EXISTS idx_crm_leads_org_priority 
  ON public.crm_leads(organization_id, priority) 
  WHERE priority IS NOT NULL;

-- Índice para filtro de origem combinado com organização
-- Usado por: WHERE organization_id = ? AND source = ?
CREATE INDEX IF NOT EXISTS idx_crm_leads_org_source 
  ON public.crm_leads(organization_id, source) 
  WHERE source IS NOT NULL;

-- Índice para filtro de canal combinado com organização
-- Usado por: WHERE organization_id = ? AND canal = ?
CREATE INDEX IF NOT EXISTS idx_crm_leads_org_canal 
  ON public.crm_leads(organization_id, canal) 
  WHERE canal IS NOT NULL;

-- Índice para contagem rápida por organização (usado para determinar se deve usar paginação)
-- Usado por: SELECT COUNT(*) FROM crm_leads WHERE organization_id = ?
-- Nota: Índice em organization_id já deve existir, mas garantimos que está otimizado
CREATE INDEX IF NOT EXISTS idx_crm_leads_org_count 
  ON public.crm_leads(organization_id) 
  WHERE organization_id IS NOT NULL;

-- Comentários explicativos
COMMENT ON INDEX idx_crm_leads_kanban_pagination IS 
  'Índice otimizado para paginação de leads no kanban por estágio e data de criação';

COMMENT ON INDEX idx_crm_leads_org_name_search IS 
  'Índice para busca de texto (ILIKE) em nome';

COMMENT ON INDEX idx_crm_leads_org_whatsapp_search IS 
  'Índice para busca de texto (ILIKE) em whatsapp';

COMMENT ON INDEX idx_crm_leads_org_email_search IS 
  'Índice para busca de texto (ILIKE) em email';

COMMENT ON INDEX idx_crm_leads_org_priority IS 
  'Índice para filtro de prioridade por organização';

COMMENT ON INDEX idx_crm_leads_org_source IS 
  'Índice para filtro de origem por organização';

COMMENT ON INDEX idx_crm_leads_org_canal IS 
  'Índice para filtro de canal por organização';

-- Registrar versão
create table if not exists public.app_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

insert into public.app_migrations (version, applied_at)
values ('78', now())
on conflict (version) do nothing;

