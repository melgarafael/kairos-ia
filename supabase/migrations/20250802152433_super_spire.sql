-- Master Supabase - Functions and Triggers
-- Execute this LAST

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  org_id uuid;
  plan_uuid uuid;
  user_name text;
  org_name text;
  org_slug text;
  plan_slug text;
BEGIN
  -- Get user data from auth metadata
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.email);
  org_name := COALESCE(NEW.raw_user_meta_data->>'organization_name', user_name || '''s Organization');
  org_slug := COALESCE(NEW.raw_user_meta_data->>'organization_slug', replace(lower(user_name), ' ', '-'));
  plan_slug := COALESCE(NEW.raw_user_meta_data->>'plan_id', 'trial');

  -- Get plan UUID
  SELECT id INTO plan_uuid 
  FROM saas_plans 
  WHERE slug = plan_slug AND active = true;

  IF plan_uuid IS NULL THEN
    -- Default to trial plan
    SELECT id INTO plan_uuid 
    FROM saas_plans 
    WHERE slug = 'trial' AND active = true;
  END IF;

  -- Create organization
  INSERT INTO saas_organizations (name, slug, owner_id, plan_id, active)
  VALUES (org_name, org_slug, NEW.id, plan_uuid, true)
  RETURNING id INTO org_id;

  -- Create saas_user
  INSERT INTO saas_users (id, email, name, organization_id, role, active, email_verified)
  VALUES (NEW.id, NEW.email, user_name, org_id, 'owner', true, NEW.email_confirmed_at IS NOT NULL);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the signup
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to get user with organization
CREATE OR REPLACE FUNCTION get_user_with_organization(user_email text)
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  organization_id uuid,
  role text,
  active boolean,
  organization_name text,
  organization_slug text,
  setup_completed boolean,
  plan_name text,
  plan_slug text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.name,
    u.organization_id,
    u.role,
    u.active,
    o.name as organization_name,
    o.slug as organization_slug,
    o.setup_completed,
    p.name as plan_name,
    p.slug as plan_slug
  FROM saas_users u
  JOIN saas_organizations o ON u.organization_id = o.id
  LEFT JOIN saas_plans p ON o.plan_id = p.id
  WHERE u.email = user_email AND u.active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;