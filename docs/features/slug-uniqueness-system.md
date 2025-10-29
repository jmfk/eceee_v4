# Slug Uniqueness System

## Overview

The slug uniqueness system enforces unique slugs within the same parent page (siblings) by automatically appending numeric suffixes when conflicts occur, and notifying users when slugs are modified.

## Implementation Date

October 29, 2025

## Behavior

### Auto-Rename Strategy

When a page is created or updated with a slug that conflicts with a sibling page (pages sharing the same parent), the system automatically:

1. Detects the conflict
2. Appends a numeric suffix (`-2`, `-3`, etc.) to make the slug unique
3. Returns a warning in the API response
4. Displays a notification to the user

### Examples

- First page: `slug = "about"` → `"about"`
- Second page: `slug = "about"` → `"about-2"` (auto-renamed)
- Third page: `slug = "about"` → `"about-3"` (auto-renamed)

### Scope of Uniqueness

- **Same parent**: Slugs must be unique among sibling pages (pages with the same parent)
- **Different parents**: Pages with different parents CAN have the same slug
- **Root pages**: Root pages (no parent) must have unique slugs among other root pages
- **Soft-deleted pages**: Soft-deleted pages don't cause conflicts

## Backend Implementation

### WebPage Model Changes

**File**: `backend/webpages/models/web_page.py`

Added three helper methods:

```python
def _slug_exists_for_parent(self, slug, parent):
    """Check if a slug already exists for siblings (same parent)"""
    
def _get_unique_slug(self, slug, parent):
    """Get a unique slug by appending numeric suffix if needed"""
    
def ensure_unique_slug(self):
    """Ensure slug is unique within parent by auto-renaming if needed"""
```

### Serializer Changes

**File**: `backend/webpages/serializers.py`

Modified `WebPageSimpleSerializer`:
- Added custom `create()` method that calls `ensure_unique_slug()` before saving
- Added custom `update()` method that calls `ensure_unique_slug()` when slug changes
- Added custom `to_representation()` method that includes warnings in response

### Warning Response Format

```python
{
    "id": 123,
    "slug": "about-2",
    "title": "About",
    "warnings": [{
        "field": "slug",
        "message": "Slug 'about' was modified to 'about-2' to ensure uniqueness",
        "original_value": "about"
    }]
}
```

### Import Services

**Files**: 
- `backend/webpages/services/single_page_importer.py`
- `backend/webpages/services/page_tree_importer.py`

Both import services updated to:
- Use `ensure_unique_slug()` when creating pages
- Track slug warnings in import results
- Include warnings in import summary

### Testing

**File**: `backend/webpages/tests/test_slug_uniqueness.py`

Comprehensive test suite with 12 tests covering:
- ✅ Slug uniqueness within same parent
- ✅ Auto-increment with numeric suffixes
- ✅ Different parents can have same slugs
- ✅ Update operations preserve uniqueness
- ✅ Error page slug validation still works
- ✅ Soft-deleted pages don't cause conflicts
- ✅ Null slug handling
- ✅ Helper method functionality

All tests passing ✅

## Frontend Implementation

### TreePageManager Component

**File**: `frontend/src/components/TreePageManager.jsx`

Updated `createPageMutation` and `createRootPageMutation` to:
- Check response for warnings
- Display toast notification when slug is auto-renamed
- Show original and final slug in warning message

Example notification:
```
Note: Slug 'about' was modified to 'about-2' to ensure uniqueness
```

### TreeImporterModalV2 Component

**File**: `frontend/src/components/TreeImporterModalV2.jsx`

Updated import results display to:
- Show warnings alongside each completed page
- Display slug modification warnings with ⚠️ icon
- Support multiple warnings per page

### Testing

**Files**:
- `frontend/src/components/__tests__/TreePageManager.slug-warnings.test.jsx`
- `frontend/src/components/__tests__/TreeImporterModalV2.slug-warnings.test.jsx`

Tests cover:
- ✅ Warning notification display on page creation
- ✅ Warning notification display on root page creation
- ✅ No warning when no modification occurs
- ✅ Multiple warnings handling
- ✅ Missing warnings field handling
- ✅ Import results with slug warnings

## User Experience

### Creating Pages

1. User creates a page with slug "contact"
2. If no conflict: Page saved with slug "contact" ✅
3. If conflict exists:
   - Page saved with slug "contact-2" ✅
   - Success notification: "Page created successfully" 🎉
   - Warning notification: "Note: Slug 'contact' was modified to 'contact-2' to ensure uniqueness" ⚠️

### Importing Pages

1. User imports page tree from external website
2. Import process runs
3. Results show:
   - ✓ Completed pages with their final slugs
   - ⚠️ Warnings for any auto-renamed slugs
   - Example: "⚠️ Slug 'services' was modified to 'services-2' to ensure uniqueness"

## Database Schema

No database migrations required. The slug field already has `unique=False`:

```python
slug = models.SlugField(max_length=255, unique=False, null=True, blank=True)
```

Uniqueness is enforced at the application level for better error handling and user experience.

## Future Enhancements

Potential improvements for consideration:

1. **Database Constraint**: Add unique constraint on (parent_id, slug) pair at database level
2. **Slug Suggestions**: Offer alternative slug suggestions in UI before auto-renaming
3. **Bulk Rename Detection**: Track and summarize all slug renames in bulk operations
4. **Slug History**: Track slug changes in version history

## Migration Notes

This feature is backward compatible:
- Existing pages retain their slugs
- No data migration required
- Auto-rename only applies to new pages or updates with conflicts

## Related Documentation

- [WebPage Model Documentation](../architecture/models.md#webpage)
- [Page Import System](./page-import-system.md)
- [API Conventions](../api/conventions.md)

