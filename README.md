# Liskobot 🦊

**Liskobot** (liskobot.pl) is a "Lisek chytrusek" (sly fox) price and stock tracker for Amazon.pl. It helps users find the best deals and historical lows, notifying them via Telegram when the hunt is successful.

## Architecture

Monorepo (pnpm workspaces) deployed via **Coolify** on a single VPS. Five Docker containers:

*   **`bot-service`** — Telegram bot (grammY), job orchestration, smart scheduler, and notification fan-out.
*   **`amazon-scraper`** — Crawlee Impit-first scraper with proxy and Playwright fallback chain.
*   **`ceneo-service`** — Crawlee CheerioCrawler + Impit for price verification via Ceneo.pl.
*   **`postgres`** — PostgreSQL 16 for persistent data.
*   **`redis`** — Redis 7 for BullMQ job queues.

## Tech Stack

*   **Runtime**: Node.js 24 LTS, TypeScript
*   **Core**: grammY, Crawlee, Drizzle ORM, BullMQ
*   **Infra**: Docker, PostgreSQL 16, Redis 7

## Security Model

*   **Group chats are supported with user ownership isolation**: watches are scoped to `(telegram_chat_id, owner_user_id, asin)`, so `/list`, `/set`, `/pause`, and `/stop` only affect the calling user.
*   **Per-user quota**: maximum `50` active watches per Telegram user (across chats).
*   **Notification safety**: user-facing alerts are sent as plain text (no Telegram Markdown parse mode), preventing formatting/link injection from scraped product titles.
*   **Runtime hardening**: production Redis requires authentication and all service containers run as non-root (`USER node`).

## Local Development

### Prerequisites

- Node.js 24 LTS
- pnpm
- Docker & Docker Compose
- A Telegram bot token (from [@BotFather](https://t.me/BotFather))

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your values (at minimum: TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, AMAZON_ASSOCIATE_TAG)

# 3. Start PostgreSQL + Redis
docker compose -f docker-compose.dev.yml up -d

# 4. Generate and run database migrations
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pricewatch pnpm db:generate
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pricewatch pnpm db:migrate

# 5. Build shared package (required before running services)
pnpm --filter @liskobot/shared build
```

### Running Services

Each service runs independently. In separate terminals:

```bash
# Telegram bot + scheduler + notification handlers
pnpm dev:bot

# Amazon scraper (Impit-first; Playwright/Chromium is used only on fallback)
pnpm dev:amazon

# Ceneo verification service
pnpm dev:ceneo
```

### Tests

```bash
pnpm --filter @liskobot/bot-service test
pnpm --filter @liskobot/amazon-scraper test
pnpm --filter @liskobot/ceneo-service test
```

### Build

```bash
pnpm -r build
```

### Production (Docker)

Set these env vars before running production compose:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`
- `AMAZON_ASSOCIATE_TAG`
- `PROXY_URL` (optional)

On first deployment, run DB migrations before starting long-running services.
The repository ships with `.dockerignore` to exclude local `node_modules` and `dist` artifacts from build context for reproducible image builds.

```bash
docker compose up -d --build
# Optional: verify all service images build cleanly
docker compose build
```

## Documentation

*   [Architecture](docs/architecture.md)
*   [Scraper Design](docs/scraper_design.md)
*   [Implementation Plan](docs/plans/2026-02-17-implementation-plan.md)
*   [Security Hardening Plan](docs/plans/2026-02-17-security-hardening-plan.md)
