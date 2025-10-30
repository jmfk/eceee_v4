# Widget Special Editor Fix Summary

## Problem
The eceee widgets had two issues:
1. Special editors were hardcoded in `SpecialEditorRenderer.jsx`, requiring modification of core files when adding new widget types
2. The `mediaItems` field was visible in the schema controls, even though it's managed by MediaSpecialEditor

## Solution

### 1. Widget-Level Special Editor Declaration
Special editors are now declared in widget metadata, making it modular and extensible.

#### Frontend Changes

**ImageWidget.jsx** (both default and eceee versions)
- Added `specialEditor: 'MediaSpecialEditor'` to widget metadata
- Widgets now declare their own special editors

**SpecialEditorRenderer.jsx** - Refactored to be metadata-driven:
- Added `SPECIAL_EDITOR_COMPONENTS` registry (map of editor names to components)
- `getSpecialEditor()` now checks widget metadata first, then falls back to legacy registry
- `hasSpecialEditor()` uses the new lookup mechanism
- Legacy registry kept for backward compatibility but marked as deprecated

```javascript
// Now widgets declare their special editor in metadata:
ImageWidget.metadata = {
    name: 'Image',
    description: '...',
    category: 'media',
    icon: Image,
    tags: [...],
    specialEditor: 'MediaSpecialEditor'  // ← NEW
}
```

### 2. Hidden Fields in Schema
Fields managed by special editors are now hidden from schema-based controls.

#### Backend Changes

**image.py** (both default_widgets and easy_widgets)
- Added `"hidden": True` to `mediaItems`, `collectionId`, and `collectionConfig` fields
- These fields are now only managed by MediaSpecialEditor, not shown in form controls

```python
mediaItems: List[ImageMediaItem] = Field(
    default_factory=list,
    description="List of images/videos to display",
    json_schema_extra={
        "hidden": True,  # Hidden from UI - managed by MediaSpecialEditor
    },
)
```

**header.py** (both default_widgets and easy_widgets)
- Added complete UI control metadata (`json_schema_extra`) to all fields
- Organized into groups: Content, Background, Styling, Advanced
- Now fully editable with proper controls

### 3. Benefits

✅ **Modular**: New widget types can declare their special editors without modifying core files
✅ **Clean UI**: Fields managed by special editors are hidden from schema controls
✅ **Backward Compatible**: Legacy registry still works while migrating
✅ **Extensible**: Easy to add new special editors - just add to `SPECIAL_EDITOR_COMPONENTS`

## Files Modified

### Frontend
- `frontend/src/components/special-editors/SpecialEditorRenderer.jsx`
- `frontend/src/widgets/default-widgets/ImageWidget.jsx`
- `frontend/src/widgets/easy-widgets/eceeeImageWidget.jsx`

### Backend
- `backend/default_widgets/widgets/image.py`
- `backend/easy_widgets/widgets/image.py`
- `backend/default_widgets/widgets/header.py`
- `backend/easy_widgets/widgets/header.py`

## How to Add Special Editors to New Widgets

### Step 1: Create the Special Editor Component (if needed)
```javascript
// frontend/src/components/special-editors/MySpecialEditor.jsx
const MySpecialEditor = ({ widgetData, onConfigChange, ... }) => {
    // Your custom editor UI
    return <div>...</div>
}
export default MySpecialEditor
```

### Step 2: Register the Editor Component
```javascript
// frontend/src/components/special-editors/SpecialEditorRenderer.jsx
import MySpecialEditor from './MySpecialEditor'

const SPECIAL_EDITOR_COMPONENTS = {
    'MediaSpecialEditor': MediaSpecialEditor,
    'MySpecialEditor': MySpecialEditor,  // ← Add here
}
```

### Step 3: Declare in Widget Metadata
```javascript
// In your widget component
MyWidget.metadata = {
    name: 'My Widget',
    description: '...',
    category: 'custom',
    icon: MyIcon,
    tags: [...],
    specialEditor: 'MySpecialEditor'  // ← Declare here
}
```

### Step 4: Hide Fields Managed by Special Editor (Backend)
```python
# In your widget's Pydantic config
class MyWidgetConfig(BaseModel):
    special_field: str = Field(
        ...,
        description="Managed by special editor",
        json_schema_extra={
            "hidden": True,  # ← Hide from schema controls
        },
    )
```

## Bug Fixes

### Issue: Special Editor Not Opening for eceee Widgets

**Problem**: The `autoOpenSpecialEditor` prop was hardcoded to only check for `'default_widgets.ImageWidget'`, so it never opened for other widget types including `'easy_widgets.ImageWidget'`.

**Solution**: Changed `autoOpenSpecialEditor` to always be `true`. The `WidgetEditorPanel` component already has logic to check if a widget has a special editor using `supportsSpecialEditor()`, so it will only open the special editor when one exists.

**Files Changed**:
- `frontend/src/components/PageEditor.jsx`
- `frontend/src/components/objectEdit/ObjectContentView.jsx`

**Registry Lookup Fix**: Updated `getSpecialEditor()` to correctly access nested metadata:
```javascript
const widgetEntry = getWidgetMetadata(widgetType)
const metadata = widgetEntry?.metadata  // Access nested metadata
```

## Testing

1. **Restart Backend**: `docker-compose restart backend`
2. **Refresh Frontend**: Hard refresh the browser (Cmd+Shift+R or Ctrl+Shift+R)
3. **Test eceee Image Widget**:
   - Open a page with eceee Image Widget
   - Special editor should automatically open (MediaSpecialEditor)
   - Should show visual media browser on the left
   - Should NOT show mediaItems field in schema controls on the right
   - Check console for: `[SpecialEditor] Found editor "MediaSpecialEditor" for easy_widgets.ImageWidget`
4. **Test Header Widget**:
   - Should show all editable fields organized in groups
   - Should have proper controls (color pickers, toggles, etc.)

## Migration Path

Existing widgets using the legacy registry will continue to work. Over time, migrate by:
1. Adding `specialEditor` to widget metadata
2. Eventually remove entries from `LEGACY_SPECIAL_EDITORS`

