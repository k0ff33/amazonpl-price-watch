# AGENTS.md

This file is the operational guide for coding agents working in this repository.

## 1. Project Snapshot

- Project: `liskobot` (Amazon.pl price tracker + Telegram bot)
- Monorepo: `pnpm` workspaces (`packages/*`)
- Runtime: Node.js 24, TypeScript (ESM, `moduleResolution: NodeNext`)
- Core services:
  - `@liskobot/bot-service`: Telegram commands, scheduler, notification workers
  - `@liskobot/amazon-scraper`: Amazon scraping + fallback orchestration
  - `@liskobot/ceneo-service`: Ceneo verification worker
  - `@liskobot/shared`: DB schema, queue names, job types, Redis URL parser
- Infra: PostgreSQL 16 + Redis 7 (BullMQ)

## 2. Source Of Truth Order

When docs and code disagree, trust them in this order:

1. `packages/*/src/**` (actual behavior)
2. `README.md` (current setup commands)
3. `docs/*.md` (design intent and history)
4. `CLAUDE.md` (assistant-facing guidance)

Notes:
- Architecture docs describe Creators API as primary source, but current runtime code is scraper-first.
- Always verify implementation details in code before changing behavior.

## 3. Repo Map

- Root scripts and workspace config:
  - `/Users/kamilwojtczyk/Developer/private/liskobot/package.json`
  - `/Users/kamilwojtczyk/Developer/private/liskobot/pnpm-workspace.yaml`
  - `/Users/kamilwojtczyk/Developer/private/liskobot/tsconfig.base.json`
- Docker:
  - `/Users/kamilwojtczyk/Developer/private/liskobot/docker-compose.dev.yml` (local Postgres + Redis)
  - `/Users/kamilwojtczyk/Developer/private/liskobot/docker-compose.yml` (production-style stack)
- Services:
  - `/Users/kamilwojtczyk/Developer/private/liskobot/packages/bot-service`
  - `/Users/kamilwojtczyk/Developer/private/liskobot/packages/amazon-scraper`
  - `/Users/kamilwojtczyk/Developer/private/liskobot/packages/ceneo-service`
  - `/Users/kamilwojtczyk/Developer/private/liskobot/packages/shared`

## 4. Key Runtime Contracts

### Queues

Defined in `/Users/kamilwojtczyk/Developer/private/liskobot/packages/shared/src/queues.ts`:

- `price-check`
- `amazon-scrape`
- `price-changed`
- `ceneo-verify`
- `ceneo-result`
- `notify-user`

### Health Endpoints

- bot-service: `GET /health` on port `3000`
- amazon-scraper: `GET /health` on port `3001`
- ceneo-service: `GET /health` on port `3002`

### DB Schema

Primary schema file: `/Users/kamilwojtczyk/Developer/private/liskobot/packages/shared/src/db/schema.ts`

Critical constraints:
- watch ownership isolation via `owner_user_id`
- unique watch per `(telegram_chat_id, owner_user_id, asin)`
- price history append-only table

## 5. Local Dev Commands

Run from repo root (`/Users/kamilwojtczyk/Developer/private/liskobot`).

### Install and infra

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d
```

### DB migration flow

Migrations run automatically on `bot-service` startup (via `drizzle-orm/postgres-js/migrator`). No manual step needed for applying migrations.

To generate a new migration after schema changes:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/liskobot pnpm db:generate
```

### Build shared first

```bash
pnpm --filter @liskobot/shared build
```

### Run services

```bash
pnpm dev:bot
pnpm dev:amazon
pnpm dev:ceneo
```

### Test

```bash
pnpm --filter @liskobot/bot-service test
pnpm --filter @liskobot/amazon-scraper test
pnpm --filter @liskobot/ceneo-service test
```

### Build all

```bash
pnpm -r build
```

## 6. Environment Variables

Reference: `/Users/kamilwojtczyk/Developer/private/liskobot/.env.example`

Global/common:
- `DATABASE_URL`
- `REDIS_URL`

Production/security:
- `REDIS_PASSWORD`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

Bot-specific:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`
- `AMAZON_ASSOCIATE_TAG`

Amazon scraper:
- `PROXY_URL` (optional, used for proxy fallback path)

## 7. Service Behavior Notes

### bot-service

- Registers scheduler worker and notification-related handlers at startup.
- User command handlers are in `/Users/kamilwojtczyk/Developer/private/liskobot/packages/bot-service/src/handlers`.
- Security-sensitive behavior:
  - per-user watch quota (`50`)
  - ownership checks for list/pause/stop/set commands
  - plain-text notifications (no Telegram Markdown parse mode)

### amazon-scraper

Current fallback chain in code:
1. Impit direct
2. Impit with proxy (if configured)
3. Playwright with proxy (if configured)

Files:
- `/Users/kamilwojtczyk/Developer/private/liskobot/packages/amazon-scraper/src/index.ts`
- `/Users/kamilwojtczyk/Developer/private/liskobot/packages/amazon-scraper/src/impit-scraper.ts`
- `/Users/kamilwojtczyk/Developer/private/liskobot/packages/amazon-scraper/src/crawler.ts`
- `/Users/kamilwojtczyk/Developer/private/liskobot/packages/amazon-scraper/src/scrape-with-fallback.ts`

### ceneo-service

- Consumes `ceneo-verify`, emits `ceneo-result`.
- Core files:
  - `/Users/kamilwojtczyk/Developer/private/liskobot/packages/ceneo-service/src/index.ts`
  - `/Users/kamilwojtczyk/Developer/private/liskobot/packages/ceneo-service/src/crawler.ts`
  - `/Users/kamilwojtczyk/Developer/private/liskobot/packages/ceneo-service/src/search.ts`

## 8. Testing Expectations For Agents

- Always run tests for the package you modify.
- If queue/job contracts or shared types change, run tests for all 3 services.
- If schema changes:
  - update schema and generate migration
  - run migration locally
  - run relevant tests
- Do not claim completion without fresh command output.

## 9. Editing Rules

- Use `pnpm` only (no npm/yarn).
- Prefer editing `src/` files; do not hand-edit `dist/` artifacts.
- Keep queue names and payload shapes centralized in shared package.
- After each plan execution, update relevant documentation (`README.md` and/or `docs/*.md`) in the same change.
- Preserve security behavior:
  - ownership isolation
  - watch quota
  - plain-text notification safety
  - Redis auth in production compose

## 10. Document Index

Primary docs:
- `/Users/kamilwojtczyk/Developer/private/liskobot/README.md`
- `/Users/kamilwojtczyk/Developer/private/liskobot/docs/requirements.md`
- `/Users/kamilwojtczyk/Developer/private/liskobot/docs/architecture.md`
- `/Users/kamilwojtczyk/Developer/private/liskobot/docs/scraper_design.md`

Agent guidance:
- `/Users/kamilwojtczyk/Developer/private/liskobot/CLAUDE.md`
