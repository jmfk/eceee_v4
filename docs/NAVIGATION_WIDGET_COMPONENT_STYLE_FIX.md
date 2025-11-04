# Navigation Widget Component Style Inheritance Fix

## Problem

Navigation widgets using Component Style templates were not appearing 2+ steps down from where they were defined, even though `inheritanceLevel: -1` was set correctly.

## Root Cause

The NavigationWidget's `prepare_template_context()` method couldn't determine the actual owner page (where the widget was originally defined) for inherited widgets. It was defaulting to using the current page, which caused template variables like `owner_children` and `owner_page` to be incorrect at depth 2+.

The widget rendering system wasn't passing the `inherited_from` metadata through to the widget's template context preparation, so Component Style templates had no way to know where the widget actually came from.

## Solution

### Changes Made

**1. Pass inheritance metadata in render context**

**File:** `backend/webpages/renderers.py`

Added inheritance metadata to the enhanced context before calling `prepare_template_context()`:

```python
# Lines 108-112
# Add widget inheritance metadata if available (for Component Style templates)
if 'inherited_from' in widget_data:
    enhanced_context['widget_inherited_from'] = widget_data['inherited_from']
if 'inheritance_depth' in widget_data:
    enhanced_context['widget_inheritance_depth'] = widget_data['inheritance_depth']
```

**2. Include inherited_from in widget_data (tree-based rendering)**

**File:** `backend/webpages/renderers.py`

Modified tree-based widget rendering to add inheritance metadata to widget_data:

```python
# Lines 352-366
# Add inheritance metadata for Component Style templates
if not widget.is_local:
    # Build inherited_from dict by finding the source page
    source_depth = widget.depth
    source_node = tree
    for _ in range(source_depth):
        if source_node.parent:
            source_node = source_node.parent
    
    widget_data["inherited_from"] = {
        "id": source_node.page_id,
        "title": source_node.page.title,
        "slug": source_node.page.slug,
    }
    widget_data["inheritance_depth"] = widget.depth
```

**3. Include inherited_from in widget_data (legacy rendering)**

**File:** `backend/webpages/renderers.py`

Modified legacy widget rendering to add inheritance metadata:

```python
# Lines 423-427
# Add inheritance metadata to widget_data for Component Style templates
if widget_info.get("inherited_from"):
    widget_data["inherited_from"] = widget_info["inherited_from"]
if widget_info.get("inheritance_depth"):
    widget_data["inheritance_depth"] = widget_info["inheritance_depth"]
```

**4. Update NavigationWidget to use inherited_from**

**File:** `backend/easy_widgets/widgets/navigation.py`

Modified `prepare_template_context()` to fetch the actual owner page:

```python
# Lines 221-236
widget_inherited_from = context.get('widget_inherited_from')
is_inherited = widget_inherited_from is not None
owner_page_obj = current_page_obj  # Default to current page

# If widget is inherited, fetch the actual owner page
if is_inherited and widget_inherited_from:
    try:
        owner_page_id = widget_inherited_from.get('id')
        if owner_page_id:
            from webpages.models import WebPage
            owner_page_obj = WebPage.objects.get(id=owner_page_id)
    except Exception:
        # Fallback to current page if owner not found
        pass
```

And updated owner page metadata generation to use the fetched owner page:

```python
# Lines 277-300
owner_page_meta = None
owner_children = []
if owner_page_obj:
    if hasattr(owner_page_obj, "id"):
        owner_page_meta = asdict(helpers._page_to_metadata(owner_page_obj))
        try:
            children_info = helpers.get_active_children(
                owner_page_obj.id, include_unpublished=False
            )
            owner_children = [...]
        except Exception:
            pass
```

## Impact

- Navigation widgets with Component Style templates now correctly identify their owner page at any inheritance depth
- Template variables like `owner_children`, `owner_page`, `hasOwnerChildren` work correctly at depth 2+
- This fix applies to all widgets that use Component Style templates and need owner page information

## Testing

To verify the fix works:

1. Create a navigation widget with Component Style on a root page
2. Set `inheritanceLevel: -1` (infinite inheritance)
3. Navigate to:
   - Child page (depth 1) → should show navigation ✓
   - Grandchild page (depth 2) → should show navigation ✓
   - Great-grandchild page (depth 3+) → should show navigation ✓
4. Verify Component Style template variables are correct at all depths

## Related Fixes

This fix builds on the earlier camelCase/snake_case conversion fixes:
- `WidgetUpdateSerializer` now converts entire widget metadata to snake_case
- Inheritance logic checks both camelCase and snake_case for backward compatibility
- Widget source page mapping fixed in `_convert_tree_to_legacy_format()`

## Files Modified

1. `backend/webpages/renderers.py` - Pass inheritance metadata through rendering pipeline
2. `backend/easy_widgets/widgets/navigation.py` - Use inherited_from to find owner page

