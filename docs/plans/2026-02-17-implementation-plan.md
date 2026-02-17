# Liskobot (liskobot.pl) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Telegram-based Amazon.pl price tracker with scraping fallback chain, smart scheduling, and fan-out notifications.

**Architecture:** Monorepo with 3 Node.js/TypeScript services (bot-service, amazon-scraper, ceneo-service) sharing a Drizzle ORM schema, communicating via BullMQ job queues in PostgreSQL. Deployed as 4 Docker containers via Coolify.

**Tech Stack:** TypeScript, Node.js 22+, pnpm workspaces, Drizzle ORM, BullMQ, grammY, Crawlee (PlaywrightCrawler + CheerioCrawler), Impit, PostgreSQL 16, Docker

**Reference docs:**
- `docs/plans/2026-02-17-architecture-design.md` — approved architecture
- `docs/architecture.md` — system overview with diagrams
- `docs/scraper_design.md` — scraper deep-dive
- `docs/requirements.md` — functional requirements

---

## Phase 1: Project Foundation

### Task 1: Scaffold monorepo with pnpm workspaces

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/bot-service/package.json`
- Create: `packages/bot-service/tsconfig.json`
- Create: `packages/amazon-scraper/package.json`
- Create: `packages/amazon-scraper/tsconfig.json`
- Create: `packages/ceneo-service/package.json`
- Create: `packages/ceneo-service/tsconfig.json`

**Step 1: Create root package.json and workspace config**

```json
// package.json
{
  "name": "liskobot",
  "private": true,
  "scripts": {
    "db:generate": "pnpm --filter @liskobot/shared drizzle-kit generate",
    "db:migrate": "pnpm --filter @liskobot/shared drizzle-kit migrate",
    "dev:bot": "pnpm --filter @liskobot/bot-service dev",
    "dev:amazon": "pnpm --filter @liskobot/amazon-scraper dev",
    "dev:ceneo": "pnpm --filter @liskobot/ceneo-service dev"
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
```

**Step 2: Create base tsconfig**

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist"
  }
}
```

**Step 3: Create .gitignore and .env.example**

```gitignore
# .gitignore
node_modules/
dist/
.env
*.log
storage/
```

```env
# .env.example
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pricewatch
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ADMIN_CHAT_ID=your_chat_id
AMAZON_ASSOCIATE_TAG=your_tag
AMAZON_CREDENTIAL_ID=your_credential_id
AMAZON_CREDENTIAL_SECRET=your_credential_secret
PROXY_URL=http://user:pass@proxy:port
```

**Step 4: Create package scaffolds**

Each package gets a `package.json` and `tsconfig.json`. Use `@liskobot/` scope.

```json
// packages/shared/package.json
{
  "name": "@liskobot/shared",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "drizzle-orm": "latest",
    "BullMQ": "latest",
    "postgres": "latest"
  },
  "devDependencies": {
    "drizzle-kit": "latest",
    "typescript": "latest",
    "@types/node": "latest"
  }
}
```

```json
// packages/bot-service/package.json
{
  "name": "@liskobot/bot-service",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest"
  },
  "dependencies": {
    "@liskobot/shared": "workspace:*",
    "grammy": "latest",
    "BullMQ": "latest",
    "drizzle-orm": "latest",
    "postgres": "latest"
  },
  "devDependencies": {
    "tsx": "latest",
    "typescript": "latest",
    "vitest": "latest",
    "@types/node": "latest"
  }
}
```

```json
// packages/amazon-scraper/package.json
{
  "name": "@liskobot/amazon-scraper",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest"
  },
  "dependencies": {
    "@liskobot/shared": "workspace:*",
    "crawlee": "latest",
    "playwright": "latest",
    "playwright-extra": "latest",
    "puppeteer-extra-plugin-stealth": "latest",
    "BullMQ": "latest",
    "drizzle-orm": "latest",
    "postgres": "latest"
  },
  "devDependencies": {
    "tsx": "latest",
    "typescript": "latest",
    "vitest": "latest",
    "@types/node": "latest"
  }
}
```

```json
// packages/ceneo-service/package.json
{
  "name": "@liskobot/ceneo-service",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest"
  },
  "dependencies": {
    "@liskobot/shared": "workspace:*",
    "crawlee": "latest",
    "@crawlee/impit-client": "latest",
    "impit": "latest",
    "cheerio": "latest",
    "BullMQ": "latest",
    "drizzle-orm": "latest",
    "postgres": "latest"
  },
  "devDependencies": {
    "tsx": "latest",
    "typescript": "latest",
    "vitest": "latest",
    "@types/node": "latest"
  }
}
```

Each package gets a tsconfig extending the base:

```json
// packages/*/tsconfig.json (template)
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 5: Install dependencies and verify**

Run: `pnpm install`
Expected: Successful install with workspace symlinks

**Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .env.example packages/
git commit -m "feat: scaffold monorepo with pnpm workspaces"
```

---

### Task 2: Docker Compose for local development

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.dev.yml`

**Step 1: Create docker-compose.dev.yml for local Postgres**

```yaml
# docker-compose.dev.yml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: pricewatch
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

**Step 2: Start Postgres and verify**

Run: `docker compose -f docker-compose.dev.yml up -d`
Run: `docker compose -f docker-compose.dev.yml ps`
Expected: postgres service running, healthy

**Step 3: Commit**

```bash
git add docker-compose.dev.yml
git commit -m "feat: add docker-compose for local Postgres"
```

---

### Task 3: Database schema with Drizzle ORM

**Files:**
- Create: `packages/shared/src/db/schema.ts`
- Create: `packages/shared/src/db/index.ts`
- Create: `packages/shared/drizzle.config.ts`
- Create: `packages/shared/src/index.ts`

**Step 1: Define the Drizzle schema**

```typescript
// packages/shared/src/db/schema.ts
import { pgTable, text, numeric, boolean, bigint, uuid, timestamp, bigserial, index } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  asin: text('asin').primaryKey(),
  title: text('title').notNull(),
  currentPrice: numeric('current_price', { precision: 10, scale: 2 }),
  historicalLow: numeric('historical_low', { precision: 10, scale: 2 }),
  isInStock: boolean('is_in_stock').default(false),
  ceneoId: text('ceneo_id'),
  volatilityScore: numeric('volatility_score', { precision: 5, scale: 3 }).default('0'),
  subscriberCount: bigint('subscriber_count', { mode: 'number' }).default(0),
  lastScrapedAt: timestamp('last_scraped_at', { withTimezone: true }),
  nextCheckAt: timestamp('next_check_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const watches = pgTable('watches', {
  id: uuid('id').primaryKey().defaultRandom(),
  telegramChatId: bigint('telegram_chat_id', { mode: 'number' }).notNull(),
  asin: text('asin').references(() => products.asin).notNull(),
  targetPrice: numeric('target_price', { precision: 10, scale: 2 }),
  notifyHistoricalLow: boolean('notify_historical_low').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const priceHistory = pgTable('price_history', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  asin: text('asin').references(() => products.asin).notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  source: text('source').notNull(), // 'creators_api' | 'amazon_scraper' | 'ceneo'
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_price_history_asin_recorded').on(table.asin, table.recordedAt),
]);
```

**Step 2: Create DB connection helper**

```typescript
// packages/shared/src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export function createDb(connectionString: string) {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
```

**Step 3: Create Drizzle config**

```typescript
// packages/shared/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Step 4: Create shared package entry point**

```typescript
// packages/shared/src/index.ts
export * from './db/schema.js';
export * from './db/index.js';
export * from './queues.js';
export * from './types.js';
```

**Step 5: Generate and run migrations**

Run: `pnpm db:generate`
Expected: Migration SQL files created in `packages/shared/drizzle/`

Run: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pricewatch pnpm db:migrate`
Expected: Tables created in Postgres

**Step 6: Commit**

```bash
git add packages/shared/
git commit -m "feat: add Drizzle schema and migrations for products, watches, price_history"
```

---

### Task 4: Shared types and BullMQ queue definitions

**Files:**
- Create: `packages/shared/src/queues.ts`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/boss.ts`

**Step 1: Define queue names and job payload types**

```typescript
// packages/shared/src/queues.ts
export const QUEUES = {
  PRICE_CHECK: 'price-check',
  AMAZON_SCRAPE: 'amazon-scrape',
  PRICE_CHANGED: 'price-changed',
  CENEO_VERIFY: 'ceneo-verify',
  CENEO_RESULT: 'ceneo-result',
  NOTIFY_USER: 'notify-user',
} as const;
```

```typescript
// packages/shared/src/types.ts
export interface PriceCheckJob {
  asin: string;
}

export interface AmazonScrapeJob {
  asin: string;
  currentPrice: string | null; // previous price for drop detection
}

export interface PriceChangedJob {
  asin: string;
  oldPrice: string | null;
  newPrice: string;
  source: 'creators_api' | 'amazon_scraper' | 'ceneo';
  isInStock: boolean;
  unverified: boolean;
}

export interface CeneoVerifyJob {
  asin: string;
  title: string;
  expectedPrice: string;
  ceneoId: string | null;
  reason: 'anomalous_drop' | 'amazon_blocked';
}

export interface CeneoResultJob {
  asin: string;
  confirmed: boolean;
  ceneoPrice: string | null;
  ceneoId: string | null;
}

export interface NotifyUserJob {
  telegramChatId: number;
  message: string;
}
```

**Step 2: Create BullMQ factory**

```typescript
// packages/shared/src/boss.ts
import BullMQ from 'BullMQ';

export function createBoss(connectionString: string): BullMQ {
  return new BullMQ({
    connectionString,
    retryLimit: 3,
    retryDelay: 30, // seconds
    retryBackoff: true, // exponential
    expireInHours: 1,
    archiveCompletedAfterSeconds: 3600,
    deleteAfterDays: 7,
  });
}
```

**Step 3: Update shared entry point**

Add `export * from './boss.js';` to `packages/shared/src/index.ts`.

**Step 4: Build shared package to verify**

Run: `pnpm --filter @liskobot/shared build`
Expected: Compiles with no errors

**Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat: add BullMQ queue definitions and shared types"
```

---

## Phase 2: Bot Service

### Task 5: grammY bot setup with basic commands

**Files:**
- Create: `packages/bot-service/src/index.ts`
- Create: `packages/bot-service/src/bot.ts`
- Create: `packages/bot-service/src/config.ts`

**Step 1: Create config module**

```typescript
// packages/bot-service/src/config.ts
function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  telegramBotToken: required('TELEGRAM_BOT_TOKEN'),
  adminChatId: Number(required('TELEGRAM_ADMIN_CHAT_ID')),
  amazonAssociateTag: required('AMAZON_ASSOCIATE_TAG'),
};
```

**Step 2: Create bot with command handlers**

```typescript
// packages/bot-service/src/bot.ts
import { Bot, Context } from 'grammy';

export function createBot(token: string) {
  const bot = new Bot(token);

  bot.command('start', (ctx) =>
    ctx.reply('Send me an Amazon.pl product URL and I\'ll track the price for you.')
  );

  bot.command('list', (ctx) => ctx.reply('No watches yet.')); // placeholder
  bot.command('pause', (ctx) => ctx.reply('Not implemented yet.'));
  bot.command('stop', (ctx) => ctx.reply('Not implemented yet.'));
  bot.command('set', (ctx) => ctx.reply('Not implemented yet.'));

  return bot;
}
```

**Step 3: Create entry point**

```typescript
// packages/bot-service/src/index.ts
import { createBot } from './bot.js';
import { createDb, createBoss } from '@liskobot/shared';
import { config } from './config.js';

async function main() {
  const db = createDb(config.databaseUrl);
  const boss = createBoss(config.databaseUrl);
  await boss.start();

  const bot = createBot(config.telegramBotToken);
  await bot.start();

  console.log('Bot service started');
}

main().catch(console.error);
```

**Step 4: Test locally**

Create `.env` with a test bot token (get from @BotFather).
Run: `pnpm dev:bot`
Expected: "Bot service started" in console. Send `/start` to bot, get reply.

**Step 5: Commit**

```bash
git add packages/bot-service/
git commit -m "feat: scaffold bot-service with grammY and basic /start command"
```

---

### Task 6: ASIN extraction and product creation

**Files:**
- Create: `packages/bot-service/src/asin.ts`
- Create: `packages/bot-service/src/handlers/track.ts`
- Test: `packages/bot-service/src/__tests__/asin.test.ts`

**Step 1: Write failing test for ASIN extraction**

```typescript
// packages/bot-service/src/__tests__/asin.test.ts
import { describe, it, expect } from 'vitest';
import { extractAsin } from '../asin.js';

describe('extractAsin', () => {
  it('extracts ASIN from standard product URL', () => {
    expect(extractAsin('https://www.amazon.pl/dp/B0DEXAMPLE')).toBe('B0DEXAMPLE');
  });

  it('extracts ASIN from URL with title slug', () => {
    expect(extractAsin('https://www.amazon.pl/Some-Product-Name/dp/B0DEXAMPLE/ref=sr_1_1')).toBe('B0DEXAMPLE');
  });

  it('extracts ASIN from shortened URL', () => {
    expect(extractAsin('https://amazon.pl/dp/B0DEXAMPLE?tag=foo')).toBe('B0DEXAMPLE');
  });

  it('returns null for non-Amazon URLs', () => {
    expect(extractAsin('https://google.com')).toBeNull();
  });

  it('returns null for Amazon URLs without ASIN', () => {
    expect(extractAsin('https://www.amazon.pl/bestsellers')).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @liskobot/bot-service test`
Expected: FAIL — cannot find module '../asin.js'

**Step 3: Implement ASIN extraction**

```typescript
// packages/bot-service/src/asin.ts
const ASIN_REGEX = /amazon\.pl\/(?:.*\/)?dp\/([A-Z0-9]{10})/i;

export function extractAsin(url: string): string | null {
  const match = url.match(ASIN_REGEX);
  return match ? match[1].toUpperCase() : null;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @liskobot/bot-service test`
Expected: All 5 tests PASS

**Step 5: Implement track handler**

```typescript
// packages/bot-service/src/handlers/track.ts
import { Context } from 'grammy';
import { eq } from 'drizzle-orm';
import { Db, products, watches } from '@liskobot/shared';
import { extractAsin } from '../asin.js';

export function createTrackHandler(db: Db) {
  return async (ctx: Context) => {
    const text = ctx.message?.text;
    if (!text) return;

    const asin = extractAsin(text);
    if (!asin) return; // not an Amazon URL, ignore

    const chatId = ctx.chat?.id;
    if (!chatId) return;

    // Upsert product (title will be populated by scraper)
    const existing = await db.query.products.findFirst({
      where: eq(products.asin, asin),
    });

    if (!existing) {
      await db.insert(products).values({
        asin,
        title: `Product ${asin}`, // placeholder until scraped
        nextCheckAt: new Date(), // schedule immediate check
      });
    }

    // Check for existing watch
    const existingWatch = await db.query.watches.findFirst({
      where: (w, { and }) => and(
        eq(w.telegramChatId, chatId),
        eq(w.asin, asin),
      ),
    });

    if (existingWatch) {
      await ctx.reply(`You're already tracking this product (${asin}).`);
      return;
    }

    // Create watch
    await db.insert(watches).values({
      telegramChatId: chatId,
      asin,
    });

    // Update subscriber count
    await db.update(products)
      .set({ subscriberCount: (existing?.subscriberCount ?? 0) + 1 })
      .where(eq(products.asin, asin));

    await ctx.reply(
      `Tracking ${asin}! I'll notify you when the price drops.\n` +
      `Use /set ${asin} <price> to set a target price.`
    );
  };
}
```

**Step 6: Wire track handler into bot**

Update `packages/bot-service/src/bot.ts` — add `on('message:text')` handler that calls `createTrackHandler` when message contains an Amazon URL.

**Step 7: Commit**

```bash
git add packages/bot-service/
git commit -m "feat: add ASIN extraction and product tracking via URL paste"
```

---

### Task 7: Watch management commands (/list, /pause, /stop, /set)

**Files:**
- Create: `packages/bot-service/src/handlers/list.ts`
- Create: `packages/bot-service/src/handlers/pause.ts`
- Create: `packages/bot-service/src/handlers/stop.ts`
- Create: `packages/bot-service/src/handlers/set.ts`

**Step 1: Implement /list handler**

```typescript
// packages/bot-service/src/handlers/list.ts
import { Context } from 'grammy';
import { eq } from 'drizzle-orm';
import { Db, watches, products } from '@liskobot/shared';

