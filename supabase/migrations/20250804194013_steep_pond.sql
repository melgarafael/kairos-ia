-- =====================================================
-- 1. REMOVER TRIGGER E FUNÇÃO EXISTENTES (SE HOUVER)
-- =====================================================

-- Remover trigger existente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Remover função existente
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE; -- CASCADE para remover dependências

-- =====================================================
-- 2. CRIAR FUNÇÃO handle_new_user COM PERMISSÕES CORRETAS
--    (APENAS INSERE EM saas_users)
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER -- CRÍTICO: Executa com permissões do owner da função (geralmente supabase_admin)
SET search_path = public, auth -- CRÍTICO: Define search_path para acessar auth.users e public.saas_plans
LANGUAGE plpgsql
AS $$
DECLARE
    trial_plan_id uuid;
    user_plan_slug text;
    final_plan_id uuid;
BEGIN
    -- Log detalhado para debug
    RAISE NOTICE '🔥 [TRIGGER] handle_new_user STARTED for user: %', NEW.id;
    RAISE NOTICE '🔥 [TRIGGER] User email: %', NEW.email;
    RAISE NOTICE '🔥 [TRIGGER] User raw_user_meta_data: %', NEW.raw_user_meta_data;
    
    -- 1. Buscar plano 'trial' como padrão
    SELECT id INTO trial_plan_id 
    FROM public.saas_plans 
    WHERE slug = 'trial' 
    LIMIT 1;
    
    -- Se o plano 'trial' não existir, crie-o
    IF trial_plan_id IS NULL THEN
        RAISE NOTICE '⚠️ [TRIGGER] No trial plan found, creating default plan...';
        
        INSERT INTO public.saas_plans (
            name, slug, price_monthly, price_yearly, 
            features, limits, active
        ) VALUES (
            'Trial Gratuito',
            'trial',
            0,
            0,
            ARRAY['Até 2 usuários', 'Até 50 pacientes', '14 dias grátis'],
            '{"users": 2, "patients": 50, "storage_gb": 0.5, "appointments_per_month": 100}'::jsonb,
            true
        ) RETURNING id INTO trial_plan_id;
        
        RAISE NOTICE '✅ [TRIGGER] Trial plan created: %', trial_plan_id;
    END IF;
    
    -- 2. Determinar o plano final para o usuário
    final_plan_id := trial_plan_id; -- Padrão é o plano trial
    
    -- Verificar se o frontend passou um slug de plano nos metadados
    IF NEW.raw_user_meta_data IS NOT NULL AND NEW.raw_user_meta_data ? 'plan_id' THEN
        user_plan_slug := NEW.raw_user_meta_data->>'plan_id';
        RAISE NOTICE '📋 [TRIGGER] User specified plan slug: %', user_plan_slug;

        -- Tentar encontrar o plano pelo slug
        SELECT id INTO final_plan_id 
        FROM public.saas_plans 
        WHERE slug = user_plan_slug
        LIMIT 1;
        
        IF final_plan_id IS NULL THEN
            RAISE NOTICE '⚠️ [TRIGGER] User specified plan slug "%" not found, using trial plan.', user_plan_slug;
            final_plan_id := trial_plan_id;
        ELSE
            RAISE NOTICE '✅ [TRIGGER] Using user specified plan: % (slug: %)', final_plan_id, user_plan_slug;
        END IF;
    END IF;
    
    RAISE NOTICE '📋 [TRIGGER] Final plan_id to use for saas_users: %', final_plan_id;
    
    -- 3. Inserir na tabela public.saas_users
    BEGIN
        INSERT INTO public.saas_users (
            id,
            email,
            role,
            plan_id,
            supabase_url,
            supabase_key_encrypted,
            setup_completed,
            active,
            created_at,
            updated_at
        ) VALUES (
            NEW.id, -- ID do usuário recém-criado em auth.users
            NEW.email,
            'owner', -- Role padrão para o primeiro usuário da conta
            final_plan_id,
            NULL, -- Será configurado depois pelo usuário
            NULL, -- Será configurado depois pelo usuário
            false, -- Setup do Supabase do cliente ainda não foi feito
            true,
            NOW(),
            NOW()
        );
        
        RAISE NOTICE '✅ [TRIGGER] saas_users entry created successfully for user: %', NEW.id;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ [TRIGGER] ERROR inserting into saas_users: %', SQLERRM;
        RAISE NOTICE '❌ [TRIGGER] ERROR detail: %', SQLSTATE;
        -- Não falhar o trigger, apenas logar o erro.
        -- O frontend terá que lidar com a ausência do perfil saas_users.
    END;
    
    RAISE NOTICE '🎉 [TRIGGER] handle_new_user COMPLETED for user: %', NEW.id;
    
    RETURN NEW; -- Retorna o registro NEW para que a inserção em auth.users continue normalmente
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '💥 [TRIGGER] FATAL ERROR in handle_new_user function: %', SQLERRM;
    RAISE NOTICE '💥 [TRIGGER] SQLSTATE: %', SQLSTATE;
    -- Em caso de erro fatal na função, ainda assim retorna NEW para não quebrar a criação do auth user.
    RETURN NEW;
