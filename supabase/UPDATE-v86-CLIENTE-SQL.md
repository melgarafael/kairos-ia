-- v86 - Fix duplicate financial entries when converting leads to clients
-- Problema: Quando um lead com pagamento é convertido em cliente, são criadas duas entradas financeiras:
--   - Uma do lead (lead_payment)
--   - Uma do cliente (client_valor_pago)
-- Solução: O módulo financeiro agora ignora entradas lead_payment (só mostra client_valor_pago)
--           Esta migração apenas limpa duplicatas existentes

begin;

-- 1) Modify convert_lead_to_client to migrate financial entry from lead to client
create or replace function public.convert_lead_to_client(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead record;
  v_client_id uuid;
  v_existing_id uuid;
  v_lead_entrada_id uuid;
  v_lead_link_id uuid;
begin
  -- Fetch lead
  select * into v_lead from public.crm_leads where id = p_lead_id;
  if not found then
    raise exception 'Lead não encontrado';
  end if;

  -- Try to reuse existing client for same organization by phone or email
  select c.id into v_existing_id
  from public.clients c
  where c.organization_id = v_lead.organization_id
    and (
      (v_lead.whatsapp is not null and nullif(trim(v_lead.whatsapp), '') is not null and c.telefone = trim(v_lead.whatsapp))
      or (v_lead.email is not null and nullif(trim(v_lead.email), '') is not null and c.email = trim(v_lead.email))
    )
  limit 1;

  if v_existing_id is not null then
    v_client_id := v_existing_id;
    -- Update valor_pago accumulating if lead has payment
    if coalesce(v_lead.has_payment, false) and coalesce(v_lead.payment_value, 0) > 0 then
      update public.clients
      set valor_pago = coalesce(valor_pago, 0) + coalesce(v_lead.payment_value, 0)
      where id = v_client_id;
    end if;
  else
    -- Create new client with valor_pago if lead has payment
    insert into public.clients (
      id, organization_id, nome, email, telefone, nascimento, valor_pago, created_at
    ) values (
      gen_random_uuid(),
      v_lead.organization_id,
      coalesce(nullif(trim(v_lead.name), ''), 'Sem nome'),
      nullif(trim(v_lead.email), ''),
      coalesce(nullif(trim(v_lead.whatsapp), ''), ''),
      date '1970-01-01',
      case when coalesce(v_lead.has_payment, false) then coalesce(v_lead.payment_value, 0) else 0 end,
      now()
    )
    returning id into v_client_id;
  end if;

  -- Migrate financial entry from lead to client if it exists
  -- This prevents duplication: instead of having both lead_payment and client_valor_pago entries,
  -- we migrate the existing lead_payment entry to client_valor_pago
  if coalesce(v_lead.has_payment, false) and coalesce(v_lead.payment_value, 0) > 0 then
    -- Find existing financial entry for this lead
    select esl.entrada_id, esl.id into v_lead_entrada_id, v_lead_link_id
    from public.entradas_source_links esl
    where esl.organization_id = v_lead.organization_id
      and esl.source_type = 'lead_payment'
      and esl.source_id = p_lead_id
    limit 1;

    if v_lead_entrada_id is not null then
      -- Check if client already has a financial entry
      declare
        v_client_entrada_id uuid;
        v_client_link_id uuid;
      begin
        select esl.entrada_id, esl.id into v_client_entrada_id, v_client_link_id
        from public.entradas_source_links esl
        where esl.organization_id = v_lead.organization_id
          and esl.source_type = 'client_valor_pago'
          and esl.source_id = v_client_id
        limit 1;

        if v_client_entrada_id is not null then
          -- Client already has an entry, delete the lead entry to avoid duplication
          delete from public.entradas where id = v_lead_entrada_id;
          delete from public.entradas_source_links where id = v_lead_link_id;
        else
          -- Migrate lead entry to client: update the link to point to client instead of lead
          update public.entradas_source_links
          set source_type = 'client_valor_pago',
              source_id = v_client_id,
              updated_at = now()
          where id = v_lead_link_id;

          -- Update the entrada to reference the client and update description
          update public.entradas
          set cliente_id = v_client_id,
              descricao = coalesce('Cliente pagante: ' || nullif(trim((select nome from public.clients where id = v_client_id)), ''), 'Cliente pagante'),
              observacoes = 'origem: client_valor_pago/' || v_client_id::text
          where id = v_lead_entrada_id;
        end if;
      end;
    end if;
  end if;

  -- Mark lead as converted
  update public.crm_leads
  set converted_client_id = v_client_id,
      converted_at = now(),
      stage = coalesce(stage, 'fechado')
  where id = p_lead_id;

  return v_client_id;
end;
$$;

-- 2) Modify upsert_entrada_for_client_valor_pago to check for existing lead entries
-- When a client's valor_pago is updated, check if there's a lead entry that should be migrated
create or replace function public.upsert_entrada_for_client_valor_pago(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_entrada_id uuid;
  v_lead_entrada_id uuid;
  v_lead_link_id uuid;
  v_lead_id uuid;
begin
  select * into r from public.clients where id = p_client_id;
  if not found then
    return;
  end if;
  if r.organization_id is null then
    return;
  end if;

  -- Check if there's a lead entry that should be migrated to this client
  -- This handles the case where a lead was converted but the migration didn't happen
  select esl.entrada_id, esl.id, esl.source_id into v_lead_entrada_id, v_lead_link_id, v_lead_id
  from public.entradas_source_links esl
  join public.crm_leads l on l.id = esl.source_id
  where esl.organization_id = r.organization_id
    and esl.source_type = 'lead_payment'
    and l.converted_client_id = p_client_id
    and coalesce(l.has_payment, false) = true
    and coalesce(l.payment_value, 0) > 0
  limit 1;

  if coalesce(r.valor_pago, 0) > 0 then
    -- Check if client already has a financial entry
    select entrada_id into v_entrada_id
    from public.entradas_source_links
    where organization_id = r.organization_id
      and source_type = 'client_valor_pago'
      and source_id = p_client_id;

    if v_entrada_id is null then
      -- If there's a lead entry, migrate it instead of creating a new one
      if v_lead_entrada_id is not null then
        -- Migrate lead entry to client
        update public.entradas_source_links
        set source_type = 'client_valor_pago',
            source_id = p_client_id,
            updated_at = now()
        where id = v_lead_link_id;

        -- Update the entrada
        update public.entradas
        set descricao = coalesce('Cliente pagante: ' || nullif(trim(r.nome), ''), 'Cliente pagante'),
            valor = r.valor_pago,
            categoria = 'Vendas',
            data_entrada = now(),
            metodo_pagamento = 'dinheiro',
            cliente_id = r.id,
            observacoes = 'origem: client_valor_pago/' || p_client_id::text
        where id = v_lead_entrada_id;
      else
        -- Create new entry for client
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
      end if;
    else
      -- Update existing entry
      update public.entradas
      set descricao = coalesce('Cliente pagante: ' || nullif(trim(r.nome), ''), 'Cliente pagante'),
          valor = r.valor_pago,
          categoria = 'Vendas',
          data_entrada = now(),
          metodo_pagamento = 'dinheiro',
          cliente_id = r.id
      where id = v_entrada_id;

      -- If there's a lead entry that wasn't migrated, delete it to avoid duplication
      if v_lead_entrada_id is not null and v_lead_entrada_id != v_entrada_id then
        delete from public.entradas where id = v_lead_entrada_id;
        delete from public.entradas_source_links where id = v_lead_link_id;
      end if;
    end if;
  else
    -- Remove entrada if valor_pago is 0
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

-- 3) Backfill: Clean up existing duplicates
-- Remove lead_payment entries for leads that have been converted to clients
-- and already have a client_valor_pago entry
create or replace function public.cleanup_duplicate_financial_entries()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  -- Find leads that have been converted and have both lead_payment and client_valor_pago entries
  for r in
    select 
      l.id as lead_id,
      l.converted_client_id as client_id,
      l.organization_id,
      esl_lead.entrada_id as lead_entrada_id,
      esl_lead.id as lead_link_id,
      esl_client.entrada_id as client_entrada_id
    from public.crm_leads l
    join public.entradas_source_links esl_lead
      on esl_lead.source_type = 'lead_payment'
      and esl_lead.source_id = l.id
      and esl_lead.organization_id = l.organization_id
    join public.entradas_source_links esl_client
      on esl_client.source_type = 'client_valor_pago'
      and esl_client.source_id = l.converted_client_id
      and esl_client.organization_id = l.organization_id
    where l.converted_client_id is not null
      and coalesce(l.has_payment, false) = true
      and coalesce(l.payment_value, 0) > 0
  loop
    -- Delete the lead entry since the client entry already exists
    delete from public.entradas where id = r.lead_entrada_id;
    delete from public.entradas_source_links where id = r.lead_link_id;
  end loop;
