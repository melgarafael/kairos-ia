-- =====================================================
-- ADD ESTUDANTE ACCOUNT TYPE
-- =====================================================
-- Adiciona constraint 'estudante' ao account_type
-- =====================================================

-- Verificar se a constraint existe e dropar se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'saas_users_account_type_check'
  ) THEN
    ALTER TABLE public.saas_users DROP CONSTRAINT saas_users_account_type_check;
  END IF;
END $$;

-- Adicionar nova constraint com 'estudante'
ALTER TABLE public.saas_users
ADD CONSTRAINT saas_users_account_type_check
CHECK (account_type IN ('padrao', 'profissional', 'estudante'));

-- =====================================================
-- FIM
-- =====================================================

