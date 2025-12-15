# Theme Structure Refactoring Plan

## Overview

This plan outlines the refactoring of the theme sync system to support:
1. **Multi-module theme structure** - Split themes into separate files (theme.py, colors.py, fonts.py, etc.)
2. **Hostname-based directory structure** - Organize themes by server hostname (e.g., `themes/eceee.org/`)
3. **Image file handling** - Store theme images as files instead of URLs
4. **Nested classes support** - Optional support for nested classes within theme modules
5. **Backward compatibility** - Support both old single-file and new multi-module structures

## Current State

### Current Structure
```
themes/
├── base/
│   └── theme_name/
│       └── theme.py          # Single file with all theme data
└── custom/
    └── theme_name/
        └── theme.py
```

### Current Theme Fields (from PageTheme model)
- `name` - Theme name
- `description` - Theme description
- `fonts` - Google Fonts configuration
- `colors` - Named color palette
- `design_groups` - HTML element styles with layout properties
- `component_styles` - Named component styles with templates
- `image_styles` - Image styles (gallery/carousel) with templates
- `table_templates` - Predefined table templates
- `breakpoints` - Responsive breakpoint configuration
- `image` - Theme preview image (currently stored as URL)

## Target State

### New Directory Structure
```
themes/
└── {HOSTNAME}/                    # e.g., eceee.org
    ├── .sync_state.json          # Sync state for this hostname
    ├── base/                     # Base themes
    │   └── theme_name/
    │       ├── __init__.py        # Module init (optional)
    │       ├── theme.py           # Main theme class + metadata
    │       ├── colors.py          # Color definitions
    │       ├── fonts.py           # Font definitions
    │       ├── design_groups.py   # Design group styles
    │       ├── component_styles.py # Component styles
    │       ├── image_styles.py    # Image style definitions
    │       ├── table_templates.py # Table templates
    │       ├── breakpoints.py     # Breakpoint configuration
    │       ├── theme_image.png    # Theme preview image (file)
    │       └── templates/         # Mustache templates
    │           ├── component_styles/
    │           └── image_styles/
    └── custom/                    # Custom themes (can inherit)
        └── theme_name/
            └── ... (same structure)
```

### New Module Structure

#### theme.py (Main Theme Class)
```python
"""
Main theme class with metadata and imports from other modules.
"""
from .colors import Colors
from .fonts import Fonts
from .design_groups import DesignGroups
from .component_styles import ComponentStyles
from .image_styles import ImageStyles
from .table_templates import TableTemplates
from .breakpoints import Breakpoints

class IndustryTheme:
    """Industrial theme with blue accents"""
    
    name = "Industry"
    description = "Clean modern theme with blue accents"
    image = "theme_image.png"  # Reference to image file in same directory
    
    # Import from other modules
    colors = Colors
    fonts = Fonts
    design_groups = DesignGroups
    component_styles = ComponentStyles
    image_styles = ImageStyles
    table_templates = TableTemplates
    breakpoints = Breakpoints
```

#### colors.py
```python
"""Color palette definitions"""

class Colors:
    primary = "#1e437c"
    secondary = "#56667a"
    text = "#000000"
    background = "#ffffff"
    # ... more colors
```

#### fonts.py
```python
"""Font configuration"""

class Fonts:
    google_fonts = [
        {
            "family": "Source Sans 3",
            "display": "swap",
            "variants": ["300", "500", "700"]
        }
    ]
```

#### design_groups.py
```python
"""Design group styles with layout properties"""

class DesignGroups:
    groups = [
        {
            "name": "Default Typography",
            "isDefault": True,
            "elements": {
                "h1": {"fontSize": "41px", ...},
                "p": {"fontSize": "16px", ...},
            }
        },
        # ... more groups
    ]
```

#### component_styles.py
```python
"""Component styles with Mustache templates"""

class ComponentStyles:
    navigation = {
        "name": "navigation",
        "template": "",  # Template loaded from templates/component_styles/navigation.mustache
        "css": {...},
        "description": ""
    }
    # ... more component styles
```

#### image_styles.py
```python
"""Image styles (gallery/carousel)"""

class ImageStyles:
    gallery = {
        "name": "gallery",
        "styleType": "gallery",
        "template": "",  # Loaded from templates/image_styles/gallery.mustache
        "css": {...},
    }
    # ... more image styles
```

#### table_templates.py
```python
"""Table templates"""

class TableTemplates:
    prices = {
        "name": "prices",
        "rows": [...],
        "columnWidths": ["auto", "auto"]
    }
```

#### breakpoints.py
```python
"""Responsive breakpoint configuration"""

class Breakpoints:
    sm = 640
    md = 768
    lg = 1024
    xl = 1280
```

## Implementation Tasks

### Phase 1: Configuration & Directory Structure

