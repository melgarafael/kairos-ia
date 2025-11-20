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


