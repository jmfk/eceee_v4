# Troubleshooting Widget Inheritance Issues

## Issue: Header/Footer Not Inheriting to Child Pages in Production

### Symptoms

- Widget inheritance works in local development (DEBUG=True)
- Widget inheritance does NOT work in production (DEBUG=False)
- Both the published site AND admin interface show missing headers/footers on child pages
- Root/parent page shows header/footer correctly
- Child pages have empty widgets `{}`

### Root Cause

The `inheritance_level` field in the widget configuration is set to `None` or `0` instead of `-1` (infinite inheritance) in the production database.

**How the inheritance system works:**

```python
# From backend/webpages/models/web_page.py
def _widget_inheritable_at_depth(self, widget, depth):
    inheritance_level = widget.get("inheritance_level", 0)  # None defaults to 0!
    
    # -1 means infinite inheritance
    if inheritance_level == -1:
        return True
    
    # 0 means this page only (NO inheritance)
    if inheritance_level == 0:
        return depth == 0  # Only shows on the page it's defined on
    
    # Otherwise check if depth is within level
    return depth <= inheritance_level
```

When `inheritance_level` is `None` or `0`, the widget only appears on its own page and does NOT inherit to children.

### Diagnostic Steps

#### 1. Check if inheritance files exist in production

```bash
# SSH into production container
docker exec -it eceee_v4-backend-1 bash

# Check files exist
ls -la webpages/inheritance_*.py
```

Expected files:
- `inheritance_cache.py`
- `inheritance_helpers.py`
- `inheritance_tree.py`
- `inheritance_types.py`

#### 2. Test imports in Django shell

```python
python manage.py shell

# Test imports
from webpages.inheritance_tree import InheritanceTreeBuilder
from webpages.inheritance_helpers import InheritanceTreeHelpers
print("✓ Imports successful")
```

#### 3. Check widget configuration in database

```python
from webpages.models import WebPage

# Get root page with header/footer
root = WebPage.objects.filter(parent__isnull=True).first()
print(f"Root page: {root.title} (ID: {root.id})")

# Get published version
version = root.get_current_published_version()
if version:
    print(f"Widgets keys: {list(version.widgets.keys())}")
    
    # Check header widget
    if version.widgets.get('header'):
        header = version.widgets['header'][0]
        print(f"Header inheritance_level: {header.get('inheritance_level')}")
        print(f"Expected: -1 (infinite)")
        
    # Check footer widget
    if version.widgets.get('footer'):
        footer = version.widgets['footer'][0]
        print(f"Footer inheritance_level: {footer.get('inheritance_level')}")
        print(f"Expected: -1 (infinite)")
```

#### 4. Test tree building

```python
from webpages.inheritance_tree import InheritanceTreeBuilder

# Get a child page
child = WebPage.objects.filter(parent__isnull=False).first()

# Build inheritance tree
builder = InheritanceTreeBuilder()
tree = builder.build_tree(child)

# Check if header/footer appear in tree
print(f"Slots: {list(tree.slots.keys())}")
print(f"Header widgets: {len(tree.slots.get('header', []))}")  # Should be > 0
print(f"Footer widgets: {len(tree.slots.get('footer', []))}")  # Should be > 0
```

### The Fix

#### Option 1: Update via Django Shell (Quick Fix)

```python
from webpages.models import WebPage, PageVersion

# Get root page and its published version
root = WebPage.objects.get(id=1)  # Adjust ID as needed
version = root.get_current_published_version()

# Update header widgets
if version.widgets.get('header'):
    for widget in version.widgets['header']:
        widget['inheritance_level'] = -1
        print(f"✓ Set header widget inheritance_level to -1")

# Update footer widgets
if version.widgets.get('footer'):
    for widget in version.widgets['footer']:
        widget['inheritance_level'] = -1
        print(f"✓ Set footer widget inheritance_level to -1")

# Save the version
version.save()
print(f"✓ Saved version {version.id}")

# Clear cache
from django.core.cache import cache
cache.clear()
print("✓ Cleared cache")
```

#### Option 2: Update via Admin UI (Proper Fix)

1. Log into Django admin at `/admin/`
2. Navigate to **Webpages > Page Versions**
3. Find the published version of the root page
4. Edit the version
5. For each header/footer widget in the JSON:
   - Add or update: `"inheritance_level": -1`
