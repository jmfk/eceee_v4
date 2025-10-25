# Global WYSIWYG Toolbar Testing Guide

## Quick Start Testing

### Prerequisites
1. Docker services running (backend, frontend, db, redis)
2. User account with access to page editor
3. At least one page created with content widgets

### Basic Test (2 minutes)
```bash
# Start the application
docker-compose up backend frontend

# Navigate to http://localhost:3000
# Login
# Go to Pages → Edit any page
# Click into a content widget editor
# Verify toolbar appears at top of page
# Click Bold button and type some text
# Click outside editor
# Verify toolbar disappears
```

## Detailed Testing Checklist

### 1. Toolbar Visibility ✓

**Test:** Toolbar appears when editor is focused

- [ ] Navigate to page editor
- [ ] Click inside content widget editor
- [ ] **Expected:** Toolbar appears between top nav and content
- [ ] Click outside editor
- [ ] **Expected:** Toolbar disappears

**Test:** Toolbar visibility persists across tab switches

- [ ] Focus editor (toolbar appears)
- [ ] Switch to Settings tab
- [ ] Switch back to Content tab
- [ ] Editor should still be focused
- [ ] **Expected:** Toolbar still visible

### 2. Basic Formatting Commands ✓

**Test:** Bold formatting

- [ ] Focus editor
- [ ] Click Bold button in toolbar
- [ ] Type "Bold Text"
- [ ] **Expected:** Text appears bold
- [ ] Select the text
- [ ] **Expected:** Bold button highlighted in toolbar
- [ ] Click Bold button again
- [ ] **Expected:** Bold removed, button no longer highlighted

**Test:** Italic formatting

- [ ] Focus editor
- [ ] Click Italic button
- [ ] Type "Italic Text"
- [ ] **Expected:** Text appears italic
- [ ] Select the text
- [ ] **Expected:** Italic button highlighted
- [ ] Click Italic again
- [ ] **Expected:** Italic removed

**Test:** Combined formatting

- [ ] Select some text
- [ ] Click Bold button
- [ ] Click Italic button
- [ ] **Expected:** Text is both bold and italic
- [ ] **Expected:** Both buttons highlighted in toolbar

### 3. Format Dropdown ✓

**Test:** Paragraph formatting

- [ ] Focus editor
- [ ] Click format dropdown
- [ ] **Expected:** Dropdown shows: Paragraph, Heading 1, Heading 2, Heading 3
- [ ] Select "Heading 1"
- [ ] Type "My Heading"
- [ ] **Expected:** Text appears as H1
- [ ] **Expected:** Dropdown label shows "Heading 1"

**Test:** Format state detection

- [ ] Create several paragraphs with different headings
- [ ] Click in H1 text
- [ ] **Expected:** Dropdown shows "Heading 1"
- [ ] Click in H2 text
- [ ] **Expected:** Dropdown shows "Heading 2"
- [ ] Click in normal paragraph
- [ ] **Expected:** Dropdown shows "Paragraph"

### 4. List Formatting ✓

**Test:** Bullet list

- [ ] Focus editor
- [ ] Click Bullet List button
- [ ] Type "Item 1" and press Enter
- [ ] Type "Item 2" and press Enter
- [ ] **Expected:** Two bullet list items
- [ ] **Expected:** Bullet List button highlighted
- [ ] Click Bullet List button again
- [ ] **Expected:** List formatting removed

**Test:** Numbered list

- [ ] Focus editor
- [ ] Click Numbered List button
- [ ] Type "First" and press Enter
- [ ] Type "Second" and press Enter
- [ ] **Expected:** Two numbered list items (1, 2)
- [ ] **Expected:** Numbered List button highlighted

**Test:** List nesting (Tab/Shift+Tab)

- [ ] Create a bullet list
- [ ] Press Tab on second item
- [ ] **Expected:** Item indents (nested list)
- [ ] Press Shift+Tab
- [ ] **Expected:** Item un-indents

### 5. Link Management ✓

**Test:** Insert new link

- [ ] Focus editor
- [ ] Type "Click here"
- [ ] Select the text
- [ ] Click Link button in toolbar
- [ ] **Expected:** Link dialog appears
- [ ] Enter URL: "https://example.com"
- [ ] Enter text: "Click here"
- [ ] Check "Open in new tab"
- [ ] Click "Insert Link"
- [ ] **Expected:** Link created
- [ ] **Expected:** Link button highlighted when link selected

**Test:** Edit existing link

