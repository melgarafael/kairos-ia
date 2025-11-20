-- =====================================================
-- ACCOUNT TYPE MANAGEMENT RPC
-- =====================================================
-- RPC para atualizar account_type de usuários (apenas admins)
-- =====================================================

CREATE OR REPLACE FUNCTION update_user_account_type(
  p_target_user_id UUID,
  p_account_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Validar account_type
  IF p_account_type NOT IN ('padrao', 'profissional', 'estudante') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tipo de conta inválido');
  END IF;

  -- Atualizar account_type
  UPDATE public.saas_users
  SET 
    account_type = p_account_type,
    updated_at = NOW()
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Tipo de conta atualizado com sucesso'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION update_user_account_type TO authenticated;

-- =====================================================
-- FIM
-- =====================================================

