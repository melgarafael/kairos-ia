-- Sync entradas from pagamentos, leads (has_payment), and clients (valor_pago)
-- This migration creates a link table for idempotency, mapping functions,
-- trigger functions, triggers, and backfill routines.

-- 1) Link table for idempotency (maps source record -> entrada row)
create table if not exists public.entradas_source_links (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null,
  source_type text not null check (source_type in ('pagamento','lead_payment','client_valor_pago')),
  source_id uuid not null,
  entrada_id uuid not null references public.entradas(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, source_type, source_id)
);

drop trigger if exists update_entradas_source_links_updated_at on public.entradas_source_links;
create trigger update_entradas_source_links_updated_at
  before update on public.entradas_source_links
  for each row execute function public.update_updated_at_column();

-- 2) Mapping helpers
create or replace function public.map_pagamento_metodo_to_entradas(m text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(m,''))
    when 'dinheiro' then 'dinheiro'
    when 'pix' then 'pix'
    when 'transferencia' then 'transferencia'
    when 'cheque' then 'cheque'
    when 'cartao' then 'cartao_credito'
    when 'cartao_credito' then 'cartao_credito'
    when 'cartao_debito' then 'cartao_debito'
    when 'boleto' then 'boleto'
    else 'dinheiro'
  end;
$$;

create or replace function public.map_produto_categoria_to_entrada_categoria(
  ps_categoria text,
  ps_tipo text,
  ps_tipo_cobranca text,
  ps_cobranca_tipo text
)
returns text
language sql
immutable
as $$
  select case
    when lower(coalesce(ps_categoria,'')) in (
      'consulta','exame','procedimento','terapia','cirurgia','treinamento'
    ) then 'Serviços'
    when lower(coalesce(ps_categoria,'')) in (
      'consultoria'
    ) then 'Consultoria'
    when lower(coalesce(ps_categoria,'')) in (
      'medicamento','equipamento','material','software'
    ) then 'Produtos'
    when lower(coalesce(ps_categoria,'')) in (
      'assinatura'
    ) or lower(coalesce(ps_tipo_cobranca,'')) in (
      'mensal','trimestral','semestral','anual'
    ) or lower(coalesce(ps_cobranca_tipo,'')) in (
      'mensal','trimestral','semestral','anual'
    ) then 'Assinatura'
    else 'Outros'
  end;
$$;

