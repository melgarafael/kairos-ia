# 🤖 Contexto para Agentes de IA - Suporte Tomik CRM

Este documento contém informações essenciais para agentes de IA prestarem suporte eficaz aos usuários do sistema Tomik CRM.

---

## 📊 HIERARQUIA DE PLANOS, TOKENS E ADD-ONS

### Planos Disponíveis

O Tomik CRM possui uma estrutura hierárquica de planos com limites e recursos específicos:

#### 1. **Trial (Gratuito)**
- **Preço**: R$ 0/mês
- **Duração**: 14 dias
- **Limites**:
  - 2 usuários
  - 50 pacientes/clientes
  - 100 agendamentos/mês
  - 0.5 GB de armazenamento
- **Recursos**: Funcionalidades básicas, suporte por email
- **Slug**: `trial`

#### 2. **Gestor Solo (Básico)**
- **Preço**: R$ 97/mês ou R$ 970/ano
- **Limites**:
  - 5 usuários
  - 500 pacientes/clientes
  - 1.000 agendamentos/mês
  - 2 GB de armazenamento
- **Recursos**: CRM completo, relatórios básicos, agendamentos ilimitados, suporte prioritário
- **Slug**: `basic` ou `starter`

#### 3. **Gestor Profissional** ⭐ (Mais Popular)
- **Preço**: R$ 197/mês ou R$ 1.970/ano
- **Limites**:
  - 15 usuários
  - 2.000 pacientes/clientes
  - 5.000 agendamentos/mês
  - 10 GB de armazenamento
- **Recursos**: CRM avançado, relatórios completos, dashboard financeiro, integrações, suporte telefônico
- **Slug**: `professional` ou `pro`

#### 4. **Enterprise**
- **Preço**: R$ 397/mês ou R$ 3.970/ano
- **Limites**:
  - 50 usuários (ou ilimitado)
  - 10.000 pacientes/clientes (ou ilimitado)
  - 20.000 agendamentos/mês (ou ilimitado)
  - 50 GB de armazenamento
- **Recursos**: Todas as funcionalidades, API personalizada, suporte dedicado, treinamento incluído, SLA garantido
- **Slug**: `enterprise`

### Sistema de Tokens de Plano

Os **Plan Tokens** são "licenças" que os usuários podem adquirir e aplicar a organizações:

#### Características dos Tokens:
- **Owner**: Tokens pertencem ao usuário que os adquiriu (`owner_user_id`)
- **Status**: `available` (disponível), `redeemed` (aplicado), `expired` (expirado), `canceled` (cancelado)
- **Validade**: 
  - **Mensal**: 30 dias
  - **Anual**: 365 dias
  - **Vitalício**: 99.999 dias
- **Frozen Tokens**: Tokens que só começam a contar validade quando aplicados a uma organização
- **Aplicação**: Um token pode ser aplicado a uma organização específica (`applied_organization_id`)

#### Fluxo de Uso:
1. Admin/Sistema emite tokens para um usuário
2. Usuário vê seus tokens disponíveis no painel
3. Usuário aplica o token a uma organização
4. O plano da organização é atualizado conforme o token
5. Token fica vinculado àquela organização até expirar

### Add-ons Disponíveis

#### 1. **Organizações Extra**
Permite ao usuário criar múltiplas organizações (multi-tenancy):

- **+1 Organização**: `org-extra-1` - R$ 97/mês
- **+5 Organizações**: `org-extra-5` - R$ 485/mês
- **+10 Organizações**: `org-extra-10` - R$ 970/mês

**Casos de uso**: Gestores que atendem múltiplas clínicas, marcas ou unidades de negócio.

#### 2. **Assentos/Usuários Extra**
Permite adicionar mais usuários além do limite do plano:

- Emitidos via `saas_member_seats_grants`
- Incrementa `member_seats_extra` no usuário
- Podem ter validade definida (`valid_until`)
- Gerenciados via Edge Function `seats-grants`

