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
  onAddWidget: (slotName) => {
    // Handle adding widget to slot
  },
  onEditSlot: (slotName) => {
    // Handle slot editing
  },
  onToggleVisibility: (slotName, isVisible) => {
    // Handle slot visibility toggle
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
  showAddWidget: true,
  showEditSlot: true,
  showSlotVisibility: true
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