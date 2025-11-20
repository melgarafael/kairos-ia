-- Compatibility column for legacy triggers/functions expecting NEW.professional_id on appointments
-- Mirrors collaborator_id; read-only to callers

do $$
begin
  -- Add generated column if it doesn't exist
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'appointments' and column_name = 'professional_id'
  ) then
    alter table public.appointments
      add column professional_id uuid generated always as (collaborator_id) stored;
  end if;
exception when others then
  raise notice 'Skipping professional_id compat column creation: %', sqlerrm;
end $$;

comment on column public.appointments.professional_id is 'Compatibility alias for collaborator_id (generated column). Used by legacy triggers/functions.';

