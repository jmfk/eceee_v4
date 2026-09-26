# eceee_v4 Production Deployment

Simple production deployment for eceee_v4 on a Linode VPS.

## Files

```
deploy/
├── docker-compose.prod.yml    9 services: caddy, backend, frontend, db, redis,
│                              imgproxy, playwright, celery-worker, celery-beat
├── Caddyfile                  Reverse proxy config (HTTPS handled automatically)
├── .env.production.example    Template → copy to deploy/.env on server (gitignored)
├── .env                       Secrets only — create on server, never commit
└── scripts/
    ├── deploy.sh              backup → pull → build → migrate → up → healthcheck
    ├── rollback.sh            re-deploy previous tag
    ├── backup.sh              pg_dump to /mnt/data/backups/
    ├── backfill-typed-tags.sh maintenance → backup → canary → verify
    ├── validate-typed-tags-backup.sh  disposable local restore validation
    └── healthcheck.sh         polls backend /health/ (Host from DOMAIN in deploy/.env)
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

### 4. Create deploy/.env (secrets — not in git)

`deploy.sh` and Compose use **`/opt/eceee/app/deploy/.env`** (next to `docker-compose.prod.yml`). That file is gitignored; never commit it.

```bash
cp /opt/eceee/app/deploy/.env.production.example /opt/eceee/app/deploy/.env
nano /opt/eceee/app/deploy/.env
```

Fill in all values — especially `DOMAIN`, `SECRET_KEY`, `POSTGRES_PASSWORD`, `POSTGRES_HOST=db`, Redis, Linode Object Storage, Postmark, imgproxy signing keys, and optional AI keys. The full variable set is documented in `deploy/.env.production.example`.

### Secrets

- Keep real secrets **only** in `deploy/.env` on the server (not in git, not in tickets or chat). Copy from `deploy/.env.production.example` and replace every placeholder.
- `IMGPROXY_KEY` and `IMGPROXY_SALT` must **match** between the Django backend and the `imgproxy` container; both load the same `deploy/.env` via Compose. Generate with `openssl rand -hex 32` (two independent values).
- Rotating imgproxy key/salt invalidates **existing signed image URLs** (bookmarks, cached HTML); originals in object storage are unchanged. Plan downtime or cache bust if you rotate.

### 5. Point DNS

Add these A records pointing to your VPS IP (match `DOMAIN` and `deploy/Caddyfile`):
- `eceee.org`
- `admin.eceee.org`
- `app.eceee.org`
- `imgproxy.eceee.org`

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
make prod-deploy              # deploys latest origin/main
make prod-deploy TAG=v0.1.5   # deploys a specific tag
make prod-deploy TAG=abc1234  # deploys a specific commit hash
```

`prod-deploy` resolves the requested ref to a commit hash first, runs preflight
checks from a temporary worktree at that exact commit, then deploys the same hash.

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

### Audit tenant access before migration

Run the aggregate read-only audit from the local checkout. It sends a SQL
transaction declared `READ ONLY` to the running PostgreSQL container, so the
audit does not need to be deployed first and does not start the Django app.

```bash
make prod-audit-tenant-access
```

The result is `NO_RISK`, `REVIEW_REQUIRED`, or `RISK`. The audit prints counts
only, never usernames or email addresses, and does not modify production data.

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

`deploy.sh` treats backup failure as fatal. `backup.sh` writes to a partial file,
verifies the gzip stream, and only then publishes the timestamped backup name.

### Validate the typed-tag migration against production data

After creating a current backup, transfer it through an approved secure channel,
make it readable only by the local operator, and run the disposable validator:

```bash
chmod 600 /absolute/path/eceee_v4_TIMESTAMP.sql.gz
make validate-typed-tags-backup BACKUP_FILE=/absolute/path/eceee_v4_TIMESTAMP.sql.gz
```

The dump is restored into an isolated local PostgreSQL 15 container. Its contents
and restore errors are not printed. The current schema migration, typed-tag source
preflight, interrupted/resumed backfill, independent verification, and Django
checks must all pass before scheduling production.

### Run the typed-tag production backfill

After deploying the reviewed commit, run the one-time maintenance workflow:

```bash
make prod-backfill-typed-tags RUN_ID=typed-tags-v1 CANARY_SIZE=100
```

This stops application writers, creates a mandatory backup, preflights existing
data, runs and resumes a bounded canary, verifies all canonical relations, restores
services, and waits for a healthy backend. Legacy fields remain authoritative, so
a failed expansion can return to service without switching reads to partial data.

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

Update `deploy/Caddyfile` and `ALLOWED_HOSTS` / `CORS_ALLOWED_ORIGINS` in `deploy/.env`, then redeploy.

### Adding environment variables

Edit `deploy/.env` on the server, then run `make prod-deploy` (the containers will restart with the new env).

---

## Deployment Flow

`deploy.sh` runs these steps in order:

1. Pre-flight check (`deploy/.env` exists, repo is present)
2. Mandatory verified backup (`pg_dump` → `/mnt/data/backups/`); abort on failure
3. `git fetch --tags && git checkout TAG`
4. `docker compose build backend frontend playwright`
5. `python manage.py migrate` (fail fast if unapplied migrations exist)
6. `python manage.py collectstatic`
7. `docker compose up -d --remove-orphans`
8. Health check (polls `/health/` for up to 60s)
9. Log the deploy to `/opt/eceee/app/deploy.log`

There is ~30-60s of downtime during step 7. That is acceptable for this deployment.
