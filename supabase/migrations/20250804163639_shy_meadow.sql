/*
  # Update saas_organizations schema

  1. New Structure
    - `id` (uuid, primary key)
    - `name` (text, organization name)
    - `slug` (text, unique identifier)

  2. Changes
    - Remove owner_id dependency
    - Remove supabase credentials (moved to saas_users)
    - Simplify to basic organization info only
    - Organizations will be created in Client Supabase after setup
*/

-- Drop existing saas_organizations table if it exists
DROP TABLE IF EXISTS public.saas_organizations CASCADE;

-- Create new simplified saas_organizations table
CREATE TABLE IF NOT EXISTS public.saas_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saas_organizations ENABLE ROW LEVEL SECURITY;

-- Create policies (for future use when we need to list organizations)
CREATE POLICY "Organizations are viewable by everyone"
  ON public.saas_organizations
  FOR SELECT
  TO public
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS saas_organizations_slug_idx ON public.saas_organizations(slug);
CREATE INDEX IF NOT EXISTS saas_organizations_name_idx ON public.saas_organizations(name);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_saas_organizations_updated_at
  BEFORE UPDATE ON public.saas_organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Note: Organizations will now be created in the Client Supabase
-- This table in Master Supabase is just for reference/future features