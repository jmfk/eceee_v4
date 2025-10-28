# Cursor Command: Sync All to eceee-components

## Purpose
Master command to sync all eceee_v4 development changes to the eceee-components deployment repository. This orchestrates multiple sync operations in the correct order with comprehensive safety analysis.

## Sync Method
This command uses **programmatic file operations and intelligent diff analysis** with safety warnings across all sync operations. No rsync commands are used - all file operations use AI tools (read_file, write, grep, etc.).

## What Gets Synced

This command executes three sub-commands in sequence:

1. **Django Settings Sync** → `sync-django-settings-to-production-repo.md`
   - Uses intelligent diff analysis with safety categorization
   - Manual edits via search_replace after approval
   
2. **Docker Compose Sync** → `sync-docker-compose-to-production-repo.md`
   - Uses YAML diff analysis with safety warnings
   - Manual edits via search_replace after approval
   
3. **Widgets & Layouts Sync** → `sync-widgets-layouts-to-eceee-components.md`
   - Uses programmatic file operations (read_file, write)
   - Each file analyzed for production safety before syncing

## Instructions for Agent

### Overview

When user says: **"Sync everything to eceee-components"** or **"Sync all to production"**

Execute all three sync operations following this workflow:

```
┌─────────────────────────────────────────────────────────┐
│                    PRE-SYNC CHECKS                      │
│  • Verify both repositories exist                      │
│  • Check for uncommitted critical changes              │
│  • Ensure development environment is working           │
│  • Scan for debug statements across all files          │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│              STEP 1: DJANGO SETTINGS SYNC               │
│  • Compare settings.py vs local_settings.py            │
│  • Perform safety analysis (CRITICAL/HIGH/MEDIUM/INFO) │
│  • Categorize changes (SYNC/DEV_ONLY/DIFFERENT/BLOCKED)│
│  • Generate analysis report with warnings              │
│  • Ask approval for HIGH warnings                      │
│  • Apply approved changes via search_replace           │
│  File: sync-django-settings-to-production-repo.md      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│           STEP 2: DOCKER COMPOSE SYNC                   │
│  • Compare docker-compose files                        │
│  • Perform safety analysis on all differences          │
│  • Check for hardcoded secrets, missing restart policy │
│  • Generate analysis report with warnings              │
│  • Ask approval for HIGH warnings                      │
│  • Apply approved changes via search_replace           │
│  • Validate YAML syntax                                │
│  File: sync-docker-compose-to-production-repo.md       │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│           STEP 3: WIDGETS & LAYOUTS SYNC                │
│  • Discover all files (glob_file_search)              │
│  • Analyze each file for safety (print, console.log)   │
│  • Categorize as SAFE/WARN/SKIP/ERROR                 │
│  • Generate analysis report                            │
│  • Ask approval for WARN files                         │
│  • Copy approved files (read_file → write)             │
│  • Verify Python syntax on synced files                │
│  File: sync-widgets-layouts-to-eceee-components.md     │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                 POST-SYNC VERIFICATION                  │
│  • Verify all syncs completed successfully             │
│  • Consolidate all warnings from all steps             │
│  • Generate comprehensive change report                │
│  • Show git diff summary                               │
│  • Ask user about committing changes                   │
└─────────────────────────────────────────────────────────┘
```

### Step 0: Pre-Sync Validation

Before starting any sync operations, verify:

1. **Repository Existence:**
   ```bash
   # Check eceee_v4 exists
   test -d /Users/jmfk/code/eceee_v4 && echo "✓ eceee_v4 exists" || echo "✗ eceee_v4 not found"
   
   # Check eceee-components exists
   test -d /Users/jmfk/code/eceee-components && echo "✓ eceee-components exists" || echo "✗ eceee-components not found"
   ```

2. **Development Environment Status:**
   ```bash
   cd /Users/jmfk/code/eceee_v4
   
   # Check for uncommitted changes
   git status --short
   
   # Verify Docker services are running (if applicable)
   docker-compose ps
   ```

