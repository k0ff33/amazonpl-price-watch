# Liskobot 🦊

**Liskobot** (liskobot.pl) is a "Lisek chytrusek" (sly fox) price and stock tracker for Amazon.pl. It helps users find the best deals and historical lows, notifying them via Telegram when the hunt is successful.

## 🏗 Architecture (Planned)

Monorepo deployed via **Coolify** on a single VPS.

*   **`bot-service`**: Telegram bot (grammY), job orchestration, and notifications.
*   **`amazon-scraper`**: Playwright-based scraper with residential proxies and stealth plugins.
*   **`ceneo-service`**: Auxiliary HTTP scraper for price verification via Ceneo.pl.
*   **`postgres`**: Data persistence and **pg-boss** job queues.

## 🛠 Tech Stack

*   **Runtime**: Node.js 22+, TypeScript
*   **Core**: grammY, Crawlee, Drizzle ORM, pg-boss
*   **Infra**: Docker, PostgreSQL 16

## ⚡ Status

🚧 **Design Phase**

The architecture and implementation plans are finalized. Implementation of the monorepo structure and services is upcoming.

## 📄 Documentation

*   [Architecture](docs/architecture.md)
*   [Scraper Design](docs/scraper_design.md)
*   [Implementation Plan](docs/plans/2026-02-17-implementation-plan.md)
