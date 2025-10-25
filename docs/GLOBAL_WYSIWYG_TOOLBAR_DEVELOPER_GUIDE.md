# Global WYSIWYG Toolbar - Developer Guide

## Quick Reference

### Using the Global Toolbar in a New Component

#### Step 1: Import the ContentWidgetEditorRenderer
```javascript
import ContentWidgetEditorRenderer from '@/widgets/eceee-widgets/ContentWidgetEditorRenderer.js'
```

#### Step 2: Create Renderer with Detached Toolbar
```javascript
const renderer = new ContentWidgetEditorRenderer(containerElement, {
    content: '<p>Initial content</p>',
    onChange: (newContent) => {
        console.log('Content changed:', newContent);
    },
    detachedToolbar: true,  // Enable global toolbar
    className: 'my-custom-class'
});

renderer.render();
```

#### Step 3: Set Up Focus/Blur Handlers
```javascript
const editorElement = containerElement.querySelector('[contenteditable="true"]');

editorElement.addEventListener('focus', () => {
    renderer.activate();  // Register with global toolbar
});

editorElement.addEventListener('blur', () => {
    renderer.deactivate();  // Unregister from global toolbar
});
```

#### Step 4: Add GlobalWysiwygToolbar to Your Layout
```jsx
import GlobalWysiwygToolbar from '@components/wysiwyg/GlobalWysiwygToolbar'

function MyLayout() {
    return (
        <div>
            <Header />
            <GlobalWysiwygToolbar />  {/* Toolbar appears here when active */}
            <main>
                {/* Your content with editors */}
            </main>
        </div>
    );
}
```

### React Integration Example

```jsx
import { useRef, useEffect } from 'react';
import ContentWidgetEditorRenderer from '@/widgets/eceee-widgets/ContentWidgetEditorRenderer.js';

function MyEditor({ content, onChange }) {
    const containerRef = useRef(null);
    const rendererRef = useRef(null);
    const focusHandlerRef = useRef(null);
    const blurHandlerRef = useRef(null);

    useEffect(() => {
        if (containerRef.current && !rendererRef.current) {
            // Create renderer with detached toolbar
            rendererRef.current = new ContentWidgetEditorRenderer(
                containerRef.current,
                {
                    content,
                    onChange,
                    detachedToolbar: true
                }
            );
            
            rendererRef.current.render();

            // Set up activation handlers
            setTimeout(() => {
                const editorElement = containerRef.current.querySelector('[contenteditable="true"]');
                
                focusHandlerRef.current = () => rendererRef.current?.activate();
                blurHandlerRef.current = () => rendererRef.current?.deactivate();
                
                editorElement.addEventListener('focus', focusHandlerRef.current);
                editorElement.addEventListener('blur', blurHandlerRef.current);
            }, 0);
        }
    }, []);

    useEffect(() => {
        if (rendererRef.current && content !== rendererRef.current.content) {
            rendererRef.current.updateConfig({ content });
        }
    }, [content]);

    useEffect(() => {
        return () => {
            const editorElement = containerRef.current?.querySelector('[contenteditable="true"]');
            if (editorElement) {
                if (focusHandlerRef.current) {
                    editorElement.removeEventListener('focus', focusHandlerRef.current);
                }
                if (blurHandlerRef.current) {
                    editorElement.removeEventListener('blur', blurHandlerRef.current);
                }
            }
            rendererRef.current?.destroy();
        };
    }, []);

    return <div ref={containerRef} />;
}
```

## API Reference

### WysiwygToolbarManager

#### Methods

##### `registerEditor(editorInstance)`
Register an editor as the currently active editor.

```javascript
import { toolbarManager } from '@/utils/wysiwygToolbarManager';

toolbarManager.registerEditor(myEditorInstance);
```

##### `unregisterEditor(editorInstance)`
Unregister an editor.

```javascript
toolbarManager.unregisterEditor(myEditorInstance);
```

##### `dispatchCommand(command, value)`
Send a command to the active editor.

```javascript
// Bold
toolbarManager.dispatchCommand('bold');

// Format block
toolbarManager.dispatchCommand('formatBlock', '<h1>');

// Link (opens dialog)
toolbarManager.dispatchCommand('createLink');
```

##### `getToolbarState()`
Get the current formatting state.

```javascript
const state = toolbarManager.getToolbarState();
// {
//   bold: true,
//   italic: false,
//   insertUnorderedList: false,
//   insertOrderedList: false,
//   link: false,
//   format: 'Paragraph',
//   maxHeaderLevel: 3
// }
```

##### `subscribe(event, callback)`
Subscribe to toolbar manager events.

```javascript
const unsubscribe = toolbarManager.subscribe('editor-activated', (editor) => {
    console.log('Editor activated:', editor);
});

// Later, cleanup
unsubscribe();
```

