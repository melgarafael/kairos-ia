-- ========================================
-- TRIGGER SIMPLES QUE FUNCIONA
-- ========================================

-- 1. PRIMEIRO: Criar a função
CREATE OR REPLACE FUNCTION handle_new_user_manual(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_email text;
    user_name text;
    user_metadata jsonb;
    org_id uuid;
    plan_id uuid;
BEGIN
    RAISE NOTICE 'Processando usuário: %', user_id;
    
    -- Buscar dados do usuário
    SELECT email, raw_user_meta_data 
    INTO user_email, user_metadata
    FROM auth.users 
    WHERE id = user_id;
    
    IF user_email IS NULL THEN
        RAISE NOTICE 'Usuário não encontrado: %', user_id;
        RETURN;
    END IF;
    
    RAISE NOTICE 'Usuário encontrado: %', user_email;
    
    -- Extrair dados do metadata
    user_name := COALESCE(user_metadata->>'name', 'Usuário');
    
    -- Buscar plano trial
    SELECT id INTO plan_id FROM saas_plans WHERE slug = 'trial' LIMIT 1;
    
    IF plan_id IS NULL THEN
        RAISE NOTICE 'Plano trial não encontrado!';
        RETURN;
    END IF;
    
    -- Criar organização
    INSERT INTO saas_organizations (
        name,
        slug,
        owner_id,
        plan_id
    ) VALUES (
        COALESCE(user_metadata->>'organization_name', user_name || ' Org'),
        COALESCE(user_metadata->>'organization_slug', lower(replace(user_name, ' ', '-'))),
        user_id,
        plan_id
    ) RETURNING id INTO org_id;
    
    RAISE NOTICE 'Organização criada: %', org_id;
    
    -- Criar saas_user
    INSERT INTO saas_users (
        id,
        email,
        name,
        organization_id,
        role
    ) VALUES (
        user_id,
        user_email,
        user_name,
        org_id,
        'owner'
    );
    
    RAISE NOTICE 'SaaS user criado: %', user_email;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERRO: % - %', SQLSTATE, SQLERRM;
END;
$$;

-- 2. SEGUNDO: Criar a função do trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RAISE NOTICE 'Trigger executado para usuário: %', NEW.id;
    
    -- Chamar função manual
    PERFORM handle_new_user_manual(NEW.id);
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERRO NO TRIGGER: % - %', SQLSTATE, SQLERRM;
        RETURN NEW; -- Não quebrar o signup
END;
$$;

-- 3. TERCEIRO: Criar o trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- 4. QUARTO: Verificar se trigger foi criado
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'on_auth_user_created'
    ) THEN
        RAISE NOTICE 'Trigger criado com sucesso!';
    ELSE
        RAISE NOTICE 'ERRO: Trigger não foi criado!';
    END IF;
END $$;

-- 5. QUINTO: Processar usuário existente
DO $$
DECLARE
    test_user_id uuid;
    users_before int;
    orgs_before int;
    users_after int;
    orgs_after int;
BEGIN
    -- Contar antes
    SELECT count(*) INTO users_before FROM saas_users;
    SELECT count(*) INTO orgs_before FROM saas_organizations;
    
    RAISE NOTICE 'ANTES: % saas_users, % organizações', users_before, orgs_before;
    
    -- Buscar usuário sem saas_user
    SELECT au.id INTO test_user_id
    FROM auth.users au
    LEFT JOIN saas_users su ON au.id = su.id
    WHERE su.id IS NULL
    LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        RAISE NOTICE 'Processando usuário existente: %', test_user_id;
        PERFORM handle_new_user_manual(test_user_id);
    ELSE
        RAISE NOTICE 'Nenhum usuário pendente encontrado';
    END IF;
    
    -- Contar depois
    SELECT count(*) INTO users_after FROM saas_users;
    SELECT count(*) INTO orgs_after FROM saas_organizations;
    
    RAISE NOTICE 'DEPOIS: % saas_users, % organizações', users_after, orgs_after;
    
    IF users_after > users_before THEN
        RAISE NOTICE 'SUCESSO: Usuário processado!';
    ELSE
        RAISE NOTICE 'FALHA: Usuário não foi processado';
    END IF;
END $$;