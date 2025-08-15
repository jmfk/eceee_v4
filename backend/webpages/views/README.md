# WebPages API Views Refactoring

This directory contains the refactored API views for the Web Page Publishing System. Each ViewSet and function-based view has been separated into its own file for better organization and maintainability.

## Structure

### ViewSets
- `code_layout_views.py` - `CodeLayoutViewSet` for managing code-based layouts
- `page_theme_views.py` - `PageThemeViewSet` for managing page themes  
- `widget_type_views.py` - `WidgetTypeViewSet` for managing widget types
- `webpage_views.py` - `WebPageViewSet` for managing web pages
- `page_version_views.py` - `PageVersionViewSet` for managing page versions
- `page_data_schema_views.py` - `PageDataSchemaViewSet` for managing page data schemas

### Function-based Views
- `rendering_views.py` - Contains layout JSON serialization and page rendering views:
  - `layout_json()` - Returns JSON representation of layouts
  - `render_page_backend()` - Renders complete web pages using backend renderer
  - `render_page_preview()` - Renders page previews with custom widget data

## Import Structure

The `__init__.py` file exports all ViewSets and views for backward compatibility:

```python
from .views import (
    CodeLayoutViewSet,
    PageThemeViewSet,
    WidgetTypeViewSet, 
    WebPageViewSet,
    PageVersionViewSet,
    PageDataSchemaViewSet,
    layout_json,
    render_page_backend,
    render_page_preview,
)
```

## Benefits

1. **Better Organization** - Each endpoint is in its own focused file
2. **Easier Maintenance** - Smaller, more manageable code files
3. **Improved Readability** - Clear separation of concerns
4. **Better Testing** - Can test each ViewSet in isolation
5. **Team Development** - Reduced merge conflicts when working on different endpoints

## Migration Notes

- All existing imports continue to work unchanged
- No breaking changes to API endpoints or functionality
- Original `views.py` has been backed up as `views_original.py`
- URL routing remains unchanged - imports from the new views package

## Testing

The refactoring has been tested with:
- Django `manage.py check webpages` command passes successfully
- Server starts without import errors
- All ViewSets and views are properly imported and exposed
