-- v85 – RPC para Reordenar Leads em Estágio (crm_leads_reorder_stage)
-- Objetivo:
--  1) Criar RPC que reordena todos os leads de um estágio sequencialmente
--  2) Garantir que stage_order seja único e sequencial (0, 1, 2, 3...) sem conflitos
--  3) Resolver problema de reordenação onde apenas um lead era atualizado, causando conflitos

begin;

-- RPC para reordenar leads em um estágio após mover um lead
-- Garante que stage_order seja sequencial (0, 1, 2, 3...) sem conflitos
CREATE OR REPLACE FUNCTION public.crm_leads_reorder_stage(
  p_organization_id uuid,
  p_stage text,
  p_lead_ids uuid[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.crm_leads_reorder_stage(uuid, text, uuid[]) TO authenticated, anon;

COMMENT ON FUNCTION public.crm_leads_reorder_stage IS 
  'Reordena leads em um estágio específico, garantindo stage_order sequencial sem conflitos. Usado após drag-and-drop no Kanban.';

commit;

-- Registrar versão
create table if not exists public.app_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

insert into public.app_migrations (version, applied_at)
values ('85', now())
on conflict (version) do nothing;

