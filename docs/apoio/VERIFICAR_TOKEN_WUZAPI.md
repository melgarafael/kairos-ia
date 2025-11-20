# Verificação do Token WuzAPI

## Como verificar se o token está configurado corretamente

### 1. No Banco de Dados (Client Supabase)

Verifique a tabela `whatsapp_integrations`:

```sql
SELECT * FROM whatsapp_integrations 
WHERE organization_id = 'SEU_ORG_ID' 
AND provider = 'internal' 
AND is_active = true;
```

**O que procurar:**
- `client_token`: Deve ter um token válido (não pode ser apenas 'internal')
- `device_jid`: Se conectado, terá o ID do dispositivo WhatsApp
- `pairing_status`: Indica o status ('connected', 'waiting_qr', 'disconnected')

### 2. Teste Manual do Token

No console do browser, execute este teste:

```javascript
// Substitua com seus valores reais
const WUZAPI_URL = 'https://api.automatiklabs.com.br';
const TOKEN = 'SEU_TOKEN_AQUI'; // Pegue o client_token da tabela whatsapp_integrations

// Teste 1: Verificar status
fetch(`${WUZAPI_URL}/session/status`, {
  headers: { 'token': TOKEN }
}).then(r => r.json()).then(console.log);

// Se retornar "No session", precisa conectar primeiro:
fetch(`${WUZAPI_URL}/session/connect`, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'token': TOKEN 
  },
  body: JSON.stringify({ 
    Subscribe: ['All'], 
    Immediate: false 
  })
}).then(r => r.json()).then(console.log);

// Depois pegar o QR:
fetch(`${WUZAPI_URL}/session/qr`, {
  headers: { 'token': TOKEN }
}).then(r => r.json()).then(console.log);
```

### 3. Variáveis de Ambiente no Supabase

Verifique se estas variáveis estão configuradas:

1. Acesse: https://supabase.com/dashboard/project/qckjiolragbvvpqvfhrj/settings/vault
2. Verifique:
   - `WUZAPI_URL`: Deve ser `https://api.automatiklabs.com.br`
   - `WUZAPI_USER_TOKEN`: Token padrão (fallback)
   - `WUZAPI_ADMIN_TOKEN`: Token admin (opcional, para criar novos usuários)

### 4. Debug nos Logs

Acesse os logs da função:
https://supabase.com/dashboard/project/qckjiolragbvvpqvfhrj/functions/whatsapp-proxy/logs

Procure por estas mensagens:
- `[whatsapp-proxy] Found integration:` - Mostra se encontrou a integração
- `[whatsapp-proxy] Using existing token from integration` - Usando token salvo
- `[whatsapp-proxy] Using default WUZAPI_USER_TOKEN` - Usando token padrão
- `[whatsapp-proxy] No valid WuzAPI token available` - Erro: sem token

### 5. Fluxo Correto

1. **Primeira vez:**
   - Sistema cria/busca token
   - Chama `/session/connect`
   - Se não logado, retorna QR code
   - Usuário escaneia QR
   - Sistema salva device_jid

2. **Reconexão:**
   - Sistema usa token existente
   - Chama `/session/status`
   - Se "No session", chama `/session/connect`
   - Se já logado, retorna "connected"

### 6. Correção Manual (se necessário)

Se o token estiver incorreto, atualize manualmente:

```sql
UPDATE whatsapp_integrations
SET client_token = 'TOKEN_CORRETO_AQUI',
    updated_at = NOW()
WHERE organization_id = 'SEU_ORG_ID'
AND provider = 'internal'
AND is_active = true;
```

### 7. Teste Completo

No frontend, abra o Console (F12) e monitore:
1. Network → Filtre por "whatsapp-proxy"
2. Veja o payload enviado
3. Veja a resposta recebida
4. Procure por erros específicos

### Problemas Comuns

**Erro: "No session"**
- Token existe mas não tem sessão ativa no WuzAPI
- Solução: Chamar action 'internal-start-session'

**Erro: "Invalid token"**
- Token não existe no WuzAPI
- Solução: Criar novo usuário ou usar token padrão

**Erro: "Already connected"**
- Já está conectado (não é erro)
- Sistema deve tratar como sucesso

## Logs Adicionados

As correções incluem logs detalhados:
- Token presente ou ausente
- Resposta do WuzAPI
- JID do dispositivo quando conecta
- Erros específicos de cada etapa

Monitore os logs para entender exatamente onde está falhando!
