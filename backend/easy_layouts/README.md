# Default Layouts App

This Django app contains the default layout definitions that ship with eceee_v4. These layouts provide common page structures for most content management needs.

## Available Layouts

### SingleColumnLayout (`single_column`)
- **Description**: Simple single-column layout suitable for most content pages
- **Slots**: header, main, sidebar, footer
- **Use Case**: Blog posts, articles, basic pages

### TwoColumnLayout (`two_column`) 
- **Description**: Two column layout with main content area and sidebar
- **Slots**: header, main, sidebar, footer
- **Use Case**: Content with complementary sidebar information

### ThreeColumnLayout (`three_column`)
- **Description**: Three column layout with left sidebar, main content, and right sidebar
- **Slots**: header, left_sidebar, main, right_sidebar, footer
- **Use Case**: Complex content organization, news sites, portals

### LandingPageLayout (`landing_page`)
- **Description**: Hero-style layout for landing pages and marketing content
- **Slots**: navigation, hero, features, content, testimonials, cta
- **Use Case**: Marketing pages, product launches, landing pages

### MinimalLayout (`minimal`)
- **Description**: Clean, minimal layout with just header and content
- **Slots**: header, content
- **Use Case**: Focused content presentation, documentation

### SidebarLayout (`sidebar_layout`)
- **Description**: Sidebar layout with header, main content, multi-section sidebar, and footer
- **Slots**: header, main, sidebar-top, sidebar-middle, sidebar-bottom, footer
- **Use Case**: Blogs, news sites with rich sidebar content

## Usage

### Enable Default Layouts

Add `default_layouts` to your `INSTALLED_APPS` in `settings.py`:

```python
INSTALLED_APPS = [
    # ... other apps
    'webpages',          # Core system (required)
    'default_layouts',   # Default layouts (optional)
    # ... other apps
]
```

### Disable Default Layouts

Simply remove `default_layouts` from `INSTALLED_APPS`:

```python
INSTALLED_APPS = [
    # ... other apps
    'webpages',              # Core system (required)
    # 'default_layouts',    # Disabled - no default layouts
    'my_custom_layouts',     # Use custom layouts instead
    # ... other apps
]
```

## Templates

Layout templates are located in `templates/default_layouts/layouts/`:

- `single_column.html`
- `two_column.html`
- `three_column.html`
- `landing_page.html`
- `minimal.html`
- `sidebar_layout.html`

## Customization

### Override Individual Layouts

Create a custom app with layouts using the same names to override defaults:

```python
# my_custom_layouts/layouts.py
from webpages.layout_registry import BaseLayout, register_layout

@register_layout
class SingleColumnLayout(BaseLayout):
    name = "single_column"  # Same name overrides default
    # Your custom implementation
```

### Create Additional Layouts

Add new layouts alongside defaults:

```python
# my_custom_layouts/layouts.py
@register_layout
class MyCustomLayout(BaseLayout):
    name = "my_custom_layout"  # New layout name
    # Your implementation
```

## App Configuration

The app automatically registers all layouts when Django starts up via the `ready()` method in `apps.py`. No manual configuration is needed.

## Dependencies

- Requires `webpages` app for `BaseLayout` and `register_layout`
- Uses Django's template system for rendering
- Compatible with the layout autodiscovery system

## Migration from core_widgets

If you previously used layouts from `webpages.layouts`, they are now available in this separate app. The functionality is identical, only the app location has changed.

To maintain existing functionality, ensure `default_layouts` is in your `INSTALLED_APPS`.
