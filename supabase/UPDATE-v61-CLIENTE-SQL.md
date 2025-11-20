-- V61 – Clients: `nascimento` opcional (DROP NOT NULL)
BEGIN;

-- 1) Tornar a coluna opcional (idempotente)
ALTER TABLE public.clients
  ALTER COLUMN nascimento DROP NOT NULL;

-- 2) Comentário explicativo (opcional)
DO $$
BEGIN
  BEGIN
    COMMENT ON COLUMN public.clients.nascimento IS 'Data de nascimento do cliente. Campo opcional.';
  EXCEPTION WHEN others THEN
    NULL;
  END;
END $$;

COMMIT;

-- 3) Registrar migração (idempotente)
INSERT INTO public.app_migrations (version, applied_at)
VALUES ('61', now())
ON CONFLICT (version) DO NOTHING;



