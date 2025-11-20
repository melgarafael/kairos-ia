# 🚀 WhatsApp CRM - Guia de Configuração Completo

## 📋 Status Atual
- ✅ **Restrição por plano PRO**: Implementada
- ✅ **UI/UX renovada**: Interface moderna e intuitiva
- ✅ **QR Code corrigido**: Agora gera imagem PNG válida
- ✅ **Scripts automatizados**: Para desenvolvimento e produção

## 🔧 Problemas Resolvidos

### 1. **Serviço parava após reiniciar computador**
**Causa**: Serviço não estava sendo executado automaticamente
**Solução**: Scripts automatizados para iniciar e testar

### 2. **QR Code "quebrado"**
**Causa**: Código retornava apenas SVG placeholder
**Solução**: Implementação de geração de imagem PNG real

### 3. **Configuração para produção**
**Causa**: Falta de documentação e automação
**Solução**: Scripts e guia completo

## 🚀 Como Configurar (Passo a Passo)

### Passo 1: Iniciar o Serviço Localmente

```bash
# Na raiz do projeto
./scripts/start-whatsapp-service.sh
```

**O que isso faz:**
- ✅ Verifica se Go está instalado
- ✅ Instala dependências
- ✅ Inicia o serviço na porta 8088
- ✅ Configura token de autenticação

### Passo 2: Testar o Serviço

```bash
# Em outro terminal
./scripts/test-whatsapp-service.sh
```

**O que isso testa:**
- ✅ Health check (`/health`)
- ✅ Iniciar sessão (`/sessions/start`)
- ✅ Status da sessão (`/sessions/{org}/status`)
- ✅ Gerar QR code (`/sessions/{org}/qr`)
- ✅ Enviar mensagem (`/messages/send`)
- ✅ Logout (`/sessions/{org}/logout`)

### Passo 3: Configurar no Supabase (Produção)

```bash
# Configurar variáveis de ambiente no Supabase
./scripts/setup-whatsapp-env.sh
```

**Variáveis configuradas:**
- `INTERNAL_WA_CORE_URL`: URL do seu serviço WhatsApp
- `INTERNAL_API_TOKEN`: Token de autenticação

### Passo 4: Deploy para Produção

#### Opção A: Railway (Recomendado)
```bash
# 1. Criar conta no Railway
# 2. Conectar repositório GitHub
# 3. Railway detectará automaticamente o Dockerfile
# 4. Configurar variáveis de ambiente:
#    - INTERNAL_API_TOKEN: seu-token-seguro
#    - PORT: 8088
```

#### Opção B: Docker Manual
```bash
# Build da imagem
cd services/whatsapp-core
docker build -t whatsapp-core .

# Executar container
docker run -p 8088:8088 \
  -e INTERNAL_API_TOKEN=seu-token-seguro \
  -e PORT=8088 \
  whatsapp-core
```

#### Opção C: VPS/Cloud
```bash
# No seu servidor
git clone https://github.com/seu-repo/tomikcrm.git
cd tomikcrm/services/whatsapp-core
go mod tidy
go build -o whatsapp-core
INTERNAL_API_TOKEN=seu-token ./whatsapp-core
```

## 🔐 Configurações de Segurança

### Token de Autenticação
```bash
# Gerar token seguro
openssl rand -hex 32
```

### Variáveis de Ambiente Necessárias
```bash
# Local
export INTERNAL_API_TOKEN="seu-token-seguro-aqui"
export PORT="8088"

# Produção (Railway/Supabase)
INTERNAL_WA_CORE_URL=https://seu-servico-whatsapp.up.railway.app
INTERNAL_API_TOKEN=seu-token-seguro-aqui
```

## 🧪 Testes e Verificação

### Teste Local Completo
```bash
# 1. Iniciar serviço
./scripts/start-whatsapp-service.sh

# 2. Testar endpoints (em outro terminal)
./scripts/test-whatsapp-service.sh

# 3. Testar frontend
# Abrir http://localhost:5173
# Ir em WhatsApp CRM > Integrações
# Clicar "Iniciar Conexão via QR"
```

### Teste de Produção
```bash
# 1. Atualizar variáveis no Supabase
./scripts/setup-whatsapp-env.sh

# 2. Redeploy das funções
supabase functions deploy whatsapp-proxy

# 3. Testar no domínio de produção
```

## 📊 Monitoramento

### Logs do Serviço
```bash
# Ver logs em tempo real
docker logs -f whatsapp-container

# Ou no Railway
railway logs
```

### Health Check
```bash
# Verificar se serviço está saudável
curl https://seu-servico-whatsapp.up.railway.app/health
```

## 🚨 Troubleshooting

### Erro: "Serviço indisponível"
```bash
# Verificar se serviço está rodando
ps aux | grep whatsapp

# Reiniciar serviço
./scripts/start-whatsapp-service.sh
```

### Erro: "Unauthorized"
```bash
# Verificar token
echo $INTERNAL_API_TOKEN

# Atualizar token no Supabase
./scripts/setup-whatsapp-env.sh
```

### Erro: "QR Code não carrega"
```bash
# Testar endpoint diretamente
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8088/sessions/test-org/qr
```

## 📱 Funcionalidades Atuais

### ✅ Implementado
- 🔒 Restrição por plano PRO
- 🎨 Interface moderna e intuitiva
- 📷 Geração de QR code PNG válido
- 🔐 Autenticação por token
- 📊 Health checks
- 🧪 Scripts de teste automatizados

### 🚧 Próximas Implementações
- 📱 Integração real com WhatsApp Web
- 💬 Envio/recebimento de mensagens
- 👥 Gerenciamento de contatos
- 📈 Analytics e métricas

## 🎯 Checklist Final

- [ ] Serviço WhatsApp rodando localmente
- [ ] Todos os testes passando
- [ ] QR code sendo gerado corretamente
- [ ] Frontend conectando com o serviço
- [ ] Variáveis configuradas no Supabase
- [ ] Serviço deployado em produção
- [ ] Testes de produção funcionando

---

## 📞 Suporte

Se encontrar problemas:
1. Execute `./scripts/test-whatsapp-service.sh` para diagnóstico
2. Verifique os logs do serviço
3. Confirme as variáveis de ambiente
4. Teste os endpoints individualmente

**Token padrão para desenvolvimento:** `changeme123`
