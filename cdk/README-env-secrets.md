# CDK Deploy — loading secrets from trade-backend/.env

This CDK app injects several *system-level* secrets into the Lambda environment (Telegram/webhook signing/encryption keys).

To make local `cdk deploy` work without exporting a lot of shell env vars, `cdk/bin/cdk.ts` loads:

- `trade-backend/.env` (repo root) via `dotenv`

## Required variables for Telegram binding + webhook

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `WEBHOOK_BIND_SECRET`
- `ALLOW_LEGACY_PUBLIC_IMAGE`（`true|false`，是否允许解析 legacy 公链）
- `IMAGE_RESOLVE_RATE_LIMIT_PER_MINUTE`（每用户每分钟 resolve 次数限制）

## Optional (only if enabling Binance integration)

- `EXCHANGE_KEY_ENC_SECRET`

> These are *system-level* secrets (not per-user). Per-user bindCode/triggerToken are stored in DynamoDB.
