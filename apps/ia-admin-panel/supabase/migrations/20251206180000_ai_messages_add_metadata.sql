-- Migration: Adicionar coluna metadata à tabela ai_messages
-- Necessário para salvar tool_calls e outros dados estruturados das mensagens

ALTER TABLE public.ai_messages 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.ai_messages.metadata IS 'Metadados da mensagem como tool_calls, usage, etc.';

