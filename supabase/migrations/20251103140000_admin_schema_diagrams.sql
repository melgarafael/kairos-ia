-- Master migration: admin_schema_diagrams table
-- Stores database schema diagram configurations (nodes positions, edges connections)

SET search_path = public, auth;

BEGIN;

-- Create admin_schema_diagrams table
CREATE TABLE IF NOT EXISTS public.admin_schema_diagrams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'default',
  description text,
  
  -- ReactFlow nodes data (positions, types, data)
  nodes_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- ReactFlow edges data (connections between handles)
  edges_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Metadata
  created_by uuid REFERENCES public.saas_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Enforce unique name per creator (or one default per system)
  CONSTRAINT admin_schema_diagrams_name_unique UNIQUE (name)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_schema_diagrams_created_by 
  ON public.admin_schema_diagrams(created_by);
CREATE INDEX IF NOT EXISTS idx_admin_schema_diagrams_name 
  ON public.admin_schema_diagrams(name);

-- Update trigger
CREATE OR REPLACE FUNCTION public.update_admin_schema_diagrams_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_admin_schema_diagrams_updated_at ON public.admin_schema_diagrams;
CREATE TRIGGER trigger_admin_schema_diagrams_updated_at
  BEFORE UPDATE ON public.admin_schema_diagrams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_admin_schema_diagrams_updated_at();

-- Enable RLS
ALTER TABLE public.admin_schema_diagrams ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can read all diagrams
CREATE POLICY "Admins can read schema diagrams"
  ON public.admin_schema_diagrams
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.saas_users
      WHERE saas_users.id = auth.uid()
      AND saas_users.role IN ('owner', 'admin')
    )
  );

-- Admins can insert diagrams
CREATE POLICY "Admins can insert schema diagrams"
  ON public.admin_schema_diagrams
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.saas_users
      WHERE saas_users.id = auth.uid()
      AND saas_users.role IN ('owner', 'admin')
    )
    AND created_by = auth.uid()
  );

-- Admins can update diagrams
CREATE POLICY "Admins can update schema diagrams"
  ON public.admin_schema_diagrams
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.saas_users
      WHERE saas_users.id = auth.uid()
      AND saas_users.role IN ('owner', 'admin')
    )
  );

-- Admins can delete diagrams
CREATE POLICY "Admins can delete schema diagrams"
  ON public.admin_schema_diagrams
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.saas_users
      WHERE saas_users.id = auth.uid()
      AND saas_users.role IN ('owner', 'admin')
    )
  );

-- RPC Functions for easier usage

-- Get or create default diagram
CREATE OR REPLACE FUNCTION public.admin_get_or_create_schema_diagram(
  p_name text DEFAULT 'default'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_diagram_id uuid;
  v_diagram jsonb;
BEGIN
  -- Check if user is admin
  SELECT id INTO v_user_id
  FROM public.saas_users
  WHERE id = auth.uid()
  AND role IN ('owner', 'admin');
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  -- Try to get existing diagram
  SELECT to_jsonb(d.*)
  INTO v_diagram
  FROM public.admin_schema_diagrams d
  WHERE d.name = p_name
  LIMIT 1;
  
  -- If not found, return null (frontend will create)
  RETURN COALESCE(v_diagram, 'null'::jsonb);
END;
$$;

-- Upsert diagram
CREATE OR REPLACE FUNCTION public.admin_upsert_schema_diagram(
  p_name text,
  p_description text DEFAULT NULL,
  p_nodes_data jsonb DEFAULT '[]'::jsonb,
  p_edges_data jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_diagram_id uuid;
  v_result jsonb;
BEGIN
  -- Check if user is admin
  SELECT id INTO v_user_id
  FROM public.saas_users
  WHERE id = auth.uid()
  AND role IN ('owner', 'admin');
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  -- Upsert diagram
  INSERT INTO public.admin_schema_diagrams (
    name,
    description,
    nodes_data,
    edges_data,
    created_by
  )
  VALUES (
    p_name,
    p_description,
    p_nodes_data,
    p_edges_data,
    v_user_id
  )
  ON CONFLICT (name) 
  DO UPDATE SET
    description = EXCLUDED.description,
    nodes_data = EXCLUDED.nodes_data,
    edges_data = EXCLUDED.edges_data,
    updated_at = now()
  RETURNING id INTO v_diagram_id;
  
  -- Return the saved diagram
  SELECT to_jsonb(d.*)
  INTO v_result
  FROM public.admin_schema_diagrams d
  WHERE d.id = v_diagram_id;
  
  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.admin_get_or_create_schema_diagram(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_schema_diagram(text, text, jsonb, jsonb) TO authenticated;

COMMIT;

