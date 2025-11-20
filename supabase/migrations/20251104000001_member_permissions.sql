-- Member permissions system: visualização e ações por feature
SET search_path = public, auth;

BEGIN;

-- Adicionar colunas de permissões em saas_memberships (JSONB para flexibilidade)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'saas_memberships' AND column_name = 'permissions_view'
  ) THEN
    ALTER TABLE public.saas_memberships ADD COLUMN permissions_view jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'saas_memberships' AND column_name = 'permissions_action'
  ) THEN
    ALTER TABLE public.saas_memberships ADD COLUMN permissions_action jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Índice GIN para queries eficientes em JSONB
CREATE INDEX IF NOT EXISTS idx_saas_memberships_permissions_view 
  ON public.saas_memberships USING gin (permissions_view);

CREATE INDEX IF NOT EXISTS idx_saas_memberships_permissions_action 
  ON public.saas_memberships USING gin (permissions_action);

-- RPC para obter permissões efetivas de um membro em uma organização
CREATE OR REPLACE FUNCTION public.get_member_permissions(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role text;
  v_view_perms jsonb := '{}'::jsonb;
  v_action_perms jsonb := '{}'::jsonb;
  v_is_owner boolean := false;
  v_has_custom_view boolean := false;
  v_has_custom_action boolean := false;
BEGIN
  -- Verificar se é owner da organização
  SELECT EXISTS(
    SELECT 1 FROM public.saas_organizations 
    WHERE client_org_id = p_organization_id 
    AND owner_id = p_user_id
  ) INTO v_is_owner;

  -- Owner tem todas as permissões
  IF v_is_owner THEN
    RETURN jsonb_build_object(
      'role', 'owner',
      'is_owner', true,
      'view', jsonb_build_object(
        'monetization_trail', true,
        'ai_assistant', true,
        'rm_leads', true,
        'leads_list', true,
        'agenda', true,
        'financial', true,
        'ai_performance', true,
        'training_system', true,
        'workflow', true,
        'products', true,
        'reports', true,
        'consultations', true,
        'collaborators', true,
        'clients', true
      ),
      'action', jsonb_build_object(
        'crm_leads', true,
        'leads_list', true,
        'agenda', true,
        'financial', true,
        'ai_assistant', true,
        'ai_performance', true,
        'training_system', true,
        'workflow', true,
        'products', true,
        'reports', true,
        'consultations', true,
        'collaborators', true
      )
    );
  END IF;

  -- Buscar membership e permissões customizadas
  SELECT role, COALESCE(permissions_view, '{}'::jsonb), COALESCE(permissions_action, '{}'::jsonb)
  INTO v_role, v_view_perms, v_action_perms
  FROM public.saas_memberships
  WHERE saas_user_id = p_user_id
    AND organization_id_in_client = p_organization_id
    AND status = 'active'
  LIMIT 1;

  -- Se não encontrou membership, retornar sem permissões
  IF v_role IS NULL THEN
    RETURN jsonb_build_object(
      'role', NULL,
      'is_owner', false,
      'view', '{}'::jsonb,
      'action', '{}'::jsonb
    );
  END IF;

  -- 🔑 REGRA CRÍTICA: Se permissões customizadas estão definidas (não vazias), usar APENAS elas
  -- Não aplicar defaults de role quando há permissões personalizadas configuradas
  -- Verificar se há chaves definidas (permissões customizadas configuradas)
  -- Verificar se permissions_view tem pelo menos uma chave definida (não vazio ou vazio sem chaves)
  IF v_view_perms IS NOT NULL AND v_view_perms != '{}'::jsonb THEN
    BEGIN
      SELECT EXISTS(SELECT 1 FROM jsonb_object_keys(v_view_perms) LIMIT 1) INTO v_has_custom_view;
    EXCEPTION WHEN OTHERS THEN
      v_has_custom_view := false;
    END;
  ELSE
    v_has_custom_view := false;
  END IF;
  
  -- Verificar se permissions_action tem pelo menos uma chave definida
  IF v_action_perms IS NOT NULL AND v_action_perms != '{}'::jsonb THEN
    BEGIN
      SELECT EXISTS(SELECT 1 FROM jsonb_object_keys(v_action_perms) LIMIT 1) INTO v_has_custom_action;
    EXCEPTION WHEN OTHERS THEN
      v_has_custom_action := false;
    END;
  ELSE
    v_has_custom_action := false;
  END IF;
  
  -- Se NÃO há permissões customizadas definidas, aplicar defaults baseados no role
  IF NOT v_has_custom_view THEN
    -- Para admin, dar todas as permissões de visualização por padrão
    IF v_role = 'admin' THEN
        v_view_perms := jsonb_build_object(
          'monetization_trail', true,
          'ai_assistant', true,
          'rm_leads', true,
          'leads_list', true,
          'agenda', true,
          'financial', true,
          'ai_performance', true,
          'training_system', true,
          'workflow', true,
          'products', true,
          'reports', true,
          'consultations', true,
          'collaborators', true,
          'clients', true
        );
      ELSIF v_role = 'member' THEN
        v_view_perms := jsonb_build_object(
          'monetization_trail', true,
          'ai_assistant', true,
          'rm_leads', true,
          'leads_list', true,
          'agenda', true,
          'financial', true,
          'ai_performance', true,
          'training_system', true,
          'workflow', true,
          'products', true,
          'reports', true,
          'consultations', true,
          'collaborators', true,
          'clients', true
        );
      ELSIF v_role = 'viewer' THEN
        v_view_perms := '{}'::jsonb; -- Viewer sem permissões customizadas = sem acesso
      ELSE
        v_view_perms := '{}'::jsonb;
      END IF;
  END IF;
  -- Se tem permissões customizadas, manter v_view_perms como está (já preenchido com valores personalizados)

  IF NOT v_has_custom_action THEN
    -- Para admin, dar todas as permissões de ação por padrão
    IF v_role = 'admin' THEN
        v_action_perms := jsonb_build_object(
          'crm_leads', true,
          'leads_list', true,
          'agenda', true,
          'financial', true,
          'ai_assistant', true,
          'ai_performance', true,
          'training_system', true,
          'workflow', true,
          'products', true,
          'reports', true,
          'consultations', true,
          'collaborators', true
        );
      ELSIF v_role = 'member' OR v_role = 'viewer' THEN
        v_action_perms := jsonb_build_object(
          'crm_leads', false,
          'leads_list', false,
          'agenda', false,
          'financial', false,
          'ai_assistant', false,
          'ai_performance', false,
          'training_system', false,
          'workflow', false,
          'products', false,
          'reports', false,
          'consultations', false,
          'collaborators', false
        );
      ELSE
        v_action_perms := '{}'::jsonb;
    END IF;
  END IF;
  -- Se tem permissões customizadas, manter v_action_perms como está (já preenchido com valores personalizados)

  RETURN jsonb_build_object(
    'role', v_role,
    'is_owner', false,
    'view', v_view_perms,
    'action', v_action_perms
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_member_permissions(uuid, uuid) TO authenticated, anon;

COMMIT;

