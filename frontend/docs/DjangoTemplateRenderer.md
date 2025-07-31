# Django Template Renderer

A standalone vanilla JavaScript module for rendering Django template subset functionality extracted from `LayoutRenderer.js`.

## Overview

The `DjangoTemplateRenderer` provides a comprehensive template processing engine that supports:

- **Variable substitution**: `{{ config.field }}`
- **Template filters**: `|default`, `|linebreaks`, `|safe`, `|escape`, `|upper`, `|lower`, `|title`, `|length`
- **Conditional logic**: `{% if %}` / `{% endif %}`
- **Loop logic**: `{% for %}` / `{% endfor %}`
- **Security features**: XSS protection, prototype pollution prevention
- **Error handling**: Safe fallbacks and comprehensive error reporting

## Installation

```javascript
import DjangoTemplateRenderer from '../utils/DjangoTemplateRenderer.js';

const renderer = new DjangoTemplateRenderer();
```

## Basic Usage

### Variable Substitution

```javascript
const template = 'Hello {{ config.name }}!';
const config = { name: 'World' };

const result = renderer.resolveTemplateVariables(template, config);
// Result: 'Hello World!'
```

### Template Filters

```javascript
// Default filter
const template = '{{ config.title|default:"No Title" }}';
const config = { title: '' };
const result = renderer.resolveTemplateVariables(template, config);
// Result: 'No Title'

// Linebreaks filter
const template = '{{ config.content|linebreaks }}';
const config = { content: 'Line 1\nLine 2' };
const result = renderer.resolveTemplateVariables(template, config);
// Result: 'Line 1<br>Line 2'

// Text transformation filters
const template = '{{ config.text|upper }}';
const config = { text: 'hello' };
const result = renderer.resolveTemplateVariables(template, config);
// Result: 'HELLO'
```

### Structure Processing

```javascript
const structure = {
  type: 'element',
  tag: 'div',
  classes: 'container {{ config.theme }}',
  children: [
    {
      type: 'template_text',
      content: 'Welcome {{ config.user.name|default:"Guest" }}!'
    }
  ]
};

const config = {
  theme: 'dark',
  user: { name: 'John' }
};

const element = renderer.processTemplateStructure(structure, config);
// Creates: <div class="container dark">Welcome John!</div>
```

### Conditional Logic

```javascript
const structure = {
  type: 'element',
  tag: 'div',
  condition: 'config.showElement',
  children: [
    {
      type: 'template_text',
      content: 'This shows conditionally'
    }
  ]
};

const config = { showElement: true };
const templateTags = ['if'];

const element = renderer.processTemplateStructureWithLogic(structure, config, templateTags);
// Element is rendered because condition is true
```

### Loop Processing

```javascript
const structure = {
  type: 'fragment',
  loop: {
    iterable: 'config.items',
    variable: 'item'
  },
  template: {
    type: 'element',
    tag: 'div',
    children: [
      {
        type: 'template_text',
        content: '{{ item.name }} - {{ forloop.counter }}'
      }
    ]
  }
};

const config = {
  items: [
    { name: 'Item 1' },
    { name: 'Item 2' },
    { name: 'Item 3' }
  ]
};

const templateTags = ['for'];
const fragment = renderer.processTemplateStructureWithLogic(structure, config, templateTags);
// Creates multiple div elements with item names and loop counters
```

## API Reference

### Core Methods

#### `resolveTemplateVariables(templateString, config)`
Resolves Django template variables in a string.

- **Parameters:**
  - `templateString` (string): String containing `{{ variable }}` patterns
  - `config` (Object): Configuration object containing variable values
- **Returns:** string with variables resolved

#### `applyTemplateFilters(value, expression)`
Applies Django template filters to a value.

- **Parameters:**
  - `value` (any): Value to filter
  - `expression` (string): Full expression with filters
- **Returns:** filtered value as string

#### `getNestedValue(obj, path)`
Safely accesses nested properties with prototype pollution protection.

- **Parameters:**
  - `obj` (Object): Object to search in
  - `path` (string): Dot-separated path
- **Returns:** value at path or undefined

#### `escapeHtml(text)`
Escapes HTML characters to prevent XSS attacks.

- **Parameters:**
  - `text` (string): Text to escape
- **Returns:** HTML-escaped text

### Structure Processing

#### `processTemplateStructure(structure, config)`
Main dispatcher method for processing template structures.

- **Parameters:**
  - `structure` (Object): Template structure object
  - `config` (Object): Configuration object
- **Returns:** HTMLElement, Text, or DocumentFragment

#### `processTemplateStructureWithLogic(structure, config, templateTags)`
Enhanced processing with conditional and loop support.

- **Parameters:**
  - `structure` (Object): Template structure object
  - `config` (Object): Configuration object  
  - `templateTags` (Array): Array of template tags used
- **Returns:** HTMLElement, Text, DocumentFragment, or null

### Template Logic

#### `evaluateCondition(condition, config)`
Evaluates conditional expressions for template logic.

