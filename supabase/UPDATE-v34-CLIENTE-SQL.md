/*
  # Add SKU to produtos_servicos and create produto_variantes table

  1. Add column:
     - produtos_servicos.sku text (nullable)
     - Unique index (organization_id, sku) where sku is not null

  2. Create table produto_variantes (if not exists)
     - id uuid PK
     - organization_id uuid
     - produto_id uuid FK -> produtos_servicos(id) on delete cascade
     - nome text not null
     - preco numeric(12,2) not null default 0
     - cobranca_tipo text check in ('unica','mensal','trimestral','semestral','anual') default 'unica'
     - ativo boolean default true
     - created_at timestamptz default now()
     - updated_at timestamptz default now()

  3. Security
     - Enable RLS
     - Dev policy permissiva (mantém padrão do projeto)

  4. Indexes
     - produto_variantes: organization_id, produto_id
*/

-- 1) SKU column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'produtos_servicos' AND column_name = 'sku'
  ) THEN
    ALTER TABLE public.produtos_servicos ADD COLUMN sku text;
  END IF;
END $$;

-- Unique index for (organization_id, sku) when sku is not null
CREATE UNIQUE INDEX IF NOT EXISTS produtos_servicos_org_sku_uniq
  ON public.produtos_servicos(organization_id, sku)
  WHERE sku IS NOT NULL;

-- 2) produto_variantes table
CREATE TABLE IF NOT EXISTS public.produto_variantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  produto_id uuid NOT NULL REFERENCES public.produtos_servicos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  preco numeric(12,2) NOT NULL DEFAULT 0,
  cobranca_tipo text NOT NULL DEFAULT 'unica'::text CHECK (cobranca_tipo = ANY (ARRAY['unica'::text,'mensal'::text,'trimestral'::text,'semestral'::text,'anual'::text])),
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.produto_variantes ENABLE ROW LEVEL SECURITY;

-- Dev permissive policy (align with project defaults)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'produto_variantes' AND policyname = 'Dev: acesso total produto_variantes'
  ) THEN
    CREATE POLICY "Dev: acesso total produto_variantes" ON public.produto_variantes FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS produto_variantes_org_idx ON public.produto_variantes(organization_id);
CREATE INDEX IF NOT EXISTS produto_variantes_produto_idx ON public.produto_variantes(produto_id);




-- 1) Marcar versão
insert into public.app_migrations (version, applied_at)
values ('34', now())
on conflict (version) do nothing;