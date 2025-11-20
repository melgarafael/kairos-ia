BEGIN;

LOCK TABLE public.produtos_servicos IN SHARE ROW EXCLUSIVE MODE;

-- Add sales_page_url column for product sales/landing page
ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS sales_page_url text;

COMMENT ON COLUMN public.produtos_servicos.sales_page_url IS 'Public sales/landing page link (optional)';

-- Optional: basic URL sanity via length; no strict constraint to avoid breaking imports
-- ALTER TABLE public.produtos_servicos
--   ADD CONSTRAINT produtos_servicos_sales_page_url_len CHECK (char_length(sales_page_url) <= 2048) NOT VALID;

COMMIT;

-- 8) Marcar versão
insert into public.app_migrations (version, applied_at)
values ('38', now())
on conflict (version) do nothing;


