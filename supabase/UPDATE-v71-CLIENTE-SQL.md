-- v71 – Correção: criar consulta ao marcar agendamento como realizado (schema atual)

begin;

-- 1) Função corrigida: usa client_id/collaborator_id e campos atuais
create or replace function public.auto_create_consultation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Quando status muda para 'realizado', cria uma consulta vinculada
  if NEW.status = 'realizado' and coalesce(OLD.status, '') <> 'realizado' then
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
      coalesce(nullif(NEW.tipo, ''), 'consulta'),
      NEW.anotacoes,
      'completed',
      now()
    );
  end if;
  return NEW;
end;
$$;

-- 2) Garantir trigger idempotente nos agendamentos
drop trigger if exists auto_consultation_trigger on public.appointments;
create trigger auto_consultation_trigger
after update on public.appointments
for each row execute function public.auto_create_consultation();

-- 3) Blindagem opcional: colunas compat em consultations
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='consultations' and column_name='patient_id'
  ) then
    alter table public.consultations add column patient_id uuid generated always as (client_id) stored;
    comment on column public.consultations.patient_id is 'Compatibility alias for client_id (legacy)';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='consultations' and column_name='professional_id'
  ) then
    alter table public.consultations add column professional_id uuid generated always as (collaborator_id) stored;
    comment on column public.consultations.professional_id is 'Compatibility alias for collaborator_id (legacy)';
  end if;
end $$;

commit;

insert into public.app_migrations (version, applied_at)
values ('71', now())
on conflict (version) do nothing;


