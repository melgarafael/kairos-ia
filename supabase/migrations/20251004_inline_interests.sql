-- Consolidate lead interests into crm_leads.interests (JSONB)
-- Remove table crm_lead_interests and replace value recalculation and RPCs

begin;

-- 1) Add interests column
alter table if exists public.crm_leads
  add column if not exists interests jsonb;

-- 2) Backfill from crm_lead_interests if it exists
do $$
begin
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' and table_name = 'crm_lead_interests'
  ) then
    update public.crm_leads l
       set interests = coalesce(
         (
           select jsonb_agg(jsonb_build_object(
             'produto_servico_id', li.produto_servico_id,
             'quantity', greatest(1, li.quantity)
           ) order by li.created_at asc)
           from public.crm_lead_interests li
           where li.lead_id = l.id
         ), '[]'::jsonb)
     where l.interests is null;
  end if;
end $$;

-- 3) Function to recalc lead value based on interests JSON
create or replace function public.recalc_lead_value(p_lead_id uuid) returns void as $$
declare
  v_sum numeric;
  v_org uuid;
  v_interests jsonb;
begin
  select organization_id, coalesce(interests, '[]'::jsonb)
    into v_org, v_interests
  from public.crm_leads
  where id = p_lead_id;

  if v_interests is null then
    return;
  end if;

  select coalesce(sum(ps.preco_base * coalesce((item->>'quantity')::int, 1)), 0)
    into v_sum
  from jsonb_array_elements(v_interests) as item
  join public.produtos_servicos ps
    on ps.id = (item->>'produto_servico_id')::uuid
   and ps.organization_id = v_org;

  if v_sum > 0 then
    update public.crm_leads
       set value = v_sum,
           updated_at = now()
     where id = p_lead_id;
  end if;
end; $$ language plpgsql;

-- 4) Trigger to recalc when interests change
create or replace function public.trg_recalc_lead_value_on_leads() returns trigger as $$
begin
  if tg_op in ('INSERT','UPDATE') then
    perform public.recalc_lead_value(new.id);
  end if;
  return new;
end; $$ language plpgsql;

drop trigger if exists recalc_lead_value_on_leads on public.crm_leads;
create trigger recalc_lead_value_on_leads
  after insert or update of interests on public.crm_leads
  for each row execute function public.trg_recalc_lead_value_on_leads();

-- 5) Update upsert_entrada_for_lead_payment to read first item from interests JSON
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
  v_first_item jsonb;
begin
  select * into r from public.crm_leads where id = p_lead_id;
  if not found then return; end if;
  if r.organization_id is null then return; end if;

  -- Preferred: explicit sold_produto_servico_id
  v_product_id := r.sold_produto_servico_id;

  -- Fallback: first interest item in JSON
  if v_product_id is null and r.interests is not null then
    select value into v_first_item from jsonb_array_elements(r.interests) limit 1;
    if v_first_item is not null then
      v_product_id := (v_first_item->>'produto_servico_id')::uuid;
    end if;
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
    -- Remove entrada if payment no longer valid
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

-- 6) Drop old triggers and table (idempotent)
do $$
begin
  if exists (
    select 1 from information_schema.tables where table_schema = 'public' and table_name = 'crm_lead_interests'
  ) then
    drop trigger if exists recalc_lead_value_ins on public.crm_lead_interests;
    drop trigger if exists recalc_lead_value_upd on public.crm_lead_interests;
    drop trigger if exists recalc_lead_value_del on public.crm_lead_interests;
    drop table if exists public.crm_lead_interests cascade;
  end if;
end $$;

commit;


