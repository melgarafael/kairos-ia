-- Add conversion flag to crm_stages so organizations can choose their conversion stage

begin;

alter table public.crm_stages
  add column if not exists is_conversion_stage boolean not null default false;

-- Optional: ensure only one conversion stage per organization (soft, not strict):
-- We won't add a partial unique index now to avoid migration conflicts; logic handled in app.

commit;


