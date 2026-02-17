# Deployment Design — Liskobot Production

**Date:** 2026-02-17
**Status:** Approved

## Overview

Deploy liskobot to production on a Hetzner 8GB VPS using Coolify with separate resources per service. All services communicate via BullMQ queues in Redis. Coolify dashboard accessible only via Tailscale.

## Infrastructure

| Component | Provider | Details |
|---|---|---|
| VPS | Hetzner cx33 or cax21 | 8 GB RAM, shared CPU |
| Deployment platform | Coolify | Self-hosted, dedicated instance |
| Proxy provider | IPRoyal | Residential, Polish IPs, $3.68/GB, no expiry |
| Source control | GitHub | Private repo, GitHub App integration |
| VPN | Tailscale | Secure access to Coolify dashboard |
| Bot platform | Telegram | Bot already created via @BotFather |
| Affiliate program | Amazon Associates | partnerzy.amazon.pl |

## Coolify Architecture — Approach B (Separate Resources)

### Why separate resources

- Independent deploy cycles per service
- Easier to scale amazon-scraper independently in the future
- Cleaner Coolify dashboard (per-service logs, metrics, rollbacks)
- Future horizontal scaling: deploy scraper to a second VPS without touching other services

### Project structure

One Coolify **Project** (`liskobot`) with one **Environment** (`production`) containing 5 resources:

| Resource | Type | Build Pack | Memory Limit |
|---|---|---|---|
| `postgres` | Managed PostgreSQL 16 | N/A (Coolify managed) | — |
| `redis` | Managed Redis 7 | N/A (Coolify managed) | — |
| `bot-service` | Application | Dockerfile | 512 MB |
| `amazon-scraper` | Application | Dockerfile | 2 GB |
| `ceneo-service` | Application | Dockerfile | 256 MB |

### Networking

All resources connected via Coolify's **predefined network** (destination network):

1. Enable "Connect to Predefined Networks" on all 5 resources
2. Services reference each other by Coolify-assigned container names (e.g. `postgres-xk4m8n`)
3. No custom `networks:` in Dockerfiles or compose files — Coolify manages this
4. No ports exposed to the internet — all communication is internal Docker networking

### Application resource configuration

Each app service uses the **Dockerfile build pack** with:

- **Repository:** GitHub (connected via GitHub App)
- **Branch:** `main`
- **Base directory:** `/` (repo root — needed for monorepo pnpm workspace context)
- **Dockerfile path:** `packages/<service>/Dockerfile`
- **Auto-deploy:** On push to `main` via GitHub App webhook
- **Health check:** Internal Docker health check on each service's `/health` endpoint

### Environment variables

**Shared across all 3 app services:**

```
DATABASE_URL=postgresql://<user>:<pass>@<postgres-container>:5432/pricewatch
REDIS_URL=redis://<redis-container>:6379
```

Container names are obtained from Coolify UI after creating the managed database resources.

**bot-service only:**

```
TELEGRAM_BOT_TOKEN=<from BotFather>
TELEGRAM_ADMIN_CHAT_ID=<your personal chat ID>
AMAZON_ASSOCIATE_TAG=<your associate tag>
```

**amazon-scraper only:**

```
PROXY_URL=http://<USER>:<PASS>_country-pl@geo.iproyal.com:12321
```

## Deployment Order

Sequential, one-time setup:

1. **PostgreSQL** — create managed DB resource, wait for healthy
2. **Redis** — create managed DB resource, wait for healthy
3. Enable **"Connect to Predefined Networks"** on both database resources
4. Note container names from Coolify UI for connection strings
5. **bot-service** — deploy first (runs Drizzle migrations on startup, creates tables)
6. **ceneo-service** — deploy (connects to DB + Redis, no migration step)
7. **amazon-scraper** — deploy last (heaviest build, ~5 min for Playwright + Chromium)

## Database Migrations

Auto-migration on bot-service startup using Drizzle ORM:

```typescript
import { migrate } from 'drizzle-orm/node-postgres/migrator';
await migrate(db, { migrationsFolder: './drizzle' });
// then start bot + workers
```

