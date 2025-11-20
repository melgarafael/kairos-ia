-- AI Agent Metrics schema and functions
-- Computes conversation-level and daily metrics for WhatsApp repository messages
-- Follows organization-scoped RLS via explicit organization_id param

-- 1) Helpful indexes on repositorio_de_mensagens for time-window queries
create index if not exists idx_rm_org_time on public.repositorio_de_mensagens(organization_id, created_at desc);
create index if not exists idx_rm_org_sender on public.repositorio_de_mensagens(organization_id, sender_type);
create index if not exists idx_rm_org_whats on public.repositorio_de_mensagens(organization_id, whatsapp_cliente, whatsapp_empresa);

-- 2) Conversation message counts per (whatsapp_cliente, whatsapp_empresa)
--    Returns total messages and IA-only counts for a given window
create or replace function public.ai_agent_metrics_conversation_counts(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  whatsapp_cliente text,
  whatsapp_empresa text,
  total_messages bigint,
  ia_messages bigint,
  human_messages bigint,
  first_message_at timestamptz,
  last_message_at timestamptz
)
language sql
stable
as $$
  with base as (
    select whatsapp_cliente,
           whatsapp_empresa,
           sender_type,
           created_at
    from public.repositorio_de_mensagens
    where organization_id = p_org
      and created_at >= p_from
      and created_at <= p_to
  )
  select
    b.whatsapp_cliente,
    b.whatsapp_empresa,
    count(*) as total_messages,
    count(*) filter (where b.sender_type = 'ia') as ia_messages,
    count(*) filter (where b.sender_type = 'cliente' or b.sender_type = 'humano') as human_messages,
    min(b.created_at) as first_message_at,
    max(b.created_at) as last_message_at
  from base b
  where coalesce(b.whatsapp_cliente, '') <> '' and coalesce(b.whatsapp_empresa, '') <> ''
  group by 1,2
  order by last_message_at desc;
$$;

comment on function public.ai_agent_metrics_conversation_counts is 'Conversation-level message counts and time bounds for a window, grouped by client/company numbers.';

-- 3) Conversation dynamics focused on user intervals (cliente only)
--    Computes per-conversation stats: avg, median, p90 interval (seconds) between consecutive messages from the user
create or replace function public.ai_agent_metrics_conversation_dynamics(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  whatsapp_cliente text,
  whatsapp_empresa text,
  messages_from_user bigint,
  avg_interval_seconds numeric,
  median_interval_seconds numeric,
  p90_interval_seconds numeric
)
language plpgsql
stable
as $$
begin
  return query
  with msgs as (
    select whatsapp_cliente,
           whatsapp_empresa,
           created_at,
           lag(created_at) over(partition by whatsapp_cliente, whatsapp_empresa order by created_at) as prev_created_at,
           sender_type
    from public.repositorio_de_mensagens
    where organization_id = p_org
      and created_at >= p_from
      and created_at <= p_to
      and sender_type = 'cliente'
      and coalesce(whatsapp_cliente,'') <> ''
      and coalesce(whatsapp_empresa,'') <> ''
  ), gaps as (
    select whatsapp_cliente,
           whatsapp_empresa,
           extract(epoch from (created_at - prev_created_at))::numeric as gap_seconds
    from msgs
    where prev_created_at is not null
  ), stats as (
    select whatsapp_cliente,
           whatsapp_empresa,
           count(*) as messages_from_user,
           avg(gap_seconds) as avg_interval_seconds,
           percentile_cont(0.5) within group (order by gap_seconds) as median_interval_seconds,
           percentile_cont(0.90) within group (order by gap_seconds) as p90_interval_seconds
    from gaps
    group by whatsapp_cliente, whatsapp_empresa
  )
  select * from stats
  order by messages_from_user desc;
end;
$$;

comment on function public.ai_agent_metrics_conversation_dynamics is 'Per-conversation user-only inter-message intervals (avg/median/p90) within a time window.';

