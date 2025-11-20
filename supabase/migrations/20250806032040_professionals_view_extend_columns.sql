-- Extend compatibility view to include columns expected by legacy queries
-- Adds totals/metrics columns with safe defaults

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
  '[]'::jsonb as upcoming_appointments_details
from public.collaborators c;

grant select on public.professionals to anon, authenticated, service_role;

