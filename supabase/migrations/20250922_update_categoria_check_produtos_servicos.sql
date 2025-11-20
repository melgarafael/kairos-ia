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


