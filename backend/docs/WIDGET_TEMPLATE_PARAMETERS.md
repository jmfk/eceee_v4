# Widget Template Parameters

Technical documentation on how widget configuration parameters are made available in Django/Mustache templates.

## Overview

Widget parameters flow from the frontend through the API to templates via the `prepare_template_context()` method. Understanding this flow is essential for widget development and template customization.

## Parameter Flow

```
Frontend (camelCase)
    ↓
API Layer (djangorestframework-camel-case)
    ↓
Backend (snake_case)
    ↓
prepare_template_context()
    ↓
Template (snake_case access via config object)
```

## Naming Convention Conversion

### Frontend to Backend

The `djangorestframework-camel-case` library automatically converts field names:

**Frontend (JavaScript):**
```javascript
{
  backgroundColor: "#3b82f6",
  enableLightbox: true,
  menuItems: [...]
}
```

**Backend (Python):**
```python
{
  'background_color': '#3b82f6',
  'enable_lightbox': True,
  'menu_items': [...]
}
```

### Pydantic Model Configuration

All widget configuration models use `to_camel` alias generator:

```python
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

class WidgetConfig(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,  # Accept both snake_case and camelCase
    )
    
    background_color: str = Field(
        "#ffffff",
        description="Background color"
    )
```

This allows the model to:
1. Accept camelCase from frontend: `backgroundColor`
2. Store internally as snake_case: `background_color`
3. Serialize back to camelCase for frontend responses

## The prepare_template_context() Method

Every widget inherits `prepare_template_context()` from `BaseWidget`. This method:

1. Receives the configuration dictionary
2. Processes/computes additional parameters
3. Returns a dictionary for template rendering

### Default Implementation (BaseWidget)

```python
def prepare_template_context(self, config, context=None):
    """
    Default implementation of prepare_template_context.
    
    Args:
        config: Widget configuration dictionary from widget_data['configuration']
        context: Full rendering context with page, object, and inherited data
    
    Returns:
        dict: Processed configuration ready for template rendering
    """
    # Start with a copy of the base configuration
    template_config = config.copy() if config else {}
    context = context if context else {}
    
    # Add context data access for widgets that need it
    if context:
        # Provide access to page hierarchy and inheritance
        template_config["_context"] = {
            "widget": config.get("config"),
            "page": context.get("page"),
            "current_page": context.get("current_page"),
            "page_version": context.get("page_version"),
            "page_data": context.get("page_data"),
            "parent": context.get("parent"),
            "layout": context.get("layout"),
            "theme": context.get("theme"),
            "slots": context.get("slots", []),
            "request": context.get("request"),
            "path_variables": context.get("path_variables", {}),
        }
        
        # If this is an object page, add object context
        if context.get("is_object_page"):
            template_config["_context"]["object_content"] = context.get("object_content")
            template_config["_context"]["linked_object"] = context.get("linked_object")
    
    return template_config
```

### Custom Implementation Example

Widgets override this method to add computed parameters:

```python
class HeroWidget(BaseWidget):
    def prepare_template_context(self, config, context=None):
        """Prepare hero template context with image processing and color variables"""
        from file_manager.imgproxy import imgproxy_service
        
        template_config = super().prepare_template_context(config, context)
        
        # Build CSS variables for colors
        style_parts = []
        text_color = config.get("text_color", "#ffffff")
        style_parts.append(f"--hero-text-color: {text_color};")
        
        # Process background image if provided
        image = config.get("image")
        if image:
            imgproxy_base_url = image.get("imgproxy_base_url")
            if imgproxy_base_url:
                image_url = imgproxy_service.generate_url(
                    source_url=imgproxy_base_url,
                    width=1920,
                    height=1080,
                    resize_type="fill",
                )
                if image_url:
                    template_config["background_image_url"] = image_url
        
        # Join all style parts
        template_config["hero_style"] = " ".join(style_parts)
        
        return template_config
```

## Template Access Patterns

### Accessing Basic Configuration

Templates access parameters through the `config` object:

**Django Template:**
```django
<div style="{{ config.hero_style }}">
    <h1>{{ config.header }}</h1>
    {% if config.background_image_url %}
        <img src="{{ config.background_image_url }}" alt="">
    {% endif %}
</div>
```

**Mustache Template:**
```mustache
<div style="{{hero_style}}">
    <h1>{{header}}</h1>
    {{#background_image_url}}
        <img src="{{background_image_url}}" alt="">
    {{/background_image_url}}
</div>
```

### Accessing Context Data

Context data is available through `config._context`:

