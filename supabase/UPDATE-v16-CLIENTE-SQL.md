--
-- CRM Lead Activities: add field_changed and log description changes
--
-- This migration updates the audit trail for leads so that it records
-- specific field changes (starting with stage and description), avoiding
-- misleading entries where old/new values repeat when nothing changed.

-- 1) Schema: add column field_changed
alter table if exists public.crm_lead_activities
  add column if not exists field_changed text;

-- 2) Logic: update trigger function to log per-field changes
create or replace function public.log_crm_lead_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_any_inserted boolean := false;
begin
  v_actor := coalesce(new.updated_by, new.created_by, old.updated_by, old.created_by);

  if tg_op = 'INSERT' then
    -- Lead created
    insert into public.crm_lead_activities (
      lead_id, user_id, action, field_changed, description, created_at
    ) values (
      new.id, v_actor, 'INSERT', 'insert', 'Lead criado: ' || coalesce(new.name,''), now()
    );
    return new;

  elsif tg_op = 'UPDATE' then
    -- Stage change
    if old.stage is distinct from new.stage then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, old_value, new_value, created_at
      ) values (
        new.id, v_actor, 'UPDATE', 'stage',
        'Lead movido para: ' || coalesce(new.stage,'indefinido'),
        old.stage, new.stage, now()
      );
      v_any_inserted := true;
    end if;

    -- Description change
    if coalesce(old.description,'') is distinct from coalesce(new.description,'') then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, old_value, new_value, created_at
      ) values (
        new.id, v_actor, 'UPDATE', 'description',
        'Descrição atualizada',
        old.description, new.description, now()
      );
      v_any_inserted := true;
    end if;

    -- Payment status change (keep as meaningful event)
    if coalesce(old.has_payment,false) is distinct from coalesce(new.has_payment,false) then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, old_value, new_value, created_at
      ) values (
        new.id, v_actor, 'UPDATE', 'has_payment',
        case when new.has_payment then 'Lead marcado como pago' else 'Lead desmarcado como pago' end,
        coalesce(old.payment_value,0)::text,
        coalesce(new.payment_value,0)::text,
        now()
      );
      v_any_inserted := true;
    elsif coalesce(old.payment_value,0) is distinct from coalesce(new.payment_value,0) then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, old_value, new_value, created_at
      ) values (
        new.id, v_actor, 'UPDATE', 'payment_value',
        'Valor do pagamento atualizado',
        coalesce(old.payment_value,0)::text,
        coalesce(new.payment_value,0)::text,
        now()
      );
      v_any_inserted := true;
    end if;

    -- Fallback generic update (only if nothing above was logged)
    if not v_any_inserted then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, created_at
      ) values (
        new.id, v_actor, 'UPDATE', null, 'Lead atualizado: ' || coalesce(new.name,''), now()
      );
    end if;

    return new;

  elsif tg_op = 'DELETE' then
    insert into public.crm_lead_activities (
      lead_id, user_id, action, field_changed, description, created_at
    ) values (
      old.id, v_actor, 'DELETE', 'delete', 'Lead excluído: ' || coalesce(old.name,''), now()
    );
    return old;
  end if;

  return new;
exception when others then
  -- Non-critical; don’t block writes
  raise notice 'CRM lead activity logging failed: %', sqlerrm;
  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

-- 3) Ensure trigger exists (idempotent)
drop trigger if exists crm_lead_activity_trigger on public.crm_leads;
create trigger crm_lead_activity_trigger
  after insert or update or delete on public.crm_leads
  for each row execute function public.log_crm_lead_changes();

-- 2) Marcar versão
insert into public.app_migrations (version, applied_at)
values ('16', now())
on conflict (version) do nothing;
