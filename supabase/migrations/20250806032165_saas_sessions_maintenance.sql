/* Maintenance helpers for SaaS sessions */

-- Optional view for admin dashboards
CREATE OR REPLACE VIEW public.active_user_sessions AS
SELECT s.id,
       s.user_id,
       u.email,
       u.organization_id,
       s.ip_address,
       s.user_agent,
       s.expires_at,
       s.last_seen_at,
       s.created_at
FROM public.saas_sessions s
JOIN public.saas_users u ON u.id = s.user_id
WHERE s.active = true AND s.expires_at > now();



