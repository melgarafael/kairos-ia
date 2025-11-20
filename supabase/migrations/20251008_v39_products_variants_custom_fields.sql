-- v39 – Produtos: garantir custom_fields/tags e adicionar checkout_url em produto_variantes

BEGIN;

-- 1) Garantir colunas de extensões em produtos_servicos (idempotente)
ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS imposto_percent numeric(5,2) CHECK (imposto_percent >= 0 AND imposto_percent <= 100),
  ADD COLUMN IF NOT EXISTS custo_base numeric(12,2),
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS estoque_minimo integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estoque_locais jsonb DEFAULT '[]'::jsonb;

-- Constraint de status (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
   WHERE t.relname = 'produtos_servicos' AND c.conname = 'produtos_servicos_status_check'
  ) THEN
    ALTER TABLE public.produtos_servicos
      ADD CONSTRAINT produtos_servicos_status_check
      CHECK (status = ANY (ARRAY['rascunho','ativo','sob_demanda','fora_catalogo']));
  END IF;
END $$;

-- Índices úteis (idempotentes)
CREATE INDEX IF NOT EXISTS idx_produtos_servicos_tags_gin ON public.produtos_servicos USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_produtos_servicos_status ON public.produtos_servicos (status);

-- 2) Tabela produto_variantes: garantir existência e adicionar checkout_url
CREATE TABLE IF NOT EXISTS public.produto_variantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  produto_id uuid NOT NULL REFERENCES public.produtos_servicos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  preco numeric(12,2) NOT NULL DEFAULT 0,
  cobranca_tipo text NOT NULL CHECK (cobranca_tipo = ANY (ARRAY['unica','mensal','trimestral','semestral','anual'])),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Nova coluna: checkout_url para link do plano/variante
ALTER TABLE public.produto_variantes
  ADD COLUMN IF NOT EXISTS checkout_url text;

-- Índices
CREATE INDEX IF NOT EXISTS idx_produto_variantes_produto ON public.produto_variantes (produto_id);
CREATE INDEX IF NOT EXISTS idx_produto_variantes_org ON public.produto_variantes (organization_id);

-- RLS padrão (mantém alinhado com ambiente dev permissivo quando necessário)
ALTER TABLE public.produto_variantes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'produto_variantes' AND policyname = 'Dev: acesso total produto_variantes'
  ) THEN
    CREATE POLICY "Dev: acesso total produto_variantes" ON public.produto_variantes FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;

-- 3) Marcar versão
INSERT INTO public.app_migrations (version, applied_at)
VALUES ('39', now())
ON CONFLICT (version) DO NOTHING;


