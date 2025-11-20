-- Function to get a saas_user profile by ID, bypassing RLS for internal use (e.g., by authenticated frontend)
CREATE OR REPLACE FUNCTION get_saas_user_profile_by_id(p_user_id uuid)
RETURNS public.saas_users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_profile public.saas_users;
BEGIN
    -- Log for debugging
    RAISE NOTICE '🔥 [RPC] get_saas_user_profile_by_id called for user_id: %', p_user_id;

    -- Select the user profile, bypassing RLS due to SECURITY DEFINER
    SELECT *
    INTO user_profile
    FROM public.saas_users
    WHERE id = p_user_id;

    IF user_profile IS NULL THEN
        RAISE NOTICE '⚠️ [RPC] User profile not found for ID: %', p_user_id;
    ELSE
        RAISE NOTICE '✅ [RPC] User profile found for ID: %', user_profile.id;
    END IF;

    RETURN user_profile;
END;
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION get_saas_user_profile_by_id(uuid) TO authenticated;