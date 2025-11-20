BEGIN;

LOCK TABLE public.produtos_servicos IN SHARE ROW EXCLUSIVE MODE;

-- 1) Colunas
ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS cobranca_tipo text;

ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS estoque_quantidade numeric;

ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS tem_estoque boolean;

-- 2) Default
ALTER TABLE public.produtos_servicos
  ALTER COLUMN tem_estoque SET DEFAULT false;

-- 3) Constraint CHECK (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'produtos_servicos_cobranca_tipo_chk'
      AND n.nspname = 'public'
      AND t.relname = 'produtos_servicos'
  ) THEN
    ALTER TABLE public.produtos_servicos
      ADD CONSTRAINT produtos_servicos_cobranca_tipo_chk
      CHECK (cobranca_tipo IN ('unica','mensal','trimestral','semestral','anual')) NOT VALID;
  END IF;
END
$$;

-- 4) Validar a constraint (pode falhar se houver dados inválidos)
ALTER TABLE public.produtos_servicos
  VALIDATE CONSTRAINT produtos_servicos_cobranca_tipo_chk;

-- 5) Comentários
COMMENT ON COLUMN public.produtos_servicos.cobranca_tipo IS 'Tipo de cobrança do produto/serviço: única, mensal, trimestral, semestral ou anual';
COMMENT ON COLUMN public.produtos_servicos.estoque_quantidade IS 'Quantidade de itens disponíveis em estoque para produtos';
COMMENT ON COLUMN public.produtos_servicos.tem_estoque IS 'Indica se o produto/serviço possui controle de estoque';

-- 6) Registrar migração
INSERT INTO public.app_migrations (version, applied_at)
VALUES ('4', now())
ON CONFLICT (version) DO NOTHING;

COMMIT;