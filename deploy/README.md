# eceee_v4 Production Deployment

Simple production deployment for eceee_v4 on a Linode VPS.

## Files

```
deploy/
├── docker-compose.prod.yml   9 services: caddy, backend, frontend, db, redis,
│                             imgproxy, playwright, celery-worker, celery-beat
├── Caddyfile                 Reverse proxy config (HTTPS handled automatically)
├── env.production.example    Copy this to /opt/eceee/.env on the server
└── scripts/
    ├── deploy.sh             backup → pull → build → migrate → up → healthcheck
    ├── rollback.sh           re-deploy previous tag
    ├── backup.sh             pg_dump to /mnt/data/backups/
    └── healthcheck.sh        polls https://eceee.fred.nu/health/
```

## One-Time Server Setup

Run these once on a freshly provisioned Linode VPS (Debian 12).

### 1. Install Docker

```bash
apt-get update
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### 2. Create directory structure

```bash
mkdir -p /opt/eceee
mkdir -p /mnt/data/backups /mnt/data/postgres /mnt/data/redis
```

> `/mnt/data` should be your Linode block storage volume, mounted before running this.

### 3. Clone the repo

```bash
git clone https://github.com/YOUR_ORG/eceee_v4.git /opt/eceee/app
```

### 4. Create the .env file

```bash
cp /opt/eceee/app/deploy/env.production.example /opt/eceee/.env
nano /opt/eceee/.env
```

Fill in all values — especially `DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD`, and your Linode Object Storage keys.

### 5. Point DNS

Add these A records pointing to your VPS IP:
- `eceee.fred.nu`
- `admin.eceee.fred.nu`
- `app.eceee.fred.nu`

### 6. First deploy

```bash
cd /opt/eceee/app
bash deploy/scripts/deploy.sh v0.1.0
```

Caddy will automatically obtain TLS certificates on first startup.

---

## Day-to-day Operations

All commands run from your **local machine** and SSH to the server.

### Deploy a new version

```bash
make prod-deploy              # deploys latest git tag
make prod-deploy TAG=v0.1.5   # deploys a specific tag
```

### Rollback

```bash
make prod-rollback            # rolls back to the previous deploy
```

This re-runs deploy.sh with the previous tag. It does **not** automatically
revert database migrations — see [Database Restore](#database-restore) if needed.

### View logs

```bash
make prod-logs                  # all services
make prod-logs SERVICE=backend  # specific service
```

### Check container status

```bash
make prod-status
```

### Open a shell

```bash
make prod-ssh                   # SSH into the server
make prod-shell                 # Django manage.py shell in production
```

### Ad-hoc backup

```bash
make prod-backup
```

Backups are stored at `/mnt/data/backups/eceee_v4_TIMESTAMP.sql.gz`.
They are pruned automatically after 30 days.

---

## Database Restore

If you need to restore a database backup:

```bash
ssh YOUR_SERVER "bash /opt/eceee/app/deploy/scripts/backup.sh restore /mnt/data/backups/eceee_v4_TIMESTAMP.sql.gz"
```

This stops backend/celery, drops and recreates the DB, restores from the dump, then restarts.

---

## Configuration

### PROD_HOST

Set `PROD_HOST` in your local shell so you don't have to type it every time:

```bash
# ~/.zshrc or ~/.bashrc
export PROD_HOST=root@YOUR_VPS_IP
```

Or pass it inline:

```bash
make prod-deploy PROD_HOST=root@1.2.3.4
```

### Changing domains

Update `deploy/Caddyfile` and `ALLOWED_HOSTS` / `CORS_ALLOWED_ORIGINS` in `/opt/eceee/.env`, then redeploy.

### Adding environment variables

Edit `/opt/eceee/.env` on the server, then run `make prod-deploy` (the containers will restart with the new env).

---

## Deployment Flow

`deploy.sh` runs these steps in order:

1. Pre-flight check (`/opt/eceee/.env` exists, repo is present)
2. Backup (`pg_dump` → `/mnt/data/backups/`)
3. `git fetch --tags && git checkout TAG`
4. `docker compose build backend frontend playwright`
5. `python manage.py migrate` (fail fast if unapplied migrations exist)
6. `python manage.py collectstatic`
7. `docker compose up -d --remove-orphans`
8. Health check (polls `/health/` for up to 60s)
9. Log the deploy to `/opt/eceee/deploy.log`

There is ~30-60s of downtime during step 7. That is acceptable for this deployment.
