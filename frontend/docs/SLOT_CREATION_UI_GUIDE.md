# Slot Creation UI Guide

This guide explains how to use the new vanilla JavaScript slot creation UI features in LayoutRenderer.

## Overview

The LayoutRenderer now includes a comprehensive UI system for adding new slots dynamically to layout structures. This includes:

- **Floating Add Button**: A persistent button for adding slots anywhere
- **Insertion Points**: Visual indicators showing where slots can be added
- **Configuration Dialog**: A form for configuring new slot properties
- **Event Callbacks**: Hooks for handling slot creation events

## Features

### 1. Automatic Slot Menus ⭐
Three-dot menu buttons (•••) automatically appear on every rendered slot, providing instant access to slot operations. No setup required!

**"Add Widget" opens a modal with:**
- **Widget Selection Grid** - Visual cards showing available widgets
- **Search Functionality** - Filter widgets by name, type, or description  
- **Categories** - Organized by content, media, interactive, and layout
- **Widget Previews** - Icons and descriptions for each widget type

### 2. Floating Add Button
A blue + button that appears in the top-left corner of the page, allowing users to add slots from anywhere.

### 3. Insertion Points
Dashed blue lines that appear when hovering over container elements, showing exactly where new slots can be inserted.

### 4. Slot Configuration Dialog
A modal form that collects:
- Slot name (required, unique identifier)
- Display title (auto-generated from name if not provided)
- Description (optional)
- Container tag (div, section, aside, etc.)
- CSS classes
- Droppable checkbox (for widget acceptance)

## Usage

### Basic Setup (Automatic Slot Menus)

```javascript
import LayoutRenderer from './components/LayoutRenderer.js';

// Create renderer instance (slot menus are enabled by default)
const renderer = new LayoutRenderer();

// Set up callbacks for slot interactions
renderer.setUICallbacks({
  onWidgetSelected: (slotName, widgetInstance, widgetDef) => {
    // Handle widget selection from modal
    // widgetInstance: {id, type, name, config}
    // widgetDef: Original widget definition
    console.log(`Adding ${widgetDef.name} to ${slotName}`);
    
    // Add widget to your data model and update slot
    // renderer.updateSlot(slotName, [widgetInstance]);
  },
  onSlotInfo: (slotName) => {
    // Show slot information
  },
  onClearSlot: (slotName) => {
    // Clear slot content
  },
  onAddNewSlot: (slotData, slotNode, insertionContext) => {
    // Handle new slot creation
  }
});

// Render your layout - slot menus will appear automatically!
renderer.render(layoutData, targetRef);

// Optional: Enable floating add button for new slots
renderer.enableAddSlotUI({
  showFloatingAddButton: true
});
```

### Configuration Options

```javascript
// Enable with options
renderer.enableAddSlotUI({
  showFloatingAddButton: true,  // Show the floating ➕ button
  // Add other insertion point options here
});
```

### Event Callbacks

Set up the `onAddNewSlot` callback to handle slot creation:

```javascript
renderer.setUICallbacks({
  onAddNewSlot: (slotData, slotNode, insertionContext) => {
    // slotData: Form data from the dialog
    // slotNode: Generated JSON node for the slot
    // insertionContext: Information about where to insert
    
    // Your slot creation logic here:
    // 1. Update layout JSON structure
    // 2. Save to backend
    // 3. Re-render layout
  }
});
```

### Managing the UI

```javascript
// Slot menus are enabled by default, but you can control them:

// Enable slot menus (if disabled)
renderer.enableSlotMenus({
  showAddWidget: true
});

// Disable slot menus
renderer.disableSlotMenus();

// Enable add slot UI (floating button + insertion points)
renderer.enableAddSlotUI({
  showFloatingAddButton: true
});

// Disable add slot UI (removes all UI elements)
renderer.disableAddSlotUI();

// Check current slot names
const existingSlots = renderer.getSlotNames();
```

## Slot Data Structure

When a new slot is created, the callback receives:

### slotData Object
```javascript
{
  name: "main-content",           // Unique identifier
  title: "Main Content",          // Display title
  description: "Content area",    // Optional description
  tag: "section",                 // HTML tag
  classes: "col-span-2 p-4",     // CSS classes
  makeDroppable: true             // Allow widgets
}
```

### slotNode Object
```javascript
{
  type: "slot",
  tag: "section",
  classes: "col-span-2 p-4",
  slot: {
    name: "main-content",
    title: "Main Content",
    description: "Content area",
    allowedWidgets: [],           // Empty array if droppable
    defaultWidgets: []
  }
}
```

### insertionContext Object
```javascript
{
  container: HTMLElement,         // Parent container
  position: "after-1",           // Position identifier
  referenceElement: HTMLElement  // Reference element (if any)
}
```

### widgetInstance Object
```javascript
{
  id: "widget-1234567890-abc123",  // Unique widget identifier
  type: "text",                   // Widget type
  name: "Text Block",            // Human-readable name
  config: {                      // Widget configuration
    content: "Enter your text here...",
    fontSize: "medium",
    alignment: "left"
  }
}
```

## Default Widget Auto-Creation

For **new/unsaved pages**, the LayoutRenderer automatically converts default widgets defined in slot configurations into real widget instances:

