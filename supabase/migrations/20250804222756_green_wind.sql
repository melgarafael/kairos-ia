/*
  # Funções RPC para saas_users

  1. Função para verificar setup_completed
  2. Função para atualizar credenciais do cliente
  3. Função para buscar perfil completo do usuário
*/

-- Função para verificar se o setup foi completado
CREATE OR REPLACE FUNCTION check_saas_user_setup_completed(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(setup_completed, false)
    FROM saas_users 
    WHERE id = p_user_id
  );
END;
$$;

-- Função para atualizar credenciais do cliente Supabase
CREATE OR REPLACE FUNCTION update_saas_user_client_credentials(
  p_user_id uuid,
  p_supabase_url text,
  p_supabase_key_encrypted text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE saas_users 
  SET 
    supabase_url = p_supabase_url,
    supabase_key_encrypted = p_supabase_key_encrypted,
    setup_completed = true,
    updated_at = now()
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$;

-- Função para buscar credenciais do cliente
CREATE OR REPLACE FUNCTION get_saas_user_client_credentials(p_user_id uuid)
RETURNS TABLE(
  supabase_url text,
  supabase_key_encrypted text,
  setup_completed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    su.supabase_url,
    su.supabase_key_encrypted,
    su.setup_completed
  FROM saas_users su
  WHERE su.id = p_user_id;
END;
$$;

-- Função para limpar credenciais corrompidas
CREATE OR REPLACE FUNCTION clear_saas_user_client_credentials(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE saas_users 
  SET 
    supabase_url = null,
    supabase_key_encrypted = null,
    setup_completed = false,
    updated_at = now()
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$;