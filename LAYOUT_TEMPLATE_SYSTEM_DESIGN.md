# HTML Template-Based Layout System Design

## Overview

This document outlines the design for enhancing the eceee_v4 layout system to support HTML template-based layouts with CSS and design elements, transferred via JSON API to React for rendering with React component widgets.

## Current State

- **Backend**: Code-based layouts with slot configurations
- **Frontend**: React-based page editor with layout selection
- **Templates**: Basic template system but actual templates don't exist
- **Widget System**: React components for widgets with SlotManager

## Goals

1. **Define layouts using HTML templates** on the backend
2. **Include CSS and design elements** in templates
3. **Transfer via JSON API** to frontend
4. **Render in React** while supporting React component widgets
5. **Maintain security** and performance standards

## Technical Architecture

### 1. Backend Template System

#### Template Format
```html
<!-- backend/templates/webpages/layouts/hero_sidebar.html -->
<div class="hero-sidebar-layout">
  <style scoped>
    .hero-sidebar-layout {
      display: grid;
      grid-template-areas: 
        "hero hero"
        "content sidebar"
        "footer footer";
      grid-template-columns: 2fr 1fr;
      gap: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem;
    }
    
    .hero-slot {
      grid-area: hero;
      min-height: 400px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      padding: 2rem;
      color: white;
    }
    
    .content-slot {
      grid-area: content;
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .sidebar-slot {
      grid-area: sidebar;
      background: #f8f9fa;
      border-radius: 8px;
      padding: 1.5rem;
    }
    
    .footer-slot {
      grid-area: footer;
      text-align: center;
      padding: 1rem;
      margin-top: 2rem;
      border-top: 1px solid #e9ecef;
    }
    
    @media (max-width: 768px) {
      .hero-sidebar-layout {
        grid-template-areas: 
          "hero"
          "content"
          "sidebar"
          "footer";
        grid-template-columns: 1fr;
      }
    }
  </style>
  
  <section class="hero-slot" data-widget-slot="hero" data-slot-title="Hero Section" data-slot-description="Main hero banner with call-to-action" data-slot-max-widgets="1">
    <!-- React widgets will be portaled here -->
    <div class="slot-placeholder">Hero content goes here</div>
  </section>
  
  <main class="content-slot" data-widget-slot="content" data-slot-title="Main Content" data-slot-description="Primary page content area">
    <div class="slot-placeholder">Main content goes here</div>
  </main>
  
  <aside class="sidebar-slot" data-widget-slot="sidebar" data-slot-title="Sidebar" data-slot-description="Complementary content and widgets" data-slot-max-widgets="5">
    <div class="slot-placeholder">Sidebar content goes here</div>
  </aside>
  
  <footer class="footer-slot" data-widget-slot="footer" data-slot-title="Footer" data-slot-description="Page footer content" data-slot-max-widgets="2">
    <div class="slot-placeholder">Footer content goes here</div>
  </footer>
</div>
```

