ALTER TABLE public.saas_organizations
ADD COLUMN owner_id uuid REFERENCES public.saas_users(id) ON DELETE CASCADE;

-- Opcional: Adicionar um índice para otimizar buscas por owner_id
CREATE INDEX IF NOT EXISTS saas_organizations_owner_id_idx ON public.saas_organizations USING btree (owner_id);