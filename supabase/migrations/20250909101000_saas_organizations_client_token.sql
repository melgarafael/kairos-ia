-- Add client_token to saas_organizations and auto-generate for new/existing rows

create extension if not exists pgcrypto;

alter table if exists public.saas_organizations
  add column if not exists client_token text;

-- Backfill missing tokens with random hex
update public.saas_organizations
set client_token = encode(gen_random_bytes(16), 'hex')
where client_token is null;

-- Enforce uniqueness and presence going forward
create unique index if not exists saas_organizations_client_token_uidx on public.saas_organizations (client_token);

-- Trigger to set client_token on insert if missing
create or replace function public.set_client_token_if_missing()
returns trigger as $$
begin
  if new.client_token is null then
    new.client_token = encode(gen_random_bytes(16), 'hex');
  end if;
  return new;
end;
$$ language plpgsql;

do $$
begin
  if exists (
    select 1 from information_schema.tables where table_schema = 'public' and table_name = 'saas_organizations'
  ) then
    drop trigger if exists trg_set_client_token_if_missing on public.saas_organizations;
    create trigger trg_set_client_token_if_missing
    before insert on public.saas_organizations
    for each row execute function public.set_client_token_if_missing();
  end if;
end $$;


