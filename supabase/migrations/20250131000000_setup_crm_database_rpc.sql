-- ============================================
-- CREATE setup_crm_database RPC FUNCTION
-- ============================================
-- Esta função é chamada quando uma organização é criada/selecionada
-- para fazer o setup inicial do banco de dados do cliente.
-- 
-- Por enquanto, é uma função stub que retorna sucesso para evitar
-- erros 404. Pode ser expandida no futuro para criar estágios padrão,
-- serviços padrão, etc.
-- ============================================

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

