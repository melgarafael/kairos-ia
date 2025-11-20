-- v72 – Agenda: normalizar tipo ao criar consulta a partir de agendamento realizado

begin;

-- 1) Recriar função com normalização de tipo (sem alterar v71)
create or replace function public.auto_create_consultation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Quando status muda para 'realizado', cria uma consulta vinculada
  if NEW.status = 'realizado' and coalesce(OLD.status, '') <> 'realizado' then
    -- Normaliza o tipo para os valores aceitos pela tabela consultations
    -- Valores como 'reuniao', 'follow_up', 'onboarding' serão tratados como 'consulta'
    declare v_type text := lower(coalesce(nullif(NEW.tipo, ''), 'consulta'));
    begin
      if v_type not in ('consulta','retorno','exame') then
        v_type := 'consulta';
      end if;
    end;

    insert into public.consultations (
      organization_id,
      appointment_id,
      client_id,
      collaborator_id,
      date,
      type,
      notes,
      status,
      created_at
    ) values (
      NEW.organization_id,
      NEW.id,
      NEW.client_id,
      NEW.collaborator_id,
      NEW.datetime,
      v_type,
      NEW.anotacoes,
      'completed',
      now()
    );
  end if;
  return NEW;
end;
$$;

-- 2) Garantir trigger (idempotente) — não rompe bases existentes
drop trigger if exists auto_consultation_trigger on public.appointments;
create trigger auto_consultation_trigger
after update on public.appointments
for each row execute function public.auto_create_consultation();

commit;

insert into public.app_migrations (version, applied_at)
values ('72', now())
on conflict (version) do nothing;


