-- Make professionals compatibility view writable via rules

-- UPDATE rule: map updates on the view to collaborators table
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
where public.collaborators.id = new.id;

-- INSERT rule: map inserts on the view to collaborators
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
) returning *;

-- DELETE rule: map deletes to collaborators
create or replace rule professionals_delete as
on delete to public.professionals
do instead
delete from public.collaborators where id = old.id;

-- Note: metric/derived columns (total_consultations, etc.) are intentionally ignored on updates

