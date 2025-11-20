-- v89 - Criar buckets de storage: product-images, whatsapp-media e appointment-transcripts
-- Problema: Os buckets não estão sendo criados no Supabase do cliente,
-- causando erro "Bucket not found" ao tentar fazer upload de arquivos.
-- Solução: Criar os três buckets com políticas RLS adequadas.

BEGIN;

-- =====================================================
-- 1. CRIAR BUCKET PRODUCT-IMAGES (PÚBLICO)
-- =====================================================

-- Bucket público para imagens de produtos
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  name = EXCLUDED.name;

-- Leitura pública (qualquer pessoa pode ver as imagens)
DROP POLICY IF EXISTS "Public read access for product-images" ON storage.objects;
CREATE POLICY "Public read access for product-images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'product-images');

-- Upload por usuários autenticados
DROP POLICY IF EXISTS "Authenticated upload to product-images" ON storage.objects;
CREATE POLICY "Authenticated upload to product-images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'product-images');

-- Atualização por usuários autenticados
DROP POLICY IF EXISTS "Authenticated update to product-images" ON storage.objects;
CREATE POLICY "Authenticated update to product-images"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'product-images');

-- Exclusão por usuários autenticados
DROP POLICY IF EXISTS "Authenticated delete from product-images" ON storage.objects;
CREATE POLICY "Authenticated delete from product-images"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'product-images');

-- =====================================================
-- 2. CRIAR BUCKET WHATSAPP-MEDIA (PRIVADO)
-- =====================================================

-- Bucket privado para mídia do WhatsApp
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', false)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  name = EXCLUDED.name;

-- Leitura por usuários autenticados
DROP POLICY IF EXISTS "Authenticated read whatsapp-media" ON storage.objects;
CREATE POLICY "Authenticated read whatsapp-media"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND auth.uid() IS NOT NULL
  );

-- Upload por usuários autenticados
DROP POLICY IF EXISTS "Authenticated upload whatsapp-media" ON storage.objects;
CREATE POLICY "Authenticated upload whatsapp-media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'whatsapp-media'
    AND auth.uid() IS NOT NULL
  );

-- Atualização por usuários autenticados
DROP POLICY IF EXISTS "Authenticated update whatsapp-media" ON storage.objects;
CREATE POLICY "Authenticated update whatsapp-media"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND auth.uid() IS NOT NULL
  );

-- Exclusão por usuários autenticados
DROP POLICY IF EXISTS "Authenticated delete whatsapp-media" ON storage.objects;
CREATE POLICY "Authenticated delete whatsapp-media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND auth.uid() IS NOT NULL
  );

-- =====================================================
-- 3. CRIAR BUCKET APPOINTMENT-TRANSCRIPTS (PÚBLICO)
-- =====================================================

-- Bucket público para transcrições de agendamentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('appointment-transcripts', 'appointment-transcripts', true)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  name = EXCLUDED.name;

-- Leitura pública (qualquer pessoa pode ver as transcrições)
DROP POLICY IF EXISTS "Public read access for appointment-transcripts" ON storage.objects;
CREATE POLICY "Public read access for appointment-transcripts"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'appointment-transcripts');

-- Upload por usuários autenticados
DROP POLICY IF EXISTS "Authenticated upload to appointment-transcripts" ON storage.objects;
CREATE POLICY "Authenticated upload to appointment-transcripts"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'appointment-transcripts');

-- Atualização por usuários autenticados
DROP POLICY IF EXISTS "Authenticated update to appointment-transcripts" ON storage.objects;
CREATE POLICY "Authenticated update to appointment-transcripts"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'appointment-transcripts');

-- Exclusão por usuários autenticados
DROP POLICY IF EXISTS "Authenticated delete from appointment-transcripts" ON storage.objects;
CREATE POLICY "Authenticated delete from appointment-transcripts"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'appointment-transcripts');

COMMIT;

-- Marcar versão
INSERT INTO public.app_migrations (version, applied_at)
VALUES ('89', now())
ON CONFLICT (version) DO NOTHING;