-- 4) Daily aggregates (America/Sao_Paulo, UTC-3) with counts of distinct users and messages per day
--    p_granularity: 'day' | 'week' | 'month' | '90d' (rolled into days)
create or replace function public.ai_agent_metrics_daily(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  day date,
  messages_total bigint,
  users_attended bigint
)
language sql
stable
as $$
  with tz as (
    select (created_at at time zone 'America/Sao_Paulo')::date as d,
           whatsapp_cliente
    from public.repositorio_de_mensagens
    where organization_id = p_org
      and created_at >= p_from
      and created_at <= p_to
  )
  select
    t.d as day,
    count(*) as messages_total,
    count(distinct t.whatsapp_cliente) as users_attended
  from tz t
  group by t.d
  order by t.d asc;
$$;

comment on function public.ai_agent_metrics_daily is 'Daily totals in America/Sao_Paulo: messages and distinct users attended per day.';

-- 5) Wrapper RPC enforcing org context from session/app header when called via anon (optional)
-- We keep direct p_org param for Edge usage. Policies should ensure callers can only see their org.

-- 5) Summary across the window: total messages and distinct users attended (unique whatsapp_cliente)
-- Note: cliente_messages was added in migration 20251104190513_add_cliente_messages_to_summary.sql
create or replace function public.ai_agent_metrics_summary(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  total_messages bigint,
  human_messages bigint,
  cliente_messages bigint,
  users_attended bigint
)
language sql
stable
as $$
  select
    count(*) as total_messages,
    count(*) filter (where sender_type in ('cliente','humano')) as human_messages,
    count(*) filter (where sender_type = 'cliente') as cliente_messages,
    count(distinct whatsapp_cliente) as users_attended
  from public.repositorio_de_mensagens
  where organization_id = p_org
    and created_at >= p_from
    and created_at <= p_to;
$$;

comment on function public.ai_agent_metrics_summary is 'Window summary: total messages and distinct whatsapp_cliente count for the organization.';

-- 6) Persistent daily aggregation table (optional performance/cache layer)
create table if not exists public.ai_agent_metrics_daily_agg (
  organization_id uuid not null,
  day date not null,
  messages_total bigint not null,
  users_attended bigint not null,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, day)
);

alter table public.ai_agent_metrics_daily_agg enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_agent_metrics_daily_agg' and policyname = 'Allow org read'
  ) then
    create policy "Allow org read" on public.ai_agent_metrics_daily_agg
      for select
      using (current_setting('app.organization_id', true)::uuid = organization_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_agent_metrics_daily_agg' and policyname = 'Allow org upsert'
  ) then
    create policy "Allow org upsert" on public.ai_agent_metrics_daily_agg
      for insert with check (current_setting('app.organization_id', true)::uuid = organization_id);
    create policy "Allow org update" on public.ai_agent_metrics_daily_agg
      for update using (current_setting('app.organization_id', true)::uuid = organization_id);
  end if;
end $$;

-- 7) Backfill RPC to populate daily aggregation from repositorio_de_mensagens
create or replace function public.ai_agent_metrics_backfill_daily(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns void
language plpgsql
as $$
begin
  -- Ensure RLS context for policies that rely on app.organization_id
  perform set_config('app.organization_id', p_org::text, true);

  with d as (
    select
      (created_at at time zone 'America/Sao_Paulo')::date as day,
      count(*) as messages_total,
      count(distinct whatsapp_cliente) as users_attended
    from public.repositorio_de_mensagens
    where organization_id = p_org
      and created_at >= p_from
      and created_at <= p_to
    group by 1
  )
  insert into public.ai_agent_metrics_daily_agg(organization_id, day, messages_total, users_attended, inserted_at, updated_at)
  select p_org, d.day, d.messages_total, d.users_attended, now(), now()
  from d
  on conflict (organization_id, day) do update
    set messages_total = excluded.messages_total,
        users_attended = excluded.users_attended,
        updated_at = now();
end;
$$;

-- 8) Conversation depth metrics (messages per conversation statistics)
create or replace function public.ai_agent_metrics_depth(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  conversations bigint,
  messages_total bigint,
  avg_msgs_per_conversation numeric,
  p50_msgs_per_conversation numeric,
  p90_msgs_per_conversation numeric
)
language sql
stable
as $$
  with conv as (
    select whatsapp_cliente, whatsapp_empresa, count(*) as msgs
    from public.repositorio_de_mensagens
    where organization_id = p_org
      and created_at >= p_from and created_at <= p_to
      and coalesce(whatsapp_cliente,'') <> '' and coalesce(whatsapp_empresa,'') <> ''
    group by 1,2
  )
  select
    count(*) as conversations,
    coalesce(sum(msgs),0) as messages_total,
    case when count(*) > 0 then round(avg(msgs)::numeric, 2) else 0 end as avg_msgs_per_conversation,
    percentile_cont(0.5) within group (order by msgs) as p50_msgs_per_conversation,
    percentile_cont(0.90) within group (order by msgs) as p90_msgs_per_conversation
  from conv;
