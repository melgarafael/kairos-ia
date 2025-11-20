-- Fix: allow deleting leads referenced by appointments
-- Context: Previously, the FK appointments.lead_id -> crm_leads.id had no
--          ON DELETE action (default NO ACTION). Deleting a lead with linked
--          appointments failed with a foreign key violation.
-- Decision: Align with other relationships (clients/collaborators/org) and
--           cascade delete appointments tied exclusively to a lead.
--           This avoids violating the CHECK constraint that enforces exactly
--           one of (client_id, lead_id) is set.

begin;

-- Drop existing FK if present
alter table if exists public.appointments
  drop constraint if exists appointments_lead_id_fkey;

-- Recreate FK with ON DELETE CASCADE
alter table public.appointments
  add constraint appointments_lead_id_fkey
  foreign key (lead_id)
  references public.crm_leads(id)
  on delete cascade;

commit;


