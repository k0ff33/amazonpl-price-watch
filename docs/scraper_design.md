# Scraper Engine: Deep-Dive Design

## 1. Amazon Scraper Service

### Technical Stack
- **Framework:** Crawlee (`PlaywrightCrawler`)
- **Engine:** Playwright (Chromium) + `playwright-extra` + `puppeteer-extra-plugin-stealth`
- **Proxy Provider:** IPRoyal or Scrapeless (Residential Pay-As-You-Go)
- **Proxy/Session Management:** Crawlee built-in `ProxyConfiguration` + `SessionPool`
- **Resource Blocking:** Images, CSS, Fonts, Ads blocked (~150KB per page load)
- **Container:** Dedicated Coolify service, `mem_limit: 2GB`

### Scraping Workflow

```mermaid
flowchart TD
    Job[amazon-scrape job from pg-boss] --> Launch[Launch Playwright<br/>headless + stealth]
    Launch --> Navigate["Navigate to amazon.pl/dp/{ASIN}"]
    Navigate --> Check{CAPTCHA or 403?}
    Check -->|Yes| Blocked[Mark job failed<br/>Enqueue ceneo-verify<br/>Alert admin]
    Check -->|No| Extract[Extract data]
    Extract --> Price[".a-price-whole + .a-price-fraction"]
    Extract --> Stock["#availability<br/>W magazynie / Niedostepny"]
    Extract --> Coupon["Zastosuj kupon selector"]
    Price --> Drop{Drop > 30%?}
    Drop -->|Yes| DoubleCheck[Second scrape<br/>fresh IP/context]
    DoubleCheck --> Confirm{Same price?}
    Confirm -->|Yes| WriteUnverified[Write to DB as unverified<br/>Enqueue ceneo-verify<br/>Enqueue price-changed<br/>Alert admin]
    Confirm -->|No| Discard[Discard anomalous reading]
    Drop -->|No| Write[Write to DB<br/>Enqueue price-changed]
```

### Configuration
- **Concurrency:** 1 browser instance, sequential scrapes in fresh incognito contexts
- **Headers:** `Accept-Language: pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7`
- **Crawlee SessionPool:** Auto-retires blocked proxies, rotates IPs per session
- **Crawlee retries:** 3 attempts with backoff before marking job as failed

### Failure Handling
- pg-boss handles retry logic: 3 attempts with exponential backoff
- After 3 failures: job moves to dead letter queue + admin Telegram alert
- Hourly success rate tracked. Alert if <85%

## 2. Ceneo Verification Service

### Technical Stack
- **Framework:** Crawlee (`CheerioCrawler`)
- **HTTP Client:** Impit (`@crawlee/impit-client`) for browser-grade TLS fingerprinting
- **No Playwright/Chromium required** - Ceneo renders prices server-side
- **Container:** Dedicated Coolify service, `mem_limit: 256MB`

### Verification Workflow

```mermaid
flowchart TD
    Job[ceneo-verify job from pg-boss] --> HasMapping{ceneo_id cached?}
    HasMapping -->|No| Search["Search Ceneo by product title<br/>GET ceneo.pl/szukaj-{title}"]
    Search --> Match[Match best result<br/>Cache ceneo_id in products table]
    HasMapping -->|Yes| Fetch["GET ceneo.pl/{ceneo_id}"]
    Match --> Fetch
    Fetch --> FindAmazon{"Amazon.pl listed?<br/>(shop ID: 42774)"}
    FindAmazon -->|No| NotListed[Enqueue ceneo-result<br/>confirmed: false]
    FindAmazon -->|Yes| Compare{Amazon price matches<br/>scraped price?}
    Compare -->|Yes| Confirmed[Enqueue ceneo-result<br/>confirmed: true]
    Compare -->|No| Mismatch[Enqueue ceneo-result<br/>confirmed: false<br/>include ceneo_price]
```

### Ceneo Data Points
- **Price:** Direct text in HTML (server-rendered)
- **Shop identification:** Shop ID `42774` = Amazon.pl
- **Shipping:** "Darmowa wysylka" or "Wysylka od X zl"
- **Availability:** "Sprawdz w sklepie"

### ASIN-to-Ceneo Mapping
- On first verification for a product, search Ceneo by product title
- Cache the matching `ceneo_id` in `products.ceneo_id`
- Subsequent verifications use cached ID directly

## 3. Cost & Performance

| Metric | Amazon Scraper | Ceneo Service |
|---|---|---|
| Data per check | ~150KB (with blocking) | ~50KB (HTML only) |
| RAM usage | ~1.5GB (Chromium) | ~100MB (no browser) |
| Proxy needed | Residential (required) | VPS IP or datacenter (Ceneo is lax) |
| Cost per 10k checks | ~$2.25 | ~$0.10 |

### When Ceneo is Triggered
1. Amazon scraper blocked (CAPTCHA/403) - fallback data source
2. Anomalous price drop >30% detected - cross-verification
3. Admin is notified via Telegram in both cases for manual review