**Events:**
- `editor-activated` - Fired when an editor becomes active
- `editor-deactivated` - Fired when the active editor deactivates
- `state-updated` - Fired every 100ms with current toolbar state

### ContentWidgetEditorRenderer

#### Constructor Options

```javascript
new ContentWidgetEditorRenderer(container, {
    content: '<p>HTML content</p>',     // Initial HTML content
    onChange: (content) => {},          // Change callback
    className: 'custom-class',          // CSS class for root element
    detachedToolbar: true,              // Enable global toolbar mode
    maxHeaderLevel: 3                   // Maximum heading level (1-6)
});
```

#### Methods

##### `render()`
Create and render the editor DOM.

```javascript
renderer.render();
```

##### `activate()`
Register this editor with the global toolbar.

```javascript
renderer.activate();
```

##### `deactivate()`
Unregister this editor from the global toolbar.

```javascript
renderer.deactivate();
```

##### `getToolbarState()`
Get current formatting state for this editor.

```javascript
const state = renderer.getToolbarState();
```

##### `execCommand(command, value)`
Execute a formatting command directly.

```javascript
renderer.execCommand('bold');
renderer.execCommand('formatBlock', '<h2>');
```

##### `setContent(content)`
Set editor content.

```javascript
renderer.setContent('<p>New content</p>');
```

##### `updateConfig(options)`
Update editor configuration.

```javascript
renderer.updateConfig({
    content: '<p>Updated</p>',
    onChange: newCallback,
    className: 'new-class'
});
```

##### `destroy()`
Clean up and destroy the editor.

```javascript
renderer.destroy();
```

## Supported Commands

### Standard Formatting Commands

| Command | Description | Value |
|---------|-------------|-------|
| `bold` | Toggle bold | - |
| `italic` | Toggle italic | - |
| `insertUnorderedList` | Toggle bullet list | - |
| `insertOrderedList` | Toggle numbered list | - |
| `formatBlock` | Change block format | `<p>`, `<h1>`, `<h2>`, etc. |
| `undo` | Undo last change | - |
| `redo` | Redo last undone change | - |

### Special Commands

| Command | Description | Behavior |
|---------|-------------|----------|
| `createLink` | Insert/edit link | Opens dialog modal |
| `cleanup` | Clean HTML | Removes unsupported tags/attributes |

## Customization

### Adding Custom Toolbar Buttons

1. **Extend ToolbarButtons Component:**

```jsx
// In ToolbarButtons.jsx
const CustomButton = ({ onClick }) => (
    <button
        type="button"
        className="p-1 rounded hover:bg-gray-200"
        onClick={() => onClick('myCustomCommand')}
        onMouseDown={(e) => e.preventDefault()}
    >
        <MyCustomIcon />
    </button>
);

// Add to ToolbarButtons render
<CustomButton onClick={onCommand} />
```

2. **Handle in setupCommandListener:**

```javascript
// In ContentWidgetEditorRenderer.js
setupCommandListener() {
    const handler = (event) => {
        const { command, value } = event.detail;
        
        if (command === 'myCustomCommand') {
            // Handle custom command
            this.myCustomAction();
        } else if (command === 'createLink') {
            this.handleLinkAction();
        } else {
            this.execCommand(command, value);
        }
    };
    // ... rest of setup
}
```

### Changing Toolbar Position

The toolbar uses `fixed top-0` positioning with slide animations. To change:

```jsx
// In GlobalWysiwygToolbar.jsx
<div 
    className={`global-wysiwyg-toolbar fixed bottom-0 z-50 ... ${
        isVisible && toolbarState ? 'translate-y-0' : 'translate-y-full'
    }`}
>
  {/* Toolbar at bottom instead of top - slides up from bottom */}
</div>
```

### Adjusting State Polling Interval

```javascript
// In wysiwygToolbarManager.js
startStateUpdates() {
    this.stateUpdateInterval = setInterval(() => {
        // ...
    }, 50);  // Changed from 100ms to 50ms for faster updates
}
```

### Custom Toolbar Styling

```jsx
// In GlobalWysiwygToolbar.jsx
<div 
    className={`global-wysiwyg-toolbar fixed top-0 z-50 
                bg-gradient-to-r from-blue-50 to-purple-50 
                border-b-2 border-blue-300 px-4 py-3 shadow-lg
                transition-transform duration-300 ease-in-out ${
                    isVisible && toolbarState ? 'translate-y-0' : '-translate-y-full'
                }`}
>
    {/* Custom styling with animations */}
</div>
```

### Changing Animation Speed

```jsx
// In GlobalWysiwygToolbar.jsx
// Change from duration-300 to duration-500 for slower animation
<div 
    className={`... transition-transform duration-500 ease-in-out ${...}`}
>
```

## Debugging

### Enable Debug Logging

```javascript
// In wysiwygToolbarManager.js, add to constructor:
this.debug = true;

// Add to methods:
registerEditor(editorInstance) {
    if (this.debug) console.log('[ToolbarManager] Registering editor:', editorInstance);
    // ... rest of code
}
```