3. **Critical Files Exist:**
   ```bash
   # Source files
   test -f /Users/jmfk/code/eceee_v4/backend/config/settings.py || echo "⚠ settings.py missing"
   test -f /Users/jmfk/code/eceee_v4/docker-compose.production.yml || echo "⚠ docker-compose.production.yml missing"
   test -d /Users/jmfk/code/eceee_v4/backend/eceee_widgets || echo "⚠ eceee_widgets missing"
   test -d /Users/jmfk/code/eceee_v4/backend/eceee_layouts || echo "⚠ eceee_layouts missing"
   
   # Destination files
   test -f /Users/jmfk/code/eceee-components/backend/config/local_settings.py || echo "⚠ local_settings.py missing"
   test -f /Users/jmfk/code/eceee-components/deploy/docker-compose.production.template.yml || echo "⚠ docker-compose template missing"
   ```

4. **Ask User for Confirmation:**
   ```
   About to sync all changes from eceee_v4 to eceee-components:
   
   This will sync:
   ✓ Django settings (new configs, AI tracking, security fixes)
   ✓ Docker Compose (services, environment variables)
   ✓ Widgets and Layouts (backend + frontend)
   
   Target repository: /Users/jmfk/code/eceee-components
   
   Continue? (This will modify files in eceee-components)
   ```

### Step 1: Execute Django Settings Sync

Follow the instructions in `.cursor/commands/sync-django-settings-to-production-repo.md`:

1. Compare `settings.py` with `local_settings.py`
2. Identify changes to sync (categorize as SYNC/DEV_ONLY/DIFFERENT_BY_DESIGN)
3. Apply production-relevant changes
4. Verify Python syntax
5. Generate settings sync report

**Expected Output:**
```
✓ Django Settings Sync Complete
  - Theme CSS cache: Added
  - AI tracking app: Added
  - WebSocket/ASGI support: Added
  - Celery Beat schedule: Added
  - AI tracking config: Added
  - Playwright service URL: Added
  - Security fix (FM_PASSWORD): Applied
  - Email verification: Updated to mandatory
```

### Step 2: Execute Docker Compose Sync

Follow the instructions in `.cursor/commands/sync-docker-compose-to-production-repo.md`:

1. Compare docker-compose files
2. Add new environment variables to backend service
3. Add Celery worker service
4. Add Celery beat service
5. Add volume definitions
6. Verify YAML syntax
7. Generate docker-compose sync report

**Expected Output:**
```
✓ Docker Compose Sync Complete
  - Environment variables: 14 added
  - Services added: 2 (celery, celery-beat)
  - Volumes added: 1 (celery_beat_schedule)
  - YAML syntax: Valid
```

### Step 3: Execute Widgets & Layouts Sync

Follow the instructions in `.cursor/commands/sync-widgets-layouts-to-eceee-components.md`:

1. Run pre-sync verification (syntax checks, registry validation)
2. Sync backend widgets
3. Sync backend layouts
4. Sync frontend widget editors
5. Run post-sync verification
6. Generate widgets/layouts sync report

**Sync Method (Programmatic):**

Execute the detailed steps from `sync-widgets-layouts-to-eceee-components.md`:

1. **Discover Files:** Use glob_file_search to find all files in:
   - `/Users/jmfk/code/eceee_v4/backend/eceee_widgets/`
   - `/Users/jmfk/code/eceee_v4/backend/eceee_layouts/`
   - `/Users/jmfk/code/eceee_v4/frontend/src/widget-editors/`

2. **Analyze Each File:** Check for:
   - Debug statements (print, console.log, debugger)
   - TODO/FIXME comments
   - Hardcoded development URLs
   - Syntax errors
   - Auto-skip patterns (__pycache__, .pyc, .DS_Store)

3. **Categorize:** SAFE / WARN / SKIP / ERROR

4. **Get Approval:** Ask user for approval if WARN files exist

5. **Execute Sync:** For each approved file:
   - Read file content using read_file
   - Write to destination using write tool
   - Track progress

6. **Verify:** Python syntax validation on all .py files

**Expected Output:**
```
✓ Widgets & Layouts Sync Complete
  - Backend widgets: 15 files synced (12 safe, 3 with warnings)
  - Backend layouts: 8 files synced (all safe)
  - Frontend editors: 10 files synced (9 safe, 1 with warning)
  - Skipped: 4 files (cache/metadata)
  - Warnings: 4 files (debug statements, TODOs)
```

