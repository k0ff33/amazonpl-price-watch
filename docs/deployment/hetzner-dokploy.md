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
