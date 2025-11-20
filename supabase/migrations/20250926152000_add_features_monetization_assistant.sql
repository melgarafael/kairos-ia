SET search_path = public, auth;

-- Novas features para controle via painel (AdminPlanConfigPanel)
-- 1) Trilha de Monetização
-- 2) Assistente de IA flutuante (abrir/usar overlay do assistente)

INSERT INTO public.saas_features (key, type, default_value, category, description)
VALUES
  ('gate.monetization.trail', 'boolean', 'false'::jsonb, 'Experiência', 'Trilha de Monetização (página e atalhos)'),
  ('gate.assistant.floating', 'boolean', 'false'::jsonb, 'Experiência', 'Assistente de IA flutuante (botão no header e overlay)')
ON CONFLICT (key) DO UPDATE
SET type = EXCLUDED.type,
    default_value = EXCLUDED.default_value,
    category = EXCLUDED.category,
    description = EXCLUDED.description;


