# Duplicate Page Fix Implementation Summary

## Problem
The `HostnamePageView` was throwing `MultipleObjectsReturned` errors when accessing pages like `/programme/` because:
- Multiple pages with the same slug are now allowed in the system
- All `.get()` calls needed to be replaced with `.filter().first()`
- Deleted pages needed to be properly filtered out
- Duplicate pages needed to be logged and reported to administrators

## Solution Implemented

### 1. Created DuplicatePageLog Model
**File**: `backend/webpages/models/duplicate_page_log.py`

A new model to track duplicate page occurrences with:
- Parent page reference
- Slug that has duplicates
- List of page IDs found
- First/last seen timestamps
- Occurrence counter
- Resolved status
- Email sent timestamp
- Administrative notes

This provides a comprehensive audit trail of duplicate pages in the system.

### 2. Created Safe Page Resolution Utility
**File**: `backend/webpages/utils/page_resolver.py`

Two utility functions:
- `get_page_safely(slug, parent, log_duplicates)` - Returns first non-deleted page, logs duplicates
- `get_page_safely_with_context(slug, parent, log_duplicates)` - Returns page and duplicate status

These functions:
- Replace problematic `.get()` calls
- Filter out deleted pages (`is_deleted=False`)
- Return first match (ordered by ID for determinism)
- Automatically log duplicates to DuplicatePageLog
- Never raise `MultipleObjectsReturned` errors

### 3. Updated All Page Resolution in public_views.py
**File**: `backend/webpages/public_views.py`

Replaced all `.get()` calls with safe page resolution in:
- Line 79: `_resolve_page_path_hierarchy` - Added `is_deleted=False` filter
- Line 424: `_get_error_page` - Replaced with `get_page_safely()`
- Line 677: `_resolve_page_with_pattern` - Replaced with `get_page_safely()`
- Line 866: `custom_404_handler` - Replaced with `get_page_safely()`
- Line 890: `custom_500_handler` - Replaced with `get_page_safely()`
- Line 926: `custom_403_handler` - Replaced with `get_page_safely()`
- Line 962: `custom_503_handler` - Replaced with `get_page_safely()`

All locations now:
- Never throw `MultipleObjectsReturned`
- Filter out deleted pages
- Log duplicates when encountered
- Choose first page deterministically

### 4. Created Management Command for Email Reports
**File**: `backend/webpages/management/commands/send_duplicate_page_report.py`

Management command with options:
- `--period day|week|all` - Report timeframe
- `--min-occurrences N` - Minimum occurrences to include
- `--dry-run` - Preview without sending

Features:
- Queries unresolved duplicate logs
- Formats comprehensive plain text report
- Sends to all configured admins via `mail_admins()`
- Updates `email_sent` timestamp
- Includes page IDs, occurrence counts, timestamps
- Provides resolution instructions

Usage:
```bash
# Daily report (default)
python manage.py send_duplicate_page_report

# Weekly report
python manage.py send_duplicate_page_report --period week

# Test without sending
python manage.py send_duplicate_page_report --dry-run
```

### 5. Created Celery Task for Scheduled Reports
**File**: `backend/webpages/tasks.py`

Celery task `send_duplicate_page_report`:
- Runs the management command
- Supports configurable period
- Automatic retries with exponential backoff
- Comprehensive error logging

### 6. Configured Daily Scheduled Report
**File**: `backend/config/celery.py`

Added to Celery beat schedule:
- Runs daily at 9 AM
- Reports duplicates from last 24 hours
- Automatically sends to admins
- Integrated with existing task infrastructure

Schedule:
```python
"send-duplicate-page-report": {
    "task": "webpages.tasks.send_duplicate_page_report",
    "schedule": crontab(hour=9, minute=0),
    "kwargs": {"period": "day"},
}
```

### 7. Admin Interface for Duplicate Management
**File**: `backend/webpages/admin.py`

Registered `DuplicatePageLog` with comprehensive admin:
- List display: slug, parent, duplicate count, occurrences, status
- Filters: resolved status, date, email sent
- Search: slug, parent title
- Date hierarchy by last seen
- Clickable links to parent and duplicate pages
- Actions to mark as resolved/unresolved
- Readonly fields for timestamps
- Organized fieldsets

Accessible at: `/admin/webpages/duplicatepagelog/`

### 8. Database Migration
**File**: `backend/webpages/migrations/0046_duplicatepagelog.py`

Migration created and applied:
- Creates `webpages_duplicate_page_log` table
- Adds all necessary fields and indexes
- Optimized for common queries

## Testing

### Manual Testing
```bash
# Test management command
docker-compose exec backend python manage.py send_duplicate_page_report --dry-run

# Check admin interface
# Visit /admin/webpages/duplicatepagelog/

# Test Celery task
docker-compose exec backend python manage.py shell
>>> from webpages.tasks import send_duplicate_page_report
>>> send_duplicate_page_report.delay('day')
```

### Verification Steps
1. ✅ Migration applied successfully
2. ✅ Management command runs without errors
3. ✅ Admin interface accessible
4. ⏳ Access `/programme/` - should no longer throw `MultipleObjectsReturned`
5. ⏳ Verify deleted pages are properly filtered
6. ⏳ Verify duplicates are logged when encountered
7. ⏳ Verify email reports work (with actual duplicates)

## Files Modified

1. **Created**:
   - `backend/webpages/models/duplicate_page_log.py`
   - `backend/webpages/utils/page_resolver.py`
   - `backend/webpages/management/commands/send_duplicate_page_report.py`
   - `backend/webpages/tasks.py`
   - `backend/webpages/migrations/0046_duplicatepagelog.py`

2. **Modified**:
   - `backend/webpages/public_views.py` - All page resolution now safe
   - `backend/webpages/models/__init__.py` - Import DuplicatePageLog
   - `backend/webpages/admin.py` - Register DuplicatePageLog
   - `backend/config/celery.py` - Add scheduled task

## Benefits

1. **No More Errors**: `MultipleObjectsReturned` errors eliminated
2. **Deleted Pages Filtered**: Properly excludes `is_deleted=True` pages
3. **Duplicate Tracking**: Comprehensive logging of all duplicate occurrences
4. **Administrative Visibility**: Email reports and admin interface
5. **Data Quality**: Helps identify and resolve data inconsistencies
6. **Deterministic Behavior**: Always returns first page by ID
7. **Automated Monitoring**: Daily reports via Celery

## Next Steps

1. Monitor duplicate page reports for patterns
2. Implement data cleanup if many duplicates exist
3. Consider adding duplicate prevention at the model level (warnings)
4. Add metrics/dashboard for duplicate page trends
5. Document procedure for resolving duplicates

## Configuration

### Email Settings
Ensure these are configured in `.env`:
```
ADMIN_EMAIL=admin@example.com
DEFAULT_FROM_EMAIL=noreply@example.com
```

### Celery Beat
Ensure Celery beat is running:
```bash
docker-compose up celery-beat
```

Or configure via cron:
```bash
0 9 * * * cd /path/to/eceee_v4/backend && python manage.py send_duplicate_page_report --period day
```

## Rollback Plan

If issues arise, rollback with:
```bash
docker-compose exec backend python manage.py migrate webpages 0045
```

Then revert code changes and redeploy previous version.

