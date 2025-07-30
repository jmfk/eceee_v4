# Widget Template JSON Serialization Feature

## Overview

The Widget Template JSON Serialization feature converts Django widget templates to JSON format, enabling frontend applications to dynamically render widgets without server-side template rendering. This feature provides a foundation for client-side widget rendering, form generation, and template editing capabilities.

## Features

### ✅ **Template Parsing**
- Converts Django HTML templates to structured JSON
- Extracts template variables and tags
- Detects inline CSS and style elements
- Handles conditional logic and loops
- Maintains template structure and hierarchy

### ✅ **API Integration**
- Extends existing Widget Types API endpoints
- Configurable inclusion/exclusion via query parameters
- Backward compatible with existing API consumers
- Comprehensive caching for performance

### ✅ **Caching System**
- Template parsing results cached for performance
- Follows existing layout serialization caching patterns
- Configurable cache timeout via Django settings
- Cache invalidation on template changes

## API Endpoints

### Widget Types with Template JSON

All existing widget type endpoints now support template JSON serialization:

#### **List All Widget Types**
```http
GET /api/v1/webpages/widget-types/
GET /api/v1/webpages/widget-types/?include_template_json=true   # Explicit inclusion
GET /api/v1/webpages/widget-types/?include_template_json=false  # Exclude for performance
```

#### **Get Specific Widget Type**
```http
GET /api/v1/webpages/widget-types/{widget_name}/
GET /api/v1/webpages/widget-types/Text%20Block/?include_template_json=true
```

#### **Get Active Widget Types**
```http
GET /api/v1/webpages/widget-types/active/
GET /api/v1/webpages/widget-types/active/?include_template_json=false
```

### Response Format

Widget API responses now include a `template_json` field:

```json
{
  "name": "Text Block",
  "description": "Simple text content with formatting options",
  "template_name": "webpages/widgets/text_block.html",
  "is_active": true,
  "configuration_schema": { /* Pydantic schema */ },
  "template_json": {
    "structure": {
      "type": "element",
      "tag": "div",
      "classes": "text-widget",
      "children": [
        {
          "type": "element",
          "tag": "h3",
          "children": [
            {
              "type": "template_text",
              "content": "{{ config.title }}",
              "variables": ["config.title"]
            }
          ]
        }
      ]
    },
    "template_variables": ["config.title", "config.content", "config.alignment"],
    "template_tags": ["if", "endif"],
    "has_inline_css": false
  }
}
```

## Template JSON Structure

### **Root Structure**
```json
{
  "structure": { /* Parsed HTML structure */ },
  "template_variables": ["config.field1", "config.field2"],
  "template_tags": ["if", "for", "endif"],
  "has_inline_css": true
}
```

### **Element Types**

#### **HTML Element**
```json
{
  "type": "element",
  "tag": "div",
  "classes": "widget-class {{ config.style }}",
  "attributes": {
    "id": "widget-id",
    "data-widget": "true"
  },
  "template_attributes": {
    "href": {
      "value": "{{ config.url }}",
      "variables": ["config.url"]
    }
  },
  "children": [ /* Child elements */ ]
}
```

#### **Template Text**
```json
{
  "type": "template_text",
  "content": "{{ config.content|linebreaks }}",
  "variables": ["config.content"]
}
```

#### **Static Text**
```json
{
  "type": "text",
  "content": "Static text content"
}
```

#### **Style Element**
```json
{
  "type": "style",
  "css": ".widget { color: {{ config.color }}; }",
  "variables": ["config.color"]
}
```

## Implementation Details

### Core Classes

#### **WidgetTemplateParser**
```python
from webpages.utils.template_parser import WidgetTemplateParser

parser = WidgetTemplateParser()
result = parser.parse_widget_template('webpages/widgets/text_block.html')
```

#### **WidgetSerializer**
```python
from webpages.utils.template_parser import WidgetSerializer

serializer = WidgetSerializer()
result = serializer.serialize_widget_template(widget_instance)
```

#### **BaseWidget Integration**
```python
# Widget instances now have template JSON capability
widget = widget_type_registry.get_widget_type("Text Block")
template_json = widget.get_template_json()

# Include/exclude in to_dict()
widget_dict = widget.to_dict(include_template_json=True)
```

### Security Features

- **HTML Escaping**: All content is escaped to prevent XSS
- **Input Validation**: Template variables and tags are validated
- **Size Limits**: Template content size limits prevent DoS attacks
- **Sanitization**: Dangerous content is filtered out

## Configuration

### Django Settings

```python
# Cache timeout for widget template parsing (default: 300 seconds)
WIDGET_TEMPLATE_PARSER_CACHE_TIMEOUT = 300

# Enable/disable template JSON feature globally
WIDGET_TEMPLATE_JSON_ENABLED = True
```

### Per-Widget Configuration

```python
class CustomWidget(BaseWidget):
    name = "Custom Widget"
    template_name = "custom/widget.html"
    
    def get_template_json(self):
        # Override for custom template JSON logic
        return super().get_template_json()
```

