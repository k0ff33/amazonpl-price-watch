# Architecture Design: amazonpl-price-watch

**Date:** 2026-02-17
**Status:** Approved

## 1. System Overview

A commission-only SaaS tracking Amazon.pl prices via Telegram. Users paste Amazon.pl URLs, set target prices, and receive notifications on price drops, historical lows, and stock changes. Revenue is generated through Amazon Associates affiliate links.

### Container Layout

Four Coolify-managed Docker containers on a single Hetzner 4GB VPS (~$7/mo):

```
┌─────────────────────────────────────────────────────┐
│  Hetzner VPS (4GB RAM) - managed by Coolify         │
│                                                      │
│  ┌──────────────┐    ┌─────────────────────────┐    │
│  │  bot-service  │<-->│  PostgreSQL              │    │
│  │  (Node/TS)    │    │  DB + pg-boss queues     │    │
│  │  ~200MB       │    │  + LISTEN/NOTIFY         │    │
│  └──────────────┘    │  ~256MB                  │    │
│                       └──▲──────────▲───────────┘    │
│                          │          │                │
│  ┌───────────────────────┴──┐  ┌───┴──────────────┐ │
│  │  amazon-scraper           │  │  ceneo-service    │ │
│  │  Crawlee+Playwright       │  │  Crawlee+Cheerio  │ │
│  │  +stealth+proxies         │  │  +Impit (TLS)     │ │
│  │  ~1.5GB                   │  │  ~100MB           │ │
│  └──────────────────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Total RAM:** ~2GB. Fits comfortably on 4GB VPS.

### Service Responsibilities

| Service | Role |
|---|---|
| **bot-service** | Telegram bot (grammY), Creators API calls, smart scheduler registration, notification fan-out, price-change orchestration |
| **amazon-scraper** | Playwright-based scraping of Amazon.pl product pages. Consumes `amazon-scrape` jobs, produces `price-changed` jobs |
| **ceneo-service** | Lightweight HTTP verification of Amazon prices via Ceneo.pl. Consumes `ceneo-verify` jobs, produces `ceneo-result` jobs |
| **PostgreSQL** | All persistent data, pg-boss job queues, LISTEN/NOTIFY |

### Key Architectural Decisions

- **No Redis.** pg-boss uses PostgreSQL as the job queue backend (SKIP LOCKED). One fewer container.
- **No PocketBase.** PostgreSQL handles concurrent writes, job queuing, and notifications natively. PocketBase's SQLite would bottleneck under concurrent access.
- **Separate scraper services.** RAM isolation: if Chromium OOMs, it doesn't take down the bot. Independent deployment: scraper selectors change frequently.
- **Crawlee framework for both scrapers.** Consistent proxy rotation, session management, retries, and request queuing. Different transports: PlaywrightCrawler (Amazon) vs CheerioCrawler+Impit (Ceneo).

## 2. Data Model

```sql
-- Products: one row per tracked Amazon ASIN
products
  asin              text PRIMARY KEY       -- e.g. "B0DEXAMPLE"
  title             text
  current_price     numeric                -- latest scraped price in PLN
  historical_low    numeric
  is_in_stock       boolean
  ceneo_id          text                   -- cached Ceneo product mapping (nullable)
  volatility_score  numeric                -- computed from price change frequency
  subscriber_count  integer                -- denormalized for scheduler priority
  last_scraped_at   timestamptz
  next_check_at     timestamptz            -- smart scheduler sets this
  created_at        timestamptz

-- Watches: user subscriptions to products
watches
  id                uuid PRIMARY KEY
  telegram_chat_id  bigint                 -- user identifier
  asin              text REFERENCES products
  target_price      numeric                -- notify when price <= this (nullable)
  notify_historical_low  boolean DEFAULT true
  is_active         boolean DEFAULT true
  created_at        timestamptz

-- Price history: permanent append-only record
price_history
  id                bigint GENERATED ALWAYS AS IDENTITY
  asin              text REFERENCES products
  price             numeric
  source            text                   -- 'creators_api' | 'amazon_scraper' | 'ceneo'
  recorded_at       timestamptz
  -- INDEX on (asin, recorded_at)
```

**Notes:**
- `subscriber_count` denormalized on products to avoid JOINs in scheduler queries.
- `ceneo_id` cached after initial title-based search on Ceneo.pl.
- `source` field tracks data provenance for future Creators API migration.

## 3. Data Source Fallback Chain

The system uses a prioritized fallback chain for price data:

```
Creators API --> Amazon Scraper --> Ceneo (conditional)
```

1. **Creators API** (primary, post-10-sale threshold): REST call from bot-service. OAuth 2.0 Client Credentials, 60-min token refresh. Limited to 1 TPS / 8,640 TPD initially.
2. **Amazon Scraper** (fallback / cold-start primary): Playwright with stealth plugins + residential proxies. This will be the actual primary source until 10 qualifying sales are generated.
3. **Ceneo Verification** (conditional only):
   - Triggered when Amazon scraper is blocked (CAPTCHA/403).
   - Triggered when price drop exceeds 30% (anomalous).
   - Admin is notified via Telegram in both cases for manual review.
   - Ceneo uses HTTP (Impit + Cheerio) to check if Amazon.pl is listed as a seller. Amazon.pl's Ceneo shop ID: `42774`.

### ASIN-to-Ceneo Mapping

When an ASIN is first tracked, the ceneo-service searches Ceneo by product title and caches the best-matching Ceneo product ID in `products.ceneo_id`.

## 4. Smart Scheduler

pg-boss cron schedule fires every minute. Bot-service queries for due products and dispatches `price-check` jobs.

### Priority Formula

```
priority = log10(subscriber_count + 1) * volatility_factor
```

### Tiered Intervals

| Condition | Refresh Interval | Rationale |
|---|---|---|
| `price < 30 PLN` | Max 24h | Low commission |
| `subscriber_count > 100` | Floor 15min | High revenue potential |
| `volatility_score > 0.8` | 30min | Frequently changing prices |
| Default | 4h | Baseline for new/low-interest items |

## 5. Job Flow (pg-boss Queues)

### Normal price check

```
pg-boss cron (every min)
  --> bot-service: price-check
        --> try Creators API
        --> on fail: enqueue amazon-scrape
              --> amazon-scraper: scrape, write to DB
              --> enqueue price-changed
                    --> bot-service: check watches, enqueue notify-user
                          --> bot-service: send Telegram messages
