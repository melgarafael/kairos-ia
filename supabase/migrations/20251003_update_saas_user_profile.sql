-- Master: RPC to update user profile (name, phone) on public.saas_users
-- Also ensures required columns exist (idempotent) and grants execute.

begin;

-- 1) Ensure columns exist on saas_users
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'saas_users' and column_name = 'name'
  ) then
    alter table public.saas_users add column name text;
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'saas_users' and column_name = 'phone'
  ) then
    alter table public.saas_users add column phone text;
  end if;
end $$;

-- 2) RPC: update_saas_user_profile
create or replace function public.update_saas_user_profile(
  p_user_id uuid,
  p_name text default null,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_exists boolean;
begin
  -- Guard: only allow updating own row when called by authenticated user (extra safety besides RLS)
  if auth.uid() is not null and auth.uid() <> p_user_id then
    return jsonb_build_object('success', false, 'error', 'unauthorized_user_id');
  end if;

  update public.saas_users
     set name = coalesce(p_name, name),
         phone = coalesce(p_phone, phone),
         updated_at = now()
   where id = p_user_id;

  get diagnostics v_exists = row_count > 0;

  if v_exists then
    return jsonb_build_object('success', true);
  else
    return jsonb_build_object('success', false, 'error', 'user_not_found');
  end if;
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- 3) Grants
grant execute on function public.update_saas_user_profile(uuid, text, text) to authenticated;
grant execute on function public.update_saas_user_profile(uuid, text, text) to anon;
grant execute on function public.update_saas_user_profile(uuid, text, text) to public;

commit;


