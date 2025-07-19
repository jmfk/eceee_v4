# Code-Based Widget System

The eceee_v4 project features a powerful code-based widget system that allows developers to define widget types directly in code using Pydantic models for type safety and validation.

## Overview

The widget system provides:

- **Code-based widget registration** - Define widget types as Python classes with Pydantic configuration models
- **Automatic discovery** - Widget types are automatically discovered from Django apps
- **Type safety** - All widget configurations are validated using Pydantic models
- **JSON Schema generation** - Configuration schemas are automatically generated from Pydantic models
- **Third-party app support** - Any Django app can provide widget types
- **Version control friendly** - Widget types are defined in code and versioned with your application
- **Performance optimized** - No database queries required for widget type definitions

## Architecture

### Core Components

1. **`BaseWidget`** - Abstract base class for all code-based widgets
2. **`WidgetRegistry`** - Global registry that manages widget classes
3. **`autodiscover_widgets()`** - Automatic discovery system for Django apps
4. **Pydantic configuration models** - Type-safe configuration validation
5. **Template system** - Django templates for widget rendering
6. **Management commands** - Tools for widget management and validation

### File Structure

```
backend/webpages/
├── widget_registry.py          # Base classes and registry
├── widget_autodiscovery.py     # Discovery and validation
├── widgets.py                  # Built-in widget implementations
├── models.py                   # PageWidget model references
├── views.py                    # API endpoints for widgets
├── serializers.py              # Widget serializers
├── management/commands/
│   └── seed_widget_types.py    # Management command
└── apps.py                     # Auto-discovery integration
```

## Creating Widget Types

### Basic Widget Class

```python
from pydantic import BaseModel, Field
from webpages.widget_registry import BaseWidget, register_widget

class MyWidgetConfig(BaseModel):
    title: str = Field(..., description="Widget title")
    content: str = Field(..., description="Widget content")
    style: str = Field("default", description="Widget style")

@register_widget
class MyWidget(BaseWidget):
    name = "My Widget"
    description = "A custom widget example"
    template_name = "widgets/my_widget.html"
    configuration_model = MyWidgetConfig
```

### Configuration Model (Pydantic)

Widget configurations use Pydantic models for validation and type safety:

```python
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime

class TextBlockConfig(BaseModel):
    """Configuration for text block widget"""
    content: str = Field(..., description="Main text content")
    alignment: str = Field("left", description="Text alignment")
    style: str = Field("normal", description="Text style")
    
    @validator('alignment')
    def validate_alignment(cls, v):
        valid_alignments = ['left', 'center', 'right', 'justify']
        if v not in valid_alignments:
            raise ValueError(f'Alignment must be one of {valid_alignments}')
        return v

class ButtonConfig(BaseModel):
    """Configuration for button widget"""
    text: str = Field(..., description="Button text")
    url: str = Field(..., description="Button URL")
    style: str = Field("primary", description="Button style")
    target: str = Field("_self", description="Link target")
    
class EventConfig(BaseModel):
    """Configuration for event widget"""
    event_title: str = Field(..., description="Event title")
    start_date: datetime = Field(..., description="Event start date")
    end_date: Optional[datetime] = Field(None, description="Event end date")
    location: Optional[str] = Field(None, description="Event location")
    description: Optional[str] = Field(None, description="Event description")
```

### Template Creation

Each widget requires a Django template for rendering:

```html
<!-- templates/webpages/widgets/text_block.html -->
<div class="text-block {{ config.style|default:'normal' }}">
    {% if config.content %}
        <div class="content text-{{ config.alignment|default:'left' }}">
            {{ config.content|safe }}
        </div>
    {% endif %}
</div>
```

### Built-in Widget Types

The system includes several built-in widget types:

#### Text Block Widget
- **Purpose**: Rich text content display
- **Configuration**: Content, alignment, style
- **Template**: `webpages/widgets/text_block.html`

#### Image Widget  
- **Purpose**: Image display with alt text
- **Configuration**: Image URL, alt text, size
- **Template**: `webpages/widgets/image.html`

#### Button Widget
- **Purpose**: Call-to-action buttons
- **Configuration**: Text, URL, style, target
- **Template**: `webpages/widgets/button.html`

