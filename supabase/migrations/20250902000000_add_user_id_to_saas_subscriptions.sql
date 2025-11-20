-- Add user_id to saas_subscriptions and helpful indexes
SET search_path = public, auth;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saas_subscriptions' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.saas_subscriptions ADD COLUMN user_id uuid;
  END IF;

  -- Optional FK to saas_users
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'saas_subscriptions' AND constraint_name = 'saas_subscriptions_user_id_fkey'
  ) THEN
    ALTER TABLE public.saas_subscriptions
      ADD CONSTRAINT saas_subscriptions_user_id_fkey FOREIGN KEY (user_id)
      REFERENCES public.saas_users(id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;

  -- Ensure helper columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saas_subscriptions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.saas_subscriptions ADD COLUMN updated_at timestamptz;
  END IF;

  -- Helpful indexes
  CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_user_id ON public.saas_subscriptions(user_id);
  CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_status ON public.saas_subscriptions(status);
  CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_stripe_id ON public.saas_subscriptions(stripe_subscription_id);
END $$;


