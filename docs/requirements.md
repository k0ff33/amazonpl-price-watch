# Requirements: amazonpl-price-watch

## 1. Objective
A commission-only SaaS tracking Amazon.pl prices and stock. Users are notified via Telegram when their target price is met or an item hits a historical low. Revenue is generated through Amazon Associates affiliate links.

## 2. Functional Requirements
- **Input:** URL paste (Amazon.pl) via Telegram Bot.
- **Tracking:**
  - Price (Target Price & Percentage Drop).
  - Stock Status (Notify only when In Stock).
  - Historical Lows (Auto-notify on new record low).
  - **Full History:** Maintain a permanent history of all price changes for every tracked item.
- **User Management:**
  - List all active watches.
  - Pause/Stop/Delete specific watches.
  - Set/update target price per watch.
- **Notifications:** Telegram (MVP Priority). System must support future expansion to other channels.
- **Scale:** Must handle thousands of users subscribing to the same item efficiently (fan-out pattern).
- **Anomalous Drop Handling:** Price drops >30% are flagged as unverified. Users notified with caveat. Admin pinged for manual review.

## 3. Data Engine (Fallback Chain)
Priority order for fetching price data:
1. **Amazon Creators API** (Primary, post 10-sale threshold).
2. **Amazon Scraper:** Crawlee PlaywrightCrawler + stealth plugin + rotating residential proxies.
3. **Ceneo Verification** (Conditional only):
   - Triggered when Amazon scraper is blocked (CAPTCHA/403).
   - Triggered on anomalous price drops (>30%) for cross-verification.
   - Admin notified in both cases.

### Smart Polling
- Prioritized queue (user-interest based, revenue-first).
- Tiered monitoring (volatility based).
- No manual user-triggered refreshes.

## 4. Marketing & Acquisition (Subtle/Organic)
- **Community Presence:** AI-led outreach on Pepper.pl and Reddit (Value-add historical context).
- **"Deal-Caster" Channels:** Automated Telegram channels broadcasting high-value price drops.

## 5. Privacy, Security & Compliance
- **GDPR:** Minimal data collection (Telegram ID). Secure storage.
- **Security:** OWASP best practices, encrypted DB, secret management.
- **Amazon Compliance:** Mandatory Associate Disclosure on every alert. 24-hour data freshness (for display). 100% Affiliate links.

## 6. Budget & Infrastructure
- **Total Burn:** <$100/mo (estimated ~$10-15/mo).
- **Stack:** Node.js/TypeScript, Hetzner VPS (4GB), PostgreSQL, Coolify deployment.
