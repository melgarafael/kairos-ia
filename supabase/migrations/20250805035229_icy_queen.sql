-- Função RPC para atualizar organization_id do usuário SaaS no Master Supabase
CREATE OR REPLACE FUNCTION public.update_saas_user_organization_id(
    p_user_id uuid,
    p_organization_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Atualizar organization_id do usuário
    UPDATE public.saas_users
    SET organization_id = p_organization_id,
        updated_at = now()
    WHERE id = p_user_id;

    -- Verificar se a atualização foi bem-sucedida
    IF FOUND THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE; -- Usuário não encontrado
    END IF;
END;
$$;

-- Conceder permissões de execução para usuários autenticados
GRANT EXECUTE ON FUNCTION public.update_saas_user_organization_id(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_saas_user_organization_id(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.update_saas_user_organization_id(uuid, uuid) TO public;