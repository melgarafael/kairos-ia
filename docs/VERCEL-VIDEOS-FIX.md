# 🎥 Correção de Vídeos em Produção (Vercel)

## ❌ Problema
Os vídeos não estão sendo reproduzidos em produção no Vercel, apesar de funcionarem localmente.

## 🔍 Causa
O Vercel não baixa automaticamente os arquivos Git LFS durante o build. Quando os arquivos estão no Git LFS, eles aparecem como ponteiros (arquivos pequenos) no repositório, e os arquivos reais precisam ser baixados antes do build.

## ✅ Solução Implementada

### 1. Vídeos Movidos para `public/videos/`
- Os vídeos foram movidos de `src/assets/` para `public/videos/`
- Arquivos na pasta `public` são servidos diretamente pelo Vite sem processamento
- Componentes atualizados para usar caminhos `/videos/...` em vez de imports

### 2. Script de Prebuild Criado
- Criado `scripts/prebuild-lfs.sh` que baixa arquivos Git LFS antes do build
- O script é executado automaticamente via hook `prebuild` no `package.json`
- O script tenta instalar Git LFS se não estiver disponível no ambiente de build

### 3. Configuração do Vercel Atualizada
- Adicionados headers HTTP para arquivos de vídeo em `vercel.json`
- Configurado cache adequado para vídeos (1 ano)
- Content-Type correto para arquivos MP4

## 📋 Próximos Passos

### 1. Fazer Commit e Push das Mudanças
```bash
git add .
git commit -m "Fix video playback in production: move videos to public and add LFS prebuild script"
git push
```

### 2. Verificar no Vercel
Após o push, o Vercel irá:
1. Executar o script `prebuild-lfs.sh` que baixa os arquivos LFS
2. Executar o build normalmente
3. Servir os vídeos da pasta `public/videos/`

### 3. Verificar os Logs do Build
No painel do Vercel, verifique os logs do build para confirmar:
- ✅ "Git LFS instalado: ..."
- ✅ "Baixando arquivos Git LFS..."
- ✅ "Git LFS concluído"

### 4. Testar em Produção
Após o deploy:
1. Acesse a Central de Vídeos Educativos
2. Clique em um vídeo para reproduzir
3. Verifique o console do navegador (F12) para erros

## 🔧 Troubleshooting

### Se os vídeos ainda não funcionarem:

1. **Verificar se os arquivos estão no Git LFS:**
   ```bash
   git lfs ls-files | grep "public/videos"
   ```

2. **Verificar se os arquivos foram baixados no build:**
   - Veja os logs do build no Vercel
   - Procure por mensagens do script `prebuild-lfs.sh`

3. **Verificar se os arquivos estão no dist após o build:**
   ```bash
   npm run build
   ls -lh dist/videos/
   ```

4. **Verificar URLs dos vídeos:**
   - No console do navegador, verifique as URLs dos vídeos
   - Devem ser algo como: `https://seu-dominio.vercel.app/videos/Nome do Video.mp4`

### Alternativa: Usar CDN ou Storage Externo
Se o Git LFS continuar dando problemas, considere:
- Hospedar vídeos no Supabase Storage
- Usar um CDN como Cloudflare R2 ou AWS S3
- Usar serviços de vídeo como YouTube ou Vimeo (embed)

## 📝 Arquivos Modificados

- `src/components/features/Reports/AdminVideosPanel.tsx` - Caminhos atualizados
- `src/components/features/Auth/OrganizationResourcesVideos.tsx` - Caminhos atualizados
- `package.json` - Adicionado hook `prebuild`
- `vercel.json` - Adicionados headers para vídeos
- `scripts/prebuild-lfs.sh` - Script de prebuild criado
- `public/videos/*.mp4` - Vídeos movidos para pasta public