#### Enhanced BaseLayout Class
```python
class TemplateBasedLayout(BaseLayout):
    """
    Enhanced layout class supporting HTML templates with automatic slot parsing
    """
    
    # Template file path (relative to templates directory)
    template_file: str = None
    
    # CSS file path (optional, can use inline CSS in template)
    css_file: str = None
    
    def __init__(self):
        super().__init__()
        if self.template_file:
            self._parse_template()
    
    def _parse_template(self):
        """Parse HTML template to extract slots and CSS"""
        template_content = self._load_template_content()
        self._extracted_html = self._extract_html(template_content)
        self._extracted_css = self._extract_css(template_content)
        self._parsed_slots = self._parse_slots(template_content)
    
    def _load_template_content(self) -> str:
        """Load template file content"""
        template = get_template(self.template_file)
        return template.template.source
    
    def _extract_html(self, content: str) -> str:
        """Extract HTML content, removing <style> tags"""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(content, 'html.parser')
        
        # Remove style tags (they'll be handled separately)
        for style_tag in soup.find_all('style'):
            style_tag.decompose()
            
        return str(soup)
    
    def _extract_css(self, content: str) -> str:
        """Extract CSS from <style> tags"""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(content, 'html.parser')
        
        css_content = []
        for style_tag in soup.find_all('style'):
            css_content.append(style_tag.get_text())
            
        return '\n'.join(css_content)
    
    def _parse_slots(self, content: str) -> List[Dict]:
        """Parse widget slots from data-widget-slot attributes"""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(content, 'html.parser')
        
        slots = []
        slot_elements = soup.find_all(attrs={'data-widget-slot': True})
        
        for element in slot_elements:
            slot_name = element.get('data-widget-slot')
            slot_data = {
                'name': slot_name,
                'title': element.get('data-slot-title', slot_name.title()),
                'description': element.get('data-slot-description', ''),
                'max_widgets': self._parse_max_widgets(element.get('data-slot-max-widgets')),
                'css_classes': element.get('class', []),
                'selector': f'[data-widget-slot="{slot_name}"]'
            }
            slots.append(slot_data)
            
        return slots
    
    def _parse_max_widgets(self, value) -> Optional[int]:
        """Parse max widgets attribute"""
        if value is None:
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            return None
    
    @property
    def slot_configuration(self) -> Dict[str, Any]:
        """Return slot configuration (implementation of abstract method)"""
        if hasattr(self, '_parsed_slots'):
            return {"slots": self._parsed_slots}
        return {"slots": []}
    
    def to_dict(self) -> Dict[str, Any]:
        """Enhanced dictionary representation including template data"""
        base_dict = super().to_dict()
        
        if hasattr(self, '_extracted_html'):
            base_dict.update({
                'html': self._extracted_html,
                'css': self._extracted_css,
                'template_file': self.template_file,
                'parsed_slots_count': len(self._parsed_slots) if hasattr(self, '_parsed_slots') else 0,
                'has_css': bool(self._extracted_css),
                'template_based': True
            })
            
        return base_dict
```

### 2. API Enhancement

#### Enhanced API Response Format
```json
{
  "name": "hero_sidebar",
  "description": "Hero section with content and sidebar",
  "type": "code",
  "template_based": true,
  "html": "<div class='hero-sidebar-layout'>...</div>",
  "css": ".hero-sidebar-layout { display: grid; ... }",
  "template_file": "webpages/layouts/hero_sidebar.html",
  "slot_configuration": {
    "slots": [
      {
        "name": "hero",
        "title": "Hero Section",
        "description": "Main hero banner with call-to-action",
        "max_widgets": 1,
        "css_classes": ["hero-slot"],
        "selector": "[data-widget-slot='hero']"
      },
      {
        "name": "content",
        "title": "Main Content",
        "description": "Primary page content area",
        "max_widgets": null,
        "css_classes": ["content-slot"],
        "selector": "[data-widget-slot='content']"
      },
      {
        "name": "sidebar",
        "title": "Sidebar", 
        "description": "Complementary content and widgets",
        "max_widgets": 5,
        "css_classes": ["sidebar-slot"],
        "selector": "[data-widget-slot='sidebar']"
      },
      {
        "name": "footer",
        "title": "Footer",
        "description": "Page footer content", 
        "max_widgets": 2,
        "css_classes": ["footer-slot"],
        "selector": "[data-widget-slot='footer']"
      }
    ]
  },
  "meta": {
    "parsed_slots_count": 4,
    "has_css": true,
    "responsive": true,
    "last_modified": "2025-01-20T10:30:00Z"
  }
}
```

### 3. Frontend React Integration

