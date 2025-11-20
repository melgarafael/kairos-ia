-- Function to count distinct users for a given event_name within a time window
-- This is used for WAU and MAU calculations to avoid loading all records

CREATE OR REPLACE FUNCTION public.count_distinct_users(
  p_event_name text,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (
  count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT count(DISTINCT user_id)::bigint as count
  FROM public.saas_events
  WHERE event_name = p_event_name
    AND created_at >= p_from
    AND created_at <= p_to;
$$;

COMMENT ON FUNCTION public.count_distinct_users IS 'Counts distinct users for a given event_name within a time window. Used for WAU/MAU calculations.';

