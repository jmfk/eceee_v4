# Layout Theme Associations

## Overview

The Layout Theme Association system allows you to associate themes with code-based layouts, providing flexible theme management that can be controlled both through code and through the database interface.

## How It Works

### Two-Level Theme Association

1. **Code-Based Default Themes**: Layouts can specify a `default_theme` in their class definition
2. **Database Override Associations**: Administrators can override code-based defaults through the database

### Priority System

When resolving a theme for a layout, the system follows this priority order:

1. **Database Association** (highest priority) - Active `LayoutThemeAssociation` record
2. **Code-Based Default** - The `default_theme` specified in the layout class
3. **No Theme** (fallback)

## Implementation

### Code-Based Default Themes

Define a default theme directly in your layout class:

```python
from webpages.layout_registry import BaseLayout, register_layout

@register_layout
class MyLayout(BaseLayout):
    name = "my_layout"
    description = "A custom layout with default theme"
    template_name = "webpages/layouts/my_layout.html"
    default_theme = "Modern Blue"  # Theme name
    
    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "main",
                    "display_name": "Main Content",
                    "description": "Primary content area"
                }
            ]
        }
```

### Database Override Associations

Create database associations to override code-based defaults:

#### Via API

```javascript
import { layoutThemesApi } from '../api/layoutThemes'

// Associate a theme with a layout
await layoutThemesApi.associateTheme('my_layout', themeId)

// Remove association (falls back to code default)
await layoutThemesApi.removeAssociation('my_layout')

// Get layout theme information
const info = await layoutThemesApi.getLayoutThemeInfo('my_layout')
```

#### Via Management Command

```bash
# List all layout theme associations
python manage.py manage_layout_themes list

# Associate a theme with a layout
python manage.py manage_layout_themes associate --layout my_layout --theme "Modern Blue"

# Clear association for a layout
python manage.py manage_layout_themes clear --layout my_layout

# Sync code defaults to database
python manage.py manage_layout_themes sync
```

#### Via Admin Interface

The `LayoutThemeAssociation` model is available in the Django admin interface for manual management.

## API Endpoints

### Layout Theme Associations

- `GET /api/v1/webpages/layout-themes/` - List all associations
- `POST /api/v1/webpages/layout-themes/` - Create association
- `GET /api/v1/webpages/layout-themes/{id}/` - Get association details
- `PUT /api/v1/webpages/layout-themes/{id}/` - Update association
- `DELETE /api/v1/webpages/layout-themes/{id}/` - Delete association

### Special Endpoints

- `GET /api/v1/webpages/layout-themes/available_layouts/` - Get all layouts with association info
- `POST /api/v1/webpages/layout-themes/bulk_associate/` - Bulk create/update associations
- `POST /api/v1/webpages/layout-themes/{id}/clear_association/` - Clear theme association
- `GET /api/v1/webpages/layout-themes/layout_theme_info/?layout_name=X` - Get comprehensive layout theme info

## Database Model

The `LayoutThemeAssociation` model stores database overrides:

```python
class LayoutThemeAssociation(models.Model):
    layout_name = models.CharField(max_length=100, unique=True)
    theme = models.ForeignKey(PageTheme, on_delete=models.SET_NULL, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)
```

## Theme Resolution in Practice

### For Pages

When a page uses a layout, theme resolution follows this hierarchy:

1. Page's direct theme assignment
2. Parent page's theme (recursive)
3. **Layout's effective theme** (database association or code default)
4. No theme

### For Layout Previews

When previewing layouts directly, the system uses:

1. Database association theme
2. Code-based default theme
3. No theme

## Usage Examples

### Example 1: Code-Based Default

```python
@register_layout
class NewsLayout(BaseLayout):
    name = "news_layout"
    description = "Layout optimized for news content"
    default_theme = "Modern Blue"  # Always use Modern Blue by default
    
    @property
    def slot_configuration(self):
        return {
            "slots": [
                {"name": "headline", "display_name": "Headline"},
                {"name": "content", "display_name": "Article Content"}
            ]
        }
```

