# Layout System

This directory contains the **layout system** that provides different page layout options. The layouts are organized into modular packages that can be extended or replaced.

## Architecture Overview

```
layouts/
├── default-layouts/        # Default layout implementations
│   ├── LayoutRegistry.jsx  # Layout definitions and registry
│   ├── WidgetSlot.jsx     # Shared slot component
│   └── index.js           # Package exports
└── index.js               # Main layout exports
```

## Default Layouts Package

### Available Layouts

- `SingleColumnLayout` - Simple single column for articles
- `SidebarLayout` - Main content with sidebar
- `ThreeColumnLayout` - Header, main content, and two sidebars
- `TwoColumnLayout` - Two equal columns
- `HeaderFooterLayout` - Header, main content, and footer

### Layout Structure

Each layout is a React component that receives:

```jsx
const MyLayout = ({ 
    widgets,           // Widget data for each slot
    onWidgetAction,    // Widget action handler
    editable = true,   // Whether slots are editable
    pageContext = {},  // Page context data
    onShowWidgetModal, // Show widget selection modal
    onClearSlot        // Clear slot handler
}) => {
    return (
        <div className="my-layout">
            <WidgetSlot
                name="main"
                label="Main Content"
                widgets={widgets.main || []}
                onWidgetAction={onWidgetAction}
                editable={editable}
                // ... other props
            />
        </div>
    )
}
```

### Layout Registry

Layouts are registered in `LayoutRegistry.jsx`:

```jsx
export const LAYOUT_REGISTRY = {
    'single_column': {
        component: SingleColumnLayout,
        displayName: 'Single Column',
        description: 'Simple single column layout',
        // ... metadata
    },
    // ... other layouts
}
```

## Usage

### Import from Main Package

```jsx
import { SingleColumnLayout, LAYOUT_REGISTRY } from '../../layouts'
```

### Import from Specific Package

```jsx
import { SingleColumnLayout } from '../../layouts/default-layouts'
```

### Registry Usage

```jsx
import { getLayoutComponent, layoutExists } from '../../layouts'

const LayoutComponent = getLayoutComponent('single_column')
const exists = layoutExists('single_column')
```

## Future Extension

This structure allows for future layout packages:

```
layouts/
├── default-layouts/     # Core defaults
├── eceee-layouts/      # ECEEE-specific layouts
├── custom-layouts/     # Custom layout packages  
└── third-party-layouts/ # Third-party packages
```

Each package can extend or replace the defaults, similar to the backend layout system.

## Migration Notes

The layouts have been moved from `editors/page-editor/layouts/` to `layouts/default-layouts/` to create a modular structure that matches the backend. All imports have been updated to maintain compatibility.
