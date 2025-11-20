-- Master migration: suporte a gateways (Pagar.me, Hotmart, Ticto)
-- Inclui: colunas em saas_plans/saas_subscriptions, logs de webhook e fila de e-mail

set search_path = public, auth;

begin;

-- saas_plans: códigos externos por gateway (mapear produto/oferta)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'saas_plans' and column_name = 'pagarme_product_id'
  ) then
    alter table public.saas_plans add column pagarme_product_id text;
  end if;
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'saas_plans' and column_name = 'hotmart_offer_code'
  ) then
    alter table public.saas_plans add column hotmart_offer_code text;
  end if;
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'saas_plans' and column_name = 'ticto_product_code'
  ) then
    alter table public.saas_plans add column ticto_product_code text;
  end if;
end $$;

create index if not exists idx_saas_plans_pagarme_product on public.saas_plans(pagarme_product_id);
create index if not exists idx_saas_plans_hotmart_offer on public.saas_plans(hotmart_offer_code);
create index if not exists idx_saas_plans_ticto_product on public.saas_plans(ticto_product_code);

-- saas_subscriptions: colunas para gateways
do $$
begin
  if not exists (
    select 1 from information_schema.columns where table_name = 'saas_subscriptions' and column_name = 'gateway'
  ) then
    alter table public.saas_subscriptions add column gateway text; -- 'stripe' | 'pagarme' | 'hotmart' | 'ticto'
  end if;
  if not exists (
    select 1 from information_schema.columns where table_name = 'saas_subscriptions' and column_name = 'external_subscription_id'
  ) then
    alter table public.saas_subscriptions add column external_subscription_id text; -- id de assinatura no gateway
  end if;
  if not exists (
    select 1 from information_schema.columns where table_name = 'saas_subscriptions' and column_name = 'external_customer_id'
  ) then
    alter table public.saas_subscriptions add column external_customer_id text; -- id do cliente no gateway
  end if;
  if not exists (
    select 1 from information_schema.columns where table_name = 'saas_subscriptions' and column_name = 'external_plan_code'
  ) then
    alter table public.saas_subscriptions add column external_plan_code text; -- produto/oferta/plano no gateway
  end if;
  if not exists (
    select 1 from information_schema.columns where table_name = 'saas_subscriptions' and column_name = 'current_period_start'
  ) then
    alter table public.saas_subscriptions add column current_period_start timestamptz;
  end if;
  if not exists (
    select 1 from information_schema.columns where table_name = 'saas_subscriptions' and column_name = 'current_period_end'
  ) then
    alter table public.saas_subscriptions add column current_period_end timestamptz;
  end if;
  if not exists (
    select 1 from information_schema.columns where table_name = 'saas_subscriptions' and column_name = 'cancel_at_period_end'
  ) then
    alter table public.saas_subscriptions add column cancel_at_period_end boolean;
  end if;
end $$;

create index if not exists idx_saas_subscriptions_gateway on public.saas_subscriptions(gateway);
create index if not exists idx_saas_subscriptions_external_id on public.saas_subscriptions(external_subscription_id);
-- Necessário para ON CONFLICT (external_subscription_id)
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'ux_saas_subscriptions_external_subscription_id'
  ) then
    create unique index ux_saas_subscriptions_external_subscription_id
      on public.saas_subscriptions(external_subscription_id)
      where external_subscription_id is not null;
  end if;
end $$;
create index if not exists idx_saas_subscriptions_external_customer on public.saas_subscriptions(external_customer_id);
create index if not exists idx_saas_subscriptions_external_plan on public.saas_subscriptions(external_plan_code);

-- Logs de webhooks (idempotência e auditoria)
create table if not exists public.webhooks_log (
  id uuid primary key default gen_random_uuid(),
  gateway text not null,
  event_type text,
  external_id text,
  idempotency_key text,
  status text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  raw_payload_json jsonb,
  error_message text
);

create index if not exists idx_webhooks_log_gateway on public.webhooks_log(gateway);
create index if not exists idx_webhooks_log_external on public.webhooks_log(external_id);
create unique index if not exists ux_webhooks_log_idempotency on public.webhooks_log(idempotency_key) where idempotency_key is not null;

-- Fila de e-mails transacionais
create table if not exists public.email_queue (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  template text not null,
  variables_json jsonb not null default '{}'::jsonb,
  status text not null default 'pending', -- pending | sent | failed
  scheduled_at timestamptz default now(),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists idx_email_queue_status on public.email_queue(status);

commit;


