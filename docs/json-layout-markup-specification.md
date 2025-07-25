# JSON Layout Markup Specification

## Overview

A JSON-based format for serializing Django HTML templates with widget slots for rendering by a custom React renderer. This format preserves HTML structure, CSS classes, Django template variables, and widget slot definitions.

## Django Template Format

### Basic Structure

Django templates use standard HTML elements with special slot definitions:

```django
{% load webpages_tags %}

<div class="container mx-auto p-6">
  <!-- Regular HTML elements -->
  <header class="bg-white shadow-md p-4">
    <h1 class="text-2xl font-bold">{{ page.title }}</h1>
    
    <!-- Slot definition: div with data attributes + render tag -->
    <div class="mt-4 border rounded p-4" id="nav-container"
         data-widget-slot="navigation"
         data-slot-title="Main Navigation"
         data-slot-description="Primary site navigation menu"
         data-slot-max-widgets="3">
      {# default:[{"type": "menu", "config": {"items": ["Home", "About", "Contact"]}}] #}
      {% render_slot "navigation" %}
    </div>
  </header>
  
  <!-- Nested structure with multiple slots -->
  <main class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
    <article class="md:col-span-2 bg-white rounded-lg p-6">
      <div data-widget-slot="content"
           data-slot-title="Main Content"
           data-slot-description="Primary page content and articles">
        {# default:[
           {"type": "text", "config": {"content": "Welcome to our site"}},
           {"type": "image", "config": {"url": "/static/hero.jpg", "alt": "Hero image"}}
        ] #}
        {% render_slot "content" %}
      </div>
    </article>
    
    <aside class="bg-gray-50 rounded-lg p-6">
      <div data-widget-slot="sidebar"
           data-slot-title="Sidebar"
           data-slot-description="Complementary content and widgets"
           data-slot-max-widgets="5">
        {# default:[{"type": "recent_posts", "config": {"count": 5}}] #}
        {% render_slot "sidebar" %}
      </div>
    </aside>
  </main>
</div>
```

### Slot Definition Rules

1. **Slot Container**: Any HTML element with `data-widget-slot` attribute
2. **Required Attributes**:
   - `data-widget-slot`: Unique slot identifier
   - `data-slot-title`: Human-readable slot name
3. **Optional Attributes**:
   - `data-slot-description`: Description of slot purpose
   - `data-slot-max-widgets`: Maximum widgets allowed (integer)
4. **Slot Rendering**: `{% render_slot "slot_name" %}` tag inside the container
5. **No Children**: Slot elements cannot have any other children besides `{% render_slot %}`

### Default Widget Configuration

Default widgets for slots are defined using Django template comments placed inside the slot element:

```django
<div data-widget-slot="navigation"
     data-slot-title="Main Navigation"
     data-slot-max-widgets="3">
  {# default:[
     {"type": "menu", "config": {"items": ["Home", "About"]}},
     {"type": "search", "config": {"placeholder": "Search..."}}
  ] #}
  {% render_slot "navigation" %}
</div>
```

**Format Rules**:
- Must be within Django comment block `{# ... #}` inside the slot element
- Comment starts with `default:` followed by JSON array
- Widget list is JSON array format
- Each widget has `type` and `config` properties
- Comment must be placed before the `{% render_slot %}` tag

### Django Template Tags

#### `{% render_slot "slot_name" %}`
- **Purpose**: Renders widgets assigned to the specified slot or default widgets if none assigned
- **Django Output**: Actual widget HTML content
- **JSON Parsing**: Slot element terminates here with no children

## JSON Serialization Format

### Schema Overview

The JSON format represents a tree structure where each node can be:
- **Element node**: HTML element with tag, attributes, classes, children
- **Text node**: Text content (including Django variables)
- **Slot render node**: Widget slot rendering point

### Node Types

#### Element Node
```json
{
  "type": "element",
  "tag": "div",
  "classes": "container mx-auto p-6",
  "attributes": {
    "id": "main-container",
    "data-custom": "value"
  },
  "children": [...]
}
```

