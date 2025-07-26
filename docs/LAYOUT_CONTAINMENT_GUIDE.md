# Layout Containment Guide

## Overview

The eceee_v4 CMS includes a powerful layout containment system that prevents absolutely and fixed positioned elements from escaping their intended layout containers. This ensures that layout templates behave predictably within the content editor, preventing elements from overlapping other parts of the interface.

## The Problem

By default, CSS `position: fixed` elements are positioned relative to the viewport, and `position: absolute` elements are positioned relative to the nearest positioned ancestor. In a CMS context, this can cause:

- Fixed navigation bars to overlay the editor interface
- Modals and popups to appear outside the preview area
- Absolutely positioned elements to escape their layout containers
- Z-index conflicts between layout content and editor UI

## The Solution

Our containment system uses modern CSS features to create isolated "layout viewports" that constrain positioned elements:

### CSS Containment Properties Used

1. **`contain: layout style paint`** - Creates layout, style, and paint containment
2. **`position: relative`** - Creates a containing block for absolutely positioned children  
3. **`isolation: isolate`** - Creates a new stacking context for z-index isolation
4. **`transform: translateZ(0)`** - Forces a new containing block for fixed elements
5. **`overflow: hidden auto`** - Prevents content from escaping the container

## Implementation

### Automatic Implementation

The `ContentEditor` component automatically applies containment to all layout containers:

```jsx
<div className="layout-container content-editor-container">
  {/* Layout content is automatically contained with vertical scrolling */}
</div>
```

### Manual Implementation

You can manually apply containment using CSS classes or JavaScript utilities:

#### CSS Classes

```html
<!-- Basic containment -->
<div class="layout-containment">
  <!-- Content with fixed/absolute positioning stays within this container -->
</div>

<!-- Containment with scrolling -->
<div class="layout-containment-scroll">
  <!-- Allows scrolling within the contained area -->
</div>

<!-- Template viewport containment -->
<div class="template-viewport-contained">
  <!-- Creates a full-height contained viewport -->
</div>
```

#### JavaScript Utilities

```javascript
import { applyContainment, containFixedElements } from '../utils/layoutContainment';

// Apply full containment to a container
const container = document.getElementById('layout-container');
applyContainment(container, {
  enableCSS: true,
  enablePositioning: true,
  enableScrolling: false
});

// Convert only fixed positioned elements
containFixedElements(container, {
  logConversions: true,
  preserveOriginal: true
});
```

#### React Hook

```jsx
import { useLayoutContainment } from '../utils/layoutContainment';

function MyLayoutComponent() {
  const containerRef = useRef(null);
  
  // Automatically apply containment
  useLayoutContainment(containerRef, {
    enabled: true,
    autoObserve: true,
    enableScrolling: false
  });

  return (
    <div ref={containerRef} className="my-layout">
      {/* Content is automatically contained */}
    </div>
  );
}
```

## Layout Template Best Practices

### 1. Fixed Navigation Bars

For layout templates with fixed navigation:

```html
<!-- Before (problematic) -->
<nav class="fixed top-0 left-0 right-0 z-50">
  <!-- Navigation content -->
</nav>

<!-- After (contained) -->
<nav class="fixed-contained top-0 left-0 right-0 z-50">
  <!-- Navigation content stays within layout container -->
</nav>
```

### 2. Modal Dialogs and Overlays

```html
<!-- Contained modal overlay -->
<div class="absolute-contained inset-0 bg-black bg-opacity-50 z-40">
  <div class="absolute-contained top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
    <!-- Modal content -->
  </div>
</div>
```

### 3. Sticky Headers

```html
<!-- Sticky header within container -->
<header class="sticky top-0 bg-white z-30">
  <!-- Header content -->
</header>
```

### 4. Full-Screen Sections

```html
<!-- Full-height section within container -->
<section class="template-viewport-contained bg-gradient-to-br from-blue-500 to-purple-600">
  <!-- Full-height content -->
</section>
```

## CSS Classes Reference

### `.layout-containment`
- **Purpose**: Primary containment class for layout containers
- **Features**: Layout, style, and paint containment with positioning constraints
- **Use case**: Main layout containers in the content editor

### `.layout-containment-scroll`
- **Purpose**: Containment with scrolling capability
- **Features**: Layout and style containment with overflow scrolling
- **Use case**: Containers that need internal scrolling

