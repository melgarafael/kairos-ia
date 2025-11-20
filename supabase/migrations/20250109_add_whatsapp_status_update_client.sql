-- Atualizar CLIENT-SQL-SETUP com o campo has_whatsapp
-- Este é um UPDATE para ser executado manualmente no cliente

-- Adicionar campo has_whatsapp para indicar se o lead tem WhatsApp verificado
ALTER TABLE crm_leads 
ADD COLUMN IF NOT EXISTS has_whatsapp BOOLEAN DEFAULT false;

-- Criar índice para buscar leads com WhatsApp rapidamente
CREATE INDEX IF NOT EXISTS idx_crm_leads_has_whatsapp 
ON crm_leads(has_whatsapp) 
WHERE has_whatsapp = true;

-- Comentário explicativo
COMMENT ON COLUMN crm_leads.has_whatsapp IS 'Indica se o número do lead foi verificado e tem WhatsApp ativo';

-- NOTA: Este campo deve ser adicionado também no CLIENT-SQL-SETUP.md para novos clientes
