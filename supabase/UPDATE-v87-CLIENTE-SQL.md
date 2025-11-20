-- v87 - Fix Kanban visibility: leads stay visible when moved to closed stage, only hide when manually converted
-- Problema: Quando um lead é movido para estágio "fechado/ganho", ele é automaticamente ocultado do Kanban
-- Solução: 
--   1. Remover trigger que oculta automaticamente ao converter
--   2. Modificar RPC convert_lead_to_client para ocultar apenas quando convertido manualmente (via botão)
--   3. Leads movidos para estágio fechado permanecem visíveis no Kanban

begin;

-- 1) Remover trigger que oculta automaticamente quando converted_client_id é preenchido
drop trigger if exists trg_crm_leads_hide_on_conversion on public.crm_leads;
drop function if exists public.trg_crm_leads_hide_on_conversion();

-- 2) Modificar convert_lead_to_client para marcar show_in_kanban = false apenas quando convertido manualmente
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

  -- Mark lead as converted AND hide from Kanban (manual conversion)
  -- This is the key change: show_in_kanban = false only when manually converted
  update public.crm_leads
  set converted_client_id = v_client_id,
      converted_at = now(),
      stage = coalesce(stage, 'fechado'),
      show_in_kanban = false  -- Ocultar apenas quando convertido manualmente
  where id = p_lead_id;

  return v_client_id;
end;
$$;

-- 3) Garantir que o trigger de conversão automática NÃO altere show_in_kanban
-- O trigger trg_auto_convert_on_close já não altera show_in_kanban, mas vamos garantir
-- verificando se existe e está correto
create or replace function public.trg_auto_convert_on_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    -- only when stage actually changed to a closed state
    if coalesce(old.stage, '') is distinct from coalesce(new.stage, '') then
      if lower(coalesce(new.stage, '')) in ('fechado', 'fechado ganho', 'ganho', 'venda fechada') then
        -- Avoid double work if already converted
        if new.converted_client_id is null then
          -- Perform conversion but DO NOT change show_in_kanban
          -- The conversion will happen, but the lead stays visible in Kanban
          perform public.convert_lead_to_client_auto(new.id);
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Criar função auxiliar para conversão automática (sem ocultar do Kanban)
create or replace function public.convert_lead_to_client_auto(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead record;
  v_client_id uuid;
  v_existing_id uuid;
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

  -- Migrate financial entry from lead to client if it exists (same logic as manual conversion)
  if coalesce(v_lead.has_payment, false) and coalesce(v_lead.payment_value, 0) > 0 then
    declare
      v_lead_entrada_id_auto uuid;
      v_lead_link_id_auto uuid;
      v_client_entrada_id_auto uuid;
      v_client_link_id_auto uuid;
    begin
      select esl.entrada_id, esl.id into v_lead_entrada_id_auto, v_lead_link_id_auto
      from public.entradas_source_links esl
      where esl.organization_id = v_lead.organization_id
        and esl.source_type = 'lead_payment'
        and esl.source_id = p_lead_id
      limit 1;

      if v_lead_entrada_id_auto is not null then
        select esl.entrada_id, esl.id into v_client_entrada_id_auto, v_client_link_id_auto
        from public.entradas_source_links esl
        where esl.organization_id = v_lead.organization_id
          and esl.source_type = 'client_valor_pago'
          and esl.source_id = v_client_id
        limit 1;

        if v_client_entrada_id_auto is not null then
          delete from public.entradas where id = v_lead_entrada_id_auto;
          delete from public.entradas_source_links where id = v_lead_link_id_auto;
        else
          update public.entradas_source_links
          set source_type = 'client_valor_pago',
              source_id = v_client_id,
              updated_at = now()
          where id = v_lead_link_id_auto;

          update public.entradas
          set cliente_id = v_client_id,
              descricao = coalesce('Cliente pagante: ' || nullif(trim((select nome from public.clients where id = v_client_id)), ''), 'Cliente pagante'),
              observacoes = 'origem: client_valor_pago/' || v_client_id::text
          where id = v_lead_entrada_id_auto;
        end if;
      end if;
    end;
  end if;

  -- Mark lead as converted BUT keep show_in_kanban unchanged (stay visible)
  update public.crm_leads
  set converted_client_id = v_client_id,
      converted_at = now(),
      stage = coalesce(stage, 'fechado')
      -- show_in_kanban não é alterado aqui - mantém o valor atual (geralmente true)
  where id = p_lead_id;

  return v_client_id;
end;
$$;

commit;

-- Marcar versão
INSERT INTO public.app_migrations (version, applied_at)
VALUES ('87', now())
ON CONFLICT (version) DO NOTHING;
