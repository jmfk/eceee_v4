# Production Deployment Guide for ECEEE v4

## Summary of Changes

I've created the following production files for your eceee_v4 repository:

1. ✅ `docker-compose.production.yml` - Production Docker configuration
2. ✅ `Caddyfile` - Reverse proxy with automatic HTTPS
3. ✅ `env.production.example` - Example environment variables

## What's Different in Production?

### Development (`docker-compose.yml`)
- Uses localhost/127.0.0.1
- MinIO for local S3 storage
- Debug mode enabled
- Exposed ports for all services
- Hot-reload for frontend
- Django runserver

### Production (`docker-compose.production.yml`)
- Uses your domain (eceee.fred.nu)
- Linode Object Storage
- Debug mode disabled
- Only Caddy exposes ports (80/443)
- Optimized builds
- Gunicorn for Django
- Automatic HTTPS via Caddy
- Uses Linode block storage for PostgreSQL

## Step-by-Step Deployment

### 1. Set Up Linode Object Storage

In Linode Cloud Manager:
1. Go to **Object Storage** → **Access Keys**
2. Click **Create Access Key**
3. Save the access key and secret key
4. Note: Your bucket `eceee-v4-media` already exists from the deployment

### 2. Create Production Environment File

On the **server** (after deployment), create `.env`:

```bash
# SSH into your server
cd ~/code/eceee-components
make ssh

# Navigate to deployment directory
cd /srv/eceee_v4

# Create .env file
nano .env
```

Paste this content (replace with your actual values):

```env
DOMAIN=eceee.fred.nu
EMAIL=your-email@example.com

DEBUG=0
DJANGO_SECRET_KEY=$(openssl rand -base64 64 | tr -d '\n')

POSTGRES_DB=eceee_v4
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')

# From Linode Object Storage Access Keys
LINODE_OBJECT_STORAGE_ACCESS_KEY=your-access-key-here
LINODE_OBJECT_STORAGE_SECRET_KEY=your-secret-key-here
LINODE_OBJECT_STORAGE_BUCKET=eceee-v4-media
LINODE_OBJECT_STORAGE_REGION=eu-central

# imgproxy keys (already generated, or create new with: openssl rand -hex 32)
IMGPROXY_KEY=943b421c9eb07c830af81030552c86009268de4e532ba2ee2eab8247c6da0881
IMGPROXY_SALT=520f986b998545b4785e0defbc4f3c1203f22de2374a3d53cb7a7fe9fea309c5

REDIS_URL=redis://redis:6379/0
```

Save and exit (Ctrl+X, Y, Enter).

### 3. Commit and Push Production Files

On your **local machine**:

```bash
cd ~/code/eceee_v4

# Add the new production files
git add docker-compose.production.yml Caddyfile env.production.example PRODUCTION_DEPLOY.md

# Commit
git commit -m "Add production deployment configuration with Caddy and Linode Object Storage"

# Push to GitHub
git push origin main
```

### 4. Deploy to Production

From your **local machine**:

```bash
cd ~/code/eceee-components

# Deploy with the new configuration
make deploy FLAGS='--force --skip-dns'
```

This will:
1. ✅ Clean up old resources
2. ✅ Create fresh instance
3. ✅ Set up block storage for PostgreSQL
4. ✅ Configure object storage bucket
5. ✅ Clone your repo with the new production files
6. ✅ Start services with docker-compose.production.yml
7. ✅ Run migrations and collect static files

### 5. Verify Deployment

```bash
# Check deployment status
make status

# SSH into server
make ssh

# Check running containers
cd /srv/eceee_v4
docker compose -f docker-compose.production.yml ps

# Check logs
docker compose -f docker-compose.production.yml logs -f

# Test the site
curl -I http://$(make status | grep IPv4 | awk '{print $3}')
```

### 6. Configure DNS (Optional)

If you want to use your domain instead of IP:

1. In Linode Cloud Manager → **Domains** → Add your domain
2. Add A record: `eceee.fred.nu` → Your instance IP
3. Update DNS nameservers at your registrar
4. Wait for DNS propagation (~5-10 minutes)
5. Access: https://eceee.fred.nu

Caddy will automatically provision an HTTPS certificate!

## Architecture

```
Internet (Port 80/443)
    ↓
Caddy (Reverse Proxy + HTTPS)
    ↓
┌──────────────┬──────────────┬──────────────┐
│   Frontend   │    Backend   │   imgproxy   │
│   (React)    │   (Django)   │ (Image Proc) │
└──────┬───────┴──────┬───────┴──────────────┘
       │              │
       ↓              ↓
┌──────────────┬──────────────┬──────────────┐
│  PostgreSQL  │    Redis     │   Linode     │
│ (Block       │  (Cache)     │   Object     │
│  Storage)    │              │   Storage    │
└──────────────┴──────────────┴──────────────┘
```

