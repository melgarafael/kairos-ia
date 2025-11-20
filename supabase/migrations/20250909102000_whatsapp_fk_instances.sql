-- Link whatsapp_integrations to whatsapp_instances via FKs

-- Ensure whatsapp_instances has unique instance_id and instance_token (already created earlier)
create unique index if not exists whatsapp_instances_instance_uidx on public.whatsapp_instances (instance_id);

-- BACKFILL: create whatsapp_instances rows for existing integrations before adding FKs
-- Only for rows where organization_id looks like a UUID
with src as (
  select 
    wi.organization_id::uuid as org_id,
    wi.instance_id,
    coalesce(nullif(wi.instance_token, ''), encode(gen_random_bytes(24), 'hex')) as instance_token,
    coalesce(org.client_token, encode(gen_random_bytes(24), 'hex')) as client_token
  from public.whatsapp_integrations wi
  left join public.saas_organizations org on org.id = (wi.organization_id::uuid)
  where wi.organization_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
)
insert into public.whatsapp_instances (organization_id, instance_id, instance_token, client_token, is_active)
select s.org_id, s.instance_id, s.instance_token, s.client_token, true
from src s
on conflict (organization_id, instance_id) do update
set instance_token = excluded.instance_token
where public.whatsapp_instances.instance_token is null;

-- Ensure whatsapp_integrations.instance_token matches the instance row
update public.whatsapp_integrations wi
set instance_token = inst.instance_token
from public.whatsapp_instances inst
where wi.instance_id = inst.instance_id
  and wi.organization_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and inst.organization_id = wi.organization_id::uuid
  and (wi.instance_token is null or wi.instance_token <> inst.instance_token);

-- Add FKs as NOT VALID first to avoid failing during backfill
alter table if exists public.whatsapp_integrations
  add constraint fk_whatsapp_integ_instance_id
  foreign key (instance_id) references public.whatsapp_instances(instance_id)
  on update cascade on delete set null not valid;

alter table if exists public.whatsapp_integrations
  add constraint fk_whatsapp_integ_instance_token
  foreign key (instance_token) references public.whatsapp_instances(instance_token)
  on update cascade on delete set null not valid;

-- Validate after backfill
alter table if exists public.whatsapp_integrations validate constraint fk_whatsapp_integ_instance_id;
alter table if exists public.whatsapp_integrations validate constraint fk_whatsapp_integ_instance_token;


