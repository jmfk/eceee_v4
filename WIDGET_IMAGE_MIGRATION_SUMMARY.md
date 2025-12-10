# Widget Image Migration - Implementation Summary

## Overview
Fixed banner image URL errors in production by migrating all widget image references to store complete MediaFile objects instead of inconsistent ID/partial data formats.

## Changes Implemented

### 1. Updated Widget Pydantic Schemas (6 files) ✅
Changed image fields from `Optional[str]` to `Optional[dict]`:

- `backend/easy_widgets/widgets/banner.py` - `image_1`, `background_image`
- `backend/easy_widgets/widgets/header.py` - `image`, `mobile_image`, `tablet_image`  
- `backend/easy_widgets/widgets/hero.py` - `image`
- `backend/easy_widgets/widgets/content_card.py` - `image1`
- `backend/easy_widgets/widgets/footer.py` - `background_image`
- `backend/easy_widgets/widgets/bio.py` - `image`

### 2. Created Management Command ✅
**File:** `backend/webpages/management/commands/migrate_widget_images.py`

Comprehensive migration script that:
- Processes ALL PageVersion records
- Scans all slots in widgets JSONField
- Recursively processes nested widgets (widgets with slots)
- Identifies image fields by name patterns
- Bulk fetches MediaFile objects for efficiency
- Replaces IDs/partial objects with complete MediaFile data
- Handles missing/deleted MediaFiles gracefully
- Provides detailed logging and statistics

**Features:**
- `--dry-run` - Preview changes without modifying database
- `--backup` - Create JSON backup before migration
- `--batch-size N` - Process N versions at a time (default: 50)
- `--version-id ID` - Test on specific PageVersion
- `--verbose` - Show detailed output for each widget

### 3. Updated Widget Renderers ✅
Modified `prepare_template_context` methods to extract URLs from dict objects:

- `banner.py` - Extracts `background_image_url` and `image_1_url`
- `content_card.py` - Extracts `image1_url`
- `bio.py` - Extracts `image_url`
- `header.py` - Already handled dicts properly ✓
- `hero.py` - Already handled dicts properly ✓
- `footer.py` - Already handled dicts properly ✓

### 4. Improved Frontend Error Handling ✅
**File:** `frontend/src/utils/imgproxySecure.js`

Enhanced `getImgproxyUrlFromImage` function:
- Checks both camelCase and snake_case field names
- Provides detailed error logging with object inspection
- Shows available keys and field existence
- Helps debug missing URL issues

## Testing Instructions

### Step 1: Dry Run Migration (Development)

```bash
# Navigate to backend directory
cd backend

# Run dry-run to preview changes
docker-compose exec backend python manage.py migrate_widget_images --dry-run --verbose

# Review output to see what would be migrated
```

**Expected Output:**
```
🔍 DRY RUN MODE - No changes will be made
🚀 Starting widget image migration (batch size: 50)
🔄 Migrating widget image references...
   📥 Loaded X MediaFile objects
   🔄 Version Y (Page Z): would be updated (N images migrated, M missing)
...
📈 MIGRATION SUMMARY
📋 Versions processed: X
✏️  Versions updated: Y
🧩 Widgets processed: Z
🖼️  Images migrated: N
⚠️  Missing MediaFiles: M
```

### Step 2: Create Backup

```bash
# Create backup before actual migration
docker-compose exec backend python manage.py migrate_widget_images --backup --dry-run

# Backup file will be created: page_versions_widgets_backup_YYYYMMDD_HHMMSS.json
```

### Step 3: Run Actual Migration (Development First)

```bash
# Run the migration
docker-compose exec backend python manage.py migrate_widget_images --backup

# Monitor output for errors
```

### Step 4: Verify Widget Rendering

1. **Check Frontend Console:**
   - Open browser dev tools
   - Navigate to pages with banner/header/hero widgets
   - Look for any `getImgproxyUrlFromImage` errors
   - Should see detailed error logs if any images are still missing URLs

2. **Test Each Widget Type:**
   - Banner widget - Check both `background_image` and `image_1`
   - Header widget - Check all three responsive images
   - Hero widget - Check background image
   - Content Card - Check `image1`
   - Footer widget - Check background image
   - Bio widget - Check bio image

3. **Verify Image URLs:**
   - Images should load properly with imgproxy URLs
   - Check browser Network tab for successful image requests
   - Verify no 404 errors for images

### Step 5: Test Backend Rendering

```bash
# Test backend template rendering
docker-compose exec backend python manage.py shell

# In shell:
from webpages.models import WebPage, PageVersion
from webpages.renderers import WebPageRenderer

# Get a page with widgets
page = WebPage.objects.filter(widgets__isnull=False).first()
version = page.get_current_published_version()

# Test rendering
renderer = WebPageRenderer()
html = renderer.render(page, version)
print("Render successful!" if html else "Render failed!")
```

### Step 6: Production Migration (When Ready)

```bash
# 1. BACKUP PRODUCTION DATABASE FIRST!
# 2. Run dry-run on production data
docker-compose exec backend python manage.py migrate_widget_images --dry-run > migration_preview.txt

# 3. Review migration_preview.txt
# 4. Schedule maintenance window
# 5. Run actual migration
docker-compose exec backend python manage.py migrate_widget_images --backup

# 6. Monitor error logs
docker-compose logs -f backend | grep -i "image\|imgproxy"
```

## Rollback Plan

If issues occur after migration:

### Option 1: Restore from Backup
```bash
# The backup file contains original widgets data
# Manually restore using Django shell or database tools
```

### Option 2: Re-run Migration
```bash
# The migration is idempotent - can be run multiple times
# Already-hydrated images won't be re-processed
docker-compose exec backend python manage.py migrate_widget_images
```

## Common Issues & Solutions

### Issue: "Missing MediaFiles" in migration output
**Solution:** These are references to deleted images. The migration sets them to `null`. Review and update widgets if needed.

### Issue: Images not loading after migration
**Check:**
1. Browser console for detailed error logs (now includes object inspection)
2. Verify MediaFile exists in database
3. Check that imgproxyBaseUrl is present in migrated data
4. Verify imgproxy service is running

### Issue: Backend rendering errors
**Check:**
1. Template expects URL string, not dict object
2. Verify `prepare_template_context` extracts URL from dict
3. Check template variable names match

## Files Modified

### Backend (10 files)
1. `backend/easy_widgets/widgets/banner.py`
2. `backend/easy_widgets/widgets/header.py`
3. `backend/easy_widgets/widgets/hero.py`
4. `backend/easy_widgets/widgets/content_card.py`
5. `backend/easy_widgets/widgets/footer.py`
6. `backend/easy_widgets/widgets/bio.py`
7. `backend/webpages/management/commands/migrate_widget_images.py` (new)

### Frontend (1 file)
8. `frontend/src/utils/imgproxySecure.js`

## Success Criteria

- [ ] All PageVersions processed without errors
- [ ] No missing MediaFile warnings (or all reviewed and acceptable)
- [ ] No console errors about missing imgproxyBaseUrl
- [ ] All widget types render correctly with images
- [ ] Backend template rendering works
- [ ] Frontend widget rendering works
- [ ] Production site loads without image errors

## Next Steps

1. Run dry-run migration in development
2. Review output and fix any unexpected issues
3. Test all affected widgets render correctly
4. Run actual migration in development
5. Verify functionality for 24-48 hours
6. Plan production migration window
7. Execute production migration
8. Monitor for 48 hours post-migration

