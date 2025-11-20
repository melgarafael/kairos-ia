-- Q&A Pairs per organization
set search_path = public, auth;

create table if not exists public.qna_pairs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  pergunta text not null,
  resposta text not null,
  categoria text default 'Geral',
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_qna_pairs_org on public.qna_pairs(organization_id);
create index if not exists idx_qna_pairs_categoria on public.qna_pairs(categoria);
create index if not exists idx_qna_pairs_search on public.qna_pairs using gin (to_tsvector('portuguese', coalesce(pergunta,'') || ' ' || coalesce(resposta,'') || ' ' || coalesce(categoria,'')));

alter table public.qna_pairs enable row level security;

-- updated_at trigger (reusable)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_on_qna_pairs on public.qna_pairs;
create trigger set_timestamp_on_qna_pairs
before update on public.qna_pairs
for each row execute function public.set_updated_at();

-- RLS: organization scoped via app.organization_id (set by set_rls_context)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='qna_pairs' and policyname='qna_pairs_select_own_org') then
    create policy qna_pairs_select_own_org on public.qna_pairs
      for select to authenticated
      using (
        organization_id is not null
        and organization_id::text = nullif(current_setting('app.organization_id', true), '')
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='qna_pairs' and policyname='qna_pairs_modify_own_org') then
    create policy qna_pairs_modify_own_org on public.qna_pairs
      for all to authenticated
      using (
        organization_id is not null
        and organization_id::text = nullif(current_setting('app.organization_id', true), '')
      )
      with check (
        organization_id is not null
        and organization_id::text = nullif(current_setting('app.organization_id', true), '')
      );
  end if;
end $$;

comment on table public.qna_pairs is 'Perguntas e Respostas por organização (Q&A Knowledge Base).';



-- 3) Marcar versão
INSERT INTO public.app_migrations (version, applied_at)
VALUES ('40', now())
ON CONFLICT (version) DO NOTHING;