#### Task 1.1: Add Hostname Configuration
- [ ] Update `theme-sync/config.py` to add `HOSTNAME` environment variable
- [ ] Default to `localhost` if not set
- [ ] Update `SYNC_STATE_FILE` to be hostname-specific

**Files to modify:**
- `theme-sync/config.py`

**Changes:**
```python
HOSTNAME = os.getenv("HOSTNAME", "localhost")
SYNC_STATE_FILE = THEMES_DIR / HOSTNAME / ".sync_state.json"
```

#### Task 1.2: Update Sync Service Directory Structure
- [ ] Update `ThemeSyncService.__init__()` to use hostname directory
- [ ] Update `initial_sync()` to use `themes/{HOSTNAME}/base/` and `themes/{HOSTNAME}/custom/`
- [ ] Update `poll_server()` directory logic
- [ ] Update `on_file_change()` path resolution

**Files to modify:**
- `theme-sync/sync_service.py`

**Key changes:**
- `self.hostname_dir = self.themes_dir / config.HOSTNAME`
- Update all path references to include hostname

### Phase 2: Multi-Module Theme Generation

#### Task 2.1: Create Module Generator Functions
- [ ] Create `generate_colors_module()` in `json_to_python.py`
- [ ] Create `generate_fonts_module()` in `json_to_python.py`
- [ ] Create `generate_design_groups_module()` in `json_to_python.py`
- [ ] Create `generate_component_styles_module()` in `json_to_python.py`
- [ ] Create `generate_image_styles_module()` in `json_to_python.py`
- [ ] Create `generate_table_templates_module()` in `json_to_python.py`
- [ ] Create `generate_breakpoints_module()` in `json_to_python.py`

**Files to modify:**
- `theme-sync/converters/json_to_python.py`

#### Task 2.2: Update Main Theme Generator
- [ ] Update `generate_theme_class_code()` to import from modules
- [ ] Generate `theme.py` with imports instead of inline data
- [ ] Handle inheritance with updated import paths

**Files to modify:**
- `theme-sync/converters/json_to_python.py`

#### Task 2.3: Update `generate_theme_from_json()`
- [ ] Generate all module files (colors.py, fonts.py, etc.)
- [ ] Generate `theme.py` with imports
- [ ] Create `__init__.py` for Python package support
- [ ] Update import paths to include hostname

**Files to modify:**
- `theme-sync/converters/json_to_python.py`

### Phase 3: Multi-Module Theme Reading

#### Task 3.1: Update Module Import Logic
- [ ] Update `find_theme_class()` to handle module imports
- [ ] Update `resolve_inheritance()` to handle module attributes
- [ ] Add logic to import from separate modules (colors, fonts, etc.)

**Files to modify:**
- `theme-sync/converters/python_to_json.py`

#### Task 3.2: Handle Module Attributes
- [ ] Detect when attributes are module classes vs. direct values
- [ ] Extract data from module classes (e.g., `Colors.primary`)
- [ ] Merge module data into theme dictionary

**Files to modify:**
- `theme-sync/converters/python_to_json.py`

#### Task 3.3: Update Path Resolution
- [ ] Fix `sys.path` manipulation to include hostname
- [ ] Update import path resolution for inheritance
- [ ] Handle relative imports within theme directory

**Files to modify:**
- `theme-sync/converters/python_to_json.py`

### Phase 4: Image File Handling

#### Task 4.1: Download Images from Server
- [ ] Add `download_theme_image()` function
- [ ] Download image from server URL during initial sync
- [ ] Save image as file in theme directory
- [ ] Handle image download errors gracefully

**Files to modify:**
- `theme-sync/converters/json_to_python.py`
- `theme-sync/sync_service.py`

#### Task 4.2: Upload Images to Server
- [ ] Add `upload_theme_image()` function
- [ ] Read image file from theme directory
- [ ] Upload to server when pushing theme
- [ ] Handle image upload in push endpoint

**Files to modify:**
- `theme-sync/converters/python_to_json.py`
- `backend/webpages/views/theme_sync_views.py`

#### Task 4.3: Update Theme Model/Serializer
- [ ] Ensure image field can accept file uploads
- [ ] Handle image URL conversion for API responses
- [ ] Store image reference as filename in Python code

**Files to check:**
- `backend/webpages/models/page_theme.py`
- `backend/webpages/serializers/theme.py`

### Phase 5: Backward Compatibility

#### Task 5.1: Detect Theme Structure
- [ ] Add `detect_theme_structure()` function
- [ ] Check if theme uses single-file or multi-module structure
- [ ] Support reading both formats

**Files to modify:**
- `theme-sync/converters/python_to_json.py`

#### Task 5.2: Migration Helper
- [ ] Create optional migration script to convert old themes
- [ ] Split single `theme.py` into multiple modules
- [ ] Download images from URLs to files

**Files to create:**
- `theme-sync/migrate_theme_structure.py` (optional)

### Phase 6: Testing & Documentation

