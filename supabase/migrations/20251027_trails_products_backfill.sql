SET search_path = public, auth;

-- Backfill: liberar Trilha de Monetização para todos os usuários atuais
-- Garante idempotência (não duplica o UUID no CSV)
DO $$
DECLARE v_id uuid := '8b5e0e5e-1f9e-4db4-a1b1-1a3b9f63f0e1';
BEGIN
  UPDATE public.saas_users su
  SET trail_product_ids = (
    CASE
      WHEN su.trail_product_ids IS NULL OR btrim(su.trail_product_ids) = '' THEN v_id::text
      WHEN position(v_id::text in su.trail_product_ids) > 0 THEN su.trail_product_ids
      ELSE su.trail_product_ids || ',' || v_id::text
    END
  ),
  updated_at = now()
  WHERE TRUE;
END $$;


