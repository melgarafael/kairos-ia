

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE TYPE "public"."msg_direction" AS ENUM (
    'inbound',
    'outbound'
);


ALTER TYPE "public"."msg_direction" OWNER TO "postgres";


CREATE TYPE "public"."sender_type" AS ENUM (
    'cliente',
    'ia',
    'humano'
);


ALTER TYPE "public"."sender_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."advisory_key"("p" "text") RETURNS bigint
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select (('x' || substr(md5(coalesce(p,'')), 1, 16))::bit(64))::bigint
$$;


ALTER FUNCTION "public"."advisory_key"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."advisory_unlock"("p" "text") RETURNS boolean
    LANGUAGE "sql"
    AS $$
  select pg_advisory_unlock(public.advisory_key(p))
$$;


ALTER FUNCTION "public"."advisory_unlock"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."agent_prompts_delete"("p_organization_id" "uuid", "p_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
declare
  v_deleted int := 0;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  delete from public.agent_prompts
  where id = p_id
    and organization_id = p_organization_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;


ALTER FUNCTION "public"."agent_prompts_delete"("p_organization_id" "uuid", "p_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agent_prompts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "agent_name" "text" NOT NULL,
    "prompt" "text" NOT NULL,
    "tools_instructions" "text",
    "tasks" "text",
    "business_description" "text",
    "agent_goal" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "output_format" "jsonb" DEFAULT '{}'::"jsonb",
    "rhf_feedbacks" "jsonb" DEFAULT '[]'::"jsonb",
    "fewshots_examples" "jsonb" DEFAULT '[]'::"jsonb",
    "tone_of_voice" "text"
);


ALTER TABLE "public"."agent_prompts" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."agent_prompts_list"("p_organization_id" "uuid", "p_query" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 500, "p_offset" integer DEFAULT 0) RETURNS SETOF "public"."agent_prompts"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  return query
    select *
      from public.agent_prompts
     where organization_id = p_organization_id
       and (
         p_query is null
         or p_query = ''
         or (
           coalesce(agent_name,'') ilike '%' || p_query || '%'
           or coalesce(prompt,'') ilike '%' || p_query || '%'
           or coalesce(business_description,'') ilike '%' || p_query || '%'
           or coalesce(agent_goal,'') ilike '%' || p_query || '%'
         )
       )
     order by updated_at desc
     limit greatest(p_limit, 1)
     offset greatest(p_offset, 0);
end;
$$;


ALTER FUNCTION "public"."agent_prompts_list"("p_organization_id" "uuid", "p_query" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."agent_prompts_upsert"("p_organization_id" "uuid", "p_agent_name" "text", "p_prompt" "text", "p_tools_instructions" "text" DEFAULT NULL::"text", "p_tasks" "text" DEFAULT NULL::"text", "p_business_description" "text" DEFAULT NULL::"text", "p_agent_goal" "text" DEFAULT NULL::"text") RETURNS "public"."agent_prompts"
    LANGUAGE "plpgsql"
    AS $$
declare
  rec public.agent_prompts;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  insert into public.agent_prompts (
    organization_id, agent_name, prompt, tools_instructions, tasks, business_description, agent_goal
  ) values (
    p_organization_id,
    trim(coalesce(p_agent_name, '')),
    trim(coalesce(p_prompt, '')),
    nullif(trim(coalesce(p_tools_instructions, '')), ''),
    nullif(trim(coalesce(p_tasks, '')), ''),
    nullif(trim(coalesce(p_business_description, '')), ''),
    nullif(trim(coalesce(p_agent_goal, '')), '')
  )
  on conflict (organization_id, agent_name)
  do update set
    prompt = EXCLUDED.prompt,
    tools_instructions = EXCLUDED.tools_instructions,
    tasks = EXCLUDED.tasks,
    business_description = EXCLUDED.business_description,
    agent_goal = EXCLUDED.agent_goal,
    updated_at = now()
  returning * into rec;
  return rec;
end;
$$;


ALTER FUNCTION "public"."agent_prompts_upsert"("p_organization_id" "uuid", "p_agent_name" "text", "p_prompt" "text", "p_tools_instructions" "text", "p_tasks" "text", "p_business_description" "text", "p_agent_goal" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."agent_prompts_upsert"("p_organization_id" "uuid", "p_agent_name" "text", "p_prompt" "text", "p_tools_instructions" "text" DEFAULT NULL::"text", "p_tasks" "text" DEFAULT NULL::"text", "p_business_description" "text" DEFAULT NULL::"text", "p_agent_goal" "text" DEFAULT NULL::"text", "p_output_format" "jsonb" DEFAULT '{}'::"jsonb", "p_rhf_feedbacks" "jsonb" DEFAULT '[]'::"jsonb", "p_fewshots_examples" "jsonb" DEFAULT '[]'::"jsonb", "p_tone_of_voice" "text" DEFAULT NULL::"text") RETURNS "public"."agent_prompts"
    LANGUAGE "plpgsql"
    AS $$
declare
  rec public.agent_prompts;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  insert into public.agent_prompts (
    organization_id, agent_name, prompt, tools_instructions, tasks, business_description, agent_goal, output_format, rhf_feedbacks, fewshots_examples, tone_of_voice
  ) values (
    p_organization_id,
    trim(coalesce(p_agent_name, '')),
    trim(coalesce(p_prompt, '')),
    nullif(trim(coalesce(p_tools_instructions, '')), ''),
    nullif(trim(coalesce(p_tasks, '')), ''),
    nullif(trim(coalesce(p_business_description, '')), ''),
    nullif(trim(coalesce(p_agent_goal, '')), ''),
    p_output_format,
    p_rhf_feedbacks,
    p_fewshots_examples,
    nullif(trim(coalesce(p_tone_of_voice, '')), '')
  )
  on conflict (organization_id, agent_name)
  do update set
    prompt = EXCLUDED.prompt,
    tools_instructions = EXCLUDED.tools_instructions,
    tasks = EXCLUDED.tasks,
    business_description = EXCLUDED.business_description,
    agent_goal = EXCLUDED.agent_goal,
    output_format = EXCLUDED.output_format,
    rhf_feedbacks = EXCLUDED.rhf_feedbacks,
    fewshots_examples = EXCLUDED.fewshots_examples,
    tone_of_voice = EXCLUDED.tone_of_voice,
    updated_at = now()
  returning * into rec;
  return rec;
end;
$$;


ALTER FUNCTION "public"."agent_prompts_upsert"("p_organization_id" "uuid", "p_agent_name" "text", "p_prompt" "text", "p_tools_instructions" "text", "p_tasks" "text", "p_business_description" "text", "p_agent_goal" "text", "p_output_format" "jsonb", "p_rhf_feedbacks" "jsonb", "p_fewshots_examples" "jsonb", "p_tone_of_voice" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_agent_metrics_backfill_daily"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."ai_agent_metrics_backfill_daily"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_agent_metrics_by_instance"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) RETURNS TABLE("whatsapp_empresa" "text", "messages_total" bigint, "conversations" bigint, "conversations_with_human" bigint, "involvement_rate" numeric, "avg_msgs_per_conversation" numeric)
    LANGUAGE "sql" STABLE
    AS $$
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


ALTER FUNCTION "public"."ai_agent_metrics_by_instance"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_agent_metrics_conversation_counts"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) RETURNS TABLE("whatsapp_cliente" "text", "whatsapp_empresa" "text", "total_messages" bigint, "ia_messages" bigint, "human_messages" bigint, "first_message_at" timestamp with time zone, "last_message_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    AS $$
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


ALTER FUNCTION "public"."ai_agent_metrics_conversation_counts"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ai_agent_metrics_conversation_counts"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) IS 'Conversation-level message counts and time bounds for a window, grouped by client/company numbers.';



CREATE OR REPLACE FUNCTION "public"."ai_agent_metrics_conversation_dynamics"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) RETURNS TABLE("whatsapp_cliente" "text", "whatsapp_empresa" "text", "messages_from_user" bigint, "avg_interval_seconds" numeric, "median_interval_seconds" numeric, "p90_interval_seconds" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$
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


ALTER FUNCTION "public"."ai_agent_metrics_conversation_dynamics"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ai_agent_metrics_conversation_dynamics"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) IS 'Per-conversation user-only inter-message intervals (avg/median/p90) within a time window.';



CREATE OR REPLACE FUNCTION "public"."ai_agent_metrics_daily"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) RETURNS TABLE("day" "date", "messages_total" bigint, "users_attended" bigint)
    LANGUAGE "sql" STABLE
    AS $$
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


ALTER FUNCTION "public"."ai_agent_metrics_daily"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ai_agent_metrics_daily"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) IS 'Daily totals in America/Sao_Paulo: messages and distinct users attended per day.';



CREATE OR REPLACE FUNCTION "public"."ai_agent_metrics_depth"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) RETURNS TABLE("conversations" bigint, "messages_total" bigint, "avg_msgs_per_conversation" numeric, "p50_msgs_per_conversation" numeric, "p90_msgs_per_conversation" numeric)
    LANGUAGE "sql" STABLE
    AS $$
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


ALTER FUNCTION "public"."ai_agent_metrics_depth"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_agent_metrics_human_involvement"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) RETURNS TABLE("conversations" bigint, "conversations_with_human" bigint, "involvement_rate" numeric)
    LANGUAGE "sql" STABLE
    AS $$
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


ALTER FUNCTION "public"."ai_agent_metrics_human_involvement"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_agent_metrics_satisfaction_proxy"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) RETURNS TABLE("conversations" bigint, "positive_conversations" bigint, "satisfaction_rate" numeric)
    LANGUAGE "sql" STABLE
    AS $$
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


ALTER FUNCTION "public"."ai_agent_metrics_satisfaction_proxy"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_agent_metrics_summary"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) RETURNS TABLE("total_messages" bigint, "human_messages" bigint, "cliente_messages" bigint, "users_attended" bigint)
    LANGUAGE "sql" STABLE
    AS $$
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


ALTER FUNCTION "public"."ai_agent_metrics_summary"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ai_agent_metrics_summary"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) IS 'Window summary: total messages, human messages, cliente messages, and distinct whatsapp_cliente count for the organization.';



CREATE OR REPLACE FUNCTION "public"."ai_agent_metrics_time_to_handoff"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) RETURNS TABLE("conversations" bigint, "with_handoff" bigint, "avg_msgs_until_handoff" numeric, "p50_msgs_until_handoff" numeric, "p90_msgs_until_handoff" numeric)
    LANGUAGE "sql" STABLE
    AS $$
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


ALTER FUNCTION "public"."ai_agent_metrics_time_to_handoff"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_agent_metrics_top_terms"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer DEFAULT 20, "p_min_len" integer DEFAULT 3, "p_ngram" integer DEFAULT 1) RETURNS TABLE("term" "text", "freq" bigint)
    LANGUAGE "sql" STABLE
    AS $$
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


ALTER FUNCTION "public"."ai_agent_metrics_top_terms"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer, "p_min_len" integer, "p_ngram" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_agent_workflows_delete"("p_organization_id" "uuid", "p_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
declare
  v_deleted int := 0;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  
  delete from public.ai_agent_workflows
  where id = p_id
    and organization_id = p_organization_id;
  
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;


ALTER FUNCTION "public"."ai_agent_workflows_delete"("p_organization_id" "uuid", "p_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_agent_workflows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "workflow_data" "jsonb" DEFAULT '{"edges": [], "nodes": [], "viewport": {"x": 0, "y": 0, "zoom": 1}}'::"jsonb" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_template" boolean DEFAULT false NOT NULL,
    "category" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "ai_agent_workflows_name_check" CHECK (("char_length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "ai_agent_workflows_version_check" CHECK (("version" > 0))
);


ALTER TABLE "public"."ai_agent_workflows" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_agent_workflows_list"("p_organization_id" "uuid", "p_query" "text" DEFAULT NULL::"text", "p_category" "text" DEFAULT NULL::"text", "p_tags" "text"[] DEFAULT NULL::"text"[], "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS SETOF "public"."ai_agent_workflows"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  
  return query
  select *
  from public.ai_agent_workflows
  where organization_id = p_organization_id
    and (
      p_query is null
      or p_query = ''
      or (
        name ilike '%' || p_query || '%'
        or coalesce(description, '') ilike '%' || p_query || '%'
        or coalesce(category, '') ilike '%' || p_query || '%'
      )
    )
    and (p_category is null or category = p_category)
    and (p_tags is null or tags && p_tags)
  order by updated_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;


ALTER FUNCTION "public"."ai_agent_workflows_list"("p_organization_id" "uuid", "p_query" "text", "p_category" "text", "p_tags" "text"[], "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_agent_workflows_update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."ai_agent_workflows_update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_agent_workflows_upsert"("p_organization_id" "uuid", "p_name" "text", "p_id" "uuid" DEFAULT NULL::"uuid", "p_description" "text" DEFAULT NULL::"text", "p_workflow_data" "jsonb" DEFAULT NULL::"jsonb", "p_category" "text" DEFAULT NULL::"text", "p_tags" "text"[] DEFAULT NULL::"text"[], "p_is_active" boolean DEFAULT true) RETURNS "public"."ai_agent_workflows"
    LANGUAGE "plpgsql"
    AS $$
declare
  rec public.ai_agent_workflows;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  
  -- Se p_id for fornecido, atualiza; senão, cria novo
  if p_id is not null then
    update public.ai_agent_workflows
    set
      name = trim(p_name),
      description = nullif(trim(coalesce(p_description, '')), ''),
      workflow_data = coalesce(p_workflow_data, workflow_data),
      category = nullif(trim(coalesce(p_category, '')), ''),
      tags = coalesce(p_tags, tags),
      is_active = p_is_active,
      updated_at = now()
    where id = p_id
      and organization_id = p_organization_id
    returning * into rec;
    
    if rec.id is null then
      raise exception 'Workflow não encontrado ou sem permissão';
    end if;
  else
    insert into public.ai_agent_workflows (
      organization_id,
      name,
      description,
      workflow_data,
      category,
      tags,
      is_active
    ) values (
      p_organization_id,
      trim(p_name),
      nullif(trim(coalesce(p_description, '')), ''),
      coalesce(p_workflow_data, '{"nodes": [], "edges": [], "viewport": {"x": 0, "y": 0, "zoom": 1}}'::jsonb),
      nullif(trim(coalesce(p_category, '')), ''),
      coalesce(p_tags, '{}'::text[]),
      p_is_active
    )
    returning * into rec;
  end if;
  
  return rec;
end;
$$;


ALTER FUNCTION "public"."ai_agent_workflows_upsert"("p_organization_id" "uuid", "p_name" "text", "p_id" "uuid", "p_description" "text", "p_workflow_data" "jsonb", "p_category" "text", "p_tags" "text"[], "p_is_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_create_consultation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_type text;
begin
  -- Cria consulta somente na transição para 'realizado'
  if NEW.status = 'realizado' and coalesce(OLD.status, '') <> 'realizado' then
    -- Normalização de tipo: aceita apenas ('consulta','retorno','exame')
    v_type := lower(coalesce(nullif(NEW.tipo, ''), 'consulta'));
    if v_type not in ('consulta','retorno','exame') then
      v_type := 'consulta';
    end if;

    insert into public.consultations (
      organization_id,
      appointment_id,
      client_id,
      collaborator_id,
      date,
      type,
      notes,
      status,
      created_at
    ) values (
      NEW.organization_id,
      NEW.id,
      NEW.client_id,
      NEW.collaborator_id,
      NEW.datetime,
      v_type,
      NEW.anotacoes,
      'completed',
      now()
    );
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."auto_create_consultation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_appointment_delete"("p_organization_id" "uuid", "p_appointment_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  DELETE FROM automation_client_appointments
  WHERE id = p_appointment_id AND organization_id = p_organization_id;
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."automation_appointment_delete"("p_organization_id" "uuid", "p_appointment_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_client_appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "automation_client_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "appointment_type" "text",
    "start_datetime" timestamp with time zone NOT NULL,
    "end_datetime" timestamp with time zone,
    "location" "text",
    "meeting_url" "text",
    "participants" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'scheduled'::"text",
    "calendar_event_id" "uuid",
    "reminder_sent" boolean DEFAULT false,
    "notes" "text",
    "outcome" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "automation_client_appointments_appointment_type_check" CHECK (("appointment_type" = ANY (ARRAY['meeting'::"text", 'call'::"text", 'demo'::"text", 'training'::"text", 'followup'::"text", 'other'::"text"]))),
    CONSTRAINT "automation_client_appointments_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'completed'::"text", 'cancelled'::"text", 'rescheduled'::"text"])))
);


ALTER TABLE "public"."automation_client_appointments" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_appointment_upsert"("p_organization_id" "uuid", "p_id" "uuid" DEFAULT NULL::"uuid", "p_automation_client_id" "uuid" DEFAULT NULL::"uuid", "p_title" "text" DEFAULT NULL::"text", "p_description" "text" DEFAULT NULL::"text", "p_appointment_type" "text" DEFAULT 'meeting'::"text", "p_start_datetime" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_end_datetime" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_location" "text" DEFAULT NULL::"text", "p_meeting_url" "text" DEFAULT NULL::"text", "p_participants" "text"[] DEFAULT '{}'::"text"[], "p_status" "text" DEFAULT 'scheduled'::"text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "public"."automation_client_appointments"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_result automation_client_appointments;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  INSERT INTO automation_client_appointments (
    id, organization_id, automation_client_id, title, description,
    appointment_type, start_datetime, end_datetime, location, meeting_url,
    participants, status, notes, updated_at
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_organization_id, p_automation_client_id,
    p_title, p_description, p_appointment_type, p_start_datetime, p_end_datetime,
    p_location, p_meeting_url, p_participants, p_status, p_notes, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    automation_client_id = COALESCE(EXCLUDED.automation_client_id, automation_client_appointments.automation_client_id),
    title = COALESCE(EXCLUDED.title, automation_client_appointments.title),
    description = COALESCE(EXCLUDED.description, automation_client_appointments.description),
    appointment_type = COALESCE(EXCLUDED.appointment_type, automation_client_appointments.appointment_type),
    start_datetime = COALESCE(EXCLUDED.start_datetime, automation_client_appointments.start_datetime),
    end_datetime = COALESCE(EXCLUDED.end_datetime, automation_client_appointments.end_datetime),
    location = COALESCE(EXCLUDED.location, automation_client_appointments.location),
    meeting_url = COALESCE(EXCLUDED.meeting_url, automation_client_appointments.meeting_url),
    participants = COALESCE(EXCLUDED.participants, automation_client_appointments.participants),
    status = COALESCE(EXCLUDED.status, automation_client_appointments.status),
    notes = COALESCE(EXCLUDED.notes, automation_client_appointments.notes),
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."automation_appointment_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_title" "text", "p_description" "text", "p_appointment_type" "text", "p_start_datetime" timestamp with time zone, "p_end_datetime" timestamp with time zone, "p_location" "text", "p_meeting_url" "text", "p_participants" "text"[], "p_status" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_appointments_list"("p_organization_id" "uuid") RETURNS SETOF "public"."automation_client_appointments"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  RETURN QUERY
  SELECT aa.*
  FROM automation_client_appointments aa
  WHERE aa.organization_id = p_organization_id
  ORDER BY aa.start_datetime DESC;
END;
$$;


ALTER FUNCTION "public"."automation_appointments_list"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_briefings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "automation_client_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "briefing_type" "text" DEFAULT 'general'::"text",
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "indexed_for_rag" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "automation_briefings_briefing_type_check" CHECK (("briefing_type" = ANY (ARRAY['general'::"text", 'project'::"text", 'pain_points'::"text", 'goals'::"text", 'requirements'::"text"])))
);


ALTER TABLE "public"."automation_briefings" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_briefing_upsert"("p_organization_id" "uuid", "p_id" "uuid" DEFAULT NULL::"uuid", "p_automation_client_id" "uuid" DEFAULT NULL::"uuid", "p_title" "text" DEFAULT NULL::"text", "p_content" "text" DEFAULT NULL::"text", "p_briefing_type" "text" DEFAULT 'general'::"text", "p_tags" "text"[] DEFAULT '{}'::"text"[], "p_indexed_for_rag" boolean DEFAULT false) RETURNS "public"."automation_briefings"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_result automation_briefings;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  INSERT INTO automation_briefings (
    id, organization_id, automation_client_id, title, content,
    briefing_type, tags, indexed_for_rag, updated_at
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_organization_id, p_automation_client_id,
    p_title, p_content, p_briefing_type, p_tags, p_indexed_for_rag, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    automation_client_id = COALESCE(EXCLUDED.automation_client_id, automation_briefings.automation_client_id),
    title = COALESCE(EXCLUDED.title, automation_briefings.title),
    content = COALESCE(EXCLUDED.content, automation_briefings.content),
    briefing_type = COALESCE(EXCLUDED.briefing_type, automation_briefings.briefing_type),
    tags = COALESCE(EXCLUDED.tags, automation_briefings.tags),
    indexed_for_rag = COALESCE(EXCLUDED.indexed_for_rag, automation_briefings.indexed_for_rag),
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."automation_briefing_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_title" "text", "p_content" "text", "p_briefing_type" "text", "p_tags" "text"[], "p_indexed_for_rag" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_briefings_list"("p_organization_id" "uuid") RETURNS SETOF "public"."automation_briefings"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  RETURN QUERY
  SELECT ab.*
  FROM automation_briefings ab
  WHERE ab.organization_id = p_organization_id
  ORDER BY ab.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."automation_briefings_list"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_client_delete"("p_organization_id" "uuid", "p_client_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  DELETE FROM automation_clients
  WHERE id = p_client_id AND organization_id = p_organization_id;
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."automation_client_delete"("p_organization_id" "uuid", "p_client_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "company_name" "text" NOT NULL,
    "contact_name" "text",
    "email" "text",
    "phone" "text",
    "status" "text" DEFAULT 'active'::"text",
    "client_id" "uuid",
    "industry" "text",
    "company_size" "text",
    "website" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "automation_clients_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'onboarding'::"text", 'paused'::"text", 'churned'::"text"])))
);


ALTER TABLE "public"."automation_clients" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_client_upsert"("p_organization_id" "uuid", "p_id" "uuid" DEFAULT NULL::"uuid", "p_company_name" "text" DEFAULT NULL::"text", "p_contact_name" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT 'active'::"text", "p_client_id" "uuid" DEFAULT NULL::"uuid", "p_industry" "text" DEFAULT NULL::"text", "p_company_size" "text" DEFAULT NULL::"text", "p_website" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "public"."automation_clients"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_result automation_clients;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  INSERT INTO automation_clients (
    id, organization_id, company_name, contact_name, email, phone, 
    status, client_id, industry, company_size, website, notes, updated_at
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_organization_id, p_company_name, p_contact_name, 
    p_email, p_phone, p_status, p_client_id, p_industry, p_company_size, p_website, p_notes, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    company_name = COALESCE(EXCLUDED.company_name, automation_clients.company_name),
    contact_name = COALESCE(EXCLUDED.contact_name, automation_clients.contact_name),
    email = COALESCE(EXCLUDED.email, automation_clients.email),
    phone = COALESCE(EXCLUDED.phone, automation_clients.phone),
    status = COALESCE(EXCLUDED.status, automation_clients.status),
    client_id = COALESCE(EXCLUDED.client_id, automation_clients.client_id),
    industry = COALESCE(EXCLUDED.industry, automation_clients.industry),
    company_size = COALESCE(EXCLUDED.company_size, automation_clients.company_size),
    website = COALESCE(EXCLUDED.website, automation_clients.website),
    notes = COALESCE(EXCLUDED.notes, automation_clients.notes),
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."automation_client_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_company_name" "text", "p_contact_name" "text", "p_email" "text", "p_phone" "text", "p_status" "text", "p_client_id" "uuid", "p_industry" "text", "p_company_size" "text", "p_website" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_clients_list"("p_organization_id" "uuid") RETURNS SETOF "public"."automation_clients"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  RETURN QUERY
  SELECT ac.*
  FROM automation_clients ac
  WHERE ac.organization_id = p_organization_id
  ORDER BY ac.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."automation_clients_list"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_contract_delete"("p_organization_id" "uuid", "p_contract_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  DELETE FROM automation_contracts
  WHERE id = p_contract_id AND organization_id = p_organization_id;
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."automation_contract_delete"("p_organization_id" "uuid", "p_contract_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "automation_client_id" "uuid" NOT NULL,
    "contract_name" "text" NOT NULL,
    "contract_number" "text",
    "setup_value" numeric(12,2) DEFAULT 0,
    "recurring_value" numeric(12,2) DEFAULT 0,
    "recurring_period" "text" DEFAULT 'monthly'::"text",
    "included_tools" "text"[] DEFAULT '{}'::"text"[],
    "start_date" "date",
    "end_date" "date",
    "renewal_date" "date",
    "status" "text" DEFAULT 'active'::"text",
    "financial_record_id" "uuid",
    "contract_file_url" "text",
    "terms" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "automation_contracts_recurring_period_check" CHECK (("recurring_period" = ANY (ARRAY['monthly'::"text", 'quarterly'::"text", 'annual'::"text"]))),
    CONSTRAINT "automation_contracts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."automation_contracts" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_contract_upsert"("p_organization_id" "uuid", "p_id" "uuid" DEFAULT NULL::"uuid", "p_automation_client_id" "uuid" DEFAULT NULL::"uuid", "p_contract_name" "text" DEFAULT NULL::"text", "p_contract_number" "text" DEFAULT NULL::"text", "p_setup_value" numeric DEFAULT 0, "p_recurring_value" numeric DEFAULT 0, "p_recurring_period" "text" DEFAULT 'monthly'::"text", "p_included_tools" "text"[] DEFAULT '{}'::"text"[], "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date", "p_renewal_date" "date" DEFAULT NULL::"date", "p_status" "text" DEFAULT 'draft'::"text", "p_terms" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "public"."automation_contracts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_result automation_contracts;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  INSERT INTO automation_contracts (
    id, organization_id, automation_client_id, contract_name, contract_number,
    setup_value, recurring_value, recurring_period, included_tools,
    start_date, end_date, renewal_date, status, terms, notes, updated_at
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_organization_id, p_automation_client_id,
    p_contract_name, p_contract_number, p_setup_value, p_recurring_value,
    p_recurring_period, p_included_tools, p_start_date, p_end_date, p_renewal_date,
    p_status, p_terms, p_notes, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    automation_client_id = COALESCE(EXCLUDED.automation_client_id, automation_contracts.automation_client_id),
    contract_name = COALESCE(EXCLUDED.contract_name, automation_contracts.contract_name),
    contract_number = COALESCE(EXCLUDED.contract_number, automation_contracts.contract_number),
    setup_value = COALESCE(EXCLUDED.setup_value, automation_contracts.setup_value),
    recurring_value = COALESCE(EXCLUDED.recurring_value, automation_contracts.recurring_value),
    recurring_period = COALESCE(EXCLUDED.recurring_period, automation_contracts.recurring_period),
    included_tools = COALESCE(EXCLUDED.included_tools, automation_contracts.included_tools),
    start_date = COALESCE(EXCLUDED.start_date, automation_contracts.start_date),
    end_date = COALESCE(EXCLUDED.end_date, automation_contracts.end_date),
    renewal_date = COALESCE(EXCLUDED.renewal_date, automation_contracts.renewal_date),
    status = COALESCE(EXCLUDED.status, automation_contracts.status),
    terms = COALESCE(EXCLUDED.terms, automation_contracts.terms),
    notes = COALESCE(EXCLUDED.notes, automation_contracts.notes),
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."automation_contract_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_contract_name" "text", "p_contract_number" "text", "p_setup_value" numeric, "p_recurring_value" numeric, "p_recurring_period" "text", "p_included_tools" "text"[], "p_start_date" "date", "p_end_date" "date", "p_renewal_date" "date", "p_status" "text", "p_terms" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_contracts_list"("p_organization_id" "uuid") RETURNS SETOF "public"."automation_contracts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  RETURN QUERY
  SELECT ac.*
  FROM automation_contracts ac
  WHERE ac.organization_id = p_organization_id
  ORDER BY ac.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."automation_contracts_list"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_client_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "automation_client_id" "uuid" NOT NULL,
    "document_name" "text" NOT NULL,
    "document_type" "text",
    "file_url" "text",
    "file_size" integer,
    "file_type" "text",
    "integrated_to_products" boolean DEFAULT false,
    "integrated_to_leads" boolean DEFAULT false,
    "integrated_to_qna" boolean DEFAULT false,
    "integrated_to_kb" boolean DEFAULT false,
    "structured_data" "jsonb" DEFAULT '{}'::"jsonb",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "category" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "automation_client_documents_document_type_check" CHECK (("document_type" = ANY (ARRAY['product_sheet'::"text", 'lead_sheet'::"text", 'qna_sheet'::"text", 'contract'::"text", 'proposal'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."automation_client_documents" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_document_upsert"("p_organization_id" "uuid", "p_id" "uuid" DEFAULT NULL::"uuid", "p_automation_client_id" "uuid" DEFAULT NULL::"uuid", "p_document_name" "text" DEFAULT NULL::"text", "p_document_type" "text" DEFAULT 'other'::"text", "p_file_url" "text" DEFAULT NULL::"text", "p_tags" "text"[] DEFAULT '{}'::"text"[], "p_notes" "text" DEFAULT NULL::"text", "p_integrated_to_products" boolean DEFAULT false, "p_integrated_to_leads" boolean DEFAULT false, "p_integrated_to_qna" boolean DEFAULT false, "p_integrated_to_kb" boolean DEFAULT false) RETURNS "public"."automation_client_documents"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_result automation_client_documents;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  INSERT INTO automation_client_documents (
    id, organization_id, automation_client_id, document_name, document_type,
    file_url, tags, notes, integrated_to_products, integrated_to_leads,
    integrated_to_qna, integrated_to_kb, updated_at
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_organization_id, p_automation_client_id,
    p_document_name, p_document_type, p_file_url, p_tags, p_notes,
    p_integrated_to_products, p_integrated_to_leads, p_integrated_to_qna,
    p_integrated_to_kb, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    automation_client_id = COALESCE(EXCLUDED.automation_client_id, automation_client_documents.automation_client_id),
    document_name = COALESCE(EXCLUDED.document_name, automation_client_documents.document_name),
    document_type = COALESCE(EXCLUDED.document_type, automation_client_documents.document_type),
    file_url = COALESCE(EXCLUDED.file_url, automation_client_documents.file_url),
    tags = COALESCE(EXCLUDED.tags, automation_client_documents.tags),
    notes = COALESCE(EXCLUDED.notes, automation_client_documents.notes),
    integrated_to_products = COALESCE(EXCLUDED.integrated_to_products, automation_client_documents.integrated_to_products),
    integrated_to_leads = COALESCE(EXCLUDED.integrated_to_leads, automation_client_documents.integrated_to_leads),
    integrated_to_qna = COALESCE(EXCLUDED.integrated_to_qna, automation_client_documents.integrated_to_qna),
    integrated_to_kb = COALESCE(EXCLUDED.integrated_to_kb, automation_client_documents.integrated_to_kb),
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."automation_document_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_document_name" "text", "p_document_type" "text", "p_file_url" "text", "p_tags" "text"[], "p_notes" "text", "p_integrated_to_products" boolean, "p_integrated_to_leads" boolean, "p_integrated_to_qna" boolean, "p_integrated_to_kb" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_documents_list"("p_organization_id" "uuid") RETURNS SETOF "public"."automation_client_documents"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  RETURN QUERY
  SELECT acd.*
  FROM automation_client_documents acd
  WHERE acd.organization_id = p_organization_id
  ORDER BY acd.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."automation_documents_list"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_client_feedbacks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "automation_client_id" "uuid" NOT NULL,
    "feedback_type" "text" DEFAULT 'general'::"text",
    "rating" integer,
    "title" "text",
    "content" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "related_process_id" "uuid",
    "response" "text",
    "responded_by" "uuid",
    "responded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "automation_client_feedbacks_feedback_type_check" CHECK (("feedback_type" = ANY (ARRAY['general'::"text", 'satisfaction'::"text", 'feature_request'::"text", 'issue'::"text", 'praise'::"text"]))),
    CONSTRAINT "automation_client_feedbacks_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "automation_client_feedbacks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'resolved'::"text", 'implemented'::"text"])))
);


ALTER TABLE "public"."automation_client_feedbacks" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_feedback_upsert"("p_organization_id" "uuid", "p_id" "uuid" DEFAULT NULL::"uuid", "p_automation_client_id" "uuid" DEFAULT NULL::"uuid", "p_feedback_type" "text" DEFAULT 'general'::"text", "p_rating" integer DEFAULT NULL::integer, "p_title" "text" DEFAULT NULL::"text", "p_content" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT 'pending'::"text") RETURNS "public"."automation_client_feedbacks"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_result automation_client_feedbacks;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  INSERT INTO automation_client_feedbacks (
    id, organization_id, automation_client_id, feedback_type, rating,
    title, content, status, updated_at
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_organization_id, p_automation_client_id,
    p_feedback_type, p_rating, p_title, p_content, p_status, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    automation_client_id = COALESCE(EXCLUDED.automation_client_id, automation_client_feedbacks.automation_client_id),
    feedback_type = COALESCE(EXCLUDED.feedback_type, automation_client_feedbacks.feedback_type),
    rating = COALESCE(EXCLUDED.rating, automation_client_feedbacks.rating),
    title = COALESCE(EXCLUDED.title, automation_client_feedbacks.title),
    content = COALESCE(EXCLUDED.content, automation_client_feedbacks.content),
    status = COALESCE(EXCLUDED.status, automation_client_feedbacks.status),
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."automation_feedback_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_feedback_type" "text", "p_rating" integer, "p_title" "text", "p_content" "text", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_feedbacks_list"("p_organization_id" "uuid") RETURNS SETOF "public"."automation_client_feedbacks"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  RETURN QUERY
  SELECT acf.*
  FROM automation_client_feedbacks acf
  WHERE acf.organization_id = p_organization_id
  ORDER BY acf.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."automation_feedbacks_list"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_process_delete"("p_organization_id" "uuid", "p_process_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  DELETE FROM automation_processes
  WHERE id = p_process_id AND organization_id = p_organization_id;
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."automation_process_delete"("p_organization_id" "uuid", "p_process_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_processes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "automation_client_id" "uuid" NOT NULL,
    "process_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "progress" integer DEFAULT 0,
    "start_date" "date",
    "due_date" "date",
    "completed_date" "date",
    "assigned_to" "uuid",
    "priority" "text" DEFAULT 'medium'::"text",
    "checklist" "jsonb" DEFAULT '[]'::"jsonb",
    "workflow_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "stage" "text" DEFAULT 'onboarding'::"text",
    "position" integer DEFAULT 0,
    "cover_color" "text",
    "mentioned_appointments" "uuid"[] DEFAULT '{}'::"uuid"[],
    "mentioned_transcriptions" "uuid"[] DEFAULT '{}'::"uuid"[],
    "mentioned_briefings" "uuid"[] DEFAULT '{}'::"uuid"[],
    CONSTRAINT "automation_processes_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "automation_processes_process_type_check" CHECK (("process_type" = ANY (ARRAY['onboarding'::"text", 'implementation'::"text", 'monitoring'::"text", 'support'::"text"]))),
    CONSTRAINT "automation_processes_progress_check" CHECK ((("progress" >= 0) AND ("progress" <= 100))),
    CONSTRAINT "automation_processes_stage_check" CHECK (("stage" = ANY (ARRAY['onboarding'::"text", 'implementation'::"text", 'monitoring'::"text"]))),
    CONSTRAINT "automation_processes_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'blocked'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."automation_processes" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_process_move_stage"("p_organization_id" "uuid", "p_process_id" "uuid", "p_new_stage" "text", "p_new_position" integer) RETURNS "public"."automation_processes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_result automation_processes;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  UPDATE automation_processes
  SET 
    stage = p_new_stage,
    position = p_new_position,
    updated_at = NOW()
  WHERE id = p_process_id AND organization_id = p_organization_id
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."automation_process_move_stage"("p_organization_id" "uuid", "p_process_id" "uuid", "p_new_stage" "text", "p_new_position" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_process_update_mentions"("p_organization_id" "uuid", "p_process_id" "uuid", "p_mentioned_appointments" "uuid"[] DEFAULT NULL::"uuid"[], "p_mentioned_transcriptions" "uuid"[] DEFAULT NULL::"uuid"[], "p_mentioned_briefings" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS "public"."automation_processes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_result automation_processes;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  UPDATE automation_processes
  SET 
    mentioned_appointments = COALESCE(p_mentioned_appointments, mentioned_appointments),
    mentioned_transcriptions = COALESCE(p_mentioned_transcriptions, mentioned_transcriptions),
    mentioned_briefings = COALESCE(p_mentioned_briefings, mentioned_briefings),
    updated_at = NOW()
  WHERE id = p_process_id AND organization_id = p_organization_id
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."automation_process_update_mentions"("p_organization_id" "uuid", "p_process_id" "uuid", "p_mentioned_appointments" "uuid"[], "p_mentioned_transcriptions" "uuid"[], "p_mentioned_briefings" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_process_update_progress"("p_organization_id" "uuid", "p_process_id" "uuid", "p_progress" integer) RETURNS "public"."automation_processes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_result automation_processes;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  UPDATE automation_processes
  SET 
    progress = p_progress,
    status = CASE WHEN p_progress = 100 THEN 'completed' ELSE 'in_progress' END,
    completed_date = CASE WHEN p_progress = 100 THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_process_id AND organization_id = p_organization_id
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."automation_process_update_progress"("p_organization_id" "uuid", "p_process_id" "uuid", "p_progress" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_process_upsert"("p_organization_id" "uuid", "p_id" "uuid" DEFAULT NULL::"uuid", "p_automation_client_id" "uuid" DEFAULT NULL::"uuid", "p_process_type" "text" DEFAULT 'onboarding'::"text", "p_title" "text" DEFAULT NULL::"text", "p_description" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT 'pending'::"text", "p_progress" integer DEFAULT 0, "p_start_date" "date" DEFAULT NULL::"date", "p_due_date" "date" DEFAULT NULL::"date", "p_priority" "text" DEFAULT 'medium'::"text", "p_checklist" "jsonb" DEFAULT '[]'::"jsonb", "p_notes" "text" DEFAULT NULL::"text") RETURNS "public"."automation_processes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_result automation_processes;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  INSERT INTO automation_processes (
    id, organization_id, automation_client_id, process_type, title, description,
    status, progress, start_date, due_date, priority, checklist, notes, updated_at
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_organization_id, p_automation_client_id,
    p_process_type, p_title, p_description, p_status, p_progress, p_start_date,
    p_due_date, p_priority, p_checklist, p_notes, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    automation_client_id = COALESCE(EXCLUDED.automation_client_id, automation_processes.automation_client_id),
    process_type = COALESCE(EXCLUDED.process_type, automation_processes.process_type),
    title = COALESCE(EXCLUDED.title, automation_processes.title),
    description = COALESCE(EXCLUDED.description, automation_processes.description),
    status = COALESCE(EXCLUDED.status, automation_processes.status),
    progress = COALESCE(EXCLUDED.progress, automation_processes.progress),
    start_date = COALESCE(EXCLUDED.start_date, automation_processes.start_date),
    due_date = COALESCE(EXCLUDED.due_date, automation_processes.due_date),
    priority = COALESCE(EXCLUDED.priority, automation_processes.priority),
    checklist = COALESCE(EXCLUDED.checklist, automation_processes.checklist),
    notes = COALESCE(EXCLUDED.notes, automation_processes.notes),
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."automation_process_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_process_type" "text", "p_title" "text", "p_description" "text", "p_status" "text", "p_progress" integer, "p_start_date" "date", "p_due_date" "date", "p_priority" "text", "p_checklist" "jsonb", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_processes_kanban_list"("p_organization_id" "uuid") RETURNS TABLE("stage" "text", "processes" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  RETURN QUERY
  SELECT 
    p.stage,
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'automation_client_id', p.automation_client_id,
        'title', p.title,
        'description', p.description,
        'status', p.status,
        'progress', p.progress,
        'priority', p.priority,
        'stage', p.stage,
        'position', p.position,
        'cover_color', p.cover_color,
        'start_date', p.start_date,
        'due_date', p.due_date,
        'checklist', p.checklist,
        'mentioned_appointments', p.mentioned_appointments,
        'mentioned_transcriptions', p.mentioned_transcriptions,
        'mentioned_briefings', p.mentioned_briefings,
        'created_at', p.created_at,
        'updated_at', p.updated_at
      ) ORDER BY p.position, p.created_at DESC
    ) as processes
  FROM automation_processes p
  WHERE p.organization_id = p_organization_id
  GROUP BY p.stage
  ORDER BY 
    CASE p.stage
      WHEN 'onboarding' THEN 1
      WHEN 'implementation' THEN 2
      WHEN 'monitoring' THEN 3
      ELSE 4
    END;
END;
$$;


ALTER FUNCTION "public"."automation_processes_kanban_list"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_processes_list"("p_organization_id" "uuid") RETURNS SETOF "public"."automation_processes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  RETURN QUERY
  SELECT ap.*
  FROM automation_processes ap
  WHERE ap.organization_id = p_organization_id
  ORDER BY ap.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."automation_processes_list"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_meeting_transcriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "automation_client_id" "uuid" NOT NULL,
    "meeting_title" "text" NOT NULL,
    "meeting_date" timestamp with time zone,
    "duration_minutes" integer,
    "participants" "text"[] DEFAULT '{}'::"text"[],
    "transcription" "text",
    "summary" "text",
    "action_items" "jsonb" DEFAULT '[]'::"jsonb",
    "key_points" "text"[] DEFAULT '{}'::"text"[],
    "recording_url" "text",
    "attachments" "text"[] DEFAULT '{}'::"text"[],
    "calendar_event_id" "uuid",
    "indexed_for_rag" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."automation_meeting_transcriptions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_transcription_upsert"("p_organization_id" "uuid", "p_id" "uuid" DEFAULT NULL::"uuid", "p_automation_client_id" "uuid" DEFAULT NULL::"uuid", "p_meeting_title" "text" DEFAULT NULL::"text", "p_meeting_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_duration_minutes" integer DEFAULT 0, "p_participants" "text"[] DEFAULT '{}'::"text"[], "p_transcription" "text" DEFAULT NULL::"text", "p_summary" "text" DEFAULT NULL::"text", "p_action_items" "jsonb" DEFAULT '[]'::"jsonb", "p_key_points" "text"[] DEFAULT '{}'::"text"[], "p_indexed_for_rag" boolean DEFAULT false) RETURNS "public"."automation_meeting_transcriptions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_result automation_meeting_transcriptions;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  INSERT INTO automation_meeting_transcriptions (
    id, organization_id, automation_client_id, meeting_title, meeting_date,
    duration_minutes, participants, transcription, summary, action_items,
    key_points, indexed_for_rag, updated_at
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_organization_id, p_automation_client_id,
    p_meeting_title, p_meeting_date, p_duration_minutes, p_participants,
    p_transcription, p_summary, p_action_items, p_key_points, p_indexed_for_rag, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    automation_client_id = COALESCE(EXCLUDED.automation_client_id, automation_meeting_transcriptions.automation_client_id),
    meeting_title = COALESCE(EXCLUDED.meeting_title, automation_meeting_transcriptions.meeting_title),
    meeting_date = COALESCE(EXCLUDED.meeting_date, automation_meeting_transcriptions.meeting_date),
    duration_minutes = COALESCE(EXCLUDED.duration_minutes, automation_meeting_transcriptions.duration_minutes),
    participants = COALESCE(EXCLUDED.participants, automation_meeting_transcriptions.participants),
    transcription = COALESCE(EXCLUDED.transcription, automation_meeting_transcriptions.transcription),
    summary = COALESCE(EXCLUDED.summary, automation_meeting_transcriptions.summary),
    action_items = COALESCE(EXCLUDED.action_items, automation_meeting_transcriptions.action_items),
    key_points = COALESCE(EXCLUDED.key_points, automation_meeting_transcriptions.key_points),
    indexed_for_rag = COALESCE(EXCLUDED.indexed_for_rag, automation_meeting_transcriptions.indexed_for_rag),
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."automation_transcription_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_meeting_title" "text", "p_meeting_date" timestamp with time zone, "p_duration_minutes" integer, "p_participants" "text"[], "p_transcription" "text", "p_summary" "text", "p_action_items" "jsonb", "p_key_points" "text"[], "p_indexed_for_rag" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."automation_transcriptions_list"("p_organization_id" "uuid") RETURNS SETOF "public"."automation_meeting_transcriptions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  RETURN QUERY
  SELECT amt.*
  FROM automation_meeting_transcriptions amt
  WHERE amt.organization_id = p_organization_id
  ORDER BY amt.meeting_date DESC NULLS LAST, amt.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."automation_transcriptions_list"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_entradas_from_clients"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare r record; begin
  for r in
    select id from public.clients
     where coalesce(valor_pago,0) > 0 and organization_id is not null
  loop
    perform public.upsert_entrada_for_client_valor_pago(r.id);
  end loop;
end;$$;


ALTER FUNCTION "public"."backfill_entradas_from_clients"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_entradas_from_leads"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare r record; begin
  for r in
    select id from public.crm_leads
     where coalesce(has_payment,false) = true and coalesce(payment_value,0) > 0 and organization_id is not null
  loop
    perform public.upsert_entrada_for_lead_payment(r.id);
  end loop;
end;$$;


ALTER FUNCTION "public"."backfill_entradas_from_leads"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_entradas_from_pagamentos"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare r record; begin
  for r in
    select id from public.pagamentos
     where status = 'confirmado' and organization_id is not null and coalesce(valor,0) > 0
  loop
    perform public.upsert_entrada_for_pagamento(r.id);
  end loop;
end;$$;


ALTER FUNCTION "public"."backfill_entradas_from_pagamentos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."buscar_clientes"("query" "text") RETURNS TABLE("id" "uuid", "nome" "text", "email" "text", "telefone" "text", "nascimento" "date", "documentos" "text", "endereco" "text", "observacoes" "text", "ativo" boolean, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.nome,
    c.email,
    c.telefone,
    c.nascimento,
    c.documentos,
    c.endereco,
    c.observacoes,
    c.ativo,
    c.created_at
  FROM clients c
  WHERE 
    c.ativo = true AND (
      c.nome ILIKE '%' || query || '%' OR
      c.email ILIKE '%' || query || '%' OR
      c.telefone ILIKE '%' || query || '%'
    )
  ORDER BY c.nome
  LIMIT 20;
END;
$$;


ALTER FUNCTION "public"."buscar_clientes"("query" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_duplicate_financial_entries"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r record;
begin
  -- Find leads that have been converted and have both lead_payment and client_valor_pago entries
  for r in
    select 
      l.id as lead_id,
      l.converted_client_id as client_id,
      l.organization_id,
      esl_lead.entrada_id as lead_entrada_id,
      esl_lead.id as lead_link_id,
      esl_client.entrada_id as client_entrada_id
    from public.crm_leads l
    join public.entradas_source_links esl_lead
      on esl_lead.source_type = 'lead_payment'
      and esl_lead.source_id = l.id
      and esl_lead.organization_id = l.organization_id
    join public.entradas_source_links esl_client
      on esl_client.source_type = 'client_valor_pago'
      and esl_client.source_id = l.converted_client_id
      and esl_client.organization_id = l.organization_id
    where l.converted_client_id is not null
      and coalesce(l.has_payment, false) = true
      and coalesce(l.payment_value, 0) > 0
  loop
    -- Delete the lead entry since the client entry already exists
    delete from public.entradas where id = r.lead_entrada_id;
    delete from public.entradas_source_links where id = r.lead_link_id;
  end loop;
end;
$$;


ALTER FUNCTION "public"."cleanup_duplicate_financial_entries"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_duplicate_financial_entries_enhanced"() RETURNS TABLE("removed_count" integer, "details" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r record;
  v_removed_count int := 0;
  v_details jsonb := '[]'::jsonb;
begin
  -- Find and remove lead_payment entries that have corresponding client_valor_pago entries
  for r in
    select 
      l.id as lead_id,
      l.converted_client_id as client_id,
      l.organization_id,
      esl_lead.entrada_id as lead_entrada_id,
      esl_lead.id as lead_link_id,
      esl_client.entrada_id as client_entrada_id,
      e_lead.valor as lead_valor,
      e_client.valor as client_valor
    from public.crm_leads l
    join public.entradas_source_links esl_lead
      on esl_lead.source_type = 'lead_payment'
      and esl_lead.source_id = l.id
      and esl_lead.organization_id = l.organization_id
    join public.entradas e_lead on e_lead.id = esl_lead.entrada_id
    left join public.entradas_source_links esl_client
      on esl_client.source_type = 'client_valor_pago'
      and esl_client.source_id = l.converted_client_id
      and esl_client.organization_id = l.organization_id
    left join public.entradas e_client on e_client.id = esl_client.entrada_id
    where l.converted_client_id is not null
      and coalesce(l.has_payment, false) = true
      and coalesce(l.payment_value, 0) > 0
      and esl_client.entrada_id is not null
      -- Only remove if values match (same payment)
      and abs(coalesce(e_lead.valor, 0) - coalesce(e_client.valor, 0)) < 0.01
  loop
    -- Delete the lead entry since the client entry already exists
    delete from public.entradas where id = r.lead_entrada_id;
    delete from public.entradas_source_links where id = r.lead_link_id;
    
    v_removed_count := v_removed_count + 1;
    v_details := v_details || jsonb_build_object(
      'lead_id', r.lead_id,
      'client_id', r.client_id,
      'removed_entrada_id', r.lead_entrada_id,
      'kept_entrada_id', r.client_entrada_id
    );
  end loop;
  
  return query select v_removed_count, v_details;
end;
$$;


ALTER FUNCTION "public"."cleanup_duplicate_financial_entries_enhanced"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_automation_events"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Manter apenas últimos 90 dias
  DELETE FROM automation_events 
  WHERE created_at < now() - INTERVAL '90 days';
  
  RAISE NOTICE 'Cleanup completed: removed automation events older than 90 days';
END;
$$;


ALTER FUNCTION "public"."cleanup_old_automation_events"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_old_automation_events"() IS 'Remove eventos de automação antigos (>90 dias)';



CREATE OR REPLACE FUNCTION "public"."cleanup_old_notifications"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  deleted_count integer := 0;
  temp_count integer;
BEGIN
  -- Deletar notificações lidas com mais de 30 dias
  DELETE FROM notifications 
  WHERE lida = true 
  AND created_at < (now() - INTERVAL '30 days');
  
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Deletar notificações não lidas com mais de 90 dias
  DELETE FROM notifications 
  WHERE lida = false 
  AND created_at < (now() - INTERVAL '90 days');
  
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_notifications"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_old_notifications"() IS 'Remove notificações antigas para manter performance';



CREATE OR REPLACE FUNCTION "public"."convert_lead_to_client"("p_lead_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_lead record;
  v_client_id uuid;
  v_existing_id uuid;
  v_lead_entrada_id uuid;
  v_lead_link_id uuid;
begin
  -- Fetch lead
  select * into v_lead from public.crm_leads where id = p_lead_id;
  if not found then
    raise exception 'Lead não encontrado';
  end if;

  -- Try to reuse existing client for same organization by phone or email
  select c.id into v_existing_id
  from public.clients c
  where c.organization_id = v_lead.organization_id
    and (
      (v_lead.whatsapp is not null and nullif(trim(v_lead.whatsapp), '') is not null and c.telefone = trim(v_lead.whatsapp))
      or (v_lead.email is not null and nullif(trim(v_lead.email), '') is not null and c.email = trim(v_lead.email))
    )
  limit 1;

  if v_existing_id is not null then
    v_client_id := v_existing_id;
    -- Update valor_pago accumulating if lead has payment
    if coalesce(v_lead.has_payment, false) and coalesce(v_lead.payment_value, 0) > 0 then
      update public.clients
      set valor_pago = coalesce(valor_pago, 0) + coalesce(v_lead.payment_value, 0)
      where id = v_client_id;
    end if;
  else
    -- Create new client with valor_pago if lead has payment
    insert into public.clients (
      id, organization_id, nome, email, telefone, nascimento, valor_pago, created_at
    ) values (
      gen_random_uuid(),
      v_lead.organization_id,
      coalesce(nullif(trim(v_lead.name), ''), 'Sem nome'),
      nullif(trim(v_lead.email), ''),
      coalesce(nullif(trim(v_lead.whatsapp), ''), ''),
      date '1970-01-01',
      case when coalesce(v_lead.has_payment, false) then coalesce(v_lead.payment_value, 0) else 0 end,
      now()
    )
    returning id into v_client_id;
  end if;

  -- Migrate financial entry from lead to client if it exists
  -- This prevents duplication: instead of having both lead_payment and client_valor_pago entries,
  -- we migrate the existing lead_payment entry to client_valor_pago
  if coalesce(v_lead.has_payment, false) and coalesce(v_lead.payment_value, 0) > 0 then
    -- Find existing financial entry for this lead
    select esl.entrada_id, esl.id into v_lead_entrada_id, v_lead_link_id
    from public.entradas_source_links esl
    where esl.organization_id = v_lead.organization_id
      and esl.source_type = 'lead_payment'
      and esl.source_id = p_lead_id
    limit 1;

    if v_lead_entrada_id is not null then
      -- Check if client already has a financial entry
      declare
        v_client_entrada_id uuid;
        v_client_link_id uuid;
      begin
        select esl.entrada_id, esl.id into v_client_entrada_id, v_client_link_id
        from public.entradas_source_links esl
        where esl.organization_id = v_lead.organization_id
          and esl.source_type = 'client_valor_pago'
          and esl.source_id = v_client_id
        limit 1;

        if v_client_entrada_id is not null then
          -- Client already has an entry, delete the lead entry to avoid duplication
          delete from public.entradas where id = v_lead_entrada_id;
          delete from public.entradas_source_links where id = v_lead_link_id;
        else
          -- Migrate lead entry to client: update the link to point to client instead of lead
          update public.entradas_source_links
          set source_type = 'client_valor_pago',
              source_id = v_client_id,
              updated_at = now()
          where id = v_lead_link_id;

          -- Update the entrada to reference the client and update description
          update public.entradas
          set cliente_id = v_client_id,
              descricao = coalesce('Cliente pagante: ' || nullif(trim((select nome from public.clients where id = v_client_id)), ''), 'Cliente pagante'),
              observacoes = 'origem: client_valor_pago/' || v_client_id::text
          where id = v_lead_entrada_id;
        end if;
      end;
    end if;
  end if;

  -- Mark lead as converted AND hide from Kanban (manual conversion)
  -- This is the key change: show_in_kanban = false only when manually converted
  update public.crm_leads
  set converted_client_id = v_client_id,
      converted_at = now(),
      stage = coalesce(stage, 'fechado'),
      show_in_kanban = false  -- Ocultar apenas quando convertido manualmente
  where id = p_lead_id;

  return v_client_id;
end;
$$;


ALTER FUNCTION "public"."convert_lead_to_client"("p_lead_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."convert_lead_to_client_auto"("p_lead_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_lead record;
  v_client_id uuid;
  v_existing_id uuid;
begin
  -- Fetch lead
  select * into v_lead from public.crm_leads where id = p_lead_id;
  if not found then
    raise exception 'Lead não encontrado';
  end if;

  -- Try to reuse existing client for same organization by phone or email
  select c.id into v_existing_id
  from public.clients c
  where c.organization_id = v_lead.organization_id
    and (
      (v_lead.whatsapp is not null and nullif(trim(v_lead.whatsapp), '') is not null and c.telefone = trim(v_lead.whatsapp))
      or (v_lead.email is not null and nullif(trim(v_lead.email), '') is not null and c.email = trim(v_lead.email))
    )
  limit 1;

  if v_existing_id is not null then
    v_client_id := v_existing_id;
    -- Update valor_pago accumulating if lead has payment
    if coalesce(v_lead.has_payment, false) and coalesce(v_lead.payment_value, 0) > 0 then
      update public.clients
      set valor_pago = coalesce(valor_pago, 0) + coalesce(v_lead.payment_value, 0)
      where id = v_client_id;
    end if;
  else
    -- Create new client with valor_pago if lead has payment
    insert into public.clients (
      id, organization_id, nome, email, telefone, nascimento, valor_pago, created_at
    ) values (
      gen_random_uuid(),
      v_lead.organization_id,
      coalesce(nullif(trim(v_lead.name), ''), 'Sem nome'),
      nullif(trim(v_lead.email), ''),
      coalesce(nullif(trim(v_lead.whatsapp), ''), ''),
      date '1970-01-01',
      case when coalesce(v_lead.has_payment, false) then coalesce(v_lead.payment_value, 0) else 0 end,
      now()
    )
    returning id into v_client_id;
  end if;

  -- Migrate financial entry from lead to client if it exists (same logic as manual conversion)
  if coalesce(v_lead.has_payment, false) and coalesce(v_lead.payment_value, 0) > 0 then
    declare
      v_lead_entrada_id_auto uuid;
      v_lead_link_id_auto uuid;
      v_client_entrada_id_auto uuid;
      v_client_link_id_auto uuid;
    begin
      select esl.entrada_id, esl.id into v_lead_entrada_id_auto, v_lead_link_id_auto
      from public.entradas_source_links esl
      where esl.organization_id = v_lead.organization_id
        and esl.source_type = 'lead_payment'
        and esl.source_id = p_lead_id
      limit 1;

      if v_lead_entrada_id_auto is not null then
        select esl.entrada_id, esl.id into v_client_entrada_id_auto, v_client_link_id_auto
        from public.entradas_source_links esl
        where esl.organization_id = v_lead.organization_id
          and esl.source_type = 'client_valor_pago'
          and esl.source_id = v_client_id
        limit 1;

        if v_client_entrada_id_auto is not null then
          delete from public.entradas where id = v_lead_entrada_id_auto;
          delete from public.entradas_source_links where id = v_lead_link_id_auto;
        else
          update public.entradas_source_links
          set source_type = 'client_valor_pago',
              source_id = v_client_id,
              updated_at = now()
          where id = v_lead_link_id_auto;

          update public.entradas
          set cliente_id = v_client_id,
              descricao = coalesce('Cliente pagante: ' || nullif(trim((select nome from public.clients where id = v_client_id)), ''), 'Cliente pagante'),
              observacoes = 'origem: client_valor_pago/' || v_client_id::text
          where id = v_lead_entrada_id_auto;
        end if;
      end if;
    end;
  end if;

  -- Mark lead as converted BUT keep show_in_kanban unchanged (stay visible)
  update public.crm_leads
  set converted_client_id = v_client_id,
      converted_at = now(),
      stage = coalesce(stage, 'fechado')
      -- show_in_kanban não é alterado aqui - mantém o valor atual (geralmente true)
  where id = p_lead_id;

  return v_client_id;
end;
$$;


ALTER FUNCTION "public"."convert_lead_to_client_auto"("p_lead_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_appointment_reminders"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  appointment_record RECORD;
  patient_name text;
  professional_name text;
  reminder_count integer := 0;
BEGIN
  -- Buscar agendamentos para amanhã que ainda não foram lembrados
  FOR appointment_record IN
    SELECT a.*, p.nome as patient_name, pr.name as professional_name
    FROM appointments a
    LEFT JOIN patients p ON a.patient_id = p.id
    LEFT JOIN professionals pr ON a.professional_id = pr.id
    WHERE a.datetime::date = (CURRENT_DATE + INTERVAL '1 day')
    AND a.status = 'agendado'
    AND NOT EXISTS (
      SELECT 1 FROM notifications n 
      WHERE n.metadata->>'appointment_id' = a.id::text 
      AND n.tipo = 'lembrete'
      AND n.created_at::date = CURRENT_DATE
    )
  LOOP
    -- Criar lembrete para o paciente (se tiver user_id)
    IF appointment_record.patient_id IS NOT NULL THEN
      PERFORM create_notification(
        appointment_record.organization_id,
        appointment_record.patient_id, -- Assumindo que paciente pode ter user_id
        'lembrete',
        format('⏰ Lembrete: Você tem consulta amanhã às %s com %s', 
          to_char(appointment_record.datetime, 'HH24:MI'),
          COALESCE(appointment_record.professional_name, 'Profissional')
        ),
        format('/agenda?appointment=%s', appointment_record.id),
        jsonb_build_object(
          'appointment_id', appointment_record.id,
          'reminder_type', 'patient_reminder',
          'appointment_datetime', appointment_record.datetime
        )
      );
    END IF;
    
    -- Notificar equipe sobre consultas do dia seguinte
    PERFORM notify_users_by_role(
      appointment_record.organization_id,
      ARRAY['admin', 'recepcionista']::text[],
      'lembrete',
      format('📅 Consulta amanhã: %s às %s com %s', 
        COALESCE(appointment_record.patient_name, 'Paciente'),
        to_char(appointment_record.datetime, 'HH24:MI'),
        COALESCE(appointment_record.professional_name, 'Profissional')
      ),
      format('/agenda?appointment=%s', appointment_record.id),
      jsonb_build_object(
        'appointment_id', appointment_record.id,
        'reminder_type', 'staff_reminder',
        'appointment_datetime', appointment_record.datetime
      )
    );
    
    reminder_count := reminder_count + 1;
  END LOOP;
  
  RETURN reminder_count;
END;
$$;


ALTER FUNCTION "public"."create_appointment_reminders"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_appointment_reminders"() IS 'Cria lembretes automáticos para consultas do dia seguinte';



CREATE OR REPLACE FUNCTION "public"."create_client_from_lead_no_convert"("p_lead_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_lead record;
  v_client_id uuid;
begin
  select * into v_lead from public.crm_leads where id = p_lead_id;
  if not found then
    raise exception 'Lead não encontrado';
  end if;

  -- Reuse existing client by phone/email within org
  select id into v_client_id from public.clients c
  where c.organization_id = v_lead.organization_id
    and (
      (v_lead.whatsapp is not null and nullif(trim(v_lead.whatsapp), '') is not null and c.telefone = trim(v_lead.whatsapp))
      or (v_lead.email is not null and nullif(trim(v_lead.email), '') is not null and c.email = trim(v_lead.email))
    )
  limit 1;

  if v_client_id is null then
    insert into public.clients (
      id, organization_id, nome, email, telefone, nascimento, valor_pago, created_at
    ) values (
      gen_random_uuid(),
      v_lead.organization_id,
      coalesce(nullif(trim(v_lead.name), ''), 'Sem nome'),
      nullif(trim(v_lead.email), ''),
      coalesce(nullif(trim(v_lead.whatsapp), ''), ''),
      date '1970-01-01',
      case when coalesce(v_lead.has_payment, false) then coalesce(v_lead.payment_value, 0) else 0 end,
      now()
    ) returning id into v_client_id;
  else
    -- Update valor_pago if we already have payment on the lead
    if coalesce(v_lead.has_payment, false) and coalesce(v_lead.payment_value, 0) > 0 then
      update public.clients set valor_pago = coalesce(v_lead.payment_value, 0) where id = v_client_id;
    end if;
  end if;

  return v_client_id;
end;
$$;


ALTER FUNCTION "public"."create_client_from_lead_no_convert"("p_lead_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "name" "text" NOT NULL,
    "order_index" integer DEFAULT 0,
    "color" "text" DEFAULT '#2563eb'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_conversion_stage" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."crm_stages" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_crm_stage"("p_name" "text", "p_color" "text", "p_order_index" integer, "p_organization_id" "uuid") RETURNS "public"."crm_stages"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    DECLARE
      new_stage crm_stages;
    BEGIN
      -- Inserir novo estágio
      INSERT INTO crm_stages (
        name,
        color,
        order_index,
        organization_id,
        created_at,
        updated_at
      ) VALUES (
        p_name,
        p_color,
        p_order_index,
        p_organization_id,
        now(),
        now()
      )
      RETURNING * INTO new_stage;
      
      RETURN new_stage;
    END;
    $$;


ALTER FUNCTION "public"."create_crm_stage"("p_name" "text", "p_color" "text", "p_order_index" integer, "p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_manual_notification"("p_organization_id" "uuid", "p_user_ids" "uuid"[], "p_tipo" "text", "p_mensagem" "text", "p_link" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_id uuid;
  notification_count integer := 0;
BEGIN
  FOREACH user_id IN ARRAY p_user_ids
  LOOP
    PERFORM create_notification(
      p_organization_id,
      user_id,
      p_tipo,
      p_mensagem,
      p_link,
      p_metadata
    );
    notification_count := notification_count + 1;
  END LOOP;
  
  RETURN notification_count;
END;
$$;


ALTER FUNCTION "public"."create_manual_notification"("p_organization_id" "uuid", "p_user_ids" "uuid"[], "p_tipo" "text", "p_mensagem" "text", "p_link" "text", "p_metadata" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_manual_notification"("p_organization_id" "uuid", "p_user_ids" "uuid"[], "p_tipo" "text", "p_mensagem" "text", "p_link" "text", "p_metadata" "jsonb") IS 'Permite criar notificações manuais via aplicação';



CREATE OR REPLACE FUNCTION "public"."create_notification"("p_organization_id" "uuid", "p_user_id" "uuid", "p_tipo" "text", "p_mensagem" "text", "p_link" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  notification_id uuid;
BEGIN
  -- Insert notification bypassing RLS
  INSERT INTO notifications (
    organization_id,
    user_id,
    tipo,
    mensagem,
    lida,
    link,
    metadata,
    created_at
  ) VALUES (
    p_organization_id,
    p_user_id,
    p_tipo,
    p_mensagem,
    false,
    p_link,
    p_metadata,
    now()
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the main operation
  RAISE WARNING 'Failed to create notification: %', SQLERRM;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."create_notification"("p_organization_id" "uuid", "p_user_id" "uuid", "p_tipo" "text", "p_mensagem" "text", "p_link" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification_safe"("p_organization_id" "uuid", "p_user_id" "uuid", "p_tipo" "text", "p_mensagem" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Simple INSERT without any format() usage
    INSERT INTO notifications (
        organization_id,
        user_id,
        tipo,
        mensagem,
        lida,
        metadata,
        created_at
    ) VALUES (
        p_organization_id,
        p_user_id,
        p_tipo,
        p_mensagem,
        false,
        p_metadata,
        now()
    );
    
    RAISE NOTICE '✅ Notification created safely: %', p_mensagem;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Notification creation failed (non-critical): %', SQLERRM;
    -- Don't re-raise the error - let the main operation continue
END;
$$;


ALTER FUNCTION "public"."create_notification_safe"("p_organization_id" "uuid", "p_user_id" "uuid", "p_tipo" "text", "p_mensagem" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_secure_notification"("p_organization_id" "uuid", "p_user_id" "text", "p_tipo" "text", "p_mensagem" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Convert text user_id to uuid safely
  BEGIN
    target_user_id := p_user_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    -- If conversion fails, use a default or skip
    RAISE NOTICE 'Invalid user_id format: %', p_user_id;
    RETURN false;
  END;

  -- Insert notification without using format()
  INSERT INTO notifications (
    organization_id,
    user_id,
    tipo,
    mensagem,
    lida,
    metadata,
    created_at
  ) VALUES (
    p_organization_id,
    target_user_id,
    p_tipo,
    p_mensagem,
    false,
    p_metadata,
    now()
  );
  
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the main operation
  RAISE NOTICE 'Error creating notification: %', SQLERRM;
  RETURN false;
END;
$$;


ALTER FUNCTION "public"."create_secure_notification"("p_organization_id" "uuid", "p_user_id" "text", "p_tipo" "text", "p_mensagem" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_system_notification"("p_organization_id" "uuid", "p_mensagem" "text", "p_priority" "text" DEFAULT 'normal'::"text", "p_link" "text" DEFAULT NULL::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  target_roles text[];
BEGIN
  -- Definir quem recebe baseado na prioridade
  CASE p_priority
    WHEN 'urgent' THEN
      target_roles := ARRAY['admin', 'medico', 'recepcionista']::text[];
    WHEN 'high' THEN
      target_roles := ARRAY['admin', 'medico']::text[];
    ELSE
      target_roles := ARRAY['admin']::text[];
  END CASE;
  
  RETURN notify_users_by_role(
    p_organization_id,
    target_roles,
    'sistema',
    p_mensagem,
    p_link,
    jsonb_build_object(
      'priority', p_priority,
      'system_notification', true
    )
  );
END;
$$;


ALTER FUNCTION "public"."create_system_notification"("p_organization_id" "uuid", "p_mensagem" "text", "p_priority" "text", "p_link" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_system_notification"("p_organization_id" "uuid", "p_mensagem" "text", "p_priority" "text", "p_link" "text") IS 'Cria notificações de sistema com diferentes prioridades';



CREATE OR REPLACE FUNCTION "public"."create_user_on_organization"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    BEGIN
      -- Log para debug
      RAISE NOTICE 'create_user_on_organization triggered for organization: %', NEW.name;
      
      -- Inserir usuário na tabela users
      INSERT INTO users (
        id,
        organization_id,
        nome,
        email,
        telefone,
        role,
        ativo,
        is_owner,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(), -- ID aleatório para o Client Supabase
        NEW.id, -- ID da organização recém-criada
        COALESCE(NEW.owner_name, 'Usuário'), -- Nome do owner ou fallback
        COALESCE(NEW.owner_email, 'admin@' || NEW.slug || '.com'), -- Email do owner ou fallback
        NEW.phone, -- Telefone da organização
        'admin', -- Owner vira admin no Client Supabase
        true, -- Usuário ativo
        true, -- É o owner da organização
        NOW(),
        NOW()
      );
      
      RAISE NOTICE 'User created for organization: % with email: %', NEW.name, COALESCE(NEW.owner_email, 'admin@' || NEW.slug || '.com');
      
      RETURN NEW;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error in create_user_on_organization: %', SQLERRM;
      RETURN NEW; -- Não falhar a criação da organização por causa do usuário
    END;
    $$;


ALTER FUNCTION "public"."create_user_on_organization"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crm_leads_reorder_stage"("p_organization_id" "uuid", "p_stage" "text", "p_lead_ids" "uuid"[]) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_lead_id uuid;
  v_order integer := 0;
BEGIN
  -- Validar que todos os leads pertencem à organização e ao estágio
  IF NOT EXISTS (
    SELECT 1 FROM public.crm_leads
    WHERE organization_id = p_organization_id
      AND stage = p_stage
      AND id = ANY(p_lead_ids)
    HAVING COUNT(*) = array_length(p_lead_ids, 1)
  ) THEN
    RAISE EXCEPTION 'Nem todos os leads pertencem à organização e estágio especificados';
  END IF;

  -- Atualizar stage_order sequencialmente para cada lead na ordem especificada
  FOREACH v_lead_id IN ARRAY p_lead_ids
  LOOP
    UPDATE public.crm_leads
    SET stage_order = v_order,
        updated_at = now()
    WHERE id = v_lead_id
      AND organization_id = p_organization_id
      AND stage = p_stage;
    
    v_order := v_order + 1;
  END LOOP;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."crm_leads_reorder_stage"("p_organization_id" "uuid", "p_stage" "text", "p_lead_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."crm_leads_reorder_stage"("p_organization_id" "uuid", "p_stage" "text", "p_lead_ids" "uuid"[]) IS 'Reordena leads em um estágio específico, garantindo stage_order sequencial sem conflitos. Usado após drag-and-drop no Kanban.';



CREATE OR REPLACE FUNCTION "public"."normalize_email"("p" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case
           when p is null or trim(p) = '' then null
           else lower(trim(p))
         end
$$;


ALTER FUNCTION "public"."normalize_email"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_phone_e164_br"("p" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare d text; begin
  if p is null then return null; end if;
  d := regexp_replace(p, '\\D', '', 'g');
  if length(d)=11 and left(d,2) <> '55' then d := '55'||d; end if;
  if length(d)>=10 then return '+'||d; end if;
  return null;
end $$;


ALTER FUNCTION "public"."normalize_phone_e164_br"("p" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "name" "text" NOT NULL,
    "whatsapp" "text",
    "email" "text",
    "stage" "text",
    "description" "text",
    "value" numeric(10,2) DEFAULT 0,
    "priority" "text" DEFAULT 'medium'::"text",
    "source" "text",
    "canal" "text",
    "created_by" "uuid",
    "assigned_to" "uuid",
    "has_payment" boolean DEFAULT false,
    "payment_value" numeric(10,2) DEFAULT 0,
    "is_highlight" boolean DEFAULT false,
    "updated_by" "uuid",
    "lost_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "converted_client_id" "uuid",
    "converted_at" timestamp with time zone,
    "has_whatsapp" boolean DEFAULT false,
    "instagram_username" "text",
    "cnpj" "text",
    "company_name" "text",
    "show_in_kanban" boolean DEFAULT true NOT NULL,
    "sold_produto_servico_id" "uuid",
    "sold_quantity" integer,
    "interests" "jsonb",
    "interest_produto_servico_id" "uuid",
    "interest_quantity" integer,
    "custom_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "phone_normalized" "text" GENERATED ALWAYS AS ("public"."normalize_phone_e164_br"("whatsapp")) STORED,
    "email_normalized" "text" GENERATED ALWAYS AS ("public"."normalize_email"("email")) STORED,
    "stage_order" integer DEFAULT 0,
    CONSTRAINT "crm_leads_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "crm_leads_sold_qty_req_when_product" CHECK ((("sold_produto_servico_id" IS NULL) OR (("sold_quantity" IS NOT NULL) AND ("sold_quantity" >= 1)))),
    CONSTRAINT "crm_leads_sold_quantity_check" CHECK (("sold_quantity" >= 1))
);


ALTER TABLE "public"."crm_leads" OWNER TO "postgres";


COMMENT ON COLUMN "public"."crm_leads"."has_whatsapp" IS 'Indica se o número do lead foi verificado e tem WhatsApp ativo';



COMMENT ON COLUMN "public"."crm_leads"."instagram_username" IS 'Instagram @username of the lead';



COMMENT ON COLUMN "public"."crm_leads"."stage_order" IS 'Visual position order within the stage (0 = first, increasing downwards). Used for drag-and-drop positioning in Kanban view.';



CREATE OR REPLACE FUNCTION "public"."crm_leads_upsert"("p_organization_id" "uuid", "p_name" "text", "p_id" "uuid" DEFAULT NULL::"uuid", "p_whatsapp" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_instagram_username" "text" DEFAULT NULL::"text", "p_stage" "text" DEFAULT NULL::"text", "p_value" numeric DEFAULT 0, "p_priority" "text" DEFAULT 'medium'::"text", "p_source" "text" DEFAULT NULL::"text", "p_canal" "text" DEFAULT NULL::"text", "p_has_payment" boolean DEFAULT false, "p_payment_value" numeric DEFAULT 0, "p_sold_produto_servico_id" "text" DEFAULT NULL::"text", "p_sold_quantity" "text" DEFAULT NULL::"text", "p_interest_produto_servico_id" "text" DEFAULT NULL::"text", "p_interest_quantity" "text" DEFAULT NULL::"text", "p_custom_fields" "jsonb" DEFAULT '{}'::"jsonb", "p_created_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_updated_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "public"."crm_leads"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_stage text;
  rec public.crm_leads;
  v_sold_ps uuid := public.uuid_or_null(p_sold_produto_servico_id);
  v_sold_qty int := coalesce(greatest(public.int_or_null(p_sold_quantity), 1), null);
  v_interest_ps uuid := public.uuid_or_null(p_interest_produto_servico_id);
  v_interest_qty int := coalesce(greatest(public.int_or_null(p_interest_quantity), 1), null);
begin
  -- Contexto de organização (mesma sessão)
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);

  -- Normalização de stage para o name exato da organização (case-insensitive)
  if p_stage is not null and trim(p_stage) <> '' then
    select s.name into v_stage
    from public.crm_stages s
    where s.organization_id = p_organization_id
      and lower(s.name) = lower(p_stage)
    limit 1;
  end if;

  if v_stage is null and (p_stage is null or trim(p_stage) = '') then
    v_stage := null;
  end if;

  if p_id is null then
    insert into public.crm_leads (
      organization_id, name, whatsapp, email, instagram_username, stage,
      description, value, priority, source, canal,
      has_payment, payment_value, sold_produto_servico_id, sold_quantity,
      interest_produto_servico_id, interest_quantity, custom_fields,
      created_at, updated_at
    ) values (
      p_organization_id,
      trim(coalesce(p_name, '')),
      nullif(trim(coalesce(p_whatsapp, '')), ''),
      nullif(trim(coalesce(p_email, '')), ''),
      nullif(trim(coalesce(p_instagram_username, '')), ''),
      coalesce(v_stage, null),
      null,
      coalesce(p_value, 0),
      coalesce(nullif(trim(p_priority), ''), 'medium'),
      nullif(trim(coalesce(p_source, '')), ''),
      nullif(trim(coalesce(p_canal, '')), ''),
      coalesce(p_has_payment, false),
      coalesce(p_payment_value, 0),
      v_sold_ps,
      case when v_sold_ps is null then null else coalesce(v_sold_qty, 1) end,
      v_interest_ps,
      case when v_interest_ps is null then null else coalesce(v_interest_qty, 1) end,
      coalesce(p_custom_fields, '{}'::jsonb),
      coalesce(p_created_at, now()),
      coalesce(p_updated_at, now())
    ) returning * into rec;
  else
    update public.crm_leads set
      name = trim(coalesce(p_name, name)),
      whatsapp = coalesce(nullif(trim(coalesce(p_whatsapp, '')), ''), whatsapp),
      email = coalesce(nullif(trim(coalesce(p_email, '')), ''), email),
      instagram_username = coalesce(nullif(trim(coalesce(p_instagram_username, '')), ''), instagram_username),
      stage = coalesce(v_stage, stage),
      value = coalesce(p_value, value),
      priority = coalesce(nullif(trim(p_priority), ''), priority),
      source = coalesce(nullif(trim(coalesce(p_source, '')), ''), source),
      canal = coalesce(nullif(trim(coalesce(p_canal, '')), ''), canal),
      has_payment = coalesce(p_has_payment, has_payment),
      payment_value = coalesce(p_payment_value, payment_value),
      sold_produto_servico_id = coalesce(v_sold_ps, sold_produto_servico_id),
      sold_quantity = case
        when coalesce(v_sold_ps, sold_produto_servico_id) is null then null
        else greatest(coalesce(v_sold_qty, sold_quantity, 1), 1)
      end,
      interest_produto_servico_id = coalesce(v_interest_ps, interest_produto_servico_id),
      interest_quantity = case
        when coalesce(v_interest_ps, interest_produto_servico_id) is null then null
        else greatest(coalesce(v_interest_qty, interest_quantity, 1), 1)
      end,
      custom_fields = coalesce(p_custom_fields, custom_fields),
      updated_at = coalesce(p_updated_at, now())
    where id = p_id and organization_id = p_organization_id
    returning * into rec;
  end if;

  return rec;
end;
$$;


ALTER FUNCTION "public"."crm_leads_upsert"("p_organization_id" "uuid", "p_name" "text", "p_id" "uuid", "p_whatsapp" "text", "p_email" "text", "p_instagram_username" "text", "p_stage" "text", "p_value" numeric, "p_priority" "text", "p_source" "text", "p_canal" "text", "p_has_payment" boolean, "p_payment_value" numeric, "p_sold_produto_servico_id" "text", "p_sold_quantity" "text", "p_interest_produto_servico_id" "text", "p_interest_quantity" "text", "p_custom_fields" "jsonb", "p_created_at" timestamp with time zone, "p_updated_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrypt_n8n_api_key"("encrypted_key" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Simple base64 decoding for demo purposes
  -- In production, use proper decryption
  RETURN convert_from(decode(encrypted_key, 'base64'), 'UTF8');
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."decrypt_n8n_api_key"("encrypted_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."encrypt_n8n_api_key"("api_key" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Simple base64 encoding for demo purposes
  -- In production, use proper encryption
  RETURN encode(api_key::bytea, 'base64');
END;
$$;


ALTER FUNCTION "public"."encrypt_n8n_api_key"("api_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notify_master_on_client_org_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  enabled text;
  webhook_url text;
  secret text;
  payload jsonb;
  resp record;
begin
  select value into enabled from public.saas_sync_settings where key = 'sync_org_to_master_enabled';
  if coalesce(enabled, 'false') <> 'true' then
    return null;
  end if;
  select value into webhook_url from public.saas_sync_settings where key = 'sync_org_to_master_url';
  select value into secret from public.saas_sync_settings where key = 'sync_org_webhook_secret';
  if coalesce(webhook_url,'') = '' or coalesce(secret,'') = '' then
    return null;
  end if;

  if tg_op = 'INSERT' then
    payload := jsonb_build_object('event','insert','organization', to_jsonb(new), 'owner_id', new.owner_id);
  elsif tg_op = 'UPDATE' then
    payload := jsonb_build_object('event','update','organization', to_jsonb(new), 'owner_id', new.owner_id);
  elsif tg_op = 'DELETE' then
    payload := jsonb_build_object('event','delete','organization', to_jsonb(old), 'owner_id', old.owner_id);
  else
    return null;
  end if;

  select * into resp from net.http_post(
    url := webhook_url,
    headers := jsonb_build_object('content-type','application/json','x-sync-secret', secret),
    body := payload
  );
  return null;
end
$$;


ALTER FUNCTION "public"."fn_notify_master_on_client_org_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_automation_stats"("p_organization_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    result json;
    events_today integer := 0;
    total_events integer := 0;
    success_rate numeric := 0;
    total_webhooks integer := 0;
BEGIN
    -- Count webhook events today (if table exists)
    BEGIN
        SELECT COUNT(*) INTO events_today
        FROM webhook_events we
        WHERE we.organization_id = p_organization_id
        AND DATE(we.created_at) = CURRENT_DATE;
    EXCEPTION WHEN undefined_table THEN
        events_today := 0;
    END;

    -- Count total events (if table exists)
    BEGIN
        SELECT COUNT(*) INTO total_events
        FROM webhook_events we
        WHERE we.organization_id = p_organization_id;
    EXCEPTION WHEN undefined_table THEN
        total_events := 0;
    END;

    -- Count total webhooks (if table exists)
    BEGIN
        SELECT COUNT(*) INTO total_webhooks
        FROM webhook_configurations wc
        WHERE wc.organization_id = p_organization_id;
    EXCEPTION WHEN undefined_table THEN
        total_webhooks := 0;
    END;

    -- Calculate success rate (if table exists)
    BEGIN
        SELECT 
            CASE 
                WHEN COUNT(*) = 0 THEN 0
                ELSE ROUND((COUNT(*) FILTER (WHERE status = 'success')::numeric / COUNT(*)) * 100, 1)
            END INTO success_rate
        FROM webhook_events we
        WHERE we.organization_id = p_organization_id;
    EXCEPTION WHEN undefined_table THEN
        success_rate := 0;
    END;

    -- Build result JSON
    result := json_build_object(
        'events_today', events_today,
        'total_events', total_events,
        'success_rate', success_rate,
        'total_webhooks', total_webhooks,
        'organization_id', p_organization_id
    );

    RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_automation_stats"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_request_header"("p_name" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_headers text;
  v_value text;
begin
  -- Tenta ler os headers do PostgREST (se disponível na versão do Supabase)
  begin
    v_headers := current_setting('request.headers', true);
  exception when others then
    v_headers := null;
  end;

  if v_headers is null then
    return null;
  end if;

  begin
    v_value := (v_headers::jsonb ->> p_name);
  exception when others then
    v_value := null;
  end;

  return v_value;
end;
$$;


ALTER FUNCTION "public"."get_request_header"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_organization_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    DECLARE
      org_id uuid;
    BEGIN
      -- Try to get from session context first
      BEGIN
        org_id := current_setting('app.organization_id', true)::uuid;
        IF org_id IS NOT NULL THEN
          RETURN org_id;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Continue to database lookup
      END;
      
      -- Fallback to database lookup
      SELECT organization_id INTO org_id
      FROM users 
      WHERE id = auth.uid();
      
      RETURN org_id;
    END;
    $$;


ALTER FUNCTION "public"."get_user_organization_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."int_or_null"("p_text" "text") RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare v text; begin
  if p_text is null then return null; end if;
  v := nullif(trim(p_text), '');
  if v is null then return null; end if;
  begin
    return v::int;
  exception when others then
    return null; -- se não for inteiro válido, retorna NULL
  end;
end $$;


ALTER FUNCTION "public"."int_or_null"("p_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."james_get"("p_organization_id" "uuid") RETURNS TABLE("agent_id" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  return query
    select j.agent_id
    from public.james j
    where j.organization_id = p_organization_id
    limit 1;
end;
$$;


ALTER FUNCTION "public"."james_get"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."james_upsert"("p_organization_id" "uuid", "p_agent_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  insert into public.james (organization_id, agent_id)
  values (p_organization_id, coalesce(p_agent_id, ''))
  on conflict (organization_id) do update
    set agent_id = excluded.agent_id,
        updated_at = now();
end;
$$;


ALTER FUNCTION "public"."james_upsert"("p_organization_id" "uuid", "p_agent_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kanban_leads_stats"("p_organization_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_total bigint := 0;
  v_total_paid_value numeric := 0;
  v_high_priority bigint := 0;
  v_highlighted bigint := 0;
  v_with_payment bigint := 0;
  v_stage jsonb := '{}'::jsonb;
begin
  perform set_config('app.organization_id', p_organization_id::text, true);

  select count(*) into v_total from public.crm_leads where organization_id = p_organization_id;
  select coalesce(sum(payment_value), 0) into v_total_paid_value from public.crm_leads where organization_id = p_organization_id and has_payment is true;
  select count(*) into v_high_priority from public.crm_leads where organization_id = p_organization_id and priority = 'high';
  select count(*) into v_highlighted from public.crm_leads where organization_id = p_organization_id and is_highlight is true;
  select count(*) into v_with_payment from public.crm_leads where organization_id = p_organization_id and has_payment is true;

  select coalesce(jsonb_object_agg(coalesce(stage,'(sem estágio)'), cnt), '{}'::jsonb) into v_stage
  from (
    select stage, count(*)::bigint as cnt
    from public.crm_leads
    where organization_id = p_organization_id
    group by stage
  ) s;

  return jsonb_build_object(
    'total', v_total,
    'total_paid_value', v_total_paid_value,
    'high_priority', v_high_priority,
    'highlighted', v_highlighted,
    'with_payment', v_with_payment,
    'by_stage', v_stage
  );
end;
$$;


ALTER FUNCTION "public"."kanban_leads_stats"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leads_import_commit"("p_organization_id" "uuid", "p_import_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_lock_key text := 'leads_import:' || p_import_id::text; v_lock_ok boolean;
begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  v_lock_ok := public.try_advisory_lock(v_lock_key);
  if not v_lock_ok then
    raise exception 'Import já em processamento';
  end if;

  update public.crm_leads_import_jobs
    set status='processing', started_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  -- 1) INSERT por telefone (sem deduplicação - permite múltiplos leads com mesmo telefone)
  insert into public.crm_leads(
    id, organization_id, name, whatsapp, email, stage, value, source, canal, description
  )
  select gen_random_uuid(), s.organization_id,
         coalesce(nullif(s.name,''), 'Sem nome'),
         s.whatsapp, s.email, coalesce(nullif(s.stage,''), 'novo'), coalesce(s.value, 0), s.source, s.canal, s.description
  from public.crm_leads_import_staging s
  where s.import_id = p_import_id
    and s.organization_id = p_organization_id
    and s.phone_normalized is not null;

  -- 2) UPSERT por email (mantém deduplicação por email quando não há telefone)
  with s_email as (
    select distinct on (s.organization_id, s.email_normalized)
           s.organization_id, s.name, s.whatsapp, s.email, s.stage, s.value, s.source, s.canal, s.description,
           s.email_normalized
    from public.crm_leads_import_staging s
    where s.import_id = p_import_id
      and s.organization_id = p_organization_id
      and s.phone_normalized is null
      and s.email_normalized is not null
    order by s.organization_id, s.email_normalized, coalesce(s.row_num, 0) desc, s.created_at desc
  )
  insert into public.crm_leads(
    id, organization_id, name, whatsapp, email, stage, value, source, canal, description
  )
  select gen_random_uuid(), se.organization_id,
         coalesce(nullif(se.name,''), 'Sem nome'),
         se.whatsapp, se.email, coalesce(nullif(se.stage,''), 'novo'), coalesce(se.value, 0), se.source, se.canal, se.description
  from s_email se
  on conflict (organization_id, email_normalized)
    where email_normalized is not null
  do update set
    name = excluded.name,
    whatsapp = excluded.whatsapp,
    email = excluded.email,
    stage = excluded.stage,
    value = excluded.value,
    source = excluded.source,
    canal = excluded.canal,
    description = excluded.description,
    updated_at = now();

  update public.crm_leads_import_jobs
    set processed_rows = (select count(*) from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id),
        status='done',
        finished_at=now()
  where id=p_import_id and organization_id=p_organization_id;

  delete from public.crm_leads_import_staging where import_id=p_import_id and organization_id=p_organization_id;

  perform public.advisory_unlock(v_lock_key);
  return jsonb_build_object('status','done');
exception when others then
  perform public.advisory_unlock(v_lock_key);
  update public.crm_leads_import_jobs
    set status='failed', error=SQLERRM, finished_at=now()
  where id=p_import_id and organization_id=p_organization_id;
  raise;
end;
$$;


ALTER FUNCTION "public"."leads_import_commit"("p_organization_id" "uuid", "p_import_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leads_import_stage_rows"("p_organization_id" "uuid", "p_import_id" "uuid", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_count int; begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  insert into public.crm_leads_import_staging(import_id, organization_id, row_num, name, whatsapp, email, phone_normalized, email_normalized, stage, value, source, canal, description)
  select p_import_id, p_organization_id,
         coalesce((row->>'row_num')::int, null),
         nullif(trim(row->>'name'),''),
         nullif(trim(row->>'whatsapp'),''),
         nullif(trim(row->>'email'),''),
         public.normalize_phone_e164_br(row->>'whatsapp'),
         public.normalize_email(row->>'email'),
         coalesce(nullif(trim(row->>'stage'), ''), 'novo'),
         nullif(row->>'value','')::numeric,
         nullif(trim(row->>'source'),''),
         nullif(trim(row->>'canal'),''),
         nullif(trim(row->>'description'), '')
  from jsonb_array_elements(p_rows) row;
  get diagnostics v_count = row_count;
  update public.crm_leads_import_jobs set staged_rows = staged_rows + v_count, total_rows = greatest(total_rows, staged_rows + v_count)
  where id = p_import_id and organization_id = p_organization_id;
  return v_count; end $$;


ALTER FUNCTION "public"."leads_import_stage_rows"("p_organization_id" "uuid", "p_import_id" "uuid", "p_rows" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leads_import_start"("p_organization_id" "uuid", "p_filename" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_id uuid := gen_random_uuid(); begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  insert into public.crm_leads_import_jobs(id, organization_id, filename) values (v_id, p_organization_id, p_filename);
  return v_id; end $$;


ALTER FUNCTION "public"."leads_import_start"("p_organization_id" "uuid", "p_filename" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_leads_import_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "filename" "text",
    "total_rows" integer DEFAULT 0,
    "staged_rows" integer DEFAULT 0,
    "processed_rows" integer DEFAULT 0,
    "duplicate_rows" integer DEFAULT 0,
    "invalid_rows" integer DEFAULT 0,
    "status" "text" DEFAULT 'staging'::"text" NOT NULL,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone
);


ALTER TABLE "public"."crm_leads_import_jobs" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leads_import_status"("p_organization_id" "uuid", "p_import_id" "uuid") RETURNS "public"."crm_leads_import_jobs"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select * from public.crm_leads_import_jobs where id=p_import_id and organization_id=p_organization_id; $$;


ALTER FUNCTION "public"."leads_import_status"("p_organization_id" "uuid", "p_import_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_crm_lead_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid;
  v_any_inserted boolean := false;
  v_origin text;
begin
  v_actor := coalesce(new.updated_by, new.created_by, old.updated_by, old.created_by);
  v_origin := coalesce(public.get_request_header('x-tomik-origin'), 'automation');

  if tg_op = 'INSERT' then
    insert into public.crm_lead_activities (
      lead_id, user_id, action, field_changed, description, origin, created_at
    ) values (
      new.id, v_actor, 'INSERT', 'insert', 'Lead criado: ' || coalesce(new.name,''), v_origin, now()
    );
    return new;

  elsif tg_op = 'UPDATE' then
    -- Stage change
    if old.stage is distinct from new.stage then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, old_value, new_value, origin, created_at
      ) values (
        new.id, v_actor, 'UPDATE', 'stage',
        'Lead movido para: ' || coalesce(new.stage,'indefinido'),
        old.stage, new.stage, v_origin, now()
      );
      v_any_inserted := true;
    end if;

    -- Description change
    if coalesce(old.description,'') is distinct from coalesce(new.description,'') then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, old_value, new_value, origin, created_at
      ) values (
        new.id, v_actor, 'UPDATE', 'description',
        'Descrição atualizada',
        old.description, new.description, v_origin, now()
      );
      v_any_inserted := true;
    end if;

    -- Payment status change
    if coalesce(old.has_payment,false) is distinct from coalesce(new.has_payment,false) then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, old_value, new_value, origin, created_at
      ) values (
        new.id, v_actor, 'UPDATE', 'has_payment',
        case when new.has_payment then 'Lead marcado como pago' else 'Lead desmarcado como pago' end,
        coalesce(old.payment_value,0)::text,
        coalesce(new.payment_value,0)::text,
        v_origin, now()
      );
      v_any_inserted := true;
    elsif coalesce(old.payment_value,0) is distinct from coalesce(new.payment_value,0) then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, old_value, new_value, origin, created_at
      ) values (
        new.id, v_actor, 'UPDATE', 'payment_value',
        'Valor do pagamento atualizado',
        coalesce(old.payment_value,0)::text,
        coalesce(new.payment_value,0)::text,
        v_origin, now()
      );
      v_any_inserted := true;
    end if;

    if not v_any_inserted then
      insert into public.crm_lead_activities (
        lead_id, user_id, action, field_changed, description, origin, created_at
      ) values (
        new.id, v_actor, 'UPDATE', null, 'Lead atualizado: ' || coalesce(new.name,''), v_origin, now()
      );
    end if;

    return new;

  elsif tg_op = 'DELETE' then
    insert into public.crm_lead_activities (
      lead_id, user_id, action, field_changed, description, origin, created_at
    ) values (
      old.id, v_actor, 'DELETE', 'delete', 'Lead excluído: ' || coalesce(old.name,''), v_origin, now()
    );
    return old;
  end if;

  return new;
exception when others then
  raise notice 'CRM lead activity logging failed: %', sqlerrm;
  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;


ALTER FUNCTION "public"."log_crm_lead_changes"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."manychat_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "api_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tag_resposta_id" "text",
    "tag_resposta_nome" "text",
    "field_resposta_id" "text",
    "field_resposta_nome" "text",
    "flow_ns" "text",
    "flow_nome" "text"
);


ALTER TABLE "public"."manychat_credentials" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manychat_credentials_get"("p_organization_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."manychat_credentials"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_org uuid := coalesce(
    p_organization_id,
    NULLIF(current_setting('app.organization_id', true), '')::uuid
  );
  v_row public.manychat_credentials;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;

  PERFORM set_config('app.organization_id', v_org::text, true);

  SELECT *
    INTO v_row
    FROM public.manychat_credentials
   WHERE organization_id = v_org
   LIMIT 1;

  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."manychat_credentials_get"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manychat_credentials_upsert"("p_organization_id" "uuid", "p_user_id" "uuid", "p_api_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  insert into public.manychat_credentials (organization_id, user_id, api_key)
  values (p_organization_id, coalesce(p_user_id, auth.uid()), p_api_key)
  on conflict (organization_id) do update
    set user_id = excluded.user_id,
        api_key = excluded.api_key,
        updated_at = now();
end;
$$;


ALTER FUNCTION "public"."manychat_credentials_upsert"("p_organization_id" "uuid", "p_user_id" "uuid", "p_api_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manychat_credentials_upsert_full"("p_organization_id" "uuid", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_api_key" "text" DEFAULT NULL::"text", "p_tag_resposta_id" "text" DEFAULT NULL::"text", "p_tag_resposta_nome" "text" DEFAULT NULL::"text", "p_field_resposta_id" "text" DEFAULT NULL::"text", "p_field_resposta_nome" "text" DEFAULT NULL::"text", "p_flow_ns" "text" DEFAULT NULL::"text", "p_flow_nome" "text" DEFAULT NULL::"text") RETURNS "public"."manychat_credentials"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_row public.manychat_credentials;
  v_org uuid := p_organization_id;
  v_user uuid := coalesce(p_user_id, auth.uid());
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;

  PERFORM set_config('app.organization_id', v_org::text, true);

  INSERT INTO public.manychat_credentials (
    organization_id,
    user_id,
    api_key,
    tag_resposta_id,
    tag_resposta_nome,
    field_resposta_id,
    field_resposta_nome,
    flow_ns,
    flow_nome
  ) VALUES (
    v_org,
    v_user,
    nullif(btrim(coalesce(p_api_key, '')), ''),
    nullif(btrim(coalesce(p_tag_resposta_id, '')), ''),
    nullif(btrim(coalesce(p_tag_resposta_nome, '')), ''),
    nullif(btrim(coalesce(p_field_resposta_id, '')), ''),
    nullif(btrim(coalesce(p_field_resposta_nome, '')), ''),
    nullif(btrim(coalesce(p_flow_ns, '')), ''),
    nullif(btrim(coalesce(p_flow_nome, '')), '')
  )
  ON CONFLICT (organization_id) DO UPDATE
    SET user_id = coalesce(excluded.user_id, manychat_credentials.user_id),
        api_key = coalesce(excluded.api_key, manychat_credentials.api_key),
        tag_resposta_id = coalesce(excluded.tag_resposta_id, manychat_credentials.tag_resposta_id),
        tag_resposta_nome = coalesce(excluded.tag_resposta_nome, manychat_credentials.tag_resposta_nome),
        field_resposta_id = coalesce(excluded.field_resposta_id, manychat_credentials.field_resposta_id),
        field_resposta_nome = coalesce(excluded.field_resposta_nome, manychat_credentials.field_resposta_nome),
        flow_ns = coalesce(excluded.flow_ns, manychat_credentials.flow_ns),
        flow_nome = coalesce(excluded.flow_nome, manychat_credentials.flow_nome),
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."manychat_credentials_upsert_full"("p_organization_id" "uuid", "p_user_id" "uuid", "p_api_key" "text", "p_tag_resposta_id" "text", "p_tag_resposta_nome" "text", "p_field_resposta_id" "text", "p_field_resposta_nome" "text", "p_flow_ns" "text", "p_flow_nome" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."map_pagamento_metodo_to_entradas"("m" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case lower(coalesce(m,''))
    when 'dinheiro' then 'dinheiro'
    when 'pix' then 'pix'
    when 'transferencia' then 'transferencia'
    when 'cheque' then 'cheque'
    when 'cartao' then 'cartao_credito'
    when 'cartao_credito' then 'cartao_credito'
    when 'cartao_debito' then 'cartao_debito'
    when 'boleto' then 'boleto'
    else 'dinheiro'
  end;
$$;


ALTER FUNCTION "public"."map_pagamento_metodo_to_entradas"("m" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."map_produto_categoria_to_entrada_categoria"("ps_categoria" "text", "ps_tipo" "text", "ps_tipo_cobranca" "text", "ps_cobranca_tipo" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case
    when lower(coalesce(ps_categoria,'')) in (
      'consulta','exame','procedimento','terapia','cirurgia','treinamento'
    ) then 'Serviços'
    when lower(coalesce(ps_categoria,'')) in (
      'consultoria'
    ) then 'Consultoria'
    when lower(coalesce(ps_categoria,'')) in (
      'medicamento','equipamento','material','software'
    ) then 'Produtos'
    when lower(coalesce(ps_categoria,'')) in (
      'assinatura'
    ) or lower(coalesce(ps_tipo_cobranca,'')) in (
      'mensal','trimestral','semestral','anual'
    ) or lower(coalesce(ps_cobranca_tipo,'')) in (
      'mensal','trimestral','semestral','anual'
    ) then 'Assinatura'
    else 'Outros'
  end;
$$;


ALTER FUNCTION "public"."map_produto_categoria_to_entrada_categoria"("ps_categoria" "text", "ps_tipo" "text", "ps_tipo_cobranca" "text", "ps_cobranca_tipo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_rag"("p_query_embedding" "public"."vector", "p_source_id" "uuid" DEFAULT NULL::"uuid", "p_category" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 10, "p_org" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" bigint, "source_id" "uuid", "category" "text", "content" "text", "fields" "jsonb", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "sql" STABLE
    AS $$
  select
    ri.id,
    ri.source_id,
    ri.category,
    ri.content,
    ri.fields,
    ri.metadata,
    1 - (ri.embedding <=> p_query_embedding) as similarity
  from public.rag_items ri
  where ri.embedding is not null
    and (
      ri.organization_id = coalesce(p_org, nullif(current_setting('app.organization_id', true), '')::uuid)
    )
    and (p_source_id is null or ri.source_id = p_source_id)
    and (p_category is null or ri.category = p_category)
  order by ri.embedding <=> p_query_embedding
  limit greatest(1, p_limit);
$$;


ALTER FUNCTION "public"."match_rag"("p_query_embedding" "public"."vector", "p_source_id" "uuid", "p_category" "text", "p_limit" integer, "p_org" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."match_rag"("p_query_embedding" "public"."vector", "p_source_id" "uuid", "p_category" "text", "p_limit" integer, "p_org" "uuid") IS 'Busca por similaridade (cosine) em rag_items com filtros opcionais';



CREATE OR REPLACE FUNCTION "public"."migrate_organization_data"("p_from_org_id" "uuid", "p_to_org_id" "uuid", "p_user_id" "uuid", "p_dry_run" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  from_owner uuid;
  to_owner uuid;
  r record;
  upd_count bigint;
  results jsonb := '[]'::jsonb;
  sql text;
  has_updated_at boolean;
  org_col_type text;
begin
  if p_from_org_id = p_to_org_id then
    raise exception 'from and to organization must be different';
  end if;

  -- Validate ownership
  select owner_id into from_owner from public.saas_organizations where id = p_from_org_id;
  select owner_id into to_owner from public.saas_organizations where id = p_to_org_id;
  if from_owner is null or to_owner is null then
    raise exception 'source or target organization not found';
  end if;
  if from_owner <> p_user_id or to_owner <> p_user_id then
    raise exception 'user is not owner of both organizations';
  end if;

  if not p_dry_run then
    -- (removido) não renomeamos na origem; clonaremos linhas referenciadas faltantes genericamente

    -- Pre-step: clonar crm_stages faltantes (metadados completos) da origem para o destino
    begin
      insert into public.crm_stages
      select (json_populate_record(NULL::public.crm_stages,
               ((to_jsonb(s) - 'id' - 'created_at' - 'updated_at' - 'organization_id') ||
               jsonb_build_object('organization_id', p_to_org_id))::json
             )).*
      from public.crm_stages s
      where s.organization_id = p_from_org_id
        and not exists (
          select 1 from public.crm_stages d
          where d.organization_id = p_to_org_id and d.name = s.name
        );
    exception when undefined_table then
      null;
    end;

    -- Pre-step genérico: para toda FK composta que inclua organization_id no parent,
    -- clonar do org de origem para o destino as linhas faltantes, baseando-se no conjunto de chaves naturais
    -- (todas as colunas da FK exceto organization_id).
    declare
      fk_rec record;
      cond text;
      col text;
      col_list text;
      sel_list text;
    begin
      for fk_rec in (
        select con.oid,
               ns_p.nspname as parent_schema,
               rel_p.relname as parent_table,
               array_agg(pa.attname order by ck.ord) as parent_cols
        from pg_constraint con
        join pg_class rel_p on rel_p.oid = con.confrelid
        join pg_namespace ns_p on ns_p.oid = rel_p.relnamespace
        join unnest(con.confkey) with ordinality as ck(attnum, ord) on true
        join pg_attribute pa on pa.attrelid = con.confrelid and pa.attnum = ck.attnum
        join pg_class rel_c on rel_c.oid = con.conrelid
        join pg_namespace ns_c on ns_c.oid = rel_c.relnamespace
        where con.contype = 'f'
          and ns_p.nspname = 'public'
          and ns_c.nspname = 'public'
        group by con.oid, parent_schema, parent_table
      ) loop
        if array_position(fk_rec.parent_cols, 'organization_id') is not null
           and array_length(fk_rec.parent_cols, 1) > 1 then
          cond := '';
          foreach col in array fk_rec.parent_cols loop
            if col <> 'organization_id' then
              if cond <> '' then cond := cond || ' and '; end if;
              cond := cond || format('d.%I is not distinct from p.%I', col, col);
            end if;
          end loop;
          if cond <> '' then
            select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position) into col_list
            from information_schema.columns c
            where c.table_schema = fk_rec.parent_schema and c.table_name = fk_rec.parent_table;
            select string_agg(
                     case when c.column_name = 'id'
                          then 'COALESCE((rec).id, gen_random_uuid())'
                          else format('(rec).%I', c.column_name) end,
                     ', ' order by c.ordinal_position) into sel_list
            from information_schema.columns c
            where c.table_schema = fk_rec.parent_schema and c.table_name = fk_rec.parent_table;

            sql := format(
              'insert into %I.%I (%s)
               select %s
               from (
                 select json_populate_record(NULL::%I.%I,
                         ((to_jsonb(p) - ''organization_id'') || jsonb_build_object(''organization_id'', $1))::json
                       ) as rec
                 from %I.%I p
                 where p.organization_id = $2
                   and not exists (
                     select 1 from %I.%I d
                     where d.organization_id = $1 and %s
                   )
               ) q',
              fk_rec.parent_schema, fk_rec.parent_table,
              col_list,
              sel_list,
              fk_rec.parent_schema, fk_rec.parent_table,
              fk_rec.parent_schema, fk_rec.parent_table,
              fk_rec.parent_schema, fk_rec.parent_table,
              cond
            );
            begin
              execute sql using p_to_org_id, p_from_org_id;
            exception when undefined_table then
              null;
            end;
          end if;
        end if;
      end loop;
    end;
  end if;

  -- Iterate public tables with organization_id
  for r in (
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'organization_id'
      and t.table_type = 'BASE TABLE'
      and c.table_name <> 'saas_organizations'
      and c.table_name <> 'crm_stages'
    group by c.table_name
    order by c.table_name
  ) loop
    -- Detect column type to cast parameters safely (some legacy tables use text/varchar)
    select c.data_type into org_col_type
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = r.table_name and c.column_name = 'organization_id'
    limit 1;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = r.table_name and column_name = 'updated_at'
    ) into has_updated_at;

    if p_dry_run then
      if org_col_type = 'uuid' then
        execute format('select count(*) from public.%I where organization_id = $1::uuid', r.table_name)
          into upd_count using p_from_org_id;
      else
        execute format('select count(*) from public.%I where organization_id::text = $1::text', r.table_name)
          into upd_count using p_from_org_id;
      end if;
      results := results || jsonb_build_array(jsonb_build_object('table', r.table_name, 'would_update', upd_count));
    else
      if has_updated_at then
        if org_col_type = 'uuid' then
          sql := format('update public.%I set organization_id = $1::uuid, updated_at = now() where organization_id = $2::uuid', r.table_name);
        else
          sql := format('update public.%I set organization_id = $1::text, updated_at = now() where organization_id::text = $2::text', r.table_name);
        end if;
      else
        if org_col_type = 'uuid' then
          sql := format('update public.%I set organization_id = $1::uuid where organization_id = $2::uuid', r.table_name);
        else
          sql := format('update public.%I set organization_id = $1::text where organization_id::text = $2::text', r.table_name);
        end if;
      end if;
      execute sql using p_to_org_id, p_from_org_id;
      get diagnostics upd_count = row_count;
      results := results || jsonb_build_array(jsonb_build_object('table', r.table_name, 'updated', upd_count));
    end if;
  end loop;

  return jsonb_build_object(
    'dry_run', p_dry_run,
    'from', p_from_org_id,
    'to', p_to_org_id,
    'summary', results
  );
end
$_$;


ALTER FUNCTION "public"."migrate_organization_data"("p_from_org_id" "uuid", "p_to_org_id" "uuid", "p_user_id" "uuid", "p_dry_run" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."monetization_trail_progress_list"("p_organization_id" "uuid") RETURNS TABLE("step_key" "text", "completed" boolean, "completed_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  return query
  select step_key, completed, completed_at
  from public.monetization_trail_progress
  where organization_id = p_organization_id
  order by step_key asc;
end;
$$;


ALTER FUNCTION "public"."monetization_trail_progress_list"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."monetization_trail_progress" (
    "organization_id" "uuid" NOT NULL,
    "step_key" "text" NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."monetization_trail_progress" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."monetization_trail_progress_upsert"("p_organization_id" "uuid", "p_step_key" "text", "p_completed" boolean) RETURNS "public"."monetization_trail_progress"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_row public.monetization_trail_progress;
begin
  perform set_config('app.organization_id', p_organization_id::text, true);

  insert into public.monetization_trail_progress (organization_id, step_key, completed, completed_at)
  values (p_organization_id, p_step_key, coalesce(p_completed, true), case when coalesce(p_completed, true) then now() else null end)
  on conflict (organization_id, step_key) do update
    set completed = excluded.completed,
        completed_at = case when excluded.completed then now() else null end,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."monetization_trail_progress_upsert"("p_organization_id" "uuid", "p_step_key" "text", "p_completed" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."n8n_delete"("p_organization_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  -- Setar o contexto de organização para cumprir as policies RLS
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);

  -- Remover a conexão vinculada
  delete from public.n8n_connections c
  where c.organization_id = p_organization_id;
end; $$;


ALTER FUNCTION "public"."n8n_delete"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."n8n_get"("p_organization_id" "uuid") RETURNS TABLE("base_url" "text", "api_key" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  return query select c.base_url, c.api_key from public.n8n_connections c where c.organization_id = p_organization_id limit 1;
end; $$;


ALTER FUNCTION "public"."n8n_get"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."n8n_upsert"("p_organization_id" "uuid", "p_base_url" "text", "p_api_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  insert into public.n8n_connections (organization_id, base_url, api_key)
  values (p_organization_id, p_base_url, p_api_key)
  on conflict (organization_id) do update set base_url = excluded.base_url, api_key = excluded.api_key, updated_at = now();
end; $$;


ALTER FUNCTION "public"."n8n_upsert"("p_organization_id" "uuid", "p_base_url" "text", "p_api_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_appointment_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Novo agendamento criado
    PERFORM create_notification(
      NEW.organization_id,
      NULL,
      'agendamento',
      '📅 Novo agendamento: ' || (SELECT nome FROM patients WHERE id = NEW.patient_id LIMIT 1),
      '/agenda?appointment=' || NEW.id::text,
      jsonb_build_object(
        'appointment_id', NEW.id,
        'patient_id', NEW.patient_id,
        'professional_id', NEW.professional_id,
        'datetime', NEW.datetime,
        'action', 'created'
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Status do agendamento mudou
    IF OLD.status != NEW.status THEN
      PERFORM create_notification(
        NEW.organization_id,
        NULL,
        'agendamento',
        '📋 Agendamento ' || NEW.status || ': ' || (SELECT nome FROM patients WHERE id = NEW.patient_id LIMIT 1),
        '/agenda?appointment=' || NEW.id::text,
        jsonb_build_object(
          'appointment_id', NEW.id,
          'old_status', OLD.status,
          'new_status', NEW.status,
          'action', 'status_changed'
        )
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."notify_appointment_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_appointment_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  patient_name text;
  professional_name text;
BEGIN
  -- Só notificar se o status realmente mudou
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Buscar nomes
    SELECT nome INTO patient_name FROM patients WHERE id = NEW.patient_id;
    SELECT name INTO professional_name FROM professionals WHERE id = NEW.professional_id;
    
    -- Notificar baseado no novo status
    CASE NEW.status
      WHEN 'realizado' THEN
        PERFORM notify_users_by_role(
          NEW.organization_id,
          ARRAY['admin', 'recepcionista']::text[],
          'agendamento',
          format('✅ Consulta realizada: %s com %s', 
            COALESCE(patient_name, 'Paciente'),
            COALESCE(professional_name, 'Profissional')
          ),
          format('/consultations?appointment=%s', NEW.id),
          jsonb_build_object(
            'appointment_id', NEW.id,
            'patient_name', patient_name,
            'professional_name', professional_name,
            'old_status', OLD.status,
            'new_status', NEW.status
          )
        );
        
      WHEN 'cancelado' THEN
        PERFORM notify_users_by_role(
          NEW.organization_id,
          ARRAY['admin', 'recepcionista']::text[],
          'agendamento',
          format('❌ Consulta cancelada: %s com %s em %s', 
            COALESCE(patient_name, 'Paciente'),
            COALESCE(professional_name, 'Profissional'),
            to_char(NEW.datetime, 'DD/MM/YYYY HH24:MI')
          ),
          format('/agenda?appointment=%s', NEW.id),
          jsonb_build_object(
            'appointment_id', NEW.id,
            'patient_name', patient_name,
            'professional_name', professional_name,
            'datetime', NEW.datetime,
            'cancellation_reason', 'Cancelado pelo sistema'
          )
        );
        
      ELSE
        -- Para outros status (como 'agendado', 'confirmado', etc), não notificar
        -- Isso evita o erro "case not found"
        NULL;
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_appointment_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_automation_event"("event_type" "text", "organization_id" "uuid", "event_data" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Log do evento
  RAISE NOTICE 'Automation event: % for org: %', event_type, organization_id;
  
  -- Notificar via pg_notify (será capturado por listeners)
  PERFORM pg_notify(
    'automation_events',
    json_build_object(
      'event_type', event_type,
      'organization_id', organization_id,
      'data', event_data,
      'timestamp', now()
    )::text
  );
  
  -- Também inserir na tabela de eventos para histórico
  INSERT INTO automation_events (
    organization_id,
    event_type,
    event_data,
    created_at
  ) VALUES (
    organization_id,
    event_type,
    event_data,
    now()
  );
END;
$$;


ALTER FUNCTION "public"."notify_automation_event"("event_type" "text", "organization_id" "uuid", "event_data" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_automation_event"("event_type" "text", "organization_id" "uuid", "event_data" "jsonb") IS 'Dispara evento de automação via pg_notify e salva no histórico';



CREATE OR REPLACE FUNCTION "public"."notify_client_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Log para debug
  RAISE NOTICE '🔔 [TRIGGER] Client trigger fired: % on table %', TG_OP, TG_TABLE_NAME;
  
  IF TG_OP = 'INSERT' THEN
    PERFORM create_notification(
      NEW.organization_id,
      NULL, -- Notificação para toda organização
      'cliente',
      '👤 Novo cliente cadastrado: ' || NEW.nome,
      '/patients?client=' || NEW.id::text,
      jsonb_build_object('client_id', NEW.id, 'client_name', NEW.nome)
    );
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    -- Só notificar mudanças importantes
    IF OLD.nome != NEW.nome OR OLD.telefone != NEW.telefone OR OLD.email != NEW.email THEN
      PERFORM create_notification(
        NEW.organization_id,
        NULL,
        'cliente',
        '✏️ Cliente atualizado: ' || NEW.nome,
        '/patients?client=' || NEW.id::text,
        jsonb_build_object('client_id', NEW.id, 'client_name', NEW.nome)
      );
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."notify_client_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_collaborator_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Log para debug
  RAISE NOTICE '🔔 [TRIGGER] Collaborator trigger fired: % on table %', TG_OP, TG_TABLE_NAME;
  
  IF TG_OP = 'INSERT' THEN
    PERFORM create_notification(
      NEW.organization_id,
      NULL, -- Notificação para toda organização
      'colaborador',
      '👨‍💼 Novo colaborador adicionado: ' || NEW.name,
      '/professionals?collaborator=' || NEW.id::text,
      jsonb_build_object('collaborator_id', NEW.id, 'collaborator_name', NEW.name, 'position', NEW.position)
    );
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    -- Só notificar mudanças importantes
    IF OLD.name != NEW.name OR OLD.position != NEW.position OR OLD.active != NEW.active THEN
      PERFORM create_notification(
        NEW.organization_id,
        NULL,
        'colaborador',
        '✏️ Colaborador atualizado: ' || NEW.name,
        '/professionals?collaborator=' || NEW.id::text,
        jsonb_build_object('collaborator_id', NEW.id, 'collaborator_name', NEW.name)
      );
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."notify_collaborator_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_consultation_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Nova consulta registrada
    PERFORM create_notification(
      NEW.organization_id,
      NULL,
      'consulta',
      '📋 Consulta registrada: ' || (SELECT nome FROM patients WHERE id = NEW.patient_id LIMIT 1),
      '/consultations?consultation=' || NEW.id::text,
      jsonb_build_object(
        'consultation_id', NEW.id,
        'patient_id', NEW.patient_id,
        'professional_id', NEW.professional_id,
        'action', 'created'
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."notify_consultation_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_consultation_completed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  patient_name text;
  professional_name text;
BEGIN
  -- Buscar nomes
  SELECT nome INTO patient_name FROM patients WHERE id = NEW.patient_id;
  SELECT name INTO professional_name FROM professionals WHERE id = NEW.professional_id;
  
  -- Notificar sobre consulta realizada
  PERFORM notify_users_by_role(
    NEW.organization_id,
    ARRAY['admin', 'recepcionista']::text[],
    'consulta',
    format('📋 Consulta finalizada: %s atendido por %s', 
      COALESCE(patient_name, 'Paciente'),
      COALESCE(professional_name, 'Profissional')
    ),
    format('/consultations?consultation=%s', NEW.id),
    jsonb_build_object(
      'consultation_id', NEW.id,
      'patient_id', NEW.patient_id,
      'patient_name', patient_name,
      'professional_id', NEW.professional_id,
      'professional_name', professional_name,
      'consultation_type', NEW.type,
      'consultation_date', NEW.date
    )
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_consultation_completed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_expense_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.valor > 500 THEN
    -- Despesa importante registrada
    PERFORM create_notification(
      NEW.organization_id,
      NULL,
      'sistema',
      '💸 Despesa importante: R$ ' || NEW.valor::text || ' (' || NEW.categoria || ')',
      '/financial?expense=' || NEW.id::text,
      jsonb_build_object(
        'expense_id', NEW.id,
        'valor', NEW.valor,
        'categoria', NEW.categoria,
        'action', 'created'
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$_$;


ALTER FUNCTION "public"."notify_expense_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_important_expense"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
  -- Notificar apenas despesas acima de R$ 500
  IF NEW.valor >= 500 THEN
    PERFORM notify_users_by_role(
      NEW.organization_id,
      ARRAY['admin']::text[],
      'sistema',
      format('💸 Nova despesa registrada: %s - R$ %.2f (%s)', 
        NEW.descricao,
        NEW.valor,
        NEW.categoria
      ),
      '/financial',
      jsonb_build_object(
        'expense_id', NEW.id,
        'expense_description', NEW.descricao,
        'expense_amount', NEW.valor,
        'expense_category', NEW.categoria,
        'expense_date', NEW.data_despesa
      )
    );
  END IF;
  
  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."notify_important_expense"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_lead_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Novo lead criado
    PERFORM create_notification(
      NEW.organization_id,
      NULL,
      'crm',
      '🎯 Novo lead: ' || NEW.name,
      '/kanban?lead=' || NEW.id::text,
      jsonb_build_object(
        'lead_id', NEW.id,
        'lead_name', NEW.name,
        'stage', NEW.stage,
        'action', 'created'
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Lead mudou de estágio
    IF OLD.stage != NEW.stage THEN
      PERFORM create_notification(
        NEW.organization_id,
        NULL,
        'crm',
        '📈 Lead ' || NEW.name || ' movido: ' || OLD.stage || ' → ' || NEW.stage,
        '/kanban?lead=' || NEW.id::text,
        jsonb_build_object(
          'lead_id', NEW.id,
          'lead_name', NEW.name,
          'old_stage', OLD.stage,
          'new_stage', NEW.stage,
          'action', 'stage_changed'
        )
      );
    END IF;
    
    -- Lead efetuou pagamento
    IF NOT OLD.has_payment AND NEW.has_payment THEN
      PERFORM create_notification(
        NEW.organization_id,
        NULL,
        'pagamento',
        '💰 Lead ' || NEW.name || ' efetuou pagamento: R$ ' || NEW.payment_value::text,
        '/kanban?lead=' || NEW.id::text,
        jsonb_build_object(
          'lead_id', NEW.id,
          'lead_name', NEW.name,
          'payment_value', NEW.payment_value,
          'action', 'payment_received'
        )
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$_$;


ALTER FUNCTION "public"."notify_lead_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_lead_stage_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
  -- Só notificar se o estágio realmente mudou
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    PERFORM notify_users_by_role(
      NEW.organization_id,
      ARRAY['admin', 'medico']::text[],
      'crm',
      format('📈 Lead %s movido: %s → %s', NEW.name, OLD.stage, NEW.stage),
      format('/kanban?lead=%s', NEW.id),
      jsonb_build_object(
        'lead_id', NEW.id,
        'lead_name', NEW.name,
        'old_stage', OLD.stage,
        'new_stage', NEW.stage,
        'lead_value', NEW.value
      )
    );
  END IF;
  
  -- Notificar quando lead é marcado como pago
  IF OLD.has_payment = false AND NEW.has_payment = true THEN
    PERFORM notify_users_by_role(
      NEW.organization_id,
      ARRAY['admin', 'recepcionista']::text[],
      'pagamento',
      format('💰 Lead %s efetuou pagamento: %s', NEW.name, 
        CASE 
          WHEN NEW.payment_value > 0 THEN format('R$ %.2f', NEW.payment_value)
          ELSE 'valor não informado'
        END
      ),
      format('/kanban?lead=%s', NEW.id),
      jsonb_build_object(
        'lead_id', NEW.id,
        'lead_name', NEW.name,
        'payment_value', NEW.payment_value
      )
    );
  END IF;
  
  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."notify_lead_stage_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_marketing_investment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
  -- Notificar sobre investimentos acima de R$ 200
  IF NEW.valor >= 200 THEN
    PERFORM notify_users_by_role(
      NEW.organization_id,
      ARRAY['admin']::text[],
      'sistema',
      format('📢 Investimento em marketing: R$ %.2f no canal %s', 
        NEW.valor,
        NEW.canal
      ),
      '/financial',
      jsonb_build_object(
        'investment_id', NEW.id,
        'investment_amount', NEW.valor,
        'investment_channel', NEW.canal,
        'investment_campaign', NEW.campanha
      )
    );
  END IF;
  
  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."notify_marketing_investment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_new_appointment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  patient_name text;
  professional_name text;
BEGIN
  -- Buscar nomes do paciente e profissional
  SELECT nome INTO patient_name FROM patients WHERE id = NEW.patient_id;
  SELECT name INTO professional_name FROM professionals WHERE id = NEW.professional_id;
  
  -- Notificar equipe sobre novo agendamento
  PERFORM notify_users_by_role(
    NEW.organization_id,
    ARRAY['admin', 'recepcionista']::text[],
    'agendamento',
    format('📅 Novo agendamento: %s com %s em %s', 
      COALESCE(patient_name, 'Paciente'), 
      COALESCE(professional_name, 'Profissional'),
      to_char(NEW.datetime, 'DD/MM/YYYY HH24:MI')
    ),
    format('/agenda?appointment=%s', NEW.id),
    jsonb_build_object(
      'appointment_id', NEW.id,
      'patient_id', NEW.patient_id,
      'patient_name', patient_name,
      'professional_id', NEW.professional_id,
      'professional_name', professional_name,
      'datetime', NEW.datetime,
      'tipo', NEW.tipo
    )
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_new_appointment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_new_lead"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Notificar admins e vendedores sobre novo lead
  PERFORM notify_users_by_role(
    NEW.organization_id,
    ARRAY['admin', 'medico']::text[],
    'crm',
    format('🎯 Novo lead: %s (%s)', NEW.name, COALESCE(NEW.source, 'origem não informada')),
    format('/kanban?lead=%s', NEW.id),
    jsonb_build_object(
      'lead_id', NEW.id,
      'lead_name', NEW.name,
      'lead_stage', NEW.stage,
      'lead_priority', NEW.priority,
      'lead_value', NEW.value
    )
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_new_lead"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_new_patient"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Notificar equipe sobre novo cliente
  PERFORM notify_users_by_role(
    NEW.organization_id,
    ARRAY['admin', 'recepcionista']::text[],
    'sistema',
    format('👤 Novo cliente cadastrado: %s', NEW.nome),
    format('/patients?patient=%s', NEW.id),
    jsonb_build_object(
      'patient_id', NEW.id,
      'patient_name', NEW.nome,
      'patient_phone', NEW.telefone,
      'patient_email', NEW.email
    )
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_new_patient"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_new_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  patient_name text;
BEGIN
  -- Buscar nome do paciente
  SELECT nome INTO patient_name FROM patients WHERE id = NEW.paciente_id;
  
  -- Notificar sobre pagamento recebido
  PERFORM notify_users_by_role(
    NEW.organization_id,
    ARRAY['admin', 'recepcionista']::text[],
    'pagamento',
    format('💰 Pagamento recebido: %s de %s (%s)', 
      format('R$ %.2f', NEW.valor),
      COALESCE(patient_name, 'Cliente'),
      NEW.metodo
    ),
    format('/financial?payment=%s', NEW.id),
    jsonb_build_object(
      'payment_id', NEW.id,
      'patient_id', NEW.paciente_id,
      'patient_name', patient_name,
      'amount', NEW.valor,
      'method', NEW.metodo,
      'status', NEW.status
    )
  );
  
  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."notify_new_payment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_new_professional"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Notificar admins sobre novo colaborador
  PERFORM notify_users_by_role(
    NEW.organization_id,
    ARRAY['admin']::text[],
    'sistema',
    format('👨‍⚕️ Novo colaborador: %s (%s)', NEW.name, NEW.specialty),
    format('/professionals?professional=%s', NEW.id),
    jsonb_build_object(
      'professional_id', NEW.id,
      'professional_name', NEW.name,
      'professional_specialty', NEW.specialty
    )
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_new_professional"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_organization_users"("p_organization_id" "uuid", "p_tipo" "text", "p_mensagem" "text", "p_link" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_record RECORD;
  notification_count integer := 0;
BEGIN
  FOR user_record IN 
    SELECT id FROM users 
    WHERE organization_id = p_organization_id 
    AND ativo = true
  LOOP
    PERFORM create_notification(
      p_organization_id,
      user_record.id,
      p_tipo,
      p_mensagem,
      p_link,
      p_metadata
    );
    notification_count := notification_count + 1;
  END LOOP;
  
  RETURN notification_count;
END;
$$;


ALTER FUNCTION "public"."notify_organization_users"("p_organization_id" "uuid", "p_tipo" "text", "p_mensagem" "text", "p_link" "text", "p_metadata" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_organization_users"("p_organization_id" "uuid", "p_tipo" "text", "p_mensagem" "text", "p_link" "text", "p_metadata" "jsonb") IS 'Notifica todos os usuários da organização';



CREATE OR REPLACE FUNCTION "public"."notify_payment_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Novo pagamento recebido
    PERFORM create_notification(
      NEW.organization_id,
      NULL,
      'pagamento',
      '💰 Pagamento recebido: R$ ' || NEW.valor::text || ' (' || NEW.metodo || ')',
      '/financial?payment=' || NEW.id::text,
      jsonb_build_object(
        'payment_id', NEW.id,
        'valor', NEW.valor,
        'metodo', NEW.metodo,
        'action', 'received'
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$_$;


ALTER FUNCTION "public"."notify_payment_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_users_by_role"("p_organization_id" "uuid", "p_roles" "text"[], "p_tipo" "text", "p_mensagem" "text", "p_link" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_record RECORD;
  notification_count integer := 0;
BEGIN
  FOR user_record IN 
    SELECT id FROM users 
    WHERE organization_id = p_organization_id 
    AND role = ANY(p_roles)
    AND ativo = true
  LOOP
    PERFORM create_notification(
      p_organization_id,
      user_record.id,
      p_tipo,
      p_mensagem,
      p_link,
      p_metadata
    );
    notification_count := notification_count + 1;
  END LOOP;
  
  RETURN notification_count;
END;
$$;


ALTER FUNCTION "public"."notify_users_by_role"("p_organization_id" "uuid", "p_roles" "text"[], "p_tipo" "text", "p_mensagem" "text", "p_link" "text", "p_metadata" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_users_by_role"("p_organization_id" "uuid", "p_roles" "text"[], "p_tipo" "text", "p_mensagem" "text", "p_link" "text", "p_metadata" "jsonb") IS 'Notifica todos os usuários de determinados roles';



CREATE OR REPLACE FUNCTION "public"."org_me_progress_get"("p_organization_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid := p_organization_id;
  v_last_active_at timestamptz;
  v_features_used text[];
  v_onboarding_steps jsonb := '[]'::jsonb;
  v_onboarding_completed boolean := false;
  v_result jsonb;
begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  if v_user_id is null then
    return jsonb_build_object('error','not_authenticated');
  end if;

  -- Uso baseado em analytics_events por organização
  select max(e.ingested_at) into v_last_active_at
  from public.analytics_events e
  where e.organization_id = v_org_id
    and (e.user_id is null or e.user_id = v_user_id);

  select coalesce(array_agg(distinct e.feature_key), '{}') into v_features_used
  from public.analytics_events e
  where e.organization_id = v_org_id
    and (e.user_id is null or e.user_id = v_user_id)
    and e.feature_key is not null
    and e.ingested_at >= (now() - interval '30 days');

  -- Onboarding: usar tabela monetization_trail_progress (se existir) como proxy de onboarding
  begin
    v_onboarding_steps := coalesce((
      select jsonb_agg(jsonb_build_object(
        'step_key', p.step_key,
        'completed', p.completed,
        'updated_at', p.updated_at
      ) order by p.step_key)
      from public.monetization_trail_progress p
      where p.organization_id = v_org_id
    ), '[]'::jsonb);
    v_onboarding_completed := coalesce((
      select bool_and(p.completed) from public.monetization_trail_progress p where p.organization_id = v_org_id
    ), false);
  exception when undefined_table then
    -- tabela pode não existir em clientes antigos
    v_onboarding_steps := '[]'::jsonb;
    v_onboarding_completed := false;
  end;

  v_result := jsonb_build_object(
    'usage', jsonb_build_object(
      'dau', (select count(distinct e.user_id) from public.analytics_events e where e.organization_id = v_org_id and (e.user_id is null or e.user_id = v_user_id) and e.ingested_at >= (now() - interval '1 day')),
      'wau', (select count(distinct e.user_id) from public.analytics_events e where e.organization_id = v_org_id and (e.user_id is null or e.user_id = v_user_id) and e.ingested_at >= (now() - interval '7 days')),
      'mau', (select count(distinct e.user_id) from public.analytics_events e where e.organization_id = v_org_id and (e.user_id is null or e.user_id = v_user_id) and e.ingested_at >= (now() - interval '30 days')),
      'last_active_at', v_last_active_at,
      'features_used', coalesce(v_features_used, '{}')
    ),
    'onboarding', jsonb_build_object(
      'steps', v_onboarding_steps,
      'completed', v_onboarding_completed
    )
  );

  return v_result;
end;
$$;


ALTER FUNCTION "public"."org_me_progress_get"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."qna_bulk_upsert"("p_organization_id" "uuid", "p_items" "jsonb") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
declare
  item jsonb;
  v_count int := 0;
  v_tags text[];
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return 0;
  end if;
  for item in select jsonb_array_elements(p_items) loop
    v_tags := coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(item->'tags_list')),
      '{}'::text[]
    );
    insert into public.qna_pairs (organization_id, pergunta, resposta, categoria, tags)
    values (
      p_organization_id,
      trim(coalesce(item->>'pergunta', '')),
      trim(coalesce(item->>'resposta', '')),
      coalesce(nullif(trim(coalesce(item->>'categoria', '')), ''), 'Geral'),
      v_tags
    )
    on conflict do nothing;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."qna_bulk_upsert"("p_organization_id" "uuid", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."qna_delete"("p_organization_id" "uuid", "p_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
declare
  v_deleted int := 0;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  delete from public.qna_pairs
  where id = p_id
    and organization_id = p_organization_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;


ALTER FUNCTION "public"."qna_delete"("p_organization_id" "uuid", "p_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."qna_pairs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "pergunta" "text" NOT NULL,
    "resposta" "text" NOT NULL,
    "categoria" "text" DEFAULT 'Geral'::"text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."qna_pairs" OWNER TO "postgres";


COMMENT ON TABLE "public"."qna_pairs" IS 'Perguntas e Respostas por organização (Q&A Knowledge Base).';



CREATE OR REPLACE FUNCTION "public"."qna_insert"("p_organization_id" "uuid", "p_pergunta" "text", "p_resposta" "text", "p_categoria" "text" DEFAULT 'Geral'::"text", "p_tags" "text"[] DEFAULT '{}'::"text"[]) RETURNS "public"."qna_pairs"
    LANGUAGE "plpgsql"
    AS $$
declare
  rec public.qna_pairs;
begin
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  insert into public.qna_pairs (organization_id, pergunta, resposta, categoria, tags)
  values (
    p_organization_id,
    trim(coalesce(p_pergunta, '')),
    trim(coalesce(p_resposta, '')),
    coalesce(nullif(trim(coalesce(p_categoria, '')), ''), 'Geral'),
    coalesce(p_tags, '{}'::text[])
  )
  returning * into rec;
  return rec;
end;
$$;


ALTER FUNCTION "public"."qna_insert"("p_organization_id" "uuid", "p_pergunta" "text", "p_resposta" "text", "p_categoria" "text", "p_tags" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."qna_list"("p_organization_id" "uuid", "p_query" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 200, "p_offset" integer DEFAULT 0) RETURNS SETOF "public"."qna_pairs"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- Garantir contexto da organização na sessão atual (RLS)
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);

  return query
    select *
    from public.qna_pairs
    where organization_id = p_organization_id
      and (
        p_query is null
        or trim(p_query) = ''
        or (
          to_tsvector('portuguese', coalesce(pergunta,'') || ' ' || coalesce(resposta,'') || ' ' || coalesce(categoria,''))
          @@ plainto_tsquery('portuguese', p_query)
        )
      )
    order by updated_at desc
    limit greatest(0, coalesce(p_limit, 200))
    offset greatest(0, coalesce(p_offset, 0));
end;
$$;


ALTER FUNCTION "public"."qna_list"("p_organization_id" "uuid", "p_query" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."qna_update"("p_organization_id" "uuid", "p_id" "uuid", "p_pergunta" "text" DEFAULT NULL::"text", "p_resposta" "text" DEFAULT NULL::"text", "p_categoria" "text" DEFAULT NULL::"text", "p_tags" "text"[] DEFAULT NULL::"text"[]) RETURNS "public"."qna_pairs"
    LANGUAGE "plpgsql"
    AS $$
declare
  rec public.qna_pairs;
begin
  -- Configurar contexto RLS na mesma sessão
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  
  -- Atualizar apenas campos fornecidos (não null)
  -- Se o parâmetro for null, mantém o valor atual; se for fornecido (mesmo vazio), atualiza
  update public.qna_pairs
  set
    pergunta = case when p_pergunta is not null then trim(p_pergunta) else pergunta end,
    resposta = case when p_resposta is not null then trim(p_resposta) else resposta end,
    categoria = case 
      when p_categoria is not null then coalesce(nullif(trim(p_categoria), ''), 'Geral')
      else categoria 
    end,
    tags = coalesce(p_tags, tags),
    updated_at = now()
  where id = p_id
    and organization_id = p_organization_id
  returning * into rec;
  
  if rec.id is null then
    raise exception 'Q&A não encontrado ou sem permissão';
  end if;
  
  return rec;
end;
$$;


ALTER FUNCTION "public"."qna_update"("p_organization_id" "uuid", "p_id" "uuid", "p_pergunta" "text", "p_resposta" "text", "p_categoria" "text", "p_tags" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rag_set_org_from_context"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.organization_id is null then
    begin
      new.organization_id := nullif(current_setting('app.organization_id', true), '')::uuid;
    exception when others then
      new.organization_id := new.organization_id;
    end;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."rag_set_org_from_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalc_lead_value"("p_lead_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_sum numeric;
  v_org uuid;
  v_interests jsonb;
begin
  select organization_id, coalesce(interests, '[]'::jsonb)
    into v_org, v_interests
  from public.crm_leads
  where id = p_lead_id;

  if v_interests is null then
    return;
  end if;

  select coalesce(sum(ps.preco_base * coalesce((item->>'quantity')::int, 1)), 0)
    into v_sum
  from jsonb_array_elements(v_interests) as item
  join public.produtos_servicos ps
    on ps.id = (item->>'produto_servico_id')::uuid
   and ps.organization_id = v_org;

  if v_sum > 0 then
    update public.crm_leads
       set value = v_sum,
           updated_at = now()
     where id = p_lead_id;
  end if;
end; $$;


ALTER FUNCTION "public"."recalc_lead_value"("p_lead_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalc_lead_value_by_interest"("p_lead_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  r record;
  v_price numeric;
  v_total numeric;
begin
  select organization_id, interest_produto_servico_id, greatest(1, coalesce(interest_quantity, 1)) as qty
    into r
  from public.crm_leads
  where id = p_lead_id;

  if r.interest_produto_servico_id is null then
    return;
  end if;

  select ps.preco_base into v_price
    from public.produtos_servicos ps
   where ps.id = r.interest_produto_servico_id
     and ps.organization_id = r.organization_id;

  v_total := coalesce(v_price, 0) * coalesce(r.qty, 1);

  update public.crm_leads
     set value = coalesce(v_total, 0),
         updated_at = now()
   where id = p_lead_id;
end;
$$;


ALTER FUNCTION "public"."recalc_lead_value_by_interest"("p_lead_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reprocess_failed_automation_events"("p_organization_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  failed_events_count integer;
BEGIN
  -- Buscar eventos não processados dos últimos 7 dias
  SELECT COUNT(*) INTO failed_events_count
  FROM automation_events
  WHERE organization_id = p_organization_id
    AND processed = false
    AND created_at >= now() - INTERVAL '7 days';
  
  -- Marcar para reprocessamento (será capturado por listeners)
  UPDATE automation_events
  SET processed = false
  WHERE organization_id = p_organization_id
    AND processed = false
    AND created_at >= now() - INTERVAL '7 days';
  
  RETURN jsonb_build_object(
    'success', true,
    'events_reprocessed', failed_events_count,
    'organization_id', p_organization_id,
    'timestamp', now()
  );
END;
$$;


ALTER FUNCTION "public"."reprocess_failed_automation_events"("p_organization_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reprocess_failed_automation_events"("p_organization_id" "uuid") IS 'Reprocessa eventos de automação falhados';



CREATE TABLE IF NOT EXISTS "public"."repositorio_de_mensagens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "whatsapp_cliente" "text" NOT NULL,
    "whatsapp_empresa" "text",
    "sender_type" "public"."sender_type" NOT NULL,
    "direction" "public"."msg_direction",
    "content_text" "text" DEFAULT ''::"text" NOT NULL,
    "content_raw" "jsonb",
    "has_media" boolean DEFAULT false,
    "media_type" "text",
    "media_url" "text",
    "media_size_bytes" integer,
    "provider" "text",
    "provider_message_id" "text",
    "thread_id" "text",
    "conversation_id" "text" GENERATED ALWAYS AS ("md5"((("lower"(COALESCE("whatsapp_cliente", ''::"text")) || '|'::"text") || "lower"(COALESCE("whatsapp_empresa", ''::"text"))))) STORED,
    "reply_to_provider_message_id" "text",
    "language" "text",
    "labels" "text"[] DEFAULT '{}'::"text"[],
    "ai_model" "text",
    "ai_agent_id" "text",
    "human_operator_id" "text",
    "tsv" "tsvector" GENERATED ALWAYS AS ("setweight"("to_tsvector"('"portuguese"'::"regconfig", COALESCE("content_text", ''::"text")), 'A'::"char")) STORED,
    "embedding" "public"."vector"(1536),
    "organization_id" "uuid"
);


ALTER TABLE "public"."repositorio_de_mensagens" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rm_buscar"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_sender" "public"."sender_type" DEFAULT NULL::"public"."sender_type", "p_numero" "text" DEFAULT NULL::"text", "p_query" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 100, "p_offset" integer DEFAULT 0, "p_org" "uuid" DEFAULT NULL::"uuid") RETURNS SETOF "public"."repositorio_de_mensagens"
    LANGUAGE "sql" STABLE
    AS $$
  select *
  from public.repositorio_de_mensagens m
  where m.created_at between coalesce(p_inicio, '-infinity') and coalesce(p_fim, 'infinity')
    and (p_sender is null or m.sender_type = p_sender)
    and (p_numero is null or m.whatsapp_cliente = p_numero or m.whatsapp_empresa = p_numero)
    and (p_query is null or m.tsv @@ websearch_to_tsquery('portuguese', p_query))
    and (
      m.organization_id is not null
      and m.organization_id = coalesce(p_org, nullif(current_setting('app.organization_id', true), '')::uuid)
    )
  order by m.created_at desc
  limit greatest(0, p_limit)
  offset greatest(0, p_offset)
$$;


ALTER FUNCTION "public"."rm_buscar"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_sender" "public"."sender_type", "p_numero" "text", "p_query" "text", "p_limit" integer, "p_offset" integer, "p_org" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rm_get_conversation_messages"("p_organization_id" "uuid", "p_conversation_id" "text", "p_limit" integer DEFAULT 200, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "conversation_id" "text", "content_text" "text", "sender_type" "public"."sender_type", "whatsapp_cliente" "text", "whatsapp_empresa" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE
    AS $$
begin
  -- Garantir contexto de organização na MESMA sessão
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);

  return query
  select m.id,
         m.conversation_id,
         m.content_text,
         m.sender_type,
         m.whatsapp_cliente,
         m.whatsapp_empresa,
         m.created_at
  from public.repositorio_de_mensagens m
  where m.organization_id = p_organization_id
    and m.conversation_id = p_conversation_id
  order by m.created_at asc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;


ALTER FUNCTION "public"."rm_get_conversation_messages"("p_organization_id" "uuid", "p_conversation_id" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rm_list_chats"("p_organization_id" "uuid", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("conversation_id" "text", "whatsapp_empresa" "text", "whatsapp_cliente" "text", "last_message_at" timestamp with time zone, "messages_count" bigint)
    LANGUAGE "sql" STABLE
    AS $$
  select
    m.conversation_id,
    m.whatsapp_empresa,
    m.whatsapp_cliente,
    max(m.created_at) as last_message_at,
    count(*) as messages_count
  from public.repositorio_de_mensagens m
  where m.organization_id = p_organization_id
  group by m.conversation_id, m.whatsapp_empresa, m.whatsapp_cliente
  order by last_message_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0)
$$;


ALTER FUNCTION "public"."rm_list_chats"("p_organization_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rm_set_org_from_context"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.organization_id is null then
    begin
      new.organization_id := nullif(current_setting('app.organization_id', true), '')::uuid;
    exception when others then
      new.organization_id := new.organization_id; -- ignora se contexto não existir
    end;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."rm_set_org_from_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."safe_uuid"("p_text" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."safe_uuid"("p_text" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."safe_uuid"("p_text" "text") IS 'Converte texto→uuid; "" vira NULL; valores inválidos disparam 22P02.';



CREATE OR REPLACE FUNCTION "public"."set_client_token_if_missing"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.client_token is null then
    new.client_token = encode(gen_random_bytes(16), 'hex');
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_client_token_if_missing"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_context"("org_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    BEGIN
      -- Set the organization context for this session
      PERFORM set_config('app.organization_id', org_id::text, false);
    END;
    $$;


ALTER FUNCTION "public"."set_organization_context"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_rls_context"("p_organization_id" "uuid") RETURNS "void"
    LANGUAGE "sql"
    AS $$
  select set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
$$;


ALTER FUNCTION "public"."set_rls_context"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."setup_crm_database"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Função stub que retorna sucesso
  -- Pode ser expandida no futuro para criar:
  -- - Estágios padrão do CRM (crm_stages)
  -- - Serviços padrão (produtos_servicos)
  -- - Outras configurações iniciais
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'CRM database setup completed'
  );
END;
$$;


ALTER FUNCTION "public"."setup_crm_database"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."setup_crm_database"() IS 'Stub function for CRM database setup. Called when organization is created/selected. Returns success to avoid 404 errors.';



CREATE OR REPLACE FUNCTION "public"."sync_appointment_consultation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    BEGIN
        -- Se uma consulta é criada ou atualizada, atualiza o status do agendamento
        IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
            UPDATE public.appointments
            SET status = CASE
                WHEN NEW.status = 'completed' THEN 'realizado'
                WHEN NEW.status = 'cancelled' THEN 'cancelado'
                WHEN NEW.status = 'no-show' THEN 'cancelado' -- Ou um status específico para falta
                ELSE 'agendado'
            END
            WHERE id = NEW.appointment_id;
        END IF;
        RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."sync_appointment_consultation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."test_automation_trigger"("p_event_type" "text", "p_organization_id" "uuid", "p_test_data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Disparar evento de teste
  PERFORM notify_automation_event(
    p_event_type,
    p_organization_id,
    jsonb_build_object(
      'test_mode', true,
      'test_data', p_test_data,
      'triggered_by', 'manual_test',
      'timestamp', now()
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Trigger de teste disparado com sucesso',
    'event_type', p_event_type,
    'organization_id', p_organization_id,
    'timestamp', now()
  );
END;
$$;


ALTER FUNCTION "public"."test_automation_trigger"("p_event_type" "text", "p_organization_id" "uuid", "p_test_data" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."test_automation_trigger"("p_event_type" "text", "p_organization_id" "uuid", "p_test_data" "jsonb") IS 'Testa triggers de automação manualmente';



CREATE OR REPLACE FUNCTION "public"."test_n8n_connection"("p_organization_id" "uuid", "p_n8n_url" "text", "p_api_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result jsonb;
BEGIN
  -- This is a placeholder function
  -- In a real implementation, you would make HTTP requests to N8N API
  -- For now, we'll just validate the URL format and return success
  
  IF p_n8n_url IS NULL OR p_n8n_url = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'N8N URL is required'
    );
  END IF;
  
  IF p_api_key IS NULL OR p_api_key = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'API key is required'
    );
  END IF;
  
  -- Simulate successful connection test
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Connection test successful',
    'timestamp', now()
  );
END;
$$;


ALTER FUNCTION "public"."test_n8n_connection"("p_organization_id" "uuid", "p_n8n_url" "text", "p_api_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."test_webhook_configuration"("p_webhook_config_id" "uuid", "p_test_data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  webhook_config record;
  test_payload jsonb;
BEGIN
  -- Buscar configuração
  SELECT * INTO webhook_config FROM webhook_configurations WHERE id = p_webhook_config_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Webhook configuration not found');
  END IF;
  
  -- Preparar payload de teste
  test_payload := jsonb_build_object(
    'event_type', 'test_webhook',
    'organization_id', webhook_config.organization_id,
    'timestamp', now(),
    'test_data', p_test_data,
    'webhook_config', jsonb_build_object(
      'id', webhook_config.id,
      'name', webhook_config.name
    )
  );
  
  -- Registrar evento de teste
  INSERT INTO webhook_events (
    organization_id,
    webhook_config_id,
    event_type,
    event_data,
    webhook_url,
    request_payload,
    status
  ) VALUES (
    webhook_config.organization_id,
    webhook_config.id,
    'test_webhook',
    p_test_data,
    webhook_config.webhook_url,
    test_payload,
    'pending'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Teste de webhook iniciado',
    'payload', test_payload
  );
END;
$$;


ALTER FUNCTION "public"."test_webhook_configuration"("p_webhook_config_id" "uuid", "p_test_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trail_notes_delete"("p_organization_id" "uuid", "p_trail_type" "text", "p_lesson_key" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_deleted int;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  DELETE FROM public.trail_notes
  WHERE organization_id = p_organization_id
    AND trail_type = p_trail_type
    AND lesson_key = p_lesson_key;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN v_deleted > 0;
END;
$$;


ALTER FUNCTION "public"."trail_notes_delete"("p_organization_id" "uuid", "p_trail_type" "text", "p_lesson_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trail_notes_get"("p_organization_id" "uuid", "p_trail_type" "text", "p_lesson_key" "text") RETURNS TABLE("id" "uuid", "content" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  RETURN QUERY
  SELECT 
    tn.id,
    tn.content,
    tn.created_at,
    tn.updated_at
  FROM public.trail_notes tn
  WHERE tn.organization_id = p_organization_id
    AND tn.trail_type = p_trail_type
    AND tn.lesson_key = p_lesson_key
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."trail_notes_get"("p_organization_id" "uuid", "p_trail_type" "text", "p_lesson_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trail_notes_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trail_notes_set_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trail_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "trail_type" "text" NOT NULL,
    "lesson_key" "text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trail_notes_trail_type_check" CHECK (("trail_type" = ANY (ARRAY['monetization'::"text", 'n8n'::"text", 'multi-agents'::"text"])))
);


ALTER TABLE "public"."trail_notes" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trail_notes_upsert"("p_organization_id" "uuid", "p_trail_type" "text", "p_lesson_key" "text", "p_content" "text") RETURNS "public"."trail_notes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_row public.trail_notes;
BEGIN
  PERFORM set_config('app.organization_id', p_organization_id::text, true);
  
  INSERT INTO public.trail_notes (
    organization_id,
    trail_type,
    lesson_key,
    content
  )
  VALUES (
    p_organization_id,
    p_trail_type,
    p_lesson_key,
    COALESCE(p_content, '')
  )
  ON CONFLICT (organization_id, trail_type, lesson_key) 
  DO UPDATE SET
    content = EXCLUDED.content,
    updated_at = now()
  RETURNING * INTO v_row;
  
  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."trail_notes_upsert"("p_organization_id" "uuid", "p_trail_type" "text", "p_lesson_key" "text", "p_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_auto_convert_on_close"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'UPDATE' then
    -- only when stage actually changed to a closed state
    if coalesce(old.stage, '') is distinct from coalesce(new.stage, '') then
      if lower(coalesce(new.stage, '')) in ('fechado', 'fechado ganho', 'ganho', 'venda fechada') then
        -- Avoid double work if already converted
        if new.converted_client_id is null then
          -- Perform conversion but DO NOT change show_in_kanban
          -- The conversion will happen, but the lead stays visible in Kanban
          perform public.convert_lead_to_client_auto(new.id);
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_auto_convert_on_close"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_crm_leads_fix_stage_case"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_name text;
begin
  if new.stage is null or trim(new.stage) = '' then
    return new;
  end if;

  select s.name into v_name
  from public.crm_stages s
  where s.organization_id = new.organization_id
    and lower(s.name) = lower(new.stage)
  limit 1;

  if v_name is not null then
    new.stage := v_name;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."trg_crm_leads_fix_stage_case"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_entradas_from_clients"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.upsert_entrada_for_client_valor_pago(new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_entradas_from_clients"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_entradas_from_clients_del"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_entrada_id uuid; begin
  select entrada_id into v_entrada_id
    from public.entradas_source_links
   where organization_id = old.organization_id
     and source_type = 'client_valor_pago'
     and source_id = old.id;
  if v_entrada_id is not null then
    delete from public.entradas where id = v_entrada_id;
  end if;
  return old;
end;$$;


ALTER FUNCTION "public"."trg_entradas_from_clients_del"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_entradas_from_leads"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.upsert_entrada_for_lead_payment(new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_entradas_from_leads"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_entradas_from_leads_del"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_entrada_id uuid; begin
  select entrada_id into v_entrada_id
    from public.entradas_source_links
   where organization_id = old.organization_id
     and source_type = 'lead_payment'
     and source_id = old.id;
  if v_entrada_id is not null then
    delete from public.entradas where id = v_entrada_id;
  end if;
  return old;
end;$$;


ALTER FUNCTION "public"."trg_entradas_from_leads_del"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_entradas_from_pagamentos"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.upsert_entrada_for_pagamento(new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_entradas_from_pagamentos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_entradas_from_pagamentos_del"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_entrada_id uuid;
begin
  select entrada_id into v_entrada_id
    from public.entradas_source_links
   where organization_id = old.organization_id
     and source_type = 'pagamento'
     and source_id = old.id;
  if v_entrada_id is not null then
    delete from public.entradas where id = v_entrada_id;
  end if;
  return old;
end;
$$;


ALTER FUNCTION "public"."trg_entradas_from_pagamentos_del"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_recalc_lead_value"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.recalc_lead_value(coalesce(new.lead_id, old.lead_id));
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_recalc_lead_value"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_recalc_lead_value_on_interest"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op in ('INSERT','UPDATE') then
    perform public.recalc_lead_value_by_interest(new.id);
  end if;
  return new;
end; $$;


ALTER FUNCTION "public"."trg_recalc_lead_value_on_interest"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_recalc_lead_value_on_leads"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op in ('INSERT','UPDATE') then
    perform public.recalc_lead_value(new.id);
  end if;
  return new;
end; $$;


ALTER FUNCTION "public"."trg_recalc_lead_value_on_leads"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_set_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_set_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_sync_client_payment_from_lead"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_client_id uuid;
begin
  if tg_op = 'UPDATE' then
    if (coalesce(old.payment_value,0) is distinct from coalesce(new.payment_value,0))
       or (coalesce(old.has_payment,false) is distinct from coalesce(new.has_payment,false)) then
      -- find matching client in same org by phone/email
      select id into v_client_id from public.clients c
      where c.organization_id = new.organization_id
        and (
          (new.whatsapp is not null and nullif(trim(new.whatsapp), '') is not null and c.telefone = trim(new.whatsapp))
          or (new.email is not null and nullif(trim(new.email), '') is not null and c.email = trim(new.email))
        )
      limit 1;
      if v_client_id is not null then
        update public.clients
        set valor_pago = case when coalesce(new.has_payment,false) then coalesce(new.payment_value,0) else 0 end
        where id = v_client_id;
      end if;
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_sync_client_payment_from_lead"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_appointment_created"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  client_data jsonb;
  professional_data jsonb;
BEGIN
  -- Buscar dados do cliente
  SELECT jsonb_build_object(
    'id', p.id,
    'nome', p.nome,
    'email', p.email,
    'telefone', p.telefone
  ) INTO client_data
  FROM patients p WHERE p.id = NEW.patient_id;
  
  -- Buscar dados do profissional
  SELECT jsonb_build_object(
    'id', pr.id,
    'name', pr.name,
    'email', pr.email,
    'phone', pr.phone,
    'specialty', pr.specialty
  ) INTO professional_data
  FROM professionals pr WHERE pr.id = NEW.professional_id;

  PERFORM notify_automation_event(
    'appointment_created',
    NEW.organization_id,
    jsonb_build_object(
      'appointment_id', NEW.id,
      'appointment_datetime', NEW.datetime,
      'appointment_duration', NEW.duration_minutes,
      'appointment_type', NEW.tipo,
      'appointment_status', NEW.status,
      'appointment_notes', NEW.anotacoes,
      'client', client_data,
      'professional', professional_data,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_appointment_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_appointment_status_changed"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  client_data jsonb;
  professional_data jsonb;
BEGIN
  -- Só notificar se status mudou
  IF OLD.status != NEW.status THEN
    -- Buscar dados relacionados
    SELECT jsonb_build_object(
      'id', p.id,
      'nome', p.nome,
      'email', p.email,
      'telefone', p.telefone
    ) INTO client_data
    FROM patients p WHERE p.id = NEW.patient_id;
    
    SELECT jsonb_build_object(
      'id', pr.id,
      'name', pr.name,
      'email', pr.email,
      'phone', pr.phone,
      'specialty', pr.specialty
    ) INTO professional_data
    FROM professionals pr WHERE pr.id = NEW.professional_id;

    PERFORM notify_automation_event(
      'appointment_status_changed',
      NEW.organization_id,
      jsonb_build_object(
        'appointment_id', NEW.id,
        'appointment_datetime', NEW.datetime,
        'appointment_type', NEW.tipo,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'client', client_data,
        'professional', professional_data,
        'updated_at', NEW.updated_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_appointment_status_changed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_automation_on_client_created"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Enviar para webhooks ativos
  PERFORM pg_notify('automation_event', json_build_object(
    'event_type', 'client_created',
    'data', row_to_json(NEW)
  )::text);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_automation_on_client_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_client_created"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM notify_automation_event(
    'client_created',
    NEW.organization_id,
    jsonb_build_object(
      'client_id', NEW.id,
      'client_name', NEW.nome,
      'client_email', NEW.email,
      'client_phone', NEW.telefone,
      'client_birth_date', NEW.nascimento,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_client_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_client_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Só notificar se houve mudança significativa
  IF OLD.nome != NEW.nome OR OLD.email != NEW.email OR OLD.telefone != NEW.telefone THEN
    PERFORM notify_automation_event(
      'client_updated',
      NEW.organization_id,
      jsonb_build_object(
        'client_id', NEW.id,
        'client_name', NEW.nome,
        'client_email', NEW.email,
        'client_phone', NEW.telefone,
        'changes', jsonb_build_object(
          'old_name', OLD.nome,
          'new_name', NEW.nome,
          'old_email', OLD.email,
          'new_email', NEW.email,
          'old_phone', OLD.telefone,
          'new_phone', NEW.telefone
        ),
        'updated_at', NEW.updated_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_client_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_consultation_completed"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  client_data jsonb;
  professional_data jsonb;
BEGIN
  -- Só notificar consultas completadas
  IF NEW.status = 'completed' THEN
    -- Buscar dados relacionados
    SELECT jsonb_build_object(
      'id', p.id,
      'nome', p.nome,
      'email', p.email,
      'telefone', p.telefone
    ) INTO client_data
    FROM patients p WHERE p.id = NEW.patient_id;
    
    SELECT jsonb_build_object(
      'id', pr.id,
      'name', pr.name,
      'email', pr.email,
      'phone', pr.phone,
      'specialty', pr.specialty
    ) INTO professional_data
    FROM professionals pr WHERE pr.id = NEW.professional_id;

    PERFORM notify_automation_event(
      'consultation_completed',
      NEW.organization_id,
      jsonb_build_object(
        'consultation_id', NEW.id,
        'consultation_date', NEW.date,
        'consultation_type', NEW.type,
        'consultation_notes', NEW.notes,
        'consultation_prescription', NEW.prescription,
        'client', client_data,
        'professional', professional_data,
        'created_at', NEW.created_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_consultation_completed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_lead_created"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM notify_automation_event(
    'lead_created',
    NEW.organization_id,
    jsonb_build_object(
      'lead_id', NEW.id,
      'lead_name', NEW.name,
      'lead_email', NEW.email,
      'lead_whatsapp', NEW.whatsapp,
      'lead_stage', NEW.stage,
      'lead_value', NEW.value,
      'lead_priority', NEW.priority,
      'lead_source', NEW.source,
      'lead_canal', NEW.canal,
      'lead_description', NEW.description,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_lead_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_lead_stage_changed"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Notificar mudança de estágio
  IF OLD.stage != NEW.stage THEN
    PERFORM notify_automation_event(
      'lead_stage_changed',
      NEW.organization_id,
      jsonb_build_object(
        'lead_id', NEW.id,
        'lead_name', NEW.name,
        'lead_email', NEW.email,
        'lead_whatsapp', NEW.whatsapp,
        'lead_value', NEW.value,
        'lead_priority', NEW.priority,
        'lead_source', NEW.source,
        'lead_canal', NEW.canal,
        'old_stage', OLD.stage,
        'new_stage', NEW.stage,
        'has_payment', NEW.has_payment,
        'payment_value', NEW.payment_value,
        'updated_at', NEW.updated_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_lead_stage_changed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_notification_created"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM notify_automation_event(
    'notification_created',
    NEW.organization_id,
    jsonb_build_object(
      'notification_id', NEW.id,
      'notification_type', NEW.tipo,
      'notification_message', NEW.mensagem,
      'user_id', NEW.user_id,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_notification_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_payment_received"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  client_data jsonb;
  service_data jsonb;
BEGIN
  -- Só notificar pagamentos confirmados
  IF NEW.status = 'confirmado' THEN
    -- Buscar dados do cliente
    SELECT jsonb_build_object(
      'id', p.id,
      'nome', p.nome,
      'email', p.email,
      'telefone', p.telefone
    ) INTO client_data
    FROM patients p WHERE p.id = NEW.paciente_id;
    
    -- Buscar dados do serviço (se houver)
    SELECT jsonb_build_object(
      'id', s.id,
      'nome', s.nome,
      'categoria', s.categoria,
      'preco_padrao', s.preco_padrao
    ) INTO service_data
    FROM servicos s WHERE s.id = NEW.servico_id;

    PERFORM notify_automation_event(
      'payment_received',
      NEW.organization_id,
      jsonb_build_object(
        'payment_id', NEW.id,
        'payment_value', NEW.valor,
        'payment_method', NEW.metodo,
        'payment_date', NEW.data_pagamento,
        'client', client_data,
        'service', service_data,
        'created_at', NEW.created_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_payment_received"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_webhook_event"("p_organization_id" "uuid", "p_event_type" "text", "p_event_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  cfg record;
  total_triggered integer := 0;
begin
  for cfg in
    select *
    from public.webhook_configurations
    where is_active = true
      and organization_id = p_organization_id
      and (event_types @> array[p_event_type]::text[])
  loop
    insert into public.webhook_events (
      organization_id,
      webhook_config_id,
      event_type,
      event_data,
      webhook_url,
      request_payload,
      status,
      created_at
    ) values (
      p_organization_id,
      cfg.id,
      p_event_type,
      p_event_data,
      cfg.webhook_url,
      jsonb_build_object(
        'event_type', p_event_type,
        'organization_id', p_organization_id,
        'timestamp', now(),
        'data', p_event_data
      ),
      'pending',
      now()
    );
    total_triggered := total_triggered + 1;
  end loop;

  return jsonb_build_object('triggered', total_triggered);
exception when others then
  raise notice 'Error in trigger_webhook_event: %', sqlerrm;
  return jsonb_build_object('triggered', total_triggered, 'error', sqlerrm);
end;
$$;


ALTER FUNCTION "public"."trigger_webhook_event"("p_organization_id" "uuid", "p_event_type" "text", "p_event_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."try_advisory_lock"("p" "text") RETURNS boolean
    LANGUAGE "sql"
    AS $$
  select pg_try_advisory_lock(public.advisory_key(p))
$$;


ALTER FUNCTION "public"."try_advisory_lock"("p" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tutorial_manychat_progress" (
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "step_id" "text" NOT NULL,
    "completed" boolean DEFAULT true NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tutorial_manychat_progress" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tutorial_manychat_progress_list"("p_organization_id" "uuid", "p_user_id" "uuid") RETURNS SETOF "public"."tutorial_manychat_progress"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
begin
  perform set_config('app.organization_id', p_organization_id::text, true);
  return query
  select * from public.tutorial_manychat_progress
  where organization_id = p_organization_id and user_id = p_user_id
  order by step_id asc;
end;
$$;


ALTER FUNCTION "public"."tutorial_manychat_progress_list"("p_organization_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tutorial_manychat_progress_upsert"("p_organization_id" "uuid", "p_user_id" "uuid", "p_step_id" "text", "p_completed" boolean DEFAULT true) RETURNS "public"."tutorial_manychat_progress"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_row public.tutorial_manychat_progress;
begin
  perform set_config('app.organization_id', p_organization_id::text, true);

  insert into public.tutorial_manychat_progress (organization_id, user_id, step_id, completed, completed_at)
  values (p_organization_id, p_user_id, p_step_id, coalesce(p_completed, true), case when coalesce(p_completed, true) then now() else null end)
  on conflict (organization_id, user_id, step_id) do update
    set completed = excluded.completed,
        completed_at = case when excluded.completed then now() else null end,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."tutorial_manychat_progress_upsert"("p_organization_id" "uuid", "p_user_id" "uuid", "p_step_id" "text", "p_completed" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_appointments_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_appointments_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_n8n_credentials_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_n8n_credentials_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_professional_stats_on_appointment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    BEGIN
        -- Atualiza total_consultations e consultations_this_month para o profissional
        UPDATE public.professionals
        SET
            total_consultations = (SELECT COUNT(*) FROM public.appointments WHERE professional_id = NEW.professional_id AND status = 'realizado'),
            consultations_this_month = (SELECT COUNT(*) FROM public.appointments WHERE professional_id = NEW.professional_id AND status = 'realizado' AND EXTRACT(MONTH FROM datetime) = EXTRACT(MONTH FROM NOW()) AND EXTRACT(YEAR FROM datetime) = EXTRACT(YEAR FROM NOW())),
            upcoming_appointments = (SELECT COUNT(*) FROM public.appointments WHERE professional_id = NEW.professional_id AND status = 'agendado' AND datetime > NOW())
        WHERE id = NEW.professional_id;
    
        RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."update_professional_stats_on_appointment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_entrada_for_client_valor_pago"("p_client_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r record;
  v_entrada_id uuid;
  v_lead_entrada_id uuid;
  v_lead_link_id uuid;
  v_lead_id uuid;
begin
  select * into r from public.clients where id = p_client_id;
  if not found then
    return;
  end if;
  if r.organization_id is null then
    return;
  end if;

  -- Check if there's a lead entry that should be migrated to this client
  -- This handles the case where a lead was converted but the migration didn't happen
  select esl.entrada_id, esl.id, esl.source_id into v_lead_entrada_id, v_lead_link_id, v_lead_id
  from public.entradas_source_links esl
  join public.crm_leads l on l.id = esl.source_id
  where esl.organization_id = r.organization_id
    and esl.source_type = 'lead_payment'
    and l.converted_client_id = p_client_id
    and coalesce(l.has_payment, false) = true
    and coalesce(l.payment_value, 0) > 0
  limit 1;

  if coalesce(r.valor_pago, 0) > 0 then
    -- Check if client already has a financial entry
    select entrada_id into v_entrada_id
    from public.entradas_source_links
    where organization_id = r.organization_id
      and source_type = 'client_valor_pago'
      and source_id = p_client_id;

    if v_entrada_id is null then
      -- If there's a lead entry, migrate it instead of creating a new one
      if v_lead_entrada_id is not null then
        -- Migrate lead entry to client
        update public.entradas_source_links
        set source_type = 'client_valor_pago',
            source_id = p_client_id,
            updated_at = now()
        where id = v_lead_link_id;

        -- Update the entrada
        update public.entradas
        set descricao = coalesce('Cliente pagante: ' || nullif(trim(r.nome), ''), 'Cliente pagante'),
            valor = r.valor_pago,
            categoria = 'Vendas',
            data_entrada = now(),
            metodo_pagamento = 'dinheiro',
            cliente_id = r.id,
            observacoes = 'origem: client_valor_pago/' || p_client_id::text
        where id = v_lead_entrada_id;
      else
        -- Create new entry for client
        insert into public.entradas (
          organization_id, descricao, valor, categoria, data_entrada,
          metodo_pagamento, cliente_id, produto_servico_id, observacoes
        ) values (
          r.organization_id,
          coalesce('Cliente pagante: ' || nullif(trim(r.nome), ''), 'Cliente pagante'),
          r.valor_pago,
          'Vendas',
          now(),
          'dinheiro',
          r.id,
          null,
          'origem: client_valor_pago/' || p_client_id::text
        ) returning id into v_entrada_id;

        insert into public.entradas_source_links (organization_id, source_type, source_id, entrada_id)
        values (r.organization_id, 'client_valor_pago', p_client_id, v_entrada_id);
      end if;
    else
      -- Update existing entry
      update public.entradas
      set descricao = coalesce('Cliente pagante: ' || nullif(trim(r.nome), ''), 'Cliente pagante'),
          valor = r.valor_pago,
          categoria = 'Vendas',
          data_entrada = now(),
          metodo_pagamento = 'dinheiro',
          cliente_id = r.id
      where id = v_entrada_id;

      -- If there's a lead entry that wasn't migrated, delete it to avoid duplication
      if v_lead_entrada_id is not null and v_lead_entrada_id != v_entrada_id then
        delete from public.entradas where id = v_lead_entrada_id;
        delete from public.entradas_source_links where id = v_lead_link_id;
      end if;
    end if;
  else
    -- Remove entrada if valor_pago is 0
    select entrada_id into v_entrada_id
    from public.entradas_source_links
    where organization_id = r.organization_id
      and source_type = 'client_valor_pago'
      and source_id = p_client_id;
    if v_entrada_id is not null then
      delete from public.entradas where id = v_entrada_id;
    end if;
  end if;
end;
$$;


ALTER FUNCTION "public"."upsert_entrada_for_client_valor_pago"("p_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_entrada_for_lead_payment"("p_lead_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r record;
  v_entrada_id uuid;
  v_product_id uuid;
begin
  select * into r from public.crm_leads where id = p_lead_id;
  if not found then return; end if;
  if r.organization_id is null then return; end if;

  -- Preferred: explicit sold product
  v_product_id := r.sold_produto_servico_id;

  -- Fallback: interest product
  if v_product_id is null then
    v_product_id := r.interest_produto_servico_id;
  end if;

  if coalesce(r.has_payment, false) = true and coalesce(r.payment_value, 0) > 0 then
    select entrada_id into v_entrada_id
      from public.entradas_source_links
     where organization_id = r.organization_id
       and source_type = 'lead_payment'
       and source_id = p_lead_id;

    if v_entrada_id is null then
      insert into public.entradas (
        organization_id, descricao, valor, categoria, data_entrada,
        metodo_pagamento, cliente_id, produto_servico_id, observacoes
      ) values (
        r.organization_id,
        coalesce('Pagamento lead: ' || nullif(trim(r.name), ''), 'Pagamento lead'),
        r.payment_value,
        'Vendas',
        now(),
        'dinheiro',
        null,
        v_product_id,
        'origem: lead_payment/' || p_lead_id::text
      ) returning id into v_entrada_id;

      insert into public.entradas_source_links (organization_id, source_type, source_id, entrada_id)
      values (r.organization_id, 'lead_payment', p_lead_id, v_entrada_id);
    else
      update public.entradas
         set descricao = coalesce('Pagamento lead: ' || nullif(trim(r.name), ''), 'Pagamento lead'),
             valor = r.payment_value,
             categoria = 'Vendas',
             data_entrada = now(),
             metodo_pagamento = 'dinheiro',
             produto_servico_id = v_product_id
       where id = v_entrada_id;
    end if;
  else
    -- Remove if no longer valid
    select entrada_id into v_entrada_id
      from public.entradas_source_links
     where organization_id = r.organization_id
       and source_type = 'lead_payment'
       and source_id = p_lead_id;
    if v_entrada_id is not null then
      delete from public.entradas where id = v_entrada_id;
    end if;
  end if;
end;
$$;


ALTER FUNCTION "public"."upsert_entrada_for_lead_payment"("p_lead_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_entrada_for_pagamento"("p_pagamento_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r record;
  v_entrada_id uuid;
  v_categoria text;
  v_metodo text;
  v_descricao text;
  v_prod_id uuid;
  v_cliente_id uuid;
begin
  select p.*, c.nome as cliente_nome,
         ps.nome as produto_nome,
         ps.categoria as ps_categoria,
         ps.tipo as ps_tipo,
         ps.tipo_cobranca as ps_tipo_cobranca,
         ps.cobranca_tipo as ps_cobranca_tipo
    into r
    from public.pagamentos p
    left join public.clients c on c.id = p.client_id
    left join public.produtos_servicos ps on ps.id = p.servico_id
   where p.id = p_pagamento_id;

  if not found then
    return;
  end if;

  -- Require organization_id and positive valor
  if r.organization_id is null or coalesce(r.valor, 0) <= 0 then
    return;
  end if;

  -- If not confirmed, remove any existing entrada for this pagamento
  if r.status is distinct from 'confirmado' then
    select entrada_id into v_entrada_id
      from public.entradas_source_links
     where organization_id = r.organization_id
       and source_type = 'pagamento'
       and source_id = p_pagamento_id;
    if v_entrada_id is not null then
      delete from public.entradas where id = v_entrada_id;
    end if;
    return;
  end if;

  v_metodo := public.map_pagamento_metodo_to_entradas(r.metodo);
  v_categoria := public.map_produto_categoria_to_entrada_categoria(r.ps_categoria, r.ps_tipo, r.ps_tipo_cobranca, r.ps_cobranca_tipo);
  v_descricao := coalesce('Pagamento ' || v_metodo || coalesce(' - ' || r.produto_nome, ''), 'Pagamento');
  v_cliente_id := r.client_id;
  v_prod_id := r.servico_id;

  select entrada_id into v_entrada_id
    from public.entradas_source_links
   where organization_id = r.organization_id
     and source_type = 'pagamento'
     and source_id = p_pagamento_id;

  if v_entrada_id is null then
    insert into public.entradas (
      organization_id, descricao, valor, categoria, data_entrada,
      metodo_pagamento, cliente_id, produto_servico_id, observacoes
    ) values (
      r.organization_id,
      v_descricao,
      r.valor,
      v_categoria,
      coalesce(r.data_pagamento, now()),
      v_metodo,
      v_cliente_id,
      v_prod_id,
      'origem: pagamento/' || p_pagamento_id::text
    ) returning id into v_entrada_id;

    insert into public.entradas_source_links (organization_id, source_type, source_id, entrada_id)
    values (r.organization_id, 'pagamento', p_pagamento_id, v_entrada_id);
  else
    update public.entradas
       set descricao = v_descricao,
           valor = r.valor,
           categoria = v_categoria,
           data_entrada = coalesce(r.data_pagamento, now()),
           metodo_pagamento = v_metodo,
           cliente_id = v_cliente_id,
           produto_servico_id = v_prod_id
     where id = v_entrada_id;
  end if;
end;
$$;


ALTER FUNCTION "public"."upsert_entrada_for_pagamento"("p_pagamento_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."uuid_or_null"("p_text" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare v text; begin
  if p_text is null then return null; end if;
  v := nullif(trim(p_text), '');
  if v is null then return null; end if;
  begin
    return v::uuid;
  exception when others then
    return null; -- se não for uuid válido, retorna NULL
  end;
end $$;


ALTER FUNCTION "public"."uuid_or_null"("p_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."webhook_trigger_appointment_created"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  client_data jsonb;
  professional_data jsonb;
begin
  -- Related entities
  select row_to_json(c) into client_data from public.clients c where c.id = new.client_id;
  select row_to_json(co) into professional_data from public.collaborators co where co.id = new.collaborator_id;

  perform public.trigger_webhook_event(
    new.organization_id,
    'appointment_created',
    jsonb_build_object(
      'appointment', row_to_json(new),
      'client', client_data,
      'professional', professional_data,
      'timestamp', now()
    )
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."webhook_trigger_appointment_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."webhook_trigger_appointment_status_changed"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  client_data jsonb;
  professional_data jsonb;
begin
  if old.status is distinct from new.status then
    select row_to_json(c) into client_data from public.clients c where c.id = new.client_id;
    select row_to_json(co) into professional_data from public.collaborators co where co.id = new.collaborator_id;

    perform public.trigger_webhook_event(
      new.organization_id,
      'appointment_status_changed',
      jsonb_build_object(
        'appointment', row_to_json(new),
        'client', client_data,
        'professional', professional_data,
        'old_status', old.status,
        'new_status', new.status,
        'timestamp', now()
      )
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."webhook_trigger_appointment_status_changed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."webhook_trigger_appointment_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if (
    old.datetime is distinct from new.datetime or
    old.client_id is distinct from new.client_id or
    old.collaborator_id is distinct from new.collaborator_id or
    old.tipo is distinct from new.tipo or
    old.anotacoes is distinct from new.anotacoes or
    coalesce(old.title, '') is distinct from coalesce(new.title, '')
  ) then
    perform public.trigger_webhook_event(
      new.organization_id,
      'appointment_updated',
      jsonb_build_object(
        'appointment', row_to_json(new),
        'timestamp', now()
      )
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."webhook_trigger_appointment_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."webhook_trigger_client_created"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM trigger_webhook_event(
    NEW.organization_id,
    'client_created',
    jsonb_build_object(
      'client', row_to_json(NEW),
      'timestamp', now()
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."webhook_trigger_client_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."webhook_trigger_client_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.trigger_webhook_event(
    new.organization_id,
    'client_updated',
    jsonb_build_object('client', row_to_json(new), 'timestamp', now())
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."webhook_trigger_client_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."webhook_trigger_collaborator_created"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.trigger_webhook_event(
    new.organization_id,
    'collaborator_created',
    jsonb_build_object('collaborator', row_to_json(new), 'timestamp', now())
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."webhook_trigger_collaborator_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."webhook_trigger_collaborator_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.trigger_webhook_event(
    new.organization_id,
    'collaborator_updated',
    jsonb_build_object('collaborator', row_to_json(new), 'timestamp', now())
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."webhook_trigger_collaborator_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."webhook_trigger_lead_converted"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if old.converted_client_id is null and new.converted_client_id is not null then
    perform public.trigger_webhook_event(
      new.organization_id,
      'lead_converted',
      jsonb_build_object('lead', row_to_json(new), 'client_id', new.converted_client_id, 'timestamp', now())
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."webhook_trigger_lead_converted"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."webhook_trigger_lead_created"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.trigger_webhook_event(
    new.organization_id,
    'lead_created',
    jsonb_build_object('lead', row_to_json(new), 'timestamp', now())
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."webhook_trigger_lead_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."webhook_trigger_lead_stage_changed"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if old.stage is distinct from new.stage then
    perform public.trigger_webhook_event(
      new.organization_id,
      'lead_stage_changed',
      jsonb_build_object('lead', row_to_json(new), 'old_stage', old.stage, 'new_stage', new.stage, 'timestamp', now())
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."webhook_trigger_lead_stage_changed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."webhook_trigger_lead_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.trigger_webhook_event(
    new.organization_id,
    'lead_updated',
    jsonb_build_object('lead', row_to_json(new), 'timestamp', now())
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."webhook_trigger_lead_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."webhook_trigger_payment_received"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if (tg_op = 'INSERT' and new.status = 'confirmado') or (tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'confirmado') then
    perform public.trigger_webhook_event(
      new.organization_id,
      'payment_received',
      jsonb_build_object('payment', row_to_json(new), 'timestamp', now())
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."webhook_trigger_payment_received"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."webhook_trigger_product_created"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.trigger_webhook_event(
    new.organization_id,
    'product_created',
    jsonb_build_object('product', row_to_json(new), 'timestamp', now())
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."webhook_trigger_product_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."webhook_trigger_product_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.trigger_webhook_event(
    new.organization_id,
    'product_updated',
    jsonb_build_object('product', row_to_json(new), 'timestamp', now())
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."webhook_trigger_product_updated"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_agent_metrics_daily_agg" (
    "organization_id" "uuid" NOT NULL,
    "day" "date" NOT NULL,
    "messages_total" bigint NOT NULL,
    "users_attended" bigint NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_agent_metrics_daily_agg" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "agent_name" "text" NOT NULL,
    "interaction_type" "text" NOT NULL,
    "input_data" "jsonb" DEFAULT '{}'::"jsonb",
    "output_data" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'processing'::"text",
    "error_message" "text",
    "execution_time_ms" integer,
    "webhook_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ai_interactions_status_check" CHECK (("status" = ANY (ARRAY['processing'::"text", 'completed'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."ai_interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ingested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_ts" timestamp with time zone,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "uuid",
    "event_name" "text" NOT NULL,
    "module" "text" NOT NULL,
    "source" "text" NOT NULL,
    "context_route" "text",
    "feature_key" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "analytics_events_source_check" CHECK (("source" = ANY (ARRAY['ui'::"text", 'automation'::"text", 'api'::"text"])))
);


ALTER TABLE "public"."analytics_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_migrations" (
    "version" "text" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."app_migrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "datetime" timestamp with time zone NOT NULL,
    "duration_minutes" integer DEFAULT 30,
    "tipo" "text",
    "status" "text" DEFAULT 'agendado'::"text",
    "criado_por" "uuid",
    "anotacoes" "text",
    "arquivos" "text"[],
    "valor_consulta" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "client_id" "uuid",
    "collaborator_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lead_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "professional_id" "uuid" GENERATED ALWAYS AS ("collaborator_id") STORED,
    "title" "text",
    "patient_id" "uuid" GENERATED ALWAYS AS ("client_id") STORED,
    CONSTRAINT "appointments_client_or_lead_chk" CHECK (((("client_id" IS NOT NULL) AND ("lead_id" IS NULL)) OR (("client_id" IS NULL) AND ("lead_id" IS NOT NULL)))),
    CONSTRAINT "appointments_status_check" CHECK (("status" = ANY (ARRAY['agendado'::"text", 'realizado'::"text", 'cancelado'::"text"])))
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."appointments"."tipo" IS 'Tipo livre do agendamento (texto). Pode ser NULL. Qualquer valor é aceito.';



COMMENT ON COLUMN "public"."appointments"."professional_id" IS 'Compatibility alias for collaborator_id (generated column). Used by legacy triggers/functions.';



COMMENT ON COLUMN "public"."appointments"."title" IS 'Optional event title for calendar cards.';



COMMENT ON COLUMN "public"."appointments"."patient_id" IS 'Compatibility alias for client_id (generated column). Used by legacy triggers/functions.';



CREATE OR REPLACE VIEW "public"."appointments_api" AS
 SELECT "id",
    ("organization_id")::"text" AS "organization_id",
    "datetime",
    "duration_minutes",
    "tipo",
    "status",
    ("criado_por")::"text" AS "criado_por",
    "anotacoes",
    "arquivos",
    "valor_consulta",
    "created_at",
    ("client_id")::"text" AS "client_id",
    ("lead_id")::"text" AS "lead_id",
    ("collaborator_id")::"text" AS "collaborator_id",
    "title",
    "updated_at"
   FROM "public"."appointments" "a";


ALTER VIEW "public"."appointments_api" OWNER TO "postgres";


COMMENT ON VIEW "public"."appointments_api" IS 'Fachada tolerante para criar/atualizar appointments via PostgREST (Create Row). Converte ""→NULL e faz cast text→uuid nas regras.';



CREATE TABLE IF NOT EXISTS "public"."automation_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "processed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."automation_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."automation_events" IS 'Log de todos os eventos que podem disparar automações';



COMMENT ON COLUMN "public"."automation_events"."event_type" IS 'Tipo do evento: client_created, appointment_created, etc.';



COMMENT ON COLUMN "public"."automation_events"."event_data" IS 'Dados do evento em formato JSON';



COMMENT ON COLUMN "public"."automation_events"."processed" IS 'Se o evento foi processado por alguma automação';



CREATE TABLE IF NOT EXISTS "public"."automation_executions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "workflow_id" "text",
    "trigger_event" "text" NOT NULL,
    "trigger_data" "jsonb" DEFAULT '{}'::"jsonb",
    "webhook_payload" "jsonb" DEFAULT '{}'::"jsonb",
    "webhook_response" "jsonb" DEFAULT '{}'::"jsonb",
    "execution_time_ms" integer DEFAULT 0,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "automation_executions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'success'::"text", 'failed'::"text", 'timeout'::"text"])))
);


ALTER TABLE "public"."automation_executions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "appointment_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "all_day" boolean DEFAULT false,
    "color" "text" DEFAULT '#3b82f6'::"text",
    "location" "text",
    "attendees" "text"[] DEFAULT '{}'::"text"[],
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "source" "text" DEFAULT 'manual'::"text",
    "external_id" "text",
    "sync_status" "text" DEFAULT 'synced'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "calendar_events_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'n8n'::"text", 'ai_agent'::"text", 'import'::"text"]))),
    CONSTRAINT "calendar_events_sync_status_check" CHECK (("sync_status" = ANY (ARRAY['synced'::"text", 'pending'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."calendar_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "nome" "text" NOT NULL,
    "email" "text",
    "telefone" "text" NOT NULL,
    "nascimento" "date",
    "documentos" "text",
    "endereco" "text",
    "observacoes" "text",
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "valor_pago" numeric(10,2) DEFAULT 0
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clients"."nascimento" IS 'Data de nascimento do cliente. Campo opcional.';



CREATE TABLE IF NOT EXISTS "public"."collaborators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "position" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "credentials" "text",
    "notes" "text",
    "active" boolean DEFAULT true,
    "total_consultations" integer DEFAULT 0,
    "consultations_this_month" integer DEFAULT 0,
    "upcoming_appointments" integer DEFAULT 0,
    "average_rating" numeric(3,2) DEFAULT 4.5,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."collaborators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consultations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "appointment_id" "uuid",
    "date" timestamp with time zone NOT NULL,
    "type" "text" DEFAULT 'consulta'::"text",
    "notes" "text",
    "prescription" "text",
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'completed'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "client_id" "uuid",
    "collaborator_id" "uuid",
    "patient_id" "uuid" GENERATED ALWAYS AS ("client_id") STORED,
    "professional_id" "uuid" GENERATED ALWAYS AS ("collaborator_id") STORED,
    CONSTRAINT "consultations_status_check" CHECK (("status" = ANY (ARRAY['completed'::"text", 'cancelled'::"text", 'no-show'::"text"]))),
    CONSTRAINT "consultations_type_check" CHECK (("type" = ANY (ARRAY['consulta'::"text", 'retorno'::"text", 'exame'::"text"])))
);


ALTER TABLE "public"."consultations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."consultations"."patient_id" IS 'Compatibility alias for client_id (legacy)';



COMMENT ON COLUMN "public"."consultations"."professional_id" IS 'Compatibility alias for collaborator_id (legacy)';



CREATE TABLE IF NOT EXISTS "public"."saas_organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "address" "text",
    "cnpj" "text",
    "logo_url" "text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "plan_type" "text" DEFAULT 'trial'::"text",
    "plan_limits" "jsonb" DEFAULT '{"users": 2, "patients": 50, "storage_gb": 0.5, "appointments_per_month": 100}'::"jsonb",
    "trial_ends_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "owner_name" "text",
    "owner_email" "text",
    "client_token" "text"
);


ALTER TABLE "public"."saas_organizations" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."crm_funnel" AS
 SELECT "so"."id" AS "organization_id",
    "so"."name" AS "organization_name",
    "count"(
        CASE
            WHEN ("cl"."stage" = 'novo'::"text") THEN 1
            ELSE NULL::integer
        END) AS "leads_novos",
    "count"(
        CASE
            WHEN ("cl"."stage" = 'contato'::"text") THEN 1
            ELSE NULL::integer
        END) AS "leads_contato",
    "count"(
        CASE
            WHEN ("cl"."stage" = 'proposta'::"text") THEN 1
            ELSE NULL::integer
        END) AS "leads_proposta",
    "count"(
        CASE
            WHEN ("cl"."stage" = 'negociacao'::"text") THEN 1
            ELSE NULL::integer
        END) AS "leads_negociacao",
    "count"(
        CASE
            WHEN ("cl"."stage" = 'fechado'::"text") THEN 1
            ELSE NULL::integer
        END) AS "leads_fechados",
    "count"(
        CASE
            WHEN ("cl"."stage" = 'perdido'::"text") THEN 1
            ELSE NULL::integer
        END) AS "leads_perdidos",
    "count"("cl"."id") AS "total_leads",
    ((("count"(
        CASE
            WHEN ("cl"."stage" = 'fechado'::"text") THEN 1
            ELSE NULL::integer
        END))::numeric / (NULLIF("count"("cl"."id"), 0))::numeric) * (100)::numeric) AS "conversion_rate"
   FROM ("public"."saas_organizations" "so"
     LEFT JOIN "public"."crm_leads" "cl" ON (("cl"."organization_id" = "so"."id")))
  GROUP BY "so"."id", "so"."name";


ALTER VIEW "public"."crm_funnel" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_import_prefs" (
    "organization_id" "uuid" NOT NULL,
    "email_strategy" "text" DEFAULT 'allow_duplicates'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "crm_import_prefs_email_strategy_check" CHECK (("email_strategy" = ANY (ARRAY['allow_duplicates'::"text", 'update_if_exists'::"text"])))
);


ALTER TABLE "public"."crm_import_prefs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_lead_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid",
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "description" "text",
    "old_value" "text",
    "new_value" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "field_changed" "text",
    "origin" "text"
);


ALTER TABLE "public"."crm_lead_activities" OWNER TO "postgres";


COMMENT ON COLUMN "public"."crm_lead_activities"."origin" IS 'Origem do evento: ui | automation | edge | system';



CREATE TABLE IF NOT EXISTS "public"."crm_lead_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid",
    "user_id" "uuid",
    "note" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."crm_lead_notes" OWNER TO "postgres";


CREATE UNLOGGED TABLE "public"."crm_leads_import_staging" (
    "import_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "row_num" integer,
    "name" "text",
    "whatsapp" "text",
    "email" "text",
    "phone_normalized" "text",
    "email_normalized" "text",
    "stage" "text",
    "value" numeric(10,2),
    "source" "text",
    "canal" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."crm_leads_import_staging" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_stage_aliases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "alias" "text" NOT NULL,
    "canonical" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."crm_stage_aliases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."despesas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "categoria" "text" NOT NULL,
    "descricao" "text" NOT NULL,
    "valor" numeric(10,2) NOT NULL,
    "data_despesa" timestamp with time zone DEFAULT "now"(),
    "recorrente" boolean DEFAULT false,
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."despesas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entradas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "descricao" "text" NOT NULL,
    "valor" numeric(12,2) NOT NULL,
    "categoria" "text" NOT NULL,
    "data_entrada" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metodo_pagamento" "text" DEFAULT 'dinheiro'::"text" NOT NULL,
    "cliente_id" "uuid",
    "produto_servico_id" "uuid",
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "entradas_categoria_check" CHECK (("categoria" = ANY (ARRAY['Vendas'::"text", 'Serviços'::"text", 'Consultoria'::"text", 'Produtos'::"text", 'Assinatura'::"text", 'Outros'::"text"]))),
    CONSTRAINT "entradas_metodo_check" CHECK (("metodo_pagamento" = ANY (ARRAY['dinheiro'::"text", 'cartao_credito'::"text", 'cartao_debito'::"text", 'pix'::"text", 'transferencia'::"text", 'boleto'::"text", 'cheque'::"text"]))),
    CONSTRAINT "entradas_valor_check" CHECK (("valor" > (0)::numeric))
);


ALTER TABLE "public"."entradas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entradas_source_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "entrada_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "entradas_source_links_source_type_check" CHECK (("source_type" = ANY (ARRAY['pagamento'::"text", 'lead_payment'::"text", 'client_valor_pago'::"text"])))
);


ALTER TABLE "public"."entradas_source_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."external_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "integration_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true,
    "last_sync_at" timestamp with time zone,
    "sync_status" "text" DEFAULT 'active'::"text",
    "error_message" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "external_integrations_integration_type_check" CHECK (("integration_type" = ANY (ARRAY['n8n'::"text", 'zapier'::"text", 'custom_ai'::"text"]))),
    CONSTRAINT "external_integrations_sync_status_check" CHECK (("sync_status" = ANY (ARRAY['active'::"text", 'error'::"text", 'disabled'::"text"])))
);


ALTER TABLE "public"."external_integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saidas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "descricao" "text" NOT NULL,
    "valor" numeric(12,2) NOT NULL,
    "categoria" "text" NOT NULL,
    "data_saida" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metodo_pagamento" "text" DEFAULT 'dinheiro'::"text" NOT NULL,
    "fornecedor" "text",
    "observacoes" "text",
    "recorrente" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "saidas_categoria_check" CHECK (("categoria" = ANY (ARRAY['Aluguel'::"text", 'Folha de Pagamento'::"text", 'Marketing'::"text", 'Equipamentos'::"text", 'Materiais'::"text", 'Limpeza'::"text", 'Internet/Telefone'::"text", 'Energia'::"text", 'Água'::"text", 'Impostos'::"text", 'Seguros'::"text", 'Manutenção'::"text", 'Viagem'::"text", 'Treinamento'::"text", 'Software'::"text", 'Outros'::"text"]))),
    CONSTRAINT "saidas_metodo_check" CHECK (("metodo_pagamento" = ANY (ARRAY['dinheiro'::"text", 'cartao_credito'::"text", 'cartao_debito'::"text", 'pix'::"text", 'transferencia'::"text", 'boleto'::"text", 'cheque'::"text", 'debito_automatico'::"text"]))),
    CONSTRAINT "saidas_valor_check" CHECK (("valor" > (0)::numeric))
);


ALTER TABLE "public"."saidas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."financial_dashboard" AS
 SELECT "o"."id" AS "organization_id",
    COALESCE("sum"(
        CASE
            WHEN ("e"."valor" IS NOT NULL) THEN "e"."valor"
            ELSE (0)::numeric
        END), (0)::numeric) AS "total_entradas",
    "count"("e"."id") AS "total_transacoes_entrada",
    COALESCE("sum"(
        CASE
            WHEN ("s"."valor" IS NOT NULL) THEN "s"."valor"
            ELSE (0)::numeric
        END), (0)::numeric) AS "total_saidas",
    "count"("s"."id") AS "total_transacoes_saida",
    (COALESCE("sum"(
        CASE
            WHEN ("e"."valor" IS NOT NULL) THEN "e"."valor"
            ELSE (0)::numeric
        END), (0)::numeric) - COALESCE("sum"(
        CASE
            WHEN ("s"."valor" IS NOT NULL) THEN "s"."valor"
            ELSE (0)::numeric
        END), (0)::numeric)) AS "lucro_liquido",
        CASE
            WHEN ("count"("e"."id") > 0) THEN (COALESCE("sum"(
            CASE
                WHEN ("e"."valor" IS NOT NULL) THEN "e"."valor"
                ELSE (0)::numeric
            END), (0)::numeric) / ("count"("e"."id"))::numeric)
            ELSE (0)::numeric
        END AS "ticket_medio"
   FROM (("public"."saas_organizations" "o"
     LEFT JOIN "public"."entradas" "e" ON (("e"."organization_id" = "o"."id")))
     LEFT JOIN "public"."saidas" "s" ON (("s"."organization_id" = "o"."id")))
  GROUP BY "o"."id";


ALTER VIEW "public"."financial_dashboard" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pagamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "paciente_id" "uuid",
    "agendamento_id" "uuid",
    "servico_id" "uuid",
    "valor" numeric(10,2) NOT NULL,
    "data_pagamento" timestamp with time zone DEFAULT "now"(),
    "metodo" "text" DEFAULT 'dinheiro'::"text",
    "status" "text" DEFAULT 'confirmado'::"text",
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "client_id" "uuid",
    CONSTRAINT "pagamentos_metodo_check" CHECK (("metodo" = ANY (ARRAY['dinheiro'::"text", 'cartao'::"text", 'pix'::"text", 'transferencia'::"text", 'cheque'::"text"]))),
    CONSTRAINT "pagamentos_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'confirmado'::"text", 'cancelado'::"text"])))
);


ALTER TABLE "public"."pagamentos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."financial_summary" AS
 SELECT "id" AS "organization_id",
    "name" AS "organization_name",
    ( SELECT COALESCE("sum"("pag"."valor"), (0)::numeric) AS "coalesce"
           FROM "public"."pagamentos" "pag"
          WHERE (("pag"."organization_id" = "so"."id") AND ("pag"."status" = 'confirmado'::"text"))) AS "total_receitas",
    ( SELECT COALESCE("sum"("desp"."valor"), (0)::numeric) AS "coalesce"
           FROM "public"."despesas" "desp"
          WHERE ("desp"."organization_id" = "so"."id")) AS "total_despesas",
    (( SELECT COALESCE("sum"("pag"."valor"), (0)::numeric) AS "coalesce"
           FROM "public"."pagamentos" "pag"
          WHERE (("pag"."organization_id" = "so"."id") AND ("pag"."status" = 'confirmado'::"text"))) - ( SELECT COALESCE("sum"("desp"."valor"), (0)::numeric) AS "coalesce"
           FROM "public"."despesas" "desp"
          WHERE ("desp"."organization_id" = "so"."id"))) AS "lucro",
    ( SELECT "count"(*) AS "count"
           FROM "public"."pagamentos" "pag"
          WHERE (("pag"."organization_id" = "so"."id") AND ("pag"."status" = 'confirmado'::"text"))) AS "total_pagamentos",
    ( SELECT (COALESCE("sum"("pag"."valor"), (0)::numeric) / (NULLIF("count"(DISTINCT "pag"."paciente_id"), 0))::numeric)
           FROM "public"."pagamentos" "pag"
          WHERE (("pag"."organization_id" = "so"."id") AND ("pag"."status" = 'confirmado'::"text"))) AS "ticket_medio"
   FROM "public"."saas_organizations" "so";


ALTER VIEW "public"."financial_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."investimentos_marketing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "data_investimento" timestamp with time zone DEFAULT "now"(),
    "valor" numeric(10,2) NOT NULL,
    "canal" "text" NOT NULL,
    "campanha" "text",
    "descricao" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."investimentos_marketing" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."james" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "agent_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."james" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."n8n_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "base_url" "text" NOT NULL,
    "api_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."n8n_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."n8n_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "n8n_url" "text" NOT NULL,
    "api_key_encrypted" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "last_test_at" timestamp with time zone,
    "test_status" "text" DEFAULT 'pending'::"text",
    "test_error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "n8n_credentials_test_status_check" CHECK (("test_status" = ANY (ARRAY['pending'::"text", 'success'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."n8n_credentials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."n8n_workflows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "name" "text" NOT NULL,
    "n8n_workflow_id" "text",
    "webhook_url" "text",
    "is_active" boolean DEFAULT true,
    "triggers" "jsonb" DEFAULT '[]'::"jsonb",
    "data_mapping" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."n8n_workflows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "user_id" "uuid",
    "tipo" "text" NOT NULL,
    "mensagem" "text" NOT NULL,
    "lida" boolean DEFAULT false,
    "link" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notifications_tipo_check" CHECK (("tipo" = ANY (ARRAY['agendamento'::"text", 'consulta'::"text", 'sistema'::"text", 'pagamento'::"text", 'lembrete'::"text", 'crm'::"text", 'cliente'::"text", 'colaborador'::"text", 'financeiro'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."patients" AS
 SELECT "id",
    "organization_id",
    "nome",
    "email",
    "telefone",
    "nascimento",
    "documentos",
    "endereco",
    "observacoes",
    "ativo",
    "created_at",
    "updated_at"
   FROM "public"."clients" "c";


ALTER VIEW "public"."patients" OWNER TO "postgres";


COMMENT ON VIEW "public"."patients" IS 'Compatibility view mapping clients -> patients for legacy code.';



CREATE TABLE IF NOT EXISTS "public"."produto_variantes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "produto_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "preco" numeric(12,2) DEFAULT 0 NOT NULL,
    "cobranca_tipo" "text" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "checkout_url" "text",
    CONSTRAINT "produto_variantes_cobranca_tipo_check" CHECK (("cobranca_tipo" = ANY (ARRAY['unica'::"text", 'mensal'::"text", 'trimestral'::"text", 'semestral'::"text", 'anual'::"text"])))
);


ALTER TABLE "public"."produto_variantes" OWNER TO "postgres";


COMMENT ON TABLE "public"."produto_variantes" IS 'Planos/variações de um produto ou serviço.';



CREATE TABLE IF NOT EXISTS "public"."produtos_relacionados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "produto_id" "uuid" NOT NULL,
    "relacionado_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."produtos_relacionados" OWNER TO "postgres";


COMMENT ON TABLE "public"."produtos_relacionados" IS 'Relacionamentos para upsell/cross-sell.';



CREATE TABLE IF NOT EXISTS "public"."produtos_servicos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "tipo" "text" DEFAULT 'servico'::"text" NOT NULL,
    "categoria" "text" NOT NULL,
    "preco_base" numeric(12,2) DEFAULT 0 NOT NULL,
    "descricao" "text",
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tipo_cobranca" "text",
    "cobranca_tipo" "text",
    "estoque_quantidade" numeric,
    "tem_estoque" boolean DEFAULT false,
    "imagens_urls" "text",
    "imagens_base64" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "custom_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "imposto_percent" numeric(5,2),
    "custo_base" numeric(12,2),
    "status" "text" DEFAULT 'ativo'::"text",
    "estoque_minimo" integer DEFAULT 0,
    "estoque_locais" "jsonb" DEFAULT '[]'::"jsonb",
    "sku" "text",
    "checkout_url" "text",
    "sales_page_url" "text",
    CONSTRAINT "produtos_servicos_categoria_check" CHECK (("categoria" = ANY (ARRAY['Consulta'::"text", 'Exame'::"text", 'Procedimento'::"text", 'Terapia'::"text", 'Cirurgia'::"text", 'Medicamento'::"text", 'Equipamento'::"text", 'Material'::"text", 'Software'::"text", 'Imovel'::"text", 'Treinamento'::"text", 'Outros'::"text"]))),
    CONSTRAINT "produtos_servicos_cobranca_tipo_check" CHECK (("cobranca_tipo" = ANY (ARRAY['unica'::"text", 'mensal'::"text", 'trimestral'::"text", 'semestral'::"text", 'anual'::"text"]))),
    CONSTRAINT "produtos_servicos_cobranca_tipo_chk" CHECK (("cobranca_tipo" = ANY (ARRAY['unica'::"text", 'mensal'::"text", 'trimestral'::"text", 'semestral'::"text", 'anual'::"text"]))),
    CONSTRAINT "produtos_servicos_imposto_percent_check" CHECK ((("imposto_percent" >= (0)::numeric) AND ("imposto_percent" <= (100)::numeric))),
    CONSTRAINT "produtos_servicos_status_check" CHECK (("status" = ANY (ARRAY['rascunho'::"text", 'ativo'::"text", 'sob_demanda'::"text", 'fora_catalogo'::"text"]))),
    CONSTRAINT "produtos_servicos_tipo_check" CHECK (("tipo" = ANY (ARRAY['produto'::"text", 'servico'::"text", 'consultoria'::"text", 'assinatura'::"text", 'curso'::"text", 'evento'::"text"]))),
    CONSTRAINT "produtos_servicos_tipo_cobranca_check" CHECK (("tipo_cobranca" = ANY (ARRAY['unica'::"text", 'mensal'::"text", 'trimestral'::"text", 'semestral'::"text", 'anual'::"text"])))
);


ALTER TABLE "public"."produtos_servicos" OWNER TO "postgres";


COMMENT ON COLUMN "public"."produtos_servicos"."tipo_cobranca" IS 'Tipo de cobrança do produto/serviço: única, mensal, trimestral, semestral ou anual';



COMMENT ON COLUMN "public"."produtos_servicos"."cobranca_tipo" IS 'Tipo de cobrança do produto/serviço: única, mensal, trimestral, semestral ou anual';



COMMENT ON COLUMN "public"."produtos_servicos"."estoque_quantidade" IS 'Quantidade de itens disponíveis em estoque para produtos';



COMMENT ON COLUMN "public"."produtos_servicos"."tem_estoque" IS 'Indica se o produto/serviço possui controle de estoque';



COMMENT ON COLUMN "public"."produtos_servicos"."imagens_urls" IS 'Até 5 URLs de imagens do produto/serviço, separados por quebra de linha (\n).';



COMMENT ON COLUMN "public"."produtos_servicos"."imagens_base64" IS 'Até 5 imagens em Base64 (data URL) separadas por quebra de linha (\n).';



COMMENT ON COLUMN "public"."produtos_servicos"."checkout_url" IS 'Public product/checkout link (optional)';



COMMENT ON COLUMN "public"."produtos_servicos"."sales_page_url" IS 'Public sales/landing page link (optional)';



CREATE OR REPLACE VIEW "public"."professionals" AS
 SELECT "id",
    "organization_id",
    "name",
    "position",
    "email",
    "phone",
    "credentials",
    "notes",
    "active",
    "created_at",
    "updated_at",
    0 AS "total_consultations",
    0 AS "consultations_this_month",
    0 AS "upcoming_appointments",
    NULL::numeric AS "average_rating",
    '[]'::"jsonb" AS "upcoming_appointments_details",
    "position" AS "specialty"
   FROM "public"."collaborators" "c";


ALTER VIEW "public"."professionals" OWNER TO "postgres";


COMMENT ON VIEW "public"."professionals" IS 'Compatibility view that maps collaborators to legacy professionals references.';



CREATE TABLE IF NOT EXISTS "public"."rag_items" (
    "id" bigint NOT NULL,
    "organization_id" "uuid",
    "source_id" "uuid" NOT NULL,
    "row_index" integer,
    "category" "text",
    "content" "text" NOT NULL,
    "fields" "jsonb",
    "metadata" "jsonb",
    "hash" "text",
    "embedding" "public"."vector"(1536),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rag_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."rag_items" IS 'Linhas/chunks normalizados com embedding para busca semântica';



CREATE SEQUENCE IF NOT EXISTS "public"."rag_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."rag_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."rag_items_id_seq" OWNED BY "public"."rag_items"."id";



CREATE TABLE IF NOT EXISTS "public"."rag_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "name" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "mime_type" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "total_rows" integer DEFAULT 0,
    "processed_rows" integer DEFAULT 0,
    "schema_json" "jsonb",
    "created_by" "uuid",
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rag_sources" OWNER TO "postgres";


COMMENT ON TABLE "public"."rag_sources" IS 'Datasets enviados pelo usuário (CSV/XLSX/TXT) para RAG';



CREATE TABLE IF NOT EXISTS "public"."report_filter_presets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "filters" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."report_filter_presets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saas_sync_settings" (
    "key" "text" NOT NULL,
    "value" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."saas_sync_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."servicos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "nome" "text" NOT NULL,
    "preco_padrao" numeric(10,2) DEFAULT 0,
    "descricao" "text",
    "categoria" "text" DEFAULT 'consulta'::"text",
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."servicos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tomikcrm_schema_migrations" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "version" "text",
    "checksum" "text",
    "status" "text" DEFAULT 'applied'::"text" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tomikcrm_schema_migrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_dashboard_prefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "page" "text" NOT NULL,
    "tab" "text" NOT NULL,
    "widgets" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_dashboard_prefs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "invited_by" "uuid",
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'base64'::"text"),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_invitations_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'medico'::"text", 'recepcionista'::"text"])))
);


ALTER TABLE "public"."user_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "feature" "text" NOT NULL,
    "prefs" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "nome" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'recepcionista'::"text",
    "ativo" boolean DEFAULT true,
    "is_owner" boolean DEFAULT false,
    "avatar_url" "text",
    "telefone" "text",
    "especialidade" "text",
    "crm" "text",
    "invited_by" "uuid",
    "last_login_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'medico'::"text", 'recepcionista'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_analytics_dau" AS
 SELECT "date_trunc"('day'::"text", "ingested_at") AS "day",
    "organization_id",
    "count"(DISTINCT COALESCE(("user_id")::"text", ("session_id")::"text")) AS "dau"
   FROM "public"."analytics_events"
  GROUP BY ("date_trunc"('day'::"text", "ingested_at")), "organization_id";


ALTER VIEW "public"."v_analytics_dau" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_feature_adoption" AS
 SELECT "date_trunc"('day'::"text", "ingested_at") AS "day",
    "organization_id",
    "feature_key",
    "count"(DISTINCT COALESCE(("user_id")::"text", ("session_id")::"text")) AS "users",
    "count"(*) AS "events"
   FROM "public"."analytics_events"
  WHERE (("feature_key" IS NOT NULL) AND ("feature_key" <> ''::"text"))
  GROUP BY ("date_trunc"('day'::"text", "ingested_at")), "organization_id", "feature_key";


ALTER VIEW "public"."v_feature_adoption" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_rm_conversas" AS
 SELECT "conversation_id",
    "min"("created_at") AS "first_message_at",
    "max"("created_at") AS "last_message_at",
    "count"(*) AS "total_msgs",
    "count"(*) FILTER (WHERE ("sender_type" = 'cliente'::"public"."sender_type")) AS "total_cliente",
    "count"(*) FILTER (WHERE ("sender_type" = 'ia'::"public"."sender_type")) AS "total_ia",
    "count"(*) FILTER (WHERE ("sender_type" = 'humano'::"public"."sender_type")) AS "total_humano",
    "min"("whatsapp_cliente") AS "whatsapp_cliente",
    "min"("whatsapp_empresa") AS "whatsapp_empresa"
   FROM "public"."repositorio_de_mensagens"
  GROUP BY "conversation_id";


ALTER VIEW "public"."vw_rm_conversas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_rm_insights_diarios" AS
 SELECT "date_trunc"('day'::"text", "created_at") AS "dia",
    "sender_type",
    "count"(*) AS "total"
   FROM "public"."repositorio_de_mensagens"
  GROUP BY ("date_trunc"('day'::"text", "created_at")), "sender_type"
  ORDER BY ("date_trunc"('day'::"text", "created_at")) DESC;


ALTER VIEW "public"."vw_rm_insights_diarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_configurations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "name" "text" NOT NULL,
    "webhook_url" "text" NOT NULL,
    "event_types" "text"[] NOT NULL,
    "is_active" boolean DEFAULT true,
    "authentication_type" "text" DEFAULT 'none'::"text",
    "authentication_config" "jsonb" DEFAULT '{}'::"jsonb",
    "headers" "jsonb" DEFAULT '{}'::"jsonb",
    "retry_attempts" integer DEFAULT 3,
    "timeout_seconds" integer DEFAULT 30,
    "rate_limit_per_minute" integer DEFAULT 60,
    "last_triggered_at" timestamp with time zone,
    "total_triggers" integer DEFAULT 0,
    "successful_triggers" integer DEFAULT 0,
    "failed_triggers" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "webhook_configurations_authentication_type_check" CHECK (("authentication_type" = ANY (ARRAY['none'::"text", 'api_key'::"text", 'bearer_token'::"text", 'basic_auth'::"text"])))
);


ALTER TABLE "public"."webhook_configurations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_event_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "example_payload" "jsonb" NOT NULL,
    "category" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."webhook_event_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "webhook_config_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" NOT NULL,
    "webhook_url" "text" NOT NULL,
    "request_payload" "jsonb" NOT NULL,
    "response_status" integer,
    "response_data" "jsonb",
    "response_headers" "jsonb",
    "execution_time_ms" integer,
    "status" "text" DEFAULT 'pending'::"text",
    "error_message" "text",
    "retry_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "webhook_events_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'success'::"text", 'failed'::"text", 'timeout'::"text"])))
);


ALTER TABLE "public"."webhook_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "webhook_type" "text" NOT NULL,
    "endpoint" "text" NOT NULL,
    "method" "text" NOT NULL,
    "headers" "jsonb" DEFAULT '{}'::"jsonb",
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "response_status" integer,
    "response_data" "jsonb" DEFAULT '{}'::"jsonb",
    "processing_time_ms" integer,
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "webhook_logs_webhook_type_check" CHECK (("webhook_type" = ANY (ARRAY['n8n'::"text", 'zapier'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."webhook_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "text" NOT NULL,
    "phone_e164" "text" NOT NULL,
    "name" "text",
    "lead_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avatar_url" "text",
    "is_whatsapp" boolean DEFAULT true
);


ALTER TABLE "public"."whatsapp_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "text" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "lead_id" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "last_message_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_message_preview" "text",
    "unread_count" integer DEFAULT 0 NOT NULL,
    "last_message" "text",
    CONSTRAINT "whatsapp_conversations_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."whatsapp_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."whatsapp_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_instances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "instance_id" "text" NOT NULL,
    "instance_token" "text" NOT NULL,
    "client_token" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "status" "text",
    "device_jid" "text",
    "connected_at" timestamp with time zone,
    "webhook_url" "text",
    "events" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."whatsapp_instances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "instance_id" "text" NOT NULL,
    "instance_token" "text",
    "client_token" "text" NOT NULL,
    "base_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "webhook_secret" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "device_jid" "text",
    "pairing_status" "text",
    "connected_at" timestamp with time zone,
    "last_seen" timestamp with time zone,
    CONSTRAINT "whatsapp_integrations_provider_check" CHECK (("provider" = ANY (ARRAY['zapi'::"text", 'evolution'::"text", 'internal'::"text"])))
);


ALTER TABLE "public"."whatsapp_integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "text" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "direction" "text" NOT NULL,
    "type" "text" NOT NULL,
    "body" "text",
    "media_url" "text",
    "media_mime" "text",
    "provider_message_id" "text",
    "status" "text",
    "error" "text",
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "instance_id" "text",
    CONSTRAINT "whatsapp_messages_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text"]))),
    CONSTRAINT "whatsapp_messages_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'sent'::"text", 'delivered'::"text", 'read'::"text", 'failed'::"text"]))),
    CONSTRAINT "whatsapp_messages_type_check" CHECK (("type" = ANY (ARRAY['text'::"text", 'image'::"text", 'audio'::"text", 'document'::"text"])))
);


ALTER TABLE "public"."whatsapp_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_user_webhooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "text" NOT NULL,
    "webhook_url" "text" NOT NULL,
    "events" "text"[] DEFAULT '{All}'::"text"[] NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."whatsapp_user_webhooks" OWNER TO "postgres";


ALTER TABLE ONLY "public"."rag_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."rag_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."agent_prompts"
    ADD CONSTRAINT "agent_prompts_organization_id_agent_name_key" UNIQUE ("organization_id", "agent_name");



ALTER TABLE ONLY "public"."agent_prompts"
    ADD CONSTRAINT "agent_prompts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_agent_metrics_daily_agg"
    ADD CONSTRAINT "ai_agent_metrics_daily_agg_pkey" PRIMARY KEY ("organization_id", "day");



ALTER TABLE ONLY "public"."ai_agent_workflows"
    ADD CONSTRAINT "ai_agent_workflows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_interactions"
    ADD CONSTRAINT "ai_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_migrations"
    ADD CONSTRAINT "app_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_briefings"
    ADD CONSTRAINT "automation_briefings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_client_appointments"
    ADD CONSTRAINT "automation_client_appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_client_documents"
    ADD CONSTRAINT "automation_client_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_client_feedbacks"
    ADD CONSTRAINT "automation_client_feedbacks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_clients"
    ADD CONSTRAINT "automation_clients_org_company_unique" UNIQUE ("organization_id", "company_name");



ALTER TABLE ONLY "public"."automation_clients"
    ADD CONSTRAINT "automation_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_contracts"
    ADD CONSTRAINT "automation_contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_events"
    ADD CONSTRAINT "automation_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_executions"
    ADD CONSTRAINT "automation_executions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_meeting_transcriptions"
    ADD CONSTRAINT "automation_meeting_transcriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_processes"
    ADD CONSTRAINT "automation_processes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collaborators"
    ADD CONSTRAINT "collaborators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_import_prefs"
    ADD CONSTRAINT "crm_import_prefs_pkey" PRIMARY KEY ("organization_id");



ALTER TABLE ONLY "public"."crm_lead_activities"
    ADD CONSTRAINT "crm_lead_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_lead_notes"
    ADD CONSTRAINT "crm_lead_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_leads_import_jobs"
    ADD CONSTRAINT "crm_leads_import_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_leads"
    ADD CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_stage_aliases"
    ADD CONSTRAINT "crm_stage_aliases_organization_id_alias_key" UNIQUE ("organization_id", "alias");



ALTER TABLE ONLY "public"."crm_stage_aliases"
    ADD CONSTRAINT "crm_stage_aliases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_stages"
    ADD CONSTRAINT "crm_stages_organization_id_name_key" UNIQUE ("organization_id", "name");



ALTER TABLE ONLY "public"."crm_stages"
    ADD CONSTRAINT "crm_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entradas"
    ADD CONSTRAINT "entradas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entradas_source_links"
    ADD CONSTRAINT "entradas_source_links_organization_id_source_type_source_id_key" UNIQUE ("organization_id", "source_type", "source_id");



ALTER TABLE ONLY "public"."entradas_source_links"
    ADD CONSTRAINT "entradas_source_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_integrations"
    ADD CONSTRAINT "external_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."investimentos_marketing"
    ADD CONSTRAINT "investimentos_marketing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."james"
    ADD CONSTRAINT "james_organization_id_key" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."james"
    ADD CONSTRAINT "james_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manychat_credentials"
    ADD CONSTRAINT "manychat_credentials_organization_id_key" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."manychat_credentials"
    ADD CONSTRAINT "manychat_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monetization_trail_progress"
    ADD CONSTRAINT "monetization_trail_progress_pkey" PRIMARY KEY ("organization_id", "step_key");



ALTER TABLE ONLY "public"."n8n_connections"
    ADD CONSTRAINT "n8n_connections_organization_id_key" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."n8n_connections"
    ADD CONSTRAINT "n8n_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."n8n_credentials"
    ADD CONSTRAINT "n8n_credentials_organization_id_key" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."n8n_credentials"
    ADD CONSTRAINT "n8n_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."n8n_workflows"
    ADD CONSTRAINT "n8n_workflows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."produto_variantes"
    ADD CONSTRAINT "produto_variantes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."produtos_relacionados"
    ADD CONSTRAINT "produtos_relacionados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."produtos_servicos"
    ADD CONSTRAINT "produtos_servicos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."qna_pairs"
    ADD CONSTRAINT "qna_pairs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rag_items"
    ADD CONSTRAINT "rag_items_hash_key" UNIQUE ("hash");



ALTER TABLE ONLY "public"."rag_items"
    ADD CONSTRAINT "rag_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rag_sources"
    ADD CONSTRAINT "rag_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_filter_presets"
    ADD CONSTRAINT "report_filter_presets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."repositorio_de_mensagens"
    ADD CONSTRAINT "repositorio_de_mensagens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saas_organizations"
    ADD CONSTRAINT "saas_organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saas_organizations"
    ADD CONSTRAINT "saas_organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."saas_sync_settings"
    ADD CONSTRAINT "saas_sync_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."saidas"
    ADD CONSTRAINT "saidas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."servicos"
    ADD CONSTRAINT "servicos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tomikcrm_schema_migrations"
    ADD CONSTRAINT "tomikcrm_schema_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trail_notes"
    ADD CONSTRAINT "trail_notes_org_trail_lesson_unique" UNIQUE ("organization_id", "trail_type", "lesson_key");



ALTER TABLE ONLY "public"."trail_notes"
    ADD CONSTRAINT "trail_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tutorial_manychat_progress"
    ADD CONSTRAINT "tutorial_manychat_progress_pkey" PRIMARY KEY ("organization_id", "user_id", "step_id");



ALTER TABLE ONLY "public"."user_dashboard_prefs"
    ADD CONSTRAINT "user_dashboard_prefs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_organization_id_feature_key" UNIQUE ("user_id", "organization_id", "feature");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_configurations"
    ADD CONSTRAINT "webhook_configurations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_event_types"
    ADD CONSTRAINT "webhook_event_types_event_type_key" UNIQUE ("event_type");



ALTER TABLE ONLY "public"."webhook_event_types"
    ADD CONSTRAINT "webhook_event_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_logs"
    ADD CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_contacts"
    ADD CONSTRAINT "whatsapp_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_conversations"
    ADD CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_events"
    ADD CONSTRAINT "whatsapp_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_instances"
    ADD CONSTRAINT "whatsapp_instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_integrations"
    ADD CONSTRAINT "whatsapp_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_user_webhooks"
    ADD CONSTRAINT "whatsapp_user_webhooks_organization_id_key" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."whatsapp_user_webhooks"
    ADD CONSTRAINT "whatsapp_user_webhooks_pkey" PRIMARY KEY ("id");



CREATE INDEX "agent_prompts_org_idx" ON "public"."agent_prompts" USING "btree" ("organization_id");



CREATE INDEX "ai_agent_workflows_category_idx" ON "public"."ai_agent_workflows" USING "btree" ("organization_id", "category") WHERE ("category" IS NOT NULL);



CREATE INDEX "ai_agent_workflows_data_idx" ON "public"."ai_agent_workflows" USING "gin" ("workflow_data");



CREATE INDEX "ai_agent_workflows_org_active_idx" ON "public"."ai_agent_workflows" USING "btree" ("organization_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "ai_agent_workflows_org_id_idx" ON "public"."ai_agent_workflows" USING "btree" ("organization_id");



CREATE INDEX "ai_agent_workflows_tags_idx" ON "public"."ai_agent_workflows" USING "gin" ("tags");



CREATE INDEX "ai_agent_workflows_updated_at_idx" ON "public"."ai_agent_workflows" USING "btree" ("updated_at" DESC);



CREATE INDEX "ai_interactions_organization_id_idx" ON "public"."ai_interactions" USING "btree" ("organization_id");



CREATE INDEX "appointments_datetime_idx" ON "public"."appointments" USING "btree" ("datetime");



CREATE INDEX "appointments_organization_id_idx" ON "public"."appointments" USING "btree" ("organization_id");



CREATE INDEX "appointments_status_idx" ON "public"."appointments" USING "btree" ("status");



CREATE INDEX "appointments_updated_at_idx" ON "public"."appointments" USING "btree" ("updated_at" DESC);



CREATE INDEX "automation_events_created_at_idx" ON "public"."automation_events" USING "btree" ("created_at" DESC);



CREATE INDEX "automation_events_org_type_idx" ON "public"."automation_events" USING "btree" ("organization_id", "event_type");



CREATE INDEX "automation_executions_created_at_idx" ON "public"."automation_executions" USING "btree" ("created_at" DESC);



CREATE INDEX "automation_executions_org_idx" ON "public"."automation_executions" USING "btree" ("organization_id");



CREATE INDEX "automation_executions_status_idx" ON "public"."automation_executions" USING "btree" ("status");



CREATE INDEX "automation_executions_trigger_event_idx" ON "public"."automation_executions" USING "btree" ("trigger_event");



CREATE INDEX "calendar_events_organization_id_idx" ON "public"."calendar_events" USING "btree" ("organization_id");



CREATE INDEX "calendar_events_start_time_idx" ON "public"."calendar_events" USING "btree" ("start_time");



CREATE INDEX "clients_email_idx" ON "public"."clients" USING "btree" ("email");



CREATE INDEX "clients_nascimento_idx" ON "public"."clients" USING "btree" ("nascimento");



CREATE INDEX "clients_nome_idx" ON "public"."clients" USING "gin" ("nome" "public"."gin_trgm_ops");



CREATE INDEX "clients_organization_id_idx" ON "public"."clients" USING "btree" ("organization_id");



CREATE INDEX "clients_telefone_idx" ON "public"."clients" USING "btree" ("telefone");



CREATE INDEX "collaborators_active_idx" ON "public"."collaborators" USING "btree" ("active");



CREATE INDEX "collaborators_organization_id_idx" ON "public"."collaborators" USING "btree" ("organization_id");



CREATE INDEX "collaborators_position_idx" ON "public"."collaborators" USING "btree" ("position");



CREATE INDEX "collaborators_user_id_idx" ON "public"."collaborators" USING "btree" ("user_id");



CREATE INDEX "consultations_appointment_id_idx" ON "public"."consultations" USING "btree" ("appointment_id");



CREATE INDEX "consultations_date_idx" ON "public"."consultations" USING "btree" ("date" DESC);



CREATE INDEX "consultations_organization_id_idx" ON "public"."consultations" USING "btree" ("organization_id");



CREATE INDEX "consultations_status_idx" ON "public"."consultations" USING "btree" ("status");



CREATE INDEX "crm_lead_activities_lead_id_idx" ON "public"."crm_lead_activities" USING "btree" ("lead_id");



CREATE INDEX "crm_lead_notes_lead_id_idx" ON "public"."crm_lead_notes" USING "btree" ("lead_id");



CREATE INDEX "crm_leads_created_at_idx" ON "public"."crm_leads" USING "btree" ("created_at" DESC);



CREATE INDEX "crm_leads_import_staging_email_idx" ON "public"."crm_leads_import_staging" USING "btree" ("import_id", "organization_id", "email_normalized") WHERE ("email_normalized" IS NOT NULL);



CREATE INDEX "crm_leads_import_staging_idx" ON "public"."crm_leads_import_staging" USING "btree" ("import_id", "organization_id");



CREATE INDEX "crm_leads_import_staging_phone_idx" ON "public"."crm_leads_import_staging" USING "btree" ("import_id", "organization_id", "phone_normalized") WHERE ("phone_normalized" IS NOT NULL);



CREATE INDEX "crm_leads_org_created_at_idx" ON "public"."crm_leads" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "crm_leads_org_email_idx" ON "public"."crm_leads" USING "btree" ("organization_id", "email");



CREATE INDEX "crm_leads_org_whatsapp_idx" ON "public"."crm_leads" USING "btree" ("organization_id", "whatsapp");



CREATE INDEX "crm_leads_organization_id_idx" ON "public"."crm_leads" USING "btree" ("organization_id");



CREATE INDEX "crm_leads_stage_idx" ON "public"."crm_leads" USING "btree" ("stage");



CREATE UNIQUE INDEX "crm_stages_org_lower_name_key" ON "public"."crm_stages" USING "btree" ("organization_id", "lower"("name"));



CREATE INDEX "crm_stages_organization_id_idx" ON "public"."crm_stages" USING "btree" ("organization_id");



CREATE INDEX "despesas_data_despesa_idx" ON "public"."despesas" USING "btree" ("data_despesa" DESC);



CREATE INDEX "despesas_organization_id_idx" ON "public"."despesas" USING "btree" ("organization_id");



CREATE INDEX "entradas_categoria_idx" ON "public"."entradas" USING "btree" ("categoria");



CREATE INDEX "entradas_cliente_id_idx" ON "public"."entradas" USING "btree" ("cliente_id");



CREATE INDEX "entradas_data_entrada_idx" ON "public"."entradas" USING "btree" ("data_entrada" DESC);



CREATE INDEX "entradas_organization_id_idx" ON "public"."entradas" USING "btree" ("organization_id");



CREATE INDEX "entradas_produto_servico_id_idx" ON "public"."entradas" USING "btree" ("produto_servico_id");



CREATE INDEX "external_integrations_organization_id_idx" ON "public"."external_integrations" USING "btree" ("organization_id");



CREATE INDEX "idx_appointments_lead_id" ON "public"."appointments" USING "btree" ("lead_id");



CREATE INDEX "idx_automation_appointments_client" ON "public"."automation_client_appointments" USING "btree" ("automation_client_id");



CREATE INDEX "idx_automation_appointments_date" ON "public"."automation_client_appointments" USING "btree" ("start_datetime");



CREATE INDEX "idx_automation_appointments_org" ON "public"."automation_client_appointments" USING "btree" ("organization_id");



CREATE INDEX "idx_automation_appointments_status" ON "public"."automation_client_appointments" USING "btree" ("status");



CREATE INDEX "idx_automation_briefings_client" ON "public"."automation_briefings" USING "btree" ("automation_client_id");



CREATE INDEX "idx_automation_briefings_org" ON "public"."automation_briefings" USING "btree" ("organization_id");



CREATE INDEX "idx_automation_briefings_type" ON "public"."automation_briefings" USING "btree" ("briefing_type");



CREATE INDEX "idx_automation_clients_client" ON "public"."automation_clients" USING "btree" ("client_id");



CREATE INDEX "idx_automation_clients_org" ON "public"."automation_clients" USING "btree" ("organization_id");



CREATE INDEX "idx_automation_clients_status" ON "public"."automation_clients" USING "btree" ("status");



CREATE INDEX "idx_automation_contracts_client" ON "public"."automation_contracts" USING "btree" ("automation_client_id");



CREATE INDEX "idx_automation_contracts_org" ON "public"."automation_contracts" USING "btree" ("organization_id");



CREATE INDEX "idx_automation_contracts_status" ON "public"."automation_contracts" USING "btree" ("status");



CREATE INDEX "idx_automation_documents_client" ON "public"."automation_client_documents" USING "btree" ("automation_client_id");



CREATE INDEX "idx_automation_documents_org" ON "public"."automation_client_documents" USING "btree" ("organization_id");



CREATE INDEX "idx_automation_documents_type" ON "public"."automation_client_documents" USING "btree" ("document_type");



CREATE INDEX "idx_automation_feedbacks_client" ON "public"."automation_client_feedbacks" USING "btree" ("automation_client_id");



CREATE INDEX "idx_automation_feedbacks_org" ON "public"."automation_client_feedbacks" USING "btree" ("organization_id");



CREATE INDEX "idx_automation_feedbacks_status" ON "public"."automation_client_feedbacks" USING "btree" ("status");



CREATE INDEX "idx_automation_feedbacks_type" ON "public"."automation_client_feedbacks" USING "btree" ("feedback_type");



CREATE INDEX "idx_automation_meetings_client" ON "public"."automation_meeting_transcriptions" USING "btree" ("automation_client_id");



CREATE INDEX "idx_automation_meetings_date" ON "public"."automation_meeting_transcriptions" USING "btree" ("meeting_date" DESC);



CREATE INDEX "idx_automation_meetings_org" ON "public"."automation_meeting_transcriptions" USING "btree" ("organization_id");



CREATE INDEX "idx_automation_processes_client" ON "public"."automation_processes" USING "btree" ("automation_client_id");



CREATE INDEX "idx_automation_processes_org" ON "public"."automation_processes" USING "btree" ("organization_id");



CREATE INDEX "idx_automation_processes_stage" ON "public"."automation_processes" USING "btree" ("stage", "position");



CREATE INDEX "idx_automation_processes_status" ON "public"."automation_processes" USING "btree" ("status");



CREATE INDEX "idx_automation_processes_type" ON "public"."automation_processes" USING "btree" ("process_type");



CREATE INDEX "idx_crm_leads_has_whatsapp" ON "public"."crm_leads" USING "btree" ("has_whatsapp") WHERE ("has_whatsapp" = true);



CREATE INDEX "idx_crm_leads_kanban_pagination" ON "public"."crm_leads" USING "btree" ("organization_id", "stage", "created_at" DESC);



COMMENT ON INDEX "public"."idx_crm_leads_kanban_pagination" IS 'Índice otimizado para paginação de leads no kanban por estágio e data de criação';



CREATE INDEX "idx_crm_leads_kanban_search" ON "public"."crm_leads" USING "btree" ("organization_id", "name" "text_pattern_ops", "whatsapp" "text_pattern_ops", "email" "text_pattern_ops");



COMMENT ON INDEX "public"."idx_crm_leads_kanban_search" IS 'Índice para busca de texto (ILIKE) em nome, whatsapp e email';



CREATE INDEX "idx_crm_leads_org_canal" ON "public"."crm_leads" USING "btree" ("organization_id", "canal") WHERE ("canal" IS NOT NULL);



COMMENT ON INDEX "public"."idx_crm_leads_org_canal" IS 'Índice para filtro de canal por organização';



CREATE INDEX "idx_crm_leads_org_count" ON "public"."crm_leads" USING "btree" ("organization_id") WHERE ("organization_id" IS NOT NULL);



CREATE INDEX "idx_crm_leads_org_created_at" ON "public"."crm_leads" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_crm_leads_org_email" ON "public"."crm_leads" USING "btree" ("organization_id", "email_normalized") WHERE ("email_normalized" IS NOT NULL);



CREATE INDEX "idx_crm_leads_org_has_payment_true" ON "public"."crm_leads" USING "btree" ("organization_id") WHERE ("has_payment" IS TRUE);



CREATE INDEX "idx_crm_leads_org_highlight" ON "public"."crm_leads" USING "btree" ("organization_id") WHERE ("is_highlight" IS TRUE);



CREATE INDEX "idx_crm_leads_org_phone" ON "public"."crm_leads" USING "btree" ("organization_id", "phone_normalized") WHERE ("phone_normalized" IS NOT NULL);



CREATE INDEX "idx_crm_leads_org_priority" ON "public"."crm_leads" USING "btree" ("organization_id", "priority") WHERE ("priority" IS NOT NULL);



COMMENT ON INDEX "public"."idx_crm_leads_org_priority" IS 'Índice para filtro de prioridade por organização';



CREATE INDEX "idx_crm_leads_org_priority_high" ON "public"."crm_leads" USING "btree" ("organization_id") WHERE ("priority" = 'high'::"text");



CREATE INDEX "idx_crm_leads_org_source" ON "public"."crm_leads" USING "btree" ("organization_id", "source") WHERE ("source" IS NOT NULL);



COMMENT ON INDEX "public"."idx_crm_leads_org_source" IS 'Índice para filtro de origem por organização';



CREATE INDEX "idx_crm_leads_org_stage" ON "public"."crm_leads" USING "btree" ("organization_id", "stage");



CREATE INDEX "idx_crm_leads_stage_order" ON "public"."crm_leads" USING "btree" ("organization_id", "stage", "stage_order");



CREATE INDEX "idx_events_feature" ON "public"."analytics_events" USING "btree" ("feature_key");



CREATE INDEX "idx_events_metadata_gin" ON "public"."analytics_events" USING "gin" ("metadata");



CREATE INDEX "idx_events_name_time" ON "public"."analytics_events" USING "btree" ("event_name", "ingested_at" DESC);



CREATE INDEX "idx_events_org_time" ON "public"."analytics_events" USING "btree" ("organization_id", "ingested_at");



CREATE INDEX "idx_james_org" ON "public"."james" USING "btree" ("organization_id");



CREATE INDEX "idx_manychat_credentials_org" ON "public"."manychat_credentials" USING "btree" ("organization_id");



CREATE INDEX "idx_n8n_connections_org" ON "public"."n8n_connections" USING "btree" ("organization_id");



CREATE INDEX "idx_produto_variantes_org" ON "public"."produto_variantes" USING "btree" ("organization_id");



CREATE INDEX "idx_produto_variantes_produto" ON "public"."produto_variantes" USING "btree" ("produto_id");



CREATE INDEX "idx_produtos_relacionados_org" ON "public"."produtos_relacionados" USING "btree" ("organization_id");



CREATE INDEX "idx_produtos_servicos_status" ON "public"."produtos_servicos" USING "btree" ("status");



CREATE INDEX "idx_produtos_servicos_tags_gin" ON "public"."produtos_servicos" USING "gin" ("tags");



CREATE INDEX "idx_qna_pairs_categoria" ON "public"."qna_pairs" USING "btree" ("categoria");



CREATE INDEX "idx_qna_pairs_org" ON "public"."qna_pairs" USING "btree" ("organization_id");



CREATE INDEX "idx_qna_pairs_search" ON "public"."qna_pairs" USING "gin" ("to_tsvector"('"portuguese"'::"regconfig", ((((COALESCE("pergunta", ''::"text") || ' '::"text") || COALESCE("resposta", ''::"text")) || ' '::"text") || COALESCE("categoria", ''::"text"))));



CREATE INDEX "idx_report_filter_presets_org_user" ON "public"."report_filter_presets" USING "btree" ("organization_id", "user_id");



CREATE INDEX "idx_rm_org_sender" ON "public"."repositorio_de_mensagens" USING "btree" ("organization_id", "sender_type");



CREATE INDEX "idx_rm_org_time" ON "public"."repositorio_de_mensagens" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_rm_org_whats" ON "public"."repositorio_de_mensagens" USING "btree" ("organization_id", "whatsapp_cliente", "whatsapp_empresa");



CREATE INDEX "idx_trail_notes_lesson_key" ON "public"."trail_notes" USING "btree" ("lesson_key");



CREATE INDEX "idx_trail_notes_org_trail" ON "public"."trail_notes" USING "btree" ("organization_id", "trail_type");



CREATE INDEX "idx_trail_notes_updated_at" ON "public"."trail_notes" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_user_dashboard_prefs_org_user" ON "public"."user_dashboard_prefs" USING "btree" ("organization_id", "user_id");



CREATE INDEX "idx_whatsapp_conversations_last_msg" ON "public"."whatsapp_conversations" USING "btree" ("organization_id", "last_message_at" DESC);



CREATE INDEX "idx_whatsapp_messages_conv_time" ON "public"."whatsapp_messages" USING "btree" ("conversation_id", "timestamp" DESC);



CREATE INDEX "idx_whatsapp_messages_org_instance_time" ON "public"."whatsapp_messages" USING "btree" ("organization_id", "instance_id", "timestamp" DESC);



CREATE INDEX "idx_whatsapp_user_webhooks_active" ON "public"."whatsapp_user_webhooks" USING "btree" ("is_active");



CREATE INDEX "idx_whatsapp_user_webhooks_org" ON "public"."whatsapp_user_webhooks" USING "btree" ("organization_id");



CREATE INDEX "investimentos_marketing_organization_id_idx" ON "public"."investimentos_marketing" USING "btree" ("organization_id");



CREATE INDEX "monetization_trail_progress_completed_idx" ON "public"."monetization_trail_progress" USING "btree" ("completed");



CREATE INDEX "monetization_trail_progress_org_idx" ON "public"."monetization_trail_progress" USING "btree" ("organization_id");



CREATE INDEX "n8n_credentials_active_idx" ON "public"."n8n_credentials" USING "btree" ("is_active");



CREATE INDEX "n8n_credentials_organization_id_idx" ON "public"."n8n_credentials" USING "btree" ("organization_id");



CREATE INDEX "n8n_workflows_active_idx" ON "public"."n8n_workflows" USING "btree" ("is_active");



CREATE INDEX "n8n_workflows_n8n_id_idx" ON "public"."n8n_workflows" USING "btree" ("n8n_workflow_id");



CREATE INDEX "n8n_workflows_org_idx" ON "public"."n8n_workflows" USING "btree" ("organization_id");



CREATE INDEX "notifications_created_at_idx" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "notifications_lida_idx" ON "public"."notifications" USING "btree" ("lida");



CREATE INDEX "notifications_metadata_gin_idx" ON "public"."notifications" USING "gin" ("metadata");



CREATE INDEX "notifications_organization_id_created_at_idx" ON "public"."notifications" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "notifications_organization_id_fkey" ON "public"."notifications" USING "btree" ("organization_id");



CREATE INDEX "notifications_tipo_created_at_idx" ON "public"."notifications" USING "btree" ("tipo", "created_at" DESC);



CREATE INDEX "notifications_user_id_idx" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "notifications_user_id_lida_idx" ON "public"."notifications" USING "btree" ("user_id", "lida");



CREATE INDEX "pagamentos_data_pagamento_idx" ON "public"."pagamentos" USING "btree" ("data_pagamento" DESC);



CREATE INDEX "pagamentos_organization_id_idx" ON "public"."pagamentos" USING "btree" ("organization_id");



CREATE INDEX "produto_variantes_org_idx" ON "public"."produto_variantes" USING "btree" ("organization_id");



CREATE INDEX "produto_variantes_produto_idx" ON "public"."produto_variantes" USING "btree" ("produto_id");



CREATE INDEX "produtos_servicos_ativo_idx" ON "public"."produtos_servicos" USING "btree" ("ativo");



CREATE INDEX "produtos_servicos_categoria_idx" ON "public"."produtos_servicos" USING "btree" ("categoria");



CREATE UNIQUE INDEX "produtos_servicos_org_sku_uniq" ON "public"."produtos_servicos" USING "btree" ("organization_id", "sku") WHERE ("sku" IS NOT NULL);



CREATE INDEX "produtos_servicos_organization_id_idx" ON "public"."produtos_servicos" USING "btree" ("organization_id");



CREATE INDEX "produtos_servicos_tipo_idx" ON "public"."produtos_servicos" USING "btree" ("tipo");



CREATE INDEX "rag_items_category_idx" ON "public"."rag_items" USING "btree" ("category");



CREATE INDEX "rag_items_embedding_ivfflat" ON "public"."rag_items" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "rag_items_org_idx" ON "public"."rag_items" USING "btree" ("organization_id");



CREATE INDEX "rag_items_source_idx" ON "public"."rag_items" USING "btree" ("source_id");



CREATE INDEX "rag_sources_org_idx" ON "public"."rag_sources" USING "btree" ("organization_id");



CREATE INDEX "repositorio_de_mensagens_cliente_idx" ON "public"."repositorio_de_mensagens" USING "btree" ("whatsapp_cliente");



CREATE INDEX "repositorio_de_mensagens_conv_idx" ON "public"."repositorio_de_mensagens" USING "btree" ("conversation_id");



CREATE INDEX "repositorio_de_mensagens_created_at_idx" ON "public"."repositorio_de_mensagens" USING "btree" ("created_at" DESC);



CREATE INDEX "repositorio_de_mensagens_emb_hnsw" ON "public"."repositorio_de_mensagens" USING "hnsw" ("embedding" "public"."vector_cosine_ops");



CREATE INDEX "repositorio_de_mensagens_org_created_idx" ON "public"."repositorio_de_mensagens" USING "btree" ("organization_id", "created_at" DESC);



CREATE UNIQUE INDEX "repositorio_de_mensagens_provider_message_id_uk" ON "public"."repositorio_de_mensagens" USING "btree" ("provider_message_id") WHERE ("provider_message_id" IS NOT NULL);



CREATE INDEX "repositorio_de_mensagens_sender_idx" ON "public"."repositorio_de_mensagens" USING "btree" ("sender_type");



CREATE INDEX "repositorio_de_mensagens_tsv_idx" ON "public"."repositorio_de_mensagens" USING "gin" ("tsv");



CREATE UNIQUE INDEX "saas_organizations_client_token_uidx" ON "public"."saas_organizations" USING "btree" ("client_token");



CREATE INDEX "saas_organizations_owner_id_idx" ON "public"."saas_organizations" USING "btree" ("owner_id");



CREATE INDEX "saas_organizations_slug_idx" ON "public"."saas_organizations" USING "btree" ("slug");



CREATE INDEX "saidas_categoria_idx" ON "public"."saidas" USING "btree" ("categoria");



CREATE INDEX "saidas_data_saida_idx" ON "public"."saidas" USING "btree" ("data_saida" DESC);



CREATE INDEX "saidas_organization_id_idx" ON "public"."saidas" USING "btree" ("organization_id");



CREATE INDEX "saidas_recorrente_idx" ON "public"."saidas" USING "btree" ("recorrente");



CREATE INDEX "servicos_organization_id_idx" ON "public"."servicos" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "uniq_whatsapp_contact_phone" ON "public"."whatsapp_contacts" USING "btree" ("organization_id", "phone_e164");



CREATE UNIQUE INDEX "uniq_whatsapp_conversation_contact" ON "public"."whatsapp_conversations" USING "btree" ("organization_id", "contact_id");



CREATE UNIQUE INDEX "uniq_whatsapp_integration_active" ON "public"."whatsapp_integrations" USING "btree" ("organization_id") WHERE ("is_active" = true);



CREATE UNIQUE INDEX "uniq_whatsapp_integration_org_provider" ON "public"."whatsapp_integrations" USING "btree" ("organization_id", "provider");



CREATE UNIQUE INDEX "uniq_whatsapp_msg_provider_id" ON "public"."whatsapp_messages" USING "btree" ("organization_id", "provider_message_id") WHERE ("provider_message_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_produtos_relacionados_pair" ON "public"."produtos_relacionados" USING "btree" ("produto_id", "relacionado_id");



CREATE INDEX "user_invitations_organization_id_idx" ON "public"."user_invitations" USING "btree" ("organization_id");



CREATE INDEX "user_invitations_token_idx" ON "public"."user_invitations" USING "btree" ("token");



CREATE INDEX "users_email_idx" ON "public"."users" USING "btree" ("email");



CREATE INDEX "users_organization_id_idx" ON "public"."users" USING "btree" ("organization_id");



CREATE INDEX "users_role_idx" ON "public"."users" USING "btree" ("role");



CREATE INDEX "webhook_configurations_active_idx" ON "public"."webhook_configurations" USING "btree" ("is_active");



CREATE INDEX "webhook_configurations_organization_id_idx" ON "public"."webhook_configurations" USING "btree" ("organization_id");



CREATE INDEX "webhook_event_types_category_idx" ON "public"."webhook_event_types" USING "btree" ("category");



CREATE INDEX "webhook_events_created_at_idx" ON "public"."webhook_events" USING "btree" ("created_at" DESC);



CREATE INDEX "webhook_events_org_idx" ON "public"."webhook_events" USING "btree" ("organization_id");



CREATE INDEX "webhook_events_organization_id_idx" ON "public"."webhook_events" USING "btree" ("organization_id");



CREATE INDEX "webhook_events_status_idx" ON "public"."webhook_events" USING "btree" ("status");



CREATE INDEX "webhook_logs_organization_id_idx" ON "public"."webhook_logs" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "whatsapp_instances_client_token_uidx" ON "public"."whatsapp_instances" USING "btree" ("client_token");



CREATE UNIQUE INDEX "whatsapp_instances_instance_token_uidx" ON "public"."whatsapp_instances" USING "btree" ("instance_token");



CREATE UNIQUE INDEX "whatsapp_instances_instance_uidx" ON "public"."whatsapp_instances" USING "btree" ("instance_id");



CREATE INDEX "whatsapp_instances_org_idx" ON "public"."whatsapp_instances" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "whatsapp_instances_org_instance_uidx" ON "public"."whatsapp_instances" USING "btree" ("organization_id", "instance_id");



CREATE RULE "appointments_api_insert" AS
    ON INSERT TO "public"."appointments_api" DO INSTEAD  INSERT INTO "public"."appointments" ("organization_id", "datetime", "duration_minutes", "tipo", "status", "criado_por", "anotacoes", "arquivos", "valor_consulta", "client_id", "lead_id", "collaborator_id", "title", "created_at")
  VALUES ("public"."safe_uuid"("new"."organization_id"), "new"."datetime", COALESCE("new"."duration_minutes", 30), "new"."tipo", COALESCE(NULLIF("new"."status", ''::"text"), 'agendado'::"text"), "public"."safe_uuid"("new"."criado_por"), NULLIF("new"."anotacoes", ''::"text"), "new"."arquivos", "new"."valor_consulta", "public"."safe_uuid"("new"."client_id"), "public"."safe_uuid"("new"."lead_id"), "public"."safe_uuid"("new"."collaborator_id"), NULLIF("new"."title", ''::"text"), COALESCE("new"."created_at", "now"()))
  RETURNING "appointments"."id",
    ("appointments"."organization_id")::"text" AS "organization_id",
    "appointments"."datetime",
    "appointments"."duration_minutes",
    "appointments"."tipo",
    "appointments"."status",
    ("appointments"."criado_por")::"text" AS "criado_por",
    "appointments"."anotacoes",
    "appointments"."arquivos",
    "appointments"."valor_consulta",
    "appointments"."created_at",
    ("appointments"."client_id")::"text" AS "client_id",
    ("appointments"."lead_id")::"text" AS "lead_id",
    ("appointments"."collaborator_id")::"text" AS "collaborator_id",
    "appointments"."title",
    "appointments"."updated_at";



CREATE RULE "appointments_api_update" AS
    ON UPDATE TO "public"."appointments_api" DO INSTEAD  UPDATE "public"."appointments" SET "datetime" = COALESCE("new"."datetime", "appointments"."datetime"), "duration_minutes" = COALESCE("new"."duration_minutes", "appointments"."duration_minutes"), "tipo" = COALESCE("new"."tipo", "appointments"."tipo"), "status" = COALESCE(NULLIF("new"."status", ''::"text"), "appointments"."status"), "criado_por" = COALESCE("public"."safe_uuid"("new"."criado_por"), "appointments"."criado_por"), "anotacoes" = COALESCE(NULLIF("new"."anotacoes", ''::"text"), "appointments"."anotacoes"), "arquivos" = COALESCE("new"."arquivos", "appointments"."arquivos"), "valor_consulta" = COALESCE("new"."valor_consulta", "appointments"."valor_consulta"), "client_id" = COALESCE("public"."safe_uuid"("new"."client_id"), "appointments"."client_id"), "lead_id" = COALESCE("public"."safe_uuid"("new"."lead_id"), "appointments"."lead_id"), "collaborator_id" = COALESCE("public"."safe_uuid"("new"."collaborator_id"), "appointments"."collaborator_id"), "title" = COALESCE(NULLIF("new"."title", ''::"text"), "appointments"."title"), "updated_at" = "now"()
  WHERE ("appointments"."id" = "new"."id")
  RETURNING "appointments"."id",
    ("appointments"."organization_id")::"text" AS "organization_id",
    "appointments"."datetime",
    "appointments"."duration_minutes",
    "appointments"."tipo",
    "appointments"."status",
    ("appointments"."criado_por")::"text" AS "criado_por",
    "appointments"."anotacoes",
    "appointments"."arquivos",
    "appointments"."valor_consulta",
    "appointments"."created_at",
    ("appointments"."client_id")::"text" AS "client_id",
    ("appointments"."lead_id")::"text" AS "lead_id",
    ("appointments"."collaborator_id")::"text" AS "collaborator_id",
    "appointments"."title",
    "appointments"."updated_at";



CREATE RULE "professionals_delete" AS
    ON DELETE TO "public"."professionals" DO INSTEAD  DELETE FROM "public"."collaborators"
  WHERE ("collaborators"."id" = "old"."id")
  RETURNING "old"."id",
    "old"."organization_id",
    "old"."name",
    "old"."position",
    "old"."email",
    "old"."phone",
    "old"."credentials",
    "old"."notes",
    "old"."active",
    "old"."created_at",
    "now"() AS "updated_at",
    0 AS "total_consultations",
    0 AS "consultations_this_month",
    0 AS "upcoming_appointments",
    NULL::numeric AS "average_rating",
    '[]'::"jsonb" AS "upcoming_appointments_details",
    "old"."position" AS "specialty";



CREATE RULE "professionals_insert" AS
    ON INSERT TO "public"."professionals" DO INSTEAD  INSERT INTO "public"."collaborators" ("id", "organization_id", "name", "position", "email", "phone", "credentials", "notes", "active", "created_at", "updated_at")
  VALUES (COALESCE("new"."id", "gen_random_uuid"()), "new"."organization_id", "new"."name", "new"."position", "new"."email", "new"."phone", "new"."credentials", "new"."notes", COALESCE("new"."active", true), COALESCE("new"."created_at", "now"()), COALESCE("new"."updated_at", "now"()))
  RETURNING "collaborators"."id",
    "collaborators"."organization_id",
    "collaborators"."name",
    "collaborators"."position",
    "collaborators"."email",
    "collaborators"."phone",
    "collaborators"."credentials",
    "collaborators"."notes",
    "collaborators"."active",
    "collaborators"."created_at",
    "collaborators"."updated_at",
    0 AS "total_consultations",
    0 AS "consultations_this_month",
    0 AS "upcoming_appointments",
    NULL::numeric AS "average_rating",
    '[]'::"jsonb" AS "upcoming_appointments_details",
    "collaborators"."position" AS "specialty";



CREATE RULE "professionals_update" AS
    ON UPDATE TO "public"."professionals" DO INSTEAD  UPDATE "public"."collaborators" SET "name" = COALESCE("new"."name", "collaborators"."name"), "position" = COALESCE("new"."position", "collaborators"."position"), "email" = COALESCE("new"."email", "collaborators"."email"), "phone" = COALESCE("new"."phone", "collaborators"."phone"), "credentials" = COALESCE("new"."credentials", "collaborators"."credentials"), "notes" = COALESCE("new"."notes", "collaborators"."notes"), "active" = COALESCE("new"."active", "collaborators"."active"), "updated_at" = "now"()
  WHERE ("collaborators"."id" = "new"."id")
  RETURNING "collaborators"."id",
    "collaborators"."organization_id",
    "collaborators"."name",
    "collaborators"."position",
    "collaborators"."email",
    "collaborators"."phone",
    "collaborators"."credentials",
    "collaborators"."notes",
    "collaborators"."active",
    "collaborators"."created_at",
    "collaborators"."updated_at",
    0 AS "total_consultations",
    0 AS "consultations_this_month",
    0 AS "upcoming_appointments",
    NULL::numeric AS "average_rating",
    '[]'::"jsonb" AS "upcoming_appointments_details",
    "collaborators"."position" AS "specialty";



CREATE OR REPLACE TRIGGER "ai_agent_workflows_update_updated_at_trigger" BEFORE UPDATE ON "public"."ai_agent_workflows" FOR EACH ROW EXECUTE FUNCTION "public"."ai_agent_workflows_update_updated_at"();



CREATE OR REPLACE TRIGGER "auto_consultation_trigger" AFTER UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."auto_create_consultation"();



CREATE OR REPLACE TRIGGER "auto_convert_on_close" AFTER UPDATE ON "public"."crm_leads" FOR EACH ROW EXECUTE FUNCTION "public"."trg_auto_convert_on_close"();



CREATE OR REPLACE TRIGGER "automation_appointment_created" AFTER INSERT ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."webhook_trigger_appointment_created"();



CREATE OR REPLACE TRIGGER "automation_appointment_status_changed" AFTER UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."webhook_trigger_appointment_status_changed"();



CREATE OR REPLACE TRIGGER "automation_appointment_updated" AFTER UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."webhook_trigger_appointment_updated"();



CREATE OR REPLACE TRIGGER "automation_client_updated" AFTER UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."webhook_trigger_client_updated"();



CREATE OR REPLACE TRIGGER "automation_collaborator_created" AFTER INSERT ON "public"."collaborators" FOR EACH ROW EXECUTE FUNCTION "public"."webhook_trigger_collaborator_created"();



CREATE OR REPLACE TRIGGER "automation_collaborator_updated" AFTER UPDATE ON "public"."collaborators" FOR EACH ROW EXECUTE FUNCTION "public"."webhook_trigger_collaborator_updated"();



CREATE OR REPLACE TRIGGER "automation_lead_converted" AFTER UPDATE ON "public"."crm_leads" FOR EACH ROW EXECUTE FUNCTION "public"."webhook_trigger_lead_converted"();



CREATE OR REPLACE TRIGGER "automation_lead_created" AFTER INSERT ON "public"."crm_leads" FOR EACH ROW EXECUTE FUNCTION "public"."webhook_trigger_lead_created"();



CREATE OR REPLACE TRIGGER "automation_lead_stage_changed" AFTER UPDATE ON "public"."crm_leads" FOR EACH ROW EXECUTE FUNCTION "public"."webhook_trigger_lead_stage_changed"();



CREATE OR REPLACE TRIGGER "automation_lead_updated" AFTER UPDATE ON "public"."crm_leads" FOR EACH ROW EXECUTE FUNCTION "public"."webhook_trigger_lead_updated"();



CREATE OR REPLACE TRIGGER "automation_notification_created" AFTER INSERT ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_notification_created"();



CREATE OR REPLACE TRIGGER "automation_payment_received" AFTER INSERT OR UPDATE ON "public"."pagamentos" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_payment_received"();



CREATE OR REPLACE TRIGGER "automation_payment_received_ins" AFTER INSERT ON "public"."pagamentos" FOR EACH ROW EXECUTE FUNCTION "public"."webhook_trigger_payment_received"();



CREATE OR REPLACE TRIGGER "automation_payment_received_upd" AFTER UPDATE ON "public"."pagamentos" FOR EACH ROW EXECUTE FUNCTION "public"."webhook_trigger_payment_received"();



CREATE OR REPLACE TRIGGER "automation_product_created" AFTER INSERT ON "public"."produtos_servicos" FOR EACH ROW EXECUTE FUNCTION "public"."webhook_trigger_product_created"();



CREATE OR REPLACE TRIGGER "automation_product_updated" AFTER UPDATE ON "public"."produtos_servicos" FOR EACH ROW EXECUTE FUNCTION "public"."webhook_trigger_product_updated"();



CREATE OR REPLACE TRIGGER "consultation_sync_trigger" AFTER INSERT OR UPDATE ON "public"."consultations" FOR EACH ROW EXECUTE FUNCTION "public"."sync_appointment_consultation"();



CREATE OR REPLACE TRIGGER "crm_lead_activity_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."crm_leads" FOR EACH ROW EXECUTE FUNCTION "public"."log_crm_lead_changes"();



CREATE OR REPLACE TRIGGER "entradas_from_clients_del" AFTER DELETE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."trg_entradas_from_clients_del"();



CREATE OR REPLACE TRIGGER "entradas_from_clients_upd" AFTER UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."trg_entradas_from_clients"();



CREATE OR REPLACE TRIGGER "entradas_from_leads_del" AFTER DELETE ON "public"."crm_leads" FOR EACH ROW EXECUTE FUNCTION "public"."trg_entradas_from_leads_del"();



CREATE OR REPLACE TRIGGER "entradas_from_leads_ins" AFTER INSERT ON "public"."crm_leads" FOR EACH ROW EXECUTE FUNCTION "public"."trg_entradas_from_leads"();



CREATE OR REPLACE TRIGGER "entradas_from_leads_upd" AFTER UPDATE ON "public"."crm_leads" FOR EACH ROW EXECUTE FUNCTION "public"."trg_entradas_from_leads"();



CREATE OR REPLACE TRIGGER "entradas_from_pagamentos_del" AFTER DELETE ON "public"."pagamentos" FOR EACH ROW EXECUTE FUNCTION "public"."trg_entradas_from_pagamentos_del"();



CREATE OR REPLACE TRIGGER "entradas_from_pagamentos_ins" AFTER INSERT ON "public"."pagamentos" FOR EACH ROW EXECUTE FUNCTION "public"."trg_entradas_from_pagamentos"();



CREATE OR REPLACE TRIGGER "entradas_from_pagamentos_upd" AFTER UPDATE ON "public"."pagamentos" FOR EACH ROW EXECUTE FUNCTION "public"."trg_entradas_from_pagamentos"();



CREATE OR REPLACE TRIGGER "monetization_trail_progress_set_updated_at" BEFORE UPDATE ON "public"."monetization_trail_progress" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "notify_client_changes" AFTER INSERT OR UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."notify_client_changes"();



CREATE OR REPLACE TRIGGER "notify_collaborator_changes" AFTER INSERT OR UPDATE ON "public"."collaborators" FOR EACH ROW EXECUTE FUNCTION "public"."notify_collaborator_changes"();



CREATE OR REPLACE TRIGGER "recalc_lead_value_on_interest" AFTER INSERT OR UPDATE OF "interest_produto_servico_id", "interest_quantity" ON "public"."crm_leads" FOR EACH ROW EXECUTE FUNCTION "public"."trg_recalc_lead_value_on_interest"();



CREATE OR REPLACE TRIGGER "recalc_lead_value_on_leads" AFTER INSERT OR UPDATE OF "interests" ON "public"."crm_leads" FOR EACH ROW EXECUTE FUNCTION "public"."trg_recalc_lead_value_on_leads"();



CREATE OR REPLACE TRIGGER "set_timestamp_on_agent_prompts" BEFORE UPDATE ON "public"."agent_prompts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_timestamp_on_james" BEFORE UPDATE ON "public"."james" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_timestamp_on_manychat_credentials" BEFORE UPDATE ON "public"."manychat_credentials" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_timestamp_on_qna_pairs" BEFORE UPDATE ON "public"."qna_pairs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_timestamp_on_whatsapp_instances" BEFORE UPDATE ON "public"."whatsapp_instances" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "sync_client_payment_from_lead" AFTER UPDATE ON "public"."crm_leads" FOR EACH ROW EXECUTE FUNCTION "public"."trg_sync_client_payment_from_lead"();



CREATE OR REPLACE TRIGGER "trail_notes_set_updated_at_trigger" BEFORE UPDATE ON "public"."trail_notes" FOR EACH ROW EXECUTE FUNCTION "public"."trail_notes_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_crm_leads_fix_stage_case" BEFORE INSERT OR UPDATE OF "stage" ON "public"."crm_leads" FOR EACH ROW EXECUTE FUNCTION "public"."trg_crm_leads_fix_stage_case"();



CREATE OR REPLACE TRIGGER "trg_n8n_conn_updated_at" BEFORE UPDATE ON "public"."n8n_connections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_rag_items_set_org_from_context" BEFORE INSERT ON "public"."rag_items" FOR EACH ROW EXECUTE FUNCTION "public"."rag_set_org_from_context"();



CREATE OR REPLACE TRIGGER "trg_rag_sources_set_org_from_context" BEFORE INSERT ON "public"."rag_sources" FOR EACH ROW EXECUTE FUNCTION "public"."rag_set_org_from_context"();



CREATE OR REPLACE TRIGGER "trg_rm_set_org_from_context" BEFORE INSERT ON "public"."repositorio_de_mensagens" FOR EACH ROW EXECUTE FUNCTION "public"."rm_set_org_from_context"();



CREATE OR REPLACE TRIGGER "trg_set_client_token_if_missing" BEFORE INSERT ON "public"."saas_organizations" FOR EACH ROW EXECUTE FUNCTION "public"."set_client_token_if_missing"();



CREATE OR REPLACE TRIGGER "trg_sync_org_to_master_aiud" AFTER INSERT OR DELETE OR UPDATE ON "public"."saas_organizations" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notify_master_on_client_org_change"();



CREATE OR REPLACE TRIGGER "trigger_appointment_notifications" AFTER INSERT OR UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_appointment_changes"();



CREATE OR REPLACE TRIGGER "trigger_client_notifications" AFTER INSERT OR UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."notify_client_changes"();



CREATE OR REPLACE TRIGGER "trigger_collaborator_notifications" AFTER INSERT OR UPDATE ON "public"."collaborators" FOR EACH ROW EXECUTE FUNCTION "public"."notify_collaborator_changes"();



CREATE OR REPLACE TRIGGER "trigger_consultation_notifications" AFTER INSERT OR UPDATE ON "public"."consultations" FOR EACH ROW EXECUTE FUNCTION "public"."notify_consultation_changes"();



CREATE OR REPLACE TRIGGER "trigger_create_user_on_organization" AFTER INSERT ON "public"."saas_organizations" FOR EACH ROW EXECUTE FUNCTION "public"."create_user_on_organization"();



CREATE OR REPLACE TRIGGER "trigger_expense_notifications" AFTER INSERT OR UPDATE ON "public"."despesas" FOR EACH ROW EXECUTE FUNCTION "public"."notify_expense_changes"();



CREATE OR REPLACE TRIGGER "trigger_lead_notifications" AFTER INSERT OR UPDATE ON "public"."crm_leads" FOR EACH ROW EXECUTE FUNCTION "public"."notify_lead_changes"();

ALTER TABLE "public"."crm_leads" DISABLE TRIGGER "trigger_lead_notifications";



CREATE OR REPLACE TRIGGER "trigger_notify_appointment_status_change" AFTER UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_appointment_status_change"();



CREATE OR REPLACE TRIGGER "trigger_notify_consultation_completed" AFTER INSERT ON "public"."consultations" FOR EACH ROW EXECUTE FUNCTION "public"."notify_consultation_completed"();



CREATE OR REPLACE TRIGGER "trigger_notify_important_expense" AFTER INSERT ON "public"."despesas" FOR EACH ROW EXECUTE FUNCTION "public"."notify_important_expense"();



CREATE OR REPLACE TRIGGER "trigger_notify_lead_stage_change" AFTER UPDATE ON "public"."crm_leads" FOR EACH ROW EXECUTE FUNCTION "public"."notify_lead_stage_change"();

ALTER TABLE "public"."crm_leads" DISABLE TRIGGER "trigger_notify_lead_stage_change";



CREATE OR REPLACE TRIGGER "trigger_notify_marketing_investment" AFTER INSERT ON "public"."investimentos_marketing" FOR EACH ROW EXECUTE FUNCTION "public"."notify_marketing_investment"();



CREATE OR REPLACE TRIGGER "trigger_notify_new_appointment" AFTER INSERT ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_new_appointment"();



CREATE OR REPLACE TRIGGER "trigger_notify_new_lead" AFTER INSERT ON "public"."crm_leads" FOR EACH ROW EXECUTE FUNCTION "public"."notify_new_lead"();

ALTER TABLE "public"."crm_leads" DISABLE TRIGGER "trigger_notify_new_lead";



CREATE OR REPLACE TRIGGER "trigger_notify_new_payment" AFTER INSERT ON "public"."pagamentos" FOR EACH ROW EXECUTE FUNCTION "public"."notify_new_payment"();



CREATE OR REPLACE TRIGGER "trigger_payment_notifications" AFTER INSERT OR UPDATE ON "public"."pagamentos" FOR EACH ROW EXECUTE FUNCTION "public"."notify_payment_changes"();



CREATE OR REPLACE TRIGGER "tutorial_manychat_progress_set_updated_at" BEFORE UPDATE ON "public"."tutorial_manychat_progress" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "update_appointments_updated_at_trigger" BEFORE UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."update_appointments_updated_at"();



CREATE OR REPLACE TRIGGER "update_automation_appointments_updated_at" BEFORE UPDATE ON "public"."automation_client_appointments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_automation_briefings_updated_at" BEFORE UPDATE ON "public"."automation_briefings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_automation_clients_updated_at" BEFORE UPDATE ON "public"."automation_clients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_automation_contracts_updated_at" BEFORE UPDATE ON "public"."automation_contracts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_automation_documents_updated_at" BEFORE UPDATE ON "public"."automation_client_documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_automation_feedbacks_updated_at" BEFORE UPDATE ON "public"."automation_client_feedbacks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_automation_meetings_updated_at" BEFORE UPDATE ON "public"."automation_meeting_transcriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_automation_processes_updated_at" BEFORE UPDATE ON "public"."automation_processes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_calendar_events_updated_at" BEFORE UPDATE ON "public"."calendar_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clients_updated_at" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_collaborators_updated_at" BEFORE UPDATE ON "public"."collaborators" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_crm_leads_updated_at" BEFORE UPDATE ON "public"."crm_leads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

ALTER TABLE "public"."crm_leads" DISABLE TRIGGER "update_crm_leads_updated_at";



CREATE OR REPLACE TRIGGER "update_crm_stages_updated_at" BEFORE UPDATE ON "public"."crm_stages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_entradas_source_links_updated_at" BEFORE UPDATE ON "public"."entradas_source_links" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_entradas_updated_at" BEFORE UPDATE ON "public"."entradas" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_external_integrations_updated_at" BEFORE UPDATE ON "public"."external_integrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_n8n_credentials_updated_at" BEFORE UPDATE ON "public"."n8n_credentials" FOR EACH ROW EXECUTE FUNCTION "public"."update_n8n_credentials_updated_at"();



CREATE OR REPLACE TRIGGER "update_produtos_servicos_updated_at" BEFORE UPDATE ON "public"."produtos_servicos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_professional_stats_on_appointment" AFTER INSERT OR DELETE OR UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."update_professional_stats_on_appointment"();



CREATE OR REPLACE TRIGGER "update_saas_organizations_updated_at" BEFORE UPDATE ON "public"."saas_organizations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_saidas_updated_at" BEFORE UPDATE ON "public"."saidas" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_servicos_updated_at" BEFORE UPDATE ON "public"."servicos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_webhook_configurations_updated_at" BEFORE UPDATE ON "public"."webhook_configurations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "webhook_appointment_created_trigger" AFTER INSERT ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."webhook_trigger_appointment_created"();



CREATE OR REPLACE TRIGGER "webhook_appointment_status_changed_trigger" AFTER UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."webhook_trigger_appointment_status_changed"();



CREATE OR REPLACE TRIGGER "webhook_lead_created_trigger" AFTER INSERT ON "public"."crm_leads" FOR EACH ROW EXECUTE FUNCTION "public"."webhook_trigger_lead_created"();

ALTER TABLE "public"."crm_leads" DISABLE TRIGGER "webhook_lead_created_trigger";



CREATE OR REPLACE TRIGGER "webhook_lead_updated_trigger" AFTER UPDATE ON "public"."crm_leads" FOR EACH ROW EXECUTE FUNCTION "public"."webhook_trigger_lead_updated"();

ALTER TABLE "public"."crm_leads" DISABLE TRIGGER "webhook_lead_updated_trigger";



CREATE OR REPLACE TRIGGER "webhook_payment_received_trigger" AFTER INSERT OR UPDATE ON "public"."pagamentos" FOR EACH ROW EXECUTE FUNCTION "public"."webhook_trigger_payment_received"();



ALTER TABLE ONLY "public"."ai_interactions"
    ADD CONSTRAINT "ai_interactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_briefings"
    ADD CONSTRAINT "automation_briefings_automation_client_id_fkey" FOREIGN KEY ("automation_client_id") REFERENCES "public"."automation_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_client_appointments"
    ADD CONSTRAINT "automation_client_appointments_automation_client_id_fkey" FOREIGN KEY ("automation_client_id") REFERENCES "public"."automation_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_client_appointments"
    ADD CONSTRAINT "automation_client_appointments_calendar_event_id_fkey" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automation_client_documents"
    ADD CONSTRAINT "automation_client_documents_automation_client_id_fkey" FOREIGN KEY ("automation_client_id") REFERENCES "public"."automation_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_client_feedbacks"
    ADD CONSTRAINT "automation_client_feedbacks_automation_client_id_fkey" FOREIGN KEY ("automation_client_id") REFERENCES "public"."automation_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_client_feedbacks"
    ADD CONSTRAINT "automation_client_feedbacks_related_process_id_fkey" FOREIGN KEY ("related_process_id") REFERENCES "public"."automation_processes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automation_clients"
    ADD CONSTRAINT "automation_clients_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automation_contracts"
    ADD CONSTRAINT "automation_contracts_automation_client_id_fkey" FOREIGN KEY ("automation_client_id") REFERENCES "public"."automation_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_events"
    ADD CONSTRAINT "automation_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_executions"
    ADD CONSTRAINT "automation_executions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_meeting_transcriptions"
    ADD CONSTRAINT "automation_meeting_transcriptions_automation_client_id_fkey" FOREIGN KEY ("automation_client_id") REFERENCES "public"."automation_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_processes"
    ADD CONSTRAINT "automation_processes_automation_client_id_fkey" FOREIGN KEY ("automation_client_id") REFERENCES "public"."automation_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collaborators"
    ADD CONSTRAINT "collaborators_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collaborators"
    ADD CONSTRAINT "collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_import_prefs"
    ADD CONSTRAINT "crm_import_prefs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_lead_activities"
    ADD CONSTRAINT "crm_lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_lead_activities"
    ADD CONSTRAINT "crm_lead_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."crm_lead_notes"
    ADD CONSTRAINT "crm_lead_notes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_lead_notes"
    ADD CONSTRAINT "crm_lead_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."crm_leads"
    ADD CONSTRAINT "crm_leads_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."crm_leads"
    ADD CONSTRAINT "crm_leads_converted_client_id_fkey" FOREIGN KEY ("converted_client_id") REFERENCES "public"."clients"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crm_leads"
    ADD CONSTRAINT "crm_leads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."crm_leads_import_jobs"
    ADD CONSTRAINT "crm_leads_import_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_leads"
    ADD CONSTRAINT "crm_leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_leads"
    ADD CONSTRAINT "crm_leads_sold_produto_servico_id_fkey" FOREIGN KEY ("sold_produto_servico_id") REFERENCES "public"."produtos_servicos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crm_leads"
    ADD CONSTRAINT "crm_leads_stage_fkey" FOREIGN KEY ("organization_id", "stage") REFERENCES "public"."crm_stages"("organization_id", "name") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crm_leads"
    ADD CONSTRAINT "crm_leads_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."crm_stage_aliases"
    ADD CONSTRAINT "crm_stage_aliases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_stages"
    ADD CONSTRAINT "crm_stages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entradas"
    ADD CONSTRAINT "entradas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entradas"
    ADD CONSTRAINT "entradas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entradas"
    ADD CONSTRAINT "entradas_produto_servico_id_fkey" FOREIGN KEY ("produto_servico_id") REFERENCES "public"."produtos_servicos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entradas_source_links"
    ADD CONSTRAINT "entradas_source_links_entrada_id_fkey" FOREIGN KEY ("entrada_id") REFERENCES "public"."entradas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."external_integrations"
    ADD CONSTRAINT "external_integrations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."external_integrations"
    ADD CONSTRAINT "external_integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_integrations"
    ADD CONSTRAINT "fk_whatsapp_integ_instance_id" FOREIGN KEY ("instance_id") REFERENCES "public"."whatsapp_instances"("instance_id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."whatsapp_integrations"
    ADD CONSTRAINT "fk_whatsapp_integ_instance_token" FOREIGN KEY ("instance_token") REFERENCES "public"."whatsapp_instances"("instance_token") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."investimentos_marketing"
    ADD CONSTRAINT "investimentos_marketing_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."n8n_credentials"
    ADD CONSTRAINT "n8n_credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."n8n_workflows"
    ADD CONSTRAINT "n8n_workflows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "public"."appointments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "public"."servicos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."produto_variantes"
    ADD CONSTRAINT "produto_variantes_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos_servicos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."produtos_relacionados"
    ADD CONSTRAINT "produtos_relacionados_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos_servicos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."produtos_relacionados"
    ADD CONSTRAINT "produtos_relacionados_relacionado_id_fkey" FOREIGN KEY ("relacionado_id") REFERENCES "public"."produtos_servicos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rag_items"
    ADD CONSTRAINT "rag_items_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."rag_sources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."servicos"
    ADD CONSTRAINT "servicos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhook_configurations"
    ADD CONSTRAINT "webhook_configurations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_webhook_config_id_fkey" FOREIGN KEY ("webhook_config_id") REFERENCES "public"."webhook_configurations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhook_logs"
    ADD CONSTRAINT "webhook_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."saas_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_conversations"
    ADD CONSTRAINT "whatsapp_conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."whatsapp_contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE CASCADE;



CREATE POLICY "Allow crm_stages access by organization" ON "public"."crm_stages" TO "authenticated" USING (("organization_id" = ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))) WITH CHECK (("organization_id" = ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Allow org read" ON "public"."ai_agent_metrics_daily_agg" FOR SELECT USING ((("current_setting"('app.organization_id'::"text", true))::"uuid" = "organization_id"));



CREATE POLICY "Allow org update" ON "public"."ai_agent_metrics_daily_agg" FOR UPDATE USING ((("current_setting"('app.organization_id'::"text", true))::"uuid" = "organization_id"));



CREATE POLICY "Allow org upsert" ON "public"."ai_agent_metrics_daily_agg" FOR INSERT WITH CHECK ((("current_setting"('app.organization_id'::"text", true))::"uuid" = "organization_id"));



CREATE POLICY "Allow read saas_organizations" ON "public"."saas_organizations" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow read servicos" ON "public"."servicos" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow setup crm_stages creation" ON "public"."crm_stages" FOR INSERT TO "anon" WITH CHECK ((("organization_id" IS NOT NULL) AND ("name" IS NOT NULL)));



CREATE POLICY "Allow setup organization creation" ON "public"."saas_organizations" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("owner_id" IS NOT NULL) AND ("slug" IS NOT NULL) AND ("name" IS NOT NULL)));



CREATE POLICY "Allow setup servicos creation" ON "public"."servicos" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("organization_id" IS NOT NULL) AND ("nome" IS NOT NULL)));



CREATE POLICY "Authenticated users can view event types" ON "public"."webhook_event_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Dev: acesso total activities" ON "public"."crm_lead_activities" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total ai_interactions" ON "public"."ai_interactions" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total appointments" ON "public"."appointments" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total automation_events" ON "public"."automation_events" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total automation_executions" ON "public"."automation_executions" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total calendar_events" ON "public"."calendar_events" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total clients" ON "public"."clients" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total collaborators" ON "public"."collaborators" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total consultations" ON "public"."consultations" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total despesas" ON "public"."despesas" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total entradas" ON "public"."entradas" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total external_integrations" ON "public"."external_integrations" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total investimentos" ON "public"."investimentos_marketing" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total invitations" ON "public"."user_invitations" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total leads" ON "public"."crm_leads" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total n8n_workflows" ON "public"."n8n_workflows" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total notes" ON "public"."crm_lead_notes" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total pagamentos" ON "public"."pagamentos" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total produto_variantes" ON "public"."produto_variantes" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total produtos_servicos" ON "public"."produtos_servicos" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total saidas" ON "public"."saidas" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total servicos" ON "public"."servicos" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total stages" ON "public"."crm_stages" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total webhook_configurations" ON "public"."webhook_configurations" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: acesso total webhook_logs" ON "public"."webhook_logs" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: full access notifications" ON "public"."notifications" USING (true) WITH CHECK (true);



CREATE POLICY "Enable delete for authenticated users based on owner_id" ON "public"."saas_organizations" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Enable insert for authenticated users based on owner_id" ON "public"."saas_organizations" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Enable read access for authenticated users based on owner_id" ON "public"."saas_organizations" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Enable update for authenticated users based on owner_id" ON "public"."saas_organizations" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Event types are viewable by authenticated users" ON "public"."webhook_event_types" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Event types são públicos" ON "public"."webhook_event_types" FOR SELECT USING (true);



CREATE POLICY "Organization members can delete ai_interactions" ON "public"."ai_interactions" FOR DELETE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can delete appointments" ON "public"."appointments" FOR DELETE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can delete calendar_events" ON "public"."calendar_events" FOR DELETE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can delete consultations" ON "public"."consultations" FOR DELETE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can delete crm_lead_activities" ON "public"."crm_lead_activities" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."crm_leads"
  WHERE (("crm_leads"."id" = "crm_lead_activities"."lead_id") AND ("crm_leads"."organization_id" = "public"."get_user_organization_id"())))));



CREATE POLICY "Organization members can delete crm_lead_notes" ON "public"."crm_lead_notes" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."crm_leads"
  WHERE (("crm_leads"."id" = "crm_lead_notes"."lead_id") AND ("crm_leads"."organization_id" = "public"."get_user_organization_id"())))));



CREATE POLICY "Organization members can delete crm_leads" ON "public"."crm_leads" FOR DELETE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can delete crm_stages" ON "public"."crm_stages" FOR DELETE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can delete despesas" ON "public"."despesas" FOR DELETE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can delete external_integrations" ON "public"."external_integrations" FOR DELETE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can delete investimentos_marketing" ON "public"."investimentos_marketing" FOR DELETE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can delete notifications" ON "public"."notifications" FOR DELETE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can delete pagamentos" ON "public"."pagamentos" FOR DELETE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can delete servicos" ON "public"."servicos" FOR DELETE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can delete user_invitations" ON "public"."user_invitations" FOR DELETE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can delete users" ON "public"."users" FOR DELETE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can delete webhook_logs" ON "public"."webhook_logs" FOR DELETE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can insert ai_interactions" ON "public"."ai_interactions" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can insert appointments" ON "public"."appointments" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can insert automation executions" ON "public"."automation_executions" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Organization members can insert calendar_events" ON "public"."calendar_events" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can insert consultations" ON "public"."consultations" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can insert crm_lead_activities" ON "public"."crm_lead_activities" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."crm_leads"
  WHERE (("crm_leads"."id" = "crm_lead_activities"."lead_id") AND ("crm_leads"."organization_id" = "public"."get_user_organization_id"())))));



CREATE POLICY "Organization members can insert crm_lead_notes" ON "public"."crm_lead_notes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."crm_leads"
  WHERE (("crm_leads"."id" = "crm_lead_notes"."lead_id") AND ("crm_leads"."organization_id" = "public"."get_user_organization_id"())))));



CREATE POLICY "Organization members can insert crm_leads" ON "public"."crm_leads" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can insert crm_stages" ON "public"."crm_stages" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can insert despesas" ON "public"."despesas" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can insert external_integrations" ON "public"."external_integrations" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can insert investimentos_marketing" ON "public"."investimentos_marketing" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can insert notifications" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can insert pagamentos" ON "public"."pagamentos" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can insert servicos" ON "public"."servicos" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can insert user_invitations" ON "public"."user_invitations" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can insert users" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can insert webhook_logs" ON "public"."webhook_logs" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can manage N8N credentials" ON "public"."n8n_credentials" TO "authenticated" USING (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Organization members can manage n8n workflows" ON "public"."n8n_workflows" TO "authenticated" USING (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Organization members can read automation executions" ON "public"."automation_executions" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Organization members can read n8n workflows" ON "public"."n8n_workflows" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Organization members can select ai_interactions" ON "public"."ai_interactions" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can select appointments" ON "public"."appointments" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can select calendar_events" ON "public"."calendar_events" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can select consultations" ON "public"."consultations" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can select crm_lead_activities" ON "public"."crm_lead_activities" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."crm_leads"
  WHERE (("crm_leads"."id" = "crm_lead_activities"."lead_id") AND ("crm_leads"."organization_id" = "public"."get_user_organization_id"())))));



CREATE POLICY "Organization members can select crm_lead_notes" ON "public"."crm_lead_notes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."crm_leads"
  WHERE (("crm_leads"."id" = "crm_lead_notes"."lead_id") AND ("crm_leads"."organization_id" = "public"."get_user_organization_id"())))));



CREATE POLICY "Organization members can select crm_leads" ON "public"."crm_leads" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can select crm_stages" ON "public"."crm_stages" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can select despesas" ON "public"."despesas" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can select external_integrations" ON "public"."external_integrations" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can select investimentos_marketing" ON "public"."investimentos_marketing" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can select notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can select pagamentos" ON "public"."pagamentos" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can select servicos" ON "public"."servicos" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can select user_invitations" ON "public"."user_invitations" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can select users" ON "public"."users" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can select webhook_logs" ON "public"."webhook_logs" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can update ai_interactions" ON "public"."ai_interactions" FOR UPDATE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"())) WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can update appointments" ON "public"."appointments" FOR UPDATE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"())) WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can update calendar_events" ON "public"."calendar_events" FOR UPDATE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"())) WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can update consultations" ON "public"."consultations" FOR UPDATE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"())) WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can update crm_lead_activities" ON "public"."crm_lead_activities" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."crm_leads"
  WHERE (("crm_leads"."id" = "crm_lead_activities"."lead_id") AND ("crm_leads"."organization_id" = "public"."get_user_organization_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."crm_leads"
  WHERE (("crm_leads"."id" = "crm_lead_activities"."lead_id") AND ("crm_leads"."organization_id" = "public"."get_user_organization_id"())))));



CREATE POLICY "Organization members can update crm_lead_notes" ON "public"."crm_lead_notes" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."crm_leads"
  WHERE (("crm_leads"."id" = "crm_lead_notes"."lead_id") AND ("crm_leads"."organization_id" = "public"."get_user_organization_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."crm_leads"
  WHERE (("crm_leads"."id" = "crm_lead_notes"."lead_id") AND ("crm_leads"."organization_id" = "public"."get_user_organization_id"())))));



CREATE POLICY "Organization members can update crm_leads" ON "public"."crm_leads" FOR UPDATE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"())) WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can update crm_stages" ON "public"."crm_stages" FOR UPDATE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"())) WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can update despesas" ON "public"."despesas" FOR UPDATE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"())) WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can update external_integrations" ON "public"."external_integrations" FOR UPDATE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"())) WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can update investimentos_marketing" ON "public"."investimentos_marketing" FOR UPDATE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"())) WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can update notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"())) WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can update pagamentos" ON "public"."pagamentos" FOR UPDATE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"())) WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can update servicos" ON "public"."servicos" FOR UPDATE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"())) WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can update user_invitations" ON "public"."user_invitations" FOR UPDATE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"())) WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can update users" ON "public"."users" FOR UPDATE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"())) WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Organization members can update webhook_logs" ON "public"."webhook_logs" FOR UPDATE TO "authenticated" USING (("organization_id" = "public"."get_user_organization_id"())) WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "System can create webhook events" ON "public"."webhook_events" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert webhook events" ON "public"."webhook_events" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can create organization webhooks" ON "public"."webhook_configurations" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users can delete organization webhooks" ON "public"."webhook_configurations" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users can insert own profile" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage own webhooks" ON "public"."whatsapp_user_webhooks" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can update organization webhooks" ON "public"."webhook_configurations" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can view organization webhook events" ON "public"."webhook_events" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users can view organization webhooks" ON "public"."webhook_configurations" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users can view own profile" ON "public"."users" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own webhooks" ON "public"."whatsapp_user_webhooks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view same organization members" ON "public"."users" FOR SELECT TO "authenticated" USING (("organization_id" = ( SELECT "u2"."organization_id"
   FROM "public"."users" "u2"
  WHERE ("u2"."id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "Users can view webhook event types" ON "public"."webhook_event_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Webhook configs por organização" ON "public"."webhook_configurations" USING (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Webhook events por organização" ON "public"."webhook_events" USING (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



ALTER TABLE "public"."agent_prompts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agent_prompts_modify_ctx" ON "public"."agent_prompts" TO "authenticated", "anon" USING ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = COALESCE(NULLIF("current_setting"('request.header.x-organization-id'::"text", true), ''::"text"), NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text"))))) WITH CHECK ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = COALESCE(NULLIF("current_setting"('request.header.x-organization-id'::"text", true), ''::"text"), NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text")))));



CREATE POLICY "agent_prompts_select_ctx" ON "public"."agent_prompts" FOR SELECT TO "authenticated", "anon" USING ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = COALESCE(NULLIF("current_setting"('request.header.x-organization-id'::"text", true), ''::"text"), NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text")))));



ALTER TABLE "public"."ai_agent_metrics_daily_agg" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_agent_workflows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_agent_workflows_delete_policy" ON "public"."ai_agent_workflows" FOR DELETE USING (("organization_id" = ("current_setting"('app.organization_id'::"text", true))::"uuid"));



CREATE POLICY "ai_agent_workflows_insert_policy" ON "public"."ai_agent_workflows" FOR INSERT WITH CHECK (("organization_id" = ("current_setting"('app.organization_id'::"text", true))::"uuid"));



CREATE POLICY "ai_agent_workflows_select_policy" ON "public"."ai_agent_workflows" FOR SELECT USING (("organization_id" = ("current_setting"('app.organization_id'::"text", true))::"uuid"));



CREATE POLICY "ai_agent_workflows_update_policy" ON "public"."ai_agent_workflows" FOR UPDATE USING (("organization_id" = ("current_setting"('app.organization_id'::"text", true))::"uuid")) WITH CHECK (("organization_id" = ("current_setting"('app.organization_id'::"text", true))::"uuid"));



ALTER TABLE "public"."ai_interactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "automation_appointments_delete_policy" ON "public"."automation_client_appointments" FOR DELETE USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_appointments_insert_policy" ON "public"."automation_client_appointments" FOR INSERT WITH CHECK ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_appointments_select_policy" ON "public"."automation_client_appointments" FOR SELECT USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_appointments_update_policy" ON "public"."automation_client_appointments" FOR UPDATE USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



ALTER TABLE "public"."automation_briefings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "automation_briefings_delete_policy" ON "public"."automation_briefings" FOR DELETE USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_briefings_insert_policy" ON "public"."automation_briefings" FOR INSERT WITH CHECK ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_briefings_select_policy" ON "public"."automation_briefings" FOR SELECT USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_briefings_update_policy" ON "public"."automation_briefings" FOR UPDATE USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



ALTER TABLE "public"."automation_client_appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automation_client_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automation_client_feedbacks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automation_clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "automation_clients_delete_policy" ON "public"."automation_clients" FOR DELETE USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_clients_insert_policy" ON "public"."automation_clients" FOR INSERT WITH CHECK ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_clients_select_policy" ON "public"."automation_clients" FOR SELECT USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_clients_update_policy" ON "public"."automation_clients" FOR UPDATE USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



ALTER TABLE "public"."automation_contracts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "automation_contracts_delete_policy" ON "public"."automation_contracts" FOR DELETE USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_contracts_insert_policy" ON "public"."automation_contracts" FOR INSERT WITH CHECK ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_contracts_select_policy" ON "public"."automation_contracts" FOR SELECT USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_contracts_update_policy" ON "public"."automation_contracts" FOR UPDATE USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_documents_delete_policy" ON "public"."automation_client_documents" FOR DELETE USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_documents_insert_policy" ON "public"."automation_client_documents" FOR INSERT WITH CHECK ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_documents_select_policy" ON "public"."automation_client_documents" FOR SELECT USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_documents_update_policy" ON "public"."automation_client_documents" FOR UPDATE USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



ALTER TABLE "public"."automation_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automation_executions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "automation_feedbacks_delete_policy" ON "public"."automation_client_feedbacks" FOR DELETE USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_feedbacks_insert_policy" ON "public"."automation_client_feedbacks" FOR INSERT WITH CHECK ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_feedbacks_select_policy" ON "public"."automation_client_feedbacks" FOR SELECT USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_feedbacks_update_policy" ON "public"."automation_client_feedbacks" FOR UPDATE USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



ALTER TABLE "public"."automation_meeting_transcriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "automation_meetings_delete_policy" ON "public"."automation_meeting_transcriptions" FOR DELETE USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_meetings_insert_policy" ON "public"."automation_meeting_transcriptions" FOR INSERT WITH CHECK ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_meetings_select_policy" ON "public"."automation_meeting_transcriptions" FOR SELECT USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_meetings_update_policy" ON "public"."automation_meeting_transcriptions" FOR UPDATE USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



ALTER TABLE "public"."automation_processes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "automation_processes_delete_policy" ON "public"."automation_processes" FOR DELETE USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_processes_insert_policy" ON "public"."automation_processes" FOR INSERT WITH CHECK ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_processes_select_policy" ON "public"."automation_processes" FOR SELECT USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "automation_processes_update_policy" ON "public"."automation_processes" FOR UPDATE USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



ALTER TABLE "public"."calendar_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collaborators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consultations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_lead_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_lead_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_stages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."despesas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entradas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."external_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."investimentos_marketing" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."james" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "james_modify_own_org" ON "public"."james" TO "authenticated", "anon" USING ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text")))) WITH CHECK ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text"))));



CREATE POLICY "james_select_own_org" ON "public"."james" FOR SELECT TO "authenticated", "anon" USING ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text"))));



ALTER TABLE "public"."manychat_credentials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "manychat_credentials_modify_own_org" ON "public"."manychat_credentials" TO "authenticated", "anon" USING ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text")))) WITH CHECK ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text"))));



CREATE POLICY "manychat_credentials_select_own_org" ON "public"."manychat_credentials" FOR SELECT TO "authenticated", "anon" USING ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text"))));



CREATE POLICY "mc_read_org" ON "public"."tutorial_manychat_progress" FOR SELECT TO "authenticated" USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "mc_update_org" ON "public"."tutorial_manychat_progress" FOR UPDATE TO "authenticated" USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true))) WITH CHECK ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "mc_write_org" ON "public"."tutorial_manychat_progress" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



ALTER TABLE "public"."monetization_trail_progress" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "n8n_conn_modify" ON "public"."n8n_connections" TO "authenticated", "anon" USING ((("organization_id")::"text" = NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text"))) WITH CHECK ((("organization_id")::"text" = NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text")));



CREATE POLICY "n8n_conn_select" ON "public"."n8n_connections" FOR SELECT TO "authenticated", "anon" USING ((("organization_id")::"text" = NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text")));



ALTER TABLE "public"."n8n_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."n8n_credentials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."n8n_workflows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pagamentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."produto_variantes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."produtos_servicos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."qna_pairs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "qna_pairs_modify_own_org" ON "public"."qna_pairs" TO "authenticated", "anon" USING ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = COALESCE(NULLIF("current_setting"('request.header.x-organization-id'::"text", true), ''::"text"), NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text"))))) WITH CHECK ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = COALESCE(NULLIF("current_setting"('request.header.x-organization-id'::"text", true), ''::"text"), NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text")))));



CREATE POLICY "qna_pairs_select_own_org" ON "public"."qna_pairs" FOR SELECT TO "authenticated", "anon" USING ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = COALESCE(NULLIF("current_setting"('request.header.x-organization-id'::"text", true), ''::"text"), NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text")))));



ALTER TABLE "public"."rag_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rag_items_insert_by_org" ON "public"."rag_items" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true))));



CREATE POLICY "rag_items_select_by_org" ON "public"."rag_items" FOR SELECT TO "authenticated" USING ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true))));



CREATE POLICY "rag_items_update_by_org" ON "public"."rag_items" FOR UPDATE TO "authenticated" USING ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)))) WITH CHECK ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true))));



ALTER TABLE "public"."rag_sources" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rag_sources_insert_by_org" ON "public"."rag_sources" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true))));



CREATE POLICY "rag_sources_select_by_org" ON "public"."rag_sources" FOR SELECT TO "authenticated" USING ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true))));



CREATE POLICY "rag_sources_update_by_org" ON "public"."rag_sources" FOR UPDATE TO "authenticated" USING ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)))) WITH CHECK ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true))));



ALTER TABLE "public"."repositorio_de_mensagens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rm_insert_by_org" ON "public"."repositorio_de_mensagens" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true))));



CREATE POLICY "rm_select_by_org" ON "public"."repositorio_de_mensagens" FOR SELECT TO "authenticated" USING ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true))));



CREATE POLICY "rm_select_by_org_anon" ON "public"."repositorio_de_mensagens" FOR SELECT TO "anon" USING ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true))));



CREATE POLICY "rm_update_by_org" ON "public"."repositorio_de_mensagens" FOR UPDATE TO "authenticated" USING ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)))) WITH CHECK ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true))));



ALTER TABLE "public"."saas_organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saidas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."servicos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trail_modify_ctx" ON "public"."monetization_trail_progress" TO "authenticated" USING ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = COALESCE(NULLIF("current_setting"('request.header.x-organization-id'::"text", true), ''::"text"), NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text"))))) WITH CHECK ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = COALESCE(NULLIF("current_setting"('request.header.x-organization-id'::"text", true), ''::"text"), NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text")))));



ALTER TABLE "public"."trail_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trail_notes_modify_ctx" ON "public"."trail_notes" TO "authenticated", "anon" USING ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = COALESCE(NULLIF("current_setting"('request.header.x-organization-id'::"text", true), ''::"text"), NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text"))))) WITH CHECK ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = COALESCE(NULLIF("current_setting"('request.header.x-organization-id'::"text", true), ''::"text"), NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text")))));



CREATE POLICY "trail_notes_select_ctx" ON "public"."trail_notes" FOR SELECT TO "authenticated", "anon" USING ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = COALESCE(NULLIF("current_setting"('request.header.x-organization-id'::"text", true), ''::"text"), NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text")))));



CREATE POLICY "trail_read_ctx" ON "public"."monetization_trail_progress" FOR SELECT TO "authenticated", "anon" USING ((("organization_id" IS NOT NULL) AND (("organization_id")::"text" = COALESCE(NULLIF("current_setting"('request.header.x-organization-id'::"text", true), ''::"text"), NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text")))));



CREATE POLICY "trail_read_org" ON "public"."monetization_trail_progress" FOR SELECT TO "authenticated" USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "trail_update_org" ON "public"."monetization_trail_progress" FOR UPDATE TO "authenticated" USING ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true))) WITH CHECK ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



CREATE POLICY "trail_write_org" ON "public"."monetization_trail_progress" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id")::"text" = "current_setting"('app.organization_id'::"text", true)));



ALTER TABLE "public"."tutorial_manychat_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_configurations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_event_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "whatsapp_contacts_modify" ON "public"."whatsapp_contacts" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "whatsapp_contacts_modify_anon" ON "public"."whatsapp_contacts" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "whatsapp_contacts_select" ON "public"."whatsapp_contacts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "whatsapp_contacts_select_anon" ON "public"."whatsapp_contacts" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."whatsapp_conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "whatsapp_conversations_modify" ON "public"."whatsapp_conversations" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "whatsapp_conversations_modify_anon" ON "public"."whatsapp_conversations" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "whatsapp_conversations_select" ON "public"."whatsapp_conversations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "whatsapp_conversations_select_anon" ON "public"."whatsapp_conversations" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."whatsapp_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "whatsapp_events_modify" ON "public"."whatsapp_events" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "whatsapp_events_select" ON "public"."whatsapp_events" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."whatsapp_instances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "whatsapp_instances_modify_anon" ON "public"."whatsapp_instances" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "whatsapp_instances_select_anon" ON "public"."whatsapp_instances" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."whatsapp_integrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "whatsapp_integrations_modify" ON "public"."whatsapp_integrations" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "whatsapp_integrations_modify_anon" ON "public"."whatsapp_integrations" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "whatsapp_integrations_select" ON "public"."whatsapp_integrations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "whatsapp_integrations_select_anon" ON "public"."whatsapp_integrations" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."whatsapp_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "whatsapp_messages_modify" ON "public"."whatsapp_messages" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "whatsapp_messages_modify_anon" ON "public"."whatsapp_messages" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "whatsapp_messages_select" ON "public"."whatsapp_messages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "whatsapp_messages_select_anon" ON "public"."whatsapp_messages" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."whatsapp_user_webhooks" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."clients";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."collaborators";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."crm_leads";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."advisory_key"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."advisory_key"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."advisory_key"("p" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."advisory_unlock"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."advisory_unlock"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."advisory_unlock"("p" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."agent_prompts_delete"("p_organization_id" "uuid", "p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."agent_prompts_delete"("p_organization_id" "uuid", "p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."agent_prompts_delete"("p_organization_id" "uuid", "p_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."agent_prompts" TO "anon";
GRANT ALL ON TABLE "public"."agent_prompts" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_prompts" TO "service_role";



GRANT ALL ON FUNCTION "public"."agent_prompts_list"("p_organization_id" "uuid", "p_query" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."agent_prompts_list"("p_organization_id" "uuid", "p_query" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."agent_prompts_list"("p_organization_id" "uuid", "p_query" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."agent_prompts_upsert"("p_organization_id" "uuid", "p_agent_name" "text", "p_prompt" "text", "p_tools_instructions" "text", "p_tasks" "text", "p_business_description" "text", "p_agent_goal" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."agent_prompts_upsert"("p_organization_id" "uuid", "p_agent_name" "text", "p_prompt" "text", "p_tools_instructions" "text", "p_tasks" "text", "p_business_description" "text", "p_agent_goal" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."agent_prompts_upsert"("p_organization_id" "uuid", "p_agent_name" "text", "p_prompt" "text", "p_tools_instructions" "text", "p_tasks" "text", "p_business_description" "text", "p_agent_goal" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."agent_prompts_upsert"("p_organization_id" "uuid", "p_agent_name" "text", "p_prompt" "text", "p_tools_instructions" "text", "p_tasks" "text", "p_business_description" "text", "p_agent_goal" "text", "p_output_format" "jsonb", "p_rhf_feedbacks" "jsonb", "p_fewshots_examples" "jsonb", "p_tone_of_voice" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."agent_prompts_upsert"("p_organization_id" "uuid", "p_agent_name" "text", "p_prompt" "text", "p_tools_instructions" "text", "p_tasks" "text", "p_business_description" "text", "p_agent_goal" "text", "p_output_format" "jsonb", "p_rhf_feedbacks" "jsonb", "p_fewshots_examples" "jsonb", "p_tone_of_voice" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."agent_prompts_upsert"("p_organization_id" "uuid", "p_agent_name" "text", "p_prompt" "text", "p_tools_instructions" "text", "p_tasks" "text", "p_business_description" "text", "p_agent_goal" "text", "p_output_format" "jsonb", "p_rhf_feedbacks" "jsonb", "p_fewshots_examples" "jsonb", "p_tone_of_voice" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_agent_metrics_backfill_daily"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_backfill_daily"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_backfill_daily"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_agent_metrics_by_instance"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_by_instance"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_by_instance"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_agent_metrics_conversation_counts"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_conversation_counts"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_conversation_counts"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_agent_metrics_conversation_dynamics"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_conversation_dynamics"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_conversation_dynamics"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_agent_metrics_daily"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_daily"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_daily"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_agent_metrics_depth"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_depth"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_depth"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_agent_metrics_human_involvement"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_human_involvement"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_human_involvement"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_agent_metrics_satisfaction_proxy"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_satisfaction_proxy"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_satisfaction_proxy"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_agent_metrics_summary"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_summary"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_summary"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_agent_metrics_time_to_handoff"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_time_to_handoff"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_time_to_handoff"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_agent_metrics_top_terms"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer, "p_min_len" integer, "p_ngram" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_top_terms"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer, "p_min_len" integer, "p_ngram" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_agent_metrics_top_terms"("p_org" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer, "p_min_len" integer, "p_ngram" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_agent_workflows_delete"("p_organization_id" "uuid", "p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ai_agent_workflows_delete"("p_organization_id" "uuid", "p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_agent_workflows_delete"("p_organization_id" "uuid", "p_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."ai_agent_workflows" TO "anon";
GRANT ALL ON TABLE "public"."ai_agent_workflows" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_agent_workflows" TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_agent_workflows_list"("p_organization_id" "uuid", "p_query" "text", "p_category" "text", "p_tags" "text"[], "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."ai_agent_workflows_list"("p_organization_id" "uuid", "p_query" "text", "p_category" "text", "p_tags" "text"[], "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_agent_workflows_list"("p_organization_id" "uuid", "p_query" "text", "p_category" "text", "p_tags" "text"[], "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_agent_workflows_update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."ai_agent_workflows_update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_agent_workflows_update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_agent_workflows_upsert"("p_organization_id" "uuid", "p_name" "text", "p_id" "uuid", "p_description" "text", "p_workflow_data" "jsonb", "p_category" "text", "p_tags" "text"[], "p_is_active" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."ai_agent_workflows_upsert"("p_organization_id" "uuid", "p_name" "text", "p_id" "uuid", "p_description" "text", "p_workflow_data" "jsonb", "p_category" "text", "p_tags" "text"[], "p_is_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_agent_workflows_upsert"("p_organization_id" "uuid", "p_name" "text", "p_id" "uuid", "p_description" "text", "p_workflow_data" "jsonb", "p_category" "text", "p_tags" "text"[], "p_is_active" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_create_consultation"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_create_consultation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_create_consultation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_appointment_delete"("p_organization_id" "uuid", "p_appointment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."automation_appointment_delete"("p_organization_id" "uuid", "p_appointment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_appointment_delete"("p_organization_id" "uuid", "p_appointment_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."automation_client_appointments" TO "anon";
GRANT ALL ON TABLE "public"."automation_client_appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_client_appointments" TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_appointment_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_title" "text", "p_description" "text", "p_appointment_type" "text", "p_start_datetime" timestamp with time zone, "p_end_datetime" timestamp with time zone, "p_location" "text", "p_meeting_url" "text", "p_participants" "text"[], "p_status" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."automation_appointment_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_title" "text", "p_description" "text", "p_appointment_type" "text", "p_start_datetime" timestamp with time zone, "p_end_datetime" timestamp with time zone, "p_location" "text", "p_meeting_url" "text", "p_participants" "text"[], "p_status" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_appointment_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_title" "text", "p_description" "text", "p_appointment_type" "text", "p_start_datetime" timestamp with time zone, "p_end_datetime" timestamp with time zone, "p_location" "text", "p_meeting_url" "text", "p_participants" "text"[], "p_status" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_appointments_list"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."automation_appointments_list"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_appointments_list"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."automation_briefings" TO "anon";
GRANT ALL ON TABLE "public"."automation_briefings" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_briefings" TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_briefing_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_title" "text", "p_content" "text", "p_briefing_type" "text", "p_tags" "text"[], "p_indexed_for_rag" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."automation_briefing_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_title" "text", "p_content" "text", "p_briefing_type" "text", "p_tags" "text"[], "p_indexed_for_rag" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_briefing_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_title" "text", "p_content" "text", "p_briefing_type" "text", "p_tags" "text"[], "p_indexed_for_rag" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_briefings_list"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."automation_briefings_list"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_briefings_list"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_client_delete"("p_organization_id" "uuid", "p_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."automation_client_delete"("p_organization_id" "uuid", "p_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_client_delete"("p_organization_id" "uuid", "p_client_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."automation_clients" TO "anon";
GRANT ALL ON TABLE "public"."automation_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_clients" TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_client_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_company_name" "text", "p_contact_name" "text", "p_email" "text", "p_phone" "text", "p_status" "text", "p_client_id" "uuid", "p_industry" "text", "p_company_size" "text", "p_website" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."automation_client_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_company_name" "text", "p_contact_name" "text", "p_email" "text", "p_phone" "text", "p_status" "text", "p_client_id" "uuid", "p_industry" "text", "p_company_size" "text", "p_website" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_client_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_company_name" "text", "p_contact_name" "text", "p_email" "text", "p_phone" "text", "p_status" "text", "p_client_id" "uuid", "p_industry" "text", "p_company_size" "text", "p_website" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_clients_list"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."automation_clients_list"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_clients_list"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_contract_delete"("p_organization_id" "uuid", "p_contract_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."automation_contract_delete"("p_organization_id" "uuid", "p_contract_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_contract_delete"("p_organization_id" "uuid", "p_contract_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."automation_contracts" TO "anon";
GRANT ALL ON TABLE "public"."automation_contracts" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_contracts" TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_contract_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_contract_name" "text", "p_contract_number" "text", "p_setup_value" numeric, "p_recurring_value" numeric, "p_recurring_period" "text", "p_included_tools" "text"[], "p_start_date" "date", "p_end_date" "date", "p_renewal_date" "date", "p_status" "text", "p_terms" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."automation_contract_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_contract_name" "text", "p_contract_number" "text", "p_setup_value" numeric, "p_recurring_value" numeric, "p_recurring_period" "text", "p_included_tools" "text"[], "p_start_date" "date", "p_end_date" "date", "p_renewal_date" "date", "p_status" "text", "p_terms" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_contract_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_contract_name" "text", "p_contract_number" "text", "p_setup_value" numeric, "p_recurring_value" numeric, "p_recurring_period" "text", "p_included_tools" "text"[], "p_start_date" "date", "p_end_date" "date", "p_renewal_date" "date", "p_status" "text", "p_terms" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_contracts_list"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."automation_contracts_list"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_contracts_list"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."automation_client_documents" TO "anon";
GRANT ALL ON TABLE "public"."automation_client_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_client_documents" TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_document_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_document_name" "text", "p_document_type" "text", "p_file_url" "text", "p_tags" "text"[], "p_notes" "text", "p_integrated_to_products" boolean, "p_integrated_to_leads" boolean, "p_integrated_to_qna" boolean, "p_integrated_to_kb" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."automation_document_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_document_name" "text", "p_document_type" "text", "p_file_url" "text", "p_tags" "text"[], "p_notes" "text", "p_integrated_to_products" boolean, "p_integrated_to_leads" boolean, "p_integrated_to_qna" boolean, "p_integrated_to_kb" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_document_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_document_name" "text", "p_document_type" "text", "p_file_url" "text", "p_tags" "text"[], "p_notes" "text", "p_integrated_to_products" boolean, "p_integrated_to_leads" boolean, "p_integrated_to_qna" boolean, "p_integrated_to_kb" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_documents_list"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."automation_documents_list"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_documents_list"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."automation_client_feedbacks" TO "anon";
GRANT ALL ON TABLE "public"."automation_client_feedbacks" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_client_feedbacks" TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_feedback_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_feedback_type" "text", "p_rating" integer, "p_title" "text", "p_content" "text", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."automation_feedback_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_feedback_type" "text", "p_rating" integer, "p_title" "text", "p_content" "text", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_feedback_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_feedback_type" "text", "p_rating" integer, "p_title" "text", "p_content" "text", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_feedbacks_list"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."automation_feedbacks_list"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_feedbacks_list"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_process_delete"("p_organization_id" "uuid", "p_process_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."automation_process_delete"("p_organization_id" "uuid", "p_process_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_process_delete"("p_organization_id" "uuid", "p_process_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."automation_processes" TO "anon";
GRANT ALL ON TABLE "public"."automation_processes" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_processes" TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_process_move_stage"("p_organization_id" "uuid", "p_process_id" "uuid", "p_new_stage" "text", "p_new_position" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."automation_process_move_stage"("p_organization_id" "uuid", "p_process_id" "uuid", "p_new_stage" "text", "p_new_position" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_process_move_stage"("p_organization_id" "uuid", "p_process_id" "uuid", "p_new_stage" "text", "p_new_position" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_process_update_mentions"("p_organization_id" "uuid", "p_process_id" "uuid", "p_mentioned_appointments" "uuid"[], "p_mentioned_transcriptions" "uuid"[], "p_mentioned_briefings" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."automation_process_update_mentions"("p_organization_id" "uuid", "p_process_id" "uuid", "p_mentioned_appointments" "uuid"[], "p_mentioned_transcriptions" "uuid"[], "p_mentioned_briefings" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_process_update_mentions"("p_organization_id" "uuid", "p_process_id" "uuid", "p_mentioned_appointments" "uuid"[], "p_mentioned_transcriptions" "uuid"[], "p_mentioned_briefings" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_process_update_progress"("p_organization_id" "uuid", "p_process_id" "uuid", "p_progress" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."automation_process_update_progress"("p_organization_id" "uuid", "p_process_id" "uuid", "p_progress" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_process_update_progress"("p_organization_id" "uuid", "p_process_id" "uuid", "p_progress" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_process_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_process_type" "text", "p_title" "text", "p_description" "text", "p_status" "text", "p_progress" integer, "p_start_date" "date", "p_due_date" "date", "p_priority" "text", "p_checklist" "jsonb", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."automation_process_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_process_type" "text", "p_title" "text", "p_description" "text", "p_status" "text", "p_progress" integer, "p_start_date" "date", "p_due_date" "date", "p_priority" "text", "p_checklist" "jsonb", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_process_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_process_type" "text", "p_title" "text", "p_description" "text", "p_status" "text", "p_progress" integer, "p_start_date" "date", "p_due_date" "date", "p_priority" "text", "p_checklist" "jsonb", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_processes_kanban_list"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."automation_processes_kanban_list"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_processes_kanban_list"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_processes_list"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."automation_processes_list"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_processes_list"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."automation_meeting_transcriptions" TO "anon";
GRANT ALL ON TABLE "public"."automation_meeting_transcriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_meeting_transcriptions" TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_transcription_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_meeting_title" "text", "p_meeting_date" timestamp with time zone, "p_duration_minutes" integer, "p_participants" "text"[], "p_transcription" "text", "p_summary" "text", "p_action_items" "jsonb", "p_key_points" "text"[], "p_indexed_for_rag" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."automation_transcription_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_meeting_title" "text", "p_meeting_date" timestamp with time zone, "p_duration_minutes" integer, "p_participants" "text"[], "p_transcription" "text", "p_summary" "text", "p_action_items" "jsonb", "p_key_points" "text"[], "p_indexed_for_rag" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_transcription_upsert"("p_organization_id" "uuid", "p_id" "uuid", "p_automation_client_id" "uuid", "p_meeting_title" "text", "p_meeting_date" timestamp with time zone, "p_duration_minutes" integer, "p_participants" "text"[], "p_transcription" "text", "p_summary" "text", "p_action_items" "jsonb", "p_key_points" "text"[], "p_indexed_for_rag" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."automation_transcriptions_list"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."automation_transcriptions_list"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."automation_transcriptions_list"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_entradas_from_clients"() TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_entradas_from_clients"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_entradas_from_clients"() TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_entradas_from_leads"() TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_entradas_from_leads"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_entradas_from_leads"() TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_entradas_from_pagamentos"() TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_entradas_from_pagamentos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_entradas_from_pagamentos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."buscar_clientes"("query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."buscar_clientes"("query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."buscar_clientes"("query" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_duplicate_financial_entries"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_duplicate_financial_entries"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_duplicate_financial_entries"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_duplicate_financial_entries_enhanced"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_duplicate_financial_entries_enhanced"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_duplicate_financial_entries_enhanced"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_automation_events"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_automation_events"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_automation_events"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."convert_lead_to_client"("p_lead_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."convert_lead_to_client"("p_lead_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."convert_lead_to_client"("p_lead_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."convert_lead_to_client_auto"("p_lead_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."convert_lead_to_client_auto"("p_lead_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."convert_lead_to_client_auto"("p_lead_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_appointment_reminders"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_appointment_reminders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_appointment_reminders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_client_from_lead_no_convert"("p_lead_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_client_from_lead_no_convert"("p_lead_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_client_from_lead_no_convert"("p_lead_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."crm_stages" TO "anon";
GRANT ALL ON TABLE "public"."crm_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_stages" TO "service_role";
GRANT ALL ON TABLE "public"."crm_stages" TO PUBLIC;



GRANT ALL ON FUNCTION "public"."create_crm_stage"("p_name" "text", "p_color" "text", "p_order_index" integer, "p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_crm_stage"("p_name" "text", "p_color" "text", "p_order_index" integer, "p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_crm_stage"("p_name" "text", "p_color" "text", "p_order_index" integer, "p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_manual_notification"("p_organization_id" "uuid", "p_user_ids" "uuid"[], "p_tipo" "text", "p_mensagem" "text", "p_link" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_manual_notification"("p_organization_id" "uuid", "p_user_ids" "uuid"[], "p_tipo" "text", "p_mensagem" "text", "p_link" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_manual_notification"("p_organization_id" "uuid", "p_user_ids" "uuid"[], "p_tipo" "text", "p_mensagem" "text", "p_link" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification"("p_organization_id" "uuid", "p_user_id" "uuid", "p_tipo" "text", "p_mensagem" "text", "p_link" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification"("p_organization_id" "uuid", "p_user_id" "uuid", "p_tipo" "text", "p_mensagem" "text", "p_link" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification"("p_organization_id" "uuid", "p_user_id" "uuid", "p_tipo" "text", "p_mensagem" "text", "p_link" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification_safe"("p_organization_id" "uuid", "p_user_id" "uuid", "p_tipo" "text", "p_mensagem" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification_safe"("p_organization_id" "uuid", "p_user_id" "uuid", "p_tipo" "text", "p_mensagem" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification_safe"("p_organization_id" "uuid", "p_user_id" "uuid", "p_tipo" "text", "p_mensagem" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_secure_notification"("p_organization_id" "uuid", "p_user_id" "text", "p_tipo" "text", "p_mensagem" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_secure_notification"("p_organization_id" "uuid", "p_user_id" "text", "p_tipo" "text", "p_mensagem" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_secure_notification"("p_organization_id" "uuid", "p_user_id" "text", "p_tipo" "text", "p_mensagem" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_system_notification"("p_organization_id" "uuid", "p_mensagem" "text", "p_priority" "text", "p_link" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_system_notification"("p_organization_id" "uuid", "p_mensagem" "text", "p_priority" "text", "p_link" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_system_notification"("p_organization_id" "uuid", "p_mensagem" "text", "p_priority" "text", "p_link" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_on_organization"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_on_organization"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_on_organization"() TO "service_role";



GRANT ALL ON FUNCTION "public"."crm_leads_reorder_stage"("p_organization_id" "uuid", "p_stage" "text", "p_lead_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."crm_leads_reorder_stage"("p_organization_id" "uuid", "p_stage" "text", "p_lead_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."crm_leads_reorder_stage"("p_organization_id" "uuid", "p_stage" "text", "p_lead_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_email"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_email"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_email"("p" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_phone_e164_br"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_phone_e164_br"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_phone_e164_br"("p" "text") TO "service_role";



GRANT ALL ON TABLE "public"."crm_leads" TO "anon";
GRANT ALL ON TABLE "public"."crm_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_leads" TO "service_role";
GRANT ALL ON TABLE "public"."crm_leads" TO PUBLIC;



GRANT ALL ON FUNCTION "public"."crm_leads_upsert"("p_organization_id" "uuid", "p_name" "text", "p_id" "uuid", "p_whatsapp" "text", "p_email" "text", "p_instagram_username" "text", "p_stage" "text", "p_value" numeric, "p_priority" "text", "p_source" "text", "p_canal" "text", "p_has_payment" boolean, "p_payment_value" numeric, "p_sold_produto_servico_id" "text", "p_sold_quantity" "text", "p_interest_produto_servico_id" "text", "p_interest_quantity" "text", "p_custom_fields" "jsonb", "p_created_at" timestamp with time zone, "p_updated_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."crm_leads_upsert"("p_organization_id" "uuid", "p_name" "text", "p_id" "uuid", "p_whatsapp" "text", "p_email" "text", "p_instagram_username" "text", "p_stage" "text", "p_value" numeric, "p_priority" "text", "p_source" "text", "p_canal" "text", "p_has_payment" boolean, "p_payment_value" numeric, "p_sold_produto_servico_id" "text", "p_sold_quantity" "text", "p_interest_produto_servico_id" "text", "p_interest_quantity" "text", "p_custom_fields" "jsonb", "p_created_at" timestamp with time zone, "p_updated_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."crm_leads_upsert"("p_organization_id" "uuid", "p_name" "text", "p_id" "uuid", "p_whatsapp" "text", "p_email" "text", "p_instagram_username" "text", "p_stage" "text", "p_value" numeric, "p_priority" "text", "p_source" "text", "p_canal" "text", "p_has_payment" boolean, "p_payment_value" numeric, "p_sold_produto_servico_id" "text", "p_sold_quantity" "text", "p_interest_produto_servico_id" "text", "p_interest_quantity" "text", "p_custom_fields" "jsonb", "p_created_at" timestamp with time zone, "p_updated_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."decrypt_n8n_api_key"("encrypted_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."decrypt_n8n_api_key"("encrypted_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrypt_n8n_api_key"("encrypted_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."encrypt_n8n_api_key"("api_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."encrypt_n8n_api_key"("api_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."encrypt_n8n_api_key"("api_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notify_master_on_client_org_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_notify_master_on_client_org_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_notify_master_on_client_org_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_automation_stats"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_automation_stats"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_automation_stats"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_request_header"("p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_request_header"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_request_header"("p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_organization_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_organization_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_organization_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."int_or_null"("p_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."int_or_null"("p_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."int_or_null"("p_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."james_get"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."james_get"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."james_get"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."james_upsert"("p_organization_id" "uuid", "p_agent_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."james_upsert"("p_organization_id" "uuid", "p_agent_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."james_upsert"("p_organization_id" "uuid", "p_agent_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."kanban_leads_stats"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."kanban_leads_stats"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."kanban_leads_stats"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."leads_import_commit"("p_organization_id" "uuid", "p_import_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."leads_import_commit"("p_organization_id" "uuid", "p_import_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leads_import_commit"("p_organization_id" "uuid", "p_import_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."leads_import_stage_rows"("p_organization_id" "uuid", "p_import_id" "uuid", "p_rows" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."leads_import_stage_rows"("p_organization_id" "uuid", "p_import_id" "uuid", "p_rows" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leads_import_stage_rows"("p_organization_id" "uuid", "p_import_id" "uuid", "p_rows" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."leads_import_start"("p_organization_id" "uuid", "p_filename" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."leads_import_start"("p_organization_id" "uuid", "p_filename" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leads_import_start"("p_organization_id" "uuid", "p_filename" "text") TO "service_role";



GRANT ALL ON TABLE "public"."crm_leads_import_jobs" TO "anon";
GRANT ALL ON TABLE "public"."crm_leads_import_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_leads_import_jobs" TO "service_role";



GRANT ALL ON FUNCTION "public"."leads_import_status"("p_organization_id" "uuid", "p_import_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."leads_import_status"("p_organization_id" "uuid", "p_import_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leads_import_status"("p_organization_id" "uuid", "p_import_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_crm_lead_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_crm_lead_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_crm_lead_changes"() TO "service_role";



GRANT ALL ON TABLE "public"."manychat_credentials" TO "anon";
GRANT ALL ON TABLE "public"."manychat_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."manychat_credentials" TO "service_role";



GRANT ALL ON FUNCTION "public"."manychat_credentials_get"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."manychat_credentials_get"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."manychat_credentials_get"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."manychat_credentials_upsert"("p_organization_id" "uuid", "p_user_id" "uuid", "p_api_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."manychat_credentials_upsert"("p_organization_id" "uuid", "p_user_id" "uuid", "p_api_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."manychat_credentials_upsert"("p_organization_id" "uuid", "p_user_id" "uuid", "p_api_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."manychat_credentials_upsert_full"("p_organization_id" "uuid", "p_user_id" "uuid", "p_api_key" "text", "p_tag_resposta_id" "text", "p_tag_resposta_nome" "text", "p_field_resposta_id" "text", "p_field_resposta_nome" "text", "p_flow_ns" "text", "p_flow_nome" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."manychat_credentials_upsert_full"("p_organization_id" "uuid", "p_user_id" "uuid", "p_api_key" "text", "p_tag_resposta_id" "text", "p_tag_resposta_nome" "text", "p_field_resposta_id" "text", "p_field_resposta_nome" "text", "p_flow_ns" "text", "p_flow_nome" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."manychat_credentials_upsert_full"("p_organization_id" "uuid", "p_user_id" "uuid", "p_api_key" "text", "p_tag_resposta_id" "text", "p_tag_resposta_nome" "text", "p_field_resposta_id" "text", "p_field_resposta_nome" "text", "p_flow_ns" "text", "p_flow_nome" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."map_pagamento_metodo_to_entradas"("m" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."map_pagamento_metodo_to_entradas"("m" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."map_pagamento_metodo_to_entradas"("m" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."map_produto_categoria_to_entrada_categoria"("ps_categoria" "text", "ps_tipo" "text", "ps_tipo_cobranca" "text", "ps_cobranca_tipo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."map_produto_categoria_to_entrada_categoria"("ps_categoria" "text", "ps_tipo" "text", "ps_tipo_cobranca" "text", "ps_cobranca_tipo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."map_produto_categoria_to_entrada_categoria"("ps_categoria" "text", "ps_tipo" "text", "ps_tipo_cobranca" "text", "ps_cobranca_tipo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_rag"("p_query_embedding" "public"."vector", "p_source_id" "uuid", "p_category" "text", "p_limit" integer, "p_org" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."match_rag"("p_query_embedding" "public"."vector", "p_source_id" "uuid", "p_category" "text", "p_limit" integer, "p_org" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_rag"("p_query_embedding" "public"."vector", "p_source_id" "uuid", "p_category" "text", "p_limit" integer, "p_org" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_organization_data"("p_from_org_id" "uuid", "p_to_org_id" "uuid", "p_user_id" "uuid", "p_dry_run" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_organization_data"("p_from_org_id" "uuid", "p_to_org_id" "uuid", "p_user_id" "uuid", "p_dry_run" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_organization_data"("p_from_org_id" "uuid", "p_to_org_id" "uuid", "p_user_id" "uuid", "p_dry_run" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."monetization_trail_progress_list"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."monetization_trail_progress_list"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."monetization_trail_progress_list"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."monetization_trail_progress" TO "anon";
GRANT ALL ON TABLE "public"."monetization_trail_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."monetization_trail_progress" TO "service_role";



GRANT ALL ON FUNCTION "public"."monetization_trail_progress_upsert"("p_organization_id" "uuid", "p_step_key" "text", "p_completed" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."monetization_trail_progress_upsert"("p_organization_id" "uuid", "p_step_key" "text", "p_completed" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."monetization_trail_progress_upsert"("p_organization_id" "uuid", "p_step_key" "text", "p_completed" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."n8n_delete"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."n8n_delete"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."n8n_delete"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."n8n_get"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."n8n_get"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."n8n_get"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."n8n_upsert"("p_organization_id" "uuid", "p_base_url" "text", "p_api_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."n8n_upsert"("p_organization_id" "uuid", "p_base_url" "text", "p_api_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."n8n_upsert"("p_organization_id" "uuid", "p_base_url" "text", "p_api_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_appointment_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_appointment_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_appointment_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_appointment_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_appointment_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_appointment_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_automation_event"("event_type" "text", "organization_id" "uuid", "event_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_automation_event"("event_type" "text", "organization_id" "uuid", "event_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_automation_event"("event_type" "text", "organization_id" "uuid", "event_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_client_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_client_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_client_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_collaborator_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_collaborator_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_collaborator_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_consultation_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_consultation_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_consultation_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_consultation_completed"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_consultation_completed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_consultation_completed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_expense_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_expense_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_expense_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_important_expense"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_important_expense"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_important_expense"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_lead_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_lead_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_lead_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_lead_stage_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_lead_stage_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_lead_stage_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_marketing_investment"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_marketing_investment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_marketing_investment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_new_appointment"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_new_appointment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_new_appointment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_new_lead"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_new_lead"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_new_lead"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_new_patient"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_new_patient"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_new_patient"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_new_payment"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_new_payment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_new_payment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_new_professional"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_new_professional"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_new_professional"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_organization_users"("p_organization_id" "uuid", "p_tipo" "text", "p_mensagem" "text", "p_link" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_organization_users"("p_organization_id" "uuid", "p_tipo" "text", "p_mensagem" "text", "p_link" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_organization_users"("p_organization_id" "uuid", "p_tipo" "text", "p_mensagem" "text", "p_link" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_payment_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_payment_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_payment_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_users_by_role"("p_organization_id" "uuid", "p_roles" "text"[], "p_tipo" "text", "p_mensagem" "text", "p_link" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_users_by_role"("p_organization_id" "uuid", "p_roles" "text"[], "p_tipo" "text", "p_mensagem" "text", "p_link" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_users_by_role"("p_organization_id" "uuid", "p_roles" "text"[], "p_tipo" "text", "p_mensagem" "text", "p_link" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."org_me_progress_get"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."org_me_progress_get"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."org_me_progress_get"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."qna_bulk_upsert"("p_organization_id" "uuid", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."qna_bulk_upsert"("p_organization_id" "uuid", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."qna_bulk_upsert"("p_organization_id" "uuid", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."qna_delete"("p_organization_id" "uuid", "p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."qna_delete"("p_organization_id" "uuid", "p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."qna_delete"("p_organization_id" "uuid", "p_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."qna_pairs" TO "anon";
GRANT ALL ON TABLE "public"."qna_pairs" TO "authenticated";
GRANT ALL ON TABLE "public"."qna_pairs" TO "service_role";



GRANT ALL ON FUNCTION "public"."qna_insert"("p_organization_id" "uuid", "p_pergunta" "text", "p_resposta" "text", "p_categoria" "text", "p_tags" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."qna_insert"("p_organization_id" "uuid", "p_pergunta" "text", "p_resposta" "text", "p_categoria" "text", "p_tags" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."qna_insert"("p_organization_id" "uuid", "p_pergunta" "text", "p_resposta" "text", "p_categoria" "text", "p_tags" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."qna_list"("p_organization_id" "uuid", "p_query" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."qna_list"("p_organization_id" "uuid", "p_query" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."qna_list"("p_organization_id" "uuid", "p_query" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."qna_update"("p_organization_id" "uuid", "p_id" "uuid", "p_pergunta" "text", "p_resposta" "text", "p_categoria" "text", "p_tags" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."qna_update"("p_organization_id" "uuid", "p_id" "uuid", "p_pergunta" "text", "p_resposta" "text", "p_categoria" "text", "p_tags" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."qna_update"("p_organization_id" "uuid", "p_id" "uuid", "p_pergunta" "text", "p_resposta" "text", "p_categoria" "text", "p_tags" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."rag_set_org_from_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."rag_set_org_from_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rag_set_org_from_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalc_lead_value"("p_lead_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalc_lead_value"("p_lead_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalc_lead_value"("p_lead_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recalc_lead_value_by_interest"("p_lead_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalc_lead_value_by_interest"("p_lead_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalc_lead_value_by_interest"("p_lead_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reprocess_failed_automation_events"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reprocess_failed_automation_events"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reprocess_failed_automation_events"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."repositorio_de_mensagens" TO "anon";
GRANT ALL ON TABLE "public"."repositorio_de_mensagens" TO "authenticated";
GRANT ALL ON TABLE "public"."repositorio_de_mensagens" TO "service_role";



GRANT ALL ON FUNCTION "public"."rm_buscar"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_sender" "public"."sender_type", "p_numero" "text", "p_query" "text", "p_limit" integer, "p_offset" integer, "p_org" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rm_buscar"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_sender" "public"."sender_type", "p_numero" "text", "p_query" "text", "p_limit" integer, "p_offset" integer, "p_org" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rm_buscar"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_sender" "public"."sender_type", "p_numero" "text", "p_query" "text", "p_limit" integer, "p_offset" integer, "p_org" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rm_get_conversation_messages"("p_organization_id" "uuid", "p_conversation_id" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."rm_get_conversation_messages"("p_organization_id" "uuid", "p_conversation_id" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rm_get_conversation_messages"("p_organization_id" "uuid", "p_conversation_id" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."rm_list_chats"("p_organization_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."rm_list_chats"("p_organization_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rm_list_chats"("p_organization_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."rm_set_org_from_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."rm_set_org_from_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rm_set_org_from_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."safe_uuid"("p_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."safe_uuid"("p_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."safe_uuid"("p_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_client_token_if_missing"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_client_token_if_missing"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_client_token_if_missing"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_context"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_context"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_context"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_rls_context"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_rls_context"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_rls_context"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."setup_crm_database"() TO "anon";
GRANT ALL ON FUNCTION "public"."setup_crm_database"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."setup_crm_database"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_appointment_consultation"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_appointment_consultation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_appointment_consultation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."test_automation_trigger"("p_event_type" "text", "p_organization_id" "uuid", "p_test_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."test_automation_trigger"("p_event_type" "text", "p_organization_id" "uuid", "p_test_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_automation_trigger"("p_event_type" "text", "p_organization_id" "uuid", "p_test_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."test_n8n_connection"("p_organization_id" "uuid", "p_n8n_url" "text", "p_api_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."test_n8n_connection"("p_organization_id" "uuid", "p_n8n_url" "text", "p_api_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_n8n_connection"("p_organization_id" "uuid", "p_n8n_url" "text", "p_api_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."test_webhook_configuration"("p_webhook_config_id" "uuid", "p_test_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."test_webhook_configuration"("p_webhook_config_id" "uuid", "p_test_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_webhook_configuration"("p_webhook_config_id" "uuid", "p_test_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."trail_notes_delete"("p_organization_id" "uuid", "p_trail_type" "text", "p_lesson_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."trail_notes_delete"("p_organization_id" "uuid", "p_trail_type" "text", "p_lesson_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trail_notes_delete"("p_organization_id" "uuid", "p_trail_type" "text", "p_lesson_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trail_notes_get"("p_organization_id" "uuid", "p_trail_type" "text", "p_lesson_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."trail_notes_get"("p_organization_id" "uuid", "p_trail_type" "text", "p_lesson_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trail_notes_get"("p_organization_id" "uuid", "p_trail_type" "text", "p_lesson_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trail_notes_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."trail_notes_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trail_notes_set_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."trail_notes" TO "anon";
GRANT ALL ON TABLE "public"."trail_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."trail_notes" TO "service_role";



GRANT ALL ON FUNCTION "public"."trail_notes_upsert"("p_organization_id" "uuid", "p_trail_type" "text", "p_lesson_key" "text", "p_content" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."trail_notes_upsert"("p_organization_id" "uuid", "p_trail_type" "text", "p_lesson_key" "text", "p_content" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trail_notes_upsert"("p_organization_id" "uuid", "p_trail_type" "text", "p_lesson_key" "text", "p_content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_auto_convert_on_close"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_auto_convert_on_close"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_auto_convert_on_close"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_crm_leads_fix_stage_case"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_crm_leads_fix_stage_case"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_crm_leads_fix_stage_case"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_entradas_from_clients"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_entradas_from_clients"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_entradas_from_clients"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_entradas_from_clients_del"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_entradas_from_clients_del"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_entradas_from_clients_del"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_entradas_from_leads"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_entradas_from_leads"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_entradas_from_leads"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_entradas_from_leads_del"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_entradas_from_leads_del"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_entradas_from_leads_del"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_entradas_from_pagamentos"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_entradas_from_pagamentos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_entradas_from_pagamentos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_entradas_from_pagamentos_del"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_entradas_from_pagamentos_del"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_entradas_from_pagamentos_del"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_recalc_lead_value"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_recalc_lead_value"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_recalc_lead_value"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_recalc_lead_value_on_interest"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_recalc_lead_value_on_interest"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_recalc_lead_value_on_interest"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_recalc_lead_value_on_leads"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_recalc_lead_value_on_leads"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_recalc_lead_value_on_leads"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_set_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_set_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_set_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_sync_client_payment_from_lead"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_sync_client_payment_from_lead"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_sync_client_payment_from_lead"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_appointment_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_appointment_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_appointment_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_appointment_status_changed"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_appointment_status_changed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_appointment_status_changed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_automation_on_client_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_automation_on_client_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_automation_on_client_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_client_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_client_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_client_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_client_updated"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_client_updated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_client_updated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_consultation_completed"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_consultation_completed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_consultation_completed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_lead_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_lead_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_lead_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_lead_stage_changed"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_lead_stage_changed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_lead_stage_changed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_notification_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_notification_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_notification_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_payment_received"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_payment_received"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_payment_received"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_webhook_event"("p_organization_id" "uuid", "p_event_type" "text", "p_event_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_webhook_event"("p_organization_id" "uuid", "p_event_type" "text", "p_event_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_webhook_event"("p_organization_id" "uuid", "p_event_type" "text", "p_event_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."try_advisory_lock"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."try_advisory_lock"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."try_advisory_lock"("p" "text") TO "service_role";



GRANT ALL ON TABLE "public"."tutorial_manychat_progress" TO "anon";
GRANT ALL ON TABLE "public"."tutorial_manychat_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."tutorial_manychat_progress" TO "service_role";



GRANT ALL ON FUNCTION "public"."tutorial_manychat_progress_list"("p_organization_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."tutorial_manychat_progress_list"("p_organization_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tutorial_manychat_progress_list"("p_organization_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."tutorial_manychat_progress_upsert"("p_organization_id" "uuid", "p_user_id" "uuid", "p_step_id" "text", "p_completed" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."tutorial_manychat_progress_upsert"("p_organization_id" "uuid", "p_user_id" "uuid", "p_step_id" "text", "p_completed" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."tutorial_manychat_progress_upsert"("p_organization_id" "uuid", "p_user_id" "uuid", "p_step_id" "text", "p_completed" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_appointments_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_appointments_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_appointments_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_n8n_credentials_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_n8n_credentials_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_n8n_credentials_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_professional_stats_on_appointment"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_professional_stats_on_appointment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_professional_stats_on_appointment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_entrada_for_client_valor_pago"("p_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_entrada_for_client_valor_pago"("p_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_entrada_for_client_valor_pago"("p_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_entrada_for_lead_payment"("p_lead_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_entrada_for_lead_payment"("p_lead_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_entrada_for_lead_payment"("p_lead_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_entrada_for_pagamento"("p_pagamento_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_entrada_for_pagamento"("p_pagamento_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_entrada_for_pagamento"("p_pagamento_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."uuid_or_null"("p_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."uuid_or_null"("p_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."uuid_or_null"("p_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."webhook_trigger_appointment_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."webhook_trigger_appointment_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."webhook_trigger_appointment_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."webhook_trigger_appointment_status_changed"() TO "anon";
GRANT ALL ON FUNCTION "public"."webhook_trigger_appointment_status_changed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."webhook_trigger_appointment_status_changed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."webhook_trigger_appointment_updated"() TO "anon";
GRANT ALL ON FUNCTION "public"."webhook_trigger_appointment_updated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."webhook_trigger_appointment_updated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."webhook_trigger_client_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."webhook_trigger_client_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."webhook_trigger_client_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."webhook_trigger_client_updated"() TO "anon";
GRANT ALL ON FUNCTION "public"."webhook_trigger_client_updated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."webhook_trigger_client_updated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."webhook_trigger_collaborator_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."webhook_trigger_collaborator_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."webhook_trigger_collaborator_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."webhook_trigger_collaborator_updated"() TO "anon";
GRANT ALL ON FUNCTION "public"."webhook_trigger_collaborator_updated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."webhook_trigger_collaborator_updated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."webhook_trigger_lead_converted"() TO "anon";
GRANT ALL ON FUNCTION "public"."webhook_trigger_lead_converted"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."webhook_trigger_lead_converted"() TO "service_role";



GRANT ALL ON FUNCTION "public"."webhook_trigger_lead_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."webhook_trigger_lead_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."webhook_trigger_lead_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."webhook_trigger_lead_stage_changed"() TO "anon";
GRANT ALL ON FUNCTION "public"."webhook_trigger_lead_stage_changed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."webhook_trigger_lead_stage_changed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."webhook_trigger_lead_updated"() TO "anon";
GRANT ALL ON FUNCTION "public"."webhook_trigger_lead_updated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."webhook_trigger_lead_updated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."webhook_trigger_payment_received"() TO "anon";
GRANT ALL ON FUNCTION "public"."webhook_trigger_payment_received"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."webhook_trigger_payment_received"() TO "service_role";



GRANT ALL ON FUNCTION "public"."webhook_trigger_product_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."webhook_trigger_product_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."webhook_trigger_product_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."webhook_trigger_product_updated"() TO "anon";
GRANT ALL ON FUNCTION "public"."webhook_trigger_product_updated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."webhook_trigger_product_updated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";









GRANT ALL ON TABLE "public"."ai_agent_metrics_daily_agg" TO "anon";
GRANT ALL ON TABLE "public"."ai_agent_metrics_daily_agg" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_agent_metrics_daily_agg" TO "service_role";



GRANT ALL ON TABLE "public"."ai_interactions" TO "anon";
GRANT ALL ON TABLE "public"."ai_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_interactions" TO "service_role";
GRANT ALL ON TABLE "public"."ai_interactions" TO PUBLIC;



GRANT ALL ON TABLE "public"."analytics_events" TO "anon";
GRANT ALL ON TABLE "public"."analytics_events" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_events" TO "service_role";



GRANT ALL ON TABLE "public"."app_migrations" TO "anon";
GRANT ALL ON TABLE "public"."app_migrations" TO "authenticated";
GRANT ALL ON TABLE "public"."app_migrations" TO "service_role";



GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";
GRANT ALL ON TABLE "public"."appointments" TO PUBLIC;



GRANT ALL ON TABLE "public"."appointments_api" TO "anon";
GRANT ALL ON TABLE "public"."appointments_api" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments_api" TO "service_role";



GRANT ALL ON TABLE "public"."automation_events" TO "anon";
GRANT ALL ON TABLE "public"."automation_events" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_events" TO "service_role";



GRANT ALL ON TABLE "public"."automation_executions" TO "anon";
GRANT ALL ON TABLE "public"."automation_executions" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_executions" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_events" TO "service_role";
GRANT ALL ON TABLE "public"."calendar_events" TO PUBLIC;



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."collaborators" TO "anon";
GRANT ALL ON TABLE "public"."collaborators" TO "authenticated";
GRANT ALL ON TABLE "public"."collaborators" TO "service_role";



GRANT ALL ON TABLE "public"."consultations" TO "anon";
GRANT ALL ON TABLE "public"."consultations" TO "authenticated";
GRANT ALL ON TABLE "public"."consultations" TO "service_role";
GRANT ALL ON TABLE "public"."consultations" TO PUBLIC;



GRANT ALL ON TABLE "public"."saas_organizations" TO "anon";
GRANT ALL ON TABLE "public"."saas_organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."saas_organizations" TO "service_role";
GRANT ALL ON TABLE "public"."saas_organizations" TO PUBLIC;



GRANT ALL ON TABLE "public"."crm_funnel" TO "anon";
GRANT ALL ON TABLE "public"."crm_funnel" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_funnel" TO "service_role";
GRANT ALL ON TABLE "public"."crm_funnel" TO PUBLIC;



GRANT ALL ON TABLE "public"."crm_import_prefs" TO "anon";
GRANT ALL ON TABLE "public"."crm_import_prefs" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_import_prefs" TO "service_role";



GRANT ALL ON TABLE "public"."crm_lead_activities" TO "anon";
GRANT ALL ON TABLE "public"."crm_lead_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_lead_activities" TO "service_role";
GRANT ALL ON TABLE "public"."crm_lead_activities" TO PUBLIC;



GRANT ALL ON TABLE "public"."crm_lead_notes" TO "anon";
GRANT ALL ON TABLE "public"."crm_lead_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_lead_notes" TO "service_role";
GRANT ALL ON TABLE "public"."crm_lead_notes" TO PUBLIC;



GRANT ALL ON TABLE "public"."crm_leads_import_staging" TO "anon";
GRANT ALL ON TABLE "public"."crm_leads_import_staging" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_leads_import_staging" TO "service_role";



GRANT ALL ON TABLE "public"."crm_stage_aliases" TO "anon";
GRANT ALL ON TABLE "public"."crm_stage_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_stage_aliases" TO "service_role";



GRANT ALL ON TABLE "public"."despesas" TO "anon";
GRANT ALL ON TABLE "public"."despesas" TO "authenticated";
GRANT ALL ON TABLE "public"."despesas" TO "service_role";
GRANT ALL ON TABLE "public"."despesas" TO PUBLIC;



GRANT ALL ON TABLE "public"."entradas" TO "anon";
GRANT ALL ON TABLE "public"."entradas" TO "authenticated";
GRANT ALL ON TABLE "public"."entradas" TO "service_role";



GRANT ALL ON TABLE "public"."entradas_source_links" TO "anon";
GRANT ALL ON TABLE "public"."entradas_source_links" TO "authenticated";
GRANT ALL ON TABLE "public"."entradas_source_links" TO "service_role";



GRANT ALL ON TABLE "public"."external_integrations" TO "anon";
GRANT ALL ON TABLE "public"."external_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."external_integrations" TO "service_role";
GRANT ALL ON TABLE "public"."external_integrations" TO PUBLIC;



GRANT ALL ON TABLE "public"."saidas" TO "anon";
GRANT ALL ON TABLE "public"."saidas" TO "authenticated";
GRANT ALL ON TABLE "public"."saidas" TO "service_role";



GRANT ALL ON TABLE "public"."financial_dashboard" TO "anon";
GRANT ALL ON TABLE "public"."financial_dashboard" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_dashboard" TO "service_role";



GRANT ALL ON TABLE "public"."pagamentos" TO "anon";
GRANT ALL ON TABLE "public"."pagamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."pagamentos" TO "service_role";
GRANT ALL ON TABLE "public"."pagamentos" TO PUBLIC;



GRANT ALL ON TABLE "public"."financial_summary" TO "anon";
GRANT ALL ON TABLE "public"."financial_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_summary" TO "service_role";
GRANT ALL ON TABLE "public"."financial_summary" TO PUBLIC;



GRANT ALL ON TABLE "public"."investimentos_marketing" TO "anon";
GRANT ALL ON TABLE "public"."investimentos_marketing" TO "authenticated";
GRANT ALL ON TABLE "public"."investimentos_marketing" TO "service_role";
GRANT ALL ON TABLE "public"."investimentos_marketing" TO PUBLIC;



GRANT ALL ON TABLE "public"."james" TO "anon";
GRANT ALL ON TABLE "public"."james" TO "authenticated";
GRANT ALL ON TABLE "public"."james" TO "service_role";



GRANT ALL ON TABLE "public"."n8n_connections" TO "anon";
GRANT ALL ON TABLE "public"."n8n_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."n8n_connections" TO "service_role";



GRANT ALL ON TABLE "public"."n8n_credentials" TO "anon";
GRANT ALL ON TABLE "public"."n8n_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."n8n_credentials" TO "service_role";



GRANT ALL ON TABLE "public"."n8n_workflows" TO "anon";
GRANT ALL ON TABLE "public"."n8n_workflows" TO "authenticated";
GRANT ALL ON TABLE "public"."n8n_workflows" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";
GRANT ALL ON TABLE "public"."notifications" TO PUBLIC;



GRANT ALL ON TABLE "public"."patients" TO "anon";
GRANT ALL ON TABLE "public"."patients" TO "authenticated";
GRANT ALL ON TABLE "public"."patients" TO "service_role";



GRANT ALL ON TABLE "public"."produto_variantes" TO "anon";
GRANT ALL ON TABLE "public"."produto_variantes" TO "authenticated";
GRANT ALL ON TABLE "public"."produto_variantes" TO "service_role";



GRANT ALL ON TABLE "public"."produtos_relacionados" TO "anon";
GRANT ALL ON TABLE "public"."produtos_relacionados" TO "authenticated";
GRANT ALL ON TABLE "public"."produtos_relacionados" TO "service_role";



GRANT ALL ON TABLE "public"."produtos_servicos" TO "anon";
GRANT ALL ON TABLE "public"."produtos_servicos" TO "authenticated";
GRANT ALL ON TABLE "public"."produtos_servicos" TO "service_role";



GRANT ALL ON TABLE "public"."professionals" TO "anon";
GRANT ALL ON TABLE "public"."professionals" TO "authenticated";
GRANT ALL ON TABLE "public"."professionals" TO "service_role";



GRANT ALL ON TABLE "public"."rag_items" TO "anon";
GRANT ALL ON TABLE "public"."rag_items" TO "authenticated";
GRANT ALL ON TABLE "public"."rag_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rag_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rag_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rag_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."rag_sources" TO "anon";
GRANT ALL ON TABLE "public"."rag_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."rag_sources" TO "service_role";



GRANT ALL ON TABLE "public"."report_filter_presets" TO "anon";
GRANT ALL ON TABLE "public"."report_filter_presets" TO "authenticated";
GRANT ALL ON TABLE "public"."report_filter_presets" TO "service_role";



GRANT ALL ON TABLE "public"."saas_sync_settings" TO "anon";
GRANT ALL ON TABLE "public"."saas_sync_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."saas_sync_settings" TO "service_role";



GRANT ALL ON TABLE "public"."servicos" TO "anon";
GRANT ALL ON TABLE "public"."servicos" TO "authenticated";
GRANT ALL ON TABLE "public"."servicos" TO "service_role";
GRANT ALL ON TABLE "public"."servicos" TO PUBLIC;



GRANT ALL ON TABLE "public"."tomikcrm_schema_migrations" TO "anon";
GRANT ALL ON TABLE "public"."tomikcrm_schema_migrations" TO "authenticated";
GRANT ALL ON TABLE "public"."tomikcrm_schema_migrations" TO "service_role";



GRANT ALL ON TABLE "public"."user_dashboard_prefs" TO "anon";
GRANT ALL ON TABLE "public"."user_dashboard_prefs" TO "authenticated";
GRANT ALL ON TABLE "public"."user_dashboard_prefs" TO "service_role";



GRANT ALL ON TABLE "public"."user_invitations" TO "anon";
GRANT ALL ON TABLE "public"."user_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_invitations" TO "service_role";
GRANT ALL ON TABLE "public"."user_invitations" TO PUBLIC;



GRANT ALL ON TABLE "public"."user_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";
GRANT ALL ON TABLE "public"."users" TO PUBLIC;



GRANT ALL ON TABLE "public"."v_analytics_dau" TO "anon";
GRANT ALL ON TABLE "public"."v_analytics_dau" TO "authenticated";
GRANT ALL ON TABLE "public"."v_analytics_dau" TO "service_role";



GRANT ALL ON TABLE "public"."v_feature_adoption" TO "anon";
GRANT ALL ON TABLE "public"."v_feature_adoption" TO "authenticated";
GRANT ALL ON TABLE "public"."v_feature_adoption" TO "service_role";



GRANT ALL ON TABLE "public"."vw_rm_conversas" TO "anon";
GRANT ALL ON TABLE "public"."vw_rm_conversas" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_rm_conversas" TO "service_role";



GRANT ALL ON TABLE "public"."vw_rm_insights_diarios" TO "anon";
GRANT ALL ON TABLE "public"."vw_rm_insights_diarios" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_rm_insights_diarios" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_configurations" TO "anon";
GRANT ALL ON TABLE "public"."webhook_configurations" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_configurations" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_event_types" TO "anon";
GRANT ALL ON TABLE "public"."webhook_event_types" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_event_types" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_logs" TO "anon";
GRANT ALL ON TABLE "public"."webhook_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_logs" TO "service_role";
GRANT ALL ON TABLE "public"."webhook_logs" TO PUBLIC;



GRANT ALL ON TABLE "public"."whatsapp_contacts" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_conversations" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_events" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_events" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_events" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_instances" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_instances" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_integrations" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_messages" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_messages" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_user_webhooks" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_user_webhooks" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_user_webhooks" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;





insert into public.app_migrations (version, applied_at)
values ('92', now())
on conflict (version) do nothing;

SELECT 'CLIENT SUPABASE CONFIGURADO COM SUCESSO, VERIFIQUE SUA TABLE EDITOR ✅' AS message;