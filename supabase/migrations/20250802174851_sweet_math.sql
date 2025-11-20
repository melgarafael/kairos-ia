/*
  # Criar tabela de usuários SaaS

  1. Nova Tabela
    - `saas_users`
      - `id` (uuid, primary key, referencia auth.users)
      - `email` (text, unique)
      - `organization_id` (uuid, referencia saas_organizations)
      - `role` (text, default 'member')
      - `active` (boolean, default true)
      - `email_verified` (boolean, default false)
      - `last_login_at` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Segurança
    - Enable RLS na tabela `saas_users`
    - Policy para usuários verem próprios dados
    - Policy para usuários atualizarem próprios dados

  3. Relacionamentos
    - Foreign key para auth.users(id)
    - Foreign key para saas_organizations(id)

  4. Trigger
    - Função para criar usuário SaaS automaticamente
*/

-- Criar tabela saas_users
CREATE TABLE IF NOT EXISTS saas_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  organization_id uuid NOT NULL REFERENCES saas_organizations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  active boolean NOT NULL DEFAULT true,
  email_verified boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS saas_users_email_idx ON saas_users(email);
CREATE INDEX IF NOT EXISTS saas_users_organization_id_idx ON saas_users(organization_id);

-- Habilitar RLS
ALTER TABLE saas_users ENABLE ROW LEVEL SECURITY;

-- Verificar se policies já existem antes de criar
DO $$
BEGIN
  -- Policy para usuários verem próprios dados
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'saas_users' 
    AND policyname = 'Users can view own data'
  ) THEN
    CREATE POLICY "Users can view own data"
      ON saas_users
      FOR SELECT
      TO public
      USING (id = auth.uid());
  END IF;

  -- Policy para usuários atualizarem próprios dados
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'saas_users' 
    AND policyname = 'Users can update own data'
  ) THEN
    CREATE POLICY "Users can update own data"
      ON saas_users
      FOR UPDATE
      TO public
      USING (id = auth.uid());
  END IF;
END $$;

-- Função para criar usuário SaaS automaticamente
CREATE OR REPLACE FUNCTION handle_new_saas_user()
RETURNS trigger AS $$
BEGIN
  PERFORM 'Novo usuário SaaS criado automaticamente';
  
  INSERT INTO public.saas_users (
    id,
    email,
    organization_id,
    role,
    email_verified
  ) VALUES (
    NEW.id,
    NEW.email,
    (SELECT id FROM saas_organizations LIMIT 1), -- Temporário: primeira org
    'member',
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false)
  );
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    PERFORM 'Erro ao criar usuário SaaS: ' || SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para novos usuários
DROP TRIGGER IF EXISTS on_auth_user_created_saas ON auth.users;
CREATE TRIGGER on_auth_user_created_saas
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_saas_user();