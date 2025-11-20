/*
  # Master Supabase Functions

  1. Functions
    - `handle_new_user`: Creates user in saas_users when auth.users is created
    - `update_updated_at_column`: Updates updated_at timestamp

  2. Triggers
    - `on_auth_user_created`: Triggers handle_new_user on auth.users insert

  IMPORTANT: This only creates the saas_users entry. Organization creation happens later.
*/

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Log the trigger execution
    RAISE LOG 'handle_new_user triggered for user: %', NEW.id;
    
    -- Insert into saas_users table
    INSERT INTO public.saas_users (
        id,
        email,
        role,
        setup_completed,
        active,
        organization_id
    ) VALUES (
        NEW.id,
        NEW.email,
        'owner',
        false,
        true,
        NULL  -- Organization will be created later when user sets up client Supabase
    );
    
    RAISE LOG 'Successfully created saas_users entry for user: %', NEW.id;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
        -- Don't re-raise the error to avoid breaking user signup
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();