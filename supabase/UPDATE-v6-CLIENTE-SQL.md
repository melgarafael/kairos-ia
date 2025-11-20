-- v6  Sincronizar table de leads e clientes para conversão entre eles

-- Enhance convert_lead_to_client RPC (reuse existing client, default nascimento)
-- Safe to run multiple times (CREATE OR REPLACE)

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
begin
  -- Fetch lead
  select * into v_lead from public.crm_leads where id = p_lead_id;
  if not found then
    raise exception 'Lead não encontrado';
  end if;

  -- Try to reuse existing client for same organization by phone or email
  select c.id
    into v_existing_id
  from public.clients c
  where c.organization_id = v_lead.organization_id
    and (
      (v_lead.whatsapp is not null and nullif(trim(v_lead.whatsapp), '') is not null and c.telefone = trim(v_lead.whatsapp))
      or (v_lead.email is not null and nullif(trim(v_lead.email), '') is not null and c.email = trim(v_lead.email))
    )
  limit 1;

  if v_existing_id is not null then
    v_client_id := v_existing_id;
  else
    -- clients requires nascimento (date) and telefone (text)
    insert into public.clients (
      id, organization_id, nome, email, telefone, nascimento, created_at
    ) values (
      gen_random_uuid(),
      v_lead.organization_id,
      coalesce(nullif(trim(v_lead.name), ''), 'Sem nome'),
      nullif(trim(v_lead.email), ''),
      coalesce(nullif(trim(v_lead.whatsapp), ''), ''),
      date '1970-01-01',
      now()
    )
    returning id into v_client_id;
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


-- Add valor_pago to clients and sync RPC

alter table public.clients
  add column if not exists valor_pago numeric(10,2) default 0;

-- When converting a lead to client, set clients.valor_pago if lead has payment
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
begin
  select * into v_lead from public.crm_leads where id = p_lead_id;
  if not found then
    raise exception 'Lead não encontrado';
  end if;

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
    -- opcional: atualizar valor_pago acumulando
    if coalesce(v_lead.has_payment, false) and coalesce(v_lead.payment_value, 0) > 0 then
      update public.clients
      set valor_pago = coalesce(valor_pago, 0) + coalesce(v_lead.payment_value, 0)
      where id = v_client_id;
    end if;
  else
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

  update public.crm_leads
  set converted_client_id = v_client_id,
      converted_at = now(),
      stage = coalesce(stage, 'fechado')
  where id = p_lead_id;

  return v_client_id;
end;
$$;


-- Auto-convert lead to client when stage changes to closed (fechado/ganho)

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
        -- perform conversion (idempotent: function reuses existing client)
        perform public.convert_lead_to_client(new.id);
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists auto_convert_on_close on public.crm_leads;
create trigger auto_convert_on_close
  after update on public.crm_leads
  for each row execute function public.trg_auto_convert_on_close();


-- Create client from lead WITHOUT marking the lead as converted

create or replace function public.create_client_from_lead_no_convert(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead record;
  v_client_id uuid;
begin
  select * into v_lead from public.crm_leads where id = p_lead_id;
  if not found then
    raise exception 'Lead não encontrado';
  end if;

  -- Reuse existing client by phone/email within org
  select id into v_client_id from public.clients c
  where c.organization_id = v_lead.organization_id
    and (
      (v_lead.whatsapp is not null and nullif(trim(v_lead.whatsapp), '') is not null and c.telefone = trim(v_lead.whatsapp))
      or (v_lead.email is not null and nullif(trim(v_lead.email), '') is not null and c.email = trim(v_lead.email))
    )
  limit 1;

  if v_client_id is null then
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
    ) returning id into v_client_id;
  else
    -- Update valor_pago if we already have payment on the lead
    if coalesce(v_lead.has_payment, false) and coalesce(v_lead.payment_value, 0) > 0 then
      update public.clients set valor_pago = coalesce(v_lead.payment_value, 0) where id = v_client_id;
    end if;
  end if;

  return v_client_id;
end;
$$;

-- Replace auto-convert trigger to use the non-converting function
drop trigger if exists auto_convert_on_close on public.crm_leads;
create trigger auto_convert_on_close
  after update on public.crm_leads
  for each row execute function public.trg_auto_convert_on_close();

-- Sync client.valor_pago when lead payment fields change
create or replace function public.trg_sync_client_payment_from_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
begin
  if tg_op = 'UPDATE' then
    if (coalesce(old.payment_value,0) is distinct from coalesce(new.payment_value,0))
       or (coalesce(old.has_payment,false) is distinct from coalesce(new.has_payment,false)) then
      -- find matching client in same org by phone/email
      select id into v_client_id from public.clients c
      where c.organization_id = new.organization_id
        and (
          (new.whatsapp is not null and nullif(trim(new.whatsapp), '') is not null and c.telefone = trim(new.whatsapp))
          or (new.email is not null and nullif(trim(new.email), '') is not null and c.email = trim(new.email))
        )
      limit 1;
      if v_client_id is not null then
        update public.clients
        set valor_pago = case when coalesce(new.has_payment,false) then coalesce(new.payment_value,0) else 0 end
        where id = v_client_id;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_client_payment_from_lead on public.crm_leads;
create trigger sync_client_payment_from_lead
  after update on public.crm_leads
  for each row execute function public.trg_sync_client_payment_from_lead();

-- Update auto-convert-on-close behavior without touching previous migrations
-- Redefine trigger function to only create client (do NOT mark lead as converted)

create or replace function public.trg_auto_convert_on_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if coalesce(old.stage, '') is distinct from coalesce(new.stage, '') then
      if lower(coalesce(new.stage, '')) in ('fechado', 'fechado ganho', 'ganho', 'venda fechada') then
        perform public.create_client_from_lead_no_convert(new.id);
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists auto_convert_on_close on public.crm_leads;
create trigger auto_convert_on_close
  after update on public.crm_leads
  for each row execute function public.trg_auto_convert_on_close();




insert into public.app_migrations (version, applied_at)
values ('6', now())
on conflict (version) do nothing;


