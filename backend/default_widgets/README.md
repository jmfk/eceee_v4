# Default Widgets App

This Django app contains the default widget definitions that ship with eceee_v4. These widgets provide common content components for most website needs.

## Available Widgets

### ContentWidget (`Content`)
- **Description**: Rich text content widget with HTML support
- **Use Case**: Articles, text blocks, formatted content
- **Features**: HTML sanitization, script control, CSS styling

### ImageWidget (`Image`)
- **Description**: Image and video display widget with gallery support
- **Use Case**: Single images, image galleries, video content
- **Features**: Lightbox, captions, responsive sizing, carousel mode

### TableWidget (`Table`)
- **Description**: Data table widget with formatting options
- **Use Case**: Structured data presentation, comparison tables
- **Features**: Responsive design, striped rows, hover effects, custom styling

### HeaderWidget (`Header`)
- **Description**: Page header widget with background and overlay options
- **Use Case**: Page headers, hero sections, banner content
- **Features**: Background images, overlay effects, hero styling

### FooterWidget (`Footer`)
- **Description**: Page footer widget with copyright and social links
- **Use Case**: Site footers, contact information, legal notices
- **Features**: Copyright notices, social media links, custom styling

### NavigationWidget (`Navigation`)
- **Description**: Site navigation menu widget
- **Use Case**: Main navigation, breadcrumbs, menu systems
- **Features**: Mobile-friendly, dropdown menus, brand/logo support

### SidebarWidget (`Sidebar`)
- **Description**: Sidebar content widget with nested widgets
- **Use Case**: Complementary content, widget areas
- **Features**: Left/right positioning, collapsible, nested widgets

### FormsWidget (`Forms`)
- **Description**: Custom form builder widget
- **Use Case**: Contact forms, surveys, data collection
- **Features**: Field validation, AJAX submission, spam protection

### GalleryWidget (`Gallery`)
- **Description**: Media gallery widget for multiple images/videos
- **Use Case**: Photo galleries, portfolio displays
- **Features**: Grid layouts, lightbox, sorting, filtering

### HTMLBlockWidget (`HTML Block`)
- **Description**: Raw HTML content widget for custom code
- **Use Case**: Custom HTML, embedded content, scripts
- **Features**: HTML validation, security controls

### SpacerWidget (`Spacer`)
- **Description**: Spacing widget for layout control
- **Use Case**: Vertical spacing, layout separation
- **Features**: Configurable height, responsive spacing

## Usage

### Enable Default Widgets

Add `default_widgets` to your `INSTALLED_APPS` in `settings.py`:

```python
INSTALLED_APPS = [
    # ... other apps
    'webpages',          # Core system (required)
    'default_widgets',   # Default widgets (optional)
    # ... other apps
]
```

### Disable Default Widgets

Simply remove `default_widgets` from `INSTALLED_APPS`:

```python
INSTALLED_APPS = [
    # ... other apps
    'webpages',              # Core system (required)
    # 'default_widgets',    # Disabled - no default widgets
    'my_custom_widgets',     # Use custom widgets instead
    # ... other apps
]
```

## Templates

Widget templates are located in `templates/default_widgets/widgets/`:

- `content.html` - Content widget template
- `image.html` - Image widget template
- `table.html` - Table widget template
- `header.html` - Header widget template
- `footer.html` - Footer widget template
- `navigation.html` - Navigation widget template
- `sidebar.html` - Sidebar widget template
- `forms.html` - Forms widget template
- `gallery.html` - Gallery widget template
- `html_block.html` - HTML Block widget template
- `spacer.html` - Spacer widget template

## Configuration Models

Widget configuration is handled by Pydantic models co-located with their widgets:

- `ContentConfig` (in `widgets/content.py`) - Content widget configuration
- `ImageConfig` (in `widgets/image.py`) - Image widget configuration  
- `TableConfig` (in `widgets/table.py`) - Table widget configuration
- `FooterConfig` (in `widgets/footer.py`) - Footer widget configuration
- `HeaderConfig` (in `widgets/header.py`) - Header widget configuration
- `NavigationConfig` (in `widgets/navigation.py`) - Navigation widget configuration
- `SidebarConfig` (in `widgets/sidebar.py`) - Sidebar widget configuration
- `FormsConfig` (in `widgets/forms.py`) - Forms widget configuration

Each widget file contains both the widget class and its associated Pydantic configuration model.

## Customization

### Override Individual Widgets

Create a custom app with widgets using the same names to override defaults:

```python
# my_custom_widgets/widgets.py
from webpages.widget_registry import BaseWidget, register_widget_type

@register_widget_type
class ContentWidget(BaseWidget):
    name = "Content"  # Same name overrides default
    # Your custom implementation
```

### Create Additional Widgets

Add new widgets alongside defaults:

```python
# my_custom_widgets/widgets.py
@register_widget_type
class MyCustomWidget(BaseWidget):
    name = "My Custom Widget"  # New widget name
    # Your implementation
```

### CSS Customization

Each widget includes CSS variables for easy theming:

```css
/* Override widget CSS variables */
.content-widget {
    --content-font: 'Custom Font', sans-serif;
    --heading-color: #2563eb;
    --paragraph-margin: 1.5rem;
}
```

## App Configuration

The app automatically registers all widgets when Django starts up via the `ready()` method in `apps.py`. No manual configuration is needed.

## Dependencies

- Requires `webpages` app for `BaseWidget` and `register_widget_type`
- Uses Pydantic for configuration validation
- Compatible with the widget autodiscovery system
- Integrates with the CSS injection system

## Migration from core_widgets

If you previously used widgets from `core_widgets`, they are now available in this separate app. The functionality is identical, only the app location and template paths have changed.

To maintain existing functionality, ensure `default_widgets` is in your `INSTALLED_APPS`.

## Security Features

- HTML sanitization in Content widgets
- XSS protection controls
- Script execution controls  
- Form spam protection (honeypot, reCAPTCHA)
- Input validation via Pydantic models
