-- CLIENT: Generic RPC to migrate all rows from one organization to another
-- Moves data by updating organization_id across all public tables that contain such column

create or replace function public.migrate_organization_data(
  p_from_org_id uuid,
  p_to_org_id uuid,
  p_user_id uuid,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

  -- Validate ownership (owner_id lives in client.saas_organizations)
  select owner_id into from_owner from public.saas_organizations where id = p_from_org_id;
  select owner_id into to_owner from public.saas_organizations where id = p_to_org_id;
  if from_owner is null or to_owner is null then
    raise exception 'source or target organization not found';
  end if;
  if from_owner <> p_user_id or to_owner <> p_user_id then
    raise exception 'user is not owner of both organizations';
  end if;

  if not p_dry_run then
    -- (removed) specific handling; rely on generic cloning below for any parent tables

    -- Generic pre-step: for every composite FK that includes organization_id on parent table,
    -- clone missing parent rows from source org to destination org based on the natural key set
    -- (all referenced columns except organization_id).
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
        -- Only handle composite FKs that include organization_id
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
            -- Build dynamic column list excluding id so defaults (e.g., gen_random_uuid) fire
            select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position) into col_list
            from information_schema.columns c
            where c.table_schema = fk_rec.parent_schema and c.table_name = fk_rec.parent_table and c.column_name <> 'id';
            select string_agg(
                     format('(rec).%I', c.column_name),
                     ', ' order by c.ordinal_position) into sel_list
            from information_schema.columns c
            where c.table_schema = fk_rec.parent_schema and c.table_name = fk_rec.parent_table and c.column_name <> 'id';

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
              -- if table disappears or not present, ignore
              null;
            end;
          end if;
        end if;
      end loop;
    end;
  end if;

  -- Iterate over all tables in public schema that have organization_id column
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
    -- Detect column type (uuid vs text/varchar) to cast parameters correctly
    select c.data_type into org_col_type
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = r.table_name and c.column_name = 'organization_id'
    limit 1;

    -- Check if table has updated_at to maintain timestamps
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
$$;


