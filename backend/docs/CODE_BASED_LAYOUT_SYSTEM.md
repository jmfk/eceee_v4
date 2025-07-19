# Code-Based Layout System

The eceee_v4 project features a powerful code-based layout system that allows third-party Django apps to register layout classes directly in code.

## Overview

The layout system provides:

- **Code-based layout registration** - Define layouts as Python classes
- **Automatic discovery** - Layouts are automatically discovered from Django apps
- **Third-party app support** - Any Django app can provide layouts
- **Unified API** - All layouts work through consistent interfaces
- **Dynamic behavior** - Layouts can have conditional availability and custom logic
- **Version control friendly** - Layouts are defined in code and versioned with your application

## Architecture

### Core Components

1. **`BaseLayout`** - Abstract base class for all code-based layouts
2. **`LayoutRegistry`** - Global registry that manages layout classes
3. **`autodiscover_layouts()`** - Automatic discovery system for Django apps
4. **WebPage model** - Uses `code_layout` field to reference layout names
5. **Management commands** - Tools for layout management and validation

### File Structure

```
backend/webpages/
├── layout_registry.py          # Base classes and registry
├── layout_autodiscovery.py     # Discovery and validation
├── layouts.py                  # Example layout implementations
├── models.py                   # WebPage model with code_layout field
├── views.py                    # API endpoints for layouts
├── serializers.py              # Layout serializers
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

## Layout Management

### Using Management Command

```bash
# List all available layouts
python manage.py manage_layouts list

# Validate layout configurations
python manage.py manage_layouts validate

# Show detailed layout information
python manage.py manage_layouts info --layout single_column

# Reload layouts from code
python manage.py manage_layouts reload
```

## API Usage

### REST Endpoints

#### Layout Management
- `GET /api/webpages/code-layouts/` - List all available layouts
- `GET /api/webpages/code-layouts/{name}/` - Get specific layout details
- `GET /api/webpages/code-layouts/choices/` - Get layout choices for forms
- `POST /api/webpages/code-layouts/reload/` - Reload layouts from code (admin)
- `GET /api/webpages/code-layouts/validate/` - Validate layout configurations (admin)
- `GET /api/webpages/layouts/all_layouts/` - Get all layouts with summary information

### Page Serialization

The `WebPageDetailSerializer` includes:

```json
{
  "id": 1,
  "title": "My Page",
  "code_layout": "single_column",
  "effective_layout": {
    "name": "single_column",
    "description": "Single column layout with main content area",
    "type": "code",
    "slot_configuration": {
      "slots": [
        {
          "name": "main",
          "display_name": "Main Content",
          "description": "Primary content area",
          "css_classes": "main-content",
          "allows_multiple": true
        }
      ]
    }
  },
  "layout_type": "code",
  "layout_inheritance_info": {
    "effective_layout_dict": {...},
    "layout_type": "code",
    "inheritance_chain": [...],
    "inherited_from": null
  },
  "available_code_layouts": ["single_column", "two_column", "three_column"]
}
```

## Management Commands

### manage_layouts command

```bash
# Show layout summary
python manage.py manage_layouts summary

# List all available layouts
python manage.py manage_layouts list [--active-only]

# Validate layout configurations
python manage.py manage_layouts validate

# Reload layouts from code
python manage.py manage_layouts reload

# Get detailed layout information
python manage.py manage_layouts info --layout layout_name
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
- **Management tools** - Comprehensive layout management utilities
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
7. **Version Control**: Keep layouts organized and well-documented in code

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