END;
$$;

-- =====================================================
-- 3. CRIAR TRIGGER on_auth_user_created
-- =====================================================

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users -- Dispara após a inserção de um novo usuário em auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user(); -- Executa a função criada acima

-- =====================================================
-- 4. CONFIGURAR PERMISSÕES E RLS
-- =====================================================

-- Conceder permissões de execução para a função (necessário para o trigger)
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;

-- As políticas RLS para saas_users devem ser configuradas para permitir
-- que a função SECURITY DEFINER insira.
-- A política "Allow trigger insert saas_users" é para garantir que o owner da função (postgres)
-- possa inserir, o que é o caso de uma função SECURITY DEFINER.
-- As políticas para 'authenticated' são para o acesso do frontend.

-- Policy para saas_users - permitir inserção via função (para o owner da função)
DROP POLICY IF EXISTS "Allow trigger insert saas_users" ON public.saas_users;
CREATE POLICY "Allow trigger insert saas_users" 
ON public.saas_users 
FOR INSERT 
TO postgres -- O owner da função (postgres)
WITH CHECK (true); -- Permite a inserção

-- As políticas para 'authenticated' (que você já tem) são para o frontend:
-- DROP POLICY IF EXISTS "Users can insert own profile" ON public.saas_users;
-- CREATE POLICY "Users can insert own profile" ON public.saas_users FOR INSERT TO authenticated WITH CHECK (uid() = id);

-- DROP POLICY IF EXISTS "Users can update own data" ON public.saas_users;
-- CREATE POLICY "Users can update own data" ON public.saas_users FOR UPDATE TO authenticated USING (uid() = id);

-- DROP POLICY IF EXISTS "Users can view own data" ON public.saas_users;
-- CREATE POLICY "Users can view own data" ON public.saas_users FOR SELECT TO authenticated USING (uid() = id);

-- =====================================================
-- 5. FUNÇÕES DE TESTE MANUAL (ATUALIZADAS PARA APENAS saas_users)
-- =====================================================

-- Função auxiliar para teste direto da lógica de inserção (sem trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user_direct(
    user_id uuid,
    user_email text,
    user_metadata jsonb
)
RETURNS void
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    trial_plan_id uuid;
    user_plan_slug text;
    final_plan_id uuid;
BEGIN
    RAISE NOTICE '🔥 [DIRECT] handle_new_user_direct STARTED for user: %', user_id;
    
    -- Buscar plano trial
    SELECT id INTO trial_plan_id 
    FROM public.saas_plans 
    WHERE slug = 'trial' 
    LIMIT 1;
    
    final_plan_id := trial_plan_id;
    
    IF user_metadata IS NOT NULL AND user_metadata ? 'plan_id' THEN
        user_plan_slug := user_metadata->>'plan_id';
        SELECT id INTO final_plan_id 
        FROM public.saas_plans 
        WHERE slug = user_plan_slug
        LIMIT 1;
        IF final_plan_id IS NULL THEN
            final_plan_id := trial_plan_id;
        END IF;
    END IF;

    -- Inserir na saas_users
    INSERT INTO public.saas_users (
        id, email, role, plan_id, setup_completed, active, created_at, updated_at
    ) VALUES (
        user_id, user_email, 'owner', final_plan_id, false, true, NOW(), NOW()
    );
    
    RAISE NOTICE '✅ [DIRECT] saas_users entry created';
END;
$$;

-- Função para testar o trigger manualmente (simula a chamada do trigger)
CREATE OR REPLACE FUNCTION public.test_handle_new_user(
    test_user_id uuid,
    test_email text,
    test_name text DEFAULT 'Test User',
    test_plan_slug text DEFAULT 'trial'
)
RETURNS jsonb
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    result jsonb := '{}';
    saas_user_exists boolean := false;
BEGIN
    RAISE NOTICE '🧪 [TEST] Testing handle_new_user with user_id: %', test_user_id;
    
    -- Simular dados do NEW record que o trigger receberia
    DECLARE
        mock_user RECORD;
    BEGIN
        SELECT 
            test_user_id as id,
            test_email as email,
            jsonb_build_object('name', test_name, 'plan_id', test_plan_slug) as raw_user_meta_data
        INTO mock_user;
        
        -- Chamar a função diretamente (simulando o trigger)
        PERFORM public.handle_new_user_direct(
            mock_user.id,
            mock_user.email,
            mock_user.raw_user_meta_data
        );
        
    EXCEPTION WHEN OTHERS THEN
        result := jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'sqlstate', SQLSTATE
        );
        RETURN result;
    END;
    
    -- Verificar se saas_user foi criado
    SELECT EXISTS(
        SELECT 1 FROM public.saas_users WHERE id = test_user_id
    ) INTO saas_user_exists;
    
    result := jsonb_build_object(
        'success', true,
        'saas_user_created', saas_user_exists
    );
    
    RETURN result;
