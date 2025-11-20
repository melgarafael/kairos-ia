-- v35 – CRM Leads: custom_fields e índices de apoio à migração

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'custom_fields'
  ) THEN
    ALTER TABLE public.crm_leads ADD COLUMN custom_fields jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS crm_leads_org_whatsapp_idx ON public.crm_leads(organization_id, whatsapp);
CREATE INDEX IF NOT EXISTS crm_leads_org_email_idx ON public.crm_leads(organization_id, email);

INSERT INTO public.app_migrations (version, applied_at)
VALUES ('35', now())
ON CONFLICT (version) DO NOTHING;


