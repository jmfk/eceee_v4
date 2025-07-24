# Template-Based Layouts

The eceee_v4 layout system now supports HTML template-based layouts with automatic slot parsing and CSS extraction. This enhancement allows developers to define layouts using HTML templates with embedded CSS and automatically discover widget slots through data attributes.

## Overview

The `TemplateBasedLayout` class extends the existing `BaseLayout` to provide:

- **HTML Template Loading**: Load layout structure from Django template files
- **CSS Extraction**: Automatically extract CSS from `<style>` tags
- **Automatic Slot Parsing**: Discover widget slots from `data-widget-slot` attributes
- **Metadata Support**: Parse slot titles, descriptions, and constraints from data attributes
- **Backward Compatibility**: Existing code-based layouts continue to work unchanged

## Quick Start

### 1. Create HTML Template

Create a template file in `templates/webpages/layouts/`:

```html
<!-- templates/webpages/layouts/my_layout.html -->
<style>
  .my-layout {
    display: grid;
    grid-template-areas: 
      "header header"
      "content sidebar"
      "footer footer";
    grid-template-columns: 2fr 1fr;
    grid-gap: 20px;
  }
  .header-slot { grid-area: header; }
  .content-slot { grid-area: content; }
  .sidebar-slot { grid-area: sidebar; }
  .footer-slot { grid-area: footer; }
</style>

<div class="my-layout">
  <header class="header-slot" 
          data-widget-slot="header" 
          data-slot-title="Page Header" 
          data-slot-description="Main header with navigation"
          data-slot-max-widgets="2">
    Header content
  </header>
  
  <main class="content-slot" 
        data-widget-slot="content" 
        data-slot-title="Main Content" 
        data-slot-description="Primary page content">
    Main content
  </main>
  
  <aside class="sidebar-slot" 
         data-widget-slot="sidebar" 
         data-slot-title="Sidebar" 
         data-slot-description="Secondary content and widgets"
         data-slot-max-widgets="5">
    Sidebar content
  </aside>
  
  <footer class="footer-slot" 
          data-widget-slot="footer" 
          data-slot-title="Footer"
          data-slot-max-widgets="3">
    Footer content
  </footer>
</div>
```

### 2. Create Layout Class

```python
# In your layouts.py file
from webpages.layout_registry import TemplateBasedLayout, register_layout

@register_layout
class MyCustomLayout(TemplateBasedLayout):
    name = "my_custom_layout"
    description = "Custom layout with automatic slot parsing"
    template_file = "webpages/layouts/my_layout.html"
    
    # No need to define slot_configuration - it's automatically parsed!
```

### 3. Use in Pages

The layout will be automatically available in the layout selection with all slots parsed from the template.

## Template Structure

### Required Elements

#### Widget Slots
All widget slots must have the `data-widget-slot` attribute:

```html
<div data-widget-slot="slot_name">Content</div>
```

### Optional Attributes

#### Slot Metadata
Enhance slots with additional metadata:

```html
<div data-widget-slot="header"
     data-slot-title="Page Header"
     data-slot-description="Main header with navigation and branding"
     data-slot-max-widgets="2"
     class="header-section">
  Header content
</div>
```

**Supported attributes:**
- `data-widget-slot`: **Required** - Unique slot identifier
- `data-slot-title`: Optional - Human-readable slot name (defaults to formatted slot name)
- `data-slot-description`: Optional - Slot description for editors
- `data-slot-max-widgets`: Optional - Maximum number of widgets (empty/none = unlimited)

#### CSS Styles
Include CSS styles directly in the template:

```html
<style>
  .my-layout {
    /* Layout-specific styles */
  }
</style>
```

Multiple `<style>` tags are supported and will be combined.

## Class Reference

### TemplateBasedLayout

#### Class Attributes

```python
class MyLayout(TemplateBasedLayout):
    name = "layout_name"           # Required: Unique layout identifier
    description = "Description"    # Optional: Layout description
    template_file = "path.html"    # Optional: Template file path
    css_file = "path.css"          # Optional: External CSS file (not implemented)
```

#### Automatic Properties

These properties are automatically populated from template parsing:

- `_extracted_html`: HTML content with `<style>` tags removed
- `_extracted_css`: Combined CSS from all `<style>` tags  
- `_parsed_slots`: List of slot configurations from data attributes

#### Methods

##### `slot_configuration`
Returns automatically parsed slot configuration:

```python
{
    "slots": [
        {
            "name": "header",
            "title": "Page Header", 
            "description": "Main header with navigation",
            "max_widgets": 2,
            "css_classes": ["header-section"],
            "selector": "[data-widget-slot='header']"
        },
        # ... more slots
    ]
}
```

##### `to_dict()`
Enhanced dictionary representation including template data:

```python
{
    "name": "my_layout",
    "type": "code",
    "template_based": True,
    "template_file": "webpages/layouts/my_layout.html",
    "has_css": True,
    "parsed_slots_count": 4,
    "html": "<div class='my-layout'>...</div>",
    "css": ".my-layout { display: grid; ... }",
    # ... standard layout fields
}
```

