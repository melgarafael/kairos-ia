/*
  # Master Functions and Triggers

  1. Functions
    - `handle_new_user()` - Trigger function to create organization and SaaS user
    - `encrypt_key()` - Simple encryption for client credentials
    - `decrypt_key()` - Simple decryption for client credentials

  2. Triggers
    - `on_auth_user_created` - Automatically create organization when user signs up

  3. Security
    - Functions run with elevated privileges to bypass RLS
    - Automatic organization and user creation
*/

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  trial_plan_id uuid;
  new_org_id uuid;
  user_metadata jsonb;
BEGIN
  -- Get user metadata from auth
  user_metadata := NEW.raw_user_meta_data;
  
  -- Log the trigger execution
  RAISE LOG 'handle_new_user triggered for user: %', NEW.id;
  RAISE LOG 'User metadata: %', user_metadata;
  
  -- Get trial plan ID
  SELECT id INTO trial_plan_id 
  FROM saas_plans 
  WHERE slug = COALESCE(user_metadata->>'plan_id', 'trial')
  LIMIT 1;
  
  IF trial_plan_id IS NULL THEN
    -- Fallback to first available plan
    SELECT id INTO trial_plan_id FROM saas_plans WHERE active = true LIMIT 1;
    RAISE LOG 'Using fallback plan: %', trial_plan_id;
  END IF;
  
  -- Create organization
  INSERT INTO saas_organizations (
    name,
    slug,
    owner_id,
    plan_id,
    active,
    setup_completed
  ) VALUES (
    COALESCE(user_metadata->>'organization_name', user_metadata->>'name' || '''s Organization'),
    COALESCE(user_metadata->>'organization_slug', lower(replace(user_metadata->>'name', ' ', '-'))),
    NEW.id,
    trial_plan_id,
    true,
    false
  ) RETURNING id INTO new_org_id;
  
  RAISE LOG 'Organization created with ID: %', new_org_id;
  
  -- Create SaaS user
  INSERT INTO saas_users (
    id,
    email,
    name,
    organization_id,
    role,
    active,
    email_verified
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(user_metadata->>'name', split_part(NEW.email, '@', 1)),
    new_org_id,
    'owner',
    true,
    NEW.email_confirmed_at IS NOT NULL
  );
  
  RAISE LOG 'SaaS user created for: %', NEW.email;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    -- Don't fail the signup, just log the error
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Simple encryption functions (for client credentials)
CREATE OR REPLACE FUNCTION encrypt_key(key_text text)
RETURNS text AS $$
BEGIN
  -- Simple base64 encoding (in production use proper encryption)
  RETURN encode(key_text::bytea, 'base64');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrypt_key(encrypted_key text)
RETURNS text AS $$
BEGIN
  -- Simple base64 decoding (in production use proper decryption)
  RETURN convert_from(decode(encrypted_key, 'base64'), 'UTF8');
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
GRANT ALL ON auth.users TO postgres, service_role;