Runs on every deploy. Drizzle tracks applied migrations — safe to run repeatedly. Never write destructive migrations (no `DROP TABLE`, no `DROP COLUMN` without backup plan).

## Price-Check Fallback Chain

Each step only triggers if the previous one fails:

```
1. Amazon Creators API  →  free, no scraping
   ↓ (fails / not yet available — requires 10 qualifying sales)
2. Direct scrape        →  no proxy, Hetzner IP (free)
   ↓ (CAPTCHA / blocked)
3. Proxy scrape         →  IPRoyal residential proxy (paid per GB)
   ↓ (anomalous drop >30%)
4. Ceneo verification   →  HTTP only, no proxy needed (free)
```

### Direct-first, proxy-on-block scraper strategy

Two-crawler approach in amazon-scraper:

- `directCrawler` — PlaywrightCrawler without proxy configuration
- `proxyCrawler` — PlaywrightCrawler with IPRoyal proxy

Worker flow:
1. Run request through `directCrawler`
2. If result is `blocked: true` (CAPTCHA detected), retry through `proxyCrawler`
3. If proxy also blocked, mark as failed, alert admin

Estimated proxy cost savings: 70-90% compared to proxying all requests.

## Proxy Configuration

| Setting | Value |
|---|---|
| Provider | IPRoyal |
| Type | Residential, rotating |
| Gateway | `geo.iproyal.com:12321` |
| Country targeting | `_country-pl` suffix in password |
| URL format | `http://USER:PASS_country-pl@geo.iproyal.com:12321` |
| Pricing | $3.68/GB (1 GB), no expiry, no commitment |
| Estimated usage | 0.3–1 GB/month (with direct-first strategy) |
| Estimated cost | ~$1–4/month |

## Domain & SSL

No domain configured on day 1. Future subdomains (DNS A records → VPS IP, Coolify handles SSL via Let's Encrypt):

| Subdomain | Purpose | When |
|---|---|---|
| `bot.yourdomain.com` | Telegram webhook mode | Future |
| `admin.yourdomain.com` | Admin panel / monitoring | Future |
| `yourdomain.com` | Landing page | Future |

Coolify dashboard accessed exclusively via **Tailscale** (private IP), not exposed to the internet.

## Scaling Path (Future)

Coolify does not have autoscaling. Scaling options:

**Vertical (single server):** Upgrade Hetzner VPS to more RAM/CPU.

**Horizontal (multi-server):**
1. Add a second VPS to Coolify via SSH
2. Deploy additional `amazon-scraper` instance on Server 2
3. Both scrapers consume from the same `amazon-scrape` BullMQ queue (built-in work distribution)
4. Requires Docker Registry (GHCR or Docker Hub) for shared images
5. Bot-service and ceneo-service stay on Server 1

## Rollback Strategy

Coolify keeps previous Docker images per resource. On failed deploy:
- Click **"Rollback"** in Coolify UI to revert to previous image
- If a migration was applied, it cannot be auto-rolled back — hence the rule: never write destructive migrations

## Third-Party Services Checklist

| Service | Status | Action |
|---|---|---|
| Hetzner VPS | Done | Provisioned |
| Coolify | Done | Installed on dedicated instance |
| Tailscale | Setup needed | Install on VPS, join tailnet |
| Telegram bot | Done | Created via @BotFather |
| Amazon Associates | Setup needed | Register at partnerzy.amazon.pl |
| IPRoyal | Setup needed | Create account, buy 1 GB residential |
| GitHub App | Setup needed | Install Coolify's GitHub App on repo |
| Domain + DNS | Setup needed | Register domain, point A records at VPS IP |

## Code Changes Required

1. **Add auto-migration to bot-service startup** — run Drizzle `migrate()` before starting bot + workers in `index.ts`
2. **Two-crawler setup in amazon-scraper** — create `directCrawler` (no proxy) and `proxyCrawler` (with proxy), retry on block
3. **Add `.dockerignore`** — exclude `node_modules`, `.git`, `docs` to speed up builds
4. **Verify Dockerfile monorepo paths** — ensure `COPY` includes `packages/shared` and the service's own package from repo root
