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


