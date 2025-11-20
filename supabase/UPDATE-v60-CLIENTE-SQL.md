-- V60 – Appointments.tipo como texto livre (permite NULL)
BEGIN;

-- 1) Remover constraint de valores permitidos (se existir)
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_tipo_check;

-- 2) Permitir NULL no campo tipo
ALTER TABLE public.appointments
  ALTER COLUMN tipo DROP NOT NULL;

-- 3) Documentação
COMMENT ON COLUMN public.appointments.tipo IS 'Tipo livre do agendamento (texto). Pode ser NULL. Qualquer valor é aceito.';

COMMIT;

-- 4) Registrar versão
INSERT INTO public.app_migrations (version, applied_at)
VALUES ('60', now())
ON CONFLICT (version) DO NOTHING;


