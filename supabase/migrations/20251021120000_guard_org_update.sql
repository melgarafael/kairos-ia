-- Master: Guardar updates de organization_id e expor RPC segura
set search_path = public, auth;

-- 01) Trigger guard: impede update de organization_id fora da RPC
create or replace function public.guard_org_update()
returns trigger
language plpgsql
as $$
begin
  if (new.organization_id is distinct from old.organization_id) then
    if coalesce(current_setting('app.allow_org_update', true), '0') <> '1' then
      raise exception 'organization_id update is not allowed here';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_org_update on public.saas_users;
create trigger trg_guard_org_update
before update on public.saas_users
for each row execute function public.guard_org_update();

-- 02) RPC segura: atualiza organization_id na MESMA sessão
create or replace function public.update_user_organization(p_user_id uuid, p_organization_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  perform set_config('app.allow_org_update','1', true);
  update public.saas_users
    set organization_id = p_organization_id,
        updated_at = now()
  where id = p_user_id;
end;
$$;

grant execute on function public.update_user_organization(uuid, uuid) to service_role;


