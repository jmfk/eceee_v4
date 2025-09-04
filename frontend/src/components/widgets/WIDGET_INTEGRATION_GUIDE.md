# Enhanced Widget Integration Guide

## Overview

The enhanced widget system reduces integration points to just **2 files**:
1. **Widget Component** (with colocated metadata)
2. **Widget Registry** (for registration)

All widget metadata is now colocated with the component, eliminating scattered configuration across multiple files.

## Adding a New Widget

### Step 1: Create Widget Component

```jsx
// frontend/src/components/widgets/YourWidget.jsx
import React from 'react'
import { YourIcon } from 'lucide-react'

/**
 * Your Widget Component
 * Description of what your widget does
 */
const YourWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        title = '',
        content = 'Default content...',
        customProperty = 'default_value'
    } = config

    if (mode === 'editor') {
        return (
            <div className="your-widget-editor p-2 border border-dashed border-gray-300 rounded">
                <div className="flex items-center mb-2">
                    <YourIcon className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-600">Your Widget</span>
                </div>
                {/* Your editor mode rendering */}
                <div>{title && <h3>{title}</h3>}</div>
                <div>{content}</div>
            </div>
        )
    }

    return (
        <div className="your-widget">
            {/* Your preview mode rendering */}
            {title && <h3>{title}</h3>}
            <div>{content}</div>
        </div>
    )
}

// === COLOCATED METADATA ===
YourWidget.displayName = 'YourWidget'
YourWidget.widgetType = 'your_app.YourWidget'

// Default configuration
YourWidget.defaultConfig = {
    title: '',
    content: 'Default content...',
    customProperty: 'default_value'
}

// Display metadata
YourWidget.metadata = {
    name: 'Your Widget Name',
    description: 'Description of what your widget does',
    category: 'content', // content, media, interactive, layout, dynamic, other
    icon: YourIcon, // Lucide React icon component
    tags: ['your', 'widget', 'custom'] // For search functionality
}

export default YourWidget
```

### Step 2: Register in Widget Registry

```javascript
// frontend/src/components/widgets/widgetRegistry.js
import YourWidget from './YourWidget'

// Add to the registry
export const WIDGET_REGISTRY = {
    'your_app.YourWidget': collectWidgetMetadata(YourWidget),
    // ... existing widgets
}
```

### That's it! 

Your widget is now fully integrated with:
- ✅ Automatic icon handling
- ✅ Category classification
- ✅ Search functionality
- ✅ Default configuration
- ✅ Display name resolution
- ✅ Modal integration
- ✅ Editor integration

## Available Metadata Properties

### Component Properties
- `displayName` - React component display name
- `widgetType` - Backend widget type identifier
- `defaultConfig` - Default configuration object

### Metadata Object
- `name` - Human-readable widget name
- `description` - Widget description for tooltips/help
- `category` - Category for filtering (`content`, `media`, `interactive`, `layout`, `dynamic`, `other`)
- `icon` - Lucide React icon component
- `tags` - Array of strings for search functionality

## Registry Functions Available

The enhanced registry provides all these functions automatically:

```javascript
import { 
    getWidgetComponent,        // Get React component
    getWidgetDefaultConfig,    // Get default config
    getWidgetDisplayName,      // Get display name
    getWidgetIcon,            // Get icon component
    getWidgetCategory,        // Get category
    getWidgetDescription,     // Get description
    getWidgetTags,           // Get search tags
    getAllWidgetMetadata,    // Get all metadata
    searchWidgets,           // Search by term
    filterWidgetsByCategory, // Filter by category
    getAvailableCategories,  // Get all categories
    isWidgetTypeSupported    // Check if supported
} from './widgets/widgetRegistry'
```

## Migration Benefits

### Before (8 integration points):
1. Widget Component
2. Widget Registry mapping
3. Default config in useWidgets.js
4. Display name in useWidgets.js
5. Icon mapping in WidgetLibrary.jsx
6. Icon mapping in WidgetManager.jsx
7. Category mapping in multiple files
8. Export in index.js

### After (2 integration points):
1. **Widget Component** (with all metadata colocated)
2. **Widget Registry** (simple registration)

### Eliminated Files/Sections:
- Scattered icon mappings across multiple components
- Scattered category mappings across multiple components
- Default config mappings in useWidgets.js
- Display name mappings in useWidgets.js

All functionality is preserved while dramatically reducing maintenance overhead!
