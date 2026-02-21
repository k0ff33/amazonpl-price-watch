# Dokploy DB Storage (DB Data Only On Hetzner Volume)

Applies to Dokploy-managed services (non-compose).

Goal: keep only Postgres/Redis data on the attached Hetzner volume, while Dokploy and Docker internals remain on the VPS system disk.

## 1. Create or attach Hetzner volume (automatic mount)

```bash
hcloud volume create \
  --name liskobot-db \
  --size 100 \
  --location fsn1 \
  --format ext4 \
  --server liskobot-prod \
  --automount=true
```

If volume already exists:

```bash
hcloud volume attach --server liskobot-prod --automount=true liskobot-db
```

## 2. Resolve automount path

```bash
VOLUME_ID="$(hcloud volume describe liskobot-db -o json | jq -r '.id')"
echo "$VOLUME_ID"
```

Hetzner automount path:

```text
/mnt/HC_Volume_<VOLUME_ID>
```

## 3. Prepare DB directories on the VPS

```bash
MOUNT_PATH="/mnt/HC_Volume_<VOLUME_ID>"
sudo mkdir -p "${MOUNT_PATH}/liskobot/postgres" "${MOUNT_PATH}/liskobot/redis"
sudo chown -R 999:999 "${MOUNT_PATH}/liskobot/postgres" "${MOUNT_PATH}/liskobot/redis"
```

## 4. Configure Dokploy DB mounts (bind mounts)

Set Dokploy database storage to bind host paths from the mounted volume:

- Postgres:
  - Host path: `/mnt/HC_Volume_<VOLUME_ID>/liskobot/postgres`
  - Container path: `/var/lib/postgresql/data`
- Redis:
  - Host path: `/mnt/HC_Volume_<VOLUME_ID>/liskobot/redis`
  - Container path: `/data`

Keep Redis auth enabled.

## 5. App env vars

Set project-level or per app:

```env
POSTGRES_USER=...
POSTGRES_PASSWORD=...
REDIS_PASSWORD=...
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/pricewatch
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
```

Use in:

- `bot-service`
- `amazon-scraper`
- `ceneo-service`

## 6. Backups

- Enable Postgres and Redis backups in Dokploy.
- Configure schedule + retention.
- Test restore to staging regularly.

Note: Dokploy "Volume Backups" are for Docker named volumes. With bind mounts, rely on DB backups.
