# Example Custom Layouts App

This Django app demonstrates how to create custom layout definitions that extend or replace the default layouts provided by eceee_v4.

## Available Custom Layouts

### HeroLayout (`hero_layout`)
- **Description**: Hero layout with large banner section and content areas
- **Slots**: hero, content, features, cta
- **Use Case**: Landing pages, marketing pages, product showcases
- **Features**: Full-height hero section, feature grid, call-to-action area

### DashboardLayout (`dashboard_layout`)
- **Description**: Dashboard layout with multiple widget areas for admin interfaces
- **Slots**: header, sidebar, main, widgets_top, widgets_bottom
- **Use Case**: Admin dashboards, analytics interfaces, control panels
- **Features**: Fixed sidebar navigation, widget grid areas, responsive design

## Usage

### Enable Custom Layouts

Add `example_custom_layouts` to your `INSTALLED_APPS` in `settings.py`:

```python
INSTALLED_APPS = [
    # ... other apps
    'webpages',                  # Core system (required)
    'default_layouts',           # Default layouts (optional)
    'example_custom_layouts',    # Example custom layouts
    # ... other apps
]
```

### Use Alongside Default Layouts

```python
INSTALLED_APPS = [
    'webpages',                  # Core system
    'default_layouts',           # Default layouts
    'example_custom_layouts',    # Custom layouts (additional)
]
```

**Result**: You'll have access to both default layouts (single_column, two_column, etc.) and custom layouts (hero_layout, dashboard_layout).

### Replace Default Layouts

```python
INSTALLED_APPS = [
    'webpages',                  # Core system
    # 'default_layouts',        # Disabled - no default layouts
    'example_custom_layouts',    # Custom layouts only
]
```

**Result**: Only custom layouts will be available.

## Templates

Layout templates are located in `templates/example_custom_layouts/layouts/`:

- `hero_layout.html` - Hero layout template with Tailwind CSS classes
- `dashboard_layout.html` - Dashboard layout template with sidebar and widget areas

## Creating Your Own Custom Layouts

### Step 1: Create Layout Class

```python
# your_custom_layouts/layouts.py
from webpages.layout_registry import BaseLayout, register_layout

@register_layout
class MyCustomLayout(BaseLayout):
    name = "my_custom_layout"
    description = "Description of your layout"
    template_name = "your_custom_layouts/layouts/my_layout.html"
    css_classes = "layout-my-custom"
    
    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "main",
                    "title": "Main Content",
                    "description": "Primary content area",
                    "max_widgets": None,
                    "css_classes": "slot-main",
                },
                # ... more slots
            ]
        }
```

### Step 2: Create Template

```html
<!-- your_custom_layouts/templates/your_custom_layouts/layouts/my_layout.html -->
{% extends "base.html" %}
{% load webpages_tags %}

{% block content %}
<div class="my-custom-layout">
    <main class="main-content">
        {% render_slot "main" %}
    </main>
</div>
{% endblock %}
```

### Step 3: Create App Configuration

```python
# your_custom_layouts/apps.py
from django.apps import AppConfig

class YourCustomLayoutsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'your_custom_layouts'
    verbose_name = 'Your Custom Layouts'
    
    def ready(self):
        from . import layouts
```

### Step 4: Add to INSTALLED_APPS

```python
INSTALLED_APPS = [
    # ... other apps
    'your_custom_layouts',
]
```

## Override Default Layouts

To override a default layout, use the same name:

```python
@register_layout
class SingleColumnLayout(BaseLayout):
    name = "single_column"  # Same name as default - will override
    # Your custom implementation
```

## App Configuration

The app automatically registers all layouts when Django starts up via the `ready()` method in `apps.py`. No manual configuration is needed.

## Dependencies

- Requires `webpages` app for `BaseLayout` and `register_layout`
- Uses Django's template system for rendering
- Compatible with the layout autodiscovery system

## Styling

The example layouts use Tailwind CSS classes for styling, but you can use any CSS framework or custom styles in your templates.
