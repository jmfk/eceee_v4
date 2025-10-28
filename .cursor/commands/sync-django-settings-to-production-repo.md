# Cursor Command: Sync Django Settings to Production

## Purpose
Sync new Django settings and configurations from the development `backend/config/settings.py` to the production deployment repository at `../eceee-components/backend/config/local_settings.py`.

## Sync Method
This command uses **intelligent diff analysis** with safety warnings. Changes are applied manually using search_replace after thorough analysis and categorization.

## Instructions for Agent

### Step 1: Compare Settings Files

1. **Read both files:**
   - Development: `/Users/jmfk/code/eceee_v4/backend/config/settings.py`
   - Production: `/Users/jmfk/code/eceee-components/backend/config/local_settings.py`

2. **Identify differences** focusing on:
   - New INSTALLED_APPS entries
   - New MIDDLEWARE entries
   - New configuration sections
   - New environment variables using `config()`
   - New feature flags or settings

3. **Perform safety analysis** on each difference (see Step 1.1 below)

### Step 1.1: Safety Analysis for Each Difference

For each identified difference, check:

**CRITICAL Warnings (DO NOT SYNC):**
- ⚠ **CRITICAL**: Hardcoded passwords, API keys, or secrets (not using `config()`)
- ⚠ **CRITICAL**: `DEBUG = True` (production must be False)
- ⚠ **CRITICAL**: `ALLOWED_HOSTS = []` (empty, will break production)
- ⚠ **CRITICAL**: Disabled security middleware
- ⚠ **CRITICAL**: `SECRET_KEY` hardcoded

**HIGH Warnings (Sync with caution):**
- ⚠ **HIGH**: Security settings changes (CSRF, CORS, CSP)
- ⚠ **HIGH**: Authentication backend changes
- ⚠ **HIGH**: Database configuration changes
- ⚠ **HIGH**: Email backend changes
- ⚠ **HIGH**: ALLOWED_HOSTS modifications

**MEDIUM Warnings (Review recommended):**
- ⚠ **MEDIUM**: New development-only apps (debug_toolbar, django_extensions)
- ⚠ **MEDIUM**: Cache timeout changes that could affect performance
- ⚠ **MEDIUM**: New feature flags that change application behavior
- ⚠ **MEDIUM**: Logging configuration changes

**INFO (Safe to sync):**
- ℹ **INFO**: New production-relevant apps
- ℹ **INFO**: New environment variables with proper `config()` usage
- ℹ **INFO**: New configuration sections for features
- ℹ **INFO**: Documentation or comment changes

### Step 2: Categorize Changes

Classify each difference as:
- **SYNC**: Production-relevant features that should be added (with INFO or safe warnings)
- **DEV_ONLY**: Development-only features (debug toolbar, extensions, etc.)
- **DIFFERENT_BY_DESIGN**: Settings that intentionally differ (DEBUG, security settings)
- **BLOCKED**: Changes with CRITICAL warnings that must not be synced

Generate categorization report:
```
Settings Analysis Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SYNC (8 changes) - Safe to apply:
  ✓ Add ai_tracking to INSTALLED_APPS
  ✓ Add ASGI_APPLICATION configuration
  ✓ Add CELERY_BEAT_SCHEDULE
  ✓ Add AI_TRACKING configuration dict
  ✓ Add PLAYWRIGHT_SERVICE_URL with config()
  ✓ Add THEME_CSS_CACHE_TIMEOUT
  ⚠ MEDIUM: Add WebSocket CHANNEL_LAYERS (review settings)
  ⚠ HIGH: Update ACCOUNT_EMAIL_VERIFICATION (auth behavior change)

DEV_ONLY (3 changes) - Do not sync:
  ⊗ django_extensions in INSTALLED_APPS
  ⊗ DebugToolbarMiddleware in MIDDLEWARE
  ⊗ SHELL_PLUS settings

DIFFERENT_BY_DESIGN (2 changes) - Keep separate:
  ⊗ DEBUG value (dev=True, prod=False)
  ⊗ INTERNAL_IPS (dev-only setting)

BLOCKED (1 change) - Must fix first:
  ⚠ CRITICAL: FM_PASSWORD hardcoded in settings
     Action: Replace with config("FM_PASSWORD", default="")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Summary:
  To sync: 8 changes (6 safe, 2 with warnings)
  To skip: 5 changes
  Blocked: 1 change (requires fix)

Recommendations:
  1. Fix BLOCKED issues first
  2. Review HIGH and MEDIUM warnings
  3. Apply SYNC changes
  4. Verify production settings remain secure
```

