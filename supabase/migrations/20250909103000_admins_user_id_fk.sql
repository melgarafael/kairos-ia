/*
  Migrate saas_admins to user_id-based ACL

  - Add nullable user_id referencing saas_users(id)
  - Backfill user_id from email where possible
  - Enforce unique by user_id and drop email PK
  - Keep email for display, but not as identifier
*/

SET search_path = public, auth;

-- 1) Ensure table exists (no-op if already created)
CREATE TABLE IF NOT EXISTS public.saas_admins (
  email text PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);

-- 2) Add column user_id if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'saas_admins' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.saas_admins ADD COLUMN user_id uuid;
  END IF;
END $$;

-- 3) Backfill user_id from saas_users by email (best effort)
UPDATE public.saas_admins a
SET user_id = u.id
FROM public.saas_users u
WHERE a.user_id IS NULL AND lower(a.email) = lower(u.email);

-- 4) Add FK constraint (SET NULL on delete; we keep audit)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saas_admins_user_id_fkey'
  ) THEN
    ALTER TABLE public.saas_admins
      ADD CONSTRAINT saas_admins_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.saas_users(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

-- 5) Add unique index on user_id when not null
CREATE UNIQUE INDEX IF NOT EXISTS saas_admins_user_id_uniq
ON public.saas_admins (user_id)
WHERE user_id IS NOT NULL;

-- 6) Optional: relax email PK to allow multiple historic emails per user
--    We convert PK(email) to a simple unique index, if needed.
DO $$
DECLARE
  has_pk boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.saas_admins'::regclass AND contype = 'p'
  ) INTO has_pk;
  IF has_pk THEN
    -- Drop PK and replace with surrogate PK
    ALTER TABLE public.saas_admins DROP CONSTRAINT IF EXISTS saas_admins_pkey;
    -- Add surrogate id
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='saas_admins' AND column_name='id'
    ) THEN
      ALTER TABLE public.saas_admins ADD COLUMN id uuid DEFAULT gen_random_uuid();
    END IF;
    ALTER TABLE public.saas_admins ADD CONSTRAINT saas_admins_pkey PRIMARY KEY (id);
    -- Preserve uniqueness on email (case-insensitive)
    CREATE UNIQUE INDEX IF NOT EXISTS saas_admins_email_unique_ci ON public.saas_admins (lower(email));
  END IF;
END $$;

-- 7) RLS stays enabled; no policies (service role only)
ALTER TABLE public.saas_admins ENABLE ROW LEVEL SECURITY;


