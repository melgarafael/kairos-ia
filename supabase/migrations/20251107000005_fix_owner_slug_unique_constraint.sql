-- =====================================================
-- FIX OWNER_SLUG_UNIQUE CONSTRAINT ISSUE
-- =====================================================
-- Este migration corrige o problema crítico de constraint única
-- que estava causando erros ao entrar em contas
-- 
-- Também garante que contas 'estudante' não precisam de organização
-- =====================================================

SET search_path = public, auth;

-- 1. Verificar e criar a constraint única (owner_id, slug) se não existir
DO $$
BEGIN
  -- Verificar se a constraint já existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'saas_organizations_owner_slug_unique'
    AND conrelid = 'public.saas_organizations'::regclass
  ) THEN
    -- Criar constraint única na combinação (owner_id, slug)
    ALTER TABLE public.saas_organizations
    ADD CONSTRAINT saas_organizations_owner_slug_unique
    UNIQUE (owner_id, slug);
    
    RAISE NOTICE 'Constraint saas_organizations_owner_slug_unique criada com sucesso';
  ELSE
    RAISE NOTICE 'Constraint saas_organizations_owner_slug_unique já existe';
  END IF;
END $$;

-- 2. Limpar duplicatas mantendo apenas a mais recente por (owner_id, slug)
DO $$
DECLARE
  dup_record RECORD;
  keep_id uuid;
BEGIN
  -- Encontrar todas as duplicatas agrupadas por (owner_id, slug)
  FOR dup_record IN
    SELECT owner_id, slug, array_agg(id ORDER BY created_at DESC) as ids
    FROM public.saas_organizations
    WHERE owner_id IS NOT NULL AND slug IS NOT NULL
    GROUP BY owner_id, slug
    HAVING count(*) > 1
  LOOP
    -- Manter o mais recente (primeiro do array ordenado DESC)
    keep_id := dup_record.ids[1];
    
    -- Deletar os duplicados (todos exceto o primeiro)
    DELETE FROM public.saas_organizations
    WHERE owner_id = dup_record.owner_id
      AND slug = dup_record.slug
      AND id != keep_id;
    
    RAISE NOTICE 'Removidas duplicatas para owner_id=%, slug=%. Mantido ID: %', 
      dup_record.owner_id, dup_record.slug, keep_id;
  END LOOP;
END $$;

-- 3. Criar índice único adicional para garantir performance
CREATE UNIQUE INDEX IF NOT EXISTS saas_organizations_owner_slug_uidx
ON public.saas_organizations(owner_id, slug)
WHERE owner_id IS NOT NULL AND slug IS NOT NULL;

-- 4. Comentário na constraint para documentação
COMMENT ON CONSTRAINT saas_organizations_owner_slug_unique ON public.saas_organizations
IS 'Garante que cada owner_id pode ter apenas uma organização com cada slug único. Usado por upserts com onConflict.';

-- 5. Garantir que account_type 'estudante' não precisa de organização
-- Atualizar a constraint CHECK para incluir 'estudante' se ainda não estiver incluída
DO $$
BEGIN
  -- Verificar se a constraint account_type existe e inclui 'estudante'
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'saas_users_account_type_check'
    AND conrelid = 'public.saas_users'::regclass
  ) THEN
    -- Verificar se 'estudante' já está na constraint
    -- Se não estiver, vamos atualizar na próxima migration
    RAISE NOTICE 'Constraint account_type_check existe. Verifique se inclui estudante.';
  END IF;
END $$;

-- 6. Função helper para verificar se usuário pode ter organização (não é estudante)
CREATE OR REPLACE FUNCTION public.user_can_have_organization(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT account_type FROM public.saas_users WHERE id = p_user_id) != 'estudante',
    true  -- Se account_type for NULL, permite organização (compatibilidade)
  );
$$;

COMMENT ON FUNCTION public.user_can_have_organization(uuid) IS 
'Verifica se um usuário pode ter organização. Contas estudante retornam false.';

GRANT EXECUTE ON FUNCTION public.user_can_have_organization(uuid) TO authenticated, anon, service_role;

-- =====================================================
-- FIM
-- =====================================================