export function createListHandler(db: Db) {
  return async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const userWatches = await db
      .select({
        asin: watches.asin,
        targetPrice: watches.targetPrice,
        isActive: watches.isActive,
        title: products.title,
        currentPrice: products.currentPrice,
      })
      .from(watches)
      .innerJoin(products, eq(watches.asin, products.asin))
      .where(eq(watches.telegramChatId, chatId));

    if (userWatches.length === 0) {
      await ctx.reply('No active watches. Send an Amazon.pl URL to start tracking.');
      return;
    }

    const lines = userWatches.map((w) => {
      const status = w.isActive ? '' : ' (paused)';
      const price = w.currentPrice ? `${w.currentPrice} PLN` : 'checking...';
      const target = w.targetPrice ? ` | target: ${w.targetPrice} PLN` : '';
      return `${w.asin}: ${w.title}\n  ${price}${target}${status}`;
    });

    await ctx.reply(`Your watches:\n\n${lines.join('\n\n')}`);
  };
}
```

**Step 2: Implement /pause, /stop, /set handlers**

Each follows the pattern: parse ASIN from command args, find watch, update DB, reply.

```typescript
// packages/bot-service/src/handlers/pause.ts
import { Context } from 'grammy';
import { eq, and } from 'drizzle-orm';
import { Db, watches } from '@liskobot/shared';

