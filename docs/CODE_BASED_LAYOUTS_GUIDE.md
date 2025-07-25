# Code-Based Layouts Guide

## Overview 

The eceee_v4 project uses a **code-based layouts system** where layouts are defined as Python classes and tracked in version control alongside your codebase. This provides better developer experience, type safety, and system reliability.

## Creating New Layouts

### Step 1: Define Layout Class

Create a layout class by extending `BaseLayout` and registering it:

```python
from webpages.layout_registry import BaseLayout, register_layout

@register_layout
class MyLayout(BaseLayout):
    name = "my_layout"
    description = "A custom layout for special pages"
    template_name = "layouts/my_layout.html"
    
    slot_configuration = {
        "slots": [
            {
                "name": "main",
                "display_name": "Main Content",
                "description": "Primary content area",
                "css_classes": "main-content",
                "allows_multiple": True
            },
            {
                "name": "sidebar",
                "display_name": "Sidebar",
                "description": "Secondary content area",
                "css_classes": "sidebar",
                "allows_multiple": False
            }
        ]
    }
```

### Step 2: Create HTML Template

Create the corresponding template file in `templates/webpages/layouts/`:

```html
<!-- templates/webpages/layouts/my_layout.html -->
{% extends "base.html" %}
{% load webpages_tags %}

{% block content %}
<div class="my-layout">
    <main class="main-content">
        {% render_slot "main" %}
    </main>
    <aside class="sidebar">
        {% render_slot "sidebar" %}
    </aside>
</div>
{% endblock %}
```

### Step 3: Register and Validate

The `@register_layout` decorator automatically registers your layout. Validate it works:

```bash
# Validate all layouts
python manage.py manage_layouts validate

# Check your specific layout
python manage.py manage_layouts info --layout my_layout
```

## Layout Configuration

### Required Fields

- **name**: Unique identifier (snake_case recommended)
- **description**: Human-readable description
- **template_name**: Path to HTML template
- **slot_configuration**: Defines available content slots

### Slot Configuration

Each slot supports these properties:

```python
{
    "name": "slot_name",              # Required: unique identifier
    "display_name": "Display Name",   # Required: user-friendly name
    "description": "Slot purpose",    # Required: what goes here
    "css_classes": "custom-class",    # Optional: additional CSS classes
    "allows_multiple": True,          # Optional: multiple widgets allowed
    "widget_types": ["text", "image"] # Optional: restrict widget types
}
```

## Using Layouts

### Assigning to Pages

Reference layouts by name in the `code_layout` field:

```python
page = WebPage.objects.create(
    title="My Page",
    code_layout="my_layout",  # References the layout class name
    slug="my-page"
)
```

### API Response

The API provides layout information:

```json
{
  "id": 1,
  "title": "My Page",
  "code_layout": "my_layout",
  "effective_layout": {
    "name": "my_layout",
    "type": "code",
    "slot_configuration": {...},
    "template_name": "layouts/my_layout.html"
  },
  "layout_type": "code",
  "available_code_layouts": ["single_column", "two_column", "my_layout"]
}
```

## Built-in Layouts

The system includes these ready-to-use layouts:

| Layout Name | Description | Slots |
|-------------|-------------|-------|
| `single_column` | Simple single column | main |
| `two_column` | Main content + sidebar | main, sidebar |
| `three_column` | Header + main + sidebar | header, main, sidebar |
| `landing_page` | Hero-style marketing | hero, features, content |
| `minimal` | Clean, minimal design | content |

## Management Commands

Use the `manage_layouts` command for layout management:

```bash
# List all available layouts
python manage.py manage_layouts list

# Validate layout configurations
python manage.py manage_layouts validate

# Reload layouts from code
python manage.py manage_layouts reload

# Get detailed layout information
python manage.py manage_layouts info --layout single_column

# Check for template files
python manage.py manage_layouts check-templates
```

## Advanced Features

### Layout Inheritance

Extend existing layouts to create variations:

```python
@register_layout
class CustomTwoColumn(TwoColumnLayout):
    name = "custom_two_column"
    description = "Two column with custom styling"
    template_name = "layouts/custom_two_column.html"
    
    # Inherit slot_configuration from parent
    # Override only what you need to change
```

### Dynamic Slot Configuration

Generate slots programmatically:

```python
@register_layout
class DynamicLayout(BaseLayout):
    name = "dynamic_layout"
    description = "Layout with dynamic slots"
    template_name = "layouts/dynamic_layout.html"
    
    @property
    def slot_configuration(self):
        slots = []
        for i in range(1, 4):  # Create 3 dynamic slots
            slots.append({
                "name": f"section_{i}",
                "display_name": f"Section {i}",
                "description": f"Content section {i}",
                "css_classes": f"section-{i}",
                "allows_multiple": True
            })
        return {"slots": slots}
```

### Conditional Slots

Create layouts that adapt based on context:

```python
@register_layout
class ConditionalLayout(BaseLayout):
    name = "conditional_layout"
    description = "Layout with conditional slots"
    template_name = "layouts/conditional_layout.html"
    
    def get_slots_for_page(self, page):
        """Return different slots based on page properties"""
        base_slots = [
            {"name": "main", "display_name": "Main", "description": "Main content"}
        ]
        
        # Add sidebar slot for certain page types
        if hasattr(page, 'show_sidebar') and page.show_sidebar:
            base_slots.append({
                "name": "sidebar",
                "display_name": "Sidebar", 
                "description": "Sidebar content"
            })
            
        return {"slots": base_slots}
```

## Best Practices

### Naming Conventions
- Use **snake_case** for layout names
- Use descriptive names that indicate purpose
- Prefix with namespace for organization: `blog_single`, `shop_product`

### Documentation
- Include clear descriptions for layouts and slots
- Document expected widget types for each slot
- Add examples of appropriate use cases

### Template Organization
- Store templates in `templates/webpages/layouts/`
- Use consistent naming: `{layout_name}.html`
- Include semantic HTML structure
- Add appropriate CSS classes for styling

### Validation
- Always validate layouts after creation
- Test with different widget configurations
- Ensure templates exist and render correctly

### Version Control
- Commit layout changes with descriptive messages
- Include both layout class and template in same commit
- Document breaking changes in commit messages

## Troubleshooting

### Common Issues

**Layout not found**
```bash
# Check if layout is registered
python manage.py manage_layouts list
```

**Template missing**
```bash
# Verify template exists
python manage.py manage_layouts check-templates
```

**Validation errors**
```bash
# Check slot configuration
python manage.py manage_layouts validate --layout my_layout
```

**Import errors**
- Check for circular imports in layout modules
- Ensure all dependencies are imported correctly
- Verify layout files are in Python path

### Debugging Layouts

Use Django shell to debug layout issues:

```python
from webpages.layout_registry import layout_registry

# List all layouts
print(layout_registry.list_layouts())

# Get specific layout
layout = layout_registry.get_layout("my_layout")
print(layout.slot_configuration)

# Validate layout
try:
    layout.validate()
    print("Layout is valid")
except Exception as e:
    print(f"Validation error: {e}")
```

## Performance Tips

- Layout definitions are cached in memory
- Avoid complex computations in slot configuration properties
- Use class-level configuration when possible
- Consider lazy loading for dynamic layouts

## Testing Layouts

Create unit tests for your layouts:

```python
from django.test import TestCase
from webpages.layout_registry import layout_registry

class MyLayoutTests(TestCase):
    def test_layout_registration(self):
        """Test that layout is properly registered"""
        layout = layout_registry.get_layout("my_layout")
        self.assertIsNotNone(layout)
        
    def test_slot_configuration(self):
        """Test slot configuration is valid"""
        layout = layout_registry.get_layout("my_layout")
        slots = layout.slot_configuration["slots"]
        self.assertTrue(len(slots) > 0)
        
        # Test required slot fields
        for slot in slots:
            self.assertIn("name", slot)
            self.assertIn("display_name", slot)
            self.assertIn("description", slot)
```

This guide provides everything you need to create and manage code-based layouts in the eceee_v4 system. 