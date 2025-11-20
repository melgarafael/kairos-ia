-- Add Stripe price id columns to saas_plans (Master)
SET search_path = public, auth;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saas_plans' AND column_name = 'stripe_price_id_monthly'
  ) THEN
    ALTER TABLE public.saas_plans ADD COLUMN stripe_price_id_monthly text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saas_plans' AND column_name = 'stripe_price_id_yearly'
  ) THEN
    ALTER TABLE public.saas_plans ADD COLUMN stripe_price_id_yearly text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saas_plans' AND column_name = 'currency'
  ) THEN
    ALTER TABLE public.saas_plans ADD COLUMN currency text DEFAULT 'BRL';
  END IF;
END $$;

-- Optional: placeholders (preencha com seus price IDs do Stripe após criar os preços)
-- UPDATE public.saas_plans SET stripe_price_id_monthly = 'price_xxx', stripe_price_id_yearly = 'price_yyy' WHERE slug = 'basic';
-- UPDATE public.saas_plans SET stripe_price_id_monthly = 'price_aaa', stripe_price_id_yearly = 'price_bbb' WHERE slug = 'professional';


