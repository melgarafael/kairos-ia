-- Correção completa do Master Supabase
-- Este SQL corrige a estrutura e cria organização para usuários existentes

-- 1. Verificar se tabelas existem
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'saas_organizations') THEN
        CREATE TABLE saas_organizations (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name text NOT NULL,
            slug text UNIQUE NOT NULL,
            owner_id uuid NOT NULL,
            supabase_url text,
            supabase_key_encrypted text,
            setup_completed boolean DEFAULT false,
            plan_id uuid,
            active boolean DEFAULT true,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );
        
        ALTER TABLE saas_organizations ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Tabela saas_organizations criada';
    ELSE
        RAISE NOTICE 'Tabela saas_organizations já existe';
    END IF;
END $$;

-- 2. Verificar se tabela saas_users existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'saas_users') THEN
        CREATE TABLE saas_users (
            id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            email text UNIQUE NOT NULL,
            organization_id uuid REFERENCES saas_organizations(id) ON DELETE CASCADE,
            role text DEFAULT 'owner'::text CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'user'::text])),
            active boolean DEFAULT true,
            email_verified boolean DEFAULT false,
            last_login_at timestamptz,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );
        
        ALTER TABLE saas_users ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Tabela saas_users criada';
    ELSE
        RAISE NOTICE 'Tabela saas_users já existe';
    END IF;
END $$;

-- 3. Verificar se tabela saas_plans existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'saas_plans') THEN
        CREATE TABLE saas_plans (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name text NOT NULL,
            slug text UNIQUE NOT NULL,
            price_monthly numeric(10,2) DEFAULT 0,
            price_yearly numeric(10,2) DEFAULT 0,
            features text[] DEFAULT '{}',
            limits jsonb DEFAULT '{}',
            active boolean DEFAULT true,
            created_at timestamptz DEFAULT now()
        );
        
        ALTER TABLE saas_plans ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Tabela saas_plans criada';
    ELSE
        RAISE NOTICE 'Tabela saas_plans já existe';
    END IF;
END $$;

-- 4. Inserir planos se não existirem
INSERT INTO saas_plans (name, slug, price_monthly, price_yearly, features, limits) VALUES
('Trial', 'trial', 0, 0, ARRAY['Até 2 usuários', 'Até 50 pacientes', '14 dias grátis'], '{"users": 2, "patients": 50, "storage_gb": 0.5}'),
('Básico', 'basic', 97, 970, ARRAY['Até 5 usuários', 'Até 500 pacientes', 'CRM básico'], '{"users": 5, "patients": 500, "storage_gb": 2}'),
('Profissional', 'professional', 197, 1970, ARRAY['Até 15 usuários', 'Pacientes ilimitados', 'Todas funcionalidades'], '{"users": 15, "patients": 2000, "storage_gb": 10}'),
('Enterprise', 'enterprise', 397, 3970, ARRAY['Usuários ilimitados', 'Todas funcionalidades', 'Suporte dedicado'], '{"users": 50, "patients": 10000, "storage_gb": 50}')
ON CONFLICT (slug) DO NOTHING;

-- 5. Criar função para processar novos usuários
CREATE OR REPLACE FUNCTION handle_new_saas_user()
RETURNS trigger AS $$
DECLARE
    org_id uuid;
    trial_plan_id uuid;
    org_name text;
    org_slug text;
    org_email text;
BEGIN
    RAISE NOTICE 'Processando novo usuário: %', NEW.id;
    
    -- Buscar plano trial
    SELECT id INTO trial_plan_id FROM saas_plans WHERE slug = 'trial' LIMIT 1;
    
    -- Extrair dados da organização do user_metadata
    org_name := COALESCE(NEW.raw_user_meta_data->>'organization_name', 'Minha Organização');
    org_slug := COALESCE(NEW.raw_user_meta_data->>'organization_slug', 'org-' || substring(NEW.id::text, 1, 8));
    org_email := NEW.email;
    
    RAISE NOTICE 'Criando organização: % (slug: %)', org_name, org_slug;
    
    -- Criar organização
    INSERT INTO saas_organizations (name, slug, owner_id, plan_id)
    VALUES (org_name, org_slug, NEW.id, trial_plan_id)
    RETURNING id INTO org_id;
    
    RAISE NOTICE 'Organização criada com ID: %', org_id;
    
    -- Criar usuário SaaS
    INSERT INTO saas_users (id, email, organization_id, role)
    VALUES (NEW.id, NEW.email, org_id, 'owner');
    
    RAISE NOTICE 'Usuário SaaS criado e linkado à organização';
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao processar usuário: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Criar trigger se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created') THEN
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION handle_new_saas_user();
        RAISE NOTICE 'Trigger criado';
    ELSE
        RAISE NOTICE 'Trigger já existe';
    END IF;