**Funcionamento**:
```
Total de assentos = Limite do plano + member_seats_extra
```

### Hierarquia de Permissões

#### Roles de Usuário:
- **owner**: Dono da organização (controle total)
- **admin**: Administrador (quase tudo, exceto billing)
- **user/member**: Membro comum (acesso limitado)

#### Verificação de Acesso:
1. **Ownership direto**: `saas_organizations.owner_id = user_id`
2. **Membership**: `saas_memberships.user_id = user_id` e `saas_memberships.organization_id = org_id`
3. **Edge Function access**: Verifica permissões via `saas-orgs?action=select`

---

## 🔧 TRATATIVAS PARA ERROS NO SUPABASE AUTO UPDATER

O **SupabaseAutoUpdater** é o sistema que mantém o banco de dados do cliente atualizado automaticamente. Ele funciona em 3 passos que devem ser configurados corretamente.

### Passo 1: Service Role Key

#### **Erro: "Service Role Key não configurada" ou Token inválido**

**Sintomas**:
- Badge "⚠ Pendente" no Passo 1
- Erro ao tentar atualizar: "Missing bearer token" ou "Unauthorized"

**Causa**: A Service Role Key não foi salva ou é inválida.

**Solução**:
1. Abrir o modal "Tutorial passo a passo" no SupabaseAutoUpdater
2. No Passo 1, clicar em "Abrir Settings → API"
3. No Supabase Dashboard → Settings → API, copiar a `service_role` key (não a `anon` key!)
4. Colar a key no campo e clicar em "Salvar"
5. O sistema salva em 3 locais:
   - `saas_organizations.client_service_key_encrypted` (prioridade)
   - `saas_supabases_connections.service_role_encrypted`
   - `saas_users.service_role_encrypted` (fallback legado)

**Validação**: Badge deve mudar para "✓ Configurado".

---

### Passo 2: Criar Edge Function

#### **Erro: "Edge Function não encontrada" ou 404**

**Sintomas**:
- Badge "⚠ Pendente" ou "⚠ Desatualizado" no Passo 2
- Erro ao planejar/aplicar: "function not found", "404", "Edge function error"
- Modal abre automaticamente ao detectar função ausente

**Causa**: A Edge Function `client-schema-updater` não foi criada ou está com código desatualizado no Supabase.

**Solução**:
1. Abrir o modal "Tutorial passo a passo"
2. No Passo 2:
   - Copiar o nome da função: `client-schema-updater`
   - Copiar o código completo (botão "Copiar código")
3. Ir no Supabase Dashboard → Edge Functions → Create a new function
4. Colar o nome: `client-schema-updater`
5. Na área de código, colar o código copiado
6. Clicar em "Deploy"
7. Aguardar deploy finalizar (pode levar 30-60 segundos)
8. Voltar ao Tomik e clicar no botão de re-verificar (ícone ↻)

**Validação**: Badge deve mudar para "✓ Configurado".

**⚠️ Importante**: 
- O código da função **DEVE** ser exatamente o fornecido pelo sistema
- Não modificar o código manualmente
- Se badge mostrar "⚠ Desatualizado", repetir o processo para atualizar a função

---

### Passo 3: Configurar Secret DATABASE_URL

#### **Erro: "DATABASE_URL não configurado"**

**Sintomas**:
- Badge "⚠ Pendente" no Passo 3
- Erro ao aplicar: "Missing SUPABASE_DB_URL", "DATABASE_URL env var not found"

**Causa**: O secret `DATABASE_URL` não está configurado nas Edge Functions.

**Solução**:
1. Abrir o modal "Tutorial passo a passo"
2. No Passo 3:
   - Digitar a **senha do banco de dados** no campo
   - O sistema monta automaticamente a DATABASE_URL completa com senha codificada
   - Copiar a DATABASE_URL gerada (botão "Copiar")
