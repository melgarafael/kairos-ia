-- Ensure ON CONFLICT target exists for whatsapp_integrations
-- We allow one row per (organization_id, provider) and at most one active per org (kept by partial index)

-- Create a unique index usable by ON CONFLICT
create unique index if not exists uniq_whatsapp_integration_org_provider
  on public.whatsapp_integrations (organization_id, provider);


