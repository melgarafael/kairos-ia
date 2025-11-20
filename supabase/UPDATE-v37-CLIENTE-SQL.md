BEGIN;

LOCK TABLE public.produtos_servicos IN SHARE ROW EXCLUSIVE MODE;

-- Add checkout_url column for product/checkout link
ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS checkout_url text;

COMMENT ON COLUMN public.produtos_servicos.checkout_url IS 'Public product/checkout link (optional)';

-- Optional: basic URL sanity via length; no strict constraint to avoid breaking imports
-- ALTER TABLE public.produtos_servicos
--   ADD CONSTRAINT produtos_servicos_checkout_url_len CHECK (char_length(checkout_url) <= 2048) NOT VALID;

COMMIT;

-- 7) Marcar versão
insert into public.app_migrations (version, applied_at)
values ('37', now())
on conflict (version) do nothing;
