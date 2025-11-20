# 📦 Criar Bucket Manualmente no Supabase

Se o script falhar ao criar o bucket, você pode criar manualmente:

## Passos

1. Acesse o Supabase Dashboard:
   https://supabase.com/dashboard/project/qckjiolragbvvpqvfhrj/storage/buckets

2. Clique em **"New bucket"**

3. Configure:
   - **Name:** `videos-educativos`
   - **Public bucket:** ✅ Marque como público
   - **File size limit:** Deixe vazio ou configure conforme seu plano
     - Free Tier: 50MB por arquivo
     - Pro: até 5GB por arquivo

4. Clique em **"Create bucket"**

5. Execute o script novamente:
   ```bash
   npm run upload:videos
   ```

## Alternativa: Comprimir Vídeos Grandes

Para os vídeos acima de 50MB, você pode comprimir usando `ffmpeg`:

```bash
# Instalar ffmpeg (se não tiver)
brew install ffmpeg

# Comprimir vídeo (exemplo)
ffmpeg -i "public/videos/Recursos da Interface.mp4" \
  -c:v libx264 \
  -crf 28 \
  -preset slow \
  -c:a aac \
  -b:a 128k \
  "public/videos/Recursos da Interface - Compressed.mp4"
```

Ajuste o `crf` (qualidade):
- 23 = alta qualidade (arquivo maior)
- 28 = boa qualidade (arquivo médio) ⭐ Recomendado
- 32 = qualidade menor (arquivo menor)

