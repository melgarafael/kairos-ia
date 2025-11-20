-- Reverter função criada incorretamente no Master Supabase
-- Execute este SQL no MASTER SUPABASE para remover a função

-- Remover a função update_saas_user_organization_id
DROP FUNCTION IF EXISTS update_saas_user_organization_id(uuid, uuid);

-- Verificar se foi removida
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'update_saas_user_organization_id';

-- Se a query acima não retornar nenhum resultado, a função foi removida com sucesso