### Step 3: Settings to Always Sync
Update production `local_settings.py` with these categories:

#### New Apps and Middleware
- New apps in LOCAL_APPS (except dev tools like `django_extensions`, `debug_toolbar`)
- Production-safe middleware (exclude `DevAutoLoginMiddleware`, `DebugToolbarMiddleware`)

#### New Feature Configurations
- Cache timeout settings (LAYOUT_CACHE_TIMEOUT, THEME_CSS_CACHE_TIMEOUT)
- WebSocket/ASGI configuration (ASGI_APPLICATION, CHANNEL_LAYERS)
- Celery Beat schedules (CELERY_BEAT_SCHEDULE)
- AI tracking settings (AI_TRACKING dict, ANTHROPIC_API_KEY)
- Service URLs (PLAYWRIGHT_SERVICE_URL, etc.)
- File upload settings (MEDIA_FILE_MAX_SIZE, MEDIA_ALLOWED_TYPES)

#### Security Fixes
- Replace hardcoded sensitive values with `config()` calls
- Example: `FM_PASSWORD = config("FM_PASSWORD", default="")`

#### Email Configuration Updates
- Allauth settings (ACCOUNT_EMAIL_VERIFICATION, etc.)
- Email backend configuration

### Step 4: Settings to Never Sync
Do NOT sync these to production:
- `DEBUG = True` (production must be False)
- `ALLOWED_HOSTS = ["*"]` structure (both use it but keep separate)
- Development tools: `django_extensions`, `debug_toolbar`, `django_prometheus`
- `INTERNAL_IPS` configuration
- `SHELL_PLUS` settings
- Production-specific: Sentry, CSP headers, JSON logging

### Step 5: Apply Changes to Production local_settings.py

For each identified change to sync:

1. **Add Theme CSS Cache Configuration** (if missing)
   - Location: After LAYOUT_CACHE_ENABLED settings (~line 35)
   - Add with DEBUG conditional:
   ```python
   # Theme CSS caching configuration
   if DEBUG:
       THEME_CSS_CACHE_TIMEOUT = 0  # No caching
   else:
       THEME_CSS_CACHE_TIMEOUT = 3600 * 24  # 24 hours
   ```

2. **Add New Apps to LOCAL_APPS** (if missing)
   - Location: LOCAL_APPS list (~line 146)
   - Add: `"ai_tracking"` and any other new production-relevant apps

3. **Add ASGI/WebSocket Support** (if missing)
   - Location: After ROOT_URLCONF (~line 176)
   - Add full ASGI_APPLICATION and CHANNEL_LAYERS configuration

4. **Add Celery Beat Schedule** (if missing)
   - Location: After basic Celery config (~line 478)
   - Add complete CELERY_BEAT_SCHEDULE dict

5. **Add AI Tracking Configuration** (if missing)
   - Location: After AI_TAGGING_ENABLED (~line 552)
   - Add AI_TRACKING dict and ANTHROPIC_API_KEY

6. **Add Service URLs** (if missing)
   - Location: After imgproxy config (~line 558)
   - Add PLAYWRIGHT_SERVICE_URL

7. **Fix Security Issues**
   - Replace any hardcoded passwords/secrets with config() calls

8. **Update Email Settings** (if changed)
   - Update ACCOUNT_EMAIL_VERIFICATION and related fields
   - Keep production email backend differences

### Step 6: Verify Changes
1. Check that all additions are properly indented
2. Ensure no duplicate settings
3. Verify all `config()` calls have appropriate defaults
4. Confirm production-safe defaults (e.g., DEBUG=False maintained)