#### LayoutRenderer Component
```jsx
import React, { useRef, useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import DOMPurify from 'dompurify'

const LayoutRenderer = ({ layout, widgets = {}, className = '' }) => {
  const containerRef = useRef()
  const [slotElements, setSlotElements] = useState({})
  const [cssInjected, setCssInjected] = useState(false)

  // Sanitize HTML content
  const sanitizedHTML = DOMPurify.sanitize(layout.html, {
    ALLOWED_TAGS: ['div', 'section', 'main', 'aside', 'header', 'footer', 'article', 'nav', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'img'],
    ALLOWED_ATTR: ['class', 'id', 'data-widget-slot', 'data-slot-title', 'data-slot-description', 'data-slot-max-widgets'],
    KEEP_CONTENT: true,
    ALLOW_DATA_ATTR: true
  })

  // Inject CSS
  useEffect(() => {
    if (layout.css && !cssInjected) {
      const styleId = `layout-style-${layout.name}`
      
      // Remove existing style element
      const existingStyle = document.getElementById(styleId)
      if (existingStyle) {
        existingStyle.remove()
      }

      // Create new style element
      const styleElement = document.createElement('style')
      styleElement.id = styleId
      styleElement.textContent = layout.css
      document.head.appendChild(styleElement)
      
      setCssInjected(true)

      // Cleanup function
      return () => {
        const styleToRemove = document.getElementById(styleId)
        if (styleToRemove) {
          styleToRemove.remove()
        }
      }
    }
  }, [layout.css, layout.name, cssInjected])

  // Find and map slot elements
  useEffect(() => {
    if (containerRef.current) {
      const slots = {}
      
      layout.slot_configuration?.slots?.forEach(slot => {
        const element = containerRef.current.querySelector(slot.selector)
        if (element) {
          // Clear placeholder content
          element.innerHTML = ''
          slots[slot.name] = element
        }
      })
      
      setSlotElements(slots)
    }
  }, [layout, sanitizedHTML])

  return (
    <div className={`layout-renderer ${className}`}>
      {/* Render layout HTML structure */}
      <div 
        ref={containerRef}
        dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
      />
      
      {/* Portal widgets into slots */}
      {Object.entries(slotElements).map(([slotName, element]) => 
        widgets[slotName]?.map((widget, index) => 
          ReactDOM.createPortal(
            <WidgetWrapper 
              key={`${widget.id}-${index}`}
              widget={widget}
              slotName={slotName}
            />,
            element
          )
        )
      )}
    </div>
  )
}

const WidgetWrapper = ({ widget, slotName }) => {
  return (
    <div 
      className="widget-wrapper"
      data-widget-id={widget.id}
      data-widget-type={widget.type}
      data-slot={slotName}
    >
      <WidgetComponent {...widget} />
    </div>
  )
}

export default LayoutRenderer
```

#### Enhanced SlotManager Integration
```jsx
const SlotManager = ({ pageId, layout, onWidgetChange }) => {
  // ... existing code ...

  // Render with new LayoutRenderer if template-based
  if (layout?.template_based) {
    return (
      <div className="slot-manager-container">
        <LayoutRenderer 
          layout={layout}
          widgets={widgetsBySlot}
        />
        
        {/* Widget management controls overlay */}
        <WidgetManagementOverlay
          layout={layout}
          widgets={widgetsBySlot}
          onAddWidget={handleAddWidget}
          onEditWidget={handleEditWidget}
          onDeleteWidget={handleDeleteWidget}
        />
      </div>
    )
  }

  // Fall back to existing slot-based rendering
  return (
    <div className="layout-slots">
      {/* ... existing slot rendering code ... */}
    </div>
  )
}
```

### 4. Security Considerations

#### HTML Sanitization
- Use DOMPurify to sanitize HTML content
- Whitelist allowed tags and attributes
- Strip script tags and event handlers
- Validate data attributes

#### CSS Safety
- Sanitize CSS content to prevent injection
- Use CSS-in-JS or scoped styles when possible
- Validate CSS properties and values
- Strip dangerous CSS functions (url(), expression(), etc.)

#### Template Validation
- Validate template syntax before parsing
- Check for required slot markers
- Ensure proper HTML structure
- Verify CSS validity

### 5. Performance Optimization

