# 📦 Criar Repositório no GitHub - Passo a Passo

## 🎯 Objetivo
Criar o repositório `kairos-ia` no GitHub e fazer o push do código.

---

## 📝 Passo 1: Criar o Repositório no GitHub

### Opção A: Via Interface Web (Recomendado)

1. **Acesse**: https://github.com/new
   - Ou clique em **"New"** no canto superior direito do GitHub

2. **Preencha os dados**:
   - **Repository name**: `kairos-ia`
   - **Description**: `Kairos IA - Admin Panel`
   - **Visibility**: Escolha **Public** ou **Private** (sua preferência)
   
3. **⚠️ IMPORTANTE - NÃO MARQUE NENHUMA OPÇÃO**:
   - ❌ NÃO marque "Add a README file"
   - ❌ NÃO marque "Add .gitignore"
   - ❌ NÃO marque "Choose a license"
   
   **Deixe tudo desmarcado!**

4. Clique em **"Create repository"**

### Opção B: Via GitHub CLI (se você tiver instalado)

```bash
gh repo create kairos-ia --public --description "Kairos IA - Admin Panel"
```

---

## 🔗 Passo 2: Conectar o Repositório Local ao GitHub

Após criar o repositório no GitHub, você verá uma página com instruções. **IGNORE** essas instruções e execute os comandos abaixo:

```bash
cd /Users/rafaelmelgaco/kairos-ia

# Adicionar o novo remote (substitua SEU_USUARIO pelo seu username do GitHub)
git remote add kairos https://github.com/SEU_USUARIO/kairos-ia.git

# Verificar se foi adicionado
git remote -v
```

**Exemplo** (se seu username for `rafaelmelgaco`):
```bash
git remote add kairos https://github.com/rafaelmelgaco/kairos-ia.git
```

---

## 🚀 Passo 3: Fazer Push do Código

```bash
# Fazer push da branch main para o repositório kairos
git push -u kairos main
```

Se pedir autenticação:
- Use um **Personal Access Token** (não sua senha)
- Ou configure SSH se preferir

---

## ✅ Verificação

Após o push, acesse:
```
https://github.com/SEU_USUARIO/kairos-ia
```

Você deve ver todos os arquivos do projeto lá!

---

## 🆘 Troubleshooting

### Erro: "remote kairos already exists"
```bash
# Remover o remote existente
git remote remove kairos

# Adicionar novamente
git remote add kairos https://github.com/SEU_USUARIO/kairos-ia.git
```

### Erro: "Authentication failed"
1. Vá em: https://github.com/settings/tokens
2. Clique em **"Generate new token (classic)"**
3. Dê um nome (ex: "kairos-ia-deploy")
4. Marque a opção **"repo"** (acesso completo aos repositórios)
5. Clique em **"Generate token"**
6. **Copie o token** (você só verá ele uma vez!)
7. Use esse token como senha quando o Git pedir

### Erro: "Repository not found"
- Verifique se o nome do repositório está correto
- Verifique se você tem permissão para acessar o repositório
- Certifique-se de que o repositório foi criado no GitHub

---

## 📋 Checklist

- [ ] Repositório criado no GitHub (https://github.com/new)
- [ ] Nome: `kairos-ia`
- [ ] Nenhuma opção marcada (README, .gitignore, license)
- [ ] Remote `kairos` adicionado localmente
- [ ] Push realizado com sucesso
- [ ] Código visível no GitHub

---

## 🎉 Próximo Passo

Após o push ser concluído, você pode fazer o deploy no Vercel seguindo o arquivo `DEPLOY_INSTRUCTIONS.md`!

