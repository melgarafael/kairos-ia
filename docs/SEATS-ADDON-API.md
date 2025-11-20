## API de Assentos Extras (Add-on por usuário)

Edge Function: `seats-grants`

Base URL (Supabase Edge): `https://<PROJECT>.supabase.co/functions/v1/seats-grants`

Headers comuns:
- `Content-Type: application/json`
- `Authorization: Bearer <JWT do usuário>` para ações do dono (ex.: list)
- `x-issue-secret: <ISSUE_TOKEN_SECRET>` para ações de serviço (ex.: issue, expire_due)
- `Idempotency-Key: <chave-idempotente>` (opcional) para evitar duplicidade em `issue`

### 1) Emitir grants de assentos

Endpoint:
`POST /functions/v1/seats-grants?action=issue`

Payload:
```json
{
  "email": "owner@example.com",      // ou "user_id": "<uuid>"
  "seats": 5,                         // alias: "quantity"
  "valid_days": 180,                  // ou "valid_until": "2026-03-01T00:00:00Z"
  "gateway": "hotmart",              // opcional
  "external_order_id": "ord_123",    // opcional
  "external_subscription_id": null,   // opcional
  "issued_by": "api"                 // opcional
}
```

Resposta:
```json
{ "ok": true, "user_id": "<uuid>", "grant_id": "<uuid>", "member_seats_extra": 12 }
```

Semântica:
- Se o usuário não existir, será criado (e-mail confirmado).
- Cria um registro em `saas_member_seats_grants` (status = `active`).
- Incrementa `saas_users.member_seats_extra` de forma atômica.
- `Idempotency-Key` garante que a mesma chamada não duplique o incremento.

### 2) Listar grants do dono autenticado

Endpoint:
`GET /functions/v1/seats-grants?action=list`

Headers: `Authorization: Bearer <JWT>`

Resposta:
```json
{ "ok": true, "grants": [ { "id": "...", "quantity": 5, "status": "active", "valid_until": "..." } ] }
```

### 3) Expirar grants vencidos (serviço)

Endpoint:
`POST /functions/v1/seats-grants?action=expire_due`

Headers: `x-issue-secret`

Efeito:
- Para cada grant `active` com `valid_until < now`, decrementa `member_seats_extra` e marca `status = expired`.
- Idempotente por grant.

### Observações
- O consumo de assentos nas organizações continua baseado em `saas_users.member_seats_extra`. A expiração mantém esse valor sincronizado.
- Recomenda-se agendar `expire_due` (cron) diariamente.


