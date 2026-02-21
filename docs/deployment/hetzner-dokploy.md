# Hetzner VPS + Dokploy Deployment

Simple single-VPS bootstrap with Tailscale-only SSH.

## Prerequisites

- `hcloud` CLI authenticated (`hcloud context list`)
- `jq`
- Existing Hetzner SSH key (`hcloud ssh-key list`)

## 1. Configure env

```bash
cp scripts/deploy/hetzner/.env.example scripts/deploy/hetzner/.env
```

Edit required values:

- `HCLOUD_SERVER_NAME`
- `HCLOUD_SSH_KEY_NAME`
- `TAILSCALE_AUTH_KEY`
- `ADMIN_CONSOLE_PASSWORD`

If password contains special shell characters, wrap it in single quotes in `.env`.

## 2. Dry run

```bash
scripts/deploy/hetzner/create-vps.sh --dry-run
```

## 3. Create VPS

```bash
scripts/deploy/hetzner/create-vps.sh
```

This creates/uses a firewall with only public `80/tcp` and `443/tcp`. Public SSH (`22/tcp`) stays closed.

## 4. Wait for cloud-init

Use Hetzner Console and run:

```bash
cloud-init status --wait
```

Web console login is enabled for `deploy` with `ADMIN_CONSOLE_PASSWORD`.
Change it immediately after first login.

## 5. Access over Tailscale

```bash
ssh deploy@<tailscale-hostname-or-ip>
ssh -L 3000:localhost:3000 deploy@<tailscale-hostname-or-ip>
```

Open `http://localhost:3000`.

## 6. Verify hardening

```bash
scripts/deploy/hetzner/check-security.sh <tailscale-hostname-or-ip> deploy <server-name>
```

## 6.5 Optional: attach dedicated Hetzner volume for DB data only

If you want Postgres/Redis persistence on a separate Hetzner disk (recommended), complete:

- `docs/deployment/dokploy-database-storage.md`

## 7. Deploy Services Independently In Dokploy (GitOps)

This repository is a `pnpm` monorepo. Each app must build from repository root context.

### 7.1 Create core services first

In one Dokploy project, create:

- PostgreSQL 16 service (name it `postgres`)
- Redis 7 service (name it `redis`, enable password)

Then define project/app environment values:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/pricewatch`
- `REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379`

Use the same database and redis URLs in all three app services.

### 7.2 Create 3 separate GitOps apps

Create these as separate Dokploy applications so they can scale independently:

- `bot-service`
- `amazon-scraper`
- `ceneo-service`

For each app, use:

- Source: Git (GitHub)
- Repository: `k0ff33/liskobot`
- Branch: your deployment branch (for example `main`)
- Build Type: `Dockerfile`
- Build Path (root path): `/`
- Docker Context Path: `.`
- Auto Deploy: enabled

Service-specific Dockerfile:

- `bot-service` -> `packages/bot-service/Dockerfile`
- `amazon-scraper` -> `packages/amazon-scraper/Dockerfile`
- `ceneo-service` -> `packages/ceneo-service/Dockerfile`

Important: do not set `Build Path=packages/<service>` together with `Dockerfile=packages/<service>/Dockerfile` or Dokploy will resolve invalid nested paths.

### 7.3 Environment variables per app

`bot-service`:

- `DATABASE_URL`
- `REDIS_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`
- `AMAZON_ASSOCIATE_TAG`

`amazon-scraper`:

- `DATABASE_URL`
- `REDIS_URL`
- `PROXY_URL` (optional)

`ceneo-service`:

- `DATABASE_URL`
- `REDIS_URL`

### 7.4 Ports and health checks

The containers expose:

- `bot-service`: `3000` (`/health`)
- `amazon-scraper`: `3001` (`/health`)
- `ceneo-service`: `3002` (`/health`)

If only workers are needed (no public HTTP), keep them internal and skip domain routing.

### 7.5 Scaling guidance

- Keep `bot-service` at 1 replica (it includes scheduler + bot polling logic).
- Scale `amazon-scraper` and `ceneo-service` independently based on queue load.

### 7.6 Deployment order

1. Deploy `postgres` and `redis`.
2. Deploy `bot-service` (runs Drizzle migrations automatically on startup).
3. Deploy `amazon-scraper`.
4. Deploy `ceneo-service`.
5. Verify logs and `/health` checks.

For persistent database storage and backup/restore workflow, see:

- `docs/deployment/dokploy-database-storage.md`
