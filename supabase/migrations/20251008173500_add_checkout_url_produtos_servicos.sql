-- Migration: add checkout_url to public.produtos_servicos (idempotente)
-- Contexto: v36 já executado; separar alteração para modo de teste sem alterar .md

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'produtos_servicos'
      AND column_name = 'checkout_url'
  ) THEN
    ALTER TABLE public.produtos_servicos
      ADD COLUMN checkout_url text;

    COMMENT ON COLUMN public.produtos_servicos.checkout_url IS 'Public product/checkout link (optional)';
  END IF;
END$$;

-- Opcional (descomentando se desejar validar tamanho sem travar dados existentes)
-- DO $$ BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_constraint
--     WHERE conname = 'produtos_servicos_checkout_url_len'
--   ) THEN
--     ALTER TABLE public.produtos_servicos
--       ADD CONSTRAINT produtos_servicos_checkout_url_len
--       CHECK (char_length(checkout_url) <= 2048) NOT VALID;
--   END IF;
-- END $$;