### `.template-viewport-contained`
- **Purpose**: Full viewport behavior within containment
- **Features**: Full height containment with internal scrolling
- **Use case**: Landing pages and full-screen templates

### `.fixed-contained`
- **Purpose**: Automatically applied to converted fixed elements
- **Features**: Converts `position: fixed` to `position: absolute`
- **Use case**: Fixed elements within contained layouts

### `.absolute-contained`
- **Purpose**: Helper for absolutely positioned elements
- **Features**: Ensures absolute elements stay within container bounds
- **Use case**: Modals, overlays, and positioned content

### `.content-editor-container`
- **Purpose**: Specialized containment for content editing interfaces
- **Features**: Full containment with optimized vertical scrolling and custom scrollbars
- **Use case**: ContentEditor component and similar editing interfaces

## JavaScript API Reference

### `applyContainment(container, options)`

Applies complete containment to a container element.

**Parameters:**
- `container` (HTMLElement): Target container
- `options` (Object): Configuration options
  - `enableCSS` (boolean): Apply CSS containment (default: true)
  - `enablePositioning` (boolean): Handle positioning (default: true)
  - `enableScrolling` (boolean): Allow scrolling (default: false)
  - `className` (string): CSS class to apply (default: 'layout-containment')

### `containFixedElements(container, options)`

Converts fixed positioned elements to absolute within a container.

**Parameters:**
- `container` (HTMLElement): Target container
- `options` (Object): Configuration options
  - `selector` (string): Element selector (default: '*')
  - `addContainmentClass` (boolean): Add containment classes (default: true)
  - `logConversions` (boolean): Log conversions (default: false)
  - `preserveOriginal` (boolean): Preserve original positioning (default: true)

### `removeContainment(container)`

Removes containment and restores original positioning.

**Parameters:**
- `container` (HTMLElement): Target container

### `useLayoutContainment(containerRef, options)`

React hook for automatic containment management.

**Parameters:**
- `containerRef` (React.RefObject): Reference to container element
- `options` (Object): Configuration options
  - `enabled` (boolean): Enable containment (default: true)
  - `autoObserve` (boolean): Automatically handle new elements (default: true)

## Browser Support

The containment system uses modern CSS features with fallbacks:

- **CSS Containment**: Chrome 52+, Firefox 69+, Safari 15.4+
- **CSS Isolation**: Chrome 41+, Firefox 36+, Safari 15.4+
- **CSS Transform**: Universal support
- **Fallback**: Inline styles applied for older browsers

## Performance Considerations

### Benefits
- **Improved Performance**: CSS containment reduces layout recalculation scope
- **Paint Optimization**: Paint containment reduces repaint areas
- **Style Isolation**: Style containment prevents style recalculation propagation

### Trade-offs
- **Memory Usage**: Slightly increased memory usage for containment contexts
- **Layout Constraints**: Some layout patterns may need adjustment
- **Z-index Isolation**: Z-index values are isolated within containers

## Debugging

### Common Issues

1. **Fixed elements not appearing**: Check if containment is converting them to absolute
2. **Z-index conflicts**: Use CSS isolation to create independent stacking contexts
3. **Overflow clipping**: Ensure content fits within container or enable scrolling

### Debug Tools

```javascript
// Enable conversion logging
containFixedElements(container, { logConversions: true });

// Check for converted elements
const convertedElements = container.querySelectorAll('.fixed-contained');
console.log('Converted elements:', convertedElements);

// Restore original positioning for debugging
restoreOriginalPositioning(container);
```

## Migration Guide

### Existing Templates

1. **Test layouts** in the content editor
2. **Identify problematic elements** (fixed navigation, modals, etc.)
3. **Apply containment classes** or use JavaScript utilities
4. **Verify behavior** in both edit and preview modes

### New Templates

1. **Start with containment-aware design**
2. **Use provided CSS classes** for positioned elements
3. **Test early and often** in the content editor
4. **Follow best practices** outlined in this guide

## Examples

See the `landing_page.html` template for a complete example of a containment-aware layout with fixed navigation and full-screen sections.

## Support

For issues with layout containment, check:
1. Browser developer tools for CSS containment support
2. Console logs for conversion messages
3. Element inspector for applied containment classes
4. This documentation for implementation guidance 