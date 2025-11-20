SET search_path = public, auth;

-- Catálogo fixo de features: gating de menus da Sidebar
-- Cada feature é booleana e desabilitada por default (admin habilita por plano)

INSERT INTO public.saas_features (key, type, default_value, category, description)
VALUES
  ('gate.sidebar.dashboard', 'boolean', 'false'::jsonb, 'Sidebar', 'Início'),
  ('gate.sidebar.kanban', 'boolean', 'false'::jsonb, 'Sidebar', 'Leads CRM (Kanban)'),
  ('gate.sidebar.leads', 'boolean', 'false'::jsonb, 'Sidebar', 'Leads Lista'),
  ('gate.sidebar.agenda', 'boolean', 'false'::jsonb, 'Sidebar', 'Agenda'),
  ('gate.sidebar.clients', 'boolean', 'false'::jsonb, 'Sidebar', 'Clientes'),
  ('gate.sidebar.collaborators', 'boolean', 'false'::jsonb, 'Sidebar', 'Colaboradores'),
  ('gate.sidebar.consultations', 'boolean', 'false'::jsonb, 'Sidebar', 'Agendamentos Concluídos'),
  ('gate.sidebar.financial', 'boolean', 'false'::jsonb, 'Sidebar', 'Financeiro'),
  ('gate.sidebar.products', 'boolean', 'false'::jsonb, 'Sidebar', 'Produtos e Serviços'),
  ('gate.sidebar.reports', 'boolean', 'false'::jsonb, 'Sidebar', 'Funil de métricas'),
  ('gate.sidebar.automation', 'boolean', 'false'::jsonb, 'Sidebar', 'Automação n8n'),
  ('gate.sidebar.whatsapp-repository', 'boolean', 'false'::jsonb, 'Sidebar', 'Analisar Desempenho da IA'),
  ('gate.sidebar.notifications', 'boolean', 'false'::jsonb, 'Sidebar', 'Notificações')
ON CONFLICT (key) DO UPDATE
SET type = EXCLUDED.type,
    default_value = EXCLUDED.default_value,
    category = EXCLUDED.category,
    description = EXCLUDED.description;