#### Caching Strategy
- Cache parsed template data on backend
- Cache layout API responses on frontend
- Use React.memo for LayoutRenderer
- Implement lazy loading for large templates

#### Rendering Optimization
- Use React Portals efficiently
- Minimize DOM manipulations
- Debounce widget updates
- Implement virtual scrolling for large widget lists

## Implementation Phases

### Phase 1: Backend Foundation
1. Create TemplateBasedLayout class
2. Implement template parsing system
3. Create sample layout templates
4. Enhance API endpoints

### Phase 2: Frontend Renderer
1. Create LayoutRenderer component
2. Implement CSS injection system
3. Add HTML sanitization
4. Create widget portal system

### Phase 3: Integration
1. Update SlotManager for template-based layouts
2. Enhance LayoutSelector for template preview
3. Add layout editing tools
4. Create migration utilities

### Phase 4: Testing & Polish
1. Create comprehensive test suite
2. Add performance monitoring
3. Implement security auditing
4. Create documentation and examples

## Example Layout Templates

### 1. Hero Layout
```html
<!-- hero_layout.html -->
<div class="hero-layout">
  <style scoped>
    .hero-layout {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .hero-section {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      padding: 4rem 2rem;
    }
    .content-section {
      padding: 3rem 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
  </style>
  
  <section class="hero-section" data-widget-slot="hero" data-slot-title="Hero Section" data-slot-max-widgets="1">
  </section>
  
  <main class="content-section" data-widget-slot="content" data-slot-title="Main Content">
  </main>
</div>
```

### 2. Grid Dashboard Layout
```html
<!-- grid_dashboard.html -->
<div class="grid-dashboard">
  <style scoped>
    .grid-dashboard {
      display: grid;
      grid-template-areas:
        "header header header"
        "sidebar main metrics"
        "sidebar main metrics"
        "footer footer footer";
      grid-template-columns: 250px 1fr 300px;
      grid-template-rows: auto 1fr 1fr auto;
      min-height: 100vh;
      gap: 1rem;
      padding: 1rem;
    }
    .header-area { grid-area: header; background: #f8f9fa; border-radius: 8px; padding: 1rem; }
    .sidebar-area { grid-area: sidebar; background: white; border-radius: 8px; padding: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .main-area { grid-area: main; background: white; border-radius: 8px; padding: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .metrics-area { grid-area: metrics; background: white; border-radius: 8px; padding: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .footer-area { grid-area: footer; background: #f8f9fa; border-radius: 8px; padding: 1rem; text-align: center; }
  </style>
  
  <header class="header-area" data-widget-slot="header" data-slot-title="Header" data-slot-max-widgets="3"></header>
  <aside class="sidebar-area" data-widget-slot="sidebar" data-slot-title="Sidebar Navigation" data-slot-max-widgets="5"></aside>
  <main class="main-area" data-widget-slot="main" data-slot-title="Main Content"></main>
  <section class="metrics-area" data-widget-slot="metrics" data-slot-title="Metrics Panel" data-slot-max-widgets="4"></section>
  <footer class="footer-area" data-widget-slot="footer" data-slot-title="Footer" data-slot-max-widgets="2"></footer>
</div>
```

## Benefits

1. **Designer-Friendly**: Layouts can be designed in HTML/CSS by designers
2. **Flexible**: Supports any CSS layout system (Grid, Flexbox, etc.)
3. **React Integration**: Seamlessly integrates React widgets
4. **Performance**: Efficient rendering with minimal re-renders
5. **Security**: Proper sanitization and validation
6. **Maintainable**: Clear separation between layout and logic

## Migration Strategy

1. **Backward Compatibility**: Existing layouts continue to work
2. **Gradual Migration**: Convert layouts one by one
3. **Fallback System**: Fall back to old system if template fails
4. **Development Tools**: Provide tools to help migration

This design provides a comprehensive solution that meets all your requirements while maintaining security, performance, and developer experience standards. 