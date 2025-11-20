-- Functions to rank features by users/events and compute adoption percentage

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
AS $$
  with denom as (
    select count(distinct user_id) as total
    from public.saas_events
    where created_at >= p_from
      and created_at <= p_to
      and event_name in ('app_open','feature_used')
  ),
  users as (
    select (props->>'feature') as feature_key,
           count(distinct user_id) as users
    from public.saas_events
    where event_name = 'feature_used'
      and created_at >= p_from
      and created_at <= p_to
    group by 1
  ),
  events as (
    select (props->>'feature') as feature_key,
           count(*) as events
    from public.saas_events
    where event_name = 'feature_used'
      and created_at >= p_from
      and created_at <= p_to
    group by 1
  )
  select coalesce(u.feature_key, e.feature_key) as feature_key,
         coalesce(u.users, 0) as users,
         coalesce(e.events, 0) as events,
         case when d.total > 0 then round(100.0 * coalesce(u.users,0) / d.total, 2) else 0 end as adoption_pct
  from users u
  full outer join events e using (feature_key)
  cross join denom d
  order by users desc, events desc;
$$;

COMMENT ON FUNCTION public.feature_rank IS 'Ranks features by distinct users and events within a time window; returns adoption percentage based on total active users in the window.';


