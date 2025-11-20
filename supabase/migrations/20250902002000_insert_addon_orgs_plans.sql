-- Insert add-on plans for extra organizations
SET search_path = public, auth;

DO $$
BEGIN
  -- Ensure stripe columns exist
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

-- Upsert add-on entries
INSERT INTO public.saas_plans (name, slug, price_monthly, price_yearly, features, limits, active, stripe_price_id_monthly, stripe_price_id_yearly, currency)
VALUES
  ('Organizações Extra 1',  'org-extra-1', 0, 0, ARRAY['Add-on: +1 organização'],  '{"addon_type":"orgs_extra","organizations_extra":1}'::jsonb,  true, 'price_1S2jcqCK8UDAxUazXcK0nQ62', NULL, 'BRL'),
  ('Organizações Extra 5',  'org-extra-5', 0, 0, ARRAY['Add-on: +5 organizações'], '{"addon_type":"orgs_extra","organizations_extra":5}'::jsonb, true, 'price_1S2jd6CK8UDAxUaz0NfMwv9H', NULL, 'BRL'),
  ('Organizações Extra 10', 'org-extra-10',0, 0, ARRAY['Add-on: +10 organizações'],'{"addon_type":"orgs_extra","organizations_extra":10}'::jsonb,true, 'price_1S2je7CK8UDAxUazq1TuY8a5', NULL, 'BRL')
ON CONFLICT (slug) DO UPDATE SET
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  active = true,
  stripe_price_id_monthly = EXCLUDED.stripe_price_id_monthly,
  stripe_price_id_yearly = EXCLUDED.stripe_price_id_yearly,
  currency = COALESCE(EXCLUDED.currency, public.saas_plans.currency);