### Example 2: Database Override

```python
# In Django shell or management command
from webpages.models import LayoutThemeAssociation, PageTheme
from django.contrib.auth.models import User

# Override the news layout to use a different theme
admin_user = User.objects.get(username='admin')
warm_earth_theme = PageTheme.objects.get(name='Warm Earth')

association = LayoutThemeAssociation.objects.create(
    layout_name='news_layout',
    theme=warm_earth_theme,
    created_by=admin_user
)

# Now news_layout will use "Warm Earth" instead of "Modern Blue"
```

### Example 3: Frontend Integration

```javascript
// Get all layouts with their theme associations
const layouts = await layoutThemesApi.getAvailableLayouts()

layouts.forEach(layout => {
    console.log(`Layout: ${layout.name}`)
    
    if (layout.theme_association.is_database_override) {
        console.log(`  Theme: ${layout.theme_association.theme?.name} (Database Override)`)
    } else if (layout.theme_association.theme) {
        console.log(`  Theme: ${layout.theme_association.theme.name} (Code Default)`)
    } else {
        console.log(`  Theme: None`)
    }
})

// Associate a different theme with a layout
await layoutThemesApi.associateTheme('news_layout', newThemeId)
```

## Benefits

### For Developers

- **Code-Based Defaults**: Define sensible theme defaults directly in layout code
- **Version Control**: Default themes are tracked with code changes
- **Type Safety**: Layout definitions remain in strongly-typed code

### For Administrators

- **Database Overrides**: Change layout themes without code deployments
- **Flexible Management**: Use admin interface, API, or management commands
- **Bulk Operations**: Efficiently manage multiple layout-theme associations

### For Content Creators

- **Consistent Theming**: Layouts automatically apply appropriate themes
- **Inheritance**: Page theme inheritance includes layout default themes
- **Preview Accuracy**: Layout previews show correct theme styling

## Migration and Compatibility

### Existing Layouts

- Layouts without `default_theme` continue to work unchanged
- Adding `default_theme` to existing layouts is non-breaking
- Database associations take precedence over new code defaults

### Backward Compatibility

- All existing theme resolution logic continues to work
- Page theme assignments are unaffected
- Theme inheritance hierarchy remains the same

## Best Practices

### For Layout Development

1. **Set Sensible Defaults**: Choose themes that work well with your layout's structure
2. **Document Choices**: Comment why specific themes work well with layouts
3. **Test Combinations**: Verify that default themes work across different content types

### For Theme Management

1. **Use Database Overrides Sparingly**: Prefer code-based defaults for consistency
2. **Document Overrides**: Keep track of why database overrides were necessary
3. **Regular Review**: Periodically review associations to ensure they're still needed

### For Deployment

1. **Sync Defaults**: Use `manage_layout_themes sync` to create database records for code defaults
2. **Environment Consistency**: Ensure theme names match across environments
3. **Migration Planning**: Consider theme dependencies when deploying layout changes

## Troubleshooting

### Theme Not Applying

1. Check if theme exists and is active
2. Verify layout name matches exactly
3. Check association priority (database vs code)
4. Ensure theme inheritance is working correctly

### Performance Considerations

1. Layout theme resolution is cached
2. Database queries are optimized for theme lookups
3. Bulk operations minimize database round trips

### Common Issues

- **Theme Name Mismatch**: Ensure theme names match exactly between code and database
- **Inactive Themes**: Only active themes are resolved
- **Case Sensitivity**: Theme names are case-sensitive
- **Missing Migrations**: Ensure all migrations are applied

## Conclusion

The Layout Theme Association system provides a powerful and flexible way to manage themes for code-based layouts. It combines the benefits of version-controlled defaults with the flexibility of database-driven overrides, giving both developers and administrators the tools they need to create consistent, beautiful user experiences.
