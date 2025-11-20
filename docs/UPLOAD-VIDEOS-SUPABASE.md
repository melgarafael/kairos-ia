# 🎥 Upload de Vídeos para Supabase Storage

## Por que usar Supabase Storage?

O Git LFS não funciona de forma confiável no Vercel durante o build. A solução é hospedar os vídeos no Supabase Storage, que:
- ✅ É mais confiável
- ✅ Tem CDN integrado
- ✅ Não depende do processo de build
- ✅ URLs públicas diretas

## 📋 Passos para Upload

### 1. Configurar Variável de Ambiente

Certifique-se de ter a variável `VITE_MASTER_SUPABASE_SERVICE_KEY` configurada:

```bash
export VITE_MASTER_SUPABASE_SERVICE_KEY="sua-service-key-aqui"
```

Ou adicione ao arquivo `.env`:
```
VITE_MASTER_SUPABASE_SERVICE_KEY=sua-service-key-aqui
```

### 2. Executar o Script de Upload

```bash
# Opção 1: Usando o script npm (recomendado)
npm run upload:videos

# Opção 2: Executar diretamente
node scripts/upload-videos-to-supabase.mjs
```

O script irá:
1. Criar o bucket `videos-educativos` se não existir (público)
2. Fazer upload de todos os vídeos da pasta `public/videos/`
3. Gerar URLs públicas para cada vídeo

### 3. Verificar no Supabase Dashboard

1. Acesse: https://supabase.com/dashboard/project/qckjiolragbvvpqvfhrj/storage/buckets
2. Verifique se o bucket `videos-educativos` existe e está público
3. Confirme que todos os vídeos foram enviados

### 4. Testar em Produção

Após o upload e deploy:
- Os componentes já estão configurados para usar Supabase Storage
- Os vídeos devem funcionar imediatamente em produção

## 🔧 Troubleshooting

### Erro: "VITE_MASTER_SUPABASE_SERVICE_KEY não configurada"
- Configure a variável de ambiente antes de executar o script

### Erro: "Bucket não encontrado"
- O script tenta criar automaticamente. Se falhar, crie manualmente no Dashboard:
  1. Vá em Storage → Create bucket
  2. Nome: `videos-educativos`
  3. Marque como **Public**

### Arquivo não encontrado
- Certifique-se de que os vídeos estão na pasta `public/videos/`
- Execute `git lfs pull` se os arquivos ainda forem ponteiros LFS

## 📝 Notas

- Os vídeos serão sobrescritos se já existirem (upsert: true)
- O bucket tem limite de 500MB por arquivo
- URLs públicas não expiram automaticamente

