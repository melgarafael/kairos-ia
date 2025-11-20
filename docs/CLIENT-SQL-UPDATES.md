# Atualizar Supabase (Client SQL)

O TomikCRM fornece atualizações SQL para o **Client Supabase** (do usuário) quando lançamos novas features/tabelas.

## Onde estão os updates
- Consulte `supabase/UPDATE-v5-CLIENT-SQL.md` (e os anteriores `UPDATE-v*`) para o script consolidado da versão.
- Migrações referenciais em `supabase/migrations/*` (podem conter trechos para Master). Use apenas as partes de `public.*` relevantes ao Client.

## Como aplicar (manual)
1. Abra o Editor SQL do seu projeto (Client Supabase).
2. Copie o conteúdo do arquivo de update mais recente.
3. Execute o script. Ele é idempotente (usa `if not exists` / `on conflict do nothing` quando possível).
4. Verifique erros e rode novamente se necessário.

## Pela UI (App)
- A UI exibe um aviso “Seu Supabase parece desatualizado” quando detecta versão antiga (`VersionWarning` em `src/App.tsx`).
- Clique em “Atualizar agora” para abrir a página com instruções e links para os scripts.

## Atualização automática (beta)
Requer a Edge Function `client-schema-updater` implantada no projeto do cliente e a variável `SUPABASE_DB_URL` definida (incluindo `sslmode=require`).

Passos:
- No app, vá em Atualizar Supabase → Atualização automática (beta)
- Informe `Project Ref` (ex: abcd1234) e `Service Role Key`
- Opcional: informe uma `Manifest URL` (JSON) que lista migrações e versão alvo
- Clique em Planejar atualizações; revise as migrações pendentes
- Clique em Aplicar pendentes para executar 1 a 1 com lock e registro

Manifest JSON (exemplo mínimo):
```
{
  "version": "v5.0.0",
  "migrations": [
    { "id": "20250826000100_webhooks_core", "name": "webhooks core", "checksum": "<sha256>", "sql": "..." },
    { "id": "20250826001200_webhooks_events_ext", "name": "webhooks ext", "checksum": "<sha256>", "sql": "..." }
  ]
}
```

Boas práticas:
- Mantenha as migrações idempotentes (IF NOT EXISTS, guardas)
- Use operações pequenas e, se necessário, divida migrações
- Teste em staging antes de publicar o manifest em produção

## Boas práticas
- Faça backup/snapshot do banco antes de grandes atualizações.
- Teste em um ambiente de staging quando possível.
- Leia o cabeçalho do update (quais tabelas/constraints/índices serão criados ou alterados).

## Compatibilidade de nomenclatura
- As atualizações recentes consolidam o uso de **clients** e **collaborators** (substituindo os legados **patients**/**professionals**). Se você tiver tabelas antigas, adapte seus dados ou crie `views` de compatibilidade.