- [ ] Click on a link
- [ ] Click Link button
- [ ] **Expected:** Dialog shows with existing URL and text
- [ ] Change URL to "https://newsite.com"
- [ ] Click "Update Link"
- [ ] **Expected:** Link updates

**Test:** Remove link

- [ ] Click on a link
- [ ] Click Link button
- [ ] Click "Remove Link" button
- [ ] **Expected:** Link removed, text remains

### 6. Undo/Redo ✓

**Test:** Undo

- [ ] Focus editor
- [ ] Type "Test text"
- [ ] Click Undo button
- [ ] **Expected:** Text disappears (or reverts to previous state)

**Test:** Redo

- [ ] After undo
- [ ] Click Redo button
- [ ] **Expected:** Text reappears

**Test:** Multiple undo/redo

- [ ] Make several formatting changes
- [ ] Click Undo multiple times
- [ ] **Expected:** Changes revert in reverse order
- [ ] Click Redo multiple times
- [ ] **Expected:** Changes reapply

### 7. HTML Cleanup ✓

**Test:** Clean pasted content

- [ ] Copy formatted text from Word/Google Docs (with styles, colors, etc.)
- [ ] Paste into editor
- [ ] **Expected:** Some formatting may be messy
- [ ] Click Cleanup button
- [ ] **Expected:** Only basic formatting remains (headings, bold, italic, links)
- [ ] **Expected:** No colors, fonts, or complex styling

**Test:** Selective cleanup

- [ ] Create content with bold and italic text
- [ ] Select only portion of text
- [ ] Click Cleanup button
- [ ] **Expected:** Only selected text is cleaned

### 8. Multiple Editors ✓

**Test:** Switch between editors

- [ ] Create page with 2+ content widgets
- [ ] Click in first editor
- [ ] **Expected:** Toolbar appears
- [ ] Apply bold formatting
- [ ] Click in second editor
- [ ] **Expected:** Toolbar still visible
- [ ] **Expected:** Bold button no longer highlighted
- [ ] Apply italic formatting in second editor
- [ ] **Expected:** Italic button highlighted
- [ ] Click back in first editor
- [ ] **Expected:** Bold button highlighted again

**Test:** Commands apply to active editor only

