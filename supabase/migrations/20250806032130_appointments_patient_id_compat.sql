-- Compatibility column for legacy triggers/functions expecting NEW.patient_id on appointments
-- Mirrors client_id; read-only to callers

do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'appointments' and column_name = 'patient_id'
  ) then
    alter table public.appointments
      add column patient_id uuid generated always as (client_id) stored;
  end if;
exception when others then
  raise notice 'Skipping patient_id compat column creation: %', sqlerrm;
end $$;

comment on column public.appointments.patient_id is 'Compatibility alias for client_id (generated column). Used by legacy triggers/functions.';

