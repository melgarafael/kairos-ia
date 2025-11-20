BEGIN;

-- Fix notify_appointment_status_change function: Add ELSE clause to CASE statement
-- This fixes the error "case not found" when updating appointments with statuses other than 'realizado' or 'cancelado'

CREATE OR REPLACE FUNCTION "public"."notify_appointment_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  patient_name text;
  professional_name text;
BEGIN
  -- Só notificar se o status realmente mudou
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Buscar nomes
    SELECT nome INTO patient_name FROM patients WHERE id = NEW.patient_id;
    SELECT name INTO professional_name FROM professionals WHERE id = NEW.professional_id;
    
    -- Notificar baseado no novo status
    CASE NEW.status
      WHEN 'realizado' THEN
        PERFORM notify_users_by_role(
          NEW.organization_id,
          ARRAY['admin', 'recepcionista']::text[],
          'agendamento',
          format('✅ Consulta realizada: %s com %s', 
            COALESCE(patient_name, 'Paciente'),
            COALESCE(professional_name, 'Profissional')
          ),
          format('/consultations?appointment=%s', NEW.id),
          jsonb_build_object(
            'appointment_id', NEW.id,
            'patient_name', patient_name,
            'professional_name', professional_name,
            'old_status', OLD.status,
            'new_status', NEW.status
          )
        );
        
      WHEN 'cancelado' THEN
        PERFORM notify_users_by_role(
          NEW.organization_id,
          ARRAY['admin', 'recepcionista']::text[],
          'agendamento',
          format('❌ Consulta cancelada: %s com %s em %s', 
            COALESCE(patient_name, 'Paciente'),
            COALESCE(professional_name, 'Profissional'),
            to_char(NEW.datetime, 'DD/MM/YYYY HH24:MI')
          ),
          format('/agenda?appointment=%s', NEW.id),
          jsonb_build_object(
            'appointment_id', NEW.id,
            'patient_name', patient_name,
            'professional_name', professional_name,
            'datetime', NEW.datetime,
            'cancellation_reason', 'Cancelado pelo sistema'
          )
        );
        
      ELSE
        -- Para outros status (como 'agendado', 'confirmado', etc), não notificar
        -- Isso evita o erro "case not found"
        NULL;
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMIT;

-- Registrar versão
INSERT INTO public.app_migrations (version, applied_at)
VALUES ('92', now())
ON CONFLICT (version) DO NOTHING;