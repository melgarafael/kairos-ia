/*
  Product analytics: events table and base views
*/

CREATE TABLE IF NOT EXISTS public.saas_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.saas_users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.saas_organizations(id) ON DELETE SET NULL,
  session_hash text,
  event_name text NOT NULL,
  props jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saas_events ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='saas_events' AND policyname='Users can insert own events'
  ) THEN
    EXECUTE 'DROP POLICY "Users can insert own events" ON public.saas_events';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='saas_events' AND policyname='Users can view own events'
  ) THEN
    EXECUTE 'DROP POLICY "Users can view own events" ON public.saas_events';
  END IF;
END $$;

CREATE POLICY "Users can insert own events"
ON public.saas_events FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own events"
ON public.saas_events FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS saas_events_user_id_idx ON public.saas_events(user_id);
CREATE INDEX IF NOT EXISTS saas_events_org_id_idx ON public.saas_events(organization_id);
CREATE INDEX IF NOT EXISTS saas_events_event_name_idx ON public.saas_events(event_name);
CREATE INDEX IF NOT EXISTS saas_events_created_at_idx ON public.saas_events(created_at);

-- Convenience views (non-materialized for MVP)
CREATE OR REPLACE VIEW public.v_daily_active_users AS
SELECT date_trunc('day', e.created_at) AS day,
       count(DISTINCT e.user_id) AS dau
FROM public.saas_events e
GROUP BY 1
ORDER BY 1 DESC;

CREATE OR REPLACE VIEW public.v_feature_usage_daily AS
SELECT date_trunc('day', e.created_at) AS day,
       e.event_name,
       count(*) AS events
FROM public.saas_events e
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;


