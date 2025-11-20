/*
  # Admins ACL and helpers

  - Create `saas_admins` table to manage admin access by email
  - Prepared for use by edge functions with service role
*/

SET search_path = public, auth;

-- Create table if not exists
CREATE TABLE IF NOT EXISTS public.saas_admins (
  email text PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS saas_admins_email_idx ON public.saas_admins (email);

-- Enable RLS (no public policies; edge functions will use service role)
ALTER TABLE public.saas_admins ENABLE ROW LEVEL SECURITY;

-- Optional seed: keep empty by default


