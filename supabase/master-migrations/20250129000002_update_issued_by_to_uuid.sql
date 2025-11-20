-- Migration: Update issued_by column to support UUID (admin user IDs) while maintaining backward compatibility
-- Currently issued_by is text and stores strings like 'admin', 'provision-subscription', 'api'
-- We want to store UUID of admin users when tokens are issued via admin panel

SET search_path = public, auth;

-- Add a new column to store admin user ID separately (keeping issued_by for backward compatibility)
ALTER TABLE public.saas_plan_tokens
  ADD COLUMN IF NOT EXISTS issued_by_user_id uuid REFERENCES public.saas_users(id) ON DELETE SET NULL;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_spt_issued_by_user ON public.saas_plan_tokens(issued_by_user_id);

COMMENT ON COLUMN public.saas_plan_tokens.issued_by_user_id IS 'UUID of the admin user who issued this token. NULL for tokens issued via API or automated processes.';
COMMENT ON COLUMN public.saas_plan_tokens.issued_by IS 'Legacy field: source/type of token issuance (admin, provision-subscription, api, etc). Kept for backward compatibility.';

