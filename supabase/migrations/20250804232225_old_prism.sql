CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    plan_uuid uuid;
    new_org_id uuid;
    org_name text;
    org_slug text;
BEGIN
    -- Log para debug
    RAISE NOTICE 'handle_new_user triggered for user: %', NEW.id;

    -- Buscar plano trial como padrão
    SELECT id INTO plan_uuid FROM saas_plans WHERE slug = 'trial' LIMIT 1;

    IF plan_uuid IS NULL THEN
        RAISE NOTICE 'No trial plan found, using NULL';
    END IF;

    -- Determine organization name and slug
    org_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.email);
    org_slug := LOWER(REPLACE(REPLACE(REPLACE(org_name, ' ', '-'), '.', ''), '@', ''));
    -- Ensure slug is unique, append part of UUID if necessary
    SELECT org_slug || CASE WHEN EXISTS (SELECT 1 FROM saas_organizations WHERE slug = org_slug) THEN '-' || SUBSTRING(gen_random_uuid()::text FROM 1 FOR 4) ELSE '' END
    INTO org_slug;

    -- Inserir nova organização
    INSERT INTO saas_organizations (
        name,
        slug,
        owner_id,
        created_at,
        updated_at
    ) VALUES (
        org_name,
        org_slug,
        NEW.id,
        NOW(),
        NOW()
    )
    RETURNING id INTO new_org_id;

    RAISE NOTICE 'New organization created: % (ID: %)', org_name, new_org_id;

    -- Inserir na saas_users
    INSERT INTO saas_users (
        id,
        email,
        role,
        plan_id,
        organization_id, -- Add organization_id here
        setup_completed,
        active,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        'owner',
        plan_uuid,
        new_org_id, -- Assign the new organization ID
        false,
        true,
        NOW(),
        NOW()
    );

    RAISE NOTICE 'saas_users entry created for user: % with organization_id: %', NEW.id, new_org_id;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;