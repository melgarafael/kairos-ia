/*
  # Master SaaS Users Table

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

  3. Functions
    - Trigger function to handle new user registration
*/

-- Create saas_users table
CREATE TABLE IF NOT EXISTS saas_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  organization_id uuid NOT NULL REFERENCES saas_organizations(id) ON DELETE CASCADE,
  role text DEFAULT 'member' NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  email_verified boolean DEFAULT false,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add active column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saas_users' AND column_name = 'active'
  ) THEN
    ALTER TABLE saas_users ADD COLUMN active boolean DEFAULT true;
  END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_saas_users_organization'
  ) THEN
    ALTER TABLE saas_users ADD CONSTRAINT fk_saas_users_organization 
    FOREIGN KEY (organization_id) REFERENCES saas_organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE saas_users ENABLE ROW LEVEL SECURITY;

-- Create policies only if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'saas_users' AND policyname = 'Users can view own data'
  ) THEN
    CREATE POLICY "Users can view own data" ON saas_users
      FOR SELECT TO authenticated
      USING (id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'saas_users' AND policyname = 'Users can update own data'
  ) THEN
    CREATE POLICY "Users can update own data" ON saas_users
      FOR UPDATE TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'saas_users' AND policyname = 'Users can view own user data'
  ) THEN
    CREATE POLICY "Users can view own user data" ON saas_users
      FOR SELECT TO authenticated
      USING (id = auth.uid());
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS saas_users_email_idx ON saas_users(email);
CREATE INDEX IF NOT EXISTS saas_users_organization_id_idx ON saas_users(organization_id);

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_saas_user()
RETURNS trigger AS $$
BEGIN
  PERFORM 'New user registered: ' || NEW.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created_saas ON auth.users;
CREATE TRIGGER on_auth_user_created_saas
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_saas_user();