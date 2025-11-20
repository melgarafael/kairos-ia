-- Adiciona coluna para Base64 das imagens em produtos/serviços
-- Armazena até 5 strings base64 separadas por quebras de linha ("\n")

BEGIN;

ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS imagens_base64 text;

COMMENT ON COLUMN public.produtos_servicos.imagens_base64 IS 'Até 5 imagens em Base64 (data URL) separadas por quebra de linha (\n).';

COMMIT;


