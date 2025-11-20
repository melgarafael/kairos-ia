-- RPC para migração de dados entre organizações
-- Recria IDs primários e ajusta FKs automaticamente
-- Suporta dry-run para simulação
-- Aceita credenciais do banco de origem para migração cross-database

create or replace function public.migrate_organization_data(
  p_from_org_id uuid,
  p_to_org_id uuid,
  p_user_id uuid,
  p_dry_run boolean default true,
  p_source_url text default null,
  p_source_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mapping jsonb := '{}'::jsonb;
  v_result jsonb;
  v_tables jsonb := '[]'::jsonb;
  v_total_records int := 0;
  v_record_count int;
  v_new_id uuid;
  v_old_id uuid;
  v_stage_name text;
  v_new_stage_id uuid;
  v_client_rec record;
  v_collaborator_rec record;
  v_stage_rec record;
  v_lead_rec record;
  v_appointment_rec record;
  v_entrada_rec record;
  v_saida_rec record;
  v_produto_rec record;
begin
  -- Validar que as organizações existem
  if not exists (select 1 from saas_organizations where id = p_from_org_id) then
    raise exception 'Organização origem não encontrada';
  end if;
  if not exists (select 1 from saas_organizations where id = p_to_org_id) then
    raise exception 'Organização destino não encontrada';
  end if;
  if p_from_org_id = p_to_org_id then
    raise exception 'Origem e destino devem ser diferentes';
  end if;

  -- Se dry-run, apenas contar e retornar plano
  if p_dry_run then
    -- Contar registros por tabela
    select count(*) into v_record_count from clients where organization_id = p_from_org_id;
    v_total_records := v_total_records + v_record_count;
    v_tables := v_tables || jsonb_build_object('table', 'clients', 'count', v_record_count);

    select count(*) into v_record_count from collaborators where organization_id = p_from_org_id;
    v_total_records := v_total_records + v_record_count;
    v_tables := v_tables || jsonb_build_object('table', 'collaborators', 'count', v_record_count);

    select count(*) into v_record_count from crm_stages where organization_id = p_from_org_id;
    v_total_records := v_total_records + v_record_count;
    v_tables := v_tables || jsonb_build_object('table', 'crm_stages', 'count', v_record_count);

    select count(*) into v_record_count from crm_leads where organization_id = p_from_org_id;
    v_total_records := v_total_records + v_record_count;
    v_tables := v_tables || jsonb_build_object('table', 'crm_leads', 'count', v_record_count);

    select count(*) into v_record_count from appointments where organization_id = p_from_org_id;
    v_total_records := v_total_records + v_record_count;
    v_tables := v_tables || jsonb_build_object('table', 'appointments', 'count', v_record_count);

    select count(*) into v_record_count from entradas where organization_id = p_from_org_id;
    v_total_records := v_total_records + v_record_count;
    v_tables := v_tables || jsonb_build_object('table', 'entradas', 'count', v_record_count);

    select count(*) into v_record_count from saidas where organization_id = p_from_org_id;
    v_total_records := v_total_records + v_record_count;
    v_tables := v_tables || jsonb_build_object('table', 'saidas', 'count', v_record_count);

    select count(*) into v_record_count from produtos_servicos where organization_id = p_from_org_id;
    v_total_records := v_total_records + v_record_count;
    v_tables := v_tables || jsonb_build_object('table', 'produtos_servicos', 'count', v_record_count);

    return jsonb_build_object(
      'dry_run', true,
      'tables', v_tables,
      'records_count', v_total_records,
      'from_org_id', p_from_org_id,
      'to_org_id', p_to_org_id
    );
  end if;

  -- MIGRAÇÃO REAL
  -- Começar transação implícita
  begin
    -- 1. Migrar CRM Stages primeiro (precisa mapear para crm_leads)
    for v_stage_rec in 
      select * from crm_stages where organization_id = p_from_org_id
    loop
      -- Verificar se stage com mesmo nome já existe no destino
      select id into v_new_stage_id 
      from crm_stages 
      where organization_id = p_to_org_id and name = v_stage_rec.name;
      
      if v_new_stage_id is null then
        -- Criar novo stage
        v_new_id := gen_random_uuid();
        insert into crm_stages (
          id, organization_id, name, order_index, color, created_at, updated_at
        ) values (
          v_new_id, p_to_org_id, v_stage_rec.name, 
          coalesce(v_stage_rec.order_index, 0), 
          coalesce(v_stage_rec.color, '#666666'),
          v_stage_rec.created_at, v_stage_rec.updated_at
        );
        v_new_stage_id := v_new_id;
      end if;
      
      -- Mapear old_id -> new_id
      v_mapping := v_mapping || jsonb_build_object(
        'crm_stages', coalesce(v_mapping->'crm_stages', '{}'::jsonb) || 
        jsonb_build_object(v_stage_rec.id::text, v_new_stage_id::text)
      );
    end loop;

    -- 2. Migrar Clients
    for v_client_rec in 
      select * from clients where organization_id = p_from_org_id
    loop
      v_new_id := gen_random_uuid();
      insert into clients (
        id, organization_id, nome, email, telefone, nascimento, documentos,
        endereco, observacoes, ativo, valor_pago, created_at, updated_at
      ) values (
        v_new_id, p_to_org_id, v_client_rec.nome, v_client_rec.email,
        v_client_rec.telefone, v_client_rec.nascimento, v_client_rec.documentos,
        v_client_rec.endereco, v_client_rec.observacoes, 
        coalesce(v_client_rec.ativo, true), 
        coalesce(v_client_rec.valor_pago, 0),
        v_client_rec.created_at, v_client_rec.updated_at
      );
      
      v_mapping := v_mapping || jsonb_build_object(
        'clients', coalesce(v_mapping->'clients', '{}'::jsonb) || 
        jsonb_build_object(v_client_rec.id::text, v_new_id::text)
      );
    end loop;

    -- 3. Migrar Collaborators
    for v_collaborator_rec in 
      select * from collaborators where organization_id = p_from_org_id
    loop
      v_new_id := gen_random_uuid();
      insert into collaborators (
        id, organization_id, user_id, name, position, email, phone,
        credentials, notes, active, total_consultations, consultations_this_month,
        upcoming_appointments, average_rating, created_at, updated_at
      ) values (
        v_new_id, p_to_org_id, v_collaborator_rec.user_id,
        v_collaborator_rec.name, v_collaborator_rec.position,
        v_collaborator_rec.email, v_collaborator_rec.phone,
        v_collaborator_rec.credentials, v_collaborator_rec.notes,
        coalesce(v_collaborator_rec.active, true),
        coalesce(v_collaborator_rec.total_consultations, 0),
        coalesce(v_collaborator_rec.consultations_this_month, 0),
        coalesce(v_collaborator_rec.upcoming_appointments, 0),
        v_collaborator_rec.average_rating,
        v_collaborator_rec.created_at, v_collaborator_rec.updated_at
      );
      
      v_mapping := v_mapping || jsonb_build_object(
        'collaborators', coalesce(v_mapping->'collaborators', '{}'::jsonb) || 
        jsonb_build_object(v_collaborator_rec.id::text, v_new_id::text)
      );
    end loop;

    -- 4. Migrar Produtos/Serviços
    for v_produto_rec in 
      select * from produtos_servicos where organization_id = p_from_org_id
    loop
      v_new_id := gen_random_uuid();
      insert into produtos_servicos (
        id, organization_id, nome, descricao, tipo, categoria, preco_base,
        ativo, tipo_cobranca, cobranca_tipo, tem_estoque, estoque_quantidade,
        created_at, updated_at
      ) values (
        v_new_id, p_to_org_id, v_produto_rec.nome, v_produto_rec.descricao,
        v_produto_rec.tipo, v_produto_rec.categoria, v_produto_rec.preco_base,
        coalesce(v_produto_rec.ativo, true), v_produto_rec.tipo_cobranca,
        v_produto_rec.cobranca_tipo, coalesce(v_produto_rec.tem_estoque, false),
        v_produto_rec.estoque_quantidade,
        v_produto_rec.created_at, v_produto_rec.updated_at
      );
      
      v_mapping := v_mapping || jsonb_build_object(
        'produtos_servicos', coalesce(v_mapping->'produtos_servicos', '{}'::jsonb) || 
        jsonb_build_object(v_produto_rec.id::text, v_new_id::text)
      );
    end loop;

    -- 5. Migrar CRM Leads (depois de stages, clients, collaborators, produtos)
    for v_lead_rec in 
      select * from crm_leads where organization_id = p_from_org_id
    loop
      v_new_id := gen_random_uuid();
      
      -- Mapear stage
      v_stage_name := v_lead_rec.stage;
      if v_stage_name is not null then
        -- Buscar stage mapeado pelo nome
        select id into v_new_stage_id 
        from crm_stages 
        where organization_id = p_to_org_id and name = v_stage_name
        limit 1;
      end if;
      
      -- Mapear FKs
      v_old_id := v_lead_rec.created_by;
      if v_old_id is not null and v_mapping->'collaborators' ? v_old_id::text then
        v_old_id := (v_mapping->'collaborators'->>v_old_id::text)::uuid;
      end if;
      
      declare
        v_client_fk uuid;
        v_produto_fk uuid;
        v_assigned_fk uuid;
      begin
        v_client_fk := null;
        if v_lead_rec.converted_client_id is not null and v_mapping->'clients' ? v_lead_rec.converted_client_id::text then
          v_client_fk := (v_mapping->'clients'->>v_lead_rec.converted_client_id::text)::uuid;
        end if;
        
        v_produto_fk := null;
        if v_lead_rec.sold_produto_servico_id is not null and v_mapping->'produtos_servicos' ? v_lead_rec.sold_produto_servico_id::text then
          v_produto_fk := (v_mapping->'produtos_servicos'->>v_lead_rec.sold_produto_servico_id::text)::uuid;
        end if;
        
        v_assigned_fk := null;
        if v_lead_rec.assigned_to is not null and v_mapping->'collaborators' ? v_lead_rec.assigned_to::text then
          v_assigned_fk := (v_mapping->'collaborators'->>v_lead_rec.assigned_to::text)::uuid;
        end if;
        
        insert into crm_leads (
          id, organization_id, name, whatsapp, email, stage, description,
          value, priority, source, canal, created_by, assigned_to,
          has_payment, payment_value, is_highlight, lost_reason,
          converted_client_id, converted_at, has_whatsapp, instagram_username,
          cnpj, company_name, show_in_kanban, sold_produto_servico_id,
          sold_quantity, interests, interest_produto_servico_id,
          interest_quantity, created_at, updated_at
        ) values (
          v_new_id, p_to_org_id, v_lead_rec.name, v_lead_rec.whatsapp,
          v_lead_rec.email, v_stage_name, v_lead_rec.description,
          v_lead_rec.value, v_lead_rec.priority, v_lead_rec.source,
          v_lead_rec.canal, (v_mapping->'collaborators'->>v_lead_rec.created_by::text)::uuid,
          v_assigned_fk, coalesce(v_lead_rec.has_payment, false),
          v_lead_rec.payment_value, coalesce(v_lead_rec.is_highlight, false),
          v_lead_rec.lost_reason, v_client_fk, v_lead_rec.converted_at,
          coalesce(v_lead_rec.has_whatsapp, false), v_lead_rec.instagram_username,
          v_lead_rec.cnpj, v_lead_rec.company_name, 
          coalesce(v_lead_rec.show_in_kanban, true), v_produto_fk,
          v_lead_rec.sold_quantity, v_lead_rec.interests,
          (case when v_lead_rec.interest_produto_servico_id is not null and v_mapping->'produtos_servicos' ? v_lead_rec.interest_produto_servico_id::text 
            then (v_mapping->'produtos_servicos'->>v_lead_rec.interest_produto_servico_id::text)::uuid else null end),
          v_lead_rec.interest_quantity, v_lead_rec.created_at, v_lead_rec.updated_at
        );
      end;
      
      v_mapping := v_mapping || jsonb_build_object(
        'crm_leads', coalesce(v_mapping->'crm_leads', '{}'::jsonb) || 
        jsonb_build_object(v_lead_rec.id::text, v_new_id::text)
      );
    end loop;

    -- 6. Migrar Appointments (depois de clients, collaborators, leads)
    for v_appointment_rec in 
      select * from appointments where organization_id = p_from_org_id
    loop
      v_new_id := gen_random_uuid();
      
      declare
        v_client_fk uuid;
        v_lead_fk uuid;
        v_collaborator_fk uuid;
      begin
        v_client_fk := null;
        if v_appointment_rec.client_id is not null and v_mapping->'clients' ? v_appointment_rec.client_id::text then
          v_client_fk := (v_mapping->'clients'->>v_appointment_rec.client_id::text)::uuid;
        end if;
        
        v_lead_fk := null;
        if v_appointment_rec.lead_id is not null and v_mapping->'crm_leads' ? v_appointment_rec.lead_id::text then
          v_lead_fk := (v_mapping->'crm_leads'->>v_appointment_rec.lead_id::text)::uuid;
        end if;
        
        v_collaborator_fk := null;
        if v_appointment_rec.collaborator_id is not null and v_mapping->'collaborators' ? v_appointment_rec.collaborator_id::text then
          v_collaborator_fk := (v_mapping->'collaborators'->>v_appointment_rec.collaborator_id::text)::uuid;
        end if;
        
        insert into appointments (
          id, organization_id, datetime, duration_minutes, tipo, status,
          client_id, lead_id, collaborator_id, title, valor_consulta,
          anotacoes, arquivos, metadata, created_at, updated_at
        ) values (
          v_new_id, p_to_org_id, v_appointment_rec.datetime,
          v_appointment_rec.duration_minutes, v_appointment_rec.tipo,
          v_appointment_rec.status, v_client_fk, v_lead_fk, v_collaborator_fk,
          v_appointment_rec.title, v_appointment_rec.valor_consulta,
          v_appointment_rec.anotacoes, v_appointment_rec.arquivos,
          v_appointment_rec.metadata, v_appointment_rec.created_at,
          v_appointment_rec.updated_at
        );
      end;
    end loop;

    -- 7. Migrar Entradas (depois de clients, produtos)
    for v_entrada_rec in 
      select * from entradas where organization_id = p_from_org_id
    loop
      v_new_id := gen_random_uuid();
      
      declare
        v_client_fk uuid;
        v_produto_fk uuid;
      begin
        v_client_fk := null;
        if v_entrada_rec.cliente_id is not null and v_mapping->'clients' ? v_entrada_rec.cliente_id::text then
          v_client_fk := (v_mapping->'clients'->>v_entrada_rec.cliente_id::text)::uuid;
        end if;
        
        v_produto_fk := null;
        if v_entrada_rec.produto_servico_id is not null and v_mapping->'produtos_servicos' ? v_entrada_rec.produto_servico_id::text then
          v_produto_fk := (v_mapping->'produtos_servicos'->>v_entrada_rec.produto_servico_id::text)::uuid;
        end if;
        
        insert into entradas (
          id, organization_id, descricao, valor, categoria, data_entrada,
          metodo_pagamento, cliente_id, produto_servico_id, observacoes,
          created_at, updated_at
        ) values (
          v_new_id, p_to_org_id, v_entrada_rec.descricao, v_entrada_rec.valor,
          v_entrada_rec.categoria, v_entrada_rec.data_entrada,
          v_entrada_rec.metodo_pagamento, v_client_fk, v_produto_fk,
          v_entrada_rec.observacoes, v_entrada_rec.created_at,
          v_entrada_rec.updated_at
        );
      end;
    end loop;

    -- 8. Migrar Saídas
    for v_saida_rec in 
      select * from saidas where organization_id = p_from_org_id
    loop
      v_new_id := gen_random_uuid();
      insert into saidas (
        id, organization_id, descricao, valor, categoria, data_saida,
        metodo_pagamento, fornecedor, recorrente, observacoes,
        created_at, updated_at
      ) values (
        v_new_id, p_to_org_id, v_saida_rec.descricao, v_saida_rec.valor,
        v_saida_rec.categoria, v_saida_rec.data_saida,
        v_saida_rec.metodo_pagamento, v_saida_rec.fornecedor,
        coalesce(v_saida_rec.recorrente, false), v_saida_rec.observacoes,
        v_saida_rec.created_at, v_saida_rec.updated_at
      );
    end loop;

    -- Construir resultado
    select jsonb_build_object(
      'dry_run', false,
      'success', true,
      'records_migrated', v_total_records,
      'from_org_id', p_from_org_id,
      'to_org_id', p_to_org_id,
      'mapping_summary', jsonb_build_object(
        'clients', jsonb_object_keys(coalesce(v_mapping->'clients', '{}'::jsonb)),
        'collaborators', jsonb_object_keys(coalesce(v_mapping->'collaborators', '{}'::jsonb)),
        'crm_stages', jsonb_object_keys(coalesce(v_mapping->'crm_stages', '{}'::jsonb)),
        'crm_leads', jsonb_object_keys(coalesce(v_mapping->'crm_leads', '{}'::jsonb)),
        'produtos_servicos', jsonb_object_keys(coalesce(v_mapping->'produtos_servicos', '{}'::jsonb))
      )
    ) into v_result;

    return v_result;
    
  exception when others then
    raise exception 'Erro na migração: %', SQLERRM;
  end;
end;
$$;

grant execute on function public.migrate_organization_data(uuid, uuid, uuid, boolean) to authenticated, anon;

