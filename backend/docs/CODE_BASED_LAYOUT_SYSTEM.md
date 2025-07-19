# Code-Based Layout System

The eceee_v4 project now features a powerful code-based layout system that allows third-party Django apps to register layout classes directly in code, replacing the need for database-defined layouts.

## Overview

The new layout system provides:

- **Code-based layout registration** - Define layouts as Python classes
- **Automatic discovery** - Layouts are automatically discovered from Django apps
- **Third-party app support** - Any Django app can provide layouts
- **Backward compatibility** - Existing database layouts continue to work
- **Unified API** - Both layout types work through the same interfaces
- **Dynamic behavior** - Layouts can have conditional availability and custom logic

## Architecture

### Core Components

1. **`BaseLayout`** - Abstract base class for all code-based layouts
2. **`LayoutRegistry`** - Global registry that manages layout classes
3. **`autodiscover_layouts()`** - Automatic discovery system for Django apps
4. **Extended models** - WebPage model supports both layout types
5. **Management commands** - Tools for migration and management

### File Structure

```
backend/webpages/
├── layout_registry.py          # Base classes and registry
├── layout_autodiscovery.py     # Discovery and validation
├── layouts.py                  # Example layout implementations
├── models.py                   # Updated WebPage model
├── views.py                    # API endpoints for layouts
├── serializers.py              # Updated serializers
├── management/commands/
│   └── manage_layouts.py       # Management command
└── apps.py                     # Auto-discovery integration
```

## Creating Layouts

### Basic Layout Class

```python
from webpages.layout_registry import BaseLayout, register_layout

@register_layout
class MyLayout(BaseLayout):
    name = "my_layout"
    description = "Description of my layout"
    template_name = "myapp/templates/my_layout.html"
    css_classes = "layout-my-layout"
    
    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "header",
                    "title": "Header",
                    "description": "Page header content",
                    "max_widgets": 1,
                    "css_classes": "slot-header",
                },
                {
                    "name": "main",
                    "title": "Main Content", 
                    "description": "Primary content area",
                    "max_widgets": None,  # Unlimited
                    "css_classes": "slot-main",
                },
            ]
        }
```

### Advanced Features

#### Conditional Availability
```python
class BusinessHoursLayout(BaseLayout):
    name = "business_hours"
    
    @property
    def is_active(self):
        import datetime
        now = datetime.datetime.now()
        return 9 <= now.hour < 17  # Only active 9 AM - 5 PM
    
    @property
    def slot_configuration(self):
        # ... configuration
```

#### Manual Registration
```python
# Alternative to decorator
from webpages.layout_registry import layout_registry

class ManualLayout(BaseLayout):
    # ... implementation

layout_registry.register(ManualLayout)
```

## Third-Party App Integration

### Step 1: Create layouts.py
Create a `layouts.py` file in your Django app:

```python
# myapp/layouts.py
from webpages.layout_registry import BaseLayout, register_layout

@register_layout
class MyAppLayout(BaseLayout):
    name = "myapp_special"
    description = "Special layout for MyApp"
    template_name = "myapp/special_layout.html"
    
    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "content",
                    "title": "Content",
                    "description": "Main content area",
                    "max_widgets": None,
                }
            ]
        }
```

### Step 2: Automatic Discovery
The layout will be automatically discovered when Django starts up. No additional configuration required!

### Step 3: Create Template
Create the corresponding template file:

```html
<!-- myapp/templates/myapp/special_layout.html -->
{% extends "base.html" %}

{% block content %}
<div class="myapp-special-layout">
    {% for slot in slots %}
        {% if slot.name == "content" %}
            <div class="content-slot">
                {% for widget in slot.widgets %}
                    <!-- Render widget -->
                {% endfor %}
            </div>
        {% endif %}
    {% endfor %}
</div>
{% endblock %}
```

## Migration from Database Layouts

### Using Management Command

```bash
# List all layouts
python manage.py manage_layouts list

# Export database layouts to code
python manage.py manage_layouts export --output-file my_layouts.py

# Convert pages from database to code layouts
python manage.py manage_layouts convert-pages \
    --from-layout "Two Column" \
    --to-layout "two_column" \
    --dry-run

# Apply the conversion
python manage.py manage_layouts convert-pages \
    --from-layout "Two Column" \
    --to-layout "two_column"
```

### Manual Migration Process

1. **Export existing layouts**: Use the management command to generate code templates
2. **Create layout classes**: Implement the exported layouts as code
3. **Test layouts**: Verify layouts work correctly
4. **Convert pages**: Use management command to switch pages to code layouts
5. **Remove database layouts**: Clean up old database entries (optional)

## API Usage

### REST Endpoints