-- 3) Upsert from pagamentos
create or replace function public.upsert_entrada_for_pagamento(p_pagamento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_entrada_id uuid;
  v_categoria text;
  v_metodo text;
  v_descricao text;
  v_prod_id uuid;
  v_cliente_id uuid;
begin
  select p.*, c.nome as cliente_nome,
         ps.nome as produto_nome,
         ps.categoria as ps_categoria,
         ps.tipo as ps_tipo,
         ps.tipo_cobranca as ps_tipo_cobranca,
         ps.cobranca_tipo as ps_cobranca_tipo
    into r
    from public.pagamentos p
    left join public.clients c on c.id = p.client_id
    left join public.produtos_servicos ps on ps.id = p.servico_id
   where p.id = p_pagamento_id;

  if not found then
    return;
  end if;

  -- Require organization_id and positive valor
  if r.organization_id is null or coalesce(r.valor, 0) <= 0 then
    return;
  end if;

  -- If not confirmed, remove any existing entrada for this pagamento
  if r.status is distinct from 'confirmado' then
    select entrada_id into v_entrada_id
      from public.entradas_source_links
     where organization_id = r.organization_id
       and source_type = 'pagamento'
       and source_id = p_pagamento_id;
    if v_entrada_id is not null then
      delete from public.entradas where id = v_entrada_id;
    end if;
    return;
  end if;

  v_metodo := public.map_pagamento_metodo_to_entradas(r.metodo);
  v_categoria := public.map_produto_categoria_to_entrada_categoria(r.ps_categoria, r.ps_tipo, r.ps_tipo_cobranca, r.ps_cobranca_tipo);
  v_descricao := coalesce('Pagamento ' || v_metodo || coalesce(' - ' || r.produto_nome, ''), 'Pagamento');
  v_cliente_id := r.client_id;
  v_prod_id := r.servico_id;

  select entrada_id into v_entrada_id
    from public.entradas_source_links
   where organization_id = r.organization_id
     and source_type = 'pagamento'
     and source_id = p_pagamento_id;

  if v_entrada_id is null then
    insert into public.entradas (
      organization_id, descricao, valor, categoria, data_entrada,
      metodo_pagamento, cliente_id, produto_servico_id, observacoes
    ) values (
      r.organization_id,
      v_descricao,
      r.valor,
      v_categoria,
      coalesce(r.data_pagamento, now()),
      v_metodo,
      v_cliente_id,
      v_prod_id,
      'origem: pagamento/' || p_pagamento_id::text
    ) returning id into v_entrada_id;

    insert into public.entradas_source_links (organization_id, source_type, source_id, entrada_id)
    values (r.organization_id, 'pagamento', p_pagamento_id, v_entrada_id);
  else
    update public.entradas
       set descricao = v_descricao,
           valor = r.valor,
           categoria = v_categoria,
           data_entrada = coalesce(r.data_pagamento, now()),
           metodo_pagamento = v_metodo,
           cliente_id = v_cliente_id,
           produto_servico_id = v_prod_id
     where id = v_entrada_id;
  end if;
end;
$$;

create or replace function public.trg_entradas_from_pagamentos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upsert_entrada_for_pagamento(new.id);
  return new;
end;
$$;

create or replace function public.trg_entradas_from_pagamentos_del()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entrada_id uuid;
begin
  select entrada_id into v_entrada_id
    from public.entradas_source_links
   where organization_id = old.organization_id
     and source_type = 'pagamento'
     and source_id = old.id;
  if v_entrada_id is not null then
    delete from public.entradas where id = v_entrada_id;
  end if;
  return old;
end;
$$;

drop trigger if exists entradas_from_pagamentos_ins on public.pagamentos;
create trigger entradas_from_pagamentos_ins
  after insert on public.pagamentos
  for each row execute function public.trg_entradas_from_pagamentos();

drop trigger if exists entradas_from_pagamentos_upd on public.pagamentos;
create trigger entradas_from_pagamentos_upd
  after update on public.pagamentos
  for each row execute function public.trg_entradas_from_pagamentos();

drop trigger if exists entradas_from_pagamentos_del on public.pagamentos;
create trigger entradas_from_pagamentos_del
  after delete on public.pagamentos
  for each row execute function public.trg_entradas_from_pagamentos_del();

-- 4) Upsert from leads.has_payment/payment_value
create or replace function public.upsert_entrada_for_lead_payment(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_entrada_id uuid;
begin
  select * into r from public.crm_leads where id = p_lead_id;
  if not found then
    return;
  end if;

  if r.organization_id is null then
    return;
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
        null,
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
             metodo_pagamento = 'dinheiro'
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

create or replace function public.trg_entradas_from_leads()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upsert_entrada_for_lead_payment(new.id);
  return new;
end;
$$;

create or replace function public.trg_entradas_from_leads_del()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_entrada_id uuid; begin
  select entrada_id into v_entrada_id
    from public.entradas_source_links
   where organization_id = old.organization_id
     and source_type = 'lead_payment'
     and source_id = old.id;
  if v_entrada_id is not null then
    delete from public.entradas where id = v_entrada_id;
  end if;
  return old;
end;$$;

drop trigger if exists entradas_from_leads_ins on public.crm_leads;
create trigger entradas_from_leads_ins
  after insert on public.crm_leads
  for each row execute function public.trg_entradas_from_leads();

drop trigger if exists entradas_from_leads_upd on public.crm_leads;
create trigger entradas_from_leads_upd
  after update on public.crm_leads
  for each row execute function public.trg_entradas_from_leads();

drop trigger if exists entradas_from_leads_del on public.crm_leads;
create trigger entradas_from_leads_del
  after delete on public.crm_leads
  for each row execute function public.trg_entradas_from_leads_del();

-- 5) Upsert from clients.valor_pago (> 0)
create or replace function public.upsert_entrada_for_client_valor_pago(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_entrada_id uuid;
begin
  select * into r from public.clients where id = p_client_id;
  if not found then
    return;
  end if;
  if r.organization_id is null then
    return;
  end if;

  if coalesce(r.valor_pago, 0) > 0 then
    select entrada_id into v_entrada_id
      from public.entradas_source_links
     where organization_id = r.organization_id
       and source_type = 'client_valor_pago'
       and source_id = p_client_id;

    if v_entrada_id is null then
      insert into public.entradas (
        organization_id, descricao, valor, categoria, data_entrada,
        metodo_pagamento, cliente_id, produto_servico_id, observacoes
      ) values (
        r.organization_id,
        coalesce('Cliente pagante: ' || nullif(trim(r.nome), ''), 'Cliente pagante'),
        r.valor_pago,
        'Vendas',
        now(),
        'dinheiro',
        r.id,
        null,
        'origem: client_valor_pago/' || p_client_id::text
      ) returning id into v_entrada_id;

      insert into public.entradas_source_links (organization_id, source_type, source_id, entrada_id)
      values (r.organization_id, 'client_valor_pago', p_client_id, v_entrada_id);
    else
      update public.entradas
         set descricao = coalesce('Cliente pagante: ' || nullif(trim(r.nome), ''), 'Cliente pagante'),
             valor = r.valor_pago,
             categoria = 'Vendas',
             data_entrada = now(),
             metodo_pagamento = 'dinheiro',
             cliente_id = r.id
       where id = v_entrada_id;
    end if;
  else
    select entrada_id into v_entrada_id
      from public.entradas_source_links
     where organization_id = r.organization_id
       and source_type = 'client_valor_pago'
       and source_id = p_client_id;
    if v_entrada_id is not null then
      delete from public.entradas where id = v_entrada_id;
    end if;
  end if;
end;
$$;

create or replace function public.trg_entradas_from_clients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upsert_entrada_for_client_valor_pago(new.id);
  return new;
end;
$$;

create or replace function public.trg_entradas_from_clients_del()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_entrada_id uuid; begin
  select entrada_id into v_entrada_id
    from public.entradas_source_links
   where organization_id = old.organization_id
     and source_type = 'client_valor_pago'
     and source_id = old.id;
  if v_entrada_id is not null then
    delete from public.entradas where id = v_entrada_id;
  end if;
  return old;
end;$$;

drop trigger if exists entradas_from_clients_upd on public.clients;
create trigger entradas_from_clients_upd
  after update on public.clients
  for each row execute function public.trg_entradas_from_clients();

drop trigger if exists entradas_from_clients_del on public.clients;
create trigger entradas_from_clients_del
  after delete on public.clients
  for each row execute function public.trg_entradas_from_clients_del();

-- 6) Backfill routines
create or replace function public.backfill_entradas_from_pagamentos()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record; begin
  for r in
    select id from public.pagamentos
     where status = 'confirmado' and organization_id is not null and coalesce(valor,0) > 0
  loop
    perform public.upsert_entrada_for_pagamento(r.id);
  end loop;
end;$$;

create or replace function public.backfill_entradas_from_leads()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record; begin
  for r in
    select id from public.crm_leads
     where coalesce(has_payment,false) = true and coalesce(payment_value,0) > 0 and organization_id is not null
  loop
    perform public.upsert_entrada_for_lead_payment(r.id);
  end loop;
end;$$;

create or replace function public.backfill_entradas_from_clients()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record; begin
  for r in
    select id from public.clients
     where coalesce(valor_pago,0) > 0 and organization_id is not null
  loop
    perform public.upsert_entrada_for_client_valor_pago(r.id);
  end loop;
end;$$;

-- Execute backfills
select public.backfill_entradas_from_pagamentos();
select public.backfill_entradas_from_leads();
select public.backfill_entradas_from_clients();