- [ ] Focus first editor
- [ ] Type "Editor 1"
- [ ] Focus second editor (don't blur first)
- [ ] Type "Editor 2"
- [ ] Click Bold button
- [ ] **Expected:** Only "Editor 2" becomes bold
- [ ] **Expected:** "Editor 1" unchanged

### 9. State Updates ✓

**Test:** Real-time state tracking

- [ ] Focus editor
- [ ] Type text and make bold
- [ ] Use keyboard shortcut Ctrl/Cmd+B to toggle
- [ ] **Expected:** Toolbar button state updates
- [ ] Use document.execCommand from browser console
- [ ] **Expected:** Toolbar reflects changes (may take up to 100ms)

**Test:** Format detection across elements

- [ ] Create H1, H2, paragraph, list
- [ ] Click through each element
- [ ] **Expected:** Toolbar updates to show correct state for each

### 10. Edge Cases ✓

**Test:** Rapid focus changes

- [ ] Quickly click between multiple editors
- [ ] **Expected:** Toolbar always shows correct state
- [ ] **Expected:** No toolbar flickering or stuck states

**Test:** Editor destruction

- [ ] Focus editor (toolbar appears)
- [ ] Delete the widget containing editor
- [ ] **Expected:** Toolbar disappears cleanly
- [ ] **Expected:** No console errors

**Test:** Page navigation

- [ ] Focus editor (toolbar appears)
- [ ] Navigate to different page
- [ ] **Expected:** Toolbar disappears
- [ ] Return to original page
- [ ] **Expected:** Toolbar reappears when editor focused

**Test:** Long content

- [ ] Create very long content (many paragraphs)
- [ ] Scroll down in editor
- [ ] **Expected:** Toolbar stays at top (sticky)
- [ ] **Expected:** Toolbar always accessible

### 11. Cross-Browser Testing ✓

**Chrome/Chromium:**
- [ ] All basic tests pass
- [ ] Toolbar renders correctly
- [ ] Commands work as expected

**Firefox:**
- [ ] All basic tests pass
- [ ] Format dropdown works
- [ ] Special commands (link, cleanup) work

**Safari (if available):**
- [ ] All basic tests pass
- [ ] document.execCommand compatibility
- [ ] Toolbar styling correct

**Edge:**
- [ ] All basic tests pass
- [ ] No Chromium-specific issues

### 12. Accessibility Testing ✓

**Keyboard Navigation:**
- [ ] Tab to toolbar buttons
- [ ] **Expected:** Focus visible
- [ ] Press Enter/Space on buttons
- [ ] **Expected:** Commands execute

**Screen Reader:**
- [ ] Enable screen reader
- [ ] Navigate to toolbar
- [ ] **Expected:** Buttons announced correctly
- [ ] **Expected:** Button states announced

### 13. Performance Testing ✓

**Test:** State polling overhead

- [ ] Open browser DevTools Performance tab
- [ ] Focus editor
- [ ] Record for 10 seconds
- [ ] **Expected:** No performance issues
- [ ] **Expected:** Polling interval ~100ms visible in timeline

**Test:** Multiple editors memory

- [ ] Create page with 10+ content widgets
- [ ] Focus each editor in sequence
- [ ] Check memory usage
- [ ] **Expected:** No significant memory growth
- [ ] **Expected:** Clean activation/deactivation

**Test:** Command latency

- [ ] Focus editor
- [ ] Click Bold button
- [ ] **Expected:** Immediate response (<50ms perceived)
- [ ] Check state update in toolbar
- [ ] **Expected:** Update within 100ms

## Automated Testing

### Unit Tests (Future)
```javascript
// Example tests to add
describe('WysiwygToolbarManager', () => {
  test('registers editor correctly', () => {
    const editor = createMockEditor();
    toolbarManager.registerEditor(editor);
    expect(toolbarManager.getActiveEditor()).toBe(editor);
  });

  test('dispatches commands to active editor', () => {
    const editor = createMockEditor();
    toolbarManager.registerEditor(editor);
    toolbarManager.dispatchCommand('bold');
    // Verify event dispatched
  });
});
```

### Integration Tests (Future)
```javascript
// Example integration test
describe('Global Toolbar Integration', () => {
  test('toolbar appears when editor focused', async () => {
    render(<PageEditor />);
    const editor = screen.getByRole('textbox');
    fireEvent.focus(editor);
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });
});
```

## Bug Reporting Template

When reporting issues, include:

```markdown
## Bug Description
Brief description of the issue

## Steps to Reproduce
1. Navigate to...
2. Click on...
3. Observe...

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- Browser: Chrome 120
- OS: macOS 14
- Docker: Yes/No

## Screenshots
[Attach screenshots if relevant]

## Console Errors
[Copy any console errors]

## Additional Context
[Any other relevant information]
```

## Common Issues and Solutions

### Issue: Toolbar doesn't appear
**Check:**
- Editor has `detachedToolbar: true` option
- Focus event handlers are attached
- No JavaScript errors in console
- GlobalWysiwygToolbar component rendered in layout

### Issue: Commands don't work
**Check:**
- Custom event listener set up (`setupCommandListener()`)
- Event detail has correct structure
- Editor element exists and is editable
- No conflicts with other event handlers

### Issue: Toolbar state wrong
**Check:**
- State polling is running (100ms interval)
- `getToolbarState()` method implemented correctly
- Selection is inside editor element
- No Z-index issues hiding active state

### Issue: Toolbar doesn't disappear
**Check:**
- Blur event handler attached
- `deactivate()` called on blur
- No focus trapping preventing blur
- Toolbar manager unregister working

## Test Results Log

Date: ___________
Tester: ___________

| Test Category | Status | Notes |
|--------------|--------|-------|
| Toolbar Visibility | ⬜ Pass ⬜ Fail | |
| Basic Formatting | ⬜ Pass ⬜ Fail | |
| Format Dropdown | ⬜ Pass ⬜ Fail | |
| List Formatting | ⬜ Pass ⬜ Fail | |
| Link Management | ⬜ Pass ⬜ Fail | |
| Undo/Redo | ⬜ Pass ⬜ Fail | |
| HTML Cleanup | ⬜ Pass ⬜ Fail | |
| Multiple Editors | ⬜ Pass ⬜ Fail | |
| State Updates | ⬜ Pass ⬜ Fail | |
| Edge Cases | ⬜ Pass ⬜ Fail | |
| Cross-Browser | ⬜ Pass ⬜ Fail | |
| Accessibility | ⬜ Pass ⬜ Fail | |
| Performance | ⬜ Pass ⬜ Fail | |

## Conclusion

This testing guide provides comprehensive coverage of the Global WYSIWYG Toolbar functionality. Follow the checklist systematically to ensure all features work correctly. Report any issues using the bug template provided.

