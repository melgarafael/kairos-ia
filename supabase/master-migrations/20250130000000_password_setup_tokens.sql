-- Master migration: Tokens reutilizáveis para definição de senha inicial
-- Permite que usuários usem o mesmo link múltiplas vezes até definir a senha
set search_path = public, auth;

create extension if not exists pgcrypto;

create table if not exists public.password_setup_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.saas_users(id) on delete cascade,
  email text not null,
  token text not null unique,
  used boolean not null default false,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pst_user on public.password_setup_tokens(user_id);
create index if not exists idx_pst_token on public.password_setup_tokens(token);
create index if not exists idx_pst_email on public.password_setup_tokens(email);
create index if not exists idx_pst_valid on public.password_setup_tokens(token, used, expires_at) where used = false;

alter table public.password_setup_tokens enable row level security;

-- Policies: apenas service role pode inserir/atualizar; anon pode ler se tiver o token correto (via Edge Function)
drop policy if exists pst_service_all on public.password_setup_tokens;
create policy pst_service_all on public.password_setup_tokens
  for all to service_role
  using (true)
  with check (true);

-- Trigger updated_at
create or replace function public.touch_password_setup_token_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_password_setup_tokens_updated_at on public.password_setup_tokens;
create trigger trg_password_setup_tokens_updated_at
before update on public.password_setup_tokens
for each row execute function public.touch_password_setup_token_updated_at();

-- RPC para marcar token como usado (chamado quando senha é definida)
create or replace function public.mark_password_setup_token_used(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.password_setup_tokens
  set used = true, updated_at = now()
  where token = p_token
    and used = false
    and expires_at > now();
  
  return found;
end;
$$;

grant execute on function public.mark_password_setup_token_used(text) to anon, authenticated;

-- RPC para validar token e retornar user_id e email
create or replace function public.validate_password_setup_token(p_token text)
returns table(user_id uuid, email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select pst.user_id, pst.email
  from public.password_setup_tokens pst
  where pst.token = p_token
    and pst.used = false
    and pst.expires_at > now();
end;
$$;

grant execute on function public.validate_password_setup_token(text) to anon, authenticated;

