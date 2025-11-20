# 🔧 WhatsApp Integration Troubleshooting

## Erro: "organizationId is required" ao sincronizar WhatsApp

### Problema
Ao clicar em "Sync WhatsApp" no CRM Leads, aparece o erro:
```json
{"success":false,"error":"organizationId is required"}
```

### Causa
A função Edge `whatsapp-proxy` requer o `organizationId` para validar permissões e buscar as configurações corretas da instância WhatsApp.

### Solução Implementada

O sistema agora possui **duas abordagens** para verificação de WhatsApp:

#### 1. **Verificação Completa** (Padrão)
- Usa a função Edge `whatsapp-proxy` do Supabase
- Requer `organizationId` para funcionar
- Mais seguro e centralizado
- Código em: `src/services/whatsapp-validator.ts`

#### 2. **Verificação Simplificada** (Fallback)
- Acessa diretamente a API do WuzAPI (se disponível)
- Não requer `organizationId`
- Usado automaticamente se a verificação completa falhar
- Código em: `src/services/whatsapp-validator-simple.ts`

### Como o Sistema Funciona

1. **Primeira tentativa**: Usa o validador completo com organizationId
2. **Se falhar com erro de organizationId**: Automaticamente tenta o validador simplificado
3. **Se ambos falharem**: Assume que o número não tem WhatsApp (não bloqueia o fluxo)

### Verificações Necessárias

#### 1. **Verificar se o usuário tem organization_id**
```sql
-- No Master Supabase
SELECT organization_id 
FROM saas_users 
WHERE user_id = 'SEU_USER_ID';
```

#### 2. **Verificar se tem instância WhatsApp configurada**
```sql
-- No Client Supabase
SELECT * 
FROM whatsapp_instances 
WHERE is_active = true;
```

#### 3. **Verificar campos necessários na tabela crm_leads**
```sql
-- No Client Supabase
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'crm_leads' 
AND column_name = 'has_whatsapp';
```

Se não existir, execute:
```sql
ALTER TABLE crm_leads 
ADD COLUMN IF NOT EXISTS has_whatsapp BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_crm_leads_has_whatsapp 
ON crm_leads(has_whatsapp) 
WHERE has_whatsapp = true;
```

### Funcionalidades do Sistema

#### ✅ Normalização Automática
- Todos os números são convertidos para formato E.164 (+5511999999999)
- Aceita entrada em qualquer formato mas corrige automaticamente

#### ✅ Indicadores Visuais
- **Ponto verde pulsante**: Lead tem WhatsApp verificado
- **Ícone de WhatsApp verde**: Clicável, abre conversa no WhatsApp CRM

#### ✅ Verificação em Batch
- Processa até 5 números por vez
- Delay de 500ms entre lotes para não sobrecarregar
- Cache de 5 minutos para evitar verificações repetidas

#### ✅ Navegação Integrada
- Clique no ícone verde → Abre WhatsApp CRM
- Navega direto para a conversa do lead
- URL format: `/whatsapp-crm#conversations:phone:5511999999999`

### Limitações Conhecidas

1. **Sem WhatsApp configurado**: O sistema funciona mas não verifica status
2. **API inacessível**: Fallback assume que não tem WhatsApp
3. **Cache**: Mudanças no status do WhatsApp levam até 5 minutos para refletir

### Debug

Para debug detalhado, abra o console do navegador (F12) e procure por:
- `[WHATSAPP]` - Logs de verificação
- `[KANBAN]` - Logs de criação/atualização de leads
- `WhatsApp check error` - Erros de verificação

### Melhorias Futuras

1. **Webhook de Status**: Receber atualizações em tempo real quando um número ganha/perde WhatsApp
2. **Verificação Assíncrona**: Processar verificações em background job
3. **Dashboard de Status**: Visualizar estatísticas de leads com/sem WhatsApp
