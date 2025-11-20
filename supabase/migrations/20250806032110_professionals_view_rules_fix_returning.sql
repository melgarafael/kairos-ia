-- Fix RETURNING types for professionals view rules to match view rowtype

-- UPDATE rule with explicit RETURNING projection
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
  '[]'::jsonb as upcoming_appointments_details;

-- INSERT rule with explicit RETURNING projection
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
  '[]'::jsonb as upcoming_appointments_details;

-- DELETE rule with explicit RETURNING projection (return the deleted row shape)
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
  '[]'::jsonb as upcoming_appointments_details;

