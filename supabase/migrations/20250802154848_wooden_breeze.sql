-- Debug e correção do trigger handle_new_user
-- Execute este SQL no Master Supabase para diagnosticar e corrigir

-- 1. Verificar se trigger existe
SELECT 
  trigger_name, 
  event_object_table, 
  action_statement,
  action_timing,
  event_manipulation
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 2. Verificar se função existe
SELECT 
  routine_name, 
  routine_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- 3. Verificar planos (necessário para trigger funcionar)
SELECT id, name, slug FROM saas_plans;

-- 4. Verificar tabelas existem
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('saas_users', 'saas_organizations', 'saas_plans')
ORDER BY table_name;

-- 5. RECRIAR FUNÇÃO HANDLE_NEW_USER (caso não exista ou tenha erro)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  trial_plan_id uuid;
  new_org_id uuid;
  user_metadata jsonb;
BEGIN
  -- Log início da função
  RAISE NOTICE 'TRIGGER: handle_new_user started for user %', NEW.id;
  
  -- Extrair metadata do usuário
  user_metadata := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  
  -- Log metadata recebido
  RAISE NOTICE 'TRIGGER: User metadata: %', user_metadata;
  
  -- Buscar plano trial
  SELECT id INTO trial_plan_id 
  FROM saas_plans 
  WHERE slug = 'trial' 
  LIMIT 1;
  
  IF trial_plan_id IS NULL THEN
    RAISE EXCEPTION 'TRIGGER ERROR: Trial plan not found. Execute 02-master-plans.sql first!';
  END IF;
  
  RAISE NOTICE 'TRIGGER: Trial plan found: %', trial_plan_id;
  
  -- Criar organização
  INSERT INTO saas_organizations (
    name,
    slug,
    owner_id,
    plan_id,
    active,
    setup_completed
  ) VALUES (
    COALESCE(user_metadata->>'organization_name', 'Nova Organização'),
    COALESCE(user_metadata->>'organization_slug', 'org-' || substring(NEW.id::text, 1, 8)),
    NEW.id,
    trial_plan_id,
    true,
    false
  ) RETURNING id INTO new_org_id;
  
  RAISE NOTICE 'TRIGGER: Organization created: %', new_org_id;
  
  -- Criar usuário SaaS
  INSERT INTO saas_users (
    id,
    email,
    name,
    organization_id,
    role,
    active,
    email_verified,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(user_metadata->>'name', split_part(NEW.email, '@', 1)),
    new_org_id,
    'owner',
    true,
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    NOW(),
    NOW()
  );
  
  RAISE NOTICE 'TRIGGER: SaaS user created successfully for %', NEW.email;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'TRIGGER ERROR: % - %', SQLERRM, SQLSTATE;
    -- Não falhar o signup, apenas logar erro
    RETURN NEW;
END;
$$;

-- 6. RECRIAR TRIGGER (caso não exista)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 7. Verificar se trigger foi criado
SELECT 
  trigger_name, 
  event_object_table, 
  action_timing,
  event_manipulation
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 8. TESTAR TRIGGER MANUALMENTE com usuário existente
-- (Execute apenas se quiser testar com usuário atual)
-- SELECT handle_new_user_manual('USER_ID_AQUI', 'email@teste.com', '{"name": "Teste", "organization_name": "Teste Org", "organization_slug": "teste-org"}');

-- 9. Verificar resultado final
SELECT 
  (SELECT count(*) FROM auth.users) as auth_users,
  (SELECT count(*) FROM saas_users) as saas_users,
  (SELECT count(*) FROM saas_organizations) as organizations;

-- 10. Se ainda não funcionar, criar função manual para testar
CREATE OR REPLACE FUNCTION handle_new_user_manual(
  user_id uuid,
  user_email text,
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS text
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  trial_plan_id uuid;
  new_org_id uuid;
  result text;
BEGIN
  -- Buscar plano trial
  SELECT id INTO trial_plan_id FROM saas_plans WHERE slug = 'trial' LIMIT 1;
  
  IF trial_plan_id IS NULL THEN
    RETURN 'ERROR: Trial plan not found';
  END IF;
  
  -- Criar organização
  INSERT INTO saas_organizations (
    name, slug, owner_id, plan_id, active, setup_completed
  ) VALUES (
    COALESCE(metadata->>'organization_name', 'Nova Organização'),
    COALESCE(metadata->>'organization_slug', 'org-' || substring(user_id::text, 1, 8)),
    user_id, trial_plan_id, true, false
  ) RETURNING id INTO new_org_id;
  
  -- Criar usuário SaaS
  INSERT INTO saas_users (
    id, email, name, organization_id, role, active, email_verified
  ) VALUES (
    user_id, user_email,
    COALESCE(metadata->>'name', split_part(user_email, '@', 1)),
    new_org_id, 'owner', true, true
  );
  
  RETURN 'SUCCESS: User and organization created';
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'ERROR: ' || SQLERRM;
END;
$$;