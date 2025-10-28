# Cursor Command: Sync Docker Compose to Production

## Purpose
Sync new service configurations and environment variables from development `docker-compose.production.yml` to production deployment at `../eceee-components/deploy/docker-compose.production.template.yml`.

## Sync Method
This command uses **intelligent YAML diff analysis** with safety warnings. Changes are applied manually using search_replace after thorough analysis and validation.

## Instructions for Agent

### Step 1: Compare Docker Compose Files

1. **Read both files:**
   - Development production template: `/Users/jmfk/code/eceee_v4/docker-compose.production.yml`
   - Deployment production template: `/Users/jmfk/code/eceee-components/deploy/docker-compose.production.template.yml`

2. **Identify differences in:**
   - Service definitions (new services)
   - Environment variables
   - Volume mounts
   - Health checks
   - Service dependencies
   - Build arguments

3. **Perform safety analysis on each difference (see Step 1.1 below)**

### Step 1.1: Safety Analysis for Docker Compose Changes

For each identified difference, check:

**CRITICAL Warnings (DO NOT SYNC):**
- ⚠ **CRITICAL**: Hardcoded secrets or passwords in environment values
- ⚠ **CRITICAL**: Environment variables without `${VAR}` or `${VAR:-default}` format
- ⚠ **CRITICAL**: Services without restart policies
- ⚠ **CRITICAL**: Database credentials hardcoded
- ⚠ **CRITICAL**: Exposed ports for sensitive services (db, redis without proper security)

**HIGH Warnings (Sync with caution):**
- ⚠ **HIGH**: New services that could affect production uptime
- ⚠ **HIGH**: Changes to database service configuration
- ⚠ **HIGH**: Volume mounts to sensitive system paths
- ⚠ **HIGH**: Health check changes on critical services
- ⚠ **HIGH**: Services without health checks
- ⚠ **HIGH**: Platform specification changes

**MEDIUM Warnings (Review recommended):**
- ⚠ **MEDIUM**: New environment variables without defaults
- ⚠ **MEDIUM**: Volume mount path changes
- ⚠ **MEDIUM**: Service dependency changes
- ⚠ **MEDIUM**: Missing log volume mounts
- ⚠ **MEDIUM**: Build context or Dockerfile path changes

**INFO (Safe to sync):**
- ℹ **INFO**: New environment variables with proper `${VAR:-default}` format
- ℹ **INFO**: New services with proper configuration
- ℹ **INFO**: New volumes defined
- ℹ **INFO**: Comment or documentation changes

### Step 2: Categorize Changes

Classify each difference and generate categorization report:

```
Docker Compose Analysis Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SYNC - Environment Variables (14 new):
  ✓ AI_TAGGING_ENABLED=${AI_TAGGING_ENABLED:-true}
  ✓ AI_STORE_PROMPTS_BY_DEFAULT=${AI_STORE_PROMPTS_BY_DEFAULT:-false}
  ✓ AI_STORE_RESPONSES_BY_DEFAULT=${AI_STORE_RESPONSES_BY_DEFAULT:-false}
  ✓ AI_PRICE_STALE_DAYS=${AI_PRICE_STALE_DAYS:-30}
  ✓ AI_TRACKING_ADMIN_EMAIL=${AI_TRACKING_ADMIN_EMAIL}
  ✓ AI_BUDGET_CHECK_ENABLED=${AI_BUDGET_CHECK_ENABLED:-true}
  ✓ ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
  ✓ PLAYWRIGHT_SERVICE_URL=${PLAYWRIGHT_SERVICE_URL:-http://playwright:5000}
  ✓ FM_SERVER_URL=${FM_SERVER_URL:-https://fms.eceee.org}
  ✓ FM_USERNAME=${FM_USERNAME:-CWPAccount}
  ✓ FM_PASSWORD=${FM_PASSWORD}
  ... (3 more)
  ⚠ MEDIUM: AI_TRACKING_ADMIN_EMAIL has no default (optional var)

SYNC - New Services (2):
  ⚠ HIGH: celery service (new background worker)
    - Requires all backend env vars
    - Needs log volume mount
    - May increase resource usage
  
  ⚠ HIGH: celery-beat service (new scheduler)
    - Requires DatabaseScheduler
    - Needs celery_beat_schedule volume
    - Depends on celery service

SYNC - New Volumes (1):
  ✓ celery_beat_schedule volume for scheduler persistence

WARNINGS:
  ⚠ HIGH: Adding celery services will restart backend-dependent services
  ⚠ MEDIUM: Celery logs need /mnt/data/logs/celery directory created
  ⚠ MEDIUM: Ensure all backend env vars copied to celery services

SKIP - Development Only:
  ⊗ Any development service overrides

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Summary:
  Environment variables: 14 to add
  New services: 2 to add
  New volumes: 1 to add
  Warnings: 4 to review

Recommendations:
  1. Review HIGH warnings for celery services
  2. Ensure production server has /mnt/data/logs/celery directory
  3. Copy ALL backend environment variables to celery services
  4. Test celery worker and beat after deployment
```

