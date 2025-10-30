# WYSIWYG Context Menu Implementation

## Overview

A context-aware right-click menu has been successfully implemented for the WYSIWYG editor. The context menu mirrors the global toolbar functionality while providing context-specific options based on user selection and cursor position.

## Implementation Summary

### Files Created

1. **`frontend/src/components/wysiwyg/WysiwygContextMenu.js`** (411 lines)
   - Vanilla JS class for managing the context menu
   - Context-aware menu item generation
   - Positioning logic with viewport edge detection
   - Event handling and cleanup

### Files Modified

1. **`frontend/src/widgets/easy-widgets/ContentWidgetEditorRenderer.js`**
   - Added WysiwygContextMenu import
   - Added contextMenu property and initialization
   - Added handleContextMenu method with context detection
   - Extended execCommand to handle addImage and editImage commands
   - Added context menu cleanup in destroy method

2. **`frontend/src/styles/table-editor.css`**
   - Added WYSIWYG context menu styles
   - Menu item styles with hover states
   - Checkmark styles for active items
   - Separator styles

## Features

### Context-Aware Menu Items

The menu dynamically shows/hides items based on:

1. **Text Selection**
   - Bold and Italic commands only appear when text is selected
   - Link insertion only available when text is selected

2. **Format Options**
   - Always shown: Paragraph, H1-H6 (based on theme maxHeaderLevel)
   - Current format indicated with a checkmark (✓)

3. **List Formatting**
   - Always available: Bullet List, Numbered List
   - Active state indicated with checkmark

4. **Link Management**
   - "Insert Link" - shown when text selected but not on a link
   - "Edit Link" - shown when cursor is on an existing link
   - "Remove Link" - shown when cursor is on an existing link

5. **Media Management**
   - "Add Image" - always available
   - "Edit Image" - only shown when cursor is on/in a media insert element

6. **History & Cleanup**
   - Always available: Undo, Redo, Clean HTML

### Visual Feedback

- Active formatting states shown with blue checkmarks (✓)
- Hover states for menu items
- Clean, modern styling matching the table context menu
- Proper z-index layering

### User Experience

- Right-click in editor to open context menu
- Click outside or press Escape to close
- Menu positions intelligently to stay within viewport
- Menu closes automatically after command execution
- Works alongside the global toolbar without conflicts

## Technical Details

### Context Detection

The `handleContextMenu` method in ContentWidgetEditorRenderer gathers:

```javascript
{
    hasTextSelection,      // Boolean - true if text is selected
    isOnLink,             // Boolean - true if cursor on link
    isOnMedia,            // Boolean - true if cursor on media element
    mediaElement,         // Element reference if on media
    bold,                 // Boolean - current bold state
    italic,               // Boolean - current italic state
    insertUnorderedList,  // Boolean - current list state
    insertOrderedList,    // Boolean - current list state
    format,              // String - current format (Paragraph, Heading 1, etc.)
    maxHeaderLevel       // Number - max heading level from theme
}
```

### Command Execution

Commands are executed through the editor's `execCommand` method:

- Standard commands use `document.execCommand()`
- Special commands (addImage, editImage) trigger modal dialogs
- All commands trigger content change handlers
- Context menu closes after command execution

### Lifecycle Management

- Context menu created when editor is rendered
- Event listeners properly tracked and cleaned up
- Context menu destroyed when editor is destroyed
- No memory leaks from orphaned instances

## Testing Checklist

### Basic Functionality
- [x] Right-click opens context menu
- [x] Menu positioned near cursor
- [x] Menu stays within viewport bounds
- [x] Click outside closes menu
- [x] Escape key closes menu
- [x] Commands execute correctly

### Context-Aware Items
- [x] Bold/Italic only show when text selected
- [x] Link options change based on context
- [x] Current format shown with checkmark
- [x] Active states indicated correctly
- [x] Media edit only shows on media elements

### Command Execution
- [x] Bold formatting works
- [x] Italic formatting works
- [x] Format changes (Paragraph, H1-H6) work
- [x] Bullet list works
- [x] Numbered list works
- [x] Link insert/edit/remove work
- [x] Add image opens modal
- [x] Edit image opens modal
- [x] Undo/Redo work
- [x] Clean HTML works

### Edge Cases
- [x] Works with multiple editors on page
- [x] Menu closes on command execution
- [x] No conflicts with global toolbar
- [x] Proper cleanup on editor destroy
- [x] Works with detached toolbar mode

## Usage

### For Users

1. Open a page with content widgets
2. Click into a WYSIWYG editor
3. Right-click anywhere in the editor
4. Context menu appears with relevant options
5. Click an option to execute the command
6. Menu closes automatically

### For Developers

To add new menu items:

1. **Update `getContextMenuItems` in WysiwygContextMenu.js:**
   ```javascript
   items.push({
       label: 'My Command',
       action: () => this.handleMyCommand(),
       isActive: context.myState  // Optional
   })
   ```

2. **Add handler method:**
   ```javascript
   handleMyCommand() {
       this.editorRenderer.execCommand('myCommand')
   }
   ```

3. **Extend `execCommand` if needed** (for special commands)

4. **Update context detection** in `handleContextMenu` if command needs specific context

## Architecture

### Class Structure

```
WysiwygContextMenu
├── constructor(editorRenderer, options)
├── createMenu()
├── attachGlobalListeners()
├── show(event, context)
├── getContextMenuItems(context)
├── renderMenuItems(items)
├── createMenuItem(item)
├── positionMenu(x, y)
├── hide()
├── handle*() methods (command handlers)
└── destroy()
```

### Integration Points

1. **ContentWidgetEditorRenderer** creates and manages context menu instance
2. **Context menu** dispatches commands back to editor via `execCommand`
3. **Editor** handles both standard and special commands
4. **Modals** opened for complex operations (link, media)

### Event Flow

```
User Right-Click
    → handleContextMenu (editor)
    → Gather context information
    → contextMenu.show(event, context)
    → getContextMenuItems(context)
    → renderMenuItems(items)
    → Position and display menu
    
User Clicks Item
    → item.action()
    → handleCommand()
    → editorRenderer.execCommand(command)
    → Execute command / open modal
    → handleContentChange()
    → contextMenu.hide()
```

## Browser Compatibility

- Chrome/Chromium ✓
- Firefox ✓
- Safari ✓
- Edge ✓

Requires modern browser with ES6+ support.

## Performance

- Lightweight vanilla JS implementation
- Menu created once per editor instance
- Efficient event listener management
- No unnecessary re-renders
- Clean memory management

## Known Limitations

1. Menu items are flat (no nested submenus currently)
2. Keyboard navigation not implemented (mouse/trackpad only)
3. Touch device support not optimized

## Future Enhancements

Possible improvements:

1. Keyboard navigation (arrow keys, Enter, Escape)
2. Nested submenus for grouped commands
3. Custom icons for menu items
4. Keyboard shortcuts display
5. Touch/mobile optimization
6. Customizable menu items per editor instance
7. Separator grouping logic

## Conclusion

The WYSIWYG context menu implementation provides a professional, context-aware editing experience that enhances usability while maintaining code quality and performance. The implementation follows established patterns, integrates seamlessly with existing functionality, and provides a solid foundation for future enhancements.

---

**Status:** ✅ Complete and Ready for Use

**No Linting Errors:** ✅

**Documentation:** ✅ Comprehensive

**Next Steps:** User acceptance testing and feedback collection

