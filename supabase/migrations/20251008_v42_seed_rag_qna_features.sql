SET search_path = public, auth;

-- Seed feature flags for RAG and Q&A in the Sidebar
-- These are boolean toggles, disabled by default. Plans can enable via admin panel.

INSERT INTO public.saas_features (key, type, default_value, category, description)
VALUES
  ('gate.sidebar.rag', 'boolean', 'false'::jsonb, 'Sidebar', 'RAG'),
  ('gate.sidebar.qna', 'boolean', 'false'::jsonb, 'Sidebar', 'Q&A')
ON CONFLICT (key) DO UPDATE
SET type = EXCLUDED.type,
    default_value = EXCLUDED.default_value,
    category = EXCLUDED.category,
    description = EXCLUDED.description;