end;
$$;

-- Execute cleanup
select public.cleanup_duplicate_financial_entries();

-- 4) Enhanced cleanup function that also handles edge cases
create or replace function public.cleanup_duplicate_financial_entries_enhanced()
returns table(removed_count int, details jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_removed_count int := 0;
  v_details jsonb := '[]'::jsonb;
begin
  -- Find and remove lead_payment entries that have corresponding client_valor_pago entries
  for r in
    select 
      l.id as lead_id,
      l.converted_client_id as client_id,
      l.organization_id,
      esl_lead.entrada_id as lead_entrada_id,
      esl_lead.id as lead_link_id,
      esl_client.entrada_id as client_entrada_id,
      e_lead.valor as lead_valor,
      e_client.valor as client_valor
    from public.crm_leads l
    join public.entradas_source_links esl_lead
      on esl_lead.source_type = 'lead_payment'
      and esl_lead.source_id = l.id
      and esl_lead.organization_id = l.organization_id
    join public.entradas e_lead on e_lead.id = esl_lead.entrada_id
    left join public.entradas_source_links esl_client
      on esl_client.source_type = 'client_valor_pago'
      and esl_client.source_id = l.converted_client_id
      and esl_client.organization_id = l.organization_id
    left join public.entradas e_client on e_client.id = esl_client.entrada_id
    where l.converted_client_id is not null
      and coalesce(l.has_payment, false) = true
      and coalesce(l.payment_value, 0) > 0
      and esl_client.entrada_id is not null
      -- Only remove if values match (same payment)
      and abs(coalesce(e_lead.valor, 0) - coalesce(e_client.valor, 0)) < 0.01
  loop
    -- Delete the lead entry since the client entry already exists
    delete from public.entradas where id = r.lead_entrada_id;
    delete from public.entradas_source_links where id = r.lead_link_id;
    
    v_removed_count := v_removed_count + 1;
    v_details := v_details || jsonb_build_object(
      'lead_id', r.lead_id,
      'client_id', r.client_id,
      'removed_entrada_id', r.lead_entrada_id,
      'kept_entrada_id', r.client_entrada_id
    );
  end loop;
  
  return query select v_removed_count, v_details;
end;
$$;

-- Execute enhanced cleanup
select public.cleanup_duplicate_financial_entries_enhanced();

commit;

-- Marcar versão
INSERT INTO public.app_migrations (version, applied_at)
VALUES ('86', now())
ON CONFLICT (version) DO NOTHING;

