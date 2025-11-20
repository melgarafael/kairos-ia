-- v79 – Kanban: Ordenação Visual de Leads por Posição (stage_order)
-- Objetivo:
--  1) Adicionar coluna stage_order para manter a posição exata onde o usuário solta o card no Kanban
--  2) Permitir ordenação customizada por drag-and-drop sem depender apenas de created_at
--  3) Garantir que leads fiquem exatamente onde o usuário os posiciona visualmente

-- Add stage_order column to crm_leads for visual position ordering within stages
-- This allows users to manually reorder leads within a stage via drag and drop

begin;

-- Add stage_order column (nullable initially for backward compatibility)
alter table public.crm_leads
  add column if not exists stage_order integer default null;

-- Create index for efficient ordering queries
create index if not exists idx_crm_leads_stage_order 
  on public.crm_leads(organization_id, stage, stage_order);

-- Backfill: assign initial order based on created_at (oldest = 0, newest = N)
-- This ensures existing leads maintain their current visual order
with ranked as (
  select 
    id,
    row_number() over (partition by organization_id, stage order by created_at asc) - 1 as initial_order
  from public.crm_leads
  where stage is not null
)
update public.crm_leads l
set stage_order = r.initial_order
from ranked r
where l.id = r.id and l.stage_order is null;

-- Set default for new leads (will be overridden by application logic)
alter table public.crm_leads
  alter column stage_order set default 0;

-- Add helpful comment
comment on column public.crm_leads.stage_order is 
  'Visual position order within the stage (0 = first, increasing downwards). Used for drag-and-drop positioning in Kanban view.';

commit;

-- Registrar versão
create table if not exists public.app_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

insert into public.app_migrations (version, applied_at)
values ('79', now())
on conflict (version) do nothing;
