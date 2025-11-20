-- v67 Migration: ensure partial unique indexes and update commit to use columns

create unique index if not exists uniq_crm_leads_org_phone
  on public.crm_leads(organization_id, phone_normalized)
  where phone_normalized is not null;

create unique index if not exists uniq_crm_leads_org_email
  on public.crm_leads(organization_id, email_normalized)
  where email_normalized is not null;

-- Body of function is in UPDATE-v67-CLIENTE-SQL.md (keep in sync)


