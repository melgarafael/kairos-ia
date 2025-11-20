-- Create whatsapp_instances table for per-organization instances and tokens
-- RLS enabled; no direct client access expected (managed via Edge Functions with service role)

create table if not exists public.whatsapp_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  instance_id text not null,
  instance_token text not null,
  client_token text not null,
  is_active boolean not null default true,
  status text null,
  device_jid text null,
  connected_at timestamptz null,
  webhook_url text null,
  events text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- uniqueness: one instance_id per org; also unique tokens
create unique index if not exists whatsapp_instances_org_instance_uidx on public.whatsapp_instances (organization_id, instance_id);
create unique index if not exists whatsapp_instances_instance_token_uidx on public.whatsapp_instances (instance_token);
create unique index if not exists whatsapp_instances_client_token_uidx on public.whatsapp_instances (client_token);
create index if not exists whatsapp_instances_org_idx on public.whatsapp_instances (organization_id);

alter table public.whatsapp_instances enable row level security;

-- Optional helper trigger to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_on_whatsapp_instances on public.whatsapp_instances;
create trigger set_timestamp_on_whatsapp_instances
before update on public.whatsapp_instances
for each row execute function public.set_updated_at();


