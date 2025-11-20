-- Add dedicated column to store client's Service Role key (encrypted as Base64)
-- We DO NOT reuse supabase_key_encrypted (which is anon in many setups)

ALTER TABLE public.saas_users
ADD COLUMN IF NOT EXISTS service_role_encrypted text;

-- Optional: basic length check constraint (JWT base64 tends to be long, but we store base64 of JWT)
-- Skipped strict constraint to avoid issues across environments

-- Index for quick lookups by presence (nullable column)
CREATE INDEX IF NOT EXISTS idx_saas_users_service_role_encrypted
ON public.saas_users ((service_role_encrypted IS NOT NULL));