## Useful Commands

### On Your Local Machine

```bash
# Deploy/redeploy
cd ~/code/eceee-components
make deploy-force FLAGS='--skip-dns'

# Check status
make status

# SSH into server
make ssh

# Fetch logs
make logs

# Destroy everything
make destroy
```

### On the Server

```bash
# View all logs
docker compose -f docker-compose.production.yml logs -f

# View specific service logs
docker compose -f docker-compose.production.yml logs -f backend
docker compose -f docker-compose.production.yml logs -f caddy

# Restart services
docker compose -f docker-compose.production.yml restart

# Stop services
docker compose -f docker-compose.production.yml down

# Start services
docker compose -f docker-compose.production.yml up -d

# Rebuild and restart
docker compose -f docker-compose.production.yml up -d --build

# Execute Django management commands
docker compose -f docker-compose.production.yml exec backend python manage.py createsuperuser
docker compose -f docker-compose.production.yml exec backend python manage.py shell

# Check disk usage
df -h
docker system df

# View Caddy logs
docker compose -f docker-compose.production.yml exec caddy cat /data/access.log
```

## Troubleshooting

### Issue: Caddy not getting HTTPS certificate

**Solution:**
1. Make sure DNS points to your server's IP
2. Make sure ports 80 and 443 are open (firewall configured automatically)
3. Check Caddy logs: `docker compose -f docker-compose.production.yml logs caddy`
4. Wait a few minutes for Let's Encrypt

### Issue: 502 Bad Gateway

**Solution:**
1. Check if backend is running: `docker compose -f docker-compose.production.yml ps`
2. Check backend logs: `docker compose -f docker-compose.production.yml logs backend`
3. Verify backend health: `docker compose -f docker-compose.production.yml exec backend curl localhost:8000/health/`

### Issue: Database connection errors

**Solution:**
1. Check if PostgreSQL is running: `docker compose -f docker-compose.production.yml ps db`
2. Check PostgreSQL logs: `docker compose -f docker-compose.production.yml logs db`
3. Verify credentials in `.env` file
4. Check block storage is mounted: `df -h | grep scsi`

### Issue: Static files not loading

**Solution:**
```bash
docker compose -f docker-compose.production.yml exec backend python manage.py collectstatic --noinput
docker compose -f docker-compose.production.yml restart backend caddy
```

### Issue: Images not displaying

**Solution:**
1. Verify Object Storage credentials in `.env`
2. Check imgproxy logs: `docker compose -f docker-compose.production.yml logs imgproxy`
3. Test object storage access from backend

## Security Checklist

- [x] Debug mode disabled (`DEBUG=0`)
- [x] Strong random secret key for Django
- [x] Secure PostgreSQL password
- [x] imgproxy signature keys enabled
- [x] Firewall configured (ports 22, 80, 443 only)
- [x] HTTPS enabled via Caddy
- [x] Security headers configured in Caddyfile
- [x] No unnecessary ports exposed
- [ ] Set up regular database backups
- [ ] Configure error monitoring (Sentry)
- [ ] Set up uptime monitoring
- [ ] Review Django ALLOWED_HOSTS

## Backup Strategy

### Database Backups

```bash
# Create backup
docker compose -f docker-compose.production.yml exec -T db pg_dump -U postgres eceee_v4 > backup-$(date +%Y%m%d).sql

# Restore backup
cat backup-20250101.sql | docker compose -f docker-compose.production.yml exec -T db psql -U postgres eceee_v4
```

### Object Storage Backups

Linode Object Storage is already redundant, but you can create periodic snapshots via Linode Cloud Manager.

## Performance Tuning

### For High Traffic

In `docker-compose.production.yml`, adjust:

```yaml
backend:
  command: gunicorn ... --workers 8  # Increase workers
  
imgproxy:
  environment:
    IMGPROXY_WORKERS: 8  # Increase workers
    IMGPROXY_MAX_CLIENTS: 4096
```

### Scale up Linode Instance

```bash
# In deploy/.env
INSTANCE_TYPE=g6-standard-4  # or g6-standard-8
```

Then redeploy with `make deploy-force`.

## Next Steps

1. ✅ Deploy to production
2. ⏳ Configure your domain DNS
3. ⏳ Create Django superuser
4. ⏳ Set up database backup cron job
5. ⏳ Configure error monitoring (Sentry)
6. ⏳ Set up uptime monitoring
7. ⏳ Performance testing

## Support

Issues? Check:
1. Deployment logs: `~/code/eceee-components/deploy/logs/`
2. Server logs: `docker compose -f docker-compose.production.yml logs`
3. Deployment docs: `~/code/eceee-components/deploy/QUICKSTART.md`

