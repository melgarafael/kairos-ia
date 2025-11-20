-- v11 – Ajuste de NOT NULL em repositorio_de_mensagens
-- Requisito: apenas whatsapp_cliente, sender_type e content_text devem ser NOT NULL

-- 1) Backfill seguro para evitar falhas ao aplicar NOT NULL
update public.repositorio_de_mensagens
set content_text = ''
where content_text is null;

update public.repositorio_de_mensagens
set whatsapp_cliente = ''
where whatsapp_cliente is null;

do $$
begin
  -- Se sender_type estiver nulo, assumir 'cliente'
  update public.repositorio_de_mensagens
  set sender_type = 'cliente'::sender_type
  where sender_type is null;
exception when others then
  -- ignorar caso o enum não exista por algum motivo
  null;
end $$;

-- 2) Definir defaults mínimos (opcional mas útil)
alter table if exists public.repositorio_de_mensagens
  alter column content_text set default '';

-- 3) Tornar APENAS estes campos obrigatórios
alter table if exists public.repositorio_de_mensagens
  alter column whatsapp_cliente set not null,
  alter column sender_type set not null,
  alter column content_text set not null;

-- 4) Remover NOT NULL dos demais que tinham restrição
do $$
begin
  -- created_at originalmente era NOT NULL
  begin
    alter table public.repositorio_de_mensagens alter column created_at drop not null;
  exception when others then null; end;
  -- whatsapp_empresa originalmente era NOT NULL
  begin
    alter table public.repositorio_de_mensagens alter column whatsapp_empresa drop not null;
  exception when others then null; end;
  -- direction originalmente era NOT NULL
  begin
    alter table public.repositorio_de_mensagens alter column direction drop not null;
  exception when others then null; end;
end $$;

-- Create RPC to set organization context for RLS policies
set search_path = public, auth;

-- Drop and recreate for idempotency
drop function if exists public.set_rls_context(uuid);

create or replace function public.set_rls_context(p_organization_id uuid)
returns void
language sql
as $$
  select set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
$$;

-- Ensure authenticated/anon roles can execute (PostgREST)
do $$ begin
  grant execute on function public.set_rls_context(uuid) to anon, authenticated;
exception when others then
  -- ignore if roles not present in this environment
  null;
end $$;

comment on function public.set_rls_context(uuid) is 'Sets app.organization_id GUC for row-level policies.';



-- 5) Marcar versão
insert into public.app_migrations (version, applied_at)
values ('11', now())
on conflict (version) do nothing;


