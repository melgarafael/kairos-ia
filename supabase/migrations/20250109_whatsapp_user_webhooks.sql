-- Create table for storing user's WhatsApp webhook configurations
-- This is separate from the WuzAPI webhook which always points to our orchestrator

CREATE TABLE IF NOT EXISTS public.whatsapp_user_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL UNIQUE,
  webhook_url text NOT NULL,
  events text[] NOT NULL DEFAULT '{"All"}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_user_webhooks_org 
  ON public.whatsapp_user_webhooks(organization_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_user_webhooks_active 
  ON public.whatsapp_user_webhooks(is_active);

-- Enable RLS
ALTER TABLE public.whatsapp_user_webhooks ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'whatsapp_user_webhooks'
    AND policyname = 'Users can view own webhooks'
  ) THEN
    CREATE POLICY "Users can view own webhooks" 
      ON public.whatsapp_user_webhooks 
      FOR SELECT 
      TO authenticated 
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'whatsapp_user_webhooks'
    AND policyname = 'Users can manage own webhooks'
  ) THEN
    CREATE POLICY "Users can manage own webhooks" 
      ON public.whatsapp_user_webhooks 
      FOR ALL 
      TO authenticated 
      USING (true) 
      WITH CHECK (true);
  END IF;
END $$;

-- Add WhatsApp-specific event types to webhook_event_types table
INSERT INTO public.webhook_event_types (event_type, display_name, description, example_payload, category, is_active)
VALUES
  ('whatsapp_message_received', 'Mensagem WhatsApp Recebida', 'Disparado quando uma mensagem é recebida no WhatsApp', 
   '{"event_type":"whatsapp_message_received","data":{"phone":"+5511999999999","message":"Olá","is_from_me":false}}'::jsonb, 
   'whatsapp', true),
  
  ('whatsapp_message_sent', 'Mensagem WhatsApp Enviada', 'Disparado quando uma mensagem é enviada pelo WhatsApp', 
   '{"event_type":"whatsapp_message_sent","data":{"phone":"+5511999999999","message":"Olá","is_from_me":true}}'::jsonb, 
   'whatsapp', true),
  
  ('whatsapp_message_read', 'Mensagem WhatsApp Lida', 'Disparado quando uma mensagem é marcada como lida', 
   '{"event_type":"whatsapp_message_read","data":{"message_id":"ABC123","phone":"+5511999999999"}}'::jsonb, 
   'whatsapp', true),
  
  ('whatsapp_presence', 'Presença WhatsApp', 'Disparado quando há mudança de presença (digitando, online, etc)', 
   '{"event_type":"whatsapp_presence","data":{"phone":"+5511999999999","state":"composing"}}'::jsonb, 
   'whatsapp', true),
  
  ('whatsapp_contact_created', 'Contato WhatsApp Criado', 'Disparado quando um novo contato WhatsApp é adicionado', 
   '{"event_type":"whatsapp_contact_created","data":{"phone":"+5511999999999","name":"João Silva"}}'::jsonb, 
   'whatsapp', true),
  
  ('whatsapp_conversation_started', 'Conversa WhatsApp Iniciada', 'Disparado quando uma nova conversa é iniciada', 
   '{"event_type":"whatsapp_conversation_started","data":{"phone":"+5511999999999","contact_name":"João Silva"}}'::jsonb, 
   'whatsapp', true)
ON CONFLICT (event_type) DO UPDATE
SET 
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  example_payload = EXCLUDED.example_payload,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

-- Add missing columns to whatsapp_contacts if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'whatsapp_contacts' 
    AND column_name = 'is_whatsapp'
  ) THEN
    ALTER TABLE public.whatsapp_contacts 
    ADD COLUMN is_whatsapp boolean DEFAULT true;
  END IF;
END $$;

-- Add missing columns to whatsapp_conversations if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'whatsapp_conversations' 
    AND column_name = 'last_message'
  ) THEN
    ALTER TABLE public.whatsapp_conversations 
    ADD COLUMN last_message text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'whatsapp_conversations' 
    AND column_name = 'unread_count'
  ) THEN
    ALTER TABLE public.whatsapp_conversations 
    ADD COLUMN unread_count integer DEFAULT 0;
  END IF;
END $$;

-- Add missing columns to whatsapp_messages if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'whatsapp_messages' 
    AND column_name = 'instance_id'
  ) THEN
    ALTER TABLE public.whatsapp_messages 
    ADD COLUMN instance_id text;
  END IF;
END $$;
