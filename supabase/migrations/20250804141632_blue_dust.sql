/*
  # Master Supabase - Funções para Criação Manual de Usuários

  Este arquivo contém as funções RPC necessárias para criar usuários e organizações
  manualmente quando o trigger automático não funciona.

  ## Funções incluídas:
  1. create_saas_user - Cria usuário na tabela saas_users
  2. link_user_to_organization - Associa usuário a uma organização
  3. create_saas_organization - Cria organização (já existe)

  ## Ordem de execução:
  1. Usuário → create_saas_user
  2. Organização → create_saas_organization  
  3. Associação → link_user_to_organization
*/

-- 1. Função para criar usuário SaaS (sem organization_id inicialmente)
CREATE OR REPLACE FUNCTION create_saas_user(
  user_id uuid,
  user_email text,
  user_role text DEFAULT 'owner'
) RETURNS uuid
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO saas_users (id, email, organization_id, role, active)
  VALUES (user_id, user_email, NULL, user_role, true)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    active = EXCLUDED.active;
  
  RETURN user_id;
END;
$$ LANGUAGE plpgsql;

-- 2. Função para associar usuário a organização
CREATE OR REPLACE FUNCTION link_user_to_organization(
  user_id uuid,
  org_id uuid
) RETURNS boolean
SECURITY DEFINER
AS $$
BEGIN
  UPDATE saas_users 
  SET organization_id = org_id
  WHERE id = user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 3. Verificar se a função create_saas_organization já existe
-- (Você já criou esta função, mas vou garantir que está correta)
CREATE OR REPLACE FUNCTION create_saas_organization(
  org_name text,
  org_slug text,
  owner_user_id uuid
) RETURNS uuid
SECURITY DEFINER
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  INSERT INTO saas_organizations (name, slug, owner_id, setup_completed, active)
  VALUES (org_name, org_slug, owner_user_id, false, true)
  RETURNING id INTO new_org_id;
  
  RETURN new_org_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Função completa para criar usuário + organização (alternativa)
CREATE OR REPLACE FUNCTION create_complete_saas_account(
  user_id uuid,
  user_email text,
  org_name text,
  org_slug text
) RETURNS jsonb
SECURITY DEFINER
AS $$
DECLARE
  new_org_id uuid;
  result jsonb;
BEGIN
  -- 1. Criar usuário primeiro
  INSERT INTO saas_users (id, email, organization_id, role, active)
  VALUES (user_id, user_email, NULL, 'owner', true)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = 'owner',
    active = true;
  
  -- 2. Criar organização
  INSERT INTO saas_organizations (name, slug, owner_id, setup_completed, active)
  VALUES (org_name, org_slug, user_id, false, true)
  RETURNING id INTO new_org_id;
  
  -- 3. Associar usuário à organização
  UPDATE saas_users 
  SET organization_id = new_org_id
  WHERE id = user_id;
  
  -- 4. Retornar resultado
  result := jsonb_build_object(
    'user_id', user_id,
    'organization_id', new_org_id,
    'success', true
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;