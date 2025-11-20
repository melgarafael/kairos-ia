-- crm_stages: meta de conversão por estágio (percentual 0-100)
begin;

alter table if exists public.crm_stages
  add column if not exists meta_conversion_percent numeric check (meta_conversion_percent >= 0 and meta_conversion_percent <= 100);

comment on column public.crm_stages.meta_conversion_percent is 'Meta de conversão desejada para esse estágio, em % (0-100).';

commit;


