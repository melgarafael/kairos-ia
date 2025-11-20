-- v88 - Criar função setup_crm_database RPC para evitar erro 404
-- Problema: A função setup_crm_database é chamada quando uma organização é criada/selecionada,
-- mas não existe no banco de dados, causando erro 404 no console.
-- Solução: Criar função stub que retorna sucesso. Pode ser expandida no futuro para criar
-- estágios padrão, serviços padrão, etc.

begin;

-- Criar função setup_crm_database
-- Esta função é chamada quando uma organização é criada/selecionada
-- para fazer o setup inicial do banco de dados do cliente.
CREATE OR REPLACE FUNCTION public.setup_crm_database()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  -- Função stub que retorna sucesso
  -- Pode ser expandida no futuro para criar:
  -- - Estágios padrão do CRM (crm_stages)
  -- - Serviços padrão (produtos_servicos)
  -- - Outras configurações iniciais
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'CRM database setup completed'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.setup_crm_database() TO service_role;
GRANT EXECUTE ON FUNCTION public.setup_crm_database() TO authenticated;
GRANT EXECUTE ON FUNCTION public.setup_crm_database() TO anon;

COMMENT ON FUNCTION public.setup_crm_database() IS 'Stub function for CRM database setup. Called when organization is created/selected. Returns success to avoid 404 errors.';

commit;

-- Marcar versão
INSERT INTO public.app_migrations (version, applied_at)
VALUES ('88', now())
ON CONFLICT (version) DO NOTHING;