END;
$$;

-- Função para limpar dados de teste e executar o teste manual completo
CREATE OR REPLACE FUNCTION public.test_trigger_manually()
RETURNS jsonb
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    test_result jsonb;
    test_user_id uuid := gen_random_uuid();
    test_email text := 'test-trigger-' || EXTRACT(EPOCH FROM NOW())::text || '@example.com';
BEGIN
    RAISE NOTICE '🧪 [TEST] Executando teste manual completo do trigger...';
    
    -- Limpar dados de teste anteriores (se houver)
    DELETE FROM public.saas_users WHERE id = test_user_id;
    
    -- Chamar a função de teste principal
    SELECT public.test_handle_new_user(
        test_user_id,
        test_email,
        'Manual Test User',
        'trial'
    ) INTO test_result;
    
    -- Limpar dados de teste criados
    DELETE FROM public.saas_users WHERE id = test_user_id;
    
    RAISE NOTICE '✅ [TEST] Teste manual concluído. Resultado: %', test_result;
    
    RETURN test_result;
END;
$$;

-- =====================================================
-- 6. VERIFICAÇÕES FINAIS E INSTRUÇÕES
-- =====================================================

-- Verificar se trigger foi criado
DO $$
DECLARE
    trigger_count integer;
BEGIN
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers 
    WHERE trigger_name = 'on_auth_user_created';
    
    IF trigger_count > 0 THEN
        RAISE NOTICE '✅ Trigger on_auth_user_created criado com sucesso';
    ELSE
        RAISE NOTICE '❌ ERRO: Trigger on_auth_user_created NÃO foi criado!';
    END IF;
END $$;

-- Verificar se função foi criada
DO $$
DECLARE
    function_count integer;
BEGIN
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines 
    WHERE routine_name = 'handle_new_user' AND routine_schema = 'public';
    
    IF function_count > 0 THEN
        RAISE NOTICE '✅ Função public.handle_new_user criada com sucesso';
    ELSE
        RAISE NOTICE '❌ ERRO: Função public.handle_new_user NÃO foi criada!';
    END IF;
END $$;

-- Verificar se plano trial existe (e cria se não)
DO $$
DECLARE
    plan_count integer;
BEGIN
    SELECT COUNT(*) INTO plan_count
    FROM public.saas_plans 
    WHERE slug = 'trial';
    
    IF plan_count > 0 THEN
        RAISE NOTICE '✅ Plano "trial" já existe.';
    ELSE
        RAISE NOTICE '⚠️ Plano "trial" não encontrado. Inserindo...';
        
        INSERT INTO public.saas_plans (
            name, slug, price_monthly, price_yearly, 
            features, limits, active
        ) VALUES (
            'Trial Gratuito',
            'trial',
            0,
            0,
            ARRAY['Até 2 usuários', 'Até 50 pacientes', '14 dias grátis'],
            '{"users": 2, "patients": 50, "storage_gb": 0.5, "appointments_per_month": 100}'::jsonb,
            true
        );
        
        RAISE NOTICE '✅ Plano "trial" criado com sucesso.';
    END IF;
END $$;

-- =====================================================
-- 7. INSTRUÇÕES FINAIS
-- =====================================================

-- Execute esta função para testar o fluxo do trigger manualmente
-- SELECT public.test_trigger_manually();

-- Mostrar status final
SELECT 
    'Trigger on_auth_user_created' as item,
    COUNT(*) as exists_count
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created'

UNION ALL

SELECT 
    'Função public.handle_new_user' as item,
    COUNT(*) as exists_count
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user' AND routine_schema = 'public'

UNION ALL

SELECT 
    'Plano "trial" em saas_plans' as item,
    COUNT(*) as exists_count
FROM public.saas_plans
WHERE slug = 'trial';

-- Wrap the RAISE NOTICE statements in a DO block
DO $$
BEGIN
  RAISE NOTICE '🎉 SETUP COMPLETO! Agora teste o signup no frontend.';
  RAISE NOTICE '📋 Para debug: Verifique os logs do Supabase Dashboard > Logs';
  RAISE NOTICE '🔧 Para teste manual da função: SELECT public.test_handle_new_user(gen_random_uuid(), ''test_manual@example.com'', ''Test User'', ''trial'');';
  RAISE NOTICE '🔧 Para teste manual do fluxo completo (cria e limpa): SELECT public.test_trigger_manually();';
END $$;