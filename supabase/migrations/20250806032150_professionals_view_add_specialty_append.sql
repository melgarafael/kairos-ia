-- Safely append `specialty` to professionals compatibility view

-- Drop rules temporarily to allow view replacement
do $$
begin
  if exists (select 1 from pg_rules where schemaname = 'public' and tablename = 'professionals' and rulename = 'professionals_update') then
    drop rule professionals_update on public.professionals;
  end if;
  if exists (select 1 from pg_rules where schemaname = 'public' and tablename = 'professionals' and rulename = 'professionals_insert') then
    drop rule professionals_insert on public.professionals;
  end if;
  if exists (select 1 from pg_rules where schemaname = 'public' and tablename = 'professionals' and rulename = 'professionals_delete') then
    drop rule professionals_delete on public.professionals;
  end if;
exception when others then
  raise notice 'Skipping drop rules: %', sqlerrm;
end $$;

-- Recreate view keeping existing column order and appending specialty at the end
create or replace view public.professionals as
select
  c.id,
  c.organization_id,
  c.name,
  c.position,
  c.email,
  c.phone,
  c.credentials,
  c.notes,
  c.active,
  c.created_at,
  c.updated_at,
  0::int as total_consultations,
  0::int as consultations_this_month,
  0::int as upcoming_appointments,
  null::numeric as average_rating,
  '[]'::jsonb as upcoming_appointments_details,
  (c.position)::text as specialty
from public.collaborators c;

grant select on public.professionals to anon, authenticated, service_role;

-- Recreate rules with updated RETURNING projection (now includes specialty at the end)
create or replace rule professionals_update as
on update to public.professionals
do instead
update public.collaborators set
  name = coalesce(new.name, public.collaborators.name),
  position = coalesce(new.position, public.collaborators.position),
  email = coalesce(new.email, public.collaborators.email),
  phone = coalesce(new.phone, public.collaborators.phone),
  credentials = coalesce(new.credentials, public.collaborators.credentials),
  notes = coalesce(new.notes, public.collaborators.notes),
  active = coalesce(new.active, public.collaborators.active),
  updated_at = now()
where public.collaborators.id = new.id
returning
  public.collaborators.id,
  public.collaborators.organization_id,
  public.collaborators.name,
  public.collaborators.position,
  public.collaborators.email,
  public.collaborators.phone,
  public.collaborators.credentials,
  public.collaborators.notes,
  public.collaborators.active,
  public.collaborators.created_at,
  public.collaborators.updated_at,
  0::int as total_consultations,
  0::int as consultations_this_month,
  0::int as upcoming_appointments,
  null::numeric as average_rating,
  '[]'::jsonb as upcoming_appointments_details,
  (public.collaborators.position)::text as specialty;

create or replace rule professionals_insert as
on insert to public.professionals
do instead
insert into public.collaborators (
  id, organization_id, name, position, email, phone, credentials, notes, active, created_at, updated_at
) values (
  coalesce(new.id, gen_random_uuid()),
  new.organization_id,
  new.name,
  new.position,
  new.email,
  new.phone,
  new.credentials,
  new.notes,
  coalesce(new.active, true),
  coalesce(new.created_at, now()),
  coalesce(new.updated_at, now())
)
returning
  id,
  organization_id,
  name,
  position,
  email,
  phone,
  credentials,
  notes,
  active,
  created_at,
  updated_at,
  0::int as total_consultations,
  0::int as consultations_this_month,
  0::int as upcoming_appointments,
  null::numeric as average_rating,
  '[]'::jsonb as upcoming_appointments_details,
  (position)::text as specialty;

create or replace rule professionals_delete as
on delete to public.professionals
do instead
delete from public.collaborators where id = old.id
returning
  old.id,
  old.organization_id,
  old.name,
  old.position,
  old.email,
  old.phone,
  old.credentials,
  old.notes,
  old.active,
  old.created_at,
  now() as updated_at,
  0::int as total_consultations,
  0::int as consultations_this_month,
  0::int as upcoming_appointments,
  null::numeric as average_rating,
  '[]'::jsonb as upcoming_appointments_details,
  (old.position)::text as specialty;

