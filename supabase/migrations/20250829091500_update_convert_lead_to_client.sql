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


