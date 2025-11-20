-- Migration: Suporte a upload de arquivos para documentos de clientes
-- Formatos suportados: CSV, DOCX, TXT, MD, JSON
-- Experiência inspirada na filosofia de design da Apple

BEGIN;

-- =====================================================
-- 1. ATUALIZAR TABELA automation_client_documents
-- =====================================================

-- Adicionar colunas para metadados de arquivo
ALTER TABLE public.automation_client_documents
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS file_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'client-documents';

-- Comentários para documentação
COMMENT ON COLUMN public.automation_client_documents.file_name IS 'Nome original do arquivo';
COMMENT ON COLUMN public.automation_client_documents.file_size_bytes IS 'Tamanho do arquivo em bytes';
COMMENT ON COLUMN public.automation_client_documents.file_mime_type IS 'Tipo MIME do arquivo (ex: text/csv, application/vnd.openxmlformats-officedocument.wordprocessingml.document)';
COMMENT ON COLUMN public.automation_client_documents.storage_path IS 'Caminho completo no storage (bucket/path)';
COMMENT ON COLUMN public.automation_client_documents.storage_bucket IS 'Bucket do storage onde o arquivo está armazenado';

-- Índice para busca por tipo de arquivo
CREATE INDEX IF NOT EXISTS idx_automation_documents_mime_type 
  ON public.automation_client_documents(file_mime_type);

-- Índice para busca por storage_path
CREATE INDEX IF NOT EXISTS idx_automation_documents_storage_path 
  ON public.automation_client_documents(storage_path);

-- =====================================================
-- 2. CRIAR BUCKET PARA DOCUMENTOS DE CLIENTES
-- =====================================================

-- Bucket privado para documentos de clientes (não público)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-documents',
  'client-documents',
  false,
  52428800, -- 50MB limite
  ARRAY[
    'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'application/json',
    'text/json'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =====================================================
-- 3. POLÍTICAS DE STORAGE (RLS)
-- =====================================================

-- Política: Usuários autenticados podem ler documentos que pertencem a eles
DROP POLICY IF EXISTS "Users can read own client documents" ON storage.objects;
CREATE POLICY "Users can read own client documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-documents' 
    AND auth.uid() IS NOT NULL
    -- Verificar se o documento pertence ao usuário através da tabela automation_client_documents
    AND EXISTS (
      SELECT 1 FROM public.automation_client_documents d
      WHERE d.storage_path = (bucket_id || '/' || name)
      AND d.user_id = auth.uid()
    )
  );

-- Política: Usuários autenticados podem fazer upload de documentos
-- Nota: Não verificamos a tabela aqui porque o upload acontece ANTES de criar o registro
DROP POLICY IF EXISTS "Users can upload client documents" ON storage.objects;
CREATE POLICY "Users can upload client documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'client-documents'
    AND auth.uid() IS NOT NULL
  );

-- Política: Usuários autenticados podem atualizar seus próprios documentos
DROP POLICY IF EXISTS "Users can update own client documents" ON storage.objects;
CREATE POLICY "Users can update own client documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.automation_client_documents d
      WHERE d.storage_path = (bucket_id || '/' || name)
      AND d.user_id = auth.uid()
    )
  );

-- Política: Usuários autenticados podem deletar seus próprios documentos
DROP POLICY IF EXISTS "Users can delete own client documents" ON storage.objects;
CREATE POLICY "Users can delete own client documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.automation_client_documents d
      WHERE d.storage_path = (bucket_id || '/' || name)
      AND d.user_id = auth.uid()
    )
  );

-- =====================================================
-- 4. ATUALIZAR RPC automation_document_upsert
-- =====================================================

CREATE OR REPLACE FUNCTION automation_document_upsert(
  p_id UUID DEFAULT NULL,
  p_automation_client_id UUID DEFAULT NULL,
  p_document_name TEXT DEFAULT NULL,
  p_document_type TEXT DEFAULT 'other',
  p_file_url TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT '{}',
  p_notes TEXT DEFAULT NULL,
  p_integrated_to_products BOOLEAN DEFAULT false,
  p_integrated_to_leads BOOLEAN DEFAULT false,
  p_integrated_to_qna BOOLEAN DEFAULT false,
  p_integrated_to_kb BOOLEAN DEFAULT false,
  -- Novos campos para upload de arquivo
  p_file_name TEXT DEFAULT NULL,
  p_file_size_bytes BIGINT DEFAULT NULL,
  p_file_mime_type TEXT DEFAULT NULL,
  p_storage_path TEXT DEFAULT NULL
)
RETURNS automation_client_documents
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_result automation_client_documents;
BEGIN
  INSERT INTO automation_client_documents (
    id, 
    user_id, 
    automation_client_id, 
    document_name, 
    document_type, 
    file_url,
    tags, 
    notes, 
    integrated_to_products, 
    integrated_to_leads, 
    integrated_to_qna, 
    integrated_to_kb,
    file_name,
    file_size_bytes,
    file_mime_type,
    storage_path,
    updated_at
  )
  VALUES (
    COALESCE(p_id, gen_random_uuid()), 
    auth.uid(), 
    p_automation_client_id, 
    p_document_name, 
    p_document_type, 
    p_file_url,
    p_tags, 
    p_notes, 
    p_integrated_to_products, 
    p_integrated_to_leads, 
    p_integrated_to_qna, 
    p_integrated_to_kb,
    p_file_name,
    p_file_size_bytes,
    p_file_mime_type,
    p_storage_path,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET 
    document_name = COALESCE(EXCLUDED.document_name, automation_client_documents.document_name),
    document_type = COALESCE(EXCLUDED.document_type, automation_client_documents.document_type),
    file_url = COALESCE(EXCLUDED.file_url, automation_client_documents.file_url),
    tags = COALESCE(EXCLUDED.tags, automation_client_documents.tags),
    notes = COALESCE(EXCLUDED.notes, automation_client_documents.notes),
    integrated_to_products = COALESCE(EXCLUDED.integrated_to_products, automation_client_documents.integrated_to_products),
    integrated_to_leads = COALESCE(EXCLUDED.integrated_to_leads, automation_client_documents.integrated_to_leads),
    integrated_to_qna = COALESCE(EXCLUDED.integrated_to_qna, automation_client_documents.integrated_to_qna),
    integrated_to_kb = COALESCE(EXCLUDED.integrated_to_kb, automation_client_documents.integrated_to_kb),
    file_name = COALESCE(EXCLUDED.file_name, automation_client_documents.file_name),
    file_size_bytes = COALESCE(EXCLUDED.file_size_bytes, automation_client_documents.file_size_bytes),
    file_mime_type = COALESCE(EXCLUDED.file_mime_type, automation_client_documents.file_mime_type),
    storage_path = COALESCE(EXCLUDED.storage_path, automation_client_documents.storage_path),
    updated_at = NOW()
  RETURNING * INTO v_result;
  RETURN v_result;
END; 
$$;

COMMIT;

