SET search_path = public, auth;

-- Trilhas como produtos: armazenar lista de UUIDs (separados por vírgula) no Master
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'saas_users' AND column_name = 'trail_product_ids'
  ) THEN
    ALTER TABLE public.saas_users ADD COLUMN trail_product_ids text;
    COMMENT ON COLUMN public.saas_users.trail_product_ids IS 'Comma-separated UUIDs of trail products granted to this user.';
  END IF;
END $$;


