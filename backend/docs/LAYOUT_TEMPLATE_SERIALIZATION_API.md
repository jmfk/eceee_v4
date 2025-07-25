# Layout Template Serialization API for React Editor

## Overview

This document describes the enhanced layout template serialization system that provides detailed JSON objects to instruct the React application on how to render layout templates in the editor.

## Key Components

### 1. Enhanced Layout Serializer

The `EnhancedLayoutSerializer` extends the base `LayoutSerializer` to provide comprehensive template analysis and editor-specific metadata.

#### Features:
- **Template Structure Analysis**: Parses HTML templates to extract element hierarchy, CSS classes, and slot positioning
- **Slot Hierarchy**: Provides detailed information about slot relationships and constraints  
- **CSS Analysis**: Detects CSS frameworks (Tailwind, Bootstrap, etc.) and extracts styling information
- **Editor Instructions**: Generates specific instructions for React editor rendering
- **Layout Constraints**: Defines widget limits, responsive behavior, and editing constraints
- **Accessibility Info**: Extracts accessibility metadata and compliance information
- **Validation Rules**: Provides validation constraints for editor operations

### 2. Template Parser

The `LayoutTemplateParser` class analyzes HTML layout templates and extracts detailed structural information:

```python
from webpages.template_parser import LayoutTemplateParser

# Initialize with a layout object
parser = LayoutTemplateParser(layout_obj)

# Extract different types of data
structure = parser.get_template_structure()
hierarchy = parser.get_slot_hierarchy()
css_analysis = parser.get_css_analysis()
instructions = parser.get_editor_instructions()
```

### 3. API Endpoints

#### Enhanced Editor Endpoints

**Single Layout Editor Data**
```
GET /api/code-layouts/{layout_name}/editor-data/
```

Returns comprehensive editor data for a specific layout:
```json
{
  "layout": {
    "name": "single_column",
    "description": "Single column layout...",
    "slot_configuration": {...},
    "editor_data": {
      "template_structure": {...},
      "slot_hierarchy": {...},
      "css_analysis": {...},
      "editor_instructions": {...},
      "constraints": {...},
      "responsive_breakpoints": {...},
      "accessibility_info": {...},
      "validation_rules": {...}
    }
  },
  "editor_meta": {
    "api_version": "v1",
    "optimized_for": "react_editor",
    "cache_duration": 300
  }
}
```

**All Layouts Editor Data**
```
GET /api/code-layouts/editor-list/
```

Returns editor data for all layouts:
```json
{
  "results": [
    {
      "name": "layout_name",
      "editor_data": {...}
    }
  ],
  "editor_meta": {
    "total_layouts": 6,
    "api_version": "v1",
    "optimized_for": "react_editor",
    "data_includes": [
      "template_structure",
      "slot_hierarchy", 
      "css_analysis",
      "editor_instructions"
    ]
  }
}
```

## Editor Data Structure

### Template Structure
```json
{
  "template_structure": {
    "root_element": {
      "tag": "div",
      "attributes": {...},
      "css_classes": ["container", "mx-auto"],
      "is_slot": false,
      "children": [...]
    },
    "template_type": "single_column",
    "framework_detected": "tailwind",
    "total_elements": 15,
    "slot_elements": 2,
    "parsing_metadata": {
      "template_name": "webpages/layouts/single_column.html",
      "parsed_successfully": true,
      "errors": []
    }
  }
}
```

### Slot Hierarchy
```json
{
  "slot_hierarchy": {
    "total_slots": 2,
    "slots": [
      {
        "index": 0,
        "name": "main",
        "parent_tag": "div",
        "parent_classes": ["container"],
        "siblings_count": 2,
        "nesting_level": 2,
        "grid_position": {
          "column_span": 1,
          "row_span": 1,
          "is_grid_item": false
        },
        "responsive_behavior": {
          "mobile": [],
          "tablet": [],
          "desktop": []
        }
      }
    ],
    "relationships": [
      {
        "slot1": "main",
        "slot2": "sidebar", 
        "relationship": "siblings",
        "container": "div"
      }
    ],
    "layout_pattern": "dual"
  }
}
```

### CSS Analysis
```json
{
  "css_analysis": {
    "framework": "tailwind",
    "layout_classes": ["flex", "grid", "container"],
    "responsive_classes": {
      "mobile": ["sm:block"],
      "tablet": ["md:flex"],
      "desktop": ["lg:grid"]
    },
    "spacing_classes": ["p-4", "m-2", "space-y-4"],
    "color_classes": ["bg-white", "text-gray-900"],
    "grid_system": {
      "uses_grid": true,
      "grid_containers": 1,
      "total_columns": 12,
      "responsive_grid": true
    }
  }
}
```

### Editor Instructions
```json
{
  "editor_instructions": {
    "rendering": {
      "container_setup": {...},
      "slot_rendering": {...},
      "responsive_handling": {...},
      "interaction_zones": {...}
    },
    "editing": {
      "drag_drop_zones": {...},
      "resize_handles": {...},
      "style_controls": {...},
      "constraint_warnings": {...}
    },
    "preview": {
      "device_breakpoints": {...},
      "zoom_levels": [0.5, 0.75, 1.0, 1.25, 1.5],
      "interaction_modes": ["edit", "preview", "responsive"]
    }
  }
}
```

### Layout Constraints
```json
{
  "constraints": {
    "slot_constraints": [
      {
        "slot_name": "main",
        "max_widgets": 5,
        "required": true,
        "widget_types": ["text", "image", "button"]
      }
    ],
    "layout_constraints": {
      "min_width": "320px",
      "max_width": null,
      "fixed_height": false,
      "responsive": true
    },
    "editor_constraints": {
      "allow_column_resize": false,
      "allow_slot_reorder": false,
      "allow_slot_add_remove": false,
      "allow_layout_modification": false
    }
  }
}
```

