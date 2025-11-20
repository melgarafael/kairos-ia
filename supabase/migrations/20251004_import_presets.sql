/*
  # Import presets for mapping and defaults

  - Table: import_presets
    id uuid pk
    organization_id uuid not null
    feature text not null -- e.g. 'produtos_servicos'
    name text not null default 'default'
    mapping jsonb not null default '{}'::jsonb -- header->field map
    options jsonb not null default '{}'::jsonb -- e.g. { limit: 2000 }
    created_at timestamptz default now()
    updated_at timestamptz default now()

  - RLS + dev permissive policy
*/

CREATE TABLE IF NOT EXISTS public.import_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  feature text NOT NULL,
  name text NOT NULL DEFAULT 'default',
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.import_presets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'import_presets' AND policyname = 'Dev: acesso total import_presets'
  ) THEN
    CREATE POLICY "Dev: acesso total import_presets" ON public.import_presets FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS import_presets_org_feature_idx ON public.import_presets(organization_id, feature);


