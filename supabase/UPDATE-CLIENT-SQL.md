CREATE OR REPLACE FUNCTION auto_create_consultation()
RETURNS TRIGGER AS $$
BEGIN
    -- Verifica se o status do agendamento mudou para 'realizado'
    IF NEW.status = 'realizado' AND OLD.status IS DISTINCT FROM 'realizado' THEN
        -- Insere um novo registro na tabela consultations
        INSERT INTO public.consultations (
            organization_id,
            appointment_id,
            patient_id,
            professional_id,
            date,
            type,
            notes,
            status,
            created_at
        ) VALUES (
            NEW.organization_id,      -- Copia o ID da organização do agendamento
            NEW.id,                   -- Usa o ID do agendamento como appointment_id para a consulta
            NEW.patient_id,           -- **CORREÇÃO**: Copia o patient_id do agendamento
            NEW.professional_id,      -- **CORREÇÃO**: Copia o professional_id do agendamento
            NEW.datetime,             -- Usa a data e hora do agendamento como data da consulta
            NEW.tipo,                 -- Usa o tipo do agendamento como tipo da consulta
            NEW.anotacoes,            -- Usa as anotações do agendamento como notas da consulta
            'completed',              -- Define o status padrão como 'completed'
            NOW()                     -- Define a data de criação
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Down (aviso: só rode se limpar os dados novos antes)
-- ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_tipo_check;
-- ALTER TABLE public.appointments ADD CONSTRAINT appointments_tipo_check CHECK (tipo IN ('consulta','retorno','exame'));

-- v0_bootstrap.sql
create table if not exists app_migrations (
  version text primary key,
  applied_at timestamptz default now()
);

-- v2 - Registrar versão 2 no client (mantenha SEMPRE a última linha de versão ao final do arquivo)
insert into public.app_migrations (version, applied_at)
values ('2', now())
on conflict (version) do nothing;
