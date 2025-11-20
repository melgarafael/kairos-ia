-- Master: Adicionar coluna account_type em saas_users para identificar tipo de conta
-- Tipos permitidos: 'profissional', 'agencia', 'usuario', 'empresa'

begin;

-- Adicionar coluna account_type se não existir
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' 
      and table_name = 'saas_users' 
      and column_name = 'account_type'
  ) then
    alter table public.saas_users 
    add column account_type text 
    check (account_type is null or account_type in ('profissional', 'agencia', 'usuario', 'empresa'));
  end if;
end $$;

-- Criar índice para melhor performance em consultas por tipo de conta
create index if not exists idx_saas_users_account_type 
on public.saas_users(account_type);

commit;

