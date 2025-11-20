-- v44 – Q&A: RLS lê header x-organization-id como fallback do app.organization_id

BEGIN;

-- Habilitar RLS (idempotente)
ALTER TABLE public.qna_pairs ENABLE ROW LEVEL SECURITY;

-- Recriar política de SELECT para aceitar o header OU GUC
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='qna_pairs' AND policyname='qna_pairs_select_own_org'
  ) THEN
    DROP POLICY qna_pairs_select_own_org ON public.qna_pairs;
  END IF;
END $$;

CREATE POLICY qna_pairs_select_own_org ON public.qna_pairs
  FOR SELECT
  TO anon, authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id::text = coalesce(
      nullif(current_setting('request.header.x-organization-id', true), ''),
      nullif(current_setting('app.organization_id', true), '')
    )
  );

-- Recriar política de modificação para aceitar o header OU GUC
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='qna_pairs' AND policyname='qna_pairs_modify_own_org'
  ) THEN
    DROP POLICY qna_pairs_modify_own_org ON public.qna_pairs;
  END IF;
END $$;

CREATE POLICY qna_pairs_modify_own_org ON public.qna_pairs
  FOR ALL
  TO anon, authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id::text = coalesce(
      nullif(current_setting('request.header.x-organization-id', true), ''),
      nullif(current_setting('app.organization_id', true), '')
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id::text = coalesce(
      nullif(current_setting('request.header.x-organization-id', true), ''),
      nullif(current_setting('app.organization_id', true), '')
    )
  );

COMMIT;

-- Marcar versão
INSERT INTO public.app_migrations (version, applied_at)
VALUES ('44', now())
ON CONFLICT (version) DO NOTHING;


