SET search_path = public, auth;

-- Catálogo de Trilhas como produtos (Master)
CREATE TABLE IF NOT EXISTS public.saas_trail_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed estável com os 3 produtos atuais
DO $$
BEGIN
  INSERT INTO public.saas_trail_products (id, slug, name)
  VALUES
    ('8b5e0e5e-1f9e-4db4-a1b1-1a3b9f63f0e1','monetization','Trilha de Monetização'),
    ('b3e05412-90c0-4f4e-bd7a-2ea53a748f34','logic','Trilha de Lógica'),
    ('e2f97c48-8f4a-4fcd-91e8-5b3f471e2cc0','n8n','Trilha n8n')
  ON CONFLICT (id) DO NOTHING;
END $$;


