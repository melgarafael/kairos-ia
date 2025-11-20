-- V62 – View inserível appointments_api (tolerante a "" em UUID) + regras de INSERT/UPDATE
begin;

-- 0) Helper para converter texto→uuid, tratando '' como NULL e dando erro claro em lixo
create or replace function public.safe_uuid(p_text text)
returns uuid
language plpgsql
as $$
declare
  v uuid;
begin
  if p_text is null or btrim(p_text) = '' then
    return null;
  end if;
  begin
    v := p_text::uuid;
    return v;
  exception when others then
    raise exception 'invalid input syntax for type uuid: "%"', p_text using errcode = '22P02';
  end;
end;
$$;

comment on function public.safe_uuid(text) is 'Converte texto→uuid; "" vira NULL; valores inválidos disparam 22P02.';

-- 1) View com colunas de IDs como text (para aceitar "" via PostgREST) e retornar dados legíveis
create or replace view public.appointments_api as
select
  a.id,
  a.organization_id::text    as organization_id,
  a.datetime,
  a.duration_minutes,
  a.tipo,
  a.status,
  a.criado_por::text         as criado_por,
  a.anotacoes,
  a.arquivos,
  a.valor_consulta,
  a.created_at,
  a.client_id::text          as client_id,
  a.lead_id::text            as lead_id,
  a.collaborator_id::text    as collaborator_id,
  a.title,
  a.updated_at
from public.appointments a;

comment on view public.appointments_api is 'Fachada tolerante para criar/atualizar appointments via PostgREST (Create Row). Converte ""→NULL e faz cast text→uuid nas regras.';

-- 2) Regras INSTEAD OF para INSERT/UPDATE (drop antes por idempotência)
drop rule if exists appointments_api_insert on public.appointments_api;
drop rule if exists appointments_api_update on public.appointments_api;

create rule appointments_api_insert as
on insert to public.appointments_api
do instead
insert into public.appointments (
  organization_id, datetime, duration_minutes, tipo, status, criado_por,
  anotacoes, arquivos, valor_consulta, client_id, lead_id, collaborator_id, title, created_at
) values (
  public.safe_uuid(new.organization_id),
  new.datetime,
  coalesce(new.duration_minutes, 30),
  new.tipo,
  coalesce(nullif(new.status, ''), 'agendado'),
  public.safe_uuid(new.criado_por),
  nullif(new.anotacoes, ''),
  new.arquivos,
  new.valor_consulta,
  public.safe_uuid(new.client_id),
  public.safe_uuid(new.lead_id),
  public.safe_uuid(new.collaborator_id),
  nullif(new.title, ''),
  coalesce(new.created_at, now())
)
returning
  id,
  organization_id::text      as organization_id,
  datetime,
  duration_minutes,
  tipo,
  status,
  criado_por::text           as criado_por,
  anotacoes,
  arquivos,
  valor_consulta,
  created_at,
  client_id::text            as client_id,
  lead_id::text              as lead_id,
  collaborator_id::text      as collaborator_id,
  title,
  updated_at;

create rule appointments_api_update as
on update to public.appointments_api
do instead
update public.appointments set
  -- organization_id não é alterado por padrão
  datetime          = coalesce(new.datetime, public.appointments.datetime),
  duration_minutes  = coalesce(new.duration_minutes, public.appointments.duration_minutes),
  tipo              = coalesce(new.tipo, public.appointments.tipo),
  status            = coalesce(nullif(new.status,''), public.appointments.status),
  criado_por        = coalesce(public.safe_uuid(new.criado_por), public.appointments.criado_por),
  anotacoes         = coalesce(nullif(new.anotacoes,''), public.appointments.anotacoes),
  arquivos          = coalesce(new.arquivos, public.appointments.arquivos),
  valor_consulta    = coalesce(new.valor_consulta, public.appointments.valor_consulta),
  client_id         = coalesce(public.safe_uuid(new.client_id), public.appointments.client_id),
  lead_id           = coalesce(public.safe_uuid(new.lead_id), public.appointments.lead_id),
  collaborator_id   = coalesce(public.safe_uuid(new.collaborator_id), public.appointments.collaborator_id),
  title             = coalesce(nullif(new.title,''), public.appointments.title),
  updated_at        = now()
where id = new.id
returning
  id,
  organization_id::text      as organization_id,
  datetime,
  duration_minutes,
  tipo,
  status,
  criado_por::text           as criado_por,
  anotacoes,
  arquivos,
  valor_consulta,
  created_at,
  client_id::text            as client_id,
  lead_id::text              as lead_id,
  collaborator_id::text      as collaborator_id,
  title,
  updated_at;

-- 3) Grants de acesso (RLS continua aplicada na tabela base)
grant select, insert, update on public.appointments_api to anon, authenticated;

commit;

-- 4) Registrar versão
insert into public.app_migrations (version, applied_at)
values ('62', now())
on conflict (version) do nothing;