### Step 4: Post-Sync Verification

After all syncs complete:

1. **Verify File Integrity:**
   ```bash
   cd /Users/jmfk/code/eceee-components
   
   # Python syntax check
   python -m py_compile backend/config/local_settings.py
   find backend/eceee_widgets -name "*.py" -exec python -m py_compile {} \; 2>&1 | grep -v "Permission denied"
   find backend/eceee_layouts -name "*.py" -exec python -m py_compile {} \; 2>&1 | grep -v "Permission denied"
   
   # YAML syntax check
   docker-compose -f deploy/docker-compose.production.template.yml config > /dev/null 2>&1 && echo "✓ YAML valid"
   ```

2. **Check Git Status:**
   ```bash
   cd /Users/jmfk/code/eceee-components
   git status --short | head -20
   echo "..."
   git status --short | tail -5
   echo ""
   echo "Total files changed:" $(git status --short | wc -l)
   ```

3. **Generate File Diff Summary:**
   ```bash
   cd /Users/jmfk/code/eceee-components
   
   echo "=== Settings Changes ==="
   git diff --stat backend/config/local_settings.py
   
   echo "=== Docker Compose Changes ==="
   git diff --stat deploy/docker-compose.production.template.yml
   
   echo "=== Widget Changes ==="
   git diff --stat backend/eceee_widgets/
   
   echo "=== Layout Changes ==="
   git diff --stat backend/eceee_layouts/
   
   echo "=== Frontend Editor Changes ==="
   git diff --stat frontend/src/widget-editors/
   ```

### Step 5: Generate Comprehensive Report

Create a consolidated report of all changes with aggregated warnings:

```markdown
═══════════════════════════════════════════════════════════
               COMPREHENSIVE SYNC REPORT
═══════════════════════════════════════════════════════════
Date: [Current Date]
Source: eceee_v4
Destination: eceee-components

## SUMMARY
- ✓ Django Settings: [X] changes applied
- ✓ Docker Compose: [Y] changes applied ([Z] services added)
- ✓ Widgets & Layouts: [N] files synced
- ⚠ Total Warnings: [W] across all syncs

## 1. DJANGO SETTINGS SYNC

Changes Applied (8):
  ✓ Added ai_tracking to INSTALLED_APPS
  ✓ Added ASGI_APPLICATION configuration
  ✓ Added CELERY_BEAT_SCHEDULE
  ✓ Added AI_TRACKING configuration dict
  ✓ Added PLAYWRIGHT_SERVICE_URL with config()
  ✓ Added THEME_CSS_CACHE_TIMEOUT
  ⚠ Added CHANNEL_LAYERS for WebSocket support
  ⚠ Updated ACCOUNT_EMAIL_VERIFICATION to "mandatory"

Security Fixes (1):
  ✓ Replaced FM_PASSWORD hardcoded value with config()

Skipped (5):
  ⊗ django_extensions, debug_toolbar (dev-only)
  ⊗ DEBUG value (different by design)

Warnings:
  ⚠ MEDIUM: CHANNEL_LAYERS config added
  ⚠ HIGH: Email verification now mandatory

## 2. DOCKER COMPOSE SYNC

Changes Applied:
  - Environment variables: 14 added to backend service
  - Services: 2 added (celery, celery-beat)
  - Volumes: 1 added (celery_beat_schedule)

Warnings:
  ⚠ HIGH: Celery services will start on docker-compose up
  ⚠ MEDIUM: Create /mnt/data/logs/celery directory
  ⚠ MEDIUM: AI_TRACKING_ADMIN_EMAIL has no default

## 3. WIDGETS & LAYOUTS SYNC

Files Synced (33):
  - Backend widgets: 15 files (12 safe, 3 warnings)
  - Backend layouts: 8 files (all safe)
  - Frontend editors: 10 files (9 safe, 1 warning)
  - Skipped: 4 files (cache/metadata)

Warnings:
  ⚠ HIGH: events_widget.py contains print() (line 45)
  ⚠ HIGH: GalleryWidgetEditor.jsx contains console.log() (line 23)
  ⚠ MEDIUM: main_layout.py contains FIXME (line 67)
  ⚠ MEDIUM: TableWidgetEditor.jsx contains TODO (line 112)

## CONSOLIDATED WARNINGS

CRITICAL (0):
  None - all critical issues resolved before sync

HIGH (4):
  ⚠ Email verification now mandatory (Django settings)
  ⚠ Celery services will auto-start (Docker Compose)
  ⚠ events_widget.py contains print() statement
  ⚠ GalleryWidgetEditor.jsx contains console.log()

MEDIUM (5):
  ⚠ CHANNEL_LAYERS WebSocket config added
  ⚠ /mnt/data/logs/celery directory needs creation
  ⚠ AI_TRACKING_ADMIN_EMAIL env var has no default
  ⚠ main_layout.py contains FIXME comment
  ⚠ TableWidgetEditor.jsx contains TODO comment

## FILES CHANGED

Total: [X] files modified across eceee-components

By Category:
  - Configuration: 2 files (settings.py, docker-compose.yml)
  - Backend widgets: 15 files
  - Backend layouts: 8 files
  - Frontend editors: 10 files
  - Templates: 16 files

Git Status:
  M  backend/config/local_settings.py
  M  deploy/docker-compose.production.template.yml
  M  backend/eceee_widgets/ (15 files)
  M  backend/eceee_layouts/ (8 files)
  M  frontend/src/widget-editors/ (10 files)

## REQUIRED ACTIONS

Pre-Deployment:
  1. [ ] Update production .env file with new variables:
      - AI_TRACKING_ADMIN_EMAIL (optional but recommended)
      - ANTHROPIC_API_KEY (required for AI features)
      - PLAYWRIGHT_SERVICE_URL (optional)
      - FM_PASSWORD (required for FileMaker integration)
  
  2. [ ] Create log directory on production server:
      mkdir -p /mnt/data/logs/celery
      chmod 755 /mnt/data/logs/celery
  
  3. [ ] Run database migrations:
      - django_celery_beat (for scheduler)
      - ai_tracking (new app)

Post-Deployment Testing:
  4. [ ] Test user registration (email verification mandatory)
  5. [ ] Test Celery worker and beat services
  6. [ ] Test WebSocket connections (if using)
  7. [ ] Verify widget/layout functionality
  8. [ ] Check for console errors in frontend

Code Cleanup (Non-blocking):
  9. [ ] Remove print() from events_widget.py (line 45)
  10. [ ] Remove console.log() from GalleryWidgetEditor.jsx (line 23)
  11. [ ] Address FIXME in main_layout.py (line 67)
  12. [ ] Address TODO in TableWidgetEditor.jsx (line 112)

## NEXT STEPS

1. Review consolidated warnings above
2. Review git diff in eceee-components:
   cd /Users/jmfk/code/eceee-components
   git diff
3. Commit changes (awaiting approval)
4. Update production .env file
5. Create required directories
6. Deploy to production
7. Run migrations
8. Test all affected features
9. Address code cleanup items

## BREAKING CHANGES

- Email verification is now mandatory for new users
- Celery services will start automatically (may need resource allocation)

## NEW ENVIRONMENT VARIABLES

Required:
  - ANTHROPIC_API_KEY
  - FM_PASSWORD

Optional (with defaults):
  - AI_TAGGING_ENABLED (default: true)
  - AI_STORE_PROMPTS_BY_DEFAULT (default: false)
  - AI_STORE_RESPONSES_BY_DEFAULT (default: false)
  - AI_PRICE_STALE_DAYS (default: 30)
  - AI_BUDGET_CHECK_ENABLED (default: true)
  - PLAYWRIGHT_SERVICE_URL (default: http://playwright:5000)
  - FM_SERVER_URL (default: https://fms.eceee.org)
  - FM_USERNAME (default: CWPAccount)

Optional (no default):
  - AI_TRACKING_ADMIN_EMAIL

═══════════════════════════════════════════════════════════
```

### Step 6: Ask for Commit Approval