$$;

-- 9) Human involvement rate: % of conversations with at least 1 human message in window
create or replace function public.ai_agent_metrics_human_involvement(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  conversations bigint,
  conversations_with_human bigint,
  involvement_rate numeric
)
language sql
stable
as $$
  with conv as (
    select whatsapp_cliente, whatsapp_empresa,
           bool_or(sender_type in ('cliente','humano')) as has_human
    from public.repositorio_de_mensagens
    where organization_id = p_org
      and created_at >= p_from and created_at <= p_to
      and coalesce(whatsapp_cliente,'') <> '' and coalesce(whatsapp_empresa,'') <> ''
    group by 1,2
  )
  select
    count(*) as conversations,
    count(*) filter (where has_human) as conversations_with_human,
    case when count(*) > 0 then round(100.0 * count(*) filter (where has_human) / count(*), 2) else 0 end as involvement_rate
  from conv;
$$;

-- 10) Time-to-handoff: messages until first human message (per conversation) + percentiles
create or replace function public.ai_agent_metrics_time_to_handoff(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  conversations bigint,
  with_handoff bigint,
  avg_msgs_until_handoff numeric,
  p50_msgs_until_handoff numeric,
  p90_msgs_until_handoff numeric
)
language sql
stable
as $$
  with msgs as (
    select whatsapp_cliente, whatsapp_empresa, sender_type, created_at
    from public.repositorio_de_mensagens
    where organization_id = p_org
      and created_at >= p_from and created_at <= p_to
      and coalesce(whatsapp_cliente,'') <> '' and coalesce(whatsapp_empresa,'') <> ''
  ), ordered as (
    select *, row_number() over (partition by whatsapp_cliente, whatsapp_empresa order by created_at) as rn
    from msgs
  ), first_human as (
    select whatsapp_cliente, whatsapp_empresa, min(rn) as first_human_rn
    from ordered where sender_type in ('cliente','humano') group by 1,2
  ), conv as (
    select o.whatsapp_cliente, o.whatsapp_empresa, o.rn, fh.first_human_rn
    from ordered o
    left join first_human fh using (whatsapp_cliente, whatsapp_empresa)
  ), per_conv as (
    select whatsapp_cliente, whatsapp_empresa,
           min(first_human_rn) as first_handoff_at,
           max(rn) as last_rn
    from conv group by 1,2
  ), filtered as (
    select * from per_conv
  )
  select
    count(*) as conversations,
    count(*) filter (where first_handoff_at is not null) as with_handoff,
    case when count(*) filter (where first_handoff_at is not null) > 0
      then round(avg(first_handoff_at)::numeric, 2) else 0 end as avg_msgs_until_handoff,
    percentile_cont(0.5) within group (order by first_handoff_at) filter (where first_handoff_at is not null) as p50_msgs_until_handoff,
    percentile_cont(0.90) within group (order by first_handoff_at) filter (where first_handoff_at is not null) as p90_msgs_until_handoff
  from filtered;
$$;


