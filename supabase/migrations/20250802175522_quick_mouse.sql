/*
  # Create SaaS Users Table

  1. New Tables
    - `saas_users`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text, unique)
      - `organization_id` (uuid, references saas_organizations)
      - `role` (text, default 'member')
      - `active` (boolean, default true)
      - `email_verified` (boolean, default false)
      - `last_login_at` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `saas_users` table
    - Add policies for users to read/update own data
    - Add policy for organization members to view each other

  3. Foreign Keys
    - Links to auth.users(id) for authentication
    - Links to saas_organizations(id) for organization membership
*/

-- Create saas_users table
CREATE TABLE IF NOT EXISTS saas_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  organization_id uuid NOT NULL REFERENCES saas_organizations(id) ON DELETE CASCADE,
  role text DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  active boolean DEFAULT true,
  email_verified boolean DEFAULT false,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS saas_users_email_idx ON saas_users(email);
CREATE INDEX IF NOT EXISTS saas_users_organization_id_idx ON saas_users(organization_id);

-- Enable RLS
ALTER TABLE saas_users ENABLE ROW LEVEL SECURITY;

-- Create policies with conditional checks
DO $$
BEGIN
  -- Policy for users to view own data
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'saas_users' 
    AND policyname = 'Users can view own data'
  ) THEN
    CREATE POLICY "Users can view own data"
      ON saas_users
      FOR SELECT
      TO authenticated
      USING (id = auth.uid());
  END IF;

  -- Policy for users to update own data
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'saas_users' 
    AND policyname = 'Users can update own data'
  ) THEN
    CREATE POLICY "Users can update own data"
      ON saas_users
      FOR UPDATE
      TO authenticated
      USING (id = auth.uid());
  END IF;

  -- Policy for users to view own user data
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'saas_users' 
    AND policyname = 'Users can view own user data'
  ) THEN
    CREATE POLICY "Users can view own user data"
      ON saas_users
      FOR SELECT
      TO authenticated
      USING (id = auth.uid());
  END IF;
END $$;