-- ========================================
-- 🔧 FIX TRIGGER HANDLE_NEW_USER - APENAS SAAS_USERS
-- ========================================
-- 
-- FLUXO CORRETO:
-- 1. User clica "Criar conta grátis"
-- 2. Seleciona plano (trial, basic, etc)
-- 3. auth.signUp() cria usuário em auth.users
-- 4. TRIGGER executa handle_new_user()
-- 5. handle_new_user() cria registro em saas_users
-- 6. Frontend busca dados em saas_users
-- 
-- SaaS Organizations NÃO entra neste fluxo!
-- ========================================

-- 1. REMOVER TRIGGER E FUNÇÃO EXISTENTES (se houver problemas)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- 2. VERIFICAR SE TABELA SAAS_PLANS TEM DADOS
DO $$
BEGIN
    -- Verificar se existe pelo menos um plano
    IF NOT EXISTS (SELECT 1 FROM saas_plans WHERE slug = 'trial') THEN
        -- Criar plano trial se não existir
        INSERT INTO saas_plans (
            name,
            slug,
            price_monthly,
            price_yearly,
            features,
            limits,
            active,
            created_at
        ) VALUES (
            'Trial Gratuito',
            'trial',
            0,
            0,
            ARRAY['Até 2 usuários', 'Até 50 pacientes', '14 dias grátis'],
            '{"users": 2, "patients": 50, "storage_gb": 0.5, "appointments_per_month": 100}'::jsonb,
            true,
            NOW()
        );
        
        RAISE NOTICE '✅ Plano trial criado';
    ELSE
        RAISE NOTICE '✅ Plano trial já existe';
    END IF;
END $$;

-- 3. CRIAR FUNÇÃO HANDLE_NEW_USER SIMPLIFICADA
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER -- CRÍTICO: Executa com permissões do owner
SET search_path = public, auth -- CRÍTICO: Acesso aos esquemas
LANGUAGE plpgsql
AS $$
DECLARE
    trial_plan_id uuid;
    user_plan_id uuid;
    user_name text;
BEGIN
    -- Log inicial
    RAISE NOTICE '🔄 [TRIGGER] handle_new_user iniciado para usuário: %', NEW.id;
    RAISE NOTICE '🔍 [TRIGGER] Email: %', NEW.email;
    RAISE NOTICE '🔍 [TRIGGER] User metadata: %', NEW.raw_user_meta_data;
    
    -- Buscar plano trial como padrão
    SELECT id INTO trial_plan_id 
    FROM saas_plans 
    WHERE slug = 'trial' 
    AND active = true 
    LIMIT 1;
    
    IF trial_plan_id IS NULL THEN
        RAISE EXCEPTION '❌ [TRIGGER] Plano trial não encontrado na tabela saas_plans';
    END IF;
    
    RAISE NOTICE '✅ [TRIGGER] Plano trial encontrado: %', trial_plan_id;
    
    -- Extrair plan_id dos metadados (se fornecido)
    user_plan_id := trial_plan_id; -- Padrão
    
    IF NEW.raw_user_meta_data IS NOT NULL THEN
        -- Tentar extrair plan_id dos metadados
        IF NEW.raw_user_meta_data ? 'plan_id' THEN
            -- Se plan_id foi passado como string, buscar o UUID
            IF NEW.raw_user_meta_data->>'plan_id' IS NOT NULL THEN
                SELECT id INTO user_plan_id 
                FROM saas_plans 
                WHERE slug = NEW.raw_user_meta_data->>'plan_id'
                AND active = true;
                
                IF user_plan_id IS NULL THEN
                    RAISE NOTICE '⚠️ [TRIGGER] Plano % não encontrado, usando trial', NEW.raw_user_meta_data->>'plan_id';
                    user_plan_id := trial_plan_id;
                ELSE
                    RAISE NOTICE '✅ [TRIGGER] Plano selecionado: %', NEW.raw_user_meta_data->>'plan_id';
                END IF;
            END IF;
        END IF;
        
        -- Extrair nome do usuário
        user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
    ELSE
        user_name := split_part(NEW.email, '@', 1);
    END IF;
    
    RAISE NOTICE '✅ [TRIGGER] Nome do usuário: %', user_name;
    RAISE NOTICE '✅ [TRIGGER] Plano final: %', user_plan_id;
    
    -- INSERIR EM SAAS_USERS
    BEGIN
        INSERT INTO saas_users (
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
            NEW.id,
            NEW.email,
            'owner', -- Sempre owner para novos usuários
            user_plan_id,
            NULL, -- Será configurado depois
            NULL, -- Será configurado depois
            false, -- Precisa configurar Client Supabase
            true,
            NOW(),
            NOW()
        );
        
        RAISE NOTICE '✅ [TRIGGER] Usuário SaaS criado com sucesso: %', NEW.id;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION '❌ [TRIGGER] Erro ao inserir em saas_users: % - %', SQLSTATE, SQLERRM;
    END;
    
    RETURN NEW;
    
