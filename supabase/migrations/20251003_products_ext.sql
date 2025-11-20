-- Extensões para Produtos/Serviços
-- - tags (text[])
-- - custom_fields (jsonb)
-- - impostos/custos opcionais
-- - status granular (rascunho, ativo, sob_demanda, fora_catalogo)
-- - estoque_minimo e locais (jsonb)
-- - tabelas auxiliares: produto_variantes e produtos_relacionados

BEGIN;

-- 1) Novas colunas na tabela principal
ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS imposto_percent numeric(5,2) CHECK (imposto_percent >= 0 AND imposto_percent <= 100),
  ADD COLUMN IF NOT EXISTS custo_base numeric(12,2),
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS estoque_minimo integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estoque_locais jsonb DEFAULT '[]'::jsonb;

-- Constraint de status
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

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_produtos_servicos_tags_gin ON public.produtos_servicos USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_produtos_servicos_status ON public.produtos_servicos (status);

-- 2) Tabela de variantes/planos
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

CREATE INDEX IF NOT EXISTS idx_produto_variantes_produto ON public.produto_variantes (produto_id);
CREATE INDEX IF NOT EXISTS idx_produto_variantes_org ON public.produto_variantes (organization_id);

-- 3) Tabela de relacionamentos (upsell/cross-sell)
CREATE TABLE IF NOT EXISTS public.produtos_relacionados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  produto_id uuid NOT NULL REFERENCES public.produtos_servicos(id) ON DELETE CASCADE,
  relacionado_id uuid NOT NULL REFERENCES public.produtos_servicos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Evitar duplicidade
CREATE UNIQUE INDEX IF NOT EXISTS uq_produtos_relacionados_pair
  ON public.produtos_relacionados (produto_id, relacionado_id);

CREATE INDEX IF NOT EXISTS idx_produtos_relacionados_org ON public.produtos_relacionados (organization_id);

COMMENT ON TABLE public.produto_variantes IS 'Planos/variações de um produto ou serviço.';
COMMENT ON TABLE public.produtos_relacionados IS 'Relacionamentos para upsell/cross-sell.';

COMMIT;