#### Task 6.1: Update Documentation
- [ ] Update `theme-sync/README.md` with new structure
- [ ] Document hostname configuration
- [ ] Document multi-module structure
- [ ] Add examples of theme files

**Files to modify:**
- `theme-sync/README.md`

#### Task 6.2: Update Docker Compose
- [ ] Add `HOSTNAME` environment variable to example
- [ ] Document configuration options

**Files to modify:**
- `docker-compose.dev.yml` (example in README)

#### Task 6.3: Testing
- [ ] Test initial sync with new structure
- [ ] Test file watching and push
- [ ] Test inheritance with new import paths
- [ ] Test image download/upload
- [ ] Test backward compatibility

## Implementation Details

### Import Path Resolution

For inheritance, import paths should be:
```python
# From: themes/eceee.org/base/industry/theme.py
# To: themes/eceee.org/base/parent_theme/theme.py

from themes.eceee_org.base.parent_theme.theme import ParentThemeTheme
```

Note: Hostname dots (`.`) need to be replaced with underscores (`_`) in Python imports.

### Module Class Detection

When reading themes, detect module classes:
```python
if isinstance(value, type) and hasattr(value, '__module__'):
    # It's a class from another module
    # Extract attributes from the class
    module_data = {k: v for k, v in vars(value).items() 
                   if not k.startswith('_') and not callable(v)}
```

### Image Handling

1. **Download (JSON → Python):**
   - Extract image URL from theme data
   - Download image using `requests`
   - Save as `theme_image.png` in theme directory
   - Update theme.py to reference filename

2. **Upload (Python → JSON):**
   - Read image file from theme directory
   - Upload to server via API (multipart/form-data)
   - Get image URL from response
   - Include URL in JSON data

### Error Handling

- Handle missing modules gracefully
- Provide clear error messages for import failures
- Support partial module structure (some modules missing)
- Validate image file existence before upload

## Migration Strategy

### Option 1: Automatic Migration (Recommended)
- On first sync, detect old structure
- Automatically convert to new structure
- Keep old files as backup

### Option 2: Manual Migration
- Provide migration script
- User runs script when ready
- Old themes continue to work until migrated

### Option 3: Dual Support
- Support both structures indefinitely
- Auto-detect which structure is used
- Convert on-the-fly when needed

**Recommendation:** Option 1 (Automatic Migration) - Convert during initial sync, keep old structure working until conversion.

## Configuration Changes

### Environment Variables

Add to `docker-compose.dev.yml`:
```yaml
theme-sync:
  environment:
    - HOSTNAME=eceee.org  # Server hostname
    - THEMES_DIR=/themes
    # ... other vars
```

### Config File

Update `theme-sync/config.py`:
```python
HOSTNAME = os.getenv("HOSTNAME", "localhost")
THEMES_DIR = Path(os.getenv("THEMES_DIR", "/themes"))
SYNC_STATE_FILE = THEMES_DIR / HOSTNAME / ".sync_state.json"
```

## Testing Checklist

- [ ] Initial sync creates multi-module structure
- [ ] Images are downloaded and saved as files
- [ ] File changes trigger push correctly
- [ ] Inheritance works with new import paths
- [ ] Images are uploaded when pushing themes
- [ ] Old single-file themes still work (backward compatibility)
- [ ] Hostname directory structure is correct
- [ ] Sync state is hostname-specific
- [ ] Multiple hostnames work independently

## Risks & Mitigations

### Risk 1: Import Path Complexity
**Mitigation:** Use absolute imports with hostname, handle dot-to-underscore conversion

### Risk 2: Image Upload/Download Failures
**Mitigation:** Graceful error handling, fallback to URL if file missing

### Risk 3: Breaking Existing Themes
**Mitigation:** Maintain backward compatibility, auto-migrate on sync

### Risk 4: Module Import Errors
**Mitigation:** Validate module structure, provide clear error messages

## Success Criteria

1. ✅ Themes are organized by hostname
2. ✅ Themes are split into logical modules
3. ✅ Images are stored as files
4. ✅ Inheritance works with new structure
5. ✅ Backward compatibility maintained
6. ✅ All existing functionality works
7. ✅ Documentation is updated
8. ✅ Configuration is clear and simple

## Timeline Estimate

- **Phase 1:** 2-3 hours (Configuration & Directory Structure)
- **Phase 2:** 4-5 hours (Multi-Module Generation)
- **Phase 3:** 3-4 hours (Multi-Module Reading)
- **Phase 4:** 2-3 hours (Image Handling)
- **Phase 5:** 1-2 hours (Backward Compatibility)
- **Phase 6:** 2-3 hours (Testing & Documentation)

**Total:** ~14-20 hours

## Next Steps

1. Review and approve this plan
2. Start with Phase 1 (Configuration & Directory Structure)
3. Implement incrementally, testing after each phase
4. Update documentation as we go
5. Final testing and cleanup

