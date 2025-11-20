-- v18 – RPC para remover conexão do n8n por organização

create or replace function public.n8n_delete(p_organization_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Setar o contexto de organização para cumprir as policies RLS
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);

  -- Remover a conexão vinculada
  delete from public.n8n_connections c
  where c.organization_id = p_organization_id;
end; $$;

grant execute on function public.n8n_delete(uuid) to anon, authenticated;

-- 5) Marcar versão
insert into public.app_migrations (version, applied_at)
values ('18', now())
on conflict (version) do nothing;

