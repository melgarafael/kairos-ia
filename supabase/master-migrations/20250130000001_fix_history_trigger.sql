-- Master: Fix saas_organizations_history trigger for DELETE operations
-- The trigger must be BEFORE DELETE instead of AFTER DELETE to avoid FK constraint violation
-- Safe, idempotent migration for MASTER Supabase

set search_path = public, auth;

-- Drop the existing AFTER DELETE trigger
drop trigger if exists trg_log_saas_org_history_ad on public.saas_organizations;

-- Recreate the trigger function to handle DELETE properly
-- For DELETE, we need to insert BEFORE the deletion happens (BEFORE DELETE trigger)
-- so that the foreign key constraint is satisfied
create or replace function public.fn_log_saas_org_history()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into public.saas_organizations_history(saas_org_id, action, changed_by, old_row, new_row)
    values (new.id, 'insert', null, null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.saas_organizations_history(saas_org_id, action, changed_by, old_row, new_row)
    values (new.id, 'update', null, to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    -- For DELETE, insert BEFORE deletion so foreign key constraint is satisfied
    insert into public.saas_organizations_history(saas_org_id, action, changed_by, old_row, new_row)
    values (old.id, 'delete', null, to_jsonb(old), null);
    return old;
  end if;
  return null;
end
$$;

-- Create BEFORE DELETE trigger (instead of AFTER DELETE)
-- This ensures the history record is inserted while the organization still exists
create trigger trg_log_saas_org_history_ad
  before delete on public.saas_organizations
  for each row execute function public.fn_log_saas_org_history();

