-- Add sale columns on crm_leads and link entradas to produto_servico when possible

begin;

-- 1) Columns to store sold product and quantity (for AI agent/automation use)
alter table public.crm_leads
  add column if not exists sold_produto_servico_id uuid references public.produtos_servicos(id) on delete set null,
  add column if not exists sold_quantity integer not null default 1 check (sold_quantity >= 1);

-- 2) Update function to propagate produto_servico_id to entradas for lead payments
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
  if not found then
    return;
  end if;

  if r.organization_id is null then
    return;
  end if;

  -- Decide product to attach to entrada
  v_product_id := r.sold_produto_servico_id;
  if v_product_id is null then
    select li.produto_servico_id
      into v_product_id
    from public.crm_lead_interests li
    where li.lead_id = p_lead_id
    order by li.created_at asc
    limit 1;
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

commit;


