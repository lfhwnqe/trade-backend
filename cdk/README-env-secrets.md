# CDK Deploy — loading secrets from trade-backend/.env

This CDK app injects several *system-level* secrets into the Lambda environment (Telegram/webhook signing/encryption keys).

To make local `cdk deploy` work without exporting a lot of shell env vars, `cdk/bin/cdk.ts` loads:

- `trade-backend/.env` (repo root) via `dotenv`

## Required variables for Telegram binding + webhook

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `WEBHOOK_BIND_SECRET`

## Optional (only if enabling Binance integration)

- `EXCHANGE_KEY_ENC_SECRET`

> These are *system-level* secrets (not per-user). Per-user bindCode/triggerToken are stored in DynamoDB.
