-- Add optional title column to appointments for event naming (Google Calendar-like)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'appointments' and column_name = 'title'
  ) then
    alter table public.appointments
      add column title text;
  end if;
exception when others then
  raise notice 'Skipping title column creation: %', sqlerrm;
end $$;

comment on column public.appointments.title is 'Optional event title for calendar cards.';