```

### Anomalous drop (>30%)

```
amazon-scraper detects >30% drop
  --> writes to DB with unverified flag
  --> enqueues price-changed (unverified: true)
  --> enqueues ceneo-verify
  --> bot-service: notifies users with caveat ("verifying...")
  --> bot-service: pings admin for manual review
  --> ceneo-service: checks Ceneo, enqueues ceneo-result
  --> bot-service: processes ceneo-result, updates users if confirmed
```

### Amazon blocked

```
amazon-scraper gets CAPTCHA/403
  --> enqueues ceneo-verify (fallback)
  --> pings admin ("Amazon blocked for ASIN X")
```

### Queue Summary

| Queue | Producer | Consumer |
|---|---|---|
| `price-check` | pg-boss cron | bot-service |
| `amazon-scrape` | bot-service | amazon-scraper |
| `price-changed` | amazon-scraper | bot-service |
| `ceneo-verify` | amazon-scraper / bot-service | ceneo-service |
| `ceneo-result` | ceneo-service | bot-service |
| `notify-user` | bot-service | bot-service |

## 6. Telegram Bot

### Framework

grammY (TypeScript-native, modern API).

### User Commands

| Command | Action |
|---|---|
| Paste Amazon.pl URL | Extract ASIN, create product + watch |
| `/list` | Show active watches with current prices |
| `/pause <id>` | Pause a watch |
| `/stop <id>` | Delete a watch |
| `/set <id> <price>` | Set/update target price |

### Notification Formats

- **Normal drop:** "Product X dropped from 199 to 149 PLN (-25%). [Buy on Amazon.pl](affiliate-link)" + Associate disclosure
- **Unverified drop:** Prefixed with "Unverified price drop - confirming..."
- **Verified follow-up:** "Price verified at 99 PLN via independent source."
- **Historical low:** "New all-time low! Product X is now 99 PLN (previous low: 119 PLN)."
- **Back in stock:** "Product X is back in stock at 149 PLN."

### Rate Limiting

Fan-out via pg-boss `notify-user` jobs, batched 50 at a time. Telegram allows ~30 messages/sec to different chats.

### Admin Alerts

Sent to admin's personal Telegram chat:
- Anomalous price drops for manual review
- Amazon scraper blocked (CAPTCHA/403)
- Scraper success rate below 85%

## 7. Error Handling & Monitoring

- **pg-boss retries:** 3 attempts with exponential backoff per job.
- **Dead letter queue:** After 3 failures, job moves to DLQ + admin alert.
- **Double-scrape verification:** Price drops >30% trigger a second scrape with fresh IP/context before writing to DB.
- **Success rate tracking:** amazon-scraper tracks hourly success rate. Alert if <85%.
- **Healthcheck endpoints:** `/health` per service for Coolify restart policies.
- **MVP monitoring:** Admin Telegram alerts only. No Grafana/Prometheus until user scale justifies it.

## 8. Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (Node.js 22+) |
| Telegram bot | grammY |
| Amazon scraper | Crawlee PlaywrightCrawler + stealth plugin |
| Ceneo scraper | Crawlee CheerioCrawler + Impit (browser TLS) |
| Amazon API | Creators API SDK (Node.js, OAuth 2.0) |
| Job queue | pg-boss (PostgreSQL-backed) |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM or Kysely |
| Crawler scaffolding | apify-cli (local project setup) |
| Deployment | Coolify (Docker Compose) |
| Proxy provider | IPRoyal or Scrapeless (residential, pay-as-you-go) |
| VPS | Hetzner 4GB ARM (~$7/mo) |

## 9. Deployment

```yaml
bot-service:      mem_limit: 512m,  restart: always
amazon-scraper:   mem_limit: 2g,    restart: always
ceneo-service:    mem_limit: 256m,  restart: always
postgres:         mem_limit: 512m,  restart: always, volume: persistent
```

## 10. Estimated Monthly Cost

| Item | Cost |
|---|---|
| VPS (Hetzner 4GB) | ~$7 |
| Residential proxies (~10k checks) | ~$2.25 |
| Domain (optional) | ~$1 |
| **Total** | **~$10-15/mo** |

## 11. Amazon.pl Specifics

- **Marketplace ID:** `A1C3SOZRARQ6R3`
- **Marketplace Host:** `www.amazon.pl`
- **Currency:** PLN
- **Auth Endpoint:** `https://creatorsapi.auth.eu-south-2.amazoncognito.com/oauth2/token`
- **API Base URL:** `https://creatorsapi.amazon`
- **Compliance:** Every link must include Associate/Tracking ID. Mandatory disclosure on every alert. Price data cannot be cached >24h for display.
