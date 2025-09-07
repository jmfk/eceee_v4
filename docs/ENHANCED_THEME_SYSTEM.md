# Enhanced Theme System Documentation

## Overview

The Enhanced Theme System provides comprehensive styling capabilities for HTML elements across the eceee_v4 platform. This system allows you to define CSS styles for HTML elements like headers, paragraphs, lists, and links, and apply these themes to pages through layouts and object type definitions.

## Key Features

- **HTML Element Styling**: Define custom styles for specific HTML elements (h1-h6, p, ul, ol, li, a, blockquote, code, etc.)
- **CSS Variables**: Use CSS custom properties for consistent theming across components
- **Theme Inheritance**: Themes can be inherited from pages to layouts to object types
- **Layout Integration**: Layouts can have default themes that are automatically applied
- **Object Type Themes**: Object types can have default themes for consistent content styling
- **Preview System**: Real-time preview of theme changes with sample HTML content
- **Scoped CSS**: All theme CSS is properly scoped to prevent interference with admin UI

## Theme Structure

### PageTheme Model

The `PageTheme` model has been enhanced with the following fields:

```python
class PageTheme(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    css_variables = models.JSONField(default=dict)
    html_elements = models.JSONField(default=dict)  # NEW: HTML element styles
    custom_css = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)
```

### HTML Elements Configuration

The `html_elements` field stores styles for HTML elements in the following format:

```json
{
  "h1": {
    "color": "var(--primary)",
    "font-size": "2.5rem",
    "font-weight": "700",
    "margin-bottom": "1.5rem"
  },
  "p": {
    "color": "var(--text)",
    "line-height": "1.6",
    "margin-bottom": "1rem"
  },
  "a": {
    "color": "var(--primary)",
    "text-decoration": "underline",
    "transition": "color 0.2s"
  },
  "a:hover": {
    "color": "var(--secondary)"
  }
}
```

### CSS Variables

CSS variables provide consistent theming across the application:

```json
{
  "primary": "#3b82f6",
  "secondary": "#64748b", 
  "text": "#1e293b",
  "background": "#ffffff",
  "border": "#e2e8f0"
}
```

## Theme Application

### 1. Page Themes

Pages can have themes directly assigned through the page editor:

1. Open the Page Editor
2. Navigate to the Theme tab
3. Select a theme from available options
4. The theme will be applied to all content areas in the page

### 2. Layout Default Themes

Layouts can specify default themes that are automatically applied:

```python
@register_layout
class MyLayout(BaseLayout):
    name = "my_layout"
    description = "A custom layout with default theme"
    default_theme = "modern_blue"  # Theme name
    
    slot_configuration = {
        "slots": [
            {
                "name": "main",
                "display_name": "Main Content",
                "description": "Primary content area"
            }
        ]
    }
```

### 3. Object Type Default Themes

Object types can have default themes for consistent content styling:

```python
# In the admin or via API
object_type = ObjectTypeDefinition.objects.create(
    name="news",
    label="News Article",
    default_theme=theme_instance
)
```

## Theme Inheritance

The theme resolution follows this priority order:

1. **Page's direct theme assignment** (highest priority)
2. **Parent page's theme** (recursive up the hierarchy)
3. **Layout's default theme**
4. **No theme** (lowest priority)

This ensures that themes can be inherited through the page hierarchy while allowing for specific overrides at any level.

## API Endpoints

### Theme Management

- `GET /api/v1/webpages/themes/` - List all themes
- `POST /api/v1/webpages/themes/` - Create a new theme
- `GET /api/v1/webpages/themes/{id}/` - Get theme details
- `PUT /api/v1/webpages/themes/{id}/` - Update theme
- `DELETE /api/v1/webpages/themes/{id}/` - Delete theme

### Theme Operations

- `GET /api/v1/webpages/themes/active/` - Get only active themes
- `GET /api/v1/webpages/themes/{id}/css/` - Generate CSS for theme
- `GET /api/v1/webpages/themes/{id}/preview/` - Get theme preview data
- `GET /api/v1/webpages/themes/html_elements_schema/` - Get supported HTML elements and properties
- `POST /api/v1/webpages/themes/create_defaults/` - Create default themes

### CSS Generation

The theme CSS generation endpoint supports scope parameters:

```
GET /api/v1/webpages/themes/{id}/css/?scope=.my-content
```

This generates CSS scoped to `.my-content` instead of the default `.theme-content`.

## Frontend Components

### Enhanced Theme Editor

The theme editor now includes three tabs:

1. **CSS Variables**: Manage color schemes and design tokens
2. **HTML Elements**: Define styles for specific HTML elements
3. **Custom CSS**: Add additional custom CSS rules

### HTML Element Style Editor

A specialized component for editing HTML element styles:

- Visual interface for selecting HTML elements
- Property editor with color pickers and validation
- Live preview of styled elements
- Support for pseudo-selectors (`:hover`, `:focus`, etc.)

### Theme Selector

Enhanced theme selector with:

