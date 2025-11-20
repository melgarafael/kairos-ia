-- View: v_daily_active_users_features
-- Distinct active users per day based only on 'feature_used' events

CREATE OR REPLACE VIEW public.v_daily_active_users_features AS
SELECT
  date_trunc('day', e.created_at) AS day,
  count(DISTINCT e.user_id)      AS dau
FROM public.saas_events e
WHERE e.event_name = 'feature_used'
GROUP BY 1
ORDER BY 1 DESC;

-- Helpful index (if not already present) to speed up event_name+created_at filters
CREATE INDEX IF NOT EXISTS saas_events_event_time_idx
  ON public.saas_events (event_name, created_at DESC);


