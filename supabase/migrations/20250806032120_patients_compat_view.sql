-- Compatibility view for legacy references to public.patients
-- Maps to current public.clients

create or replace view public.patients as
select
  c.id,
  c.organization_id,
  c.nome,
  c.email,
  c.telefone,
  c.nascimento,
  c.documentos,
  c.endereco,
  c.observacoes,
  c.ativo,
  c.created_at,
  c.updated_at
from public.clients c;

comment on view public.patients is 'Compatibility view mapping clients -> patients for legacy code.';

grant select on public.patients to anon, authenticated, service_role;