**Properties**:
- `type`: Always `"element"`
- `tag`: HTML tag name (string)
- `classes`: CSS classes (string, optional)
- `attributes`: HTML attributes object (optional, excludes widget slot attributes)
- `children`: Array of child nodes (optional)

#### Slot Element Node
```json
{
  "type": "slot",
  "tag": "div",
  "classes": "mt-4 border rounded p-4",
  "attributes": {
    "id": "nav-container"
  },
  "slot": {
    "name": "navigation",
    "title": "Main Navigation",
    "description": "Primary site navigation menu",
    "maxWidgets": 3,
    "defaultWidgets": [
      {
        "type": "menu",
        "config": {"items": ["Home", "About", "Contact"]}
      }
    ]
  }
}
```

**Properties**:
- `type`: Always `"slot"`
- `tag`: HTML tag name (string)
- `classes`: CSS classes (string, optional)
- `attributes`: HTML attributes object (optional, excludes widget slot attributes)
- `slot`: Slot metadata object (required)
  - `name`: Slot identifier (string)
  - `title`: Human-readable title (string)
  - `description`: Slot description (string, optional)
  - `maxWidgets`: Maximum widgets allowed (number, optional)
  - `defaultWidgets`: Array of default widget definitions (optional)

#### Text Node
```json
{
  "type": "text",
  "content": "Hello {{ user.name }}"
}
```

**Properties**:
- `type`: Always `"text"`
- `content`: Text content including Django template variables


### Complete Example

**Django Template**:
```django
<div class="min-h-screen bg-gray-50">
  <div class="regular-element p-4">
    <h1>{{ page.title }}</h1>
  </div>
  
  <div class="bg-white shadow p-6" id="header-container"
       data-widget-slot="header"
       data-slot-title="Page Header"
       data-slot-max-widgets="2">
    {# default:[{"type": "navigation", "config": {"style": "horizontal"}}] #}
    {% render_slot "header" %}
  </div>
</div>
```

**JSON Output**:
```json
{
  "type": "element",
  "tag": "div",
  "classes": "min-h-screen bg-gray-50",
  "children": [
    {
      "type": "element",
      "tag": "div",
      "classes": "regular-element p-4",
      "children": [
        {
          "type": "element",
          "tag": "h1",
          "children": [
            {
              "type": "text",
              "content": "{{ page.title }}"
            }
          ]
        }
      ]
    },
    {
      "type": "slot",
      "tag": "div",
      "classes": "bg-white shadow p-6",
      "attributes": {
        "id": "header-container"
      },
      "slot": {
        "name": "header",
        "title": "Page Header",
        "maxWidgets": 2,
        "defaultWidgets": [
          {
            "type": "navigation",
            "config": {"style": "horizontal"}
          }
        ]
      }
    }
  ]
}
```

## Custom React Renderer

### Overview

The custom renderer receives JSON layout data and renders directly to a DOM element using a React ref, bypassing React's virtual DOM for the layout structure.

### Renderer Interface

```typescript
interface LayoutRenderer {
  render(jsonLayout: LayoutNode, targetRef: React.RefObject<HTMLElement>): void;
  destroy(): void;
  updateSlot(slotName: string, widgets: Widget[]): void;
}

interface LayoutNode {
  type: 'element' | 'text' | 'slot';
  // ... properties based on node type
}

interface SlotNode extends LayoutNode {
  type: 'slot';
  tag: string;
  classes?: string;
  attributes?: Record<string, string>;
  slot: {
    name: string;
    title: string;
    description?: string;
    maxWidgets?: number;
    defaultWidgets?: DefaultWidget[];
  };
}

interface DefaultWidget {
  type: string;
  config: Record<string, any>;
}
```

### React Component Usage