```django
{# Current page #}
{{ config._context.page.title }}
{{ config._context.page.path }}

{# Theme data #}
{{ config._context.theme.name }}

{# Path variables (for dynamic pages) #}
{{ config._context.path_variables.news_slug }}

{# Request data #}
{{ config._context.request.get_host }}
```

### Iterating Over Lists

```django
{# Menu items #}
{% for item in config.menu_items %}
    <a href="{{ item.url }}">{{ item.label }}</a>
{% endfor %}

{# Media items #}
{% for media in config.media_items %}
    <img src="{{ media.url }}" alt="{{ media.alt_text }}">
{% endfor %}
```

## Common Parameter Patterns

### Image Processing

Widgets that handle images typically process them in `prepare_template_context()`:

```python
# Original config (from frontend)
config.get("image")  # May be a dict with id, url, imgproxy_base_url

# Processed in prepare_template_context()
template_config["image_url"] = imgproxy_service.generate_url(
    source_url=image["imgproxy_base_url"],
    width=800,
    height=600,
    resize_type="fill"
)

# Template access
{{ config.image_url }}
```

### Collection Resolution

Widgets like ImageWidget resolve collections to media items:

```python
# Original config
config.get("collectionId")  # String ID

# Processed in prepare_template_context()
media_items = self.resolve_collection_images(collection_id)
template_config["media_items"] = media_items  # List of dicts

# Template access
{% for item in config.media_items %}
    <img src="{{ item.url }}" alt="{{ item.alt_text }}">
{% endfor %}
```

### CSS Variable Injection

Widgets inject CSS variables for dynamic styling:

```python
# Build CSS variables
style_parts = []
style_parts.append(f"--bg-color: {config.get('background_color')};")
style_parts.append(f"--text-color: {config.get('text_color')};")

template_config["widget_style"] = " ".join(style_parts)

# Template usage
<div style="{{ config.widget_style }}">
    Content with dynamic colors
</div>
```

## CamelCase to Snake_Case in Templates

**CRITICAL:** Even though the frontend sends camelCase, templates must use snake_case:

**Frontend sends:**
```javascript
{
  backgroundColor: "#ffffff",
  enableLightbox: true,
  menuItems: [...]
}
```

**Template accesses:**
```django
{{ config.background_color }}  {# snake_case #}
{{ config.enable_lightbox }}   {# snake_case #}
{% for item in config.menu_items %}  {# snake_case #}
```

The conversion happens automatically through the Pydantic model's `alias_generator`.

## Special Parameters

### Component Styles

The `componentStyle` parameter enables custom rendering via Mustache templates:

```python
def render_with_style(self, config, theme):
    """Render with custom component style from theme."""
    style_name = config.get("component_style", "default")
    if style_name == "default":
        return None  # Use default template
    
    styles = theme.component_styles or {}
    style = styles.get(style_name)
    if not style:
        return None
    
    # Render with Mustache template
    html = render_mustache(style["template"], config)
    css = style.get("css", "")
    return html, css
```

### Inheritance Metadata

Widgets receive inheritance information in context:

```python
# In template
{{ config._context.widget_inherited_from }}  {# Page ID widget inherited from #}
{{ config._context.widget_inheritance_depth }}  {# Depth in hierarchy #}
```

## Debugging Template Parameters

To see what parameters are available in a template:

**Django Template Debug:**
```django
<pre>{{ config|pprint }}</pre>
```

**Mustache Template (use PathDebugWidget):**
The PathDebugWidget displays all available context variables for debugging.

## Best Practices

### 1. Always Call Super

When overriding `prepare_template_context()`, always call parent implementation:

```python
def prepare_template_context(self, config, context=None):
    # Get base configuration
    template_config = super().prepare_template_context(config, context)
    
    # Add widget-specific processing
    template_config["computed_value"] = self._compute_value(config)
    
    return template_config
```

### 2. Handle Both Naming Conventions

Support both camelCase and snake_case for backwards compatibility:

```python
# Try both naming conventions
value = config.get("background_color") or config.get("backgroundColor")
```

### 3. Provide Sensible Defaults

Always provide defaults for optional parameters:

```python
background_color = config.get("background_color", "#ffffff")
enable_lightbox = config.get("enable_lightbox", True)
```

### 4. Document Computed Parameters

Add comments explaining computed parameters:

```python
# Add processed content with media inserts
template_config["processed_content"] = self._process_media_inserts(
    config.get("content", "")
)
```

### 5. Use Type Hints

Type hints improve code maintainability:

```python
def prepare_template_context(
    self, 
    config: Dict[str, Any], 
    context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Prepare template context."""
    ...
```