export function createPauseHandler(db: Db) {
  return async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    const asin = ctx.match as string | undefined;
    if (!chatId || !asin) {
      await ctx.reply('Usage: /pause <ASIN>');
      return;
    }

    const result = await db.update(watches)
      .set({ isActive: false })
      .where(and(eq(watches.telegramChatId, chatId), eq(watches.asin, asin.toUpperCase())));

    await ctx.reply(`Paused tracking for ${asin.toUpperCase()}.`);
  };
}
```

`/stop` is similar but deletes the watch and decrements `subscriber_count`.
`/set` parses price from args and updates `target_price`.

**Step 3: Wire all handlers into bot.ts**

**Step 4: Test manually via Telegram**

**Step 5: Commit**

```bash
git add packages/bot-service/
git commit -m "feat: add /list, /pause, /stop, /set watch management commands"
```

---

## Phase 3: Amazon Scraper

### Task 8: Scaffold Crawlee PlaywrightCrawler

**Files:**
- Create: `packages/amazon-scraper/src/index.ts`
- Create: `packages/amazon-scraper/src/config.ts`
- Create: `packages/amazon-scraper/src/crawler.ts`

**Step 1: Create config**

```typescript
// packages/amazon-scraper/src/config.ts
function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  proxyUrl: process.env.PROXY_URL || undefined,
};
```

**Step 2: Create the PlaywrightCrawler**

```typescript
// packages/amazon-scraper/src/crawler.ts
import { PlaywrightCrawler, ProxyConfiguration, createPlaywrightRouter } from 'crawlee';

