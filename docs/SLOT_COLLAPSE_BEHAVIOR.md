# Slot Collapse Behavior Configuration

This document describes the configurable collapse behavior for slots with inherited widgets in the eceee_v4 CMS.

## Overview

When slots contain inherited widgets, the editor can automatically collapse them (show in preview mode) or keep them expanded (show in edit mode). The `collapse_behavior` setting allows you to control this behavior on a per-slot basis.

## Configuration

### Collapse Behavior Options

The `collapse_behavior` field accepts three values:

#### 1. `"never"` - Never Collapse
The slot always displays in edit mode, even when it contains inherited widgets.

**Use case:** Best for primary content areas where you always want editors to see the editing interface, regardless of inheritance.

```python
{
    "name": "main",
    "title": "Main Content",
    "allows_inheritance": True,
    "allow_merge": False,
    "collapse_behavior": "never",  # Always show in edit mode
}
```

#### 2. `"any"` - Collapse if Any Inherited (Default)
The slot collapses (shows in preview mode) if it contains any inherited widgets.

**Use case:** Best for slots where inherited content should be visually collapsed by default, like headers and footers. This is the legacy/default behavior.

```python
{
    "name": "header",
    "title": "Header",
    "allows_inheritance": True,
    "allow_merge": False,
    "collapse_behavior": "any",  # Collapse if any inherited widgets
}
```

#### 3. `"all"` - Collapse Only if All Inherited
The slot only collapses if ALL visible widgets are inherited. If the slot has any local widgets, it stays in edit mode.

**Use case:** Best for sidebars or supplementary content areas where you want to add local widgets alongside inherited ones, and see the editing interface when you've made local additions.

```python
{
    "name": "sidebar",
    "title": "Sidebar",
    "allows_inheritance": True,
    "allow_merge": True,  # Allow merging local + inherited
    "collapse_behavior": "all",  # Only collapse if all widgets inherited
}
```

## Implementation Details

### Backend

The `collapse_behavior` field is added to slot configurations in layout definitions.

**Note:** The backend uses `snake_case` for all Python code. The `djangorestframework-camel-case` package automatically converts snake_case to camelCase when sending JSON responses to the frontend.

**File:** `backend/easy_layouts/layouts/main_layout.py`

```python
@property
def slot_configuration(self):
    return {
        "slots": [
            {
                "name": "header",
                "title": "Header",
                "allows_inheritance": True,
                "collapse_behavior": "any",
            },
            {
                "name": "main",
                "title": "Main Content",
                "allows_inheritance": False,
                "collapse_behavior": "never",
            },
            {
                "name": "sidebar",
                "title": "Sidebar",
                "allows_inheritance": True,
                "allow_merge": True,
                "collapse_behavior": "all",
            },
        ]
    }
```

The backend serializes this field in the widget inheritance API response using snake_case (which is automatically converted to camelCase by DRF):

**File:** `backend/webpages/views/webpage_views.py`

```python
# Backend uses snake_case (auto-converted to camelCase in JSON response)
response_data["slots"][slot_name] = {
    "has_inherited_widgets": len(inherited_widgets) > 0,  # → hasInheritedWidgets
    "inherited_widgets": inherited_widgets,                # → inheritedWidgets
    "collapse_behavior": slot_config.get(                 # → collapseBehavior
        "collapse_behavior", "any"
    ),
    # ... other fields
}
```

### Frontend

The frontend respects the `collapse_behavior` setting when determining the default mode for a slot:

**File:** `frontend/src/utils/widgetMerging.js`

```javascript
export function shouldSlotDefaultToPreview(slotName, localWidgets, inheritedWidgets, slotRules) {
    // Check collapse_behavior setting
    if (slotRules.collapseBehavior) {
        switch (slotRules.collapseBehavior) {
            case 'never':
                return false;  // Always edit mode
            
            case 'all':
                return localWidgets.length === 0;  // Collapse only if no local widgets
            
            case 'any':
            default:
                // Continue to legacy logic (collapse if inherited widgets present)
                break;
        }
    }
    // ... legacy fallback logic
}
```

The `transformInheritanceData` function extracts the collapse behavior from the API response (which arrives in camelCase):

```javascript
slotInheritanceRules[slotName] = {
    inheritanceAllowed: slotData.inheritanceAllowed,  // From API: inheritanceAllowed
    allowMerge: slotData.allowMerge,                  // From API: allowMerge
    collapseBehavior: slotData.collapseBehavior,      // From API: collapseBehavior
    // ... other fields
}
```

## Usage Examples

### Example 1: Landing Page Layout
```python
{
    "slots": [
        {
            "name": "hero",
            "title": "Hero Section",
            "collapse_behavior": "never",  # Always editable
        },
        {
            "name": "features",
            "title": "Features",
            "collapse_behavior": "all",  # Collapse only if all inherited
            "allow_merge": True,
        },
    ]
}
```

### Example 2: Blog Post Layout
```python
{
    "slots": [
        {
            "name": "header",
            "title": "Blog Header",
            "collapse_behavior": "any",  # Collapse if inherited
        },
        {
            "name": "content",
            "title": "Post Content",
            "collapse_behavior": "never",  # Always show editor
        },
        {
            "name": "related",
            "title": "Related Posts",
            "collapse_behavior": "all",  # Collapse unless customized
            "allow_merge": True,
        },
    ]
}
```

## Backward Compatibility

If `collapse_behavior` is not specified, the system falls back to the legacy behavior:
- Slots with merge mode enabled default to edit mode
- Slots with inherited widgets in replacement mode collapse (preview mode)
- Slots without inherited widgets always show in edit mode

This ensures existing layouts continue to work without modification.

## User Experience

### Visual Indicators

When a slot is in preview mode (collapsed):
- A floating "Exit Preview" button appears on hover (top-right corner)
- The slot displays the merged widgets without editing controls
- Users can click to exit preview and enter edit mode

When a slot is in edit mode (expanded):
- An "Eye" icon appears in the slot header on hover
- Users can click to preview the slot (see merged result)
- Inherited widgets show with "Inherited" badges
- Local widgets show with full editing controls

### Workflow Examples

**Never Collapse (`"never"`)**
1. Editor opens page
2. Main content slot shows in edit mode
3. Editor sees all editing controls immediately
4. Must manually switch to preview to see final result

**Collapse if Any (`"any"`)**
1. Editor opens page
2. Header slot (with inherited header) shows collapsed
3. Editor sees final rendered header
4. Can click to edit if changes needed

**Collapse if All (`"all"`)**
1. Editor opens page
2. Sidebar with only inherited widgets shows collapsed
3. Editor adds local widget
4. Sidebar automatically expands to show editing interface
5. Editor can see both inherited and local widgets

## Testing

To test the collapse behavior:

1. Create a parent page with widgets in various slots
2. Create a child page with the layout configured with different collapse behaviors
3. Open the child page in the editor
4. Observe the default mode for each slot based on its `collapse_behavior` setting
5. Add local widgets and observe mode changes for `"all"` behavior

## See Also

- [Widget Inheritance System](./WIDGET_INHERITANCE_TREE_SPEC.md)
- [Layout System Guide](./LAYOUT_CONTAINMENT_GUIDE.md)
- [Slot Configuration Reference](./SLOT_DIMENSION_SYSTEM.md)

