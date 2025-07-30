 Widget Types API Endpoint Documentation

  Overview

  The /api/v1/webpages/widget-types/ endpoint provides access to widget type definitions with their template JSON serialization. This enables frontend applications
  to fetch widget schemas, render widgets client-side, and provide dynamic configuration interfaces.

  Endpoint Details

  - Base URL: /api/v1/webpages/widget-types/
  - Methods: GET
  - Authentication: Required (JWT or Session)
  - Content-Type: application/json

  API Endpoints

  1. List All Widget Types

  GET /api/v1/webpages/widget-types/

  Returns all active widget types with complete template JSON serialization.

  Response Structure:
  [
    {
      "name": "Text Block",
      "description": "Simple text content with rich formatting options",
      "widget_class": "TextWidget",
      "is_active": true,
      "configuration_schema": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string",
            "title": "Title",
            "description": "Optional title for the text block",
            "maxLength": 200
          },
          "content": {
            "type": "string",
            "title": "Content",
            "description": "Main text content (supports HTML)",
            "format": "textarea"
          }
        },
        "required": ["content"]
      },
      "template_json": {
        "structure": {
          "type": "element",
          "tag": "div",
          "classes": "text-widget",
          "children": [
            {
              "type": "element",
              "tag": "h3",
              "classes": "font-semibold text-gray-900 mb-2",
              "template_attributes": {
                "style": {
                  "value": "display: {{ config.title|yesno:'block,none' }}"
                }
              },
              "children": [
                {
                  "type": "template_text",
                  "content": "{{ config.title }}"
                }
              ]
            },
            {
              "type": "element",
              "tag": "div",
              "classes": "text-gray-700",
              "children": [
                {
                  "type": "template_text",
                  "content": "{{ config.content|safe }}"
                }
              ]
            }
          ]
        },
        "template_variables": ["config.title", "config.content"],
        "template_tags": ["yesno", "safe"],
        "has_inline_css": false
      }
    }
  ]

  2. Get Specific Widget Type

  GET /api/v1/webpages/widget-types/{widget_name}/

  Returns a single widget type by name (URL-encoded).

  Example:
  GET /api/v1/webpages/widget-types/Text%20Block/

  3. Get Active Widget Types Only

  GET /api/v1/webpages/widget-types/active/

  Returns only active widget types (same format as list all, but filtered).

  4. Include Inactive Widget Types

  GET /api/v1/webpages/widget-types/?active=false

  Returns all widget types including inactive ones.

  Response Fields

  Core Widget Type Fields

  | Field        | Type    | Description                               |
  |--------------|---------|-------------------------------------------|
  | name         | string  | Human-readable widget type name           |
  | description  | string  | Brief description of widget functionality |
  | widget_class | string  | Python class name for the widget          |
  | is_active    | boolean | Whether widget type is available for use  |

  Configuration Schema

  | Field                           | Type   | Description                               |
  |---------------------------------|--------|-------------------------------------------|
  | configuration_schema            | object | JSON Schema defining widget configuration |
  | configuration_schema.type       | string | Always "object"                           |
  | configuration_schema.properties | object | Field definitions                         |
  | configuration_schema.required   | array  | Required field names                      |

  Template JSON Structure

  | Field                            | Type    | Description                          |
  |----------------------------------|---------|--------------------------------------|
  | template_json                    | object  | Serialized Django template structure |
  | template_json.structure          | object  | Hierarchical template elements       |
  | template_json.template_variables | array   | Detected template variables          |
  | template_json.template_tags      | array   | Django template tags used            |
  | template_json.has_inline_css     | boolean | Whether template contains CSS        |

  Template JSON Structure Types

  Element Node

  {
    "type": "element",
    "tag": "div",
    "classes": "css-classes",
    "attributes": {
      "id": "static-id",
      "data-widget": "true"
    },
    "template_attributes": {
      "style": {
        "value": "display: {{ config.visible|yesno:'block,none' }}"
      }
    },
    "children": []
  }

  Template Text Node

  {
    "type": "template_text",
    "content": "{{ config.title|default:'Untitled' }}"
  }

  Static Text Node

  {
    "type": "text",
    "content": "Static text content"
  }

  Style Node

  {
    "type": "style",
    "css": ".widget-{{ widget.id }} { color: {{ config.color|default:'black' }}; }"
  }

  Fragment Node

  {
    "type": "fragment",
    "children": []
  }

  Configuration Schema Examples

  Text Field

  {
    "title": {
      "type": "string",
      "title": "Title",
      "description": "Widget title",
      "maxLength": 100,
      "minLength": 1
    }
  }

  Select Field (Enum)

  {
    "size": {
      "type": "string",
      "title": "Size",
      "enum": ["small", "medium", "large"],
      "default": "medium"
    }
  }

  Boolean Field

  {
    "show_border": {
      "type": "boolean",
      "title": "Show Border",
      "default": false
    }
  }

  Number Field

  {
    "columns": {
      "type": "integer",
      "title": "Number of Columns",
      "minimum": 1,
      "maximum": 6,
      "default": 2
    }
  }

  Error Responses

  404 - Widget Type Not Found

  {
    "detail": "Widget type \"Unknown Widget\" not found"
  }

  500 - Template Parsing Error

  {
    "detail": "Error parsing widget template",
    "error": "Template syntax error: Unclosed tag"
  }

  Usage Examples

  Frontend Integration

  // Fetch all widget types
  const response = await fetch('/api/v1/webpages/widget-types/')
  const widgetTypes = await response.json()

  // Find specific widget type
  const textWidget = widgetTypes.find(w => w.name === 'Text Block')

  // Access template structure
  const templateStructure = textWidget.template_json.structure

  // Get configuration schema
  const schema = textWidget.configuration_schema

  Template Variable Detection

  The template_variables array contains all detected template variables:

  {
    "template_variables": [
      "config.title",
      "config.content",
      "config.show_author",
      "widget.id"
    ]
  }

  Common variable patterns:
  - config.* - Widget configuration values
  - widget.id - Unique widget instance ID
  - widget.* - Widget metadata

  Template Tags Detection

  The template_tags array lists Django template tags used:

  {
    "template_tags": [
      "default",
      "safe",
      "yesno",
      "truncatewords"
    ]
  }

  Implementation Notes

  Backend Implementation

  - Templates are parsed using BeautifulSoup4 for HTML structure
  - Django template variables are extracted via regex patterns
  - CSS detection looks for <style> tags and inline styles
  - All widget types are cached for performance

  Frontend Rendering

  - Template JSON can be rendered client-side using React or similar
  - Variable substitution replaces {{ config.field }} with actual values
  - Template tags may need client-side implementation or fallbacks
  - CSS should be handled carefully for security (sanitization recommended)

  Security Considerations

  - Template JSON is sanitized during generation
  - XSS protection via HTML escaping
  - CSS injection prevention in template parsing
  - Authentication required for all endpoints

