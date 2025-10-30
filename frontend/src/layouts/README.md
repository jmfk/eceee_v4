# Layout System

This directory contains the **layout system** that provides different page layout options. The layouts are organized into modular packages that can be extended or replaced.

## Architecture Overview

```
layouts/
├── easy-layouts/         # ECEEE layout implementations
│   ├── LayoutRegistry.jsx # Layout definitions and registry
│   ├── WidgetSlot.jsx     # Shared slot component
│   ├── MainLayout.jsx     # Main layout component
│   ├── LandingPage.jsx    # Landing page layout
│   └── index.js           # Package exports
└── index.js               # Main layout exports
```

## ECEEE Layouts Package

### Available Layouts

- `MainLayout` - Main application layout with header, navigation, content, and footer areas
- `LandingPage` - Landing page layout with hero, features, and call-to-action sections

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
                widgets={widgets}
                onWidgetAction={onWidgetAction}
                editable={editable}
                pageContext={pageContext}
                // ... other props
            />
        </div>
    )
}
```

### Layout Registry

Layouts are registered in `LayoutRegistry.jsx`:

```jsx
export const ECEEE_LAYOUT_REGISTRY = {
    'easy_layouts.MainLayout': {
        component: MainLayout,
        displayName: 'Main Layout',
        description: 'Main application layout with header, navigation, and footer',
        // ... metadata
    },
    // ... other layouts
}
```

## Usage

### Import from Main Package

```jsx
import { MainLayout, LAYOUT_REGISTRY } from '../../layouts'
```

### Import from Specific Package

```jsx
import { MainLayout } from '../../layouts/easy-layouts'
```

### Registry Usage

```jsx
import { getLayoutComponent, layoutExists } from '../../layouts'

const LayoutComponent = getLayoutComponent('easy_layouts.MainLayout')
const exists = layoutExists('easy_layouts.MainLayout')
```

## WidgetSlot Component

The `WidgetSlot` component is the core component for rendering widget areas within layouts. It provides:

- Widget rendering with factory pattern
- Editable and preview modes
- Widget inheritance support
- Slot-level controls (add, clear, preview)
- Empty slot states with "add widget" prompts

### WidgetSlot Props

```jsx
<WidgetSlot
    name="main"                    // Slot identifier
    label="Main Content"           // Display label
    description="Main content area" // Description
    widgets={widgets}              // Widget data object
    onWidgetAction={handleAction}  // Widget action handler
    editable={true}                // Enable editing
    pageContext={context}          // Page context
    onShowWidgetModal={showModal}  // Widget selection modal
    onClearSlot={clearSlot}        // Clear slot handler
    allowedWidgetTypes={['*']}     // Allowed widget types
    maxWidgets={20}                // Max widgets in slot
    slotType="content"             // 'content' or 'inherited'
    widgetPath={[]}                // Path for nested widgets
    inheritedWidgets={{}}          // Inherited widgets from parent
    slotInheritanceRules={{}}      // Inheritance rules
/>
```

## Future Extension

This structure allows for future layout packages:

```
layouts/
├── easy-layouts/      # ECEEE-specific layouts (current)
├── custom-layouts/     # Custom layout packages  
└── third-party-layouts/ # Third-party packages
```

Each package can extend or replace existing layouts through the registry system.

## Migration Notes

The default-layouts package has been removed from the system. All layout functionality is now provided by easy-layouts, which includes the WidgetSlot component and layout implementations.