export function createAmazonCrawler(proxyUrl?: string) {
  const proxyConfiguration = proxyUrl
    ? new ProxyConfiguration({ proxyUrls: [proxyUrl] })
    : undefined;

  const router = createPlaywrightRouter();

  router.addDefaultHandler(async ({ page, request, log }) => {
    // Block non-essential resources
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    log.info(`Scraping ${request.url}`);

    // Check for CAPTCHA / block
    const blocked = await page.$('form[action="/errors/validateCaptcha"]');
    if (blocked) {
      request.userData.blocked = true;
      log.warning(`Blocked on ${request.url}`);
      return;
    }

    // Extract price
    // .a-price-whole returns "1 171," (with non-breaking space + trailing comma)
    const wholePrice = await page.$eval('.a-price-whole', (el) => el.textContent?.trim()).catch(() => null);
    const fractionPrice = await page.$eval('.a-price-fraction', (el) => el.textContent?.trim()).catch(() => null);

    let price: string | null = null;
    if (wholePrice) {
      const whole = wholePrice.replace(/[\s,.\u00A0]/g, ''); // strip spaces, commas, dots, NBSP
      const fraction = fractionPrice?.replace(/[\s,.\u00A0]/g, '') || '00';
      price = `${whole}.${fraction}`;
    }

    // Extract stock status
    // Do NOT rely on #availability text — unreliable (contains JS on some pages)
    // Instead check for buy box buttons
    const hasAddToCart = await page.$('#add-to-cart-button') !== null;
    const hasBuyNow = await page.$('#buy-now-button') !== null;
    const hasAllOptions = await page.$('#buybox-see-all-buying-choices') !== null;
    const isInStock = hasAddToCart || hasBuyNow;
    // hasAllOptions && !isInStock = third-party only (no direct Amazon buy box)

    // Extract title
    const title = await page.$eval('#productTitle', (el) => el.textContent?.trim()).catch(() => null);

    request.userData.result = { price, isInStock, title };
  });

  const crawler = new PlaywrightCrawler({
    requestHandler: router,
    proxyConfiguration,
    maxConcurrency: 1,
    useSessionPool: true,
    sessionPoolOptions: { maxPoolSize: 10 },
    maxRequestRetries: 2,
    requestHandlerTimeoutSecs: 30,
    headless: true,
    launchContext: {
      useChrome: false,
      launchOptions: {
        args: ['--disable-blink-features=AutomationControlled'],
      },
    },
  });

  return { crawler, router };
}
```

**Step 3: Create entry point with BullMQ worker**

```typescript
// packages/amazon-scraper/src/index.ts
import { createDb, createBoss, QUEUES } from '@liskobot/shared';
import type { AmazonScrapeJob, PriceChangedJob, CeneoVerifyJob } from '@liskobot/shared';
import { config } from './config.js';
import { createAmazonCrawler } from './crawler.js';
import { eq } from 'drizzle-orm';
import { products, priceHistory } from '@liskobot/shared';

async function main() {
  const db = createDb(config.databaseUrl);
  const boss = createBoss(config.databaseUrl);
  await boss.start();

  const { crawler } = createAmazonCrawler(config.proxyUrl);

  await boss.work<AmazonScrapeJob>(QUEUES.AMAZON_SCRAPE, async ([job]) => {
    const { asin, currentPrice } = job.data;
    const url = `https://www.amazon.pl/dp/${asin}`;

    // Run crawl for single URL
    await crawler.run([{ url, userData: { asin } }]);

    // Get result from crawler's dataset (simplified — extract from request userData)
    // In practice, use crawler events or dataset to get results
    // This is a simplified version; actual implementation will use Crawlee's dataset

    // ... process result, detect drops, enqueue jobs
  });

  console.log('Amazon scraper started');
}

main().catch(console.error);
```

**Note:** The actual BullMQ ↔ Crawlee integration needs refinement. The worker receives a job, runs a single-URL crawl, reads the result, then decides what to enqueue next. The implementation engineer should use Crawlee's `RequestQueue` and `Dataset` APIs to handle this cleanly.

**Step 4: Verify it compiles**

Run: `pnpm --filter @liskobot/amazon-scraper build`
Expected: Compiles with no errors

**Step 5: Commit**

```bash
git add packages/amazon-scraper/
git commit -m "feat: scaffold amazon-scraper with Crawlee PlaywrightCrawler"
```

---

### Task 9: Price change detection and job production

**Files:**
- Modify: `packages/amazon-scraper/src/index.ts`
- Create: `packages/amazon-scraper/src/price-processor.ts`
- Test: `packages/amazon-scraper/src/__tests__/price-processor.test.ts`

**Step 1: Write failing test for price drop detection**

```typescript
// packages/amazon-scraper/src/__tests__/price-processor.test.ts
import { describe, it, expect } from 'vitest';
import { analyzePriceChange } from '../price-processor.js';