#### Categories Identified:

**Environment Variables to Sync:**
- AI tracking variables (AI_TRACKING_*, ANTHROPIC_API_KEY)
- Service URLs (PLAYWRIGHT_SERVICE_URL)
- Feature flags (AI_TAGGING_ENABLED)
- Integration configs (FM_SERVER_URL, FM_USERNAME, FM_PASSWORD)
- Any new config() references from settings.py

**New Services to Add:**
- Celery worker service (for background tasks)
- Celery beat service (for scheduled tasks)
- Playwright service (optional, for content import)

**Configuration Updates:**
- Health check improvements
- Volume mount additions
- Dependency updates
- Build argument changes

### Step 3: Apply Backend Environment Variables

Add to backend service environment section (maintain YAML formatting):

```yaml
# AI Tracking Configuration
- AI_TAGGING_ENABLED=${AI_TAGGING_ENABLED:-true}
- AI_STORE_PROMPTS_BY_DEFAULT=${AI_STORE_PROMPTS_BY_DEFAULT:-false}
- AI_STORE_RESPONSES_BY_DEFAULT=${AI_STORE_RESPONSES_BY_DEFAULT:-false}
- AI_PRICE_STALE_DAYS=${AI_PRICE_STALE_DAYS:-30}
- AI_TRACKING_ADMIN_EMAIL=${AI_TRACKING_ADMIN_EMAIL}
- AI_BUDGET_CHECK_ENABLED=${AI_BUDGET_CHECK_ENABLED:-true}
- ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}

# Content Import Service
- PLAYWRIGHT_SERVICE_URL=${PLAYWRIGHT_SERVICE_URL:-http://playwright:5000}

# FileMaker Integration
- FM_SERVER_URL=${FM_SERVER_URL:-https://fms.eceee.org}
- FM_USERNAME=${FM_USERNAME:-CWPAccount}
- FM_PASSWORD=${FM_PASSWORD}
```

### Step 4: Add New Services (if applicable)

#### Celery Worker Service
Location: After redis service, before caddy

```yaml
celery:
  build:
    context: ./backend
    dockerfile: Dockerfile
  platform: linux/amd64
  restart: unless-stopped
  user: root
  depends_on:
    db:
      condition: service_healthy
    redis:
      condition: service_started
  environment:
    # Copy ALL environment variables from backend service
    - DEBUG=False
    - DJANGO_SETTINGS_MODULE=config.settings
    - POSTGRES_DB=${POSTGRES_DB:-eceee_v4}
    - POSTGRES_USER=${POSTGRES_USER:-postgres}
    - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    - POSTGRES_HOST=db
    - POSTGRES_PORT=5432
    - REDIS_URL=redis://redis:6379/0
    - SECRET_KEY=${SECRET_KEY}
    # ... include all other backend env vars
  volumes:
    - ./backend:/app
    - /mnt/data/logs/celery:/var/log/celery
  command: celery -A config worker -l info --logfile=/var/log/celery/celery.log
```