### Step 7: Generate Final Report

Provide a comprehensive summary including:
- Settings added (categorized by safety level)
- Settings modified
- Security fixes applied
- Any settings that were intentionally not synced
- All warnings encountered
- Required follow-up actions

**Example Final Report:**
```
═══════════════════════════════════════════════════════════
            DJANGO SETTINGS SYNC COMPLETE
═══════════════════════════════════════════════════════════

Changes Applied (8):
  ✓ Added ai_tracking to INSTALLED_APPS
  ✓ Added ASGI_APPLICATION configuration
  ✓ Added CELERY_BEAT_SCHEDULE with periodic tasks
  ✓ Added AI_TRACKING configuration dict
  ✓ Added PLAYWRIGHT_SERVICE_URL = config("PLAYWRIGHT_SERVICE_URL", ...)
  ✓ Added THEME_CSS_CACHE_TIMEOUT (24 hours in production)
  ⚠ Added CHANNEL_LAYERS for WebSocket support
  ⚠ Updated ACCOUNT_EMAIL_VERIFICATION to "mandatory"

Security Fixes (1):
  ✓ Replaced FM_PASSWORD hardcoded value with config("FM_PASSWORD", default="")

Intentionally Skipped (5):
  ⊗ django_extensions (dev-only)
  ⊗ debug_toolbar (dev-only)
  ⊗ DebugToolbarMiddleware (dev-only)
  ⊗ SHELL_PLUS settings (dev-only)
  ⊗ INTERNAL_IPS (dev-only)

Preserved Differences:
  ⊗ DEBUG remains False in production
  ⊗ Production-specific Sentry configuration preserved
  ⊗ Production CSP headers preserved

Warnings:
  ⚠ MEDIUM: CHANNEL_LAYERS config added - review Redis settings
  ⚠ HIGH: Email verification now mandatory - may affect user registration

Required Actions:
  1. Update production .env file with new environment variables:
     - AI_TRACKING_ADMIN_EMAIL
     - ANTHROPIC_API_KEY
     - PLAYWRIGHT_SERVICE_URL (optional)
     - FM_PASSWORD (if using FileMaker integration)
  
  2. Run database migrations:
     - django_celery_beat (for CELERY_BEAT_SCHEDULE)
     - ai_tracking (new app)
  
  3. Test affected features:
     - User registration (email verification)
     - Celery Beat scheduler
     - WebSocket connections (if using)

Next Steps:
  1. Review warnings above
  2. Review git diff in eceee-components
  3. Commit changes (awaiting approval)
  4. Update production .env
  5. Deploy and test

═══════════════════════════════════════════════════════════
```

## Example Usage

When user says: "Sync new Django settings to production"

Agent should:
1. Read both settings files (settings.py and local_settings.py)
2. Identify all differences
3. Perform safety analysis on each difference
4. Categorize as SYNC/DEV_ONLY/DIFFERENT_BY_DESIGN/BLOCKED
5. Generate analysis report showing warnings
6. If BLOCKED items exist, warn user and suggest fixes
7. Ask user for approval if HIGH warnings present
8. Apply SYNC category changes to production local_settings.py using search_replace
9. Verify changes (Python syntax, no duplicates)
10. Generate final report with all warnings
11. Ask user about committing

## Notes
- Production local_settings.py path: `../eceee-components/backend/config/local_settings.py`
- Uses **intelligent safety analysis** with categorized warnings
- **CRITICAL** warnings block sync until fixed
- **HIGH** warnings require user approval
- **MEDIUM** warnings are reported but don't block
- Always preserve production-specific configurations (Sentry, CSP, JSON logging)
- Maintain production security posture (DEBUG=False, proper SECRET_KEY validation)
- Keep production and development differences where appropriate
- Focus on feature parity, not exact duplication
- All hardcoded secrets must use `config()` before syncing

## Related Files
- Development settings: `backend/config/settings.py`
- Production settings: `../eceee-components/backend/config/local_settings.py`
- Production docker-compose: `../eceee-components/deploy/docker-compose.production.template.yml`

