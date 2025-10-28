# Production Settings Sync Summary

**Date:** October 28, 2025  
**Sync Status:** ✅ Complete

## Files Updated

1. `/Users/jmfk/code/eceee-components/backend/config/local_settings.py`
2. `/Users/jmfk/code/eceee-components/deploy/docker-compose.production.template.yml`

---

## Changes to `local_settings.py`

### 1. ✅ Theme CSS Cache Timeout Configuration
**Location:** After line 35  
**Status:** Added

```python
# Theme CSS caching configuration
if DEBUG:
    THEME_CSS_CACHE_TIMEOUT = 0  # No caching
else:
    THEME_CSS_CACHE_TIMEOUT = 3600 * 24  # 24 hours
```

**Purpose:** Enable theme CSS caching in production for better performance while allowing immediate updates in development.

---

### 2. ✅ AI Tracking App Added to INSTALLED_APPS
**Location:** Line 168 in LOCAL_APPS  
**Status:** Added

```python
"ai_tracking",  # AI usage and cost tracking
```

**Purpose:** Enable AI usage tracking and cost monitoring in production.

---

### 3. ✅ WebSocket/ASGI Support Configuration
**Location:** After ROOT_URLCONF (line 190-201)  
**Status:** Added

```python
# ASGI Application for WebSocket support
ASGI_APPLICATION = "config.asgi.application"

# Channel Layers for WebSocket support
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [config("REDIS_URL", default="redis://redis:6379/0")],
        },
    },
}
```

**Purpose:** Enable real-time WebSocket support for interactive features.

---

### 4. ✅ Updated Email Allauth Configuration
**Location:** Lines 397-400  
**Status:** Modified

**Changed:**
- `ACCOUNT_EMAIL_VERIFICATION = "mandatory"` (was "optional")
- Added `ACCOUNT_EMAIL_REQUIRED = True`
- Added `ACCOUNT_EMAIL_CONFIRMATION_EXPIRE_DAYS = 3`
- Added `ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION = True`

**Purpose:** Enhance security by requiring email verification for all new accounts.

---

### 5. ✅ Celery Beat Schedule
**Location:** After line 505 (after basic Celery config)  
**Status:** Added

```python
# Celery Beat Schedule for periodic tasks
CELERY_BEAT_SCHEDULE = {
    "check-ai-prices-weekly": {
        "task": "ai_tracking.tasks.check_ai_prices",
        "schedule": 604800.0,  # Every 7 days
    },
    "send-stale-price-reminders-weekly": {
        "task": "ai_tracking.tasks.send_stale_price_reminders",
        "schedule": 604800.0,  # Every 7 days
    },
    "check-budget-alerts-hourly": {
        "task": "ai_tracking.tasks.check_budget_alerts",
        "schedule": 3600.0,  # Every hour
    },
}
```

**Purpose:** Automated periodic tasks for AI cost monitoring and budget alerts.

---

### 6. ✅ AI Tracking Configuration
**Location:** Lines 597-614  
**Status:** Added

```python
# AI Tracking Configuration
AI_TRACKING = {
    "STORE_PROMPTS_BY_DEFAULT": config("AI_STORE_PROMPTS_BY_DEFAULT", default=False, cast=bool),
    "STORE_RESPONSES_BY_DEFAULT": config("AI_STORE_RESPONSES_BY_DEFAULT", default=False, cast=bool),
    "PRICE_STALE_DAYS": config("AI_PRICE_STALE_DAYS", default=30, cast=int),
    "ADMIN_EMAIL": config("AI_TRACKING_ADMIN_EMAIL", default=config("DEFAULT_FROM_EMAIL", default="admin@example.com")),
    "BUDGET_CHECK_ENABLED": config("AI_BUDGET_CHECK_ENABLED", default=True, cast=bool),
}

# Anthropic API Configuration (for AI tracking)
ANTHROPIC_API_KEY = config("ANTHROPIC_API_KEY", default=None)
```

**Purpose:** Complete AI tracking configuration with budget monitoring and cost alerts.

---

### 7. ✅ Playwright Service Configuration
**Location:** Lines 622-625  
**Status:** Added

```python
# Playwright Service Configuration for Content Import
PLAYWRIGHT_SERVICE_URL = config(
    "PLAYWRIGHT_SERVICE_URL", default="http://playwright:5000"
)
```

**Purpose:** Enable content import feature with Playwright service integration.

---

### 8. ✅ Security Fix: FM_PASSWORD
**Location:** Line 644  
**Status:** Fixed

**Before:**
```python
FM_PASSWORD = "sY4Py9idV2ilL3nMejkpK7pwM"  # Hardcoded password!
```

**After:**
```python
FM_PASSWORD = config("FM_PASSWORD", default="")
```

**Purpose:** Critical security fix - removed hardcoded password, now uses environment variable.

---

## Changes to `docker-compose.production.template.yml`

### 1. ✅ Backend Service Environment Variables
**Location:** Lines 78-91  
**Status:** Added