#### Celery Beat Service
Location: After celery worker service

```yaml
celery-beat:
  build:
    context: ./backend
    dockerfile: Dockerfile
  platform: linux/amd64
  restart: unless-stopped
  user: root
  depends_on:
    db:
      condition: service_healthy
    redis:
      condition: service_started
    celery:
      condition: service_started
  environment:
    # Copy ALL environment variables from backend service
    - DEBUG=False
    - DJANGO_SETTINGS_MODULE=config.settings
    # ... same as celery worker
  volumes:
    - ./backend:/app
    - /mnt/data/logs/celery:/var/log/celery
    - celery_beat_schedule:/app/celerybeat-schedule
  command: celery -A config beat -l info --logfile=/var/log/celery/beat.log --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

#### Playwright Service (Optional)
Location: After celery services

```yaml
playwright:
  build:
    context: ./playwright-service
    dockerfile: Dockerfile
  platform: linux/amd64
  restart: unless-stopped
  expose:
    - "5000"
  volumes:
    - /mnt/data/logs/playwright:/var/log/playwright
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
    interval: 30s
    timeout: 10s
    retries: 3
  environment:
    - LOG_LEVEL=${PLAYWRIGHT_LOG_LEVEL:-info}
```

### Step 5: Add Volume Definitions

If new services added, update volumes section:

```yaml
volumes:
  backend_static:
  redis_data:
  caddy_data:
  caddy_config:
  celery_beat_schedule:  # NEW - for celery beat scheduler persistence
```

### Step 6: Service-Specific Considerations

#### When adding Celery services:
- ✅ Copy ALL backend environment variables to both celery and celery-beat
- ✅ Add proper volume mounts for logs
- ✅ Add celery_beat_schedule volume for scheduler persistence
- ✅ Use DatabaseScheduler for beat scheduler
- ✅ Set appropriate log levels

#### When adding Playwright service:
- ✅ Only add if content import feature is being used in production
- ✅ Ensure proper health check
- ✅ Consider security implications (network isolation)

### Step 7: Verify Changes

1. **YAML Syntax**: Ensure proper indentation (2 spaces per level)
2. **Environment Variables**: All variables have defaults or are documented
3. **Dependencies**: Service depends_on chains are correct
4. **Volumes**: All referenced volumes are defined
5. **Logs**: All services log to /mnt/data/logs/[service-name]
6. **Platform**: All services specify `platform: linux/amd64` for production

### Step 8: Generate Final Report

Provide comprehensive summary including:
- Environment variables added (with safety analysis)
- New services added (with warnings)
- New volumes defined
- Configuration changes to existing services
- All warnings encountered
- Required follow-up actions

**Example Final Report:**
```
═══════════════════════════════════════════════════════════
         DOCKER COMPOSE SYNC COMPLETE
═══════════════════════════════════════════════════════════

Changes Applied:

