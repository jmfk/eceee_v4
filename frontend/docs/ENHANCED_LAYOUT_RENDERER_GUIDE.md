# Enhanced LayoutRenderer Guide

The Enhanced LayoutRenderer extends the vanilla JavaScript `LayoutRenderer.js` with interactive UI capabilities using pure DOM manipulation (no React components).

## 🎯 Architecture Decision

**All UI enhancements use vanilla JavaScript/DOM manipulation only** - no React components to maintain performance benefits and single-paradigm approach.

## ✨ Features

### Icon Menus for Slots
- **3-dot menu** appears on slot hover
- **Dropdown menu** with configurable actions
- **Click outside** to close functionality
- **Visual feedback** and transitions

### Available Menu Actions
- ➕ **Add Widget** - Trigger widget addition workflow
- ✏️ **Edit Slot** - Open slot configuration
- 👁️ **Toggle Visibility** - Show/hide slot content
- 🗑️ **Clear Slot** - Remove all widgets from slot
- ℹ️ **Slot Info** - Display slot information

## 🚀 Basic Usage

```javascript
import LayoutRenderer from './LayoutRenderer.js'

// Create enhanced renderer
const renderer = new LayoutRenderer()

// Configure UI settings
renderer.setUIConfig({
    showAddWidget: true,
    showEditSlot: true,
    showSlotVisibility: true
})

// Set up UI callbacks
renderer.setUICallbacks({
    onAddWidget: (slotName) => {
        console.log(`Add widget to ${slotName}`)
        // Your widget addition logic
    },
    onEditSlot: (slotName) => {
        console.log(`Edit slot ${slotName}`)
        // Your slot editing logic
    },
    onToggleVisibility: (slotName, isVisible) => {
        console.log(`Slot ${slotName} visibility: ${isVisible}`)
    }
})

// Render layout
renderer.render(layoutJson, containerRef)

// Add icon menus to all slots
renderer.addIconMenusToAllSlots({
    showAddWidget: true,
    showEditSlot: true,
    showSlotVisibility: true,
    showClearSlot: true,
    showSlotInfo: true
})
```

## 📚 API Reference

### Configuration Methods

#### `setUIConfig(config)`
Configure global UI settings.

```javascript
renderer.setUIConfig({
    showIconMenu: true,        // Enable icon menus
    showAddWidget: true,       // Show "Add Widget" in menus
    showEditSlot: true,        // Show "Edit Slot" in menus
    showSlotVisibility: true,  // Show visibility toggle
    enableDragDrop: false,     // Future: drag-drop capability
    enableContextMenu: false   // Future: right-click menus
})
```

#### `setUICallbacks(callbacks)`
Set up event callbacks for UI interactions.

```javascript
renderer.setUICallbacks({
    onAddWidget: (slotName) => { /* Handle widget addition */ },
    onEditSlot: (slotName) => { /* Handle slot editing */ },
    onClearSlot: (slotName) => { /* Handle slot clearing */ },
    onSlotInfo: (slotName) => { /* Handle slot info display */ },
    onToggleVisibility: (slotName, isVisible) => { /* Handle visibility change */ }
})
```

### Icon Menu Methods

#### `addSlotIconMenu(slotName, options)`
Add icon menu to a specific slot.

```javascript
renderer.addSlotIconMenu('header-slot', {
    showAddWidget: true,
    showEditSlot: true,
    showSlotVisibility: true,
    showClearSlot: false,
    showSlotInfo: true
})
```

#### `addIconMenusToAllSlots(options)`
Add icon menus to all available slots with the same options.

```javascript
renderer.addIconMenusToAllSlots({
    showAddWidget: true,
    showEditSlot: true,
    showSlotVisibility: true
})
```

#### `removeSlotUI(slotName)`
Remove UI elements from a specific slot.

```javascript
renderer.removeSlotUI('header-slot')
```

#### `removeAllSlotUI()`
Remove all UI elements from all slots.

```javascript
renderer.removeAllSlotUI()
```

### Utility Methods

#### `toggleSlotVisibility(slotName)`
Toggle visibility of a slot.

```javascript
renderer.toggleSlotVisibility('sidebar-slot')
```

#### `isSlotVisible(slotName)`
Check if a slot is currently visible.

```javascript
const isVisible = renderer.isSlotVisible('footer-slot')
```

## 🎨 Styling

The enhanced UI uses Tailwind CSS classes and custom CSS for styling. Key CSS classes:

```css
/* Icon menu container */
.slot-icon-menu {
    /* Positioned absolutely in top-right corner */
}

/* Menu dropdown */
.slot-menu-dropdown {
    /* Styled dropdown with shadow and borders */
}

/* Slot attributes for targeting */
[data-slot-name="slot-name"] {
    /* Target specific slots */
}

/* Hidden slot styling */
[data-slot-name][style*="display: none"] {
    /* Visual feedback for hidden slots */
}
```

## 🔧 Integration with React

While the LayoutRenderer uses vanilla JS, it integrates seamlessly with React:

```jsx
import React, { useRef, useEffect } from 'react'
import LayoutRenderer from './LayoutRenderer.js'

const MyComponent = ({ layoutJson, onWidgetAdd }) => {
    const containerRef = useRef()
    const rendererRef = useRef()

    useEffect(() => {
        const renderer = new LayoutRenderer()
        
        // Set up callbacks
        renderer.setUICallbacks({
            onAddWidget: onWidgetAdd  // Bridge to React
        })
        
        // Render and enhance
        renderer.render(layoutJson, containerRef)
        renderer.addIconMenusToAllSlots({ showAddWidget: true })
        
        rendererRef.current = renderer
        
        return () => renderer.destroy()
    }, [layoutJson, onWidgetAdd])

    return <div ref={containerRef} />
}
```

## 🛠️ Advanced Usage

### Custom Menu Items

Extend the `getMenuItems` method to add custom menu items:

```javascript
// Override in subclass or modify the source
getMenuItems(slotName, options) {
    const items = super.getMenuItems(slotName, options)
    
    // Add custom item
    items.push({
        icon: '⚙️',
        label: 'Advanced Settings',
        action: () => this.executeCallback('onAdvancedSettings', slotName),
        className: 'text-purple-700 hover:bg-purple-50'
    })
    
    return items
}
```

### Error Handling

All UI methods include error handling and logging:

```javascript
// Errors are automatically logged
renderer.addSlotIconMenu('nonexistent-slot') 
// → Console warning: Slot "nonexistent-slot" not found

// Callback errors are caught and logged
renderer.executeCallback('badCallback', 'slot')
// → Console error: Error executing callback badCallback
```

## 🧹 Cleanup

The enhanced renderer automatically cleans up UI elements:

```javascript
// Manual cleanup
renderer.removeAllSlotUI()

// Automatic cleanup on destroy
renderer.destroy() // Cleans up everything including UI
```

## 🔮 Future Enhancements

The architecture supports future vanilla JS UI enhancements:

- **Drag and Drop**: Visual drag-drop for widgets between slots
- **Context Menus**: Right-click menus for advanced actions
- **Inline Editing**: Direct text editing in slots
- **Visual Indicators**: Loading states, validation feedback
- **Keyboard Navigation**: Full keyboard accessibility

All future enhancements will maintain the vanilla JavaScript approach for consistency and performance.

## 📝 Notes

- **Performance**: Direct DOM manipulation for optimal rendering speed
- **Memory**: Automatic cleanup prevents memory leaks
- **Accessibility**: Proper ARIA attributes and keyboard navigation
- **Styling**: Uses Tailwind CSS for consistent design system
- **Extensibility**: Clean API for adding new UI capabilities 