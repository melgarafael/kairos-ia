-- Normalize legacy values in produtos_servicos to satisfy CHECK constraints
-- This migration maps common variants (case/accents) to the canonical values
-- Safe to run multiple times

begin;

-- Categoria: canonical set
-- ['Consulta','Exame','Procedimento','Terapia','Cirurgia','Medicamento','Equipamento','Material','Software','Imovel','Treinamento','Outros']
update public.produtos_servicos set categoria = 'Consulta' where categoria ilike 'consulta';
update public.produtos_servicos set categoria = 'Exame' where categoria ilike 'exame';
update public.produtos_servicos set categoria = 'Procedimento' where categoria ilike 'procedimento';
update public.produtos_servicos set categoria = 'Terapia' where categoria ilike 'terapia';
update public.produtos_servicos set categoria = 'Cirurgia' where categoria ilike 'cirurgia';
update public.produtos_servicos set categoria = 'Medicamento' where categoria ilike 'medicamento';
update public.produtos_servicos set categoria = 'Equipamento' where categoria ilike 'equipamento';
update public.produtos_servicos set categoria = 'Material' where categoria ilike 'material';
update public.produtos_servicos set categoria = 'Software' where categoria ilike 'software';
-- Handle accented/improper forms for Imovel
update public.produtos_servicos set categoria = 'Imovel' where categoria in ('Imóvel','imóvel','Imovel','imovel');
update public.produtos_servicos set categoria = 'Treinamento' where categoria ilike 'treinamento';
update public.produtos_servicos set categoria = 'Outros' where categoria ilike 'outros';

-- Anything else -> Outros
update public.produtos_servicos
   set categoria = 'Outros'
 where categoria not in ('Consulta','Exame','Procedimento','Terapia','Cirurgia','Medicamento','Equipamento','Material','Software','Imovel','Treinamento','Outros');

-- Tipo: canonical set
-- ['produto','servico','consultoria','assinatura','curso','evento','imovel','software']
update public.produtos_servicos set tipo = 'produto' where lower(tipo) in ('produto','produtos');
update public.produtos_servicos set tipo = 'servico' where lower(tipo) in ('servico','serviço','servicos','serviços');
update public.produtos_servicos set tipo = 'consultoria' where lower(tipo) like 'consultoria%';
update public.produtos_servicos set tipo = 'assinatura' where lower(tipo) like 'assinatura%';
update public.produtos_servicos set tipo = 'curso' where lower(tipo) like 'curso%';
update public.produtos_servicos set tipo = 'evento' where lower(tipo) like 'evento%';
update public.produtos_servicos set tipo = 'imovel' where lower(tipo) in ('imovel','imóvel','imoveis','imóveis');
update public.produtos_servicos set tipo = 'software' where lower(tipo) like 'software%';

-- Fallback para valores fora do conjunto
update public.produtos_servicos
   set tipo = 'servico'
 where lower(tipo) not in ('produto','servico','serviço','consultoria','assinatura','curso','evento','imovel','imóvel','software');

-- Cobranca_tipo: canonical set
-- ['unica','mensal','trimestral','semestral','anual']
update public.produtos_servicos set cobranca_tipo = 'unica' where lower(cobranca_tipo) in ('unica','única');
update public.produtos_servicos set cobranca_tipo = 'mensal' where lower(cobranca_tipo) like 'mensal%';
update public.produtos_servicos set cobranca_tipo = 'trimestral' where lower(cobranca_tipo) like 'trimestral%';
update public.produtos_servicos set cobranca_tipo = 'semestral' where lower(cobranca_tipo) like 'semestral%';
update public.produtos_servicos set cobranca_tipo = 'anual' where lower(cobranca_tipo) like 'anual%';

-- Fallback para valores fora do conjunto
update public.produtos_servicos
   set cobranca_tipo = 'unica'
 where lower(cobranca_tipo) not in ('unica','única','mensal','trimestral','semestral','anual');

commit;


-- Atualiza o CHECK de categoria da tabela produtos_servicos para incluir 'Imovel'
-- e alinhar ao conjunto canônico utilizado no frontend.

begin;

alter table public.produtos_servicos
  drop constraint if exists produtos_servicos_categoria_check;

alter table public.produtos_servicos
  add constraint produtos_servicos_categoria_check
  check (
    categoria = any (array[
      'Consulta',
      'Exame',
      'Procedimento',
      'Terapia',
      'Cirurgia',
      'Medicamento',
      'Equipamento',
      'Material',
      'Software',
      'Imovel',
      'Treinamento',
      'Outros'
    ])
  );

commit;



-- 5) Marcar versão
insert into public.app_migrations (version, applied_at)
values ('12', now())
on conflict (version) do nothing;
