-- User Life Context Table
-- Stores personal context information for AI mentor personalization
-- Categories: Profissional, Relacionamentos, Pessoal, História, Metas HD

create table if not exists public.user_life_context (
  user_id uuid primary key references auth.users(id) on delete cascade,
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- PROFISSIONAL - Para aplicar Estratégia em decisões de carreira
  -- ═══════════════════════════════════════════════════════════════════════════
  profissao_atual text,
  empresa_situacao text, -- empregado, autônomo, empresário, desempregado, estudante, aposentado
  desafios_profissionais text[], -- array de desafios
  aspiracoes_carreira text,
  narrativa_profissional text, -- campo livre para contexto adicional
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- RELACIONAMENTOS - Para análise de parcerias e dinâmicas familiares
  -- ═══════════════════════════════════════════════════════════════════════════
  status_relacionamento text, -- solteiro, namorando, casado, divorciado, viúvo
  relacionamentos_importantes jsonb default '[]'::jsonb, -- [{nome, tipo, notas}]
  desafios_relacionamentos text[],
  narrativa_relacionamentos text,
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- PESSOAL - Para identificar padrões Não-Self
  -- ═══════════════════════════════════════════════════════════════════════════
  valores_pessoais text[],
  hobbies_interesses text[],
  rotina_diaria text,
  foco_saude text,
  narrativa_pessoal text,
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- HISTÓRIA - Para entender condicionamento e descondicionamento
  -- ═══════════════════════════════════════════════════════════════════════════
  eventos_marcantes jsonb default '[]'::jsonb, -- [{ano, descricao}]
  transformacoes_vida text,
  jornada_hd text, -- quanto tempo conhece HD, como descobriu
  narrativa_historia text,
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- METAS HD - Para focar a mentoria
  -- ═══════════════════════════════════════════════════════════════════════════
  areas_aplicar_hd text[], -- carreira, relacionamentos, saúde, propósito, etc.
  padroes_nao_self_notados text[], -- padrões que já identificou
  objetivos_com_hd text,
  narrativa_metas text,
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for user lookup
create index if not exists idx_user_life_context_user_id on public.user_life_context(user_id);

-- RLS
alter table public.user_life_context enable row level security;

-- Owner can do everything with their own data
create policy "user_life_context_owner_all"
  on public.user_life_context
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Service role has full access (for AI/backend)
create policy "user_life_context_service_role_all"
  on public.user_life_context
  for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

-- Trigger for updated_at
create or replace function public.handle_user_life_context_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_life_context_updated_at on public.user_life_context;
create trigger user_life_context_updated_at
  before update on public.user_life_context
  for each row
  execute function public.handle_user_life_context_updated_at();

-- Comments for documentation
comment on table public.user_life_context is 'Kairos IA: User life context for personalized HD mentoring';
comment on column public.user_life_context.profissao_atual is 'Current profession/role';
comment on column public.user_life_context.empresa_situacao is 'Employment situation: empregado, autônomo, empresário, desempregado, estudante, aposentado';
comment on column public.user_life_context.desafios_profissionais is 'Array of professional challenges';
comment on column public.user_life_context.relacionamentos_importantes is 'JSONB array of important relationships: [{nome, tipo, notas}]';
comment on column public.user_life_context.eventos_marcantes is 'JSONB array of significant life events: [{ano, descricao}]';
comment on column public.user_life_context.padroes_nao_self_notados is 'Not-Self patterns the user has noticed';
comment on column public.user_life_context.areas_aplicar_hd is 'Areas where user wants to apply Human Design';

