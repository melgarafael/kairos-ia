-- Add client_org_id to master saas_organizations to reference client-side org UUID

ALTER TABLE public.saas_organizations
ADD COLUMN IF NOT EXISTS client_org_id uuid;

-- Helpful index for owner + client mapping
CREATE INDEX IF NOT EXISTS saas_organizations_owner_client_idx
  ON public.saas_organizations(owner_id, client_org_id);

-- Prevent duplicates for the same owner/client org pair
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'saas_organizations_owner_client_unique'
  ) THEN
    ALTER TABLE public.saas_organizations
    ADD CONSTRAINT saas_organizations_owner_client_unique
    UNIQUE (owner_id, client_org_id);
  END IF;
END $$;


