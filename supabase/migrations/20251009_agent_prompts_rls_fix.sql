-- agent_prompts RLS fix: allow writes from anon (UI) with strict org check

BEGIN;

-- Ensure RLS is enabled (idempotent safety)
ALTER TABLE IF EXISTS public.agent_prompts ENABLE ROW LEVEL SECURITY;

-- Recreate modify policy to include anon + authenticated with WITH CHECK
DROP POLICY IF EXISTS agent_prompts_modify_ctx ON public.agent_prompts;
CREATE POLICY agent_prompts_modify_ctx ON public.agent_prompts
  FOR ALL
  TO anon, authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id::text = coalesce(
      NULLIF(current_setting('request.header.x-organization-id', true), ''),
      NULLIF(current_setting('app.organization_id', true), '')
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id::text = coalesce(
      NULLIF(current_setting('request.header.x-organization-id', true), ''),
      NULLIF(current_setting('app.organization_id', true), '')
    )
  );

COMMIT;


