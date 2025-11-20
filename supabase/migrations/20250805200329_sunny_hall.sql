/*
  # Revert N8N Credentials and Integration Management

  This migration reverts all changes made by the N8N credentials SQL that was
  accidentally executed on the Master Supabase instead of Client Supabase.

  1. Drop Functions
    - Drop test_n8n_connection function
    - Drop decrypt_n8n_api_key function  
    - Drop encrypt_n8n_api_key function
    - Drop update_n8n_credentials_updated_at function

  2. Drop Triggers
    - Drop update_n8n_credentials_updated_at trigger

  3. Drop Indexes
    - Drop n8n_credentials indexes

  4. Drop Policies
    - Drop RLS policies for n8n_credentials

  5. Drop Table
    - Drop n8n_credentials table completely
*/

-- Drop trigger first
DROP TRIGGER IF EXISTS update_n8n_credentials_updated_at ON n8n_credentials;

-- Drop functions
DROP FUNCTION IF EXISTS update_n8n_credentials_updated_at();
DROP FUNCTION IF EXISTS test_n8n_connection(uuid, text, text);
DROP FUNCTION IF EXISTS decrypt_n8n_api_key(text);
DROP FUNCTION IF EXISTS encrypt_n8n_api_key(text);

-- Drop indexes
DROP INDEX IF EXISTS n8n_credentials_organization_id_idx;
DROP INDEX IF EXISTS n8n_credentials_active_idx;

-- Drop policies (RLS policies are dropped automatically when table is dropped)
DROP POLICY IF EXISTS "Organization members can manage N8N credentials" ON n8n_credentials;

-- Drop table completely
DROP TABLE IF EXISTS n8n_credentials;

-- Verify cleanup
DO $$
BEGIN
  -- Check if table still exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'n8n_credentials'
  ) THEN
    RAISE NOTICE 'WARNING: n8n_credentials table still exists!';
  ELSE
    RAISE NOTICE 'SUCCESS: n8n_credentials table removed successfully';
  END IF;

  -- Check if functions still exist
  IF EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name LIKE '%n8n%'
  ) THEN
    RAISE NOTICE 'WARNING: Some N8N functions may still exist!';
  ELSE
    RAISE NOTICE 'SUCCESS: All N8N functions removed successfully';
  END IF;
END $$;