**CRITICAL:** Never commit without explicit user approval.

Present the report and ask:

```
═══════════════════════════════════════════════════════════
                    SYNC COMPLETE
═══════════════════════════════════════════════════════════

All changes have been synced to eceee-components.

Total changes:
- Django Settings: X modifications
- Docker Compose: Y modifications + Z services
- Widgets: N files
- Layouts: M files
- Frontend Editors: P files

Files changed: [TOTAL] files

Review the changes:
  cd /Users/jmfk/code/eceee-components
  git diff
  git status

Would you like me to commit these changes to eceee-components?

If yes, I'll create a commit with a detailed message summarizing all synced changes.
```

### Step 7: Commit (If Approved)

Only if user explicitly approves:

```bash
cd /Users/jmfk/code/eceee-components

# Add all synced files
git add backend/config/local_settings.py
git add deploy/docker-compose.production.template.yml
git add backend/eceee_widgets/
git add backend/eceee_layouts/
git add frontend/src/widget-editors/

# Create comprehensive commit message
git commit -m "Sync all changes from eceee_v4 development

Django Settings:
- Added Theme CSS cache configuration
- Added ai_tracking app
- Added WebSocket/ASGI support
- Added Celery Beat schedule
- Added AI tracking configuration
- Added Playwright service URL
- Fixed FM_PASSWORD security issue
- Updated email verification to mandatory

Docker Compose:
- Added 14 new environment variables (AI tracking, content import, FileMaker)
- Added Celery worker service
- Added Celery beat service
- Added celery_beat_schedule volume

Widgets & Layouts:
- Synced [N] widgets
- Synced [M] layouts
- Synced [P] frontend editors
- Updated widget templates

Total files changed: [X]
"
```

## Error Handling

### If Django Settings Sync Fails
- Stop the entire sync process
- Report the specific error
- Ask user how to proceed
- Don't continue to Docker Compose or Widgets sync

