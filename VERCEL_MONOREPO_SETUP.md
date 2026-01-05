# 🔧 Configuração Vercel para Monorepo

## ⚠️ Erro: `rootDirectory` no vercel.json

O Vercel **NÃO aceita** a propriedade `rootDirectory` no arquivo `vercel.json`. Essa propriedade deve ser configurada **apenas no dashboard do Vercel**.

## ✅ Solução

### Opção 1: Configurar no Dashboard (Recomendado)

1. Acesse o projeto no Vercel Dashboard
2. Vá em **Settings** → **General**
3. Em **Root Directory**, selecione: `apps/ia-admin-panel`
4. Salve as alterações

### Opção 2: Usar vercel.json sem rootDirectory

O arquivo `vercel.json` foi atualizado para funcionar sem `rootDirectory`. Os comandos agora assumem que você configurou o `rootDirectory` no dashboard.

**Configuração atual do vercel.json:**
```json
{
  "buildCommand": "cd ../.. && pnpm install && cd apps/ia-admin-panel && pnpm build",
  "outputDirectory": ".next",
  "installCommand": "cd ../.. && pnpm install"
}
```

## 📝 Passo a Passo Completo

### 1. Importar o Projeto

1. Acesse: https://vercel.com/new
2. Clique em **Import Git Repository**
3. Selecione o repositório `kairos-ia`

### 2. Configurar o Projeto

**IMPORTANTE**: Configure estas opções **ANTES** de clicar em Deploy:

- **Framework Preset**: Next.js (deve detectar automaticamente)
- **Root Directory**: `apps/ia-admin-panel` ⚠️ **CONFIGURE AQUI**
- **Build Command**: Deixe vazio (será usado do vercel.json)
- **Output Directory**: Deixe vazio (será usado do vercel.json)
- **Install Command**: Deixe vazio (será usado do vercel.json)

### 3. Deploy

Após configurar o Root Directory, clique em **Deploy**.

## 🔍 Verificação

Após o deploy, verifique:

1. O build deve iniciar automaticamente
2. Não deve aparecer erro sobre `rootDirectory`
3. O projeto deve fazer build corretamente

## 🆘 Troubleshooting

### Erro: "Cannot find module"
- Verifique se o **Root Directory** está configurado como `apps/ia-admin-panel`
- Verifique se o `package.json` está no diretório correto

### Erro: "Build failed"
- Verifique os logs do build no Vercel
- Certifique-se de que o Node.js está na versão correta (>=20.11.1)
- Verifique se o pnpm está sendo usado corretamente

### Erro: "Invalid request: should NOT have additional property `rootDirectory`"
- ✅ **RESOLVIDO**: Removemos `rootDirectory` do `vercel.json`
- Configure o `rootDirectory` no dashboard do Vercel

