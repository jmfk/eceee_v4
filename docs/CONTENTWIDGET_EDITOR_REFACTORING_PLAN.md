# ContentWidget Internal Editor Refactoring Plan

You're right - this is specifically about the ContentWidget's internal WYSIWYG editor, not the broader content editing system. Here's the focused plan updated after renaming ContentEditor to ContentWidgetEditor:

## Current State

- `ContentWidget.jsx` contains a `ContentWidgetEditor` React component (lines 47-186)
- Uses React with direct DOM manipulation via `document.execCommand()`
- Has toolbar with Bold, Italic, Format dropdown, Lists, Undo/Redo
- Includes HTML cleaning and paste handling
- The component has been renamed from `ContentEditor` to `ContentWidgetEditor` to clarify its specific purpose

## Refactoring Scope

**Only refactor:** The internal `ContentWidgetEditor` component within `ContentWidget.jsx`

**Keep unchanged:**
- ContentWidget's React wrapper and props interface
- Widget action handlers (format-content, clear-formatting, insert-template)
- Theme integration via `useContentEditorTheme`
- Event emission system via `useWidgetEventEmitter`
- The broader content editing system (`ObjectContentEditor.jsx`, etc.)

## Implementation Plan

### Phase 1: Create Vanilla Editor

1. **Create `ContentWidgetEditorRenderer.js`** - Vanilla JS class for the editor internals
   - Implement toolbar - All current buttons (Bold, Italic, Format, Lists, Undo/Redo)
   - Implement contentEditable area - Direct DOM event handling
   - Port HTML cleaning - Move `cleanHTML` function to vanilla JS
   - Handle paste events and keyboard shortcuts (Tab, Enter)

### Phase 2: Integration

2. **Update ContentWidget** - Replace `<ContentWidgetEditor>` with vanilla renderer
   - Preserve callbacks - Maintain `onChange` communication with React
   - Keep action handlers - Ensure existing widget menu actions still work
   - Maintain theme integration - Apply theme classes to vanilla editor
   - Preserve event emission - Keep widget change events working

### Phase 3: Testing & Cleanup

3. **Test functionality** - Verify all editing features work
   - Bold, Italic formatting
   - Format dropdown (H1-H6, Paragraph)
   - Lists (ordered/unordered)
   - Undo/Redo functionality
   - Paste handling and HTML cleaning
   - Widget menu actions (format-content, clear-formatting, insert-template)

4. **Remove old code** - Delete React `ContentWidgetEditor` component

## Benefits of This Focused Approach

✅ Eliminates React/DOM conflicts in just this widget  
✅ Improves performance for content editing  
✅ Maintains all existing APIs and integrations  
✅ Minimal impact on rest of system  
✅ Easier to add advanced editing commands later  

## Technical Details

The ContentWidget will still be a React component, but its internal editor will be vanilla JS - similar to how LayoutRenderer works within React components.

### Current Component Structure
```jsx
// ContentWidget.jsx (lines 47-186)
const ContentWidgetEditor = memo(({ content, onChange, className }) => {
    // React component with contentEditable and toolbar
})
```

### Target Structure
```jsx
// ContentWidget.jsx - React wrapper remains
const ContentWidget = memo(({ ... }) => {
    // Use vanilla ContentWidgetEditorRenderer instead of React component
    const editorRenderer = new ContentWidgetEditorRenderer(...)
})
```

### Files Affected
- `ContentWidget.jsx` - Replace React editor with vanilla renderer
- `ContentWidgetEditorRenderer.js` - New vanilla JS editor class (to be created)

This refactoring maintains the clear naming convention established by renaming ContentEditor to ContentWidgetEditor, making it obvious this is specifically for the ContentWidget's internal editing functionality.