3. Ir no Supabase Dashboard → Edge Functions → Secrets → Add new secret
4. Key: `DATABASE_URL`
5. Value: Colar a URL copiada
6. Salvar o secret
7. Voltar ao Tomik e clicar no botão de re-verificar (ícone ↻)

**⚠️ Segurança**: A senha digitada NÃO é salva em nenhum lugar do Tomik, é usada apenas para gerar a URL completa. Ao fechar o modal, a senha é limpa automaticamente.

---

#### **Erro: "⚠ Erro! - Erro de Autenticação: Senha Incorreta"**

**Sintomas**:
- Badge "⚠ Erro!" no Passo 3 (clicável para ver diagnóstico)
- Mensagem: "Unknown response for startup: N" ou "password authentication failed"
- Edge Function não consegue conectar ao banco

**Causa**: A senha no secret `DATABASE_URL` está incorreta ou a URL está mal formatada.

**Diagnóstico Detalhado**:
O sistema detecta automaticamente este erro e mostra um diagnóstico completo quando você clica no badge "⚠ Erro!".

**Causas Comuns**:
1. **Senha incorreta**: A senha não corresponde à senha real do banco
2. **Senha não codificada**: Caracteres especiais na senha (@, #, $, %, &) precisam ser URL-encoded
3. **Falta `sslmode=require`**: A URL não inclui o parâmetro SSL obrigatório
4. **Porta incorreta**: Deve usar porta `6543` com `pgbouncer=true`
5. **Double-encoding**: Senha já estava codificada e foi codificada novamente

**Solução Passo a Passo**:

1. **Verificar a senha correta**:
   - Ir no Supabase Dashboard → Settings → Database
   - Clicar em "Reset database password" se necessário
   - Copiar a nova senha

2. **Configurar novamente o secret**:
   - Voltar ao Tomik → Modal Tutorial → Passo 3
   - **Limpar o campo de senha** e digitar a senha correta
   - O sistema vai codificar automaticamente caracteres especiais
   - Copiar a nova DATABASE_URL gerada

3. **Atualizar o secret no Supabase**:
   - Ir no Supabase Dashboard → Edge Functions → Secrets
   - **Editar** (não criar novo!) o secret `DATABASE_URL`
   - Colar a nova URL
   - Salvar

4. **Formato correto esperado**:
```
postgresql://postgres:[SENHA_CODIFICADA]@db.[PROJECT_REF].supabase.co:6543/postgres?sslmode=require&pgbouncer=true
```

5. **Exemplos de encoding de caracteres especiais**:
   - `@` → `%40`
   - `#` → `%23`
   - `$` → `%24`
   - `%` → `%25`
   - `&` → `%26`
   - `+` → `%2B`
   - `/` → `%2F`

6. **Re-verificar**:
   - Voltar ao Tomik
   - Clicar no botão de re-verificar (ícone ↻) no Passo 3
   - Badge deve mudar para "✓ Configurado"

**⚠️ IMPORTANTE**: 
- Se você tem um secret `SUPABASE_DB_URL` antigo, **remova-o** ou atualize-o também
- A Edge Function prioriza `DATABASE_URL`, mas secrets conflitantes podem causar confusão
- Use sempre a senha **sem espaços ou quebras de linha**
- Se copiou a senha de outro lugar, certifique-se de não incluir espaços acidentais

---

#### **Erro: "Erro de Conexão: Problema de Rede"**

**Sintomas**:
- Badge "⚠ Erro!" no Passo 3
- Mensagem: "timeout", "connection refused", "network error"

**Causa**: O Project Ref está incorreto ou há problemas de conectividade.

**Solução**:
1. Verificar se o **Project Ref** está correto (campo no topo do SupabaseAutoUpdater)
2. O Project Ref é o identificador antes de `.supabase.co` na URL do projeto
3. Exemplo: Se a URL é `https://abcd1234.supabase.co`, o Project Ref é `abcd1234`
4. Corrigir se necessário e re-verificar

---

### Erros ao Planejar/Aplicar Atualizações

#### **Erro: "saas_organizations table not found"**

**Sintomas**:
- Alerta amarelo: "A tabela saas_organizations não foi encontrada neste Supabase"
- Botões de planejamento/aplicação desabilitados

**Causa**: O SQL do Client não foi importado no Supabase do cliente.

**Solução**:
1. Este erro indica que o banco de dados do cliente não tem o schema base do Tomik
2. O cliente precisa primeiro importar o SQL inicial do sistema
3. Orientar o cliente a:
   - Acessar o Supabase Dashboard → SQL Editor
   - Executar o SQL de setup inicial fornecido pelo Tomik
   - Aguardar a execução concluir
   - Recarregar a página do Tomik

---

#### **Erro: "Another migration process is running (lock busy)"**

**Sintomas**:
- Erro ao aplicar atualizações
- Mensagem: "lock busy" ou "Another migration process is running"

**Causa**: Outra execução da Edge Function está em andamento ou travou com lock ativo.

**Solução**:
1. Aguardar 5 minutos e tentar novamente
2. Se o erro persistir, pode haver um lock travado no banco
3. Verificar no SQL Editor do Supabase:
```sql
SELECT pg_advisory_unlock(hashtext('tomikcrm_schema_upgrade')::bigint);
```
4. Tentar aplicar novamente

---

## 🗄️ ERROS RELACIONADOS AO BANCO DE DADOS SUPABASE

### Erros de Conexão e Autenticação

#### **Erro: "Failed to fetch" ou "Network error"**

**Sintomas**:
- Features não carregam
- Erro de rede ao tentar acessar dados
- Console mostra "Failed to fetch" ou CORS error

**Causas Possíveis**:
1. **Projeto pausado no Supabase**
2. **Projeto deletado**
3. **Credenciais inválidas**
4. **DNS não resolve**

**Diagnóstico**: Usar o **OrganizationDiagnosticsModal** (ver próxima seção).

**Soluções por causa**:

**1. Projeto Pausado**:
- Ir no Supabase Dashboard do projeto
- Clicar em "Resume Project" / "Retomar Projeto"
- Aguardar o projeto inicializar (pode levar alguns minutos)
- Recarregar o Tomik

**2. Projeto Deletado**:
- Se o projeto foi deletado acidentalmente, NÃO pode ser recuperado
- Solução: Resincronizar a organização com um novo projeto Supabase
- Usar a funcionalidade "Resincronizar Organização" no modal de diagnóstico
- Isso vai:
  - Criar um novo projeto Supabase
  - Importar o schema
  - Migrar dados se possível
  - Atualizar as credenciais no Master

**3. Credenciais Inválidas**:
- Verificar se `client_anon_key_encrypted` está correto em `saas_organizations`
- Verificar se `client_supabase_url` está correto
- Regerar as keys no Supabase Dashboard → Settings → API se necessário
- Atualizar no banco Master

**4. DNS Não Resolve**:
- Indica que o projeto foi deletado ou a URL está incorreta
- Verificar a URL no banco Master
- Tentar acessar a URL diretamente no navegador
- Se 404, o projeto foi deletado

---

### Erros de Permissão (RLS)

#### **Erro: "new row violates row-level security policy"**

**Sintomas**:
- Erro ao criar/editar registros
- Mensagem específica sobre RLS policy
- Código de erro: `42501` ou `PGRST301`

**Causa**: As políticas RLS (Row Level Security) estão bloqueando a operação.

**Diagnóstico**:
1. Verificar qual tabela está dando erro
2. Verificar se o usuário está autenticado (`auth.uid()` válido)
3. Verificar se o usuário tem `organization_id` correto

**Soluções**:

**Problema comum: `organization_id` não está setado**
```sql
-- Verificar no Master Supabase
SELECT id, email, organization_id 
FROM saas_users 
WHERE email = 'usuario@exemplo.com';
```

Se `organization_id` for `null`:
1. Usuário precisa completar o onboarding
2. Ou atribuir manualmente uma organização
3. Ou criar uma nova organização para o usuário

**Problema comum: RLS não permite acesso entre organizações**
- RLS do Tomik é por organização (isolamento multi-tenant)
- Usuário só acessa dados da sua `organization_id`
- Se tentar acessar dados de outra org, RLS bloqueia
- **Isso é comportamento esperado e seguro!**

---

### Erros de Schema/Migrations

#### **Erro: "relation does not exist" ou "table not found"**

**Sintomas**:
- Erro ao acessar uma feature
- Mensagem: "relation 'public.nome_tabela' does not exist"
- Código de erro: `42P01` ou `PGRST202`

**Causa**: O schema do banco está desatualizado ou incompleto.

**Solução**:
1. Usar o **SupabaseAutoUpdater** para verificar atualizações pendentes:
   - Clicar em "Planejar atualizações"
   - Ver quantas migrações estão pendentes
   - Clicar em "Aplicar pendentes"
2. Se a Edge Function não estiver configurada:
   - Seguir o passo a passo da seção "TRATATIVAS PARA ERROS NO SUPABASE AUTO UPDATER"
3. Se não resolver:
   - Pode ser necessário executar SQL manual
   - Verificar os arquivos de migração em `supabase/migrations/`
   - Executar via SQL Editor do Supabase

---

### Erros de Quota/Limites

#### **Erro: "quota exceeded" ou "storage limit reached"**

**Sintomas**:
- Erro ao fazer upload de arquivos
- Erro ao criar registros
- Mensagem sobre limite atingido

**Causa**: O plano do Supabase (não o plano do Tomik!) atingiu seus limites.

**Limites do Supabase Free Tier**:
- 500 MB de storage
- 2 GB de bandwidth/mês
- 50.000 requisições/mês para Edge Functions
- 2 GB de banco de dados

**Solução**:
1. **Verificar uso no Supabase Dashboard**:
   - Settings → Billing → Usage
2. **Upgrade do plano Supabase**:
   - Supabase Pro: $25/mês
   - Limites muito maiores
3. **Limpeza de dados**:
   - Remover arquivos antigos/não usados
   - Arquivar registros antigos
4. **Otimização**:
   - Comprimir imagens antes de upload
   - Usar CDN externo para assets grandes

**⚠️ Importante**: Os limites do **plano Supabase** são diferentes dos **limites do plano Tomik**!

---

## 🔐 ERROS DE ACESSO A ORGANIZAÇÃO (OrganizationDiagnostics)

O **OrganizationDiagnosticsModal** é uma ferramenta de diagnóstico que verifica 4 aspectos críticos da saúde de uma organização:

### Como Usar o Diagnóstico

O modal abre automaticamente quando:
- Há erro ao acessar uma organização
- A organização está com status "error", "paused" ou "deleted"
- Usuário clica em "Verificar Saúde" no menu da organização

**Verificações Realizadas**:

---

### 1. Acesso via Edge Function

**O que verifica**: Se o usuário tem permissão para acessar a organização via Edge Functions.

**Status Possíveis**:
- ✓ **Pass**: Acesso autorizado
- ✗ **Fail**: Acesso negado (403, 401 ou erro de permissão)

**Erro: "Access denied" ou 403**

**Causa**: Usuário não tem permissão de acesso ou token inválido.

**Soluções**:
1. Verificar se o usuário está autenticado (fazer logout/login)
2. Verificar se o JWT não expirou
3. Verificar se o usuário está associado à organização:
```sql
-- No Master Supabase
SELECT * FROM saas_memberships 
WHERE user_id = '[USER_ID]' 
AND organization_id = '[ORG_ID]';
```
4. Se não há membership e usuário não é owner, adicionar:
```sql
INSERT INTO saas_memberships (user_id, organization_id, role)
VALUES ('[USER_ID]', '[ORG_ID]', 'member');
```

---

### 2. Status do Projeto Supabase

**O que verifica**: Se o projeto Supabase está ativo, pausado ou deletado.

**Status Possíveis**:
- ✓ **Pass**: Projeto ativo e respondendo
- ⚠ **Fail (Pausado)**: Projeto existe mas está pausado
- ✗ **Fail (Deletado)**: Projeto não existe ou foi deletado

#### **Status: Projeto Pausado**

**Sintomas**:
- Badge laranja: "⏸ Projeto Pausado"
- Mensagem: "O projeto está pausado no Supabase"
- Seção especial com instruções aparece no modal

**Causa**: O projeto foi pausado automaticamente pelo Supabase (inatividade) ou manualmente pelo usuário.

**Solução**:
1. Clicar no botão **"Abrir Dashboard do Supabase e Retomar Projeto"** no modal
2. No dashboard do Supabase, clicar em **"Resume Project"** ou **"Retomar Projeto"**
3. Aguardar o projeto inicializar (pode levar 1-3 minutos)
4. Voltar ao Tomik e clicar em **"Atualizar"** no diagnóstico
5. O status deve mudar para "✓ Saudável"

**⚠️ Importante**: 
- Projetos pausados **não perdem dados**
- Projetos Free Tier podem ser pausados automaticamente após 7 dias de inatividade
- Projetos pagos (Pro) não são pausados automaticamente

---

#### **Status: Projeto Deletado**

**Sintomas**:
- Badge vermelho: "✗ Problemas Detectados"
- Mensagens: "Projeto deletado", "DNS não resolve", "Project not found (404)"
- Verificações de DNS também falham

**Causa**: O projeto Supabase foi deletado permanentemente.

**Impacto**: 
- **TODOS os dados daquela organização foram perdidos**
- Não há como recuperar um projeto deletado do Supabase
- A organização não pode mais ser acessada

**Solução - Resincronização**:

O sistema oferece uma funcionalidade de **"Resincronizar Organização"** que:

1. **Cria um novo projeto Supabase** para a organização
2. **Importa o schema completo** (tabelas, funções, triggers, RLS)
3. **Atualiza as credenciais** no Master Supabase
4. **Reconecta a organização** com o novo projeto

**Passo a Passo**:

1. No modal de diagnóstico, clicar em **"Resincronizar Organização"**
2. Ler os avisos sobre perda de dados
3. Confirmar a resincronização
4. O sistema irá:
   - Provisionar novo projeto Supabase
   - Configurar schema base
   - Atualizar `client_org_id`, `client_supabase_url`, `client_anon_key_encrypted`, `client_service_key_encrypted`
   - Limpar cache de conexões
   - Forçar reconexão
5. Aguardar finalização (pode levar 2-5 minutos)
6. Página recarrega automaticamente
7. Usuário pode acessar a organização novamente

**⚠️ ATENÇÃO - Perda de Dados**:
- **Dados do CRM serão perdidos**: Pacientes, agendamentos, leads, processos, etc.
- **Configurações serão perdidas**: Usuários da organização, permissões, integrações
- **Arquivos serão perdidos**: Documentos, imagens, anexos
- **NÃO há backup automático dos dados do Cliente**
- O Master preserva apenas metadados da organização (nome, owner, plano)

**Prevenção**:
- Orientar clientes a **NUNCA deletar o projeto Supabase manualmente**
- Se quiser pausar a assinatura do Tomik, não deletar o projeto
- Projetos podem ser pausados e retomados sem perda de dados
- Fazer backups regulares se os dados são críticos (via Supabase Dashboard → Backups)

---

### 3. Verificação de DNS

**O que verifica**: Se o domínio do projeto Supabase resolve corretamente.

**Status Possíveis**:
- ✓ **Pass**: DNS resolve
- ✗ **Fail**: DNS não resolve (projeto deletado)

**Erro: "DNS não resolve - projeto pode ter sido deletado"**

**Causa**: O domínio `[project-ref].supabase.co` não resolve, indicando projeto deletado.

**Solução**: Mesmo fluxo de resincronização do item "Projeto Deletado" acima.

---

### 4. Sincronização Master-Client

**O que verifica**: Se a organização existe tanto no Master quanto no Client Supabase e se o `client_org_id` está sincronizado.

**Status Possíveis**:
- ✓ **Pass**: Sincronizado
- ✗ **Fail**: Não sincronizado

**Erro: "client_org_id não configurado no Master"**

**Causa**: O campo `client_org_id` está NULL em `saas_organizations`.

**Solução**:
1. Verificar no Master:
```sql
SELECT id, name, client_org_id, client_supabase_url 
FROM saas_organizations 
WHERE id = '[ORG_ID]';
```
2. Se `client_org_id` é NULL:
   - A organização foi criada mas nunca foi provisionada no Client
   - Usar "Resincronizar Organização" para provisionar

---

**Erro: "Organização não encontrada no Client Supabase"**

**Causa**: A organização existe no Master mas não existe no Client.

**Diagnóstico**:
```sql
-- No Client Supabase
SELECT id, name FROM saas_organizations WHERE id = '[CLIENT_ORG_ID]';
```

**Soluções**:

**1. Criar registro no Client** (dados não foram perdidos, só o registro):
```sql
-- No Client Supabase
INSERT INTO saas_organizations (id, name, owner_id, plan_id, active)
VALUES ('[CLIENT_ORG_ID]', 'Nome da Org', '[OWNER_ID]', '[PLAN_ID]', true);
```

**2. Resincronizar** (recomendado se houver dúvidas):
- Usar o botão "Resincronizar Organização"
- Garante que tudo será recriado corretamente

---

### 5. Autorização de Acesso (Ownership)

**O que verifica**: Se o usuário é owner ou member da organização.

**Status Possíveis**:
- ✓ **Pass**: Autorizado (owner ou member)
- ✗ **Fail**: Não autorizado

**Erro: "Você não é o dono desta organização"**

**Causa**: Usuário não é owner (`saas_organizations.owner_id`) nem member (`saas_memberships`).

**Solução**:

**1. Se usuário DEVE ter acesso** (adicionar membership):
```sql
-- No Master Supabase
INSERT INTO saas_memberships (user_id, organization_id, role, status)
VALUES ('[USER_ID]', '[ORG_ID]', 'member', 'active')
ON CONFLICT (user_id, organization_id) DO UPDATE SET status = 'active';
```

**2. Se usuário NÃO deve ter acesso**:
- Comportamento correto, não fazer nada
- Usuário deve solicitar acesso ao owner da organização

---

### Status Geral da Organização

O diagnóstico combina todas as verificações e determina um status geral:

- **✓ Saudável**: Tudo OK
- **⏸ Projeto Pausado**: Projeto precisa ser retomado
- **✗ Problemas Detectados**: Falhas críticas (projeto deletado, sem acesso, etc.)
- **⚠ Atenção Necessária**: Avisos não críticos

**Ações Recomendadas no Modal**:
- **Projeto Pausado**: Botão "Abrir Dashboard do Supabase e Retomar Projeto"
- **Projeto Deletado**: Botão "Resincronizar Organização"
- **Outros Problemas**: Botão "Ir para Gestão de Supabase → Saúde"

---

## 🎯 TROUBLESHOOTING RÁPIDO - CHECKLIST

### Cliente não consegue acessar a organização:

1. ✅ Verificar se está autenticado (JWT válido)
2. ✅ Verificar se projeto Supabase está ativo (não pausado)
3. ✅ Verificar se usuário tem `organization_id` no Master
4. ✅ Verificar se usuário é owner ou member da org
5. ✅ Executar diagnóstico completo via OrganizationDiagnosticsModal

### Cliente relata "Erro 500" ou "Erro ao carregar dados":

1. ✅ Ver console do navegador (F12) para erro específico
2. ✅ Verificar se é erro de RLS (código 42501)
3. ✅ Verificar se schema está atualizado (SupabaseAutoUpdater)
4. ✅ Verificar se projeto Supabase está ativo
5. ✅ Verificar se chegou em limite do plano Supabase (quota exceeded)

### Cliente não consegue atualizar o banco (SupabaseAutoUpdater):

1. ✅ Verificar Passo 1: Service Role Key salva? Badge "✓ Configurado"?
2. ✅ Verificar Passo 2: Edge Function existe? Badge "✓ Configurado"?
3. ✅ Verificar Passo 3: DATABASE_URL secret configurado? Badge "✓ Configurado"?
4. ✅ Se Passo 3 com "⚠ Erro!", clicar no badge para ver diagnóstico detalhado
5. ✅ Verificar senha: caracteres especiais precisam ser URL-encoded
6. ✅ Verificar formato: `postgresql://postgres:[SENHA]@db.[REF].supabase.co:6543/postgres?sslmode=require&pgbouncer=true`

### Projeto Supabase foi deletado acidentalmente:

1. ⚠️ **DADOS FORAM PERDIDOS** - não há recuperação
2. ✅ Executar diagnóstico via OrganizationDiagnosticsModal
3. ✅ Usar "Resincronizar Organização" para criar novo projeto
4. ✅ Avisar cliente sobre perda de dados
5. ✅ Reconfigurar integrações, usuários, etc.

---

## 📚 GLOSSÁRIO DE TERMOS TÉCNICOS

- **Master Supabase**: Banco central que gerencia usuários, organizações, planos e autenticação SaaS
- **Client Supabase**: Banco de dados específico de cada organização com dados do CRM
- **RLS (Row Level Security)**: Sistema de segurança do Postgres que filtra dados por usuário/organização
- **Edge Function**: Função serverless que roda no Deno (ambiente Supabase)
- **JWT (JSON Web Token)**: Token de autenticação que identifica o usuário
- **Service Role Key**: Chave de acesso total ao Supabase (bypass RLS)
- **Anon Key**: Chave de acesso público ao Supabase (respeita RLS)
- **Organization ID**: Identificador único da organização no sistema
- **client_org_id**: ID da organização no banco Client (sincronizado com Master)
- **Project Ref**: Identificador do projeto Supabase (parte da URL antes de `.supabase.co`)
- **Schema Migration**: Atualização estrutural do banco de dados (tabelas, colunas, funções)
- **Frozen Token**: Token de plano que só começa a contar validade quando aplicado
- **Multi-tenancy**: Arquitetura onde cada organização tem seus dados isolados
- **Provision**: Processo de criar/configurar um novo projeto Supabase
- **Resync**: Resincronização de uma organização com novo projeto Supabase

---

## 🆘 QUANDO ESCALAR PARA SUPORTE TÉCNICO

Escale para a equipe técnica quando:

1. ❌ **Perda de dados críticos** não relacionada a projeto deletado
2. ❌ **Erro persistente** mesmo após seguir todos os passos de troubleshooting
3. ❌ **Bug confirmado** na aplicação (não erro de configuração)
4. ❌ **Problema de billing** ou cobrança duplicada
5. ❌ **Edge Function não deploy** mesmo com código correto
6. ❌ **Migrações falhando** com erro de SQL não relacionado a timeout/lock
7. ❌ **RLS bloqueando operações** mesmo com permissões corretas
8. ❌ **Performance crítica** (queries > 30s, timeouts frequentes)
9. ❌ **Integração WhatsApp não funciona** mesmo com instância ativa
10. ❌ **Cliente reporta possível vulnerabilidade** de segurança

**Informações para incluir no ticket**:
- Email/ID do usuário afetado
- Organization ID
- Timestamp do erro (data/hora)
- Mensagem de erro completa (copiar do console F12)
- Passos para reproduzir
- Prints de tela se relevante
- Resultado do diagnóstico (OrganizationDiagnosticsModal)

---

*Documento atualizado em: 2025-11-13*
*Versão: 1.0*


