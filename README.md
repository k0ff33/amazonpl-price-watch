# amazonpl-price-watch

A self-hosted SaaS for tracking Amazon.pl prices via Telegram, featuring smart scheduling and an anti-bot resistant scraping engine.

## 🏗 Architecture

Monorepo deployed via **Coolify** on a single VPS.

*   **`bot-service`**: Telegram bot (grammY), job orchestration, and notifications.
*   **`amazon-scraper`**: Playwright-based scraper with residential proxies and stealth plugins.
*   **`ceneo-service`**: Auxiliary HTTP scraper for price verification via Ceneo.pl.
*   **`postgres`**: Data persistence and **pg-boss** job queues.

## 🛠 Tech Stack

*   **Runtime**: Node.js 22+, TypeScript
*   **Core**: grammY, Crawlee, Drizzle ORM, pg-boss
*   **Infra**: Docker, PostgreSQL 16

## ⚡ Getting Started

1.  **Install**: `pnpm install`
2.  **Env**: Copy `.env.example` to `.env` (needs Telegram Token & Proxy URL).
3.  **DB**: `docker compose -f docker-compose.dev.yml up -d`
4.  **Migrate**: `pnpm db:migrate`
5.  **Run**: `pnpm dev:bot`, `pnpm dev:amazon`, or `pnpm dev:ceneo`

## 📄 Docs

*   [Architecture](docs/architecture.md)
*   [Scraper Design](docs/scraper_design.md)
*   [Implementation Plan](docs/plans/2026-02-17-implementation-plan.md)
