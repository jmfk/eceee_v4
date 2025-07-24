# LayoutRenderer Component

The `LayoutRenderer` is a reusable React component that provides consistent layout rendering across the eceee_v4 application. It handles theme application, slot management, and widget placement within layout structures.

## Overview

The LayoutRenderer component was extracted from the PagePreview component to provide a centralized, reusable solution for rendering page layouts with:

- **Theme Support**: Automatic CSS variable application and custom CSS injection
- **Slot Management**: Rendering of layout slots with proper structure
- **Widget Placement**: Intelligent widget rendering within slots
- **Multiple Modes**: Support for preview, edit, and display modes
- **Inheritance Display**: Visual indicators for widget inheritance
- **Accessibility**: Full keyboard navigation and ARIA support

## Basic Usage

```jsx
import LayoutRenderer from '../components/LayoutRenderer'

// Basic layout rendering
<LayoutRenderer
    layout={effectiveLayout}
    theme={effectiveTheme}
    widgetsBySlot={widgetsBySlot}
    pageTitle="My Page"
    pageDescription="Page description"
/>
```

## Props API

### Required Props

None - all props are optional with sensible defaults.

### Optional Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `layout` | `object` | `undefined` | Layout configuration object |
| `theme` | `object` | `undefined` | Theme configuration object |
| `widgetsBySlot` | `object` | `{}` | Widgets organized by slot name |
| `showInheritance` | `boolean` | `false` | Show inheritance information |
| `mode` | `string` | `'preview'` | Rendering mode: 'preview', 'edit', 'display' |
| `pageTitle` | `string` | `undefined` | Optional page title to display |
| `pageDescription` | `string` | `undefined` | Optional page description |
| `onWidgetEdit` | `function` | `undefined` | Callback for widget edit in edit mode |
| `onWidgetAdd` | `function` | `undefined` | Callback for adding widgets in edit mode |
| `onSlotClick` | `function` | `undefined` | Callback for slot clicks in edit mode |
| `className` | `string` | `''` | Additional CSS classes |
| `showSlotHeaders` | `boolean` | `true` | Show slot headers and descriptions |
| `showEmptySlots` | `boolean` | `true` | Show placeholders for empty slots |
| `children` | `ReactNode` | `undefined` | Additional content to render |

## Data Structures

### Layout Object

```javascript
const layout = {
    name: 'two_column',
    description: 'Two column layout',
    slot_configuration: {
        slots: [
            {
                name: 'header',
                display_name: 'Header',
                title: 'Page Header',
                description: 'Main header content',
                css_classes: 'header-slot',
                max_widgets: 2
            },
            {
                name: 'content',
                display_name: 'Main Content',
                description: 'Primary content area',
                css_classes: 'content-slot'
            }
        ]
    },
    css_classes: '.layout-two-column { display: grid; }'
}
```

### Theme Object

```javascript
const theme = {
    name: 'Blue Theme',
    css_variables: {
        primary: '#3b82f6',
        background: '#ffffff',
        text: '#1f2937',
        'text-muted': '#6b7280'
    },
    custom_css: '.custom-style { color: blue; }'
}
```

### Widgets by Slot Object

```javascript
const widgetsBySlot = {
    header: [
        {
            widget: {
                id: 1,
                widget_type: { name: 'TextBlock' },
                configuration: {
                    title: 'Welcome',
                    content: 'Welcome to our site'
                },
                is_visible: true
            },
            inherited_from: null,
            is_override: false
        }
    ],
    content: [
        // ... more widgets
    ]
}
```

## Usage Examples

### Preview Mode (Default)

```jsx
<LayoutRenderer
    layout={layout}
    theme={theme}
    widgetsBySlot={widgetsBySlot}
    pageTitle="My Page Title"
    pageDescription="A description of my page"
/>
```

### Edit Mode with Interactions

```jsx
<LayoutRenderer
    layout={layout}
    theme={theme}
    widgetsBySlot={widgetsBySlot}
    mode="edit"
    showInheritance={true}
    onWidgetEdit={(widget) => setEditingWidget(widget)}
    onWidgetAdd={(slot) => setAddingToSlot(slot)}
    onSlotClick={(slot) => setSelectedSlot(slot)}
/>
```

### Minimal Display Mode

```jsx
<LayoutRenderer
    layout={layout}
    widgetsBySlot={widgetsBySlot}
    mode="display"
    showSlotHeaders={false}
    showEmptySlots={false}
    className="compact-layout"
/>
```

### With Custom Content

```jsx
<LayoutRenderer
    layout={layout}
    theme={theme}
    widgetsBySlot={widgetsBySlot}
>
    <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3>Custom Footer Content</h3>
        <p>Additional information about this page...</p>
    </div>
</LayoutRenderer>
```

## Supported Widget Types

The LayoutRenderer includes built-in rendering for common widget types:

### TextBlock / Text Block
- Renders title and content
- Supports text alignment and styling
- Configuration: `title`, `content`, `alignment`, `style`