## Advanced Usage

### Custom Validation

Override validation for custom requirements:

```python
class StrictLayout(TemplateBasedLayout):
    name = "strict_layout"
    template_file = "layouts/strict.html"
    
    def validate_slot_configuration(self):
        super().validate_slot_configuration()
        
        # Custom validation
        if len(self._parsed_slots) < 2:
            raise ImproperlyConfigured("Layout must have at least 2 slots")
```

### Dynamic Template Selection

Choose templates based on conditions:

```python
class ConditionalLayout(TemplateBasedLayout):
    name = "conditional_layout"
    
    def __init__(self):
        # Set template based on some condition
        if some_condition():
            self.template_file = "layouts/template_a.html"
        else:
            self.template_file = "layouts/template_b.html"
            
        super().__init__()
```

### Slot Customization

Modify parsed slots before use:

```python
class CustomizedLayout(TemplateBasedLayout):
    name = "customized_layout"
    template_file = "layouts/base.html"
    
    def _parse_template(self):
        super()._parse_template()
        
        # Add custom properties to parsed slots
        for slot in self._parsed_slots:
            if slot['name'] == 'header':
                slot['custom_property'] = 'special_value'
```

## Error Handling

The system provides comprehensive error handling:

### Missing Templates
```python
# Raises ImproperlyConfigured if template doesn't exist
class BadLayout(TemplateBasedLayout):
    name = "bad_layout"
    template_file = "nonexistent.html"
```

### Missing Dependencies
```python
# Raises ImproperlyConfigured if BeautifulSoup4 not installed
# Install with: pip install beautifulsoup4
```

### Invalid HTML
```python
# Logs warnings for malformed HTML but continues parsing
```

### No Slots Found
```python
# Logs warning if template contains no widget slots
```

## Best Practices

### Template Organization
- Store templates in `templates/webpages/layouts/`
- Use descriptive filenames: `hero_sidebar.html`, `three_column.html`
- Group related templates in subdirectories

### CSS Guidelines
- Keep layout-specific CSS in template `<style>` tags
- Use semantic class names: `.header-slot`, `.content-area`
- Include responsive design with media queries
- Avoid external dependencies in template CSS

### Slot Design
- Use semantic HTML elements: `<header>`, `<main>`, `<aside>`
- Provide descriptive slot titles and descriptions
- Set appropriate `max_widgets` constraints
- Include placeholder content for editors

### Performance Considerations
- Templates are parsed once at layout registration
- Extracted HTML/CSS is cached in layout instances
- Use template inheritance for common structures
- Keep templates focused and lightweight

## Migration from Code-Based Layouts

Existing code-based layouts continue to work unchanged:

```python
# This still works exactly as before
class TraditionalLayout(BaseLayout):
    name = "traditional"
    
    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "main",
                    "title": "Main Content",
                    "description": "Primary content area",
                    "max_widgets": None
                }
            ]
        }
```

To convert to template-based:

1. Create HTML template with equivalent structure
2. Add `data-widget-slot` attributes
3. Change parent class to `TemplateBasedLayout`
4. Set `template_file` attribute
5. Remove `slot_configuration` property

## Testing

The system includes comprehensive test coverage:

```bash
# Run template layout tests
python manage.py test webpages.tests_template_layout

# Test specific functionality
python manage.py test webpages.tests_template_layout.TestTemplateBasedLayout.test_slot_parsing_basic
```

## API Integration

Template-based layouts are fully integrated with the existing API:

```json
GET /api/webpages/code-layouts/my_custom_layout/
{
    "name": "my_custom_layout",
    "description": "Custom layout with automatic slot parsing",
    "type": "code",
    "template_based": true,
    "template_file": "webpages/layouts/my_layout.html",
    "has_css": true,
    "parsed_slots_count": 4,
    "html": "<div class='my-layout'>...</div>",
    "css": ".my-layout { display: grid; ... }",
    "slot_configuration": {
        "slots": [
            {
                "name": "header",
                "title": "Page Header",
                "description": "Main header with navigation",
                "max_widgets": 2,
                "css_classes": ["header-section"],
                "selector": "[data-widget-slot='header']"
            }
        ]
    }
}
```

## Troubleshooting

### Common Issues

#### BeautifulSoup Import Error
```bash
# Install the required dependency
pip install beautifulsoup4
```

#### Template Not Found
- Verify template file path is correct
- Check Django template directories configuration
- Ensure template file exists and is readable

#### No Slots Detected
- Verify `data-widget-slot` attributes are present
- Check HTML is well-formed
- Ensure attributes are properly quoted

#### CSS Not Loading
- Verify CSS is within `<style>` tags in template
- Check for CSS syntax errors
- Ensure style tags are properly closed

### Debug Mode

Enable layout debugging:

```python
import logging
logging.getLogger('webpages.layout_registry').setLevel(logging.DEBUG)
```

This will log detailed information about template parsing, slot discovery, and any warnings or errors. 