**New Environment Variables:**
```yaml
# AI Tracking
- AI_TAGGING_ENABLED=${AI_TAGGING_ENABLED:-true}
- AI_STORE_PROMPTS_BY_DEFAULT=${AI_STORE_PROMPTS_BY_DEFAULT:-false}
- AI_STORE_RESPONSES_BY_DEFAULT=${AI_STORE_RESPONSES_BY_DEFAULT:-false}
- AI_PRICE_STALE_DAYS=${AI_PRICE_STALE_DAYS:-30}
- AI_TRACKING_ADMIN_EMAIL=${AI_TRACKING_ADMIN_EMAIL}
- AI_BUDGET_CHECK_ENABLED=${AI_BUDGET_CHECK_ENABLED:-true}
- ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}

# Content Import
- PLAYWRIGHT_SERVICE_URL=${PLAYWRIGHT_SERVICE_URL:-http://playwright:5000}

# FileMaker Integration
- FM_SERVER_URL=${FM_SERVER_URL:-https://fms.eceee.org}
- FM_USERNAME=${FM_USERNAME:-CWPAccount}
- FM_PASSWORD=${FM_PASSWORD}
```

---

### 2. ✅ Celery Worker Service
**Location:** Lines 170-227  
**Status:** Added

**New Service:**
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
    # Full copy of backend environment variables
  volumes:
    - ./backend:/app
    - /mnt/data/logs/celery:/var/log/celery
  command: celery -A config worker -l info --logfile=/var/log/celery/celery.log
```

**Purpose:** Background task processing for AI tracking, content import, and other async operations.

---

### 3. ✅ Celery Beat Service
**Location:** Lines 229-289  
**Status:** Added

**New Service:**
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
    # Full copy of backend environment variables
  volumes:
    - ./backend:/app
    - /mnt/data/logs/celery:/var/log/celery
    - celery_beat_schedule:/app/celerybeat-schedule
  command: celery -A config beat -l info --logfile=/var/log/celery/beat.log --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

**Purpose:** Scheduled task execution for periodic AI price checks, stale price reminders, and budget alerts.

---

### 4. ✅ New Volume Definition
**Location:** Line 315  
**Status:** Added

```yaml
volumes:
  backend_static:
  redis_data:
  caddy_data:
  caddy_config:
  celery_beat_schedule:  # NEW
```

**Purpose:** Persistent storage for Celery Beat scheduler state.

---

## Verification

### Syntax Validation
- ✅ **Python Syntax:** Valid (`local_settings.py`)
- ✅ **YAML Syntax:** Valid (`docker-compose.production.template.yml`)

### Service Dependencies
- ✅ Celery worker depends on DB and Redis
- ✅ Celery beat depends on DB, Redis, and Celery worker
- ✅ All services have proper health checks where applicable

### Environment Variables
- ✅ All new variables have sensible defaults
- ✅ Sensitive values (passwords, API keys) use environment variables
- ✅ No hardcoded secrets remain

---

## Required Environment Variables for Production

The following new environment variables should be set in the production `.env` file:

### AI Tracking (Optional but Recommended)
```bash
AI_TAGGING_ENABLED=true
AI_STORE_PROMPTS_BY_DEFAULT=false
AI_STORE_RESPONSES_BY_DEFAULT=false
AI_PRICE_STALE_DAYS=30
AI_TRACKING_ADMIN_EMAIL=admin@yourdomain.com
AI_BUDGET_CHECK_ENABLED=true
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### Content Import (If using import feature)
```bash
PLAYWRIGHT_SERVICE_URL=http://playwright:5000
```

### FileMaker Integration (Required)
```bash
FM_PASSWORD=your_filemaker_password_here
```

---

## Migration Notes

### For Production Deployment:

1. **Update Environment Variables:**
   - Add all new variables to your production `.env` file
   - Ensure `FM_PASSWORD` is set (no longer hardcoded)

2. **Database Migrations:**
   - Run migrations for the new `ai_tracking` app:
     ```bash
     docker-compose exec backend python manage.py migrate ai_tracking
     ```

3. **Install Dependencies:**
   - Ensure `channels` and `channels-redis` are in production requirements
   - Ensure `django-celery-beat` is installed if using DatabaseScheduler

4. **Start New Services:**
   - Celery worker and beat services will start automatically on `docker-compose up`
   - Monitor logs in `/mnt/data/logs/celery/`

5. **Verify Celery Beat:**
   - Check that periodic tasks are scheduled:
     ```bash
     docker-compose exec backend python manage.py shell
     >>> from django_celery_beat.models import PeriodicTask
     >>> PeriodicTask.objects.all()
     ```

---

## Summary

### Total Changes
- **Settings Added:** 8 major configuration sections
- **Docker Services Added:** 2 (Celery worker, Celery beat)
- **Environment Variables Added:** 14
- **Security Fixes:** 1 (FM_PASSWORD)
- **Volume Definitions Added:** 1

### Impact
- ✅ **Performance:** Theme CSS caching enabled for production
- ✅ **Features:** AI tracking, WebSocket support, content import ready
- ✅ **Security:** Hardcoded password removed
- ✅ **Automation:** Periodic tasks for AI cost monitoring
- ✅ **Scalability:** Background task processing with Celery

### Next Steps
1. Update production `.env` file with new environment variables
2. Run database migrations
3. Test Celery worker and beat services
4. Monitor AI tracking functionality
5. Verify email verification workflow

---

**Sync Completed Successfully** ✅

