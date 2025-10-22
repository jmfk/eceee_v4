# Custom Error Pages Implementation Summary

## Overview
This document describes the custom error pages feature that allows site administrators to create CMS-editable error pages (404, 500, etc.) that are site-specific and returned with proper HTTP status codes.

## Implementation Date
October 2025

## Features Implemented

### 1. Error Page Layouts
Created four error layout classes in `backend/default_layouts/layouts/error_layouts.py`:
- `Error404Layout` - 404 Not Found pages
- `Error500Layout` - 500 Internal Server Error pages
- `Error403Layout` - 403 Forbidden pages
- `Error503Layout` - 503 Service Unavailable pages

Each layout includes three customizable slots:
- **branding**: Site logo and branding
- **error_message**: Main error message and explanation
- **helpful_content**: Suggestions and links to help users

### 2. Model Validation
Updated `WebPage.clean()` method in `backend/webpages/models/web_page.py` to:
- Allow HTTP error code slugs (400-599) only for pages directly under root pages
- Prevent error pages at root level (must have parent that is root)
- Prevent error pages nested deeper than one level
- Ensure uniqueness of error codes within the same site (one 404 per site, etc.)

### 3. Custom Error Page Rendering
Modified `HostnamePageView` in `backend/webpages/public_views.py`:
- Added `_get_error_page(root_page, error_code)` method to find custom error pages
- Added `_render_error_page(error_page, status_code)` method to render error pages with proper status codes
- Wrapped main page resolution logic in try-except to catch Http404 and render custom error pages
- Falls back to Django's default error pages if no custom page exists

### 4. Global Error Handlers
Added custom Django error handlers in `backend/webpages/public_views.py`:
- `custom_404_handler` - Handles 404 errors
- `custom_500_handler` - Handles 500 errors
- `custom_403_handler` - Handles 403 errors
- `custom_503_handler` - Handles 503 errors (for custom middleware)

Registered handlers in `backend/config/urls.py`:
```python
handler404 = "webpages.public_views.custom_404_handler"
handler500 = "webpages.public_views.custom_500_handler"
handler403 = "webpages.public_views.custom_403_handler"
```

### 5. Frontend Integration

#### Settings Editor (`frontend/src/components/SettingsEditor.tsx`)
- Added detection for HTTP error code slugs (400-599)
- Shows helpful message when creating error pages
- Suggests appropriate error layout based on error code

#### Page Tree Manager (`frontend/src/components/PageTreeNode.jsx`)
- Added visual badge indicator for error pages in the tree view
- Shows error code (e.g., "404") with red styling
- Includes tooltip with "HTTP XXX Error Page" description

### 6. Comprehensive Testing
Created test suite in `backend/webpages/tests/test_error_pages.py`:
- **ErrorPageValidationTests**: Tests for validation rules
  - Valid error code acceptance
  - Parent hierarchy requirements
  - Uniqueness constraints
- **ErrorPageRenderingTests**: Tests for rendering and fallback
  - Custom error page discovery
  - Unpublished page handling
  - Hostname validation
- **ErrorLayoutTests**: Tests for layout registration
  - Layout availability
  - Slot configuration
  - Template names
- **ErrorPageIntegrationTests**: Integration tests
  - Site-specific error pages
  - Multi-site support

## Usage Guide

### Creating a Custom Error Page

1. **Navigate to the page tree** in the CMS admin interface

2. **Select the root page** for your site (the page with hostnames configured)

3. **Create a new child page** under the root page with:
   - **Title**: "Page Not Found" (or similar)
   - **Slug**: The HTTP error code (e.g., "404", "500", "403", "503")
   - **Layout**: Choose the corresponding error layout (e.g., `error_404`)

4. **Add widgets** to customize the error page:
   - Use the "branding" slot for your logo
   - Use the "error_message" slot for the main error message
   - Use the "helpful_content" slot for links and suggestions

5. **Publish the error page** to make it active

### Example: Creating a 404 Page

```
Root Page (testsite.com)
└── 404
    ├── Title: "Page Not Found"
    ├── Slug: "404"
    ├── Layout: "error_404"
    └── Widgets:
        ├── Branding Slot: Logo widget
        ├── Error Message Slot: Text widget with "404 - Page Not Found"
        └── Helpful Content Slot: Links to homepage, search, etc.
```

## Site-Specific Behavior

- Each site (root page with hostnames) can have its own custom error pages
- Error pages are isolated to their parent site
- Different sites can have completely different 404/500 pages
- Falls back to Django's default error page if no custom page exists

## HTTP Status Codes

When a custom error page is rendered:
- **Returns the proper HTTP status code** (404, 500, etc.)
- **Displays the custom page content** with widgets and branding
- **Maintains SEO compliance** (search engines see correct status codes)

## Error Page Workflow

```
User Request
    ↓
Page Not Found?
    ↓
Yes → Look for custom error page under root
    ↓
Found and Published?
    ↓
Yes → Render custom error page with proper status code
    ↓
No → Fall back to Django's default error page
```

## Validation Rules

1. **Error page slugs must be valid HTTP error codes** (400-599)
2. **Error pages must be direct children of root pages** (not nested deeper)
3. **Error pages cannot be root pages** (must have a parent)
4. **Only one error page per code per site** (e.g., one 404 per site)
5. **Non-error code slugs work normally** (e.g., "about", "contact")

## Files Modified

### Backend
- `backend/default_layouts/layouts/error_layouts.py` (new)
- `backend/default_layouts/layouts/__init__.py`
- `backend/default_layouts/templates/default_layouts/layouts/error_404.html` (new)
- `backend/default_layouts/templates/default_layouts/layouts/error_500.html` (new)
- `backend/default_layouts/templates/default_layouts/layouts/error_403.html` (new)
- `backend/default_layouts/templates/default_layouts/layouts/error_503.html` (new)
- `backend/webpages/models/web_page.py`
- `backend/webpages/public_views.py`
- `backend/config/urls.py`
- `backend/webpages/tests/test_error_pages.py` (new)

### Frontend
- `frontend/src/components/SettingsEditor.tsx`
- `frontend/src/components/PageTreeNode.jsx`

## Testing

To run the error page tests:
```bash
docker-compose exec backend python manage.py test webpages.tests.test_error_pages
```

## Future Enhancements

Potential improvements for future versions:
1. Support for additional HTTP error codes (401, 502, 504, etc.)
2. Preview mode for error pages in the editor
3. Error page templates/starter content
4. Analytics integration for error page views
5. A/B testing for different error page designs
6. Automatic error page suggestions when creating a new site

## Notes

- Error pages are fully CMS-editable like regular pages
- All standard page features work (widgets, themes, versions, publishing)
- Error layouts are code-based and registered in the layout registry
- Error pages respect the site hierarchy and multi-tenant architecture
- Proper HTTP status codes ensure SEO compliance and correct browser behavior