## React Editor Integration

### Using the API in React

```javascript
// Fetch layout editor data
const fetchLayoutData = async (layoutName) => {
  const response = await fetch(`/api/code-layouts/${layoutName}/editor-data/`);
  const data = await response.json();
  return data.layout;
};

// Use the data in your React component
const LayoutEditor = ({ layoutName }) => {
  const [layoutData, setLayoutData] = useState(null);
  
  useEffect(() => {
    fetchLayoutData(layoutName).then(setLayoutData);
  }, [layoutName]);
  
  if (!layoutData) return <div>Loading...</div>;
  
  const { editor_data } = layoutData;
  
  return (
    <div>
      {/* Render template structure */}
      <TemplateRenderer structure={editor_data.template_structure} />
      
      {/* Render slot hierarchy */}
      <SlotHierarchy hierarchy={editor_data.slot_hierarchy} />
      
      {/* Apply CSS analysis */}
      <StyleManager analysis={editor_data.css_analysis} />
      
      {/* Follow editor instructions */}
      <EditorControls instructions={editor_data.editor_instructions} />
    </div>
  );
};
```

### Template Rendering

The React editor can use the template structure to render an editable representation:

```javascript
const TemplateRenderer = ({ structure }) => {
  const { root_element, framework_detected } = structure;
  
  return (
    <div className={`editor-template framework-${framework_detected}`}>
      <ElementRenderer element={root_element} />
    </div>
  );
};

const ElementRenderer = ({ element }) => {
  const { tag, attributes, css_classes, is_slot, slot_info, children } = element;
  
  if (is_slot) {
    return (
      <SlotRenderer 
        name={slot_info.name}
        title={slot_info.title}
        constraints={slot_info.constraints}
        classes={css_classes}
      />
    );
  }
  
  return React.createElement(
    tag,
    {
      className: css_classes.join(' '),
      ...attributes
    },
    children?.map((child, idx) => (
      <ElementRenderer key={idx} element={child} />
    ))
  );
};
```

### Slot Management

```javascript
const SlotRenderer = ({ name, title, constraints, classes }) => {
  const [widgets, setWidgets] = useState([]);
  
  const canAddWidget = () => {
    if (constraints.max_widgets === null) return true;
    return widgets.length < constraints.max_widgets;
  };
  
  return (
    <div 
      className={`slot-container ${classes.join(' ')}`}
      data-slot-name={name}
    >
      <div className="slot-header">
        <h4>{title}</h4>
        {canAddWidget() && (
          <button onClick={addWidget}>Add Widget</button>
        )}
      </div>
      
      <div className="slot-content">
        {widgets.map(widget => (
          <WidgetRenderer key={widget.id} widget={widget} />
        ))}
        
        {widgets.length === 0 && (
          <div className="slot-placeholder">
            Drop widgets here
          </div>
        )}
      </div>
    </div>
  );
};
```

## Layout Type Inference

The system automatically infers layout types and provides recommendations:

```json
{
  "layout_type": "single_column",
  "slot_summary": {
    "total_slots": 2,
    "slots": [
      {
        "name": "main",
        "title": "Main Content",
        "position": 0,
        "is_required": true,
        "accepts_all_widgets": true
      }
    ]
  },
  "editor_metadata": {
    "complexity_level": "basic",
    "recommended_use_cases": [
      "blog_posts",
      "articles", 
      "simple_pages"
    ],
    "is_responsive": true
  }
}
```

## Error Handling

The system provides graceful fallbacks when template parsing fails:

```json
{
  "editor_data": {
    "layout_type": "custom",
    "slot_summary": {
      "total_slots": 1,
      "slots": [...]
    },
    "editor_metadata": {
      "template_file": "webpages/layouts/custom.html",
      "complexity_level": "basic",
      "parsing_errors": [
        "Template loading error: File not found"
      ]
    },
    "basic_structure": {
      "container_classes": "layout-custom",
      "slot_layout": "single",
      "hierarchy": "flat"
    }
  }
}
```

## Performance Considerations

### Caching
- Editor data is cached for 5 minutes (300 seconds)
- Cache keys are layout-specific
- Use `Cache-Control` headers for client-side caching

### Optimization
- Template parsing is done on-demand
- Fallback to basic analysis if full parsing fails
- Minimal context used for template rendering

### Rate Limiting
- Standard rate limiting applies to all endpoints
- Editor-specific rate limiting for intensive operations

## Testing

The system includes comprehensive tests covering:

- Template parser functionality
- Serializer behavior with and without editor data
- API endpoint responses
- Error handling and fallbacks
- Layout type inference
- CSS framework detection

Run tests with:
```bash
docker-compose exec backend python manage.py test webpages.tests_layout_editor_api
```

## Future Enhancements

### Planned Features
1. **Custom CSS Analysis**: Enhanced CSS parsing with custom property detection
2. **Interactive Preview**: Real-time preview updates in the editor
3. **Layout Validation**: Advanced validation rules for layout modifications
4. **Accessibility Scoring**: Comprehensive accessibility analysis and scoring
5. **Performance Metrics**: Template rendering performance analysis

### API Versioning
The API supports versioning through the `api_version` parameter:
- Current version: `v1`
- Backwards compatibility maintained
- Version-specific features documented

## Conclusion

The enhanced layout template serialization API provides a comprehensive foundation for React editor integration. It delivers detailed structural, styling, and behavioral information that enables sophisticated page editing capabilities while maintaining performance and reliability. 