END $$;

-- 7. Processar usuário existente sem organização
DO $$
DECLARE
    user_record RECORD;
    org_id uuid;
    trial_plan_id uuid;
BEGIN
    -- Buscar plano trial
    SELECT id INTO trial_plan_id FROM saas_plans WHERE slug = 'trial' LIMIT 1;
    
    -- Buscar usuário sem organização
    FOR user_record IN 
        SELECT au.id, au.email 
        FROM auth.users au 
        LEFT JOIN saas_users su ON au.id = su.id 
        WHERE su.id IS NULL OR su.organization_id IS NULL
        LIMIT 5
    LOOP
        RAISE NOTICE 'Processando usuário existente: %', user_record.email;
        
        -- Criar organização para usuário existente
        INSERT INTO saas_organizations (name, slug, owner_id, plan_id)
        VALUES (
            'Organização de ' || split_part(user_record.email, '@', 1),
            'org-' || substring(user_record.id::text, 1, 8),
            user_record.id,
            trial_plan_id
        )
        RETURNING id INTO org_id;
        
        -- Criar ou atualizar saas_users
        INSERT INTO saas_users (id, email, organization_id, role)
        VALUES (user_record.id, user_record.email, org_id, 'owner')
        ON CONFLICT (id) DO UPDATE SET
            organization_id = EXCLUDED.organization_id,
            updated_at = now();
            
        RAISE NOTICE 'Usuário % processado com organização %', user_record.email, org_id;
    END LOOP;
END $$;

-- 8. Criar políticas RLS se não existirem
DO $$
BEGIN
    -- Política para saas_users
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saas_users' AND policyname = 'Users can view own data') THEN
        EXECUTE 'CREATE POLICY "Users can view own data" ON saas_users FOR SELECT TO authenticated USING (id = auth.uid())';
        RAISE NOTICE 'Política saas_users criada';
    END IF;
    
    -- Política para saas_organizations
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saas_organizations' AND policyname = 'Users can view own organization') THEN
        EXECUTE 'CREATE POLICY "Users can view own organization" ON saas_organizations FOR SELECT TO authenticated USING (id IN (SELECT saas_users.organization_id FROM saas_users WHERE saas_users.id = auth.uid()))';
        RAISE NOTICE 'Política saas_organizations criada';
    END IF;
    
    -- Política para saas_plans
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saas_plans' AND policyname = 'Plans are viewable by everyone') THEN
        EXECUTE 'CREATE POLICY "Plans are viewable by everyone" ON saas_plans FOR SELECT TO authenticated USING (active = true)';
        RAISE NOTICE 'Política saas_plans criada';
    END IF;
END $$;

-- 9. Verificação final
DO $$
DECLARE
    users_count int;
    orgs_count int;
    plans_count int;
BEGIN
    SELECT COUNT(*) INTO users_count FROM saas_users;
    SELECT COUNT(*) INTO orgs_count FROM saas_organizations;
    SELECT COUNT(*) INTO plans_count FROM saas_plans;
    
    RAISE NOTICE 'RESULTADO FINAL:';
    RAISE NOTICE 'Usuários SaaS: %', users_count;
    RAISE NOTICE 'Organizações: %', orgs_count;
    RAISE NOTICE 'Planos: %', plans_count;
    
    IF users_count > 0 AND orgs_count > 0 THEN
        RAISE NOTICE 'SUCESSO! Master Supabase configurado corretamente';
    ELSE
        RAISE NOTICE 'ATENÇÃO: Verifique se os dados foram criados corretamente';
    END IF;
END $$;