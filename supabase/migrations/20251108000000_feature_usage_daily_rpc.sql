-- RPC Function: feature_usage_daily
-- Optimized function to get feature usage by day with date filtering BEFORE grouping
-- This avoids timeout issues when querying large event tables

CREATE OR REPLACE FUNCTION public.feature_usage_daily(
  p_from timestamptz,
  p_to   timestamptz,
  p_event_name text DEFAULT NULL
)
RETURNS TABLE (
  day timestamptz,
  event_name text,
  events bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    date_trunc('day', e.created_at) AS day,
    e.event_name,
    count(*)::bigint AS events
  FROM public.saas_events e
  WHERE e.created_at >= p_from
    AND e.created_at <= p_to
    AND (p_event_name IS NULL OR e.event_name = p_event_name)
  GROUP BY date_trunc('day', e.created_at), e.event_name
  ORDER BY day ASC, event_name ASC;
$$;

COMMENT ON FUNCTION public.feature_usage_daily IS 'Returns daily feature usage counts filtered by date range. Filters BEFORE grouping to avoid timeouts on large tables.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.feature_usage_daily TO service_role;
GRANT EXECUTE ON FUNCTION public.feature_usage_daily TO authenticated;
GRANT EXECUTE ON FUNCTION public.feature_usage_daily TO anon;

-- Create composite index for better performance on date + event_name queries
-- This index helps the RPC function filter efficiently
-- Using DESC on created_at helps with recent date queries (most common use case)
CREATE INDEX IF NOT EXISTS saas_events_created_at_event_name_idx
  ON public.saas_events (created_at DESC, event_name);

COMMENT ON INDEX saas_events_created_at_event_name_idx IS 'Composite index for efficient date+event_name filtering in feature_usage_daily RPC. DESC on created_at optimizes queries for recent dates.';

