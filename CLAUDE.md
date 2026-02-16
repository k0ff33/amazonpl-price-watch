# Project: amazonpl-price-watch

Amazon.pl price tracker SaaS. Telegram-based, commission via affiliate links.

## Architecture

- **Monorepo:** pnpm workspaces, 3 services + shared package
- **Services:** bot-service (grammY + pg-boss), amazon-scraper (Crawlee Playwright), ceneo-service (Crawlee Cheerio + Impit)
- **Database:** PostgreSQL 16, Drizzle ORM
- **Job queue:** pg-boss (no Redis)
- **Deployment:** Coolify, Docker Compose, Hetzner 4GB VPS

## Project Structure

```
packages/
  shared/           # DB schema (Drizzle), pg-boss queue defs, shared types
  bot-service/      # Telegram bot, scheduler, notifications, Creators API
  amazon-scraper/   # Crawlee PlaywrightCrawler + stealth + proxies
  ceneo-service/    # Crawlee CheerioCrawler + Impit (browser TLS)
docs/
  plans/            # Design doc and implementation plan
  architecture.md
  requirements.md
  scraper_design.md
```

## Key Docs

- `docs/plans/2026-02-17-architecture-design.md` — approved architecture (read this first)
- `docs/plans/2026-02-17-implementation-plan.md` — step-by-step implementation plan
- `docs/scraper_design.md` — scraper deep-dive with Ceneo selectors

## Development Rules

- **Always use Context7** (MCP tool) to look up latest docs before using any library (Crawlee, pg-boss, grammY, Drizzle, Impit, Playwright)
- **TDD:** Write failing tests first, then implement
- **Commit frequently:** After each task completion
- **YAGNI:** Don't add features not in the plan
- Use `pnpm` exclusively (not npm or yarn)
- TypeScript strict mode everywhere

## Key Technical Details

- Amazon.pl Marketplace ID: `A1C3SOZRARQ6R3`
- Amazon.pl Ceneo shop ID: `42774`
- Price selectors: `.a-price-whole` + `.a-price-fraction`
- Stock selector: `#availability`
- Ceneo prices are server-rendered (no JS needed)

## Data Source Fallback Chain

1. Amazon Creators API (post 10-sale)
2. Amazon Scraper (Playwright)
3. Ceneo verification (HTTP only, on block or >30% drop)

## pg-boss Queues

| Queue | Producer | Consumer |
|---|---|---|
| `price-check` | pg-boss cron | bot-service |
| `amazon-scrape` | bot-service | amazon-scraper |
| `price-changed` | amazon-scraper | bot-service |
| `ceneo-verify` | amazon-scraper | ceneo-service |
| `ceneo-result` | ceneo-service | bot-service |
| `notify-user` | bot-service | bot-service |
