# eceee_v4 Production Deployment

Simple production deployment for eceee_v4 on a Linode VPS.

## Files

```
deploy/
├── docker-compose.prod.yml    10 services: caddy, backend, frontend, publisher,
│                              db, redis, imgproxy, playwright, celery-worker, celery-beat
├── Caddyfile                  Reverse proxy config (HTTPS handled automatically)
├── .env.production.example    Template → copy to deploy/.env on server (gitignored)
├── .env                       Secrets only — create on server, never commit
└── scripts/
    ├── deploy.sh              backup → pull → build → migrate → up → healthcheck
    ├── rollback.sh            re-deploy previous tag
    ├── backup.sh              pg_dump to /mnt/data/backups/
    ├── backfill-typed-tags.sh maintenance → backup → canary → verify
    ├── fetch-and-validate-typed-tags-backup.sh  fresh prod backup → secure local validation
    ├── validate-typed-tags-backup.sh  disposable local restore validation
    ├── production-operation.sh shared lock → atomic env install → deploy/restart
    ├── validate-deploy-control-ref.sh  require deploy-control changes on main
    └── healthcheck.sh         checks backend, publisher, and all public test-host HTTPS routes
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

For the isolated TypeScript publisher, also generate independent values for `PUBLISHER_DB_PASSWORD` and `PUBLISHER_FORM_DB_PASSWORD` with `openssl rand -hex 32`. Deployment rejects equal values before backup or migration, then creates or rotates the fixed least-privilege PostgreSQL roles without printing either password. The publisher container receives only its two dedicated database URLs and the non-secret test-host list; it does not inherit the rest of `deploy/.env`. The three test hosts are fixed in `docker-compose.prod.yml` and kept alongside the explicit Caddy routes so operators cannot configure the two surfaces apart.

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

The parallel Publisher additionally needs A/AAAA records for these test hostnames pointing to the same VPS:

- `eceee-test.colliberty.com`
- `summerstudy-test.colliberty.com`
- `industry-test.colliberty.com`

These hostnames are isolated from the existing public routes, which continue to use Django until their Caddy routes are deliberately changed. Caddy sends `X-Robots-Tag: noindex, nofollow, noarchive` on every test hostname to keep the mirrored pages out of search indexes.

If the list editor is not yet deployed, first run `make prod-bootstrap-editor TAG=beb38f5a6e9ecc18e0c370b921615e083e465017 PROD_HOST=root@139.162.154.219` from a checkout containing this command. This builds that reviewed commit's frontend in a temporary worktree on production and replaces **only** the CMS frontend container. The production Git checkout, backend, publisher, database and environment remain unchanged; an unhealthy frontend is rolled back to its previous image. The normal full-deploy healthcheck intentionally remains strict.

Next identify the three intended **ECEEE v4** root pages in the CMS. On each root page, use Settings → Hostnames to add its corresponding `*-test.colliberty.com` hostname alongside its existing hostnames; do not replace the existing entries. The editor presents one hostname per list item and also accepts scoped wildcards such as `*.colliberty.com`; use exact test hostnames here to avoid assigning unrelated subdomains to one root. A scoped wildcard matches subdomains, not its base domain, and does not create DNS records or HTTPS/Caddy routes. Confirm the root is published and that the same hostname is not assigned to another root. Save, reload, and verify the hostname is still present. These are production data changes and must be performed or explicitly approved by the operator; deploying code alone does not create aliases. The `eceee-test` root must be identified from v4 data, not inferred from `eceee.org` or `www.eceee.org`.

After all three aliases are verified, deploy the code and require `make prod-deploy` to pass its direct-page and public HTTPS health checks for all three test hosts. Check the rendered page and form flow on each test host. Do not relax the healthcheck if an alias or published root is missing.

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
Production orchestration itself is loaded from `origin/main`. If the requested
commit changes `deploy/scripts/`, `deploy/docker-compose.prod.yml`, or
`deploy/Caddyfile`, those control-plane changes must be merged to `main` first;
the remote preflight rejects the target before installing the staged environment
file or changing application state. Ordinary application-only refs remain
deployable by commit hash.

Publisher database passwords may only be rotated through `make prod-deploy`,
which provisions the matching PostgreSQL roles before replacing containers.
Restart-only and environment-install-only operations reject publisher password
changes so the installed environment cannot diverge from database credentials.

### Rollback

```bash
make prod-rollback            # rolls back to the previous deploy
```

This re-runs deploy.sh with the previous tag. Deploy derives optional services
from the checked-out target, so the first rollback to a release without the
publisher does not try to build, provision, or health-check it. The target's
application and Compose files remain checked out, while `deploy/scripts/` stays
on the reviewed `origin/main` control plane for the next operation. Rollback does
**not** automatically revert database migrations — see [Database Restore](#database-restore) if needed.

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

After deploying the reviewed version containing this workflow, create a fresh
production backup, securely fetch the exact artifact, validate it locally, and
delete the temporary local copy with one development-side command:

```bash
make validate-prod-typed-tags-backup
```

Use `KEEP_BACKUP=1` only when the dump must be retained under the ignored
`storage/production-backups/` directory. It remains sensitive production data.

For an already transferred backup, run the lower-level validator directly:

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
Deploys, database restores, and this maintenance workflow share a nonblocking
host lock so they cannot change application service state concurrently.
Environment updates are staged with restrictive permissions and installed
atomically while the same lock is held through any requested deploy or restart.

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
4. Build the target's application services, including `publisher` when configured
5. Run migrations
6. `python manage.py collectstatic`, then provision convergent least-privilege publisher roles when configured
7. `docker compose up -d --remove-orphans`
8. Health check for up to 90s (backend, publisher liveness, direct rendered pages, and every public test-host HTTPS route through Caddy)
9. Log the deploy to `/opt/eceee/app/deploy.log`

There is ~30-60s of downtime during step 7. That is acceptable for this deployment.
