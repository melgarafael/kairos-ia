# Encryption Master Key (KMS/Secrets) – Runbook

> Objetivo: armazenar a chave mestra de criptografia fora do banco (KMS/Secrets Manager), injetar no Tenant Gateway e manter os dados de `saas_organizations`/`saas_supabases_connections` sempre cifrados com pgcrypto.

---

## 1. Gerar uma chave forte

Use qualquer gerador criptográfico. Exemplos:

```bash
# 32 bytes em hexadecimal (64 chars)
openssl rand -hex 32

# via AWS KMS (GenerateRandom - base64)
aws kms generate-random --number-of-bytes 32 --output text
```

Grave o valor apenas no seu KMS/Secrets Manager. **Não** commite nem envie para canais inseguros.

---

## 2. Armazenar no KMS/Secrets Manager

- AWS Secrets Manager: crie um secret `prod/tomik/encryption-master-key` com o valor gerado.
- GCP Secret Manager / Azure Key Vault / 1Password: fluxo equivalente.
- Para staging/dev, aceite colocar no `.env`, mas mantenha registros diferentes por ambiente.

> **Importante:** a mesma chave deve ser acessível pelo Tenant Gateway e pelo pipeline que configura o banco.

---

## 3. Injetar no Tenant Gateway

Configure a variável `ENCRYPTION_MASTER_KEY` na infraestrutura que roda o gateway:

- Docker/Compose: adicionar `ENCRYPTION_MASTER_KEY=${ENCRYPTION_MASTER_KEY}` e usar `envsubst`/`docker secrets`.
- Supabase Deploy: `supabase secrets set ENCRYPTION_MASTER_KEY=...`.
- AWS ECS / Lambda / Render / Railway: apontar a variável para o secret gerenciado (ECS task → *secrets*; Lambda → *Environment variables encrypted*; etc.).

Localmente, basta adicionar ao `apps/tenant-gateway/.env`.

Quando o gateway sobe, ele chama `set_encryption_key()` automaticamente (via service role). Se o valor mudar, o log avisará para rodar a migração.

---

## 4. Disseminar para o banco

1. **Deploy/Start do gateway** com `ENCRYPTION_MASTER_KEY` configurada.
2. Verificar o log:
   - `Master key already configured` → nada a fazer.
   - `Master key stored/rotated` → prossiga com o passo 5.

3. (Opcional) Validar no banco:
   ```sql
   select encryption_key, updated_at
   from public.encryption_config;
   ```

---

## 5. Recriptografar dados existentes

Execute em cada ambiente depois de definir/rotacionar a chave. Para facilitar, use o script `supabase/sql/migrate_keys_to_encryption.sql`:

1. Abra o SQL Editor (ou `supabase db query`) apontando para o ambiente correto.
2. Cole o conteúdo do arquivo e execute.
3. Revise cada bloco:
   - **Key status:** confirma que `encryption_config` possui uma chave e mostra o timestamp da última atualização.
   - **Pré-check:** aponta quantas linhas ainda parecem conter JWT/Base64 puro (começando com `eyJ...`).
   - **Execução:** roda `select public.migrate_keys_to_encryption();` e retorna o valor do próprio procedimento (quantidade de registros tocados).
   - **Pós-check:** repete a contagem para garantir que não restaram JWTs.
   - **Amostras:** retorna apenas o prefixo (24 chars) para auditoria manual.

Se preferir executar manualmente, o comando principal continua sendo:

```sql
select public.migrate_keys_to_encryption();
```

Mas recomenda-se o script para documentar os pré/pós-checks no próprio log do Supabase.

---

## 6. Boas práticas / Operação contínua

- **Rotação planejada:** gere chave nova, atualize o secret, redeploy o gateway, confirme o log e rode `migrate_keys_to_encryption()` imediatamente.
- **Backups:** antes de rotacionar, garanta backup do banco (apesar de ser reprocessável, é boa prática).
- **Monitoramento:** configure alerta para o log `[encryption] Master key rotated` e para erros ao chamar `set_encryption_key`.
- **Testes locais:** use uma chave curta em dev (`ENCRYPTION_MASTER_KEY=dev-master-key-...`) e rode a migration para garantir que tudo continua funcionando.

Com esse fluxo, a chave mestra nunca fica exposta no banco; ela é mantida no KMS/Secrets, o gateway a injeta automaticamente e o pgcrypto cuida da criptografia em repouso.

