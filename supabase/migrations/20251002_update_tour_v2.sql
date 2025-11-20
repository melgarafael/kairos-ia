-- Update Tours v2: Convites/Multiusuário
set search_path = public, auth;

begin;

-- Tabela de controle (idempotente)
create table if not exists public.updates_tour (
  id int primary key default 1,
  current_version int not null default 1,
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from public.updates_tour where id = 1) then
    insert into public.updates_tour(id, current_version) values (1, 1);
  end if;
end $$;

-- Bump para versão 2
update public.updates_tour set current_version = 2, updated_at = now() where id = 1 and current_version < 2;

commit;


