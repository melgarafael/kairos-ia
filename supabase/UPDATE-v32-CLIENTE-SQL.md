-- crm_leads.sold_quantity deve ser obrigatório APENAS quando houver sold_produto_servico_id
-- Regra atual: coluna está NOT NULL com default 1. Vamos remover NOT NULL/default
-- e criar um CHECK condicional.

begin;

-- 1) Tornar sold_quantity opcional e remover default
alter table if exists public.crm_leads
  alter column sold_quantity drop not null;

do $$
begin
  -- Remover default, se existir (idempotente)
  begin
    alter table public.crm_leads alter column sold_quantity drop default;
  exception when others then
    -- ignora se já não houver default
    null;
  end;
end $$;

-- 2) Constraint condicional: se houver sold_produto_servico_id, exigir quantity >= 1
do $$
begin
  if not exists (
    select 1
      from pg_constraint c
      join pg_class t on c.conrelid = t.oid
     where t.relname = 'crm_leads'
       and c.conname = 'crm_leads_sold_qty_req_when_product'
  ) then
    alter table public.crm_leads
      add constraint crm_leads_sold_qty_req_when_product
      check (
        sold_produto_servico_id is null
        or (sold_quantity is not null and sold_quantity >= 1)
      );
  end if;
end $$;

commit;

-- Fim: a constraint existente crm_leads_sold_quantity_check (>= 1) é mantida.

-- 1) Marcar versão
insert into public.app_migrations (version, applied_at)
values ('32', now())
on conflict (version) do nothing;