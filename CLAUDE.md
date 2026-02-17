# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Amazon.pl price tracker. Users paste Amazon URLs in a Telegram bot, set target prices, get notified on drops. Revenue via Amazon Associates affiliate links.

## Commands

```bash
# Dependencies
pnpm install

# Local Postgres
docker compose -f docker-compose.dev.yml up -d

# Database migrations
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pricewatch pnpm db:generate
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pricewatch pnpm db:migrate

# Dev (each service)
pnpm dev:bot
pnpm dev:amazon
pnpm dev:ceneo

# Tests
pnpm --filter @amazonpl/bot-service test
pnpm --filter @amazonpl/amazon-scraper test
pnpm --filter @amazonpl/ceneo-service test

# Build
pnpm -r build

# Production
docker compose up -d --build
```

## Architecture

Monorepo (pnpm workspaces) with 4 Docker containers:

- **bot-service** — Telegram bot (grammY), smart scheduler, notification fan-out, Creators API calls. The orchestrator.
- **amazon-scraper** — Crawlee `PlaywrightCrawler` + stealth + residential proxies. Consumes `amazon-scrape` jobs.
- **ceneo-service** — Crawlee `CheerioCrawler` + Impit (browser TLS fingerprint). HTTP only, no Chromium. Consumes `ceneo-verify` jobs.
- **PostgreSQL** — All data + pg-boss job queues (no Redis).

Services communicate exclusively via pg-boss queues in Postgres. No direct HTTP calls between services.

### Data flow

```
pg-boss cron → bot-service tries Creators API → on fail: amazon-scrape job →
amazon-scraper writes price → price-changed job → bot-service fans out notifications
```

On anomalous drops (>30%) or Amazon blocks: `ceneo-verify` job dispatched, admin pinged for manual review.

### Queue map

| Queue | Producer | Consumer |
|---|---|---|
| `price-check` | pg-boss cron | bot-service |
| `amazon-scrape` | bot-service | amazon-scraper |
| `price-changed` | amazon-scraper | bot-service |
| `ceneo-verify` | amazon-scraper | ceneo-service |
| `ceneo-result` | ceneo-service | bot-service |
| `notify-user` | bot-service | bot-service |

## Domain Knowledge

- Amazon.pl Marketplace ID: `A1C3SOZRARQ6R3`
- Amazon price selectors: `.a-price-whole` (returns `"1 171,"` — strip spaces+comma) + `.a-price-fraction`, or scoped `#corePrice_feature_div .a-price .a-offscreen`
- Stock detection: check `#add-to-cart-button` / `#buy-now-button` existence (NOT `#availability` text — unreliable). Third-party-only pages have `#buybox-see-all-buying-choices`.
- Ceneo shop ID for Amazon.pl: `42774` — prices are server-rendered (no JS needed)
- Creators API requires 10 sales before `Offers` endpoint access — scraping is the real primary source during cold-start
- Amazon compliance: every link needs Associate tag, mandatory disclosure on every alert, no caching price data >24h

## Conventions

- Use `pnpm` exclusively
- Always use Context7 (MCP tool) to look up latest library docs before implementation
- Shared code lives in `@amazonpl/shared` (DB schema, queue names, types, pg-boss factory)
- Queue names and job payload types are defined in `packages/shared/src/queues.ts` and `packages/shared/src/types.ts`

## Key Docs

- `docs/plans/2026-02-17-architecture-design.md` — approved architecture (read first for full context)
- `docs/plans/2026-02-17-implementation-plan.md` — task-by-task implementation plan
- `docs/scraper_design.md` — scraper workflows, selectors, Ceneo verification logic