### Header
- Renders as `<h2>` element
- Configuration: `title`

### Image
- Shows placeholder with alt text
- Displays optional caption
- Configuration: `alt_text`, `caption`

### Button
- Renders styled button (disabled in preview)
- Supports primary/secondary styles
- Configuration: `text`, `style`

### Unknown Widget Types
- Falls back to generic widget display
- Shows widget type name and description
- Displays configuration as JSON

## Inheritance Features

When `showInheritance={true}`, the component displays:

- **Inherited Widgets**: Orange border and background
- **Override Widgets**: Blue "Override" badge
- **Hidden Widgets**: Gray "Hidden" badge with eye-off icon
- **Source Information**: Shows which page widgets are inherited from

## Theming and Styling

### CSS Variables
The component automatically applies theme CSS variables to the root element:

```css
.layout-renderer {
    --primary: #3b82f6;
    --background: #ffffff;
    --text: #1f2937;
    --text-muted: #6b7280;
}
```

### Custom CSS
Theme custom CSS is injected as `<style>` tags:

```html
<style>
    .custom-style { color: blue; }
</style>
```

### Layout CSS Classes
Layout-specific CSS classes are applied:

```html
<div class="page-layout layout-two_column">
    <!-- slots -->
</div>
```

### Slot CSS Classes
Individual slots receive their configured CSS classes:

```html
<div class="layout-slot header-slot" data-slot="header">
    <!-- widgets -->
</div>
```

## Accessibility

The LayoutRenderer provides comprehensive accessibility support:

### Keyboard Navigation
- Interactive elements are keyboard accessible
- Proper tab order for edit mode
- Enter/Space key support for widget selection

### ARIA Support
- Proper roles for interactive elements
- Screen reader friendly content structure
- Descriptive labels and descriptions

### Focus Management
- Visible focus indicators
- Logical focus flow
- Focus trapping in edit mode

## Error Handling

### No Layout
When no layout is provided, shows:
```
No layout selected
Choose a layout to see the structure
```

### Empty Layout
When layout has no slots, shows:
```
Layout has no slots defined
Configure the layout to add slots
```

### Empty Slots
When slots have no widgets (and `showEmptySlots={true}`):
```
No widgets in this slot
Widgets would appear here
```

## Integration with Existing Components

### PagePreview
The PagePreview component has been updated to use LayoutRenderer:

```jsx
// Old approach (removed)
<div className="layout-rendering-logic">
    {/* Complex inline rendering */}
</div>

// New approach
<LayoutRenderer
    layout={effective_layout}
    theme={effective_theme}
    widgetsBySlot={widgets_by_slot}
    showInheritance={showInheritance}
    mode="preview"
    pageTitle={page.title}
    pageDescription={page.description}
/>
```

### SlotManager
The LayoutRenderer can be used alongside SlotManager for editing workflows:

```jsx
{editMode ? (
    <SlotManager
        pageId={pageId}
        layout={layout}
        onWidgetChange={handleWidgetChange}
    />
) : (
    <LayoutRenderer
        layout={layout}
        widgetsBySlot={widgetsBySlot}
        mode="display"
    />
)}
```

## Performance Considerations

### CSS Variables
- CSS variables are computed only when theme changes
- Minimal performance impact for theme switching

### Widget Rendering
- Widgets are rendered using React keys for efficient updates
- Only changed widgets re-render when data updates

### Style Injection
- CSS styles are injected only once per theme/layout
- Styles are automatically cleaned up on unmount

## Testing

The component includes comprehensive tests covering:

- Basic rendering scenarios
- Theme application
- Widget rendering for all supported types
- Inheritance display
- Mode-specific behavior
- Accessibility features
- Error states

Run tests with:
```bash
npm test LayoutRenderer
```

## Future Enhancements

Potential improvements for future versions:

1. **Custom Widget Renderers**: Plugin system for custom widget types
2. **Animation Support**: Smooth transitions for layout changes
3. **Responsive Layouts**: Mobile-first responsive slot arrangements
4. **Drag & Drop**: Visual widget reordering in edit mode
5. **Live Editing**: Real-time content editing capabilities

## Migration Guide

### From PagePreview inline rendering

Before:
```jsx
{/* Complex inline layout rendering logic */}
<div className="layout-rendering">
    {/* 100+ lines of rendering code */}
</div>
```

After:
```jsx
<LayoutRenderer
    layout={effective_layout}
    theme={effective_theme}
    widgetsBySlot={widgets_by_slot}
    showInheritance={showInheritance}
    pageTitle={page.title}
    pageDescription={page.description}
/>
```

### Benefits of Migration
- **Reduced Code Duplication**: Single component for all layout rendering
- **Improved Maintainability**: Centralized layout logic
- **Enhanced Testing**: Comprehensive test coverage
- **Better Performance**: Optimized rendering and updates
- **Consistent UX**: Uniform behavior across the application 