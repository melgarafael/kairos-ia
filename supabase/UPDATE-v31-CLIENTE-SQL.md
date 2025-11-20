-- Add single interest columns on crm_leads and migrate from JSONB
-- Creates: interest_produto_servico_id (uuid), interest_quantity (int4)
-- Backfills from crm_leads.interests (first item) if present
-- Updates value recalculation and payment upsert fallback to use the new columns

begin;

-- 1) Add new columns (idempotent)
alter table if exists public.crm_leads
  add column if not exists interest_produto_servico_id uuid,
  add column if not exists interest_quantity int4;

-- Default interest_quantity to 1 when NULL
update public.crm_leads
   set interest_quantity = 1
 where interest_quantity is null;

-- 2) Backfill from interests JSONB (first array item)
do $$
declare
  v_has_interests boolean;
begin
  select exists (
    select 1 from information_schema.columns 
     where table_schema='public' and table_name='crm_leads' and column_name='interests'
  ) into v_has_interests;

  if v_has_interests then
    update public.crm_leads l
       set interest_produto_servico_id = coalesce(interest_produto_servico_id,
         (
           select (elem->>'produto_servico_id')::uuid
             from jsonb_array_elements(l.interests) elem
             order by 1
             limit 1
         )
       ),
           interest_quantity = coalesce(interest_quantity,
         (
           select greatest(1, coalesce((elem->>'quantity')::int, 1))
             from jsonb_array_elements(l.interests) elem
             order by 1
             limit 1
         )
       )
     where l.interests is not null and jsonb_typeof(l.interests) = 'array';
  end if;
end $$;

-- 3) Recalc value based on interest_* columns
create or replace function public.recalc_lead_value_by_interest(p_lead_id uuid) returns void as $$
declare
  r record;
  v_price numeric;
  v_total numeric;
begin
  select organization_id, interest_produto_servico_id, greatest(1, coalesce(interest_quantity, 1)) as qty
    into r
  from public.crm_leads
  where id = p_lead_id;

  if r.interest_produto_servico_id is null then
    return;
  end if;

  select ps.preco_base into v_price
    from public.produtos_servicos ps
   where ps.id = r.interest_produto_servico_id
     and ps.organization_id = r.organization_id;

  v_total := coalesce(v_price, 0) * coalesce(r.qty, 1);

  update public.crm_leads
     set value = coalesce(v_total, 0),
         updated_at = now()
   where id = p_lead_id;
end;
$$ language plpgsql;

-- 4) Trigger to recalc when interest columns change
create or replace function public.trg_recalc_lead_value_on_interest() returns trigger as $$
begin
  if tg_op in ('INSERT','UPDATE') then
    perform public.recalc_lead_value_by_interest(new.id);
  end if;
  return new;
end; $$ language plpgsql;

drop trigger if exists recalc_lead_value_on_interest on public.crm_leads;
create trigger recalc_lead_value_on_interest
  after insert or update of interest_produto_servico_id, interest_quantity on public.crm_leads
  for each row execute function public.trg_recalc_lead_value_on_interest();

-- 5) Update payment upsert function to use interest_* as fallback
create or replace function public.upsert_entrada_for_lead_payment(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_entrada_id uuid;
  v_product_id uuid;
begin
  select * into r from public.crm_leads where id = p_lead_id;
  if not found then return; end if;
  if r.organization_id is null then return; end if;

  -- Preferred: explicit sold product
  v_product_id := r.sold_produto_servico_id;

  -- Fallback: interest product
  if v_product_id is null then
    v_product_id := r.interest_produto_servico_id;
  end if;

  if coalesce(r.has_payment, false) = true and coalesce(r.payment_value, 0) > 0 then
    select entrada_id into v_entrada_id
      from public.entradas_source_links
     where organization_id = r.organization_id
       and source_type = 'lead_payment'
       and source_id = p_lead_id;

    if v_entrada_id is null then
      insert into public.entradas (
        organization_id, descricao, valor, categoria, data_entrada,
        metodo_pagamento, cliente_id, produto_servico_id, observacoes
      ) values (
        r.organization_id,
        coalesce('Pagamento lead: ' || nullif(trim(r.name), ''), 'Pagamento lead'),
        r.payment_value,
        'Vendas',
        now(),
        'dinheiro',
        null,
        v_product_id,
        'origem: lead_payment/' || p_lead_id::text
      ) returning id into v_entrada_id;

      insert into public.entradas_source_links (organization_id, source_type, source_id, entrada_id)
      values (r.organization_id, 'lead_payment', p_lead_id, v_entrada_id);
    else
      update public.entradas
         set descricao = coalesce('Pagamento lead: ' || nullif(trim(r.name), ''), 'Pagamento lead'),
             valor = r.payment_value,
             categoria = 'Vendas',
             data_entrada = now(),
             metodo_pagamento = 'dinheiro',
             produto_servico_id = v_product_id
       where id = v_entrada_id;
    end if;
  else
    -- Remove if no longer valid
    select entrada_id into v_entrada_id
      from public.entradas_source_links
     where organization_id = r.organization_id
       and source_type = 'lead_payment'
       and source_id = p_lead_id;
    if v_entrada_id is not null then
      delete from public.entradas where id = v_entrada_id;
    end if;
  end if;
end;
$$;

commit;


-- 1) Marcar versão
insert into public.app_migrations (version, applied_at)
values ('31', now())
on conflict (version) do nothing;