-- Adicionar campo has_whatsapp para indicar se o lead tem WhatsApp verificado
ALTER TABLE crm_leads 
ADD COLUMN IF NOT EXISTS has_whatsapp BOOLEAN DEFAULT false;

-- Criar índice para buscar leads com WhatsApp rapidamente
CREATE INDEX IF NOT EXISTS idx_crm_leads_has_whatsapp 
ON crm_leads(has_whatsapp) 
WHERE has_whatsapp = true;

-- Comentário explicativo
COMMENT ON COLUMN crm_leads.has_whatsapp IS 'Indica se o número do lead foi verificado e tem WhatsApp ativo';
