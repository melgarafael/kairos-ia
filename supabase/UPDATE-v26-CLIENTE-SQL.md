-- Cria bucket público para imagens de produtos e políticas básicas

BEGIN;

-- Bucket público para imagens de produtos
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Leitura pública
drop policy if exists "Public read access for product-images" on storage.objects;
create policy "Public read access for product-images"
  on storage.objects
  for select
  using (bucket_id = 'product-images');

-- Upload por usuários autenticados
drop policy if exists "Authenticated upload to product-images" on storage.objects;
create policy "Authenticated upload to product-images"
  on storage.objects
  for insert
  with check (bucket_id = 'product-images');

-- Atualização por usuários autenticados
drop policy if exists "Authenticated update to product-images" on storage.objects;
create policy "Authenticated update to product-images"
  on storage.objects
  for update
  using (bucket_id = 'product-images');

-- Exclusão por usuários autenticados
drop policy if exists "Authenticated delete from product-images" on storage.objects;
create policy "Authenticated delete from product-images"
  on storage.objects
  for delete
  using (bucket_id = 'product-images');

COMMIT;

-- Adiciona coluna para Base64 das imagens em produtos/serviços
-- Armazena até 5 strings base64 separadas por quebras de linha ("\n")

BEGIN;

ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS imagens_base64 text;

COMMENT ON COLUMN public.produtos_servicos.imagens_base64 IS 'Até 5 imagens em Base64 (data URL) separadas por quebra de linha (\n).';

COMMIT;

-- Adiciona coluna para Base64 das imagens em produtos/serviços
-- Armazena até 5 strings base64 separadas por quebras de linha ("\n")

BEGIN;

ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS imagens_base64 text;

COMMENT ON COLUMN public.produtos_servicos.imagens_base64 IS 'Até 5 imagens em Base64 (data URL) separadas por quebra de linha (\n).';

COMMIT;





-- 1) Marcar versão
insert into public.app_migrations (version, applied_at)
values ('26', now())
on conflict (version) do nothing;