### Check Active Editor State

```javascript
// In browser console:
import { toolbarManager } from './utils/wysiwygToolbarManager';

console.log('Active editor:', toolbarManager.getActiveEditor());
console.log('Toolbar state:', toolbarManager.getToolbarState());
```

### Monitor Events

```javascript
// Subscribe to all events for debugging
toolbarManager.subscribe('editor-activated', (editor) => {
    console.log('Activated:', editor);
});

toolbarManager.subscribe('editor-deactivated', () => {
    console.log('Deactivated');
});

toolbarManager.subscribe('state-updated', (state) => {
    console.log('State:', state);
});
```

### Inspect Custom Events

```javascript
// In setupCommandListener, add logging:
const handler = (event) => {
    console.log('Command received:', event.detail);
    const { command, value } = event.detail;
    // ...
};
```

## Best Practices

### 1. Always Clean Up
```javascript
useEffect(() => {
    // Setup...
    
    return () => {
        // IMPORTANT: Clean up listeners and destroy renderer
        editorElement.removeEventListener('focus', handleFocus);
        editorElement.removeEventListener('blur', handleBlur);
        renderer.destroy();
    };
}, []);
```

### 2. Use Refs for Event Handlers
```javascript
// Store handlers in refs to ensure cleanup uses same function reference
const focusHandlerRef = useRef(null);
focusHandlerRef.current = () => renderer.activate();

editorElement.addEventListener('focus', focusHandlerRef.current);

// Later...
editorElement.removeEventListener('focus', focusHandlerRef.current);
```

### 3. Prevent Focus Loss
```javascript
// Use onMouseDown instead of onClick for toolbar buttons
<button
    onClick={handleCommand}
    onMouseDown={(e) => e.preventDefault()}  // Prevents editor blur
>
```

### 4. Debounce onChange Callbacks
```javascript
const onChange = debounce((content) => {
    // Save to server or state
}, 500);

const renderer = new ContentWidgetEditorRenderer(container, {
    onChange,
    detachedToolbar: true
});
```

### 5. Handle Edge Cases
```javascript
// Check editor exists before activating
const handleFocus = () => {
    if (rendererRef.current && !rendererRef.current.isDestroyed) {
        rendererRef.current.activate();
    }
};
```

## Troubleshooting

### Problem: Toolbar doesn't appear
**Solution:** Check that:
1. `GlobalWysiwygToolbar` is in your component tree
2. Editor has `detachedToolbar: true`
3. Focus handler calls `activate()`
4. No JavaScript errors in console

### Problem: Commands don't execute
**Solution:** Check that:
1. `setupCommandListener()` is called
2. Editor element exists
3. Custom event is dispatched correctly
4. Command name matches expected format

### Problem: State not updating
**Solution:** Check that:
1. Polling interval is running
2. `getToolbarState()` returns correct data
3. Selection is inside editor
4. No errors in state calculation

### Problem: Memory leaks
**Solution:** Ensure:
1. All event listeners removed on unmount
2. `destroy()` called when component unmounts
3. Polling stopped when no active editor
4. Subscriptions cleaned up

## Performance Tips

1. **Optimize State Polling:** Only poll when toolbar visible
2. **Memoize Callbacks:** Use `useCallback` for onChange handlers
3. **Lazy Load Editor:** Only render editor when needed
4. **Virtualize Long Lists:** For pages with many editors
5. **Debounce Updates:** Don't save on every keystroke

## Examples

### Custom Command Button
```jsx
// Add strikethrough button
const StrikethroughButton = ({ isActive, onClick }) => (
    <button
        className={`p-1 rounded ${isActive ? 'bg-blue-500 text-white' : 'hover:bg-gray-200'}`}
        onClick={() => onClick('strikeThrough')}
        onMouseDown={(e) => e.preventDefault()}
        title="Strikethrough"
    >
        <StrikethroughIcon />
    </button>
);
```

### Keyboard Shortcuts
```javascript
// Add to createEditor() in ContentWidgetEditorRenderer
this.editorElement.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + B for bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        this.execCommand('bold');
    }
    
    // Ctrl/Cmd + I for italic
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        this.execCommand('italic');
    }
});
```

### Multiple Toolbars
```javascript
// Create separate toolbar manager for different context
class SecondaryToolbarManager extends WysiwygToolbarManager {
    constructor() {
        super();
        this.toolbarId = 'secondary';
    }
}

export const secondaryToolbarManager = new SecondaryToolbarManager();
```

## Additional Resources

- [ContentEditable MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/contenteditable)
- [document.execCommand MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand)
- [Custom Events MDN](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent)
- [Selection API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Selection)

## Support

For issues or questions:
1. Check the testing guide for common problems
2. Review implementation documentation
3. Check browser console for errors
4. Create GitHub issue with reproduction steps