Backend Environment Variables (14 added):
  ✓ AI_TAGGING_ENABLED=${AI_TAGGING_ENABLED:-true}
  ✓ AI_STORE_PROMPTS_BY_DEFAULT=${AI_STORE_PROMPTS_BY_DEFAULT:-false}
  ✓ AI_STORE_RESPONSES_BY_DEFAULT=${AI_STORE_RESPONSES_BY_DEFAULT:-false}
  ✓ AI_PRICE_STALE_DAYS=${AI_PRICE_STALE_DAYS:-30}
  ✓ AI_TRACKING_ADMIN_EMAIL=${AI_TRACKING_ADMIN_EMAIL}
  ✓ AI_BUDGET_CHECK_ENABLED=${AI_BUDGET_CHECK_ENABLED:-true}
  ✓ ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
  ✓ PLAYWRIGHT_SERVICE_URL=${PLAYWRIGHT_SERVICE_URL:-http://playwright:5000}
  ✓ FM_SERVER_URL=${FM_SERVER_URL:-https://fms.eceee.org}
  ✓ FM_USERNAME=${FM_USERNAME:-CWPAccount}
  ✓ FM_PASSWORD=${FM_PASSWORD}
  ... (3 more)

New Services (2):
  ⚠ celery - Background task worker
    - Restart policy: unless-stopped
    - Platform: linux/amd64
    - Logs: /mnt/data/logs/celery
    - Depends on: db, redis
  
  ⚠ celery-beat - Scheduled task runner
    - Restart policy: unless-stopped
    - Platform: linux/amd64
    - Logs: /mnt/data/logs/celery
    - Volume: celery_beat_schedule
    - Depends on: db, redis, celery

New Volumes (1):
  ✓ celery_beat_schedule - Persistent scheduler state

Warnings:
  ⚠ HIGH: Celery services will start on next docker-compose up
  ⚠ HIGH: Both services need ALL backend env vars (copied in sync)
  ⚠ MEDIUM: Create /mnt/data/logs/celery directory before starting
  ⚠ MEDIUM: AI_TRACKING_ADMIN_EMAIL env var has no default

Required Actions:
  1. Update production .env file with new variables:
     - AI_TRACKING_ADMIN_EMAIL (optional but recommended)
     - ANTHROPIC_API_KEY (required for AI features)
     - FM_PASSWORD (required for FileMaker integration)
  
  2. Create log directory on production server:
     mkdir -p /mnt/data/logs/celery
     chmod 755 /mnt/data/logs/celery
  
  3. Validate YAML syntax:
     docker-compose -f deploy/docker-compose.production.template.yml config
  
  4. Test after deployment:
     - Verify celery worker starts: docker-compose logs celery
     - Verify celery beat starts: docker-compose logs celery-beat
     - Check task execution: docker-compose exec backend celery -A config inspect active

Next Steps:
  1. Review warnings above
  2. Validate YAML syntax
  3. Review git diff in eceee-components
  4. Commit changes (awaiting approval)
  5. Update production .env
  6. Create log directory
  7. Deploy and test services

═══════════════════════════════════════════════════════════
```

## Safety Checks

Before applying changes:
- ✅ Verify no secrets are hardcoded (use ${VAR} syntax)
- ✅ All services have restart policies
- ✅ Health checks are appropriate
- ✅ Log directories are mounted correctly
- ✅ Platform specifications match production architecture

## Example Usage

When user says: "Sync docker compose to production"

Agent should:
1. Read both docker-compose files
2. Identify all differences (services, env vars, volumes)
3. Perform safety analysis on each difference
4. Categorize changes with warning levels
5. Generate analysis report
6. If CRITICAL warnings exist, warn user and suggest fixes
7. Ask user for approval if HIGH warnings present
8. Apply changes to production template using search_replace
9. Verify YAML syntax
10. Generate final report with all warnings
11. Ask user about committing

## Notes
- Uses **intelligent YAML diff analysis** with safety warnings
- **CRITICAL** warnings block sync until fixed (hardcoded secrets, missing restart policies)
- **HIGH** warnings require user approval (new services, security changes)
- **MEDIUM** warnings are reported but don't block
- Production template uses environment variable substitution: `${VAR:-default}`
- All environment variables must use `${VAR}` or `${VAR:-default}` format (no hardcoded values)
- All services must have restart policies
- All services should log to `/mnt/data/logs/[service-name]/`
- Maintain alphabetical order of environment variables where possible
- Group related environment variables with comments
- Always specify platform for production (typically `linux/amd64`)

## Related Files
- Development production compose: `docker-compose.production.yml`
- Deployment production template: `../eceee-components/deploy/docker-compose.production.template.yml`
- Related settings sync: `.cursor/commands/sync-django-settings-to-production-repo.md`