#### Code Layouts
- `GET /api/webpages/code-layouts/` - List all code layouts
- `GET /api/webpages/code-layouts/{name}/` - Get specific layout
- `GET /api/webpages/code-layouts/choices/` - Get layout choices
- `POST /api/webpages/code-layouts/reload/` - Reload layouts (admin)
- `GET /api/webpages/code-layouts/validate/` - Validate layouts (admin)

#### Combined Layouts
- `GET /api/webpages/layouts/all_layouts/` - Get both database and code layouts

### Page Serialization

The `WebPageDetailSerializer` now includes:

```json
{
  "id": 1,
  "title": "My Page",
  "code_layout": "single_column",
  "layout": null,
  "effective_layout": {
    "name": "single_column",
    "description": "Single column layout...",
    "type": "code",
    "slot_configuration": {...}
  },
  "layout_type": "code",
  "layout_inheritance_info": {
    "effective_layout": {...},
    "layout_type": "code",
    "inheritance_chain": [...],
    "override_options": {
      "database_layouts": [...],
      "code_layouts": [...]
    }
  },
  "available_code_layouts": [...]
}
```

## Management Commands

### manage_layouts command

```bash
# Show summary
python manage.py manage_layouts summary

# List layouts
python manage.py manage_layouts list [--type code|database|all] [--active-only]

# Validate layouts
python manage.py manage_layouts validate

# Reload code layouts
python manage.py manage_layouts reload

# Export database layouts
python manage.py manage_layouts export [--output-file filename.py]

# Migrate specific layout
python manage.py manage_layouts migrate [--layout-id ID] [--dry-run]

# Convert pages
python manage.py manage_layouts convert-pages \
    --from-layout "db_layout_name" \
    --to-layout "code_layout_name" \
    [--dry-run]
```

## Template Integration

### Layout Templates

Code layouts can specify custom templates:

```python
class CustomLayout(BaseLayout):
    template_name = "myapp/custom_layout.html"
```

### Slot Rendering

In your layout template:

```html
{% for slot in slots %}
    <div class="slot-{{ slot.name }} {{ slot.css_classes }}">
        {% for widget in slot.widgets %}
            {% include widget.template_name with widget=widget %}
        {% endfor %}
    </div>
{% endfor %}
```

## Configuration

### Settings

```python
# settings.py

# Enable/disable layout autodiscovery (default: True)
LAYOUT_AUTODISCOVERY_ENABLED = True

# Validate layouts on startup (default: True)
LAYOUT_VALIDATION_ON_STARTUP = True
```

## Benefits

### For Developers
- **Version control** - Layouts are in code, tracked by Git
- **IDE support** - Full IDE features (autocomplete, refactoring, etc.)
- **Type safety** - Optional type hints and validation
- **Testability** - Easy unit testing of layout logic
- **Documentation** - Layouts are self-documenting code

### For Third-Party Apps
- **Easy distribution** - No database migrations needed
- **Dynamic behavior** - Conditional availability and custom logic
- **Namespace safety** - No conflicts with layout names
- **Hot reloading** - Development environments can reload layouts

### For Site Administrators
- **Backward compatibility** - Existing layouts continue working
- **Migration tools** - Comprehensive migration utilities
- **API access** - Full REST API for layout management
- **Monitoring** - Validation and health checking tools

## Example Implementations

See `backend/webpages/layouts.py` for complete examples including:

- `SingleColumnLayout` - Basic single column layout
- `TwoColumnLayout` - Layout with sidebar
- `ThreeColumnLayout` - Complex multi-column layout  
- `LandingPageLayout` - Hero-style marketing layout
- `MinimalLayout` - Clean, minimal design
- `ConditionalLayout` - Example with conditional availability

## Best Practices

1. **Naming Convention**: Use descriptive, unique layout names
2. **Documentation**: Include clear descriptions and slot documentation
3. **Validation**: Always validate slot configurations
4. **Templates**: Create corresponding template files
5. **CSS Classes**: Use consistent CSS class naming
6. **Testing**: Test layout registration and rendering
7. **Backwards Compatibility**: Consider migration paths for existing sites

## Troubleshooting

### Common Issues

**Layout not found**: Check that the layouts.py module is being imported
**Validation errors**: Verify slot configuration structure
**Template errors**: Ensure template file exists and is properly structured
**Import errors**: Check for circular imports in layouts.py

### Debugging

```python
# Check registered layouts
from webpages.layout_registry import layout_registry
print(layout_registry.list_layouts())

# Validate specific layout
layout = layout_registry.get_layout('my_layout')
layout.validate_slot_configuration()

# Reload layouts in development
from webpages.layout_autodiscovery import reload_layouts
reload_layouts()
```

## Future Enhancements

- Layout inheritance and composition
- Visual layout editor integration
- Performance optimization and caching
- Plugin system for layout extensions
- Advanced validation and linting tools

---

This code-based layout system transforms eceee_v4 into a truly extensible CMS platform where third-party apps can seamlessly provide layout functionality without database dependencies. 