```tsx
import { useRef, useEffect } from 'react';
import { LayoutRenderer } from './LayoutRenderer';

function CustomLayoutComponent({ layoutJson, widgets }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<LayoutRenderer>();

  useEffect(() => {
    if (containerRef.current && layoutJson) {
      // Initialize renderer
      rendererRef.current = new LayoutRenderer();
      
      // Render layout to DOM element (bypassing React)
      rendererRef.current.render(layoutJson, containerRef);
      
      // Cleanup function
      return () => {
        rendererRef.current?.destroy();
      };
    }
  }, [layoutJson]);

  useEffect(() => {
    // Update widgets when they change
    if (rendererRef.current && widgets) {
      Object.entries(widgets).forEach(([slotName, slotWidgets]) => {
        rendererRef.current.updateSlot(slotName, slotWidgets);
      });
    }
  }, [widgets]);

  return <div ref={containerRef} className="layout-container" />;
}
```

### Renderer Implementation Strategy

#### 1. DOM Element Creation
```typescript
private createElement(node: ElementNode): HTMLElement {
  const element = document.createElement(node.tag);
  
  // Apply CSS classes
  if (node.classes) {
    element.className = node.classes;
  }
  
  // Apply attributes
  if (node.attributes) {
    Object.entries(node.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }
  
  return element;
}
```

#### 2. Text Node Handling
```typescript
private createTextNode(node: TextNode): Text {
  // Process Django template variables if needed
  const content = this.processDjangoVariables(node.content);
  return document.createTextNode(content);
}
```

#### 3. Slot Rendering
```typescript
private createSlotElement(node: SlotNode): HTMLElement {
  const element = document.createElement(node.tag);
  
  // Apply classes and attributes (excluding widget slot attributes)
  if (node.classes) {
    element.className = node.classes;
  }
  
  if (node.attributes) {
    Object.entries(node.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }
  
  // Add slot identification for widget updates
  element.setAttribute('data-slot-name', node.slot.name);
  
  // Register slot for widget updates
  this.slotContainers.set(node.slot.name, element);
  
  // Render default widgets if no widgets assigned
  this.renderSlotContent(element, node.slot);
  
  return element;
}

private renderSlotContent(container: HTMLElement, slotConfig: SlotNode['slot']): void {
  // This will be called initially with default widgets
  // and later updated via updateSlot method
  if (slotConfig.defaultWidgets) {
    slotConfig.defaultWidgets.forEach(widget => {
      const widgetElement = this.renderWidget(widget);
      container.appendChild(widgetElement);
    });
  }
}

public updateSlot(slotName: string, widgets: Widget[]): void {
  const container = this.slotContainers.get(slotName);
  if (container) {
    // Clear existing content
    container.innerHTML = '';
    
    // Render new widgets or fall back to defaults
    if (widgets.length > 0) {
      widgets.forEach(widget => {
        const widgetElement = this.renderWidget(widget);
        container.appendChild(widgetElement);
      });
    } else {
      // No widgets assigned, render defaults if any
      const slotConfig = this.getSlotConfig(slotName);
      if (slotConfig?.defaultWidgets) {
        this.renderSlotContent(container, slotConfig);
      }
    }
  }
}
```

#### 4. Complete Rendering Process
```typescript
public render(layout: LayoutNode, targetRef: React.RefObject<HTMLElement>): void {
  if (!targetRef.current) return;
  
  // Clear existing content
  targetRef.current.innerHTML = '';
  
  // Render layout tree
  const rootElement = this.renderNode(layout);
  targetRef.current.appendChild(rootElement);
}

private renderNode(node: LayoutNode): Node {
  switch (node.type) {
    case 'element':
      return this.renderElement(node as ElementNode);
    case 'text':
      return this.createTextNode(node as TextNode);
    case 'slot':
      return this.createSlotElement(node as SlotNode);
    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}
```

### Key Benefits

1. **Performance**: Direct DOM manipulation bypasses React's reconciliation
2. **Flexibility**: Can handle any HTML structure from Django templates
3. **Consistency**: Same layout renders identically in Django and React
4. **Widget Management**: Slots can be updated independently without re-rendering entire layout
5. **Django Integration**: Preserves template variables and logic for server-side rendering