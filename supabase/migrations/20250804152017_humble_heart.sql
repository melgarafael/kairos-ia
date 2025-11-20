-- ✅ FUNÇÃO ATÔMICA CORRIGIDA - Resolve dependência circular
-- Cria usuário SaaS + organização em uma única transação

-- 1. Remover função existente se houver
DROP FUNCTION IF EXISTS create_atomic_saas_account(uuid, text, text, text, text, text);

-- 2. Criar função atômica com parâmetros corretos (sem defaults misturados)
CREATE OR REPLACE FUNCTION create_atomic_saas_account(
  user_id uuid,
  user_email text,
  user_role text,
  org_name text,
  org_slug text,
  plan_id text DEFAULT 'trial'
) RETURNS json
SECURITY DEFINER
AS $$
DECLARE
  new_org_id uuid;
  result json;
BEGIN
  -- Log início
  RAISE NOTICE 'Starting atomic account creation for user: % with org: %', user_email, org_name;
  
  -- 1. Criar organização PRIMEIRO (sem owner_id ainda)
  INSERT INTO saas_organizations (
    name, 
    slug, 
    owner_id, 
    setup_completed, 
    active,
    plan_id,
    created_at,
    updated_at
  ) VALUES (
    org_name,
    org_slug,
    user_id, -- Usar o user_id que será criado
    false,
    true,
    (SELECT id FROM saas_plans WHERE slug = plan_id LIMIT 1),
    now(),
    now()
  ) RETURNING id INTO new_org_id;
  
  RAISE NOTICE 'Organization created with ID: %', new_org_id;
  
  -- 2. Criar usuário SaaS DEPOIS (com organization_id válido)
  INSERT INTO saas_users (
    id,
    email,
    organization_id,
    role,
    active,
    created_at,
    updated_at
  ) VALUES (
    user_id,
    user_email,
    new_org_id,
    user_role,
    true,
    now(),
    now()
  );
  
  RAISE NOTICE 'SaaS user created with organization_id: %', new_org_id;
  
  -- 3. Retornar resultado
  result := json_build_object(
    'success', true,
    'user_id', user_id,
    'organization_id', new_org_id,
    'message', 'Account created successfully'
  );
  
  RETURN result;
  
EXCEPTION WHEN OTHERS THEN
  -- Em caso de erro, retornar detalhes
  RAISE NOTICE 'Error in atomic creation: %', SQLERRM;
  
  result := json_build_object(
    'success', false,
    'error', SQLERRM,
    'message', 'Failed to create account atomically'
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 3. Testar se a função foi criada
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'create_atomic_saas_account';

-- 4. Log de confirmação
DO $$
BEGIN
  RAISE NOTICE '✅ Função create_atomic_saas_account criada com sucesso!';
  RAISE NOTICE '🎯 Agora o signup deve funcionar sem constraint violation';
END $$;