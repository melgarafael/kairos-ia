-- Maintain crm_leads.value as sum of interested products (preco_base * quantity)
-- If no interests, keep existing value (manual). We will only update value when interests change;
-- if user set a manual value and there are interests, the trigger will compute and override.

begin;

create or replace function public.recalc_lead_value(p_lead_id uuid) returns void as $$
declare
  v_org uuid;
  v_sum numeric;
begin
  select organization_id into v_org from public.crm_leads where id = p_lead_id;

  -- Sum of preco_base * quantity for the same organization
  select coalesce(sum(ps.preco_base * li.quantity), 0)
    into v_sum
  from public.crm_lead_interests li
  join public.produtos_servicos ps
    on ps.id = li.produto_servico_id
   and ps.organization_id = li.organization_id
  where li.lead_id = p_lead_id;

  -- Update crm_leads.value if there are any interests
  if v_sum > 0 then
    update public.crm_leads
       set value = v_sum,
           updated_at = now()
     where id = p_lead_id;
  end if;
end;
$$ language plpgsql;

create or replace function public.trg_recalc_lead_value() returns trigger as $$
begin
  perform public.recalc_lead_value(coalesce(new.lead_id, old.lead_id));
  return new;
end;
$$ language plpgsql;

do $$
begin
  perform 1 from information_schema.tables
   where table_schema = 'public' and table_name = 'crm_lead_interests';
  if found then
    drop trigger if exists recalc_lead_value_ins on public.crm_lead_interests;
    create trigger recalc_lead_value_ins
      after insert on public.crm_lead_interests
      for each row execute function public.trg_recalc_lead_value();

    drop trigger if exists recalc_lead_value_upd on public.crm_lead_interests;
    create trigger recalc_lead_value_upd
      after update on public.crm_lead_interests
      for each row execute function public.trg_recalc_lead_value();

    drop trigger if exists recalc_lead_value_del on public.crm_lead_interests;
    create trigger recalc_lead_value_del
      after delete on public.crm_lead_interests
      for each row execute function public.trg_recalc_lead_value();
  end if;
end $$;

commit;


