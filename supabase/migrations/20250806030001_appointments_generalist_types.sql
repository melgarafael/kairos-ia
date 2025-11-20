-- Migration: Expand allowed values for appointments.tipo to support generalist CRM
-- Includes legacy values for backward compatibility

-- Up
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_tipo_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_tipo_check
  CHECK (
    tipo IN (
      'reuniao',
      'follow_up',
      'ligacao',
      'demonstracao',
      'apresentacao',
      'suporte',
      'onboarding',
      'entrega',
      'outro',
      -- legacy
      'consulta',
      'retorno',
      'exame'
    )
  );

-- Down (revert to legacy clinical-only types)
-- WARNING: This will fail if there are rows using new values. Clean data before reverting.
-- ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_tipo_check;
-- ALTER TABLE public.appointments ADD CONSTRAINT appointments_tipo_check CHECK (tipo IN ('consulta','retorno','exame'));