#### News Widget
- **Purpose**: News article display
- **Configuration**: Title, content, date, author
- **Template**: `webpages/widgets/news.html`

#### Events Widget
- **Purpose**: Event information display
- **Configuration**: Title, date/time, location, description
- **Template**: `webpages/widgets/events.html`

#### Calendar Widget
- **Purpose**: Calendar display
- **Configuration**: Month, year, events
- **Template**: `webpages/widgets/calendar.html`

#### Forms Widget
- **Purpose**: Custom form display
- **Configuration**: Form fields, validation, submission
- **Template**: `webpages/widgets/forms.html`

#### Gallery Widget
- **Purpose**: Image gallery display
- **Configuration**: Image list, layout, captions
- **Template**: `webpages/widgets/gallery.html`

#### HTML Block Widget
- **Purpose**: Custom HTML content
- **Configuration**: Raw HTML content
- **Template**: `webpages/widgets/html_block.html`

#### Spacer Widget
- **Purpose**: Layout spacing
- **Configuration**: Height, style
- **Template**: `webpages/widgets/spacer.html`

## Widget Registration

### Automatic Discovery

Widget types are automatically discovered from all installed Django apps during startup:

```python
# In your app's widgets.py file
from webpages.widget_registry import register_widget, BaseWidget
from pydantic import BaseModel, Field

class CustomWidgetConfig(BaseModel):
    title: str = Field(..., description="Widget title")

@register_widget  
class CustomWidget(BaseWidget):
    name = "Custom Widget"
    description = "My custom widget"
    template_name = "my_app/widgets/custom.html"
    configuration_model = CustomWidgetConfig
```

### Manual Registration

You can also register widgets manually:

```python
from webpages.widget_registry import widget_registry

widget_registry.register(MyWidget)
```

### Registration Validation

The system validates widget registrations:

- **Unique names** - Widget names must be unique
- **Valid configuration models** - Pydantic models must be valid
- **Template existence** - Templates must exist in the template path
- **Required attributes** - All required widget attributes must be present

## API Integration

### Widget Types Endpoint

The widget types are exposed via REST API:

```http
GET /api/webpages/widget-types/
```

Response:
```json
[
    {
        "name": "Text Block",
        "description": "Rich text content widget",
        "template_name": "webpages/widgets/text_block.html",
        "is_active": true,
        "configuration_schema": {
            "type": "object",
            "properties": {
                "content": {
                    "type": "string",
                    "description": "Main text content"
                },
                "alignment": {
                    "type": "string",
                    "enum": ["left", "center", "right", "justify"],
                    "default": "left",
                    "description": "Text alignment"
                },
                "style": {
                    "type": "string",
                    "enum": ["normal", "emphasized", "quote"],
                    "default": "normal", 
                    "description": "Text style"
                }
            },
            "required": ["content"]
        }
    }
]
```

### Widget Creation

Widgets are created using widget type names:

```http
POST /api/webpages/widgets/
```

Request:
```json
{
    "page": 1,
    "widget_type_name": "Text Block",
    "slot_name": "main",
    "sort_order": 1,
    "configuration": {
        "content": "Hello, World!",
        "alignment": "center",
        "style": "emphasized"
    }
}
```

## Frontend Integration

### Widget Library Component

The frontend `WidgetLibrary` component displays available widget types:

```javascript
// Fetches widget types from API
const { data: widgetTypes } = useQuery(['widgetTypes'], 
    () => apiClient.get('/widget-types/').then(res => res.data)
)

// Filters widgets by category derived from name
const filteredWidgets = widgetTypes?.filter(widget => 
    selectedCategory === 'all' || getWidgetCategory(widget.name) === selectedCategory
)
```

### Widget Configurator Component

The `WidgetConfigurator` component provides form-based configuration:

```javascript
// Uses configuration_schema to render form fields
const schema = widgetType.configuration_schema
const properties = schema?.properties || {}

// Validates configuration using schema
const validateConfiguration = (config) => {
    const ajv = new Ajv()
    const validate = ajv.compile(schema)
    return validate(config)
}
```