- Preview functionality
- Theme inheritance information
- Default theme indicators
- Real-time CSS generation

## CSS Scoping and Security

### Automatic Scoping

All theme CSS is automatically scoped to content areas:

- `.theme-content` - General content areas
- `.widget-content` - Widget content previews
- `.content-editor-theme` - Content editor areas

### Security Features

- CSS sanitization prevents script injection
- Dangerous patterns are blocked
- CSS is scoped to content areas only
- Admin interface styling is protected

## Usage Examples

### Creating a Theme with HTML Elements

```javascript
const themeData = {
  name: "Corporate Blue",
  description: "Professional corporate theme with blue accents",
  css_variables: {
    primary: "#1e40af",
    secondary: "#64748b",
    text: "#1f2937",
    background: "#ffffff"
  },
  html_elements: {
    h1: {
      color: "var(--primary)",
      "font-size": "2.25rem",
      "font-weight": "800",
      "margin-bottom": "1.5rem"
    },
    h2: {
      color: "var(--primary)",
      "font-size": "1.875rem",
      "font-weight": "700",
      "margin-bottom": "1rem"
    },
    p: {
      color: "var(--text)",
      "line-height": "1.7",
      "margin-bottom": "1.25rem"
    },
    a: {
      color: "var(--primary)",
      "text-decoration": "none",
      "border-bottom": "1px solid transparent",
      transition: "border-color 0.2s"
    },
    "a:hover": {
      "border-bottom-color": "var(--primary)"
    }
  }
}

// Create theme via API
const response = await themesApi.create(themeData)
```

### Applying Theme to Layout

```python
@register_layout
class NewsLayout(BaseLayout):
    name = "news_layout"
    description = "Layout optimized for news content"
    default_theme = "corporate_blue"
    
    slot_configuration = {
        "slots": [
            {
                "name": "headline",
                "display_name": "Headline",
                "description": "Main headline area"
            },
            {
                "name": "content",
                "display_name": "Article Content", 
                "description": "Main article content"
            }
        ]
    }
```

### Using Theme Service

```python
from webpages.theme_service import ThemeService

# Resolve theme for a page
theme = ThemeService.resolve_theme_for_page(page)

# Generate CSS for a specific context
css = ThemeService.generate_css_for_context('page', page_id, '.my-scope')

# Get available themes
themes = ThemeService.get_available_themes(active_only=True)
```

## Best Practices

### Theme Design

1. **Use CSS Variables**: Prefer CSS variables over hardcoded values for flexibility
2. **Maintain Consistency**: Use consistent spacing and color schemes
3. **Test Responsiveness**: Ensure themes work on different screen sizes
4. **Ensure Accessibility**: Maintain sufficient color contrast ratios

### Theme Application

1. **Leverage Inheritance**: Use theme inheritance to maintain consistency across page hierarchies
2. **Preview Changes**: Always preview themes before applying them to production content
3. **Document Custom Themes**: Provide clear descriptions for custom themes
4. **Version Control**: Track theme changes alongside code changes

### Performance

1. **Theme Caching**: Themes are automatically cached for performance
2. **Efficient CSS**: Use efficient CSS selectors and avoid overly complex rules
3. **Scope Appropriately**: Use proper CSS scoping to prevent style conflicts

## Troubleshooting

### Theme Not Applying

1. Check if theme is active (`is_active: true`)
2. Verify content has proper theme classes
3. Check browser console for CSS injection errors
4. Ensure theme CSS variables are valid

### Style Conflicts

1. Verify CSS is properly scoped to content areas
2. Check for overly broad selectors in custom CSS
3. Use more specific selectors if needed
4. Test in both edit and preview modes

### Performance Issues

1. Themes are cached after first load
2. CSS injection is optimized for minimal DOM manipulation
3. Large custom CSS should be avoided
4. Use CSS variables instead of complex selectors

## Migration Guide

### From Legacy Theme System

If migrating from the previous theme system:

1. **CSS Variables**: Existing CSS variables are preserved
2. **Custom CSS**: Existing custom CSS continues to work
3. **New Features**: HTML element styling is additive - no breaking changes
4. **API Compatibility**: All existing API endpoints remain functional

### Database Migration

The system includes automatic migrations for:

- Adding `html_elements` field to `PageTheme` model
- Adding `default_theme` field to `ObjectTypeDefinition` model
- Updating serializers and API responses

## Future Enhancements

Planned enhancements include:

1. **Theme Templates**: Pre-built theme templates for common use cases
2. **Advanced Selectors**: Support for more complex CSS selectors
3. **Theme Versioning**: Version control for theme changes
4. **Import/Export**: Theme import/export functionality
5. **Theme Marketplace**: Shared theme repository

## Conclusion

The Enhanced Theme System provides a comprehensive solution for styling content across the eceee_v4 platform. With support for HTML element styling, theme inheritance, and seamless integration with layouts and object types, it offers the flexibility needed for modern web content management while maintaining the security and performance standards required for enterprise applications.
