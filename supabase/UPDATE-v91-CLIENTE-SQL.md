-- v91 – Garantir função manychat_credentials_upsert_full em todos os clientes
-- Investigação: ao chamar /api/v2/manychat/api-key/verify o gateway executa
-- RPC manychat_credentials_upsert_full. Alguns bancos de clientes não tinham
-- a função (ou ela foi removida do cache), resultando em erro:
--   "Could not find the function public.manychat_credentials_upsert_full(...)"
--
-- Esta atualização recria a função de forma idempotente e reatribui permissões.

BEGIN;

-- Remover versões antigas para evitar conflito de assinatura
DROP FUNCTION IF EXISTS public.manychat_credentials_upsert_full();
DROP FUNCTION IF EXISTS public.manychat_credentials_upsert_full(
  uuid, uuid, text, text, text, text, text, text, text
);

CREATE OR REPLACE FUNCTION public.manychat_credentials_upsert_full(
  p_organization_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_api_key text DEFAULT NULL,
  p_tag_resposta_id text DEFAULT NULL,
  p_tag_resposta_nome text DEFAULT NULL,
  p_field_resposta_id text DEFAULT NULL,
  p_field_resposta_nome text DEFAULT NULL,
  p_flow_ns text DEFAULT NULL,
  p_flow_nome text DEFAULT NULL
) RETURNS public.manychat_credentials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.manychat_credentials;
  v_org uuid := p_organization_id;
  v_user uuid := coalesce(p_user_id, auth.uid());
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;

  PERFORM set_config('app.organization_id', v_org::text, true);

  INSERT INTO public.manychat_credentials (
    organization_id,
    user_id,
    api_key,
    tag_resposta_id,
    tag_resposta_nome,
    field_resposta_id,
    field_resposta_nome,
    flow_ns,
    flow_nome
  ) VALUES (
    v_org,
    v_user,
    nullif(btrim(coalesce(p_api_key, '')), ''),
    nullif(btrim(coalesce(p_tag_resposta_id, '')), ''),
    nullif(btrim(coalesce(p_tag_resposta_nome, '')), ''),
    nullif(btrim(coalesce(p_field_resposta_id, '')), ''),
    nullif(btrim(coalesce(p_field_resposta_nome, '')), ''),
    nullif(btrim(coalesce(p_flow_ns, '')), ''),
    nullif(btrim(coalesce(p_flow_nome, '')), '')
  )
  ON CONFLICT (organization_id) DO UPDATE
    SET user_id = coalesce(excluded.user_id, manychat_credentials.user_id),
        api_key = coalesce(excluded.api_key, manychat_credentials.api_key),
        tag_resposta_id = coalesce(excluded.tag_resposta_id, manychat_credentials.tag_resposta_id),
        tag_resposta_nome = coalesce(excluded.tag_resposta_nome, manychat_credentials.tag_resposta_nome),
        field_resposta_id = coalesce(excluded.field_resposta_id, manychat_credentials.field_resposta_id),
        field_resposta_nome = coalesce(excluded.field_resposta_nome, manychat_credentials.field_resposta_nome),
        flow_ns = coalesce(excluded.flow_ns, manychat_credentials.flow_ns),
        flow_nome = coalesce(excluded.flow_nome, manychat_credentials.flow_nome),
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.manychat_credentials_upsert_full(
  uuid, uuid, text, text, text, text, text, text, text
) TO anon, authenticated, service_role;

COMMIT;

-- Registrar versão
INSERT INTO public.app_migrations (version, applied_at)
VALUES ('91', now())
ON CONFLICT (version) DO NOTHING;