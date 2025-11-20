-- Compatibility view for legacy references to public.professionals
-- Some triggers/RPCs may still SELECT from professionals; this view maps to collaborators

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
  c.updated_at
from public.collaborators c;

comment on view public.professionals is 'Compatibility view that maps collaborators to legacy professionals references.';

-- Ensure basic privileges (selection checks will still honor RLS on base table)
grant select on public.professionals to anon, authenticated, service_role;