### If Docker Compose Sync Fails
- Report the error
- Settings sync is already complete (can't rollback easily)
- Ask user if they want to continue with Widgets sync
- Suggest manual fix for Docker Compose issues

### If Widgets/Layouts Sync Fails
- Report the error
- Settings and Docker Compose already synced
- Ask if user wants to retry just the widgets sync
- Suggest checking file permissions or paths

### If Verification Fails
- Report which verification step failed
- Show the specific error
- Ask user if they want to proceed anyway
- Suggest fixes before committing

## Common Issues and Solutions

### Issue: eceee-components Has Uncommitted Changes
**Solution:**
```
⚠ Warning: eceee-components has uncommitted changes.
  
Would you like to:
  a) Stash changes and proceed
  b) Abort sync
  c) Proceed anyway (changes will be mixed)
```

### Issue: File Permission Errors
**Solution:**
```bash
# Fix permissions before syncing
chmod -R u+w /Users/jmfk/code/eceee-components/backend/eceee_widgets/
chmod -R u+w /Users/jmfk/code/eceee-components/backend/eceee_layouts/
```

### Issue: Rsync Command Not Found
**Solution:**
Use the Makefile command instead: `make sync-to`

### Issue: Sync Deletes Important Files
**Prevention:**
Always review `git status` and `git diff` before committing

## Quick Reference

### Full Sync Command (One-liner)
When user says: "Sync all to eceee-components"

Execute:
1. Pre-sync validation
2. Django settings sync (see command file)
3. Docker compose sync (see command file)
4. Widgets/layouts sync (see command file)
5. Post-sync verification
6. Generate report
7. Ask for commit approval

### Individual Sync Commands
If user wants to sync only specific parts:
- "Sync settings only" → Execute Step 1 only
- "Sync docker-compose only" → Execute Step 2 only
- "Sync widgets only" → Execute Step 3 only

### Rollback
If sync went wrong:
```bash
cd /Users/jmfk/code/eceee-components
git reset --hard HEAD  # Discard all changes
# Or for specific files:
git checkout HEAD -- backend/config/local_settings.py
```

## Success Criteria

The sync is successful when:
- ✅ All three sync operations complete without errors
- ✅ Python syntax validation passes
- ✅ YAML syntax validation passes
- ✅ Widget/layout registries load successfully
- ✅ Git diff shows expected changes only
- ✅ No unexpected file deletions
- ✅ User approves the changes

## Related Files

- **Django Settings Command:** `.cursor/commands/sync-django-settings-to-production-repo.md`
- **Docker Compose Command:** `.cursor/commands/sync-docker-compose-to-production-repo.md`
- **Widgets/Layouts Command:** `.cursor/commands/sync-widgets-layouts-to-eceee-components.md`
- **Makefile Sync Commands:** `Makefile` (sync-to, sync-from)
- **Sync Scripts:** `sync-to-eceee-components.sh`, `sync-from-eceee-components.sh`

## Best Practices

1. **Always Test First:** Ensure development environment works before syncing
2. **Fix Critical Issues First:** Address all CRITICAL warnings before proceeding
3. **Review Warnings Carefully:** Understand all HIGH and MEDIUM warnings
4. **Clean Code:** Remove debug statements (print, console.log) before syncing
5. **Security First:** Never sync hardcoded secrets - always use config() or ${VAR}
6. **Review Each Step:** Don't rush through the sync process
7. **Read the Diffs:** Always review git diff before committing
8. **Descriptive Commits:** Use detailed commit messages with warning summary
9. **Coordinate:** Communicate with team about major syncs
10. **Backup:** Consider creating a branch in eceee-components before syncing
11. **Document:** Update deployment docs if new services/configs added
12. **Monitor Warnings:** Track recurring warnings and fix in development

## Example Complete Workflow

```
User: "Sync everything to eceee-components"

Agent:
1. ✓ Validates repositories exist
2. ✓ Checks development environment
3. ✓ Scans for debug statements across codebase
4. ✓ Asks for confirmation to proceed
5. ✓ Syncs Django settings
   - Analyzes differences (CRITICAL/HIGH/MEDIUM/INFO)
   - Found: 8 SYNC, 5 DEV_ONLY, 2 DIFFERENT, 0 BLOCKED
   - Warnings: 2 HIGH (email verification, WebSocket)
   - Asks approval for HIGH warnings
   - Applies changes via search_replace
6. ✓ Syncs Docker Compose
   - Analyzes differences (env vars, services, volumes)
   - Found: 14 env vars, 2 services, 1 volume
   - Warnings: 2 HIGH (celery services)
   - Asks approval for HIGH warnings
   - Applies changes via search_replace
7. ✓ Syncs widgets/layouts
   - Discovers 37 files via glob_file_search
   - Analyzes each file for safety
   - Found: 33 SAFE, 4 WARN, 4 SKIP, 0 ERROR
   - Warnings: 2 HIGH (print, console.log), 2 MEDIUM (TODO, FIXME)
   - Asks approval for WARN files
   - Copies files via read_file → write
8. ✓ Validates all changes
   - Python syntax: ✓ All valid
   - YAML syntax: ✓ Valid
   - Git status: 35 files changed
9. ✓ Generates comprehensive report
   - Consolidates all warnings (4 HIGH, 5 MEDIUM)
   - Lists required actions (env vars, migrations, testing)
   - Shows breaking changes
10. ❓ Asks: "Commit these changes?"

User: "Yes"

Agent:
11. ✓ Commits with detailed message including warning summary
12. ✓ Reports commit hash
13. ✓ Reminds about deployment steps and warnings to address
```

---

## Key Features of This Sync System

1. **No rsync Dependencies:** Uses AI tools (read_file, write, grep, glob_file_search) exclusively
2. **Intelligent Safety Analysis:** Every file and change analyzed for production readiness
3. **Categorized Warnings:** CRITICAL/HIGH/MEDIUM/INFO levels guide decision-making
4. **User Approval Required:** HIGH warnings and WARN files require explicit approval
5. **Comprehensive Reporting:** Consolidated warnings across all sync operations
6. **Security First:** Hardcoded secrets and debug statements flagged automatically
7. **Production Safety:** Blocks dangerous changes (DEBUG=True, missing restart policies, etc.)

---

**Remember:** This is a production sync with intelligent safety analysis. Always verify thoroughly before committing!