EXCEPTION WHEN OTHERS THEN
    -- Log do erro mas não falha o signup
    RAISE NOTICE '❌ [TRIGGER] ERRO GERAL: % - %', SQLSTATE, SQLERRM;
    RETURN NEW;
END;
$$;

-- 4. CRIAR TRIGGER ON_AUTH_USER_CREATED
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- 5. CONFIGURAR PERMISSÕES PARA RLS
-- Permitir que a função acesse saas_users mesmo com RLS ativo
ALTER TABLE saas_users ENABLE ROW LEVEL SECURITY;

-- Policy para permitir inserção via trigger (SECURITY DEFINER)
DROP POLICY IF EXISTS "Allow trigger insert" ON saas_users;
CREATE POLICY "Allow trigger insert" ON saas_users
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (true);

-- Policy para permitir que usuários vejam seus próprios dados
DROP POLICY IF EXISTS "Users can view own data" ON saas_users;
CREATE POLICY "Users can view own data" ON saas_users
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Policy para permitir que usuários atualizem seus próprios dados
DROP POLICY IF EXISTS "Users can update own data" ON saas_users;
CREATE POLICY "Users can update own data" ON saas_users
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- 6. VERIFICAÇÕES FINAIS
DO $$
DECLARE
    trigger_count integer;
    function_count integer;
    plan_count integer;
BEGIN
    -- Verificar se trigger foi criado
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers
    WHERE trigger_name = 'on_auth_user_created'
    AND event_object_table = 'users'
    AND event_object_schema = 'auth';
    
    -- Verificar se função foi criada
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines
    WHERE routine_name = 'handle_new_user'
    AND routine_schema = 'public';
    
    -- Verificar se planos existem
    SELECT COUNT(*) INTO plan_count
    FROM saas_plans
    WHERE active = true;
    
    -- Relatório final
    RAISE NOTICE '========================================';
    RAISE NOTICE '📊 RELATÓRIO FINAL:';
    RAISE NOTICE '✅ Trigger criado: %', CASE WHEN trigger_count > 0 THEN 'SIM' ELSE 'NÃO' END;
    RAISE NOTICE '✅ Função criada: %', CASE WHEN function_count > 0 THEN 'SIM' ELSE 'NÃO' END;
    RAISE NOTICE '✅ Planos disponíveis: %', plan_count;
    RAISE NOTICE '========================================';
    
    IF trigger_count = 0 THEN
        RAISE EXCEPTION '❌ ERRO: Trigger não foi criado!';
    END IF;
    
    IF function_count = 0 THEN
        RAISE EXCEPTION '❌ ERRO: Função não foi criada!';
    END IF;
    
    IF plan_count = 0 THEN
        RAISE EXCEPTION '❌ ERRO: Nenhum plano ativo encontrado!';
    END IF;
    
    RAISE NOTICE '🎉 SUCESSO: Trigger e função configurados corretamente!';
END $$;

-- 7. TESTE MANUAL DA FUNÇÃO (OPCIONAL)
-- Descomente as linhas abaixo para testar manualmente:

/*
DO $$
DECLARE
    test_user_id uuid := gen_random_uuid();
    test_email text := 'test-trigger@example.com';
    test_metadata jsonb := '{"name": "Test User", "plan_id": "trial"}';
BEGIN
    RAISE NOTICE '🧪 TESTE: Simulando criação de usuário...';
    RAISE NOTICE '🧪 ID: %', test_user_id;
    RAISE NOTICE '🧪 Email: %', test_email;
    RAISE NOTICE '🧪 Metadata: %', test_metadata;
    
    -- Simular dados que o trigger receberia
    PERFORM handle_new_user_test(test_user_id, test_email, test_metadata);
    
    RAISE NOTICE '✅ TESTE: Função executou sem erros!';
END $$;
*/