-- 11) Top terms (n-grams simples) a partir de content_text
create or replace function public.ai_agent_metrics_top_terms(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz,
  p_limit int default 20,
  p_min_len int default 3,
  p_ngram int default 1
)
returns table (
  term text,
  freq bigint
)
language sql
stable
as $$
  with msgs as (
    select regexp_split_to_array(lower(coalesce(content_text,'')), '[^0-9A-Za-zÀ-ÿ]+' ) as arr
    from public.repositorio_de_mensagens
    where organization_id = p_org
      and created_at >= p_from and created_at <= p_to
      and coalesce(content_text,'') <> ''
  ), unigrams as (
    select t.token as term
    from msgs m,
         unnest(m.arr) with ordinality as t(token, pos)
    where length(t.token) >= p_min_len
  ), bigrams as (
    select concat(t1.token,' ',t2.token) as term
    from msgs m,
         unnest(m.arr) with ordinality as t1(token, pos)
         join unnest(m.arr) with ordinality as t2(token, pos)
           on t2.pos = t1.pos + 1
    where length(t1.token) >= p_min_len and length(t2.token) >= p_min_len
  ), terms as (
    select term from unigrams where p_ngram = 1
    union all
    select term from bigrams where p_ngram = 2
  )
  select term, count(*) as freq
  from terms
  group by term
  order by freq desc
  limit greatest(p_limit, 1);
$$;

-- 12) Satisfação proxy via termos de agradecimento (cliente/humano)
create or replace function public.ai_agent_metrics_satisfaction_proxy(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  conversations bigint,
  positive_conversations bigint,
  satisfaction_rate numeric
)
language sql
stable
as $$
  with msgs as (
    select whatsapp_cliente, whatsapp_empresa, lower(coalesce(content_text,'')) as txt
    from public.repositorio_de_mensagens
    where organization_id = p_org
      and created_at >= p_from and created_at <= p_to
      and sender_type in ('cliente','humano')
      and coalesce(content_text,'') <> ''
  ), flags as (
    select whatsapp_cliente, whatsapp_empresa,
           bool_or(txt ~* '\m(obrigad|valeu)') as is_positive
    from msgs
    group by 1,2
  )
  select
    count(*) as conversations,
    count(*) filter (where is_positive) as positive_conversations,
    case when count(*) > 0 then round(100.0 * count(*) filter (where is_positive) / count(*), 2) else 0 end as satisfaction_rate
  from flags;
$$;

-- 13) Métricas por instância (whatsapp_empresa)
create or replace function public.ai_agent_metrics_by_instance(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  whatsapp_empresa text,
  messages_total bigint,
  conversations bigint,
  conversations_with_human bigint,
  involvement_rate numeric,
  avg_msgs_per_conversation numeric
)
language sql
stable
as $$
  with base as (
    select whatsapp_empresa, whatsapp_cliente, sender_type
    from public.repositorio_de_mensagens
    where organization_id = p_org
      and created_at >= p_from and created_at <= p_to
      and coalesce(whatsapp_empresa,'') <> '' and coalesce(whatsapp_cliente,'') <> ''
  ), msgs as (
    select whatsapp_empresa, count(*) as messages_total
    from base group by 1
  ), conv as (
    select whatsapp_empresa, whatsapp_cliente, count(*) as msgs,
           bool_or(sender_type in ('cliente','humano')) as has_human
    from base
    group by 1,2
  ), agg as (
    select whatsapp_empresa,
           count(*) as conversations,
           count(*) filter (where has_human) as conversations_with_human,
           case when count(*) > 0 then round(100.0 * count(*) filter (where has_human) / count(*), 2) else 0 end as involvement_rate,
           case when count(*) > 0 then round(avg(msgs)::numeric, 2) else 0 end as avg_msgs_per_conversation
    from conv group by 1
  )
  select a.whatsapp_empresa, m.messages_total, a.conversations, a.conversations_with_human, a.involvement_rate, a.avg_msgs_per_conversation
  from agg a
  left join msgs m using (whatsapp_empresa)
  order by m.messages_total desc nulls last, a.conversations desc;
$$;

-- 12) Mark master version as v49
insert into public.app_migrations (version, applied_at)
values ('49', now())
on conflict (version) do nothing;