### How It Works
```javascript
// In your layout JSON, define default widgets
const layout = {
  structure: {
    type: 'slot',
    slot: {
      name: 'hero-section',
      defaultWidgets: [
        {
          type: 'text',
          name: 'Welcome Message',
          config: { content: 'Welcome!', fontSize: 'large' }
        }
      ]
    }
  }
};

// On first render (new page), defaults become real widgets
renderer.render(layout, targetRef);

// Mark page as saved to prevent auto-creation on subsequent renders
renderer.markPageAsSaved();
```

### Managing Page State
```javascript
// Check if page has been saved
const isSaved = renderer.hasPageBeenSaved();

// Reset to new page state (enables default widget creation)
renderer.resetPageSavedState();

// Mark as saved (disables default widget creation)
renderer.markPageAsSaved();
```

### Callback for Auto-Created Widgets
```javascript
renderer.setUICallbacks({
  onWidgetAutoCreated: (slotName, widgetInstance, widgetDef) => {
    console.log(`Auto-created: ${widgetInstance.name} in ${slotName}`);
    // Handle auto-created widget (e.g., track in your data model)
  }
});
```

## Widget Data Persistence

The LayoutRenderer provides comprehensive functionality for saving and loading widget state:

### Collecting Widget Data
```javascript
// Collect all widget data from rendered slots
const allWidgetData = renderer.collectAllWidgetData();
// Returns: { slotName: [widgetInstance, ...], ... }

// Collect from specific slot
const slotWidgets = renderer.collectWidgetDataFromSlot('hero-section');
```

### Saving Current State
```javascript
// Save current widget state (collects + saves internally)
const savedData = renderer.saveCurrentWidgetState();

// Or save specific widget data
renderer.saveWidgetData({
  'hero-section': [
    { id: 'w1', type: 'text', name: 'Title', config: {...} }
  ]
});
```

### Loading Saved Data
```javascript
// Load widget data from external source (e.g., API)
renderer.loadWidgetData(widgetDataFromAPI);

// Check if slot has saved data
const hasData = renderer.hasSlotWidgetData('hero-section');

// Get saved data for specific slot
const slotData = renderer.getSlotWidgetData('hero-section');
```

### Save Callback
```javascript
renderer.setUICallbacks({
  onSavePageData: (widgetData) => {
    // Called when saveCurrentWidgetState() is executed
    console.log('Saving widget data:', widgetData);
    
    // Send to API
    fetch('/api/pages/123/widgets', {
      method: 'POST',
      body: JSON.stringify(widgetData)
    });
  }
});
```

### Rendering Priority
The LayoutRenderer follows this priority when rendering slots:

1. **Saved Widgets** (highest priority) - if `hasSlotWidgetData(slotName)` returns true
2. **Default Widgets** (auto-converted to instances for new pages)
3. **Empty Placeholder** (lowest priority)

### Configuration Extraction
The system automatically extracts widget configurations from rendered DOM elements, supporting all built-in widget types with proper state preservation.

## Available Widget Types

The widget selection modal includes these built-in widget types:

### Content Widgets
- **Text Block** - Simple text content with formatting options
- **List** - Ordered or unordered list of items

### Media Widgets  
- **Image** - Display images with captions and links
- **Video** - Embed videos from various sources

### Interactive Widgets
- **Button** - Interactive button with customizable styling

### Layout Widgets
- **Card** - Content card with title, text, and optional image
- **Spacer** - Add spacing between content elements
- **Divider** - Horizontal line to separate content sections

## Styling

The slot creation UI uses Tailwind CSS classes. Key classes include:

- `.layout-add-slot-floating` - Floating add button
- `.slot-insertion-point` - Insertion point indicators
- `.add-slot-dialog` - Configuration dialog overlay

### Custom Styling

You can override the default styles:

```css
.layout-add-slot-floating {
  /* Custom floating button styles */
}

.slot-insertion-point {
  /* Custom insertion point styles */
}

.slot-insertion-point:hover {
  /* Hover effects */
}
```

## Integration with React Components

While LayoutRenderer uses vanilla JavaScript, it integrates seamlessly with React:

```javascript
// In a React component
useEffect(() => {
  const renderer = new LayoutRenderer();
  
  renderer.setUICallbacks({
    onAddNewSlot: (slotData, slotNode, insertionContext) => {
      // Update React state or call API
      handleSlotCreation(slotData, slotNode);
    }
  });
  
  renderer.enableAddSlotUI();
  
  return () => {
    renderer.disableAddSlotUI();
    renderer.destroy();
  };
}, []);
```

## Best Practices

1. **Always set up callbacks** before enabling the UI
2. **Validate slot names** to ensure uniqueness
3. **Handle errors gracefully** in your callback functions
4. **Clean up UI** when components unmount
5. **Provide user feedback** for successful slot creation

## Example Implementation

See `demo_slot_creation.html` for a complete working example demonstrating all features.

## Error Handling

The system includes built-in validation:
- Slot name format validation (lowercase, hyphens allowed)
- Uniqueness checking against existing slots
- Required field validation
- Error messages for user feedback

## Browser Compatibility

The slot creation UI works in all modern browsers that support:
- ES6 modules
- DOM manipulation APIs
- CSS Grid and Flexbox
- CSS custom properties

## Performance Notes

- Insertion points are created on-demand during hover
- Event listeners are properly tracked and cleaned up
- DOM operations are optimized for smooth interactions
- Memory leaks are prevented through proper cleanup 