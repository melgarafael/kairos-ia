-- Migration: Harden check_user_org_expired_token to resolve org by owner_id or client mapping
-- Context: In some datasets, the user's organization link lives in saas_users.organization_id
--          (client org id). This migration updates the RPC to:
--            1) Try owner_id -> saas_organizations.id (Master Org ID)
--            2) If not found, fetch saas_users.organization_id and try to resolve Master Org by
--               (a) public.saas_organizations.id = user.organization_id OR
--               (b) public.saas_organizations.client_org_id = user.organization_id
--          Once Master Org ID is resolved, it delegates to check_expired_token_for_org.

SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.check_user_org_expired_token(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_client_org_id uuid;           -- saas_users.organization_id (client id em alguns cenários)
  v_result jsonb;                      -- resultado por organização
  v_updated_count int := 0;            -- quantas orgs tiveram plano atualizado
  v_processed_count int := 0;          -- quantas orgs foram verificadas
  v_orgs_updated uuid[] := ARRAY[]::uuid[]; -- lista de orgs atualizadas
  v_master_org_id uuid;                -- org id (Master) atual no loop
  cur refcursor;
BEGIN
  -- 1) Verificar TODAS as organizações do owner (usuário pode possuir várias)
  OPEN cur FOR
    SELECT id
    FROM public.saas_organizations
    WHERE owner_id = p_user_id;

  LOOP
    FETCH cur INTO v_master_org_id;
    EXIT WHEN NOT FOUND;

    IF v_master_org_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Delegar validação desta organização específica
    SELECT public.check_expired_token_for_org(v_master_org_id) INTO v_result;
    v_processed_count := v_processed_count + 1;
    IF COALESCE((v_result->>'updated')::boolean, false) = true THEN
      v_updated_count := v_updated_count + 1;
      v_orgs_updated := array_append(v_orgs_updated, v_master_org_id);
    END IF;
  END LOOP;
  CLOSE cur;

  -- 2) Se nenhuma organização do owner foi processada, tentar fallback via saas_users.organization_id
  IF v_processed_count = 0 THEN
    SELECT organization_id INTO v_user_client_org_id
    FROM public.saas_users
    WHERE id = p_user_id
    LIMIT 1;

    IF v_user_client_org_id IS NOT NULL THEN
      -- Tentar match direto (alguns datasets guardam Master Org ID em saas_users.organization_id)
      SELECT id INTO v_master_org_id
      FROM public.saas_organizations
      WHERE id = v_user_client_org_id
      LIMIT 1;

      -- Se não resolveu, tentar via client_org_id
      IF v_master_org_id IS NULL THEN
        SELECT id INTO v_master_org_id
        FROM public.saas_organizations
        WHERE client_org_id = v_user_client_org_id
        LIMIT 1;
      END IF;

      IF v_master_org_id IS NOT NULL THEN
        SELECT public.check_expired_token_for_org(v_master_org_id) INTO v_result;
        v_processed_count := v_processed_count + 1;
        IF COALESCE((v_result->>'updated')::boolean, false) = true THEN
          v_updated_count := v_updated_count + 1;
          v_orgs_updated := array_append(v_orgs_updated, v_master_org_id);
        END IF;
      END IF;
    END IF;
  END IF;

  -- 3) Se ainda não encontramos nenhuma organização, retornar erro estruturado
  IF v_processed_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Organization not found',
      'updated', false,
      'message', 'No organization found for this user via owner_id or client mapping'
    );
  END IF;

  -- 4) Retornar agregados
  RETURN jsonb_build_object(
    'success', true,
    'processed_count', v_processed_count,
    'updated_count', v_updated_count,
    'organizations_updated', v_orgs_updated
  );
END;
$$;

COMMENT ON FUNCTION public.check_user_org_expired_token(uuid) IS 'Resolves user''s Master Org by owner_id or client mapping, then checks expired tokens and updates plan to Trial Expired when applicable.';

GRANT EXECUTE ON FUNCTION public.check_user_org_expired_token(uuid) TO authenticated, anon;


