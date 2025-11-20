/*
  # Master Functions - Sistema de Auth e Triggers

  1. Funções
    - `handle_new_user()` - Cria usuário em saas_users quando auth.users é criado
    - `update_updated_at_column()` - Atualiza timestamp automaticamente
    - `update_saas_users_updated_at()` - Trigger específico para saas_users

  2. Triggers
    - `on_auth_user_created` - Dispara handle_new_user após INSERT em auth.users
    - `update_saas_users_updated_at` - Atualiza updated_at em saas_users
    - `update_saas_organizations_updated_at` - Atualiza updated_at em saas_organizations

  IMPORTANTE: Este arquivo deve ser executado APENAS UMA VEZ
*/

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Função específica para saas_users
CREATE OR REPLACE FUNCTION update_saas_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- FUNÇÃO PRINCIPAL: Criar usuário em saas_users quando auth.users é criado
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    org_id uuid;
    org_name text;
    org_slug text;
BEGIN
    -- Log para debug
    RAISE LOG 'TRIGGER handle_new_user executado para user_id: %', NEW.id;
    
    -- Gerar nome e slug da organização baseado no email
    org_name := COALESCE(split_part(NEW.email, '@', 1), 'Minha Clínica');
    org_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]', '-', 'g'));
    
    -- Garantir que o slug seja único
    WHILE EXISTS (SELECT 1 FROM saas_organizations WHERE slug = org_slug) LOOP
        org_slug := org_slug || '-' || floor(random() * 1000)::text;
    END LOOP;
    
    -- Criar organização primeiro
    INSERT INTO saas_organizations (name, slug, owner_id)
    VALUES (org_name, org_slug, NEW.id)
    RETURNING id INTO org_id;
    
    RAISE LOG 'Organização criada com ID: % para user: %', org_id, NEW.id;
    
    -- Criar usuário em saas_users com organization_id
    INSERT INTO saas_users (
        id,
        email,
        role,
        organization_id,
        setup_completed,
        active
    ) VALUES (
        NEW.id,
        NEW.email,
        'owner',
        org_id,
        false,
        true
    );
    
    RAISE LOG 'Usuário criado em saas_users: % com org_id: %', NEW.id, org_id;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'ERRO no handle_new_user: % - %', SQLERRM, SQLSTATE;
        -- Não falhar o signup mesmo se houver erro
        RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- REMOVER trigger existente se houver
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- CRIAR trigger para executar handle_new_user
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_saas_users_updated_at ON saas_users;
CREATE TRIGGER update_saas_users_updated_at
    BEFORE UPDATE ON saas_users
    FOR EACH ROW
    EXECUTE FUNCTION update_saas_users_updated_at();

DROP TRIGGER IF EXISTS update_saas_organizations_updated_at ON saas_organizations;
CREATE TRIGGER update_saas_organizations_updated_at
    BEFORE UPDATE ON saas_organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();