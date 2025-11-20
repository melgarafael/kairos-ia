-- Adiciona coluna para URLs de imagens em produtos/serviços
-- Armazena até 5 URLs separados por quebras de linha ("\n")

BEGIN;

ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS imagens_urls text;

COMMENT ON COLUMN public.produtos_servicos.imagens_urls IS 'Até 5 URLs de imagens do produto/serviço, separados por quebra de linha (\n).';

COMMIT;