describe('analyzePriceChange', () => {
  it('detects normal price drop', () => {
    const result = analyzePriceChange('199.00', '149.00', '140.00');
    expect(result.type).toBe('normal_drop');
    expect(result.dropPercent).toBeCloseTo(25.13, 1);
    expect(result.isHistoricalLow).toBe(false);
  });

  it('detects anomalous drop (>30%)', () => {
    const result = analyzePriceChange('199.00', '99.00', '140.00');
    expect(result.type).toBe('anomalous_drop');
    expect(result.dropPercent).toBeCloseTo(50.25, 1);
  });

  it('detects new historical low', () => {
    const result = analyzePriceChange('199.00', '130.00', '140.00');
    expect(result.isHistoricalLow).toBe(true);
  });

  it('detects no change', () => {
    const result = analyzePriceChange('199.00', '199.00', '140.00');
    expect(result.type).toBe('no_change');
  });

  it('detects price increase', () => {
    const result = analyzePriceChange('199.00', '249.00', '140.00');
    expect(result.type).toBe('price_increase');
  });

  it('handles null previous price (first scrape)', () => {
    const result = analyzePriceChange(null, '199.00', null);
    expect(result.type).toBe('first_price');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @liskobot/amazon-scraper test`
Expected: FAIL

**Step 3: Implement price processor**

```typescript
// packages/amazon-scraper/src/price-processor.ts
export type PriceChangeType =
  | 'no_change'
  | 'normal_drop'
  | 'anomalous_drop'
  | 'price_increase'
  | 'first_price';

export interface PriceChangeResult {
  type: PriceChangeType;
  dropPercent: number;
  isHistoricalLow: boolean;
}

const ANOMALOUS_THRESHOLD = 30; // percent

export function analyzePriceChange(
  oldPrice: string | null,
  newPrice: string,
  historicalLow: string | null,
): PriceChangeResult {
  if (oldPrice === null) {
    return { type: 'first_price', dropPercent: 0, isHistoricalLow: historicalLow === null };
  }

  const oldNum = parseFloat(oldPrice);
  const newNum = parseFloat(newPrice);
  const lowNum = historicalLow ? parseFloat(historicalLow) : Infinity;

  if (newNum >= oldNum) {
    return {
      type: newNum === oldNum ? 'no_change' : 'price_increase',
      dropPercent: 0,
      isHistoricalLow: newNum < lowNum,
    };
  }

  const dropPercent = ((oldNum - newNum) / oldNum) * 100;
  const isHistoricalLow = newNum < lowNum;
  const type = dropPercent > ANOMALOUS_THRESHOLD ? 'anomalous_drop' : 'normal_drop';

  return { type, dropPercent, isHistoricalLow };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @liskobot/amazon-scraper test`
Expected: All 6 tests PASS

**Step 5: Integrate into BullMQ worker**

Update `packages/amazon-scraper/src/index.ts` to use `analyzePriceChange` and enqueue appropriate jobs:
- `price-changed` on any price change
- `ceneo-verify` on anomalous drops (>30%)
- Write price to `products` and `price_history` tables

**Step 6: Commit**

```bash
git add packages/amazon-scraper/
git commit -m "feat: add price change detection with anomalous drop handling"
```

---

## Phase 4: Ceneo Service

### Task 10: Scaffold Crawlee CheerioCrawler with Impit

**Files:**
- Create: `packages/ceneo-service/src/index.ts`
- Create: `packages/ceneo-service/src/config.ts`
- Create: `packages/ceneo-service/src/crawler.ts`

**Step 1: Create the CheerioCrawler with Impit**

```typescript
// packages/ceneo-service/src/crawler.ts
import { CheerioCrawler, createCheerioRouter } from 'crawlee';
import { ImpitHttpClient } from '@crawlee/impit-client';

export function createCeneoCrawler() {
  const router = createCheerioRouter();

  router.addDefaultHandler(async ({ $, request, log }) => {
    log.info(`Checking Ceneo: ${request.url}`);

    // Find Amazon.pl offer (shop ID 42774)
    const amazonOffer = $('[data-shopurl*="amazon.pl"], [data-shop-id="42774"]');

    if (amazonOffer.length === 0) {
      // Try finding by shop name text
      const allOffers = $('.product-offers .product-offer');
      let found = false;

      allOffers.each((_, el) => {
        const shopName = $(el).find('.product-offer__store__name, .js_store-name').text().trim().toLowerCase();
        if (shopName.includes('amazon')) {
          const priceText = $(el).find('.product-offer__price .price-format').text().trim();
          const price = priceText.replace(/[^\d,]/g, '').replace(',', '.');
          request.userData.ceneoPrice = price;
          request.userData.amazonFound = true;
          found = true;
          return false; // break
        }
      });

      if (!found) {
        request.userData.amazonFound = false;
      }
    } else {
      const priceText = amazonOffer.closest('.product-offer').find('.price-format').text().trim();
      const price = priceText.replace(/[^\d,]/g, '').replace(',', '.');
      request.userData.ceneoPrice = price;
      request.userData.amazonFound = true;
    }
  });

  const crawler = new CheerioCrawler({
    requestHandler: router,
    httpClient: new ImpitHttpClient({ browser: 'firefox' }),
    maxConcurrency: 3,
    maxRequestRetries: 2,
    requestHandlerTimeoutSecs: 15,
  });

  return { crawler, router };
}
```

**Note:** The Ceneo HTML selectors above are approximations based on our earlier research. The implementation engineer MUST verify actual selectors by inspecting `https://www.ceneo.pl/180784185` in a browser. Key things to verify:
- How Amazon.pl shop is identified in the DOM (shop ID, data attributes, or logo path)
- How prices are formatted in offer elements
- The search URL format for title-based lookups

**Step 2: Create entry point with BullMQ worker**

```typescript
// packages/ceneo-service/src/index.ts
import { createDb, createBoss, QUEUES } from '@liskobot/shared';
import type { CeneoVerifyJob, CeneoResultJob } from '@liskobot/shared';
import { config } from './config.js';
import { createCeneoCrawler } from './crawler.js';
import { eq } from 'drizzle-orm';
import { products } from '@liskobot/shared';

async function main() {
  const db = createDb(config.databaseUrl);
  const boss = createBoss(config.databaseUrl);
  await boss.start();

  const { crawler } = createCeneoCrawler();

  await boss.work<CeneoVerifyJob>(QUEUES.CENEO_VERIFY, async ([job]) => {
    const { asin, title, expectedPrice, ceneoId, reason } = job.data;

    // Determine URL: use cached ceneoId or search by title
    let url: string;
    if (ceneoId) {
      url = `https://www.ceneo.pl/${ceneoId}`;
    } else {
      const searchQuery = encodeURIComponent(title);
      url = `https://www.ceneo.pl/szukaj-${searchQuery}`;
      // TODO: Handle search results page — find product, extract ceneoId, then fetch product page
    }

    await crawler.run([{ url, userData: { asin, expectedPrice } }]);

    // Read result from crawler userData
    // ... extract amazonFound, ceneoPrice

    // Enqueue result
    await boss.send<CeneoResultJob>(QUEUES.CENEO_RESULT, {
      asin,
      confirmed: false, // determined by comparing prices
      ceneoPrice: null,
      ceneoId: null,
    });
  });

  console.log('Ceneo service started');
}

main().catch(console.error);
```

**Step 3: Verify it compiles**

Run: `pnpm --filter @liskobot/ceneo-service build`
Expected: Compiles with no errors

**Step 4: Commit**

```bash
git add packages/ceneo-service/
git commit -m "feat: scaffold ceneo-service with CheerioCrawler + Impit"
```

---

### Task 11: ASIN-to-Ceneo title search mapping

**Files:**
- Create: `packages/ceneo-service/src/search.ts`
- Test: `packages/ceneo-service/src/__tests__/search.test.ts`

**Step 1: Implement Ceneo search handler**

Add a search route to the crawler that handles `ceneo.pl/szukaj-*` URLs — parses the search results page, finds the best-matching product, and extracts the Ceneo product ID.

**Step 2: Write test for URL construction**

```typescript
// packages/ceneo-service/src/__tests__/search.test.ts
import { describe, it, expect } from 'vitest';
import { buildCeneoSearchUrl, parseCeneoIdFromUrl } from '../search.js';

describe('buildCeneoSearchUrl', () => {
  it('builds search URL from product title', () => {
    const url = buildCeneoSearchUrl('Sony WH-1000XM5 Headphones');
    expect(url).toBe('https://www.ceneo.pl/szukaj-Sony+WH-1000XM5+Headphones');
  });
});

describe('parseCeneoIdFromUrl', () => {
  it('extracts Ceneo product ID from product URL', () => {
    expect(parseCeneoIdFromUrl('https://www.ceneo.pl/180784185')).toBe('180784185');
  });

  it('returns null for non-product URLs', () => {
    expect(parseCeneoIdFromUrl('https://www.ceneo.pl/szukaj-test')).toBeNull();
  });
});
```

**Step 3: Implement search helpers**

```typescript
// packages/ceneo-service/src/search.ts
export function buildCeneoSearchUrl(title: string): string {
  const query = title.replace(/\s+/g, '+');
  return `https://www.ceneo.pl/szukaj-${query}`;
}

export function parseCeneoIdFromUrl(url: string): string | null {
  const match = url.match(/ceneo\.pl\/(\d+)/);
  return match ? match[1] : null;
}
```

**Step 4: Run tests**

Run: `pnpm --filter @liskobot/ceneo-service test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/ceneo-service/
git commit -m "feat: add Ceneo search URL builder and ID parser"
```

---

## Phase 5: Smart Scheduler & Orchestration

### Task 12: Smart scheduler with priority-based polling

**Files:**
- Create: `packages/bot-service/src/scheduler.ts`
- Test: `packages/bot-service/src/__tests__/scheduler.test.ts`

**Step 1: Write failing test for interval calculation**

```typescript
// packages/bot-service/src/__tests__/scheduler.test.ts
import { describe, it, expect } from 'vitest';
import { calculateNextCheckInterval, calculatePriority } from '../scheduler.js';

describe('calculateNextCheckInterval', () => {
  it('returns 24h for cheap items (<30 PLN)', () => {
    expect(calculateNextCheckInterval({ price: 25, subscriberCount: 50, volatilityScore: 0.5 }))
      .toBe(24 * 60); // minutes
  });

  it('returns 15min floor for hot items (>100 subs)', () => {
    expect(calculateNextCheckInterval({ price: 200, subscriberCount: 150, volatilityScore: 0.5 }))
      .toBe(15);
  });

  it('returns 30min for volatile items', () => {
    expect(calculateNextCheckInterval({ price: 200, subscriberCount: 10, volatilityScore: 0.9 }))
      .toBe(30);
  });

  it('returns 4h default for normal items', () => {
    expect(calculateNextCheckInterval({ price: 200, subscriberCount: 5, volatilityScore: 0.3 }))
      .toBe(240);
  });
});

describe('calculatePriority', () => {
  it('higher subscribers = higher priority', () => {
    const low = calculatePriority(5, 0.5);
    const high = calculatePriority(500, 0.5);
    expect(high).toBeGreaterThan(low);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @liskobot/bot-service test`
Expected: FAIL

**Step 3: Implement scheduler logic**

```typescript
// packages/bot-service/src/scheduler.ts
import BullMQ from 'BullMQ';
import { Db, products, QUEUES } from '@liskobot/shared';
import type { PriceCheckJob } from '@liskobot/shared';
import { lte, asc } from 'drizzle-orm';

interface SchedulerInput {
  price: number;
  subscriberCount: number;
  volatilityScore: number;
}

export function calculatePriority(subscriberCount: number, volatilityScore: number): number {
  return Math.log10(subscriberCount + 1) * (volatilityScore + 0.1);
}

export function calculateNextCheckInterval(input: SchedulerInput): number {
  const { price, subscriberCount, volatilityScore } = input;

  // Low value rule: max 24h for items under 30 PLN
  if (price < 30) return 24 * 60;

  // Hot item floor: 15min for 100+ subscribers
  if (subscriberCount > 100) return 15;

  // High volatility: 30min
  if (volatilityScore > 0.8) return 30;

  // Default: 4 hours
  return 240;
}

export function registerScheduler(boss: BullMQ, db: Db) {
  // Register cron: every minute, dispatch due price checks
  boss.schedule(QUEUES.PRICE_CHECK, '* * * * *');

  boss.work(QUEUES.PRICE_CHECK, async () => {
    const dueProducts = await db
      .select()
      .from(products)
      .where(lte(products.nextCheckAt, new Date()))
      .orderBy(asc(products.nextCheckAt))
      .limit(50);

    for (const product of dueProducts) {
      await boss.send<PriceCheckJob>(QUEUES.AMAZON_SCRAPE, {
        asin: product.asin,
        currentPrice: product.currentPrice,
      });
    }
  });
}
```

**Step 4: Run tests**

Run: `pnpm --filter @liskobot/bot-service test`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/bot-service/
git commit -m "feat: add smart scheduler with priority-based polling intervals"
```

---

### Task 13: Price-changed handler and notification orchestration

**Files:**
- Create: `packages/bot-service/src/handlers/price-changed.ts`
- Create: `packages/bot-service/src/handlers/ceneo-result.ts`
- Create: `packages/bot-service/src/notifications.ts`

**Step 1: Implement price-changed handler**

This is the core orchestration logic in bot-service. When `price-changed` arrives:
1. Query all active watches for that ASIN
2. For each watch with matching criteria (target price met, historical low), enqueue `notify-user`
3. If `unverified: true`, add caveat to message and ping admin
4. Recalculate `next_check_at` based on scheduler rules

```typescript
// packages/bot-service/src/handlers/price-changed.ts
import BullMQ from 'BullMQ';
import { eq, and } from 'drizzle-orm';
import { Db, watches, products, QUEUES } from '@liskobot/shared';
import type { PriceChangedJob, NotifyUserJob } from '@liskobot/shared';
import { formatPriceAlert, formatAdminAlert } from '../notifications.js';
import { config } from '../config.js';

export function registerPriceChangedHandler(boss: BullMQ, db: Db) {
  boss.work<PriceChangedJob>(QUEUES.PRICE_CHANGED, async ([job]) => {
    const { asin, oldPrice, newPrice, unverified, isInStock } = job.data;

    // Get all active watches for this ASIN
    const activeWatches = await db
      .select()
      .from(watches)
      .where(and(eq(watches.asin, asin), eq(watches.isActive, true)));

    const product = await db.query.products.findFirst({
      where: eq(products.asin, asin),
    });

    if (!product) return;

    for (const watch of activeWatches) {
      const targetMet = watch.targetPrice && parseFloat(newPrice) <= parseFloat(watch.targetPrice);
      const isHistLow = product.historicalLow && parseFloat(newPrice) < parseFloat(product.historicalLow);
      const priceDrop = oldPrice && parseFloat(newPrice) < parseFloat(oldPrice);

      if (targetMet || (isHistLow && watch.notifyHistoricalLow) || priceDrop) {
        const message = formatPriceAlert({
          title: product.title,
          asin,
          oldPrice,
          newPrice,
          isHistoricalLow: !!isHistLow,
          unverified,
          associateTag: config.amazonAssociateTag,
        });

        await boss.send<NotifyUserJob>(QUEUES.NOTIFY_USER, {
          telegramChatId: watch.telegramChatId,
          message,
        });
      }
    }

    // Notify admin on unverified drops
    if (unverified) {
      await boss.send<NotifyUserJob>(QUEUES.NOTIFY_USER, {
        telegramChatId: config.adminChatId,
        message: formatAdminAlert(asin, product.title, oldPrice, newPrice, 'anomalous_drop'),
      });
    }
  });
}
```

**Step 2: Implement notification message formatter**

```typescript
// packages/bot-service/src/notifications.ts
interface PriceAlertInput {
  title: string;
  asin: string;
  oldPrice: string | null;
  newPrice: string;
  isHistoricalLow: boolean;
  unverified: boolean;
  associateTag: string;
}

export function formatPriceAlert(input: PriceAlertInput): string {
  const { title, asin, oldPrice, newPrice, isHistoricalLow, unverified, associateTag } = input;
  const link = `https://www.amazon.pl/dp/${asin}?tag=${associateTag}`;

  let prefix = '';
  if (unverified) prefix = 'Unverified price drop - confirming...\n\n';

  let body = '';
  if (oldPrice) {
    const drop = (((parseFloat(oldPrice) - parseFloat(newPrice)) / parseFloat(oldPrice)) * 100).toFixed(0);
    body = `${title}\n${oldPrice} PLN → ${newPrice} PLN (-${drop}%)`;
  } else {
    body = `${title}\nPrice: ${newPrice} PLN`;
  }

  if (isHistoricalLow) {
    body += '\nNew all-time low!';
  }

  const disclosure = '\n\nAs an Amazon Associate, I earn from qualifying purchases.';

  return `${prefix}${body}\n\n[Buy on Amazon.pl](${link})${disclosure}`;
}

export function formatAdminAlert(
  asin: string,
  title: string,
  oldPrice: string | null,
  newPrice: string,
  reason: 'anomalous_drop' | 'amazon_blocked',
): string {
  if (reason === 'anomalous_drop') {
    return `REVIEW: Anomalous drop on ${asin}\n${title}\n${oldPrice} → ${newPrice} PLN\nhttps://www.amazon.pl/dp/${asin}`;
  }
  return `ALERT: Amazon blocked for ${asin}\n${title}\nhttps://www.amazon.pl/dp/${asin}`;
}
```

**Step 3: Implement ceneo-result handler**

```typescript
// packages/bot-service/src/handlers/ceneo-result.ts
// When Ceneo verification comes back:
// - If confirmed: update product, send "Price verified" follow-up
// - If not confirmed: notify admin only
```

**Step 4: Implement notify-user worker**

Consumes `notify-user` jobs and sends Telegram messages via grammY's `bot.api.sendMessage()`. Respects Telegram rate limits (~30 msg/sec).

**Step 5: Commit**

```bash
git add packages/bot-service/
git commit -m "feat: add price-changed handler, notification formatting, and fan-out"
```

---

## Phase 6: Deployment

### Task 14: Dockerfiles for each service

**Files:**
- Create: `packages/bot-service/Dockerfile`
- Create: `packages/amazon-scraper/Dockerfile`
- Create: `packages/ceneo-service/Dockerfile`
- Create: `docker-compose.yml`

**Step 1: Create bot-service Dockerfile**

```dockerfile
# packages/bot-service/Dockerfile
FROM node:22-alpine AS builder
RUN corepack enable pnpm

WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/bot-service/package.json packages/bot-service/
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/bot-service/ packages/bot-service/
RUN pnpm --filter @liskobot/shared build && pnpm --filter @liskobot/bot-service build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/packages/bot-service/dist ./dist
COPY --from=builder /app/packages/bot-service/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./node_modules/@liskobot/shared/dist

HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
```

**Step 2: Create amazon-scraper Dockerfile**

Similar to bot-service but based on `mcr.microsoft.com/playwright:v1.50.0-noble` (includes Chromium). Must install Playwright browsers.

```dockerfile
# packages/amazon-scraper/Dockerfile
FROM mcr.microsoft.com/playwright:v1.50.0-noble AS builder
RUN corepack enable pnpm
# ... build steps same pattern ...

FROM mcr.microsoft.com/playwright:v1.50.0-noble
# ... copy dist, node_modules ...
CMD ["node", "dist/index.js"]
```

**Step 3: Create ceneo-service Dockerfile**

Same as bot-service (Alpine-based, no Playwright needed).

**Step 4: Create production docker-compose.yml**

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    mem_limit: 512m
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: pricewatch
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  bot-service:
    build:
      context: .
      dockerfile: packages/bot-service/Dockerfile
    mem_limit: 512m
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/pricewatch
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      TELEGRAM_ADMIN_CHAT_ID: ${TELEGRAM_ADMIN_CHAT_ID}
      AMAZON_ASSOCIATE_TAG: ${AMAZON_ASSOCIATE_TAG}

  amazon-scraper:
    build:
      context: .
      dockerfile: packages/amazon-scraper/Dockerfile
    mem_limit: 2g
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/pricewatch
      PROXY_URL: ${PROXY_URL}

  ceneo-service:
    build:
      context: .
      dockerfile: packages/ceneo-service/Dockerfile
    mem_limit: 256m
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/pricewatch

volumes:
  pgdata:
```

**Step 5: Test local build**

Run: `docker compose build`
Expected: All 4 images build successfully

**Step 6: Commit**

```bash
git add packages/*/Dockerfile docker-compose.yml
git commit -m "feat: add Dockerfiles and production docker-compose"
```

---

### Task 15: Health check endpoints

**Files:**
- Modify: `packages/bot-service/src/index.ts`
- Modify: `packages/amazon-scraper/src/index.ts`
- Modify: `packages/ceneo-service/src/index.ts`

**Step 1: Add minimal HTTP health check to each service**

Use Node.js built-in `http.createServer` (no Express needed) on port 3000:

```typescript
import { createServer } from 'node:http';

createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('ok');
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(3000);
```

**Step 2: Verify health checks work in Docker**

Run: `docker compose up -d && sleep 5 && docker compose ps`
Expected: All services healthy

**Step 3: Commit**

```bash
git add packages/*/src/index.ts
git commit -m "feat: add /health endpoints for Coolify restart policies"
```

---

## Implementation Notes

### Things the implementation engineer must verify:

1. **Ceneo HTML selectors** — The selectors in Task 10 are approximations. Before implementing, inspect `https://www.ceneo.pl/180784185` in a browser and verify:
   - How Amazon.pl shop is identified (shop ID, data attributes, logo path with ID 42774)
   - How prices are structured in offer elements
   - The search results page structure for title-based lookups

2. **Crawlee ↔ BullMQ integration** — Tasks 8 and 10 show simplified integration. The actual pattern is: BullMQ worker receives job → constructs Crawlee `Request` → runs single-URL crawl → reads result from `request.userData` → processes and enqueues next job. Test this integration carefully.

3. **Playwright stealth setup** — The `playwright-extra` + `puppeteer-extra-plugin-stealth` combo needs to be verified with the Crawlee PlaywrightCrawler. Check Crawlee docs for the recommended way to integrate stealth plugins.

4. **BullMQ cron + schedule** — The scheduler uses `boss.schedule()` for cron and `boss.work()` for handlers. Verify that BullMQ v10+ supports this pattern (API changed between major versions).

5. **Drizzle migration workflow** — After generating migrations, verify they apply cleanly to a fresh Postgres. Run `pnpm db:generate && pnpm db:migrate` on a clean database.

### Dependency versions to pin:

Before starting, check Context7 or npm for current stable versions:
- `crawlee` — check for PlaywrightCrawler + Impit compatibility
- `BullMQ` — ensure Node 22+ support (docs say 22.12+)
- `grammy` — latest stable
- `drizzle-orm` + `drizzle-kit` — latest stable
- `impit` / `@crawlee/impit-client` — latest

### What's NOT in this plan (future work):

- Amazon Creators API integration (blocked until 10-sale threshold)
- Volatility score calculation (needs price history data first)
- Deal-Caster broadcast channels
- Community outreach automation
- Price history graph generation
- Coolify-specific deployment configuration (depends on Coolify version/UI)
