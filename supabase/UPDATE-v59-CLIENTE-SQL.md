BEGIN;

-- v59 – Produtos/Serviços: coluna imagens_urls (idempotente)
-- Objetivo: corrigir instalações que não receberam a coluna durante updates anteriores.
-- Regras:
--  - Não quebrar quem já tem a coluna (ADD COLUMN IF NOT EXISTS)
--  - Comentar a coluna para documentação
--  - Registrar versão em app_migrations

LOCK TABLE public.produtos_servicos IN SHARE ROW EXCLUSIVE MODE;

-- 1) Adicionar coluna imagens_urls, se ausente
ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS imagens_urls text;

-- 2) Comentário explicativo (idempotente)
DO $$
BEGIN
  BEGIN
    COMMENT ON COLUMN public.produtos_servicos.imagens_urls IS 'Até 5 URLs de imagens do produto/serviço, separados por quebra de linha (\n).';
  EXCEPTION WHEN others THEN
    -- Ignorar caso a coluna não exista por algum motivo
    NULL;
  END;
END $$;

COMMIT;

-- 3) Registrar migração (idempotente)
INSERT INTO public.app_migrations (version, applied_at)
VALUES ('59', now())
ON CONFLICT (version) DO NOTHING;


