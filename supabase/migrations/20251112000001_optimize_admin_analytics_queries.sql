-- ============================================
-- OPTIMIZE ADMIN ANALYTICS QUERIES
-- ============================================
-- Fix timeout issues in feature_rank and DAU queries
-- by optimizing functions and adding proper indexes
-- ============================================

-- 1. Optimize feature_rank function to filter BEFORE grouping
-- This prevents scanning the entire table before filtering by date
CREATE OR REPLACE FUNCTION public.feature_rank(
  p_from timestamptz,
  p_to   timestamptz
)
RETURNS TABLE (
  feature_key text,
  users bigint,
  events bigint,
  adoption_pct numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- Filter events FIRST, then group - much faster on large tables
  WITH filtered_events AS (
    SELECT 
      e.user_id,
      e.event_name,
      (e.props->>'feature')::text as feature_key,
      e.created_at
    FROM public.saas_events e
    WHERE e.created_at >= p_from
      AND e.created_at <= p_to
      AND e.event_name IN ('app_open', 'feature_used')
  ),
  -- Calculate denominator (total distinct users) from filtered events
  denom AS (
    SELECT count(DISTINCT user_id)::bigint as total
    FROM filtered_events
    WHERE event_name IN ('app_open', 'feature_used')
  ),
  -- Count distinct users per feature from filtered events
  users AS (
    SELECT 
      feature_key,
      count(DISTINCT user_id)::bigint as users
    FROM filtered_events
    WHERE event_name = 'feature_used'
      AND feature_key IS NOT NULL
    GROUP BY feature_key
  ),
  -- Count events per feature from filtered events
  events AS (
    SELECT 
      feature_key,
      count(*)::bigint as events
    FROM filtered_events
    WHERE event_name = 'feature_used'
      AND feature_key IS NOT NULL
    GROUP BY feature_key
  )
  SELECT 
    coalesce(u.feature_key, e.feature_key) as feature_key,
    coalesce(u.users, 0)::bigint as users,
    coalesce(e.events, 0)::bigint as events,
    CASE 
      WHEN d.total > 0 THEN round(100.0 * coalesce(u.users, 0)::numeric / d.total::numeric, 2)
      ELSE 0::numeric
    END as adoption_pct
  FROM users u
  FULL OUTER JOIN events e USING (feature_key)
  CROSS JOIN denom d
  WHERE coalesce(u.feature_key, e.feature_key) IS NOT NULL
  ORDER BY users DESC NULLS LAST, events DESC NULLS LAST
  LIMIT 100;  -- Limit results to prevent huge result sets
$$;

COMMENT ON FUNCTION public.feature_rank IS 'Ranks features by distinct users and events within a time window. Optimized to filter BEFORE grouping to avoid timeouts on large tables.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.feature_rank TO service_role;
GRANT EXECUTE ON FUNCTION public.feature_rank TO authenticated;
GRANT EXECUTE ON FUNCTION public.feature_rank TO anon;

-- 2. Create optimized RPC function for DAU that filters by date BEFORE grouping
-- This replaces the view query which scans all data before filtering
CREATE OR REPLACE FUNCTION public.daily_active_users_features(
  p_from timestamptz,
  p_to   timestamptz
)
RETURNS TABLE (
  day timestamptz,
  dau bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    date_trunc('day', e.created_at) AS day,
    count(DISTINCT e.user_id)::bigint AS dau
  FROM public.saas_events e
  WHERE e.event_name = 'feature_used'
    AND e.created_at >= p_from
    AND e.created_at <= p_to
  GROUP BY date_trunc('day', e.created_at)
  ORDER BY day ASC;
$$;

COMMENT ON FUNCTION public.daily_active_users_features IS 'Returns daily active users count filtered by date range. Filters BEFORE grouping to avoid timeouts on large tables.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.daily_active_users_features TO service_role;
GRANT EXECUTE ON FUNCTION public.daily_active_users_features TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_active_users_features TO anon;

-- 3. Ensure we have proper indexes for these queries
-- Composite index for event_name + created_at (most common filter pattern)
CREATE INDEX IF NOT EXISTS saas_events_event_name_created_at_idx
  ON public.saas_events (event_name, created_at DESC);

-- Index for props->>'feature' extraction (used in feature_rank)
-- Using B-tree index on extracted text value (GIN doesn't work with text directly)
CREATE INDEX IF NOT EXISTS saas_events_props_feature_idx
  ON public.saas_events ((props->>'feature'))
  WHERE event_name = 'feature_used' AND props->>'feature' IS NOT NULL;

-- Composite index for user_id + created_at (used in DAU calculations)
CREATE INDEX IF NOT EXISTS saas_events_user_created_idx
  ON public.saas_events (user_id, created_at DESC)
  WHERE event_name = 'feature_used';

COMMENT ON INDEX saas_events_event_name_created_at_idx IS 'Composite index for efficient event_name + date filtering in admin analytics queries';
COMMENT ON INDEX saas_events_props_feature_idx IS 'B-tree index for efficient feature extraction from JSONB props in feature_rank queries';
COMMENT ON INDEX saas_events_user_created_idx IS 'Composite index for efficient user_id + date filtering in DAU calculations';

