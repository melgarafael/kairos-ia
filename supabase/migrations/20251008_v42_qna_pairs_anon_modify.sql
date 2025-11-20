-- v42 – Q&A: permitir INSERT/UPDATE/DELETE via anon (RLS por organização)

BEGIN;

-- Garantir RLS ligado
ALTER TABLE public.qna_pairs ENABLE ROW LEVEL SECURITY;

-- Recriar política de modificação para incluir anon, mantendo escopo por organização
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
    AND organization_id::text = NULLIF(current_setting('app.organization_id', true), '')
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id::text = NULLIF(current_setting('app.organization_id', true), '')
  );

COMMIT;

-- Marcar versão
INSERT INTO public.app_migrations (version, applied_at)
VALUES ('42', now())
ON CONFLICT (version) DO NOTHING;