6. Save the version
7. Clear cache (run `cache.clear()` in shell or restart backend)

#### Option 3: Re-publish the Page

If you have the widgets correctly configured in local dev:

1. Export the page from local dev (or copy widget JSON)
2. Import to production, or
3. Use the admin UI to add the header/footer widgets again with proper settings:
   - **Inheritance Level**: `-1` (Infinite)
   - **Is Published**: `true`

### Verification

After applying the fix, verify it works:

```python
# Test tree building again
from webpages.inheritance_tree import InheritanceTreeBuilder
from webpages.models import WebPage

child = WebPage.objects.filter(parent__isnull=False).first()
builder = InheritanceTreeBuilder()
tree = builder.build_tree(child)

print(f"Header widgets: {len(tree.slots.get('header', []))}")  # Should be > 0 now!
print(f"Footer widgets: {len(tree.slots.get('footer', []))}")  # Should be > 0 now!
```

Visit a child page on the published site and verify header/footer appear.

### Prevention

To avoid this issue in the future:

#### 1. Always Set Inheritance Level for Sitewide Widgets

When creating header/footer widgets:
- Set `inheritance_level: -1` for infinite inheritance
- Set `is_published: true`

#### 2. Validate Before Deploying to Production

Before deploying, check that widgets have correct inheritance:

```python
# Quick validation script
from webpages.models import WebPage

root = WebPage.objects.filter(parent__isnull=True).first()
version = root.get_current_published_version()

issues = []
for slot in ['header', 'footer']:
    if version.widgets.get(slot):
        for widget in version.widgets[slot]:
            level = widget.get('inheritance_level')
            if level != -1:
                issues.append(f"{slot} widget has inheritance_level={level}, should be -1")

if issues:
    print("⚠️  ISSUES FOUND:")
    for issue in issues:
        print(f"  - {issue}")
else:
    print("✓ All sitewide widgets have correct inheritance_level")
```

#### 3. Database Migration for Existing Widgets

If you have existing widgets without `inheritance_level`, create a data migration:

```python
# In a Django data migration
from django.db import migrations

def fix_inheritance_levels(apps, schema_editor):
    PageVersion = apps.get_model('webpages', 'PageVersion')
    
    for version in PageVersion.objects.filter(is_current_published=True):
        modified = False
        
        # Fix header widgets
        if version.widgets.get('header'):
            for widget in version.widgets['header']:
                if widget.get('type') in ['eceee_widgets.HeaderWidget', 'NavigationWidget']:
                    if widget.get('inheritance_level') is None:
                        widget['inheritance_level'] = -1
                        modified = True
        
        # Fix footer widgets
        if version.widgets.get('footer'):
            for widget in version.widgets['footer']:
                if widget.get('type') == 'eceee_widgets.FooterWidget':
                    if widget.get('inheritance_level') is None:
                        widget['inheritance_level'] = -1
                        modified = True
        
        if modified:
            version.save()

class Migration(migrations.Migration):
    dependencies = [
        ('webpages', 'XXXX_previous_migration'),
    ]
    
    operations = [
        migrations.RunPython(fix_inheritance_levels),
    ]
```

### Common Gotchas

1. **Version Not Published**: Widget configuration changes must be in a published version
2. **Cache Not Cleared**: After database changes, always clear Redis cache
3. **None vs 0**: Both `None` and `0` mean "no inheritance" - always use `-1` for infinite
4. **Wrong Version**: Make sure you're editing the current published version, not a draft

### Related Documentation

- [Widget Inheritance System](./WIDGET_INHERITANCE_ENHANCEMENT.md)
- [Code-Based Widget System](../backend/docs/CODE_BASED_WIDGET_SYSTEM.md)
- [Backend Page Renderer](../backend/docs/BACKEND_PAGE_RENDERER.md)

### Support

If inheritance still doesn't work after following these steps:

1. Check production logs for errors during tree building
2. Verify `LAYOUT_CACHE_ENABLED` setting (might need to disable temporarily)
3. Check if `InheritanceTreeBuilder` is falling back to legacy renderer
4. Verify eceee-components repo is synced with latest code from eceee_v4

