/*
  # Funções Master do Sistema SaaS

  1. Funções
    - `handle_new_user()`: Trigger para criar usuário SaaS e organização
    - `update_updated_at_column()`: Trigger para atualizar updated_at
    - `update_saas_users_updated_at()`: Trigger específico para saas_users

  2. Segurança
    - Funções com SECURITY DEFINER para bypass RLS quando necessário
    - Logs detalhados para debug
*/

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função específica para saas_users
CREATE OR REPLACE FUNCTION update_saas_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função principal: handle_new_user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  plan_uuid uuid;
  org_uuid uuid;
  org_name text;
  org_slug text;
BEGIN
  -- Log para debug
  RAISE NOTICE 'handle_new_user triggered for user: % with email: %', NEW.id, NEW.email;
  
  -- Buscar plano trial como padrão
  SELECT id INTO plan_uuid FROM saas_plans WHERE slug = 'trial' LIMIT 1;
  
  IF plan_uuid IS NULL THEN
    RAISE NOTICE 'No trial plan found, using NULL';
  ELSE
    RAISE NOTICE 'Found trial plan: %', plan_uuid;
  END IF;
  
  -- Gerar nome e slug da organização baseado no email
  org_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)) || '''s Organization';
  org_slug := lower(replace(replace(split_part(NEW.email, '@', 1), '.', '-'), '_', '-')) || '-org';
  
  -- Garantir slug único
  WHILE EXISTS (SELECT 1 FROM saas_organizations WHERE slug = org_slug) LOOP
    org_slug := org_slug || '-' || floor(random() * 1000)::text;
  END LOOP;
  
  RAISE NOTICE 'Creating organization: % with slug: %', org_name, org_slug;
  
  -- Criar organização
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
  ) RETURNING id INTO org_uuid;
  
  RAISE NOTICE 'Organization created with ID: %', org_uuid;
  
  -- Inserir na saas_users
  INSERT INTO saas_users (
    id,
    email,
    role,
    plan_id,
    organization_id,
    setup_completed,
    active,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    'owner',
    plan_uuid,
    org_uuid,
    false,
    true,
    NOW(),
    NOW()
  );
  
  RAISE NOTICE 'saas_users entry created for user: % with organization: %', NEW.id, org_uuid;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in handle_new_user: % - %', SQLSTATE, SQLERRM;
  -- Não falhar o signup mesmo se der erro
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
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