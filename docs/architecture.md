# Architecture: Liskobot (liskobot.pl)

## 1. System Overview

Self-hosted, modular SaaS deployed via **Coolify** on a single Hetzner VPS. Four Docker containers, no external dependencies beyond a proxy provider.

```mermaid
graph TD
    User((User)) <--> Telegram[Telegram Bot API]
    Telegram <--> Bot[bot-service<br/>grammY + pg-boss]
    Bot <--> PG[(PostgreSQL<br/>+ pg-boss queues)]

    Bot -->|price-check job| Bot
    Bot -->|try Creators API| API[Amazon Creators API]
    Bot -->|on API fail: amazon-scrape job| PG

    subgraph "Amazon Scraper Service"
        AS[Crawlee PlaywrightCrawler<br/>+ stealth + proxies]
    end

    subgraph "Ceneo Service"
        CS[Crawlee CheerioCrawler<br/>+ Impit TLS]
    end

    PG -->|amazon-scrape| AS
    AS -->|price-changed| PG
    AS -->|ceneo-verify on block/anomaly| PG
    PG -->|ceneo-verify| CS
    CS -->|ceneo-result| PG
    PG -->|notify-user| Bot
    Bot -->|send alert| Telegram
```

## 2. Container Layout

```mermaid
graph LR
    subgraph "Hetzner VPS 4GB - Coolify"
        B[bot-service<br/>512MB limit]
        A[amazon-scraper<br/>2GB limit]
        C[ceneo-service<br/>256MB limit]
        P[(PostgreSQL<br/>512MB limit)]
    end

    B <--> P
    A <--> P
    C <--> P
```

| Container | Stack | RAM | Role |
|---|---|---|---|
| bot-service | Node/TS, grammY, pg-boss | ~200MB | Telegram bot, Creators API, scheduler, notifications |
| amazon-scraper | Crawlee PlaywrightCrawler + stealth | ~1.5GB | Scrape Amazon.pl product pages |
| ceneo-service | Crawlee CheerioCrawler + Impit | ~100MB | Verify Amazon prices via Ceneo.pl |
| postgres | PostgreSQL 16 | ~256MB | DB + pg-boss job queues |

## 3. Data Source Fallback Chain

```mermaid
flowchart TD
    Start[price-check job] --> API{Try Creators API}
    API -->|Success| Write[Write price to DB]
    API -->|Fail / No access| Scrape{Amazon Scraper}
    Scrape -->|Success| Check{Price drop > 30%?}
    Scrape -->|Blocked CAPTCHA/403| Ceneo[Ceneo Verify + Admin Alert]
    Check -->|No| Write
    Check -->|Yes| Verify[Write as unverified<br/>+ Ceneo Verify<br/>+ Admin Alert]
    Verify --> NotifyCaveat[Notify users with caveat]
    Ceneo --> Result{Ceneo confirms?}
    Result -->|Yes| Confirmed[Update + Notify verified]
    Result -->|No| AdminReview[Admin manual review]
    Write --> Notify[Notify users]
```

Priority order:
1. **Amazon Creators API** - REST call from bot-service (OAuth 2.0, post 10-sale threshold).
2. **Amazon Scraper** - Playwright + stealth + residential proxies. Primary source during cold-start.
3. **Ceneo Verification** - HTTP only. Triggered on Amazon blocks or anomalous drops (>30%).

## 4. Smart Scheduler

pg-boss cron fires every minute. Bot-service queries due products and dispatches jobs.

### Priority Formula
```
priority = log10(subscriber_count + 1) * volatility_factor
```

### Tiered Intervals

| Condition | Interval | Rationale |
|---|---|---|
| `price < 30 PLN` | Max 24h | Low commission |
| `subscriber_count > 100` | Floor 15min | High revenue potential |
| `volatility_score > 0.8` | 30min | Frequently changing |
| Default | 4h | Baseline |

## 5. Job Flow (pg-boss Queues)

```mermaid
sequenceDiagram
    participant Cron as pg-boss Cron
    participant Bot as bot-service
    participant API as Creators API
    participant AS as amazon-scraper
    participant DB as PostgreSQL
    participant CS as ceneo-service
    participant TG as Telegram

    Cron->>Bot: price-check (every min)
    Bot->>API: getItems(ASIN)
    alt API available
        API-->>Bot: price data
        Bot->>DB: update price
    else API unavailable
        Bot->>DB: enqueue amazon-scrape
        DB->>AS: amazon-scrape job
        AS->>AS: Playwright scrape
        alt Success
            AS->>DB: write price + enqueue price-changed
            alt Drop > 30%
                AS->>DB: enqueue ceneo-verify
                DB->>CS: ceneo-verify job
                CS->>DB: ceneo-result
            end
        else Blocked
            AS->>DB: enqueue ceneo-verify + admin alert
        end
    end
    DB->>Bot: price-changed
    Bot->>DB: query watches
    loop Batches of 50
        Bot->>TG: notify-user (affiliate link)
    end
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

## 6. Data Schema

```sql
products
  asin              text PRIMARY KEY
  title             text
  current_price     numeric
  historical_low    numeric
  is_in_stock       boolean
  ceneo_id          text              -- cached Ceneo mapping
  volatility_score  numeric
  subscriber_count  integer           -- denormalized
  last_scraped_at   timestamptz
  next_check_at     timestamptz
  created_at        timestamptz

watches
  id                uuid PRIMARY KEY
  telegram_chat_id  bigint
  asin              text REFERENCES products
  target_price      numeric
  notify_historical_low  boolean DEFAULT true
  is_active         boolean DEFAULT true
  created_at        timestamptz

price_history
  id                bigint GENERATED ALWAYS AS IDENTITY
  asin              text REFERENCES products
  price             numeric
  source            text              -- 'creators_api' | 'amazon_scraper' | 'ceneo'
  recorded_at       timestamptz
  -- INDEX (asin, recorded_at)
```

## 7. Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (Node.js 22+) |
| Telegram bot | grammY |
| Amazon scraper | Crawlee PlaywrightCrawler + stealth |
| Ceneo scraper | Crawlee CheerioCrawler + Impit |
| Amazon API | Creators API SDK (OAuth 2.0) |
| Job queue | pg-boss (PostgreSQL-backed) |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM or Kysely |
| Crawler scaffolding | apify-cli (local project setup) |
| Deployment | Coolify (Docker) |
| Proxies | IPRoyal or Scrapeless (residential) |
| VPS | Hetzner 4GB ARM (~$7/mo) |

## 8. Estimated Monthly Cost

| Item | Cost |
|---|---|
| VPS (Hetzner 4GB) | ~$7 |
| Residential proxies | ~$2.25 |
| Domain (optional) | ~$1 |
| **Total** | **~$10-15/mo** |