- **Parameters:**
  - `condition` (string|Object): Condition to evaluate
  - `config` (Object): Configuration object
- **Returns:** boolean result

#### `processConditionalLogic(structure, config, templateTags)`
Processes conditional logic in template structures.

- **Parameters:**
  - `structure` (Object): Template structure with conditionals
  - `config` (Object): Configuration object
  - `templateTags` (Array): Template tags array
- **Returns:** Processed element or null

#### `processLoopLogic(structure, config, templateTags)`
Processes loop logic in template structures.

- **Parameters:**
  - `structure` (Object): Template structure with loops
  - `config` (Object): Configuration object
  - `templateTags` (Array): Template tags array
- **Returns:** DocumentFragment with loop iterations

### Utility Methods

#### `setDebugMode(enabled)`
Enables or disables debug mode for additional logging.

- **Parameters:**
  - `enabled` (boolean): Whether to enable debug mode

#### `isDevelopmentMode()`
Checks if the renderer is running in development mode.

- **Returns:** boolean indicating development mode

#### `getVersion()`
Gets the current version of the renderer.

- **Returns:** version string

## Supported Template Features

### Variable Substitution
- `{{ config.field }}` - Simple variable access
- `{{ config.nested.property }}` - Nested property access
- `{{ config.missing }}` - Graceful handling of missing variables

### Template Filters
- `|default:"fallback"` - Default value for empty/missing variables
- `|linebreaks` - Convert newlines to `<br>` tags
- `|safe` - Mark content as safe (no escaping)
- `|escape` - HTML escape content
- `|upper` - Convert to uppercase
- `|lower` - Convert to lowercase
- `|title` - Convert to title case
- `|length` - Get length of string or array

### Conditional Logic
- `{% if config.condition %}...{% endif %}` - Conditional rendering
- `config.field` - Simple field checks
- `not config.field` - Negation
- `config.field == "value"` - Equality comparison
- `config.field != "value"` - Inequality comparison

### Loop Logic
- `{% for item in config.items %}...{% endfor %}` - Iteration
- `{{ forloop.counter }}` - 1-based loop counter
- `{{ forloop.counter0 }}` - 0-based loop counter
- `{{ forloop.first }}` - First iteration flag
- `{{ forloop.last }}` - Last iteration flag
- `{{ forloop.length }}` - Total iterations

## Structure Types

### Element Structure
```javascript
{
  type: 'element',
  tag: 'div',                    // HTML tag name
  classes: 'class1 class2',      // CSS classes (can include variables)
  attributes: {                  // Static attributes
    id: 'element-id',
    'data-attr': 'value'
  },
  template_attributes: {         // Template attributes with variables
    href: { value: '{{ config.url }}' },
    title: { value: '{{ config.title }}' }
  },
  children: [...]               // Child structures
}
```

### Text Structure
```javascript
{
  type: 'template_text',
  content: 'Hello {{ config.name }}!'  // Text with variables
}

{
  type: 'text',
  content: 'Static text'               // Static text
}
```

### Fragment Structure
```javascript
{
  type: 'fragment',
  children: [...]                      // Multiple root elements
}
```

### Style Structure
```javascript
{
  type: 'style',
  css: '.widget { color: {{ config.color }}; }'  // CSS with variables
}
```

## Security Features

### XSS Protection
- All user input is automatically HTML-escaped
- Safe HTML rendering through DOM APIs
- Content sanitization for style elements

### Prototype Pollution Prevention
- Path validation blocks dangerous property access
- Prevents `__proto__`, `constructor`, `prototype` access
- Safe object traversal with own property checks

### Error Handling
- Graceful fallbacks for invalid templates
- Safe error elements for failed processing
- Comprehensive error logging and reporting

## Development Mode

Enable debug mode for enhanced logging:

```javascript
renderer.setDebugMode(true);

// Development mode is automatically detected based on:
// - localhost hostname
// - port 3000
// - debug=true in URL params
// - localStorage debug flag
```

## Testing

The renderer includes comprehensive unit tests covering:

- Variable substitution and filters
- Template logic (conditions and loops)
- Structure processing
- Error handling
- Security features
- Integration scenarios

Run tests:
```bash
npm test DjangoTemplateRenderer.test.js
```

## Performance Considerations

- **Caching**: Template structures are cached for repeated use
- **Lazy Processing**: Only processes templates when needed
- **Efficient DOM**: Uses native DOM APIs for optimal performance
- **Memory Management**: Proper cleanup and garbage collection

## Migration from LayoutRenderer

If migrating from the old `LayoutRenderer` approach:

```javascript
// Old approach
this.resolveTemplateVariables(template, config);
this.processTemplateStructure(structure, config);

// New approach
const renderer = new DjangoTemplateRenderer();
renderer.resolveTemplateVariables(template, config);
renderer.processTemplateStructure(structure, config);
```

The API is fully compatible - only the calling context changes.

## License

This module is part of the eceee_v4 content management system.