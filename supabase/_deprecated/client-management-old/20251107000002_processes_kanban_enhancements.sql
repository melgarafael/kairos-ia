-- =====================================================
-- PROCESSES KANBAN ENHANCEMENTS
-- =====================================================
-- Melhorias para transformar processos em Kanban estilo Trello
-- =====================================================

-- Adicionar campos para Kanban
ALTER TABLE public.automation_processes 
ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'onboarding' CHECK (stage IN ('onboarding', 'implementation', 'monitoring'));

ALTER TABLE public.automation_processes 
ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

ALTER TABLE public.automation_processes 
ADD COLUMN IF NOT EXISTS cover_color TEXT;

-- Adicionar relacionamentos com outras entidades (menções)
ALTER TABLE public.automation_processes
ADD COLUMN IF NOT EXISTS mentioned_appointments UUID[] DEFAULT '{}';

ALTER TABLE public.automation_processes
ADD COLUMN IF NOT EXISTS mentioned_transcriptions UUID[] DEFAULT '{}';

ALTER TABLE public.automation_processes
ADD COLUMN IF NOT EXISTS mentioned_briefings UUID[] DEFAULT '{}';

-- Criar índice para stage
CREATE INDEX IF NOT EXISTS idx_automation_processes_stage ON public.automation_processes(stage, position);

-- RPC para listar processos em formato Kanban
CREATE OR REPLACE FUNCTION automation_processes_kanban_list(
  p_organization_id UUID
)
RETURNS TABLE (
  stage TEXT,
  processes JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
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

-- RPC para mover processo entre stages
CREATE OR REPLACE FUNCTION automation_process_move_stage(
  p_organization_id UUID,
  p_process_id UUID,
  p_new_stage TEXT,
  p_new_position INTEGER
)
RETURNS automation_processes
LANGUAGE plpgsql
SECURITY DEFINER
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

-- RPC para atualizar menções
CREATE OR REPLACE FUNCTION automation_process_update_mentions(
  p_organization_id UUID,
  p_process_id UUID,
  p_mentioned_appointments UUID[] DEFAULT NULL,
  p_mentioned_transcriptions UUID[] DEFAULT NULL,
  p_mentioned_briefings UUID[] DEFAULT NULL
)
RETURNS automation_processes
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION automation_processes_kanban_list TO anon, authenticated;
GRANT EXECUTE ON FUNCTION automation_process_move_stage TO anon, authenticated;
GRANT EXECUTE ON FUNCTION automation_process_update_mentions TO anon, authenticated;

-- =====================================================
-- FIM DAS MELHORIAS
-- =====================================================

