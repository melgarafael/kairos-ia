-- 07-master-rpc-functions.sql

-- Função para verificar se um email já existe na tabela saas_users
-- Esta função é SECURITY DEFINER para ignorar RLS e permitir a verificação por anon
CREATE OR REPLACE FUNCTION public.check_saas_user_email_exists(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    email_exists boolean;
BEGIN
    SELECT EXISTS (SELECT 1 FROM public.saas_users WHERE email = p_email) INTO email_exists;
    RETURN email_exists;
END;
$$;

-- Conceder permissão de execução para o papel anon (usuários não autenticados)
GRANT EXECUTE ON FUNCTION public.check_saas_user_email_exists(text) TO anon;