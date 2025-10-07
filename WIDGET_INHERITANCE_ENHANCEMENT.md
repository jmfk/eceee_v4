# Widget Inheritance System Enhancement

## Summary

Enhanced the widget inheritance system with support for:
1. **Merge vs Replace Modes** for slot inheritance
2. **Inheritance Levels** with depth control  
3. **Publishing Controls** with temporal visibility
4. **Renamed Slot Configuration** for clarity

## Implementation Status: ✅ COMPLETE

### Backend Changes

#### 1. Enhanced Inheritance Logic (`backend/webpages/models.py`)
- **`WebPage.get_widgets_inheritance_info()`**: Complete rewrite supporting:
  - Inheritance level tracking with depth decrementation
  - Merge mode vs Replace mode based on slot configuration
  - Publishing status filtering (`is_published`, effective/expire dates)
  - First inheritable widget set selection for merge mode
  
- **`_filter_published_widgets()`**: New helper method
  - Filters widgets by `is_published` flag
  - Checks `publish_effective_date` and `publish_expire_date`
  - Supports ISO datetime strings from API

- **`_widget_inheritable_at_depth()`**: New helper method
  - Validates inheritance level against current depth
  - Handles infinite inheritance (`-1`)
  - Respects `inherit_from_parent` master switch

#### 2. Widget Registry Updates (`backend/webpages/widget_registry.py`)
- **BaseWidget class**: Added default inheritance/publishing properties
  ```python
  default_inheritance_level: int = 0  # page-specific by default
  default_is_published: bool = True
  ```

- **Specific Widget Defaults**: Updated navigation, header, footer widgets
  - `NavigationWidget.default_inheritance_level = -1` (infinite)
  - `HeaderWidget.default_inheritance_level = -1` (infinite)
  - `FooterWidget.default_inheritance_level = -1` (infinite)

#### 3. Slot Configuration Rename
- **`requires_local` → `allows_replacement_only` → `allow_merge`** (inverted logic for clarity)
- Backward compatibility maintained (checks both names)
- Applied in:
  - `backend/webpages/models.py` - inheritance logic
  - `backend/webpages/views/webpage_views.py` - API endpoint

#### 4. API Updates (`backend/webpages/views/webpage_views.py`)
- **`widget_inheritance` endpoint**: Enhanced response with:
  - `allowsReplacementOnly` (new naming)
  - `requiresLocal` (deprecated, for backward compatibility)
  - `mergeMode` flag for slot behavior indication

### Frontend Changes

#### 1. Widget Publishing & Inheritance Fields Component
- **New file**: `frontend/src/components/WidgetPublishingInheritanceFields.jsx`
- Provides UI for:
  - **Published Toggle**: On/off switch for widget visibility
  - **Inheritance Level**: Dropdown (0-5 levels, infinite)
  - **Can Be Inherited**: Master inheritance switch
  - **Effective Date**: Optional datetime picker
  - **Expire Date**: Optional datetime picker
  - Visual feedback and help text

#### 2. Widget Editor Integration
- **Updated**: `frontend/src/components/WidgetEditorPanel.jsx`
- Integrated publishing/inheritance fields below widget config form
- Changes trigger dirty state for save detection
- Widget type defaults passed through for inheritance level

#### 3. Widget Merging Utilities
- **Updated**: `frontend/src/utils/widgetMerging.js`
- Support for both `requiresLocal` and `allowsReplacementOnly`
- **New merge mode behavior**:
  - When `mergeMode=true`: Inherited widgets + local widgets (inherited first)
  - When `allowsReplacementOnly=true`: Local replaces inherited (original behavior)
- Updated preview mode logic to account for merge mode

### Data Model

#### Widget Properties (JSON in PageVersion.widgets)
```json
{
  "id": "widget-id",
  "type": "Navigation",
  "config": { /* widget config */ },
  "sort_order": 0,
  
  // NEW FIELDS:
  "is_published": true,                        // Publish on/off
  "inheritance_level": -1,                      // -1=infinite, 0=page only, 1-N=levels deep
  "inherit_from_parent": true,                  // Master inheritance switch
  "publish_effective_date": "2025-01-01T00:00:00Z",  // Optional
  "publish_expire_date": "2025-12-31T23:59:59Z"      // Optional
}
```

#### Slot Configuration (in Layout.slot_configuration)
```json
{
  "name": "header",
  "allows_inheritance": true,
  "allow_merge": true,  // NEW preferred field (replaces allows_replacement_only)
  "requires_local": false             // DEPRECATED (maintained for backward compat)
}
```

### Inheritance Behavior

#### Inheritance Level Logic
- **Level -1**: Infinite inheritance (all descendants)
- **Level 0**: Page only (not inherited by children)
- **Level 1+**: Inherited N levels deep, decrements as you go down hierarchy

#### Merge vs Replace Modes

**Replace Mode** (`allow_merge=false` OR `allows_inheritance=False`):
- If page has local widgets → show ONLY local widgets
- If page has no local widgets → show inherited widgets
- Original behavior preserved

**Merge Mode** (`allows_inheritance=true` AND `allow_merge=true`):
- Combines first inheritable parent widgets + local widgets
- Inherited widgets render first, then local widgets
- Respects sort order within each group
- Stops at first parent with inheritable widgets

#### Publishing Rules
- Unpublished widgets (`is_published=false`) are NOT inherited
- Widgets outside effective/expire date range are NOT inherited
- `inherit_from_parent=false` prevents inheritance regardless of level

