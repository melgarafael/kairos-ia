-- v41 – Q&A: ajustar RLS para permitir SELECT por anon (com contexto de organização)

BEGIN;

-- Garantir que RLS está habilitado
ALTER TABLE public.qna_pairs ENABLE ROW LEVEL SECURITY;

-- Recriar política de SELECT para incluir anon (idempotente)
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
    AND organization_id::text = NULLIF(current_setting('app.organization_id', true), '')
  );

-- Garantir que a política de modificação existe (apenas autenticados)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='qna_pairs' AND policyname='qna_pairs_modify_own_org'
  ) THEN
    CREATE POLICY qna_pairs_modify_own_org ON public.qna_pairs
      FOR ALL
      TO authenticated
      USING (
        organization_id IS NOT NULL
        AND organization_id::text = NULLIF(current_setting('app.organization_id', true), '')
      )
      WITH CHECK (
        organization_id IS NOT NULL
        AND organization_id::text = NULLIF(current_setting('app.organization_id', true), '')
      );
  END IF;
END $$;

COMMIT;

-- Marcar versão
INSERT INTO public.app_migrations (version, applied_at)
VALUES ('41', now())
ON CONFLICT (version) DO NOTHING;


