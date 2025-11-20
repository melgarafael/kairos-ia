/*
  # Fix Plan UUID Function

  1. Create function with unique name to avoid conflicts
  2. Use proper UUID for plan_id instead of text
  3. Handle plan lookup correctly
*/

-- Drop existing conflicting functions
DROP FUNCTION IF EXISTS public.create_saas_user(uuid, text, text);
DROP FUNCTION IF EXISTS public.create_saas_user(uuid, text, text, uuid);

-- Create new function with unique name and proper UUID handling
CREATE OR REPLACE FUNCTION public.create_saas_user_with_plan(
  user_id uuid,
  user_email text,
  user_role text DEFAULT 'owner',
  plan_id_param uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  final_plan_id uuid;
  result_data jsonb;
BEGIN
  -- Log function call
  RAISE NOTICE 'Creating SaaS user: % with plan: %', user_email, plan_id_param;
  
  -- If no plan_id provided, get trial plan UUID
  IF plan_id_param IS NULL THEN
    SELECT id INTO final_plan_id 
    FROM saas_plans 
    WHERE slug = 'trial' 
    LIMIT 1;
    
    IF final_plan_id IS NULL THEN
      RAISE EXCEPTION 'Trial plan not found in saas_plans table';
    END IF;
    
    RAISE NOTICE 'Using trial plan UUID: %', final_plan_id;
  ELSE
    final_plan_id := plan_id_param;
    RAISE NOTICE 'Using provided plan UUID: %', final_plan_id;
  END IF;
  
  -- Verify plan exists
  IF NOT EXISTS (SELECT 1 FROM saas_plans WHERE id = final_plan_id) THEN
    RAISE EXCEPTION 'Plan with UUID % does not exist', final_plan_id;
  END IF;
  
  -- Insert user
  INSERT INTO saas_users (
    id,
    email,
    role,
    plan_id,
    setup_completed,
    active,
    created_at,
    updated_at
  ) VALUES (
    user_id,
    user_email,
    user_role,
    final_plan_id,
    false,
    true,
    now(),
    now()
  );
  
  RAISE NOTICE 'SaaS user created successfully: %', user_id;
  
  -- Return success
  result_data := jsonb_build_object(
    'success', true,
    'user_id', user_id,
    'plan_id', final_plan_id,
    'message', 'User created successfully'
  );
  
  RETURN result_data;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error creating SaaS user: %', SQLERRM;
  
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'user_id', user_id
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_saas_user_with_plan TO public;

-- Test the function
DO $$
DECLARE
  test_result jsonb;
BEGIN
  -- Test with trial plan lookup
  SELECT create_saas_user_with_plan(
    gen_random_uuid(),
    'test@example.com',
    'owner',
    NULL
  ) INTO test_result;
  
  RAISE NOTICE 'Function test result: %', test_result;
END;
$$;