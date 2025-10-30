# ECEEE Widgets Package

This package contains ECEEE-specific widget implementations that correspond to the backend `easy_widgets` Django app.

## Purpose

This package provides **ECEEE-specific widgets** with their own namespace (`easy_widgets.*`). These widgets mirror the backend widget structure and can be used alongside or instead of default widgets.

## Structure

```
frontend/src/widgets/easy-widgets/
├── index.js                        # Main exports and registry
├── README.md                       # This file
├── eceeeContentWidget.jsx          # Content widget
├── eceeeImageWidget.jsx            # Image widget
├── eceeeTableWidget.jsx            # Table widget
├── eceeeHeaderWidget.jsx           # Header widget
├── eceeeNavigationWidget.jsx       # Navigation widget
├── eceeeSidebarWidget.jsx          # Sidebar widget
├── eceeeFormsWidget.jsx            # Forms widget
├── eceeeFooterWidget.jsx           # Footer widget (overrides default)
└── eceeeTwoColumnsWidget.jsx       # Two-column layout widget
```

## Architecture

### Widget Registration Pattern

```javascript
// Register a new ECEEE-specific widget
'easy_widgets.ContentWidget': registerWidget(eceeeContentWidget, 'easy_widgets.ContentWidget')

// Override a default widget (special case for Footer)
'default_widgets.FooterWidget': registerWidget(eceeeFooterWidget, 'default_widgets.FooterWidget')
```

## Available Widgets

### Content & Media
- **eceeeContentWidget** (`easy_widgets.ContentWidget`) - ECEEE-specific HTML content widget
- **eceeeImageWidget** (`easy_widgets.ImageWidget`) - Image widget with gallery and carousel support
- **eceeeTableWidget** (`easy_widgets.TableWidget`) - Table widget with configurable rows and columns

### Layout Widgets
- **eceeeHeaderWidget** (`easy_widgets.HeaderWidget`) - Header widget with background and styling
- **eceeeNavigationWidget** (`easy_widgets.NavigationWidget`) - Navigation widget with menus
- **eceeeSidebarWidget** (`easy_widgets.SidebarWidget`) - Sidebar widget with nested widget support
- **eceeeTwoColumnsWidget** (`easy_widgets.TwoColumnsWidget`) - Two-column layout with left/right slots

### Forms & Footer
- **eceeeFormsWidget** (`easy_widgets.FormsWidget`) - Form widget with schema-based fields
- **eceeeFooterWidget** (`default_widgets.FooterWidget` *override*) - ECEEE-branded footer

## Implementation Notes

- All ECEEE widgets are thin wrappers around default widgets, leveraging existing functionality
- They use the `easy_widgets.*` namespace to match the backend structure  
- The FooterWidget is a special case that overrides the default implementation
- Widgets automatically work with the Unified Data Context and support infinite nesting
- Configuration schemas are defined in the backend Pydantic models

## Usage

```jsx
// Widgets are automatically registered and available in the widget picker
import { ECEEE_WIDGET_REGISTRY } from './widgets/easy-widgets';

// The registry is integrated via WidgetRegistryManager - no manual setup needed
```

The widget registry is automatically integrated into the main widget system through `WidgetRegistryManager`. No manual registration is required. Simply select an ECEEE widget from the widget picker in the page editor.

## Backend Integration

These frontend widgets correspond 1:1 with the backend widgets in:
- `backend/easy_widgets/widgets/*.py`

Each widget's configuration is validated by Pydantic models co-located with the widget definitions on the backend.
