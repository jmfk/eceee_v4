# Root Page Slug Fix - Implementation Summary

**Date**: October 11, 2025  
**Issue**: Root pages with hostnames incorrectly include their slug in URLs  
**Status**: ✅ Fixed

## Problem

When a page is the root page (has hostnames), its slug was appearing in URLs:

**Before (incorrect)**:
```
http://localhost/home/my/path/
```

**After (correct)**:
```
http://localhost/my/path/
```

The root page with `slug="home"` and `hostname="localhost"` should have a "silent" slug that doesn't appear in URLs.

## Root Cause

The `WebPage.get_absolute_url()` method in `backend/webpages/models.py` was including the slug for all root pages, regardless of whether they had hostnames.

## Solution Implemented

### 1. Updated `get_absolute_url()` Method

**File**: `backend/webpages/models.py` (lines 342-355)

```python
def get_absolute_url(self):
    """Generate the public URL for this page"""
    if self.parent:
        parent_url = (self.parent.get_absolute_url() or "/").rstrip("/")
        slug_part = (self.slug or "").strip("/")
        return f"{parent_url}/{slug_part}/"
    
    # Root page: if it has hostnames, slug is silent (returns "/")
    if self.hostnames:
        return "/"
    
    # Root page without hostnames: include slug
    slug_part = (self.slug or "").strip("/")
    return f"/{slug_part}/"
```

**Logic**:
- Child pages: Build URL from parent + own slug
- Root page with hostnames: Return `/` (silent slug)
- Root page without hostnames: Return `/slug/` (visible slug)

### 2. Added Helper Method

**File**: `backend/webpages/models.py` (lines 361-363)

```python
def has_silent_slug(self):
    """Check if this page's slug should be silent (not appear in URLs)"""
    return self.is_root_page() and bool(self.hostnames)
```

This method makes the logic explicit and can be used by other code to check if a page's slug should be hidden.

### 3. Fixed Contextualized Pattern URLs

**File**: `backend/webpages/views/path_pattern_views.py` (lines 84-97)

Updated the URL building logic to handle empty paths (root pages with silent slugs):

```python
# Build page path (slug hierarchy)
page_path = page.get_absolute_url()
if page_path.startswith("/"):
    page_path = page_path[1:]  # Remove leading slash
if not page_path.endswith("/") and page_path:
    page_path += "/"

# Build base URL
protocol = "https" if request.is_secure() else "http"
# Handle empty page_path (root page with silent slug)
if page_path:
    base_url = f"{protocol}://{hostname}/{page_path}"
else:
    base_url = f"{protocol}://{hostname}/"
```

This prevents double slashes when the page path is empty.

## Impact and Benefits

### Automatically Fixed

All code that uses `get_absolute_url()` is automatically fixed:

✅ **Path pattern contextualized examples**  
   - Now shows: `http://localhost/news/my-article/`  
   - Not: `http://localhost/home/news/my-article/`

✅ **Template tags** (`webpages_tags.py`)  
   - `{% page_url page %}` now returns correct URLs

✅ **Breadcrumb generation**  
   - Root page slug no longer appears in breadcrumbs

✅ **Sitemap generation**  
   - Sitemap URLs now correct

✅ **All serializers**  
   - `absolute_url` field in API responses now correct

### Future-Proof

- New code that uses `get_absolute_url()` will automatically work correctly
- Single source of truth for URL generation
- Clear semantics with `has_silent_slug()` helper method

## URL Generation Examples

### Example 1: Root Page with Hostname

```python
root = WebPage(slug="home", hostnames=["localhost"])
root.get_absolute_url()  # Returns: "/"
root.has_silent_slug()   # Returns: True
```

### Example 2: Child of Root Page

```python
root = WebPage(slug="home", hostnames=["localhost"])
child = WebPage(slug="news", parent=root)
child.get_absolute_url()  # Returns: "/news/"
child.has_silent_slug()   # Returns: False
```

### Example 3: Grandchild

```python
root = WebPage(slug="home", hostnames=["localhost"])
child = WebPage(slug="news", parent=root)
grandchild = WebPage(slug="article", parent=child)
grandchild.get_absolute_url()  # Returns: "/news/article/"
```

### Example 4: Root Page without Hostname

```python
root = WebPage(slug="blog", hostnames=[])
root.get_absolute_url()  # Returns: "/blog/"
root.has_silent_slug()   # Returns: False
```

## Testing Checklist

✅ Root page with hostname returns `/`  
✅ Child of root page returns `/child-slug/`  
✅ Grandchild returns `/child-slug/grandchild-slug/`  
✅ Root page without hostname returns `/slug/`  
✅ Contextualized pattern examples show correct URLs  
✅ No double slashes in URLs  
✅ Empty paths handled correctly  

## Files Changed

1. **`backend/webpages/models.py`**
   - Updated `get_absolute_url()` method
   - Added `has_silent_slug()` helper method

2. **`backend/webpages/views/path_pattern_views.py`**
   - Fixed empty path handling in `_contextualize_patterns()`

## Related Issues

This fix also resolves:
- Double slashes in contextualized pattern URLs
- Incorrect breadcrumb URLs
- Incorrect sitemap URLs
- Inconsistent URL generation across the application

## Migration Notes

**No database migration required** - This is purely a code logic change.

Existing data is not affected, but URLs generated from existing pages will now be correct.

## Conclusion

This fix ensures that root pages with hostnames have "silent" slugs that don't appear in URLs, providing clean and correct URL structure throughout the application. The single-point fix in `get_absolute_url()` automatically propagates to all URL generation code.

