SET search_path = public, auth;

-- Adicionar novos produtos de trilha (Super Kit Multi Agentes e Kit Script de Vendas)
DO $$
BEGIN
  INSERT INTO public.saas_trail_products (id, slug, name)
  VALUES
    ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d','multi-agents','Super Kit Multi Agentes'),
    ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e','sales-script','Kit Script de Vendas')
  ON CONFLICT (id) DO NOTHING;
END $$;

