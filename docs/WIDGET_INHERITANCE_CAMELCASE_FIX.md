# Widget Inheritance CamelCase Bug Fix

## Problem

Navigation, Header, and Footer widgets were not inheriting more than one level down the page hierarchy, even when `inheritanceLevel: -1` was set.

## Root Cause

**Case Sensitivity Mismatch:**
- Frontend sends widget metadata in **camelCase** (`inheritanceLevel`, `isPublished`, `inheritFromParent`, etc.)
- Backend inheritance logic only checked for **snake_case** (`inheritance_level`, `is_published`, `inherit_from_parent`)
- The `WidgetUpdateSerializer` was only converting the widget `config` field to snake_case, not the widget metadata fields

**Result:** Widgets saved with `inheritanceLevel: -1` were read as `inheritance_level: 0` (default) by the backend, causing them to not inherit beyond their own page.

## Solution

### 1. Fix Widget Serialization (backend/webpages/serializers.py)

Changed `WidgetUpdateSerializer.validate_widgets()` to convert the **entire widget object** from camelCase to snake_case, not just the config field:

```python
# OLD (only converted config):
converted_widget = widget.copy()
if "config" in widget:
    converted_widget["config"] = self._convert_camel_to_snake(widget["config"])

# NEW (converts entire widget including metadata):
converted_widget = self._convert_camel_to_snake(widget)
```

### 2. Add Backward Compatibility (backend/webpages/models/web_page.py)

Updated inheritance logic to check **both** snake_case and camelCase for backward compatibility:

**In `_widget_inheritable_at_depth()`:**
```python
# Check both inheritance_level and inheritanceLevel
inheritance_level = widget.get("inheritance_level")
if inheritance_level is None:
    inheritance_level = widget.get("inheritanceLevel", 0)

# Check both inherit_from_parent and inheritFromParent
inherit_from_parent = widget.get("inherit_from_parent") or widget.get("inheritFromParent")
```

**In `_filter_published_widgets()`:**
```python
# Check both is_published and isPublished
is_published = widget.get("is_published")
if is_published is None:
    is_published = widget.get("isPublished", True)

# Check both publish_effective_date and publishEffectiveDate
effective_date = widget.get("publish_effective_date") or widget.get("publishEffectiveDate")
```

### 3. Migration for Existing Data

Created migration `0051_convert_widget_metadata_to_snake_case.py` to convert any existing widgets with camelCase metadata fields to snake_case.

### 4. Widget Class Defaults (Bonus)

Added `default_inheritance_level = -1` to:
- `NavigationWidget` 
- `HeaderWidget`
- `FooterWidget`

This ensures new instances of these widgets get infinite inheritance by default (though the main bug was the case sensitivity issue).

## Files Changed

1. `backend/webpages/serializers.py` - Fixed WidgetUpdateSerializer
2. `backend/webpages/models/web_page.py` - Added camelCase fallbacks
3. `backend/webpages/migrations/0051_convert_widget_metadata_to_snake_case.py` - New migration
4. `backend/easy_widgets/widgets/navigation.py` - Added default_inheritance_level
5. `backend/easy_widgets/widgets/header.py` - Added default_inheritance_level
6. `backend/easy_widgets/widgets/footer.py` - Added default_inheritance_level

## Impact

- **New widgets:** Will be saved with snake_case metadata fields
- **Existing widgets:** Can still be read (backward compatibility checks both cases)
- **Inheritance:** Now works correctly at all depth levels when `inheritanceLevel: -1` is set

## Testing

After deployment:
1. Edit a navigation widget on a root page, set inheritance to "Infinite"
2. Save and publish
3. Navigate to child page → should show navigation ✓
4. Navigate to grandchild page → should show navigation ✓
5. Navigate to great-grandchild page → should show navigation ✓

