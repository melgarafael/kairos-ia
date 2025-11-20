-- Add origin tagging for CRM lead activities
-- Distinção entre ações feitas via UI (com header) e automações (sem header)
--

-- 1) Schema: adicionar coluna de origem
alter table if exists public.crm_lead_activities
  add column if not exists origin text;

comment on column public.crm_lead_activities.origin is 'Origem do evento: ui | automation | edge | system';

-- 2) Função utilitária segura para obter header da requisição (se disponível)
create or replace function public.get_request_header(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_headers text;
  v_value text;
begin
  -- Tenta ler os headers do PostgREST (se disponível na versão do Supabase)
  begin
    v_headers := current_setting('request.headers', true);
  exception when others then
    v_headers := null;
  end;

  if v_headers is null then
    return null;
  end if;

  begin
    v_value := (v_headers::jsonb ->> p_name);
  exception when others then
    v_value := null;
  end;

  return v_value;
end;
$$;

-- 3) Atualizar trigger para registrar a origem
create or replace function public.log_crm_lead_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_any_inserted boolean := false;
  v_origin text;
begin
  v_actor := coalesce(new.updated_by, new.created_by, old.updated_by, old.created_by);
  v_origin := coalesce(public.get_request_header('x-tomik-origin'), 'automation');

  if tg_op = 'INSERT' then
    insert into public.crm_lead_activities (
      lead_id, user_id, action, field_changed, description, origin, created_at
    ) values (
      new.id, v_actor, 'INSERT', 'insert', 'Lead criado: ' || coalesce(new.name,''), v_origin, now()
    );
    return new;

  elsif tg_op = 'UPDATE' then
    -- Stage change
    if old.stage is distinct from new.stage then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, old_value, new_value, origin, created_at
      ) values (
        new.id, v_actor, 'UPDATE', 'stage',
        'Lead movido para: ' || coalesce(new.stage,'indefinido'),
        old.stage, new.stage, v_origin, now()
      );
      v_any_inserted := true;
    end if;

    -- Description change
    if coalesce(old.description,'') is distinct from coalesce(new.description,'') then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, old_value, new_value, origin, created_at
      ) values (
        new.id, v_actor, 'UPDATE', 'description',
        'Descrição atualizada',
        old.description, new.description, v_origin, now()
      );
      v_any_inserted := true;
    end if;

    -- Payment status change
    if coalesce(old.has_payment,false) is distinct from coalesce(new.has_payment,false) then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, old_value, new_value, origin, created_at
      ) values (
        new.id, v_actor, 'UPDATE', 'has_payment',
        case when new.has_payment then 'Lead marcado como pago' else 'Lead desmarcado como pago' end,
        coalesce(old.payment_value,0)::text,
        coalesce(new.payment_value,0)::text,
        v_origin, now()
      );
      v_any_inserted := true;
    elsif coalesce(old.payment_value,0) is distinct from coalesce(new.payment_value,0) then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, old_value, new_value, origin, created_at
      ) values (
        new.id, v_actor, 'UPDATE', 'payment_value',
        'Valor do pagamento atualizado',
        coalesce(old.payment_value,0)::text,
        coalesce(new.payment_value,0)::text,
        v_origin, now()
      );
      v_any_inserted := true;
    end if;

    if not v_any_inserted then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, origin, created_at
      ) values (
        new.id, v_actor, 'UPDATE', null, 'Lead atualizado: ' || coalesce(new.name,''), v_origin, now()
      );
    end if;

    return new;

  elsif tg_op = 'DELETE' then
    insert into public.crm_lead_activities (
      lead_id, user_id, action, field_changed, description, origin, created_at
    ) values (
      old.id, v_actor, 'DELETE', 'delete', 'Lead excluído: ' || coalesce(old.name,''), v_origin, now()
    );
    return old;
  end if;

  return new;
exception when others then
  raise notice 'CRM lead activity logging failed: %', sqlerrm;
  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

-- 4) Garantir trigger
drop trigger if exists crm_lead_activity_trigger on public.crm_leads;
create trigger crm_lead_activity_trigger
  after insert or update or delete on public.crm_leads
  for each row execute function public.log_crm_lead_changes();


-- 1) Marcar versão
insert into public.app_migrations (version, applied_at)
values ('33', now())
on conflict (version) do nothing;