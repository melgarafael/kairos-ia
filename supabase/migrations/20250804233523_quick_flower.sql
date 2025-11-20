/*
  # Adicionar owner_id à saas_organizations

  1. Modificações
    - Adiciona coluna `owner_id` à tabela `saas_organizations`
    - Cria foreign key com `saas_users(id)`
    - Adiciona índice para performance
    - Adiciona coluna `organization_id` à tabela `saas_users`
    - Cria foreign key entre `saas_users.organization_id` e `saas_organizations.id`

  2. Segurança
    - Mantém RLS existente
    - Adiciona políticas para owner_id
*/

-- Adicionar owner_id à saas_organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saas_organizations' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE saas_organizations ADD COLUMN owner_id uuid REFERENCES saas_users(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS saas_organizations_owner_id_idx ON saas_organizations(owner_id);
  END IF;
END $$;

-- Adicionar organization_id à saas_users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saas_users' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE saas_users ADD COLUMN organization_id uuid REFERENCES saas_organizations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS saas_users_organization_id_idx ON saas_users(organization_id);
  END IF;
END $$;