## Migration from Database-Based System

### Key Changes

1. **Widget Types**: Moved from database records to code-based classes
2. **Configuration Validation**: Changed from JSON Schema to Pydantic models  
3. **API Response**: Widget types now returned as direct array instead of paginated
4. **Identification**: Widgets identified by name instead of database ID
5. **Schema Generation**: JSON schemas auto-generated from Pydantic models

### Migration Benefits

- **Performance**: No database queries for widget type definitions
- **Type Safety**: Compile-time validation with Pydantic
- **Version Control**: Widget types tracked in source control
- **Maintainability**: Widget logic co-located with configuration
- **Developer Experience**: IDE support and auto-completion

### Testing Updates

Tests have been updated to work with the new system:

```python
# Backend tests use widget names instead of IDs
def test_create_widget_with_text_block(self):
    widget = PageWidget.objects.create(
        page=self.page,
        widget_type_name="Text Block",  # Using name instead of FK
        slot_name="main",
        configuration={"content": "Test content"}
    )
```

```javascript
// Frontend tests use direct array responses
const mockWidgetTypes = [
    {
        name: "Text Block",
        configuration_schema: { /* schema */ }
    }
]

// API calls updated to handle direct arrays
expect(apiClient.get).toHaveBeenCalledWith('/widget-types/')
```

## Management Commands

### Validate Widget Types

```bash
python manage.py validate_widgets
```

Validates all registered widget types and reports any issues.

### List Widget Types

```bash
python manage.py list_widgets
```

Lists all registered widget types with their status and configuration.

### Test Widget Configuration

```bash
python manage.py test_widget_config <widget_name> <config_json>
```

Tests a widget configuration against its Pydantic model.

## Best Practices

### Widget Development

1. **Use descriptive names** - Widget names should be clear and unique
2. **Provide good descriptions** - Help users understand widget purpose
3. **Validate configurations** - Use Pydantic validators for complex validation
4. **Document templates** - Include template documentation and examples
5. **Test thoroughly** - Write tests for both configuration and rendering

### Configuration Models

1. **Use appropriate types** - Choose correct Pydantic field types
2. **Provide defaults** - Set sensible default values where possible
3. **Add descriptions** - Help users understand each configuration option
4. **Use validators** - Implement custom validation for business logic
5. **Consider future changes** - Design for extensibility

### Template Design

1. **Handle missing data** - Gracefully handle missing configuration values
2. **Use safe rendering** - Properly escape user content
3. **Follow conventions** - Use consistent CSS classes and structure
4. **Test edge cases** - Ensure templates work with various configurations
5. **Optimize performance** - Avoid expensive operations in templates

## Troubleshooting

### Common Issues

**Widget not appearing in library:**
- Check that the widget is properly registered with `@register_widget`
- Verify the widget file is imported during Django startup
- Check for validation errors in the widget configuration

**Configuration validation errors:**
- Ensure Pydantic model fields are correctly defined
- Check that required fields are properly marked
- Validate JSON schema generation

**Template rendering issues:**
- Verify template file exists in the correct location
- Check template syntax and context variables
- Ensure configuration data is properly passed to template

### Debug Commands

```bash
# Check widget registry status
python manage.py shell -c "from webpages.widget_registry import widget_registry; print(widget_registry.get_all_widgets())"

# Validate specific widget
python manage.py validate_widgets --widget "Text Block"

# Test configuration parsing
python manage.py shell -c "from webpages.widgets import TextBlockWidget; print(TextBlockWidget.get_configuration_schema())"
```

## Security Considerations

1. **Input validation** - All widget configurations are validated by Pydantic
2. **Template security** - Use Django's built-in template security features
3. **XSS prevention** - Properly escape user content in templates
4. **Access control** - Implement appropriate permissions for widget management
5. **Content sanitization** - Sanitize HTML content in widgets like HTML Block

## Performance Considerations

1. **No database queries** - Widget types loaded once at startup
2. **Schema caching** - Configuration schemas cached after generation
3. **Template caching** - Django template caching applies to widget templates
4. **Lazy loading** - Widget discovery happens during Django startup
5. **Memory usage** - Widget registry kept in memory for fast access 