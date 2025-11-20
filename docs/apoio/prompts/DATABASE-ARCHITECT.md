## Blueprint · Supabase Security Hardening (2025-11-16)

### 1. Context
- Supabase lint `0010_security_definer_view` flagged 8 public views still running as security definers, which bypass current RLS and contradict the Tenant Gateway mandate (`docs/status/tenant-gateway-progress.md` § Segurança).
- Supabase lint `0013_rls_disabled_in_public` flagged 12 tables exposed by PostgREST without RLS (backups, queue tables, memberships, history, etc.), leaving data readable/writable by any user who can remove filters on the REST endpoint.
- Goal aligned with `Tomik Coding Doctrine` §§2.1, 2.11: every dataset that remains in `public` must enforce least privilege and rely on the gateway/service role path, never on implicit trust.

### 2. Objectives
1. Views must execute with the caller permissions so that RLS remains effective.
2. Sensitive tables must enforce RLS with explicit policies, allowing:
   - `anon`/`authenticated` read-only access only when strictly required by the frontend (e.g. release tours, version detector).
   - `service_role` full access for backend, Edge Functions and the Tenant Gateway.
3. Document and automate the change via a single idempotent migration.

### 3. Scope
- Views: `v_daily_active_users_features`, `v_daily_active_users`, `crm_funnel`, `financial_summary`, `v_feature_usage_daily`, `dashboard_stats`, `v_owner_client_orgs`, `active_user_sessions`.
- Tables: `saas_users_backup`, `app_migrations`, `updates_tour`, `webhooks_log`, `email_queue`, `saas_memberships`, `saas_invitations`, `saas_org_member_overrides`, `saas_trail_products`, `saas_sync_settings`, `saas_organizations_history`, `client_migration_state`.
- Out of scope: refactors to move objects to private schema or deprecate legacy tables (tracked separately).

### 4. Execution Plan
1. **Migration** `supabase/migrations/20251116094500_secure_views_and_rls.sql`
   - Set `security_invoker = on` for every flagged view (idempotent `ALTER VIEW IF EXISTS ... SET (security_invoker = true)`).
   - Enable + force RLS on each table (`ALTER TABLE ... ENABLE/FORCE ROW LEVEL SECURITY`).
   - Revoke unsafe privileges from `anon`/`authenticated` where tables should be backend-only.
   - Create policies (with `pg_policies` guard) per table:

| Table | Policy summary |
| --- | --- |
| `saas_users_backup` | Service role full access only. |
| `app_migrations` | `anon`/`authenticated` SELECT (read versions); `service_role` manage. |
| `updates_tour` | Same as `app_migrations` (public read, service update). |
| `webhooks_log`, `email_queue`, `saas_org_member_overrides`, `saas_trail_products`, `saas_sync_settings`, `saas_organizations_history`, `client_migration_state`, `saas_memberships`, `saas_invitations` | Service role only, covering SELECT/INSERT/UPDATE/DELETE. |

2. **Validate** locally by running `supabase db lint` (or `supabase db test`) after migration to ensure lint items disappear.
3. **Docs**: update `docs/status/tenant-gateway-progress.md` (Week 4 hardening) once migration merged.

### 5. Acceptance Criteria
- `supabase db lint` reports zero `security_definer_view` and `rls_disabled_in_public` findings for the listed objects.
- Frontend still reads versions/tour data (policies verified with anon key).
- All other tables reject direct `anon`/`authenticated` queries (manual `select *` via anon key returns 401/permission error).

### 6. Risks & Mitigations
- **Legacy clients hitting master directly**: only `app_migrations` + `updates_tour` retain read access; other tables must now go through Tenant Gateway. Communicated via release notes.
- **Edge function drift**: all affected functions already use the service role key (confirmed via code search). Policy names include `_service_role_only` to ease future audits.

### 7. Next Steps
- Implement migration + add automated test snippet (manual lint run notes under `/docs/status/...`).
- Coordinate deployment checklist (Week 4 hardening) after QA confirms no regressions.

---

## Blueprint · RLS Performance & Policy Hygiene (2025-11-16)

