-- Adicionar política de DELETE para saas_supabases_connections
-- Permite que owners deletem suas próprias conexões

-- Política de DELETE
drop policy if exists "ssc_owner_delete" on public.saas_supabases_connections;
create policy "ssc_owner_delete" on public.saas_supabases_connections
  for delete to authenticated, anon
  using (owner_id = auth.uid());

-- Grant DELETE permission
grant delete on public.saas_supabases_connections to anon, authenticated;