### Default Values

| Widget Type | Default Inheritance Level | Rationale |
|-------------|--------------------------|-----------|
| Navigation  | -1 (Infinite) | Sitewide navigation |
| Header      | -1 (Infinite) | Sitewide header |
| Footer      | -1 (Infinite) | Sitewide footer |
| Content     | 0 (Page only) | Page-specific content |
| Form        | 0 (Page only) | Page-specific forms |
| Image       | 0 (Page only) | Page-specific media |
| Container   | 0 (Page only) | Page-specific layouts |

### Backward Compatibility

✅ **Fully Maintained**:
- Existing widgets without new fields use safe defaults
- `requires_local` slot property still works (fallback to old name)
- API returns both old and new field names
- Frontend checks both naming conventions

### What's NOT Implemented

The following are marked for future work:

1. **Backend Tests** (`backend/webpages/tests/`)
   - Test inheritance level filtering at various depths
   - Test merge vs replace behavior
   - Test publishing date filtering
   - Test unpublished widget inheritance blocking
   - Test infinite inheritance (-1)

2. **Frontend Tests** (`frontend/src/components/`)
   - Test WidgetPublishingInheritanceFields component
   - Test widget editor integration
   - Test merge mode rendering
   - Test datetime picker functionality
   - Test default value initialization

## Migration Notes

### Existing Data
No database migration needed - all changes are in JSON fields:
- **Widgets**: New fields added with safe defaults
  - `is_published`: defaults to `true`
  - `inheritance_level`: defaults to `0` (page-specific)
  - `inherit_from_parent`: defaults to `true`
  - `publish_effective_date`: defaults to `null`
  - `publish_expire_date`: defaults to `null`

- **Slots**: Old `requires_local` and `allows_replacement_only` still work, new `allow_merge` preferred (inverted logic)

### Deployment Steps
1. Deploy backend changes
2. Deploy frontend changes
3. No data migration required
4. Existing functionality preserved

## Usage Examples

### Example 1: Site-wide Navigation with Merge
```json
// Parent page navigation widget:
{
  "type": "Navigation",
  "inheritance_level": -1,
  "is_published": true,
  "config": {
    "menu_items": [
      {"label": "Home", "url": "/"},
      {"label": "About", "url": "/about"}
    ]
  }
}

// Child page adds local menu item (in merge-mode slot):
{
  "type": "Navigation",
  "inheritance_level": 0,
  "config": {
    "menu_items": [
      {"label": "Contact", "url": "/contact"}
    ]
  }
}

// Result: Child page shows: Home, About, Contact (inherited + local merged)
```

### Example 2: Seasonal Widget with Publishing Dates
```json
{
  "type": "Banner",
  "is_published": true,
  "publish_effective_date": "2025-12-01T00:00:00Z",
  "publish_expire_date": "2025-12-31T23:59:59Z",
  "inheritance_level": -1,
  "config": {
    "message": "Holiday Sale - 20% Off!"
  }
}
// Widget only appears in December 2025 on all pages
```

### Example 3: Limited Inheritance Depth
```json
{
  "type": "Breadcrumb",
  "inheritance_level": 2,  // Only 2 levels deep
  "is_published": true,
  "config": { /* breadcrumb config */ }
}
// Visible on immediate page + 2 child levels, then stops
```

## Technical Decisions

1. **Depth tracking**: Starts at 0 on widget's page, increments as we walk down to children
2. **Merge mode stop condition**: Stops at first parent level with inheritable widgets
3. **Replace mode preserved**: Default behavior unchanged for backward compatibility
4. **Publishing AND inheritance**: Unpublished widgets don't inherit (security/visibility control)
5. **Master switch priority**: `inherit_from_parent=false` overrides `inheritance_level`

## Performance Considerations

- Publishing date checks happen during inheritance resolution (cached)
- Depth tracking is O(n) where n = page hierarchy depth
- Merge mode stops early (first inheritable parent found)
- No additional database queries (uses existing PageVersion data)

## Next Steps

1. ✅ Backend implementation - COMPLETE
2. ✅ Frontend implementation - COMPLETE
3. ⏳ Backend test suite - TODO
4. ⏳ Frontend test suite - TODO
5. 📝 User documentation - TODO
6. 🎥 Demo video/walkthrough - TODO

## Files Changed

### Backend (7 files)
1. `backend/webpages/models.py` - Core inheritance logic
2. `backend/webpages/views/webpage_views.py` - API endpoint
3. `backend/webpages/widget_registry.py` - Widget base class
4. `backend/default_widgets/widgets/navigation.py` - Default level
5. `backend/default_widgets/widgets/header.py` - Default level
6. `backend/default_widgets/widgets/footer.py` - Default level
7. `backend/webpages/renderers.py` - (No changes needed, uses inheritance info)

### Frontend (3 files)
1. `frontend/src/components/WidgetPublishingInheritanceFields.jsx` - NEW
2. `frontend/src/components/WidgetEditorPanel.jsx` - Integration
3. `frontend/src/utils/widgetMerging.js` - Merge/replace logic

### Documentation (1 file)
1. `WIDGET_INHERITANCE_ENHANCEMENT.md` - THIS FILE

---

**Implementation Date**: October 6, 2025
**Status**: Ready for Testing & QA
**Breaking Changes**: None (fully backward compatible)
