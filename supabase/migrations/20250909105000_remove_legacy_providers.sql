-- Remove legacy providers (Evolution and Z-API) - keeping only internal/WuzAPI
-- This is a documentation migration. The constraint is not being updated to avoid breaking existing data.
-- All code has been updated to only use 'internal' provider with WuzAPI.

-- Note: If you want to enforce this constraint, uncomment the following:
-- ALTER TABLE whatsapp_integrations 
-- DROP CONSTRAINT IF EXISTS whatsapp_integrations_provider_check;
--
-- ALTER TABLE whatsapp_integrations 
-- ADD CONSTRAINT whatsapp_integrations_provider_check 
-- CHECK (provider = 'internal');

-- For now, we're just documenting that Evolution and Z-API are no longer supported.
-- All new integrations should use provider = 'internal' with WuzAPI.
