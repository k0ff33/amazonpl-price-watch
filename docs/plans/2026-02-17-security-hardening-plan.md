# Liskobot Security Hardening Plan

> Status: Implemented on 2026-02-17

## Scope

This plan documents the most important security hardening changes applied after the initial implementation, with focus on multi-user safety in Telegram group chats and production runtime hardening.

## Goals

1. Prevent cross-user control of watches in group chats.
2. Reduce abuse/cost amplification via unbounded watch creation.
3. Remove Telegram Markdown injection risk in notifications.
4. Reduce blast radius of service compromise in production runtime.

## Implemented Changes

### 1. Ownership isolation for watches

- Added `owner_user_id` to `watches`.
- Watch identity is now unique by `(telegram_chat_id, owner_user_id, asin)`.
- Bot command handlers now scope all watch operations to both chat and caller identity.

Effect:
- Group chat usage remains supported.
- Users cannot list/edit/pause/stop watches created by other users in the same chat.

### 2. Per-user watch quota

- Added limit of `50` active watches per Telegram user.
- Enforced during `/track` before creating a new watch.

Effect:
- Caps queue/scraper abuse and proxy cost growth from a single account.

### 3. Notification injection hardening

- Removed Telegram `parse_mode: Markdown` from notify worker.
- Switched affiliate CTA to plain-text URL rendering.
- URL-encoded affiliate tag when building links.

Effect:
- Scraped product titles cannot inject Markdown formatting or links.

### 4. Runtime/container hardening

- Production `redis` now requires password (`REDIS_PASSWORD`) and service URLs use authenticated Redis DSN.
- Service containers run as non-root (`USER node`).
- Amazon scraper image ensures browser files are owned by `node`.

Effect:
- Reduces internal unauthorized queue access risk and container privilege level.

## Data Migration Notes

- Migration `0001_lame_miek.sql`:
  - Adds `owner_user_id`.
  - Backfills `owner_user_id = telegram_chat_id` for any pre-existing rows.
  - Deduplicates rows before creating unique index.
- For greenfield deployments (empty DB), backfill/dedupe steps are effectively no-op.

## Rollout Checklist (First Deployment)

1. Set production env vars: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, `AMAZON_ASSOCIATE_TAG` (and optional `PROXY_URL`).
2. Run DB migrations.
3. Start services with production compose.
4. Smoke test in Telegram:
   - Two users in one group each add the same ASIN.
   - Verify `/list` shows only caller-owned watches.
   - Verify one user cannot `/pause` or `/stop` the other user's watch.
   - Verify `/track` rejects when user exceeds quota.

## Verification Evidence

Commands executed after implementation:

- `pnpm --filter @liskobot/shared build`
- `pnpm --filter @liskobot/bot-service test`
- `pnpm --filter @liskobot/bot-service build`
- `pnpm --filter @liskobot/amazon-scraper test`
- `pnpm --filter @liskobot/ceneo-service test`
- `docker compose -f docker-compose.yml config`
