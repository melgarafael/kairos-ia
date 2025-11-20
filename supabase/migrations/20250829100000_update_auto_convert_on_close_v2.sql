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