### 1. Context
- Supabase lint `0003_auth_rls_initplan` flagged 40+ RLS policies (users, saas_* tables, automation suite, etc.) that call `auth.uid()` / `current_setting()` inside the policy body. PostgreSQL evaluates these volatile calls per row, hurting performance and plan caching.
- Lint `0006_multiple_permissive_policies` surfaced tables with overlapping permissive policies for the same role/action (e.g., `saas_organizations`, `saas_supabases_connections`, `saas_users`, `public.users`), increasing evaluation cost and occasionally weakening the intended block policies.
- Lint `0009_duplicate_index` pointed to redundant BTREE indexes on `saas_events` and `saas_organizations`.

### 2. Objectives
1. Normalize every policy to wrap volatile calls with `SELECT` (per Supabase docs) to avoid re-planning (`(select auth.uid())`, `(select current_setting(...))`).
2. Consolidate or reclassify policies so each `(table, role, action)` has at most one *permissive* policy, keeping additional constraints as `RESTRICTIVE` or moving logic into the remaining policy.
3. Drop redundant indexes to keep planner statistics accurate and reduce maintenance overhead.

### 3. Scope
- Tables: `users`, `notifications`, `saas_users`, `saas_sessions`, `saas_events`, `pesquisa`, `monetization_trail_feedbacks`, `saas_plan_tokens`, `saas_org_subscriptions`, `saas_supabases_connections`, `saas_member_seats_grants`, `admin_schema_diagrams`, `trail_comments`, all `automation_*` tables, and `saas_organizations`.
- Index cleanup: `public.saas_events` (keep `saas_events_event_name_created_at_idx`, drop `saas_events_event_time_idx`) and `public.saas_organizations` (keep `saas_organizations_owner_client_idx`, drop `idx_saas_orgs_owner_client`).
- Out of scope: new functional policies or granting additional roles.

### 4. Execution Plan
1. **Migration `20251116120000_rls_performance_fixes.sql`**
   - `DO $$` helper scans `pg_policies` in `public` and rewrites `auth.<fn>()` / `"auth"."<fn>"()` / `current_setting(...)` via `regexp_replace` to `(select ...)`. Apply via `ALTER POLICY ... USING/ WITH CHECK`.
   - Convert blocking policies (`Block all authenticated direct access` on `saas_organizations`, future blockers) to `AS RESTRICTIVE`.
   - Drop redundant permissive policies:
     - `public.saas_supabases_connections`: remove legacy `ssc_owner_*` + redundant `Owner select supabase connections`; keep a single `Owner manage supabase connections` (`FOR ALL TO authenticated`) and ensure grants remain.
     - `public.saas_users`: drop permissive `"Allow trigger insert"` (users) so only `"Users can insert own profile"` remains for `authenticated`, plus keep trigger-specific policy scoped to `postgres`.
     - `public.users`: replace `"Users can view own profile"` + `"Users can view (same) organization members"` with unified `"Users can view self or organization"` listing `anon, authenticated, authenticator, dashboard_user`.
   - Drop policy `"Allow read for org members"` on `saas_organizations` so access happens only via gateway/view.
   - Set `ALTER POLICY ... AS RESTRICTIVE` where we keep deny policies.
2. **Index cleanup** – drop duplicate indexes via `DROP INDEX IF EXISTS ...`.
3. **Docs** – update `/docs/status/tenant-gateway-progress.md` once lint is clean (Week 4 hardening entry) and note RLS performance improvements.

### 5. Acceptance Criteria
- `supabase db lint` no longer reports `0003`, `0006` or `0009`.
- Blocking policies remain effective (no direct read of sensitive columns).
- Tenant gateway flows unaffected; service-role behavior unchanged.
- Query plans on high-traffic tables (`saas_events`, `automation_*`) show stable `initplan` reuse (verify via `EXPLAIN` after deploy).

### 6. Risks & Mitigations
- **Invisible policy drift**: dynamic rewrite might skip schemas outside `public`. Mitigation: limit scope to `public` (where app data lives) and log rows touched (raise notice).
- **Dropping policies inadvertently removes access**: review every drop/recreate pair, run smoke tests (supabase rpc + gateway), keep docs updated.
- **Extension-managed policies**: skip policies owned by extensions (none expected) by checking `polowner`.

### 7. Next Steps
- Implement migration + run lint locally.
- Validate core CRUD flows (auth signup, notifications, automation, trail comments).
- Update status/report docs after verification.