## Frontend Usage Examples

### **Dynamic Form Generation**
```javascript
// Fetch widget type with template JSON
fetch('/api/v1/webpages/widget-types/Text%20Block/')
  .then(response => response.json())
  .then(widget => {
    const schema = widget.configuration_schema;
    const template = widget.template_json;
    
    // Generate form from schema
    generateConfigForm(schema);
    
    // Generate preview from template
    renderWidgetPreview(template);
  });
```

### **Client-Side Widget Rendering**
```javascript
function renderWidget(templateJson, config) {
  const element = renderElement(templateJson.structure, config);
  
  if (templateJson.has_inline_css) {
    injectWidgetCSS(templateJson.structure);
  }
  
  return element;
}

function renderElement(elementData, config) {
  switch (elementData.type) {
    case 'element':
      return renderHTMLElement(elementData, config);
    case 'template_text':
      return renderTemplateText(elementData, config);
    case 'text':
      return document.createTextNode(elementData.content);
  }
}
```

### **Template Editing Interface**
```javascript
// Visual template editor
function createTemplateEditor(templateJson) {
  const editor = new TemplateEditor();
  editor.loadTemplate(templateJson);
  
  // Add event handlers for template modification
  editor.on('structure-change', updatePreview);
  editor.on('variable-change', validateConfig);
}
```

## Performance Considerations

### **Caching Strategy**
- Template parsing results are cached for 5 minutes by default
- Cache keys include template name for isolation
- Cache invalidation on template file changes

### **API Performance**
- Use `include_template_json=false` for lightweight responses
- Template JSON generation adds ~10-50ms per widget
- Batch requests for multiple widgets when possible

### **Frontend Optimization**
- Cache parsed templates in browser storage
- Use template JSON for preview generation only
- Render production widgets server-side for SEO

## Testing

### **Comprehensive Test Suite**
- Template parser functionality tests
- API endpoint integration tests
- Security and validation tests
- Performance and caching tests
- Error handling tests

### **Running Tests**
```bash
# All template JSON tests
docker-compose exec backend python manage.py test webpages.tests_widget_template_serialization

# Specific test categories
docker-compose exec backend python manage.py test webpages.tests_widget_template_serialization.WidgetTemplateParserTest
docker-compose exec backend python manage.py test webpages.tests_widget_template_serialization.WidgetTypeAPITemplateJSONTest
```

## Migration Guide

### **For API Consumers**
1. **No Breaking Changes**: Existing API endpoints work unchanged
2. **Opt-in Feature**: Template JSON included by default, exclude with `?include_template_json=false`
3. **New Field**: Watch for `template_json` field in responses

### **For Widget Developers**
1. **No Changes Required**: Existing widgets automatically support template JSON
2. **Custom Logic**: Override `get_template_json()` for custom behavior
3. **Testing**: Add template JSON tests for custom widgets

### **For Frontend Developers**
1. **Schema + Template**: Use both `configuration_schema` and `template_json`
2. **Variable Mapping**: Match schema fields to template variables
3. **Security**: Always sanitize user input when rendering templates

## Troubleshooting

### **Common Issues**

#### **Template JSON Missing**
```json
{
  "name": "Widget Name",
  "template_json": null  // Template parsing failed
}
```
**Solutions:**
- Check template file exists and is valid HTML
- Verify template doesn't have syntax errors
- Check Django template loader configuration

#### **Empty Template Variables**
```json
{
  "template_variables": []  // No variables found
}
```
**Solutions:**
- Ensure template uses `{{ config.field }}` syntax
- Check for typos in variable names
- Verify template content isn't commented out

#### **Performance Issues**
**Symptoms:** Slow API responses with template JSON
**Solutions:**
- Use `?include_template_json=false` for non-preview requests
- Increase cache timeout in settings
- Optimize template complexity

### **Debug Mode**
```python
# Enable detailed logging
import logging
logging.getLogger('webpages.utils.template_parser').setLevel(logging.DEBUG)
```

## Future Enhancements

### **Planned Features**
1. **Template Validation**: Validate templates against widget schemas
2. **Visual Editor API**: Endpoints for template modification
3. **Template Versioning**: Track template changes over time
4. **Advanced Parsing**: Support for custom template tags
5. **Frontend SDK**: JavaScript library for template rendering

### **Integration Opportunities**
1. **Page Builder**: Visual page construction interface
2. **Theme Editor**: Dynamic theme customization
3. **A/B Testing**: Template variant testing
4. **Analytics**: Template usage tracking

## Conclusion

The Widget Template JSON Serialization feature provides a powerful foundation for client-side widget rendering and dynamic form generation. With comprehensive API integration, robust caching, and extensive testing, it enables rich frontend interactions while maintaining backward compatibility and security.

The feature opens up possibilities for visual editors, real-time previews, and sophisticated widget management interfaces, making the CMS more flexible and user-friendly.