## Common Pitfalls

### 1. Using CamelCase in Templates

**Wrong:**
```django
{{ config.backgroundColor }}  {# camelCase won't work #}
```

**Correct:**
```django
{{ config.background_color }}  {# snake_case #}
```

### 2. Forgetting to Copy Config

**Wrong:**
```python
def prepare_template_context(self, config, context=None):
    # Modifying original config!
    config["new_field"] = "value"
    return config
```

**Correct:**
```python
def prepare_template_context(self, config, context=None):
    template_config = config.copy()
    template_config["new_field"] = "value"
    return template_config
```

### 3. Not Handling None Values

**Wrong:**
```python
image_url = config["image"]["imgproxy_base_url"]  # May fail
```

**Correct:**
```python
image = config.get("image")
if image:
    image_url = image.get("imgproxy_base_url")
```

## See Also

- [Code-Based Widget System](./CODE_BASED_WIDGET_SYSTEM.md)
- [Widget Quick Reference](./WIDGET_QUICK_REFERENCE.md)
- [Mustache Renderer](../webpages/utils/mustache_renderer.py)


## Component Style Template Access

Component styles can access widget configuration properties alongside rendered content.

### Available Variables in Component Styles

When a widget uses `render_with_style()`, the Mustache template receives:

```python
{
  'content': '<div>...rendered widget HTML...</div>',
  'anchor': 'section-id',
  'config': {
    'header': 'Welcome',
    'before_text': 'Introduction',
    'text_color': '#ffffff',
    'background_color': '#1f2937',
    # ... all widget config properties in snake_case
  },
  'slots': {
    'left': [...],
    'right': [...],
    # ... for container widgets
  },
  # ... plus any style variables
}
```

### Access Patterns

**1. Wrapper Approach** - Wrap rendered widget HTML:
```mustache
<div class="custom-wrapper">
  {{{content}}}
</div>
```

**2. Direct Config Access** - Use widget properties directly:
```mustache
<div class="hero-custom" style="background: {{config.background_color}}; color: {{config.text_color}};">
  {{#config.before_text}}<p>{{config.before_text}}</p>{{/config.before_text}}
  <h1>{{config.header}}</h1>
  {{#config.after_text}}<p>{{config.after_text}}</p>{{/config.after_text}}
</div>
```

**3. Hybrid Approach** (Recommended) - Combine both:
```mustache
<div class="hero-custom" style="--bg: {{config.background_color}};">
  <h1>{{config.header}}</h1>
  <div class="widget-content">{{{content}}}</div>
</div>
```

### Widget-Specific Properties

**ContentWidget:**
```mustache
{{config.content}}          {# Raw HTML content #}
{{config.anchor}}           {# Section anchor #}
{{config.component_style}}  {# Selected style name #}
```

**HeroWidget:**
```mustache
{{config.header}}            {# Main header text #}
{{config.before_text}}       {# Text before header #}
{{config.after_text}}        {# Text after header #}
{{config.text_color}}        {# Text color hex #}
{{config.background_color}}  {# Background color #}
```

**TableWidget:**
```mustache
{{config.caption}}          {# Table caption #}
{{config.show_borders}}     {# Boolean #}
{{config.striped_rows}}     {# Boolean #}
{{config.hover_effect}}     {# Boolean #}
```

**FormWidget:**
```mustache
{{config.title}}                {# Form title #}
{{config.description}}          {# Form description #}
{{config.submit_button_text}}   {# Button text #}
```

**NavbarWidget:**
```mustache
{{config.background_color}}     {# Background color #}
{{config.hamburger_breakpoint}} {# Mobile breakpoint px #}
{{{content}}}                   {# Rendered navbar HTML #}
```

### Container Widgets (TwoColumns, ThreeColumns)

Container widgets provide slot data:

```mustache
<div class="custom-columns">
  <div class="col-left">
    {{#slots.left}}
      {{{html}}}
    {{/slots.left}}
  </div>
  <div class="col-right">
    {{#slots.right}}
      {{{html}}}
    {{/slots.right}}
  </div>
</div>
```

### CRITICAL: Use snake_case in Templates

Even though the frontend sends `backgroundColor`, templates MUST use `background_color`:

**Wrong:**
```mustache
{{config.backgroundColor}}   {# Won't work! #}
{{config.beforeText}}        {# Won't work! #}
```

**Correct:**
```mustache
{{config.background_color}}  {# snake_case #}
{{config.before_text}}       {# snake_case #}
```

The conversion happens automatically in `prepare_template_context()`.
