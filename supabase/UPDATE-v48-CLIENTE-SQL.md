-- v48 – Trilha de Monetização: RLS com header x-organization-id

BEGIN;

-- Habilitar RLS (idempotente)
ALTER TABLE public.monetization_trail_progress ENABLE ROW LEVEL SECURITY;

-- Recriar política de SELECT para aceitar o header OU GUC
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='monetization_trail_progress' AND policyname='trail_read_ctx'
  ) THEN
    DROP POLICY trail_read_ctx ON public.monetization_trail_progress;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='monetization_trail_progress' AND policyname='trail_read_org'
  ) THEN
    DROP POLICY trail_read_org ON public.monetization_trail_progress;
  END IF;
END $$;

CREATE POLICY trail_read_ctx ON public.monetization_trail_progress
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
    WHERE schemaname='public' AND tablename='monetization_trail_progress' AND policyname='trail_modify_ctx'
  ) THEN
    DROP POLICY trail_modify_ctx ON public.monetization_trail_progress;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='monetization_trail_progress' AND policyname='trail_write_org'
  ) THEN
    DROP POLICY trail_write_org ON public.monetization_trail_progress;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='monetization_trail_progress' AND policyname='trail_update_org'
  ) THEN
    DROP POLICY trail_update_org ON public.monetization_trail_progress;
  END IF;
END $$;

CREATE POLICY trail_modify_ctx ON public.monetization_trail_progress
  FOR ALL
  TO authenticated
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
VALUES ('48', now())
ON CONFLICT (version) DO NOTHING;

