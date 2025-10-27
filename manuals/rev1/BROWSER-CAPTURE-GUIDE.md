# Browser Screenshot Capture Guide

This guide explains how to use browser MCP tools to automatically capture screenshots for the user manual.

## Prerequisites

1. **Browser MCP Server** must be configured and running
2. **Frontend application** must be running at http://localhost:3000
3. **Login credentials** for accessing the CMS
4. **Sample content** loaded in the CMS for meaningful screenshots

## Browser MCP Tools Overview

The browser MCP tools provide several functions for automated screenshot capture:

- `navigateTo(url)` - Navigate to a specific URL
- `click(selector)` - Click on an element
- `type(selector, text)` - Type text into an input field
- `takeScreenshot(path)` - Capture and save screenshot
- `waitFor(selector)` - Wait for element to appear
- `scroll(x, y)` - Scroll the page
- `setViewport(width, height)` - Set browser window size

## Recommended Workflow

### 1. Setup

```javascript
// Set viewport to standard desktop resolution
setViewport(1920, 1080)

// Navigate to the application
navigateTo("http://localhost:3000")

// Login (adjust selectors as needed)
type("#username", "admin")
type("#password", "password")
click("#login-button")
waitFor(".dashboard") // Wait for login to complete
```

### 2. Screenshot Capture Pattern

For each screenshot, follow this pattern:

```javascript
// 1. Navigate to the feature
navigateTo("http://localhost:3000/pages")

// 2. Wait for content to load
waitFor(".page-tree")

// 3. Perform any necessary interactions
click(".expand-button")

// 4. Wait for animations/transitions
wait(500) // milliseconds

// 5. Capture screenshot
takeScreenshot("/Users/jmfk/code/eceee_v4/manuals/rev1/images/page-tree-view.png")
```

## Screenshot Capture Checklist

### Page Management Screenshots

#### 1. page-tree-view.png
```javascript
navigateTo("http://localhost:3000/pages")
waitFor(".page-tree")
// Expand some pages to show hierarchy
click(".page-item[data-page-id='...'] .expand-icon")
wait(300)
takeScreenshot("manuals/rev1/images/page-tree-view.png")
```

#### 2. create-new-page.png
```javascript
navigateTo("http://localhost:3000/pages")
waitFor(".page-tree")
click("button[data-action='new-page']")
waitFor(".create-page-dialog")
wait(300)
takeScreenshot("manuals/rev1/images/create-new-page.png")
```

#### 3. page-editor-interface.png
```javascript
navigateTo("http://localhost:3000/pages/[page-id]/edit")
waitFor(".page-editor")
wait(500) // Wait for editor to fully render
takeScreenshot("manuals/rev1/images/page-editor-interface.png")
```

### Widget System Screenshots

#### 8. widget-library-panel.png
```javascript
navigateTo("http://localhost:3000/pages/[page-id]/edit")
waitFor(".widget-library")
// Ensure widget library is open
if (!isVisible(".widget-library.open")) {
  click(".toggle-widget-library")
  wait(300)
}
takeScreenshot("manuals/rev1/images/widget-library-panel.png")
```

#### 9. add-widget-to-page.png
```javascript
navigateTo("http://localhost:3000/pages/[page-id]/edit")
waitFor(".widget-library")
// This may require manual capture during drag operation
// Or use selenium-style drag and drop if available
dragStart(".widget-library .text-block-widget")
wait(100)
takeScreenshot("manuals/rev1/images/add-widget-to-page.png")
```

### Publishing Workflow Screenshots

#### 32. publish-page-dialog.png
```javascript
navigateTo("http://localhost:3000/pages/[page-id]/edit")
waitFor(".page-editor")
click("button[data-action='publish']")
waitFor(".publish-dialog")
wait(300)
takeScreenshot("manuals/rev1/images/publish-page-dialog.png")
```

#### 35. publication-status-dashboard.png
```javascript
navigateTo("http://localhost:3000/publication/dashboard")
waitFor(".publication-dashboard")
wait(500) // Wait for stats to load
takeScreenshot("manuals/rev1/images/publication-status-dashboard.png")
```

## Automated Capture Script Template

Here's a template for automating all screenshot captures:

```javascript
const screenshots = [
  {
    name: "page-tree-view.png",
    setup: async () => {
      await navigateTo("http://localhost:3000/pages")
      await waitFor(".page-tree")
      // Expand some pages
      await click(".page-item:first-child .expand-icon")
      await wait(300)
    }
  },
  {
    name: "create-new-page.png",
    setup: async () => {
      await navigateTo("http://localhost:3000/pages")
      await waitFor(".page-tree")
      await click("button[data-action='new-page']")
      await waitFor(".create-page-dialog")
      await wait(300)
    }
  },
  // ... add all other screenshots
]

// Execute all captures
for (const screenshot of screenshots) {
  console.log(`Capturing ${screenshot.name}...`)
  await screenshot.setup()
  await takeScreenshot(`manuals/rev1/images/${screenshot.name}`)
  console.log(`✓ ${screenshot.name} captured`)
  await wait(500) // Pause between captures
}

console.log("All screenshots captured!")
```

## Tips for Quality Screenshots

### 1. Consistent Window Size
Always use the same viewport size:
```javascript
setViewport(1920, 1080)
```

### 2. Wait for Content
Don't capture too quickly:
```javascript
waitFor(".content-loaded")
wait(500) // Additional buffer for animations
```

### 3. Clean State
- Clear any notifications or popups before capturing
- Reset to default zoom level
- Hide browser dev tools
- Use consistent sample data

### 4. Highlight Important Elements
If the browser tools support it:
```javascript
highlightElement(".important-button", { color: "red", width: 2 })
takeScreenshot("...")
removeHighlight()
```

### 5. Handle Modals and Overlays
```javascript
// Open modal
click(".open-modal-button")
waitFor(".modal.visible")
wait(300) // Wait for animation

// Capture
takeScreenshot("...")

// Close modal
click(".modal .close-button")
waitFor(".modal", { hidden: true })
```

## Common Issues and Solutions

### Issue: Screenshot is blank
**Solution**: Increase wait time before capture
```javascript
wait(1000) // Increase from 500ms
```

### Issue: Modal/Dialog not visible
**Solution**: Ensure proper wait and check visibility
```javascript
waitFor(".dialog", { visible: true })
```

### Issue: Content cut off
**Solution**: Scroll to element before capture
```javascript
scrollIntoView(".target-element")
wait(300)
```

### Issue: Dynamic content not loaded
**Solution**: Wait for specific element or network idle
```javascript
waitForNetworkIdle()
// Or wait for specific element
waitFor(".data-loaded-indicator")
```

## Device-Specific Screenshots

For mobile/tablet views:

```javascript
// Mobile portrait
setViewport(375, 667)
navigateTo("http://localhost:3000/pages")
waitFor(".page-tree")
takeScreenshot("manuals/rev1/images/mobile-page-tree.png")

// Tablet
setViewport(768, 1024)
navigateTo("http://localhost:3000/pages")
waitFor(".page-tree")
takeScreenshot("manuals/rev1/images/tablet-page-tree.png")

// Reset to desktop
setViewport(1920, 1080)
```

## Capture Progress Tracking

Create a checklist script:

```javascript
const screenshotsNeeded = 51
let captured = 0

function captureWithProgress(filename, setupFn) {
  await setupFn()
  await takeScreenshot(`manuals/rev1/images/${filename}`)
  captured++
  console.log(`Progress: ${captured}/${screenshotsNeeded} (${Math.round(captured/screenshotsNeeded*100)}%)`)
}

// Use it
await captureWithProgress("page-tree-view.png", async () => {
  await navigateTo("http://localhost:3000/pages")
  await waitFor(".page-tree")
})
```

## File Organization

Screenshots should be saved to:
```
/Users/jmfk/code/eceee_v4/manuals/rev1/images/
```

Verify after capture:
```javascript
const fs = require('fs')
const captured = fs.readdirSync('/Users/jmfk/code/eceee_v4/manuals/rev1/images')
console.log(`Captured ${captured.length} of 51 screenshots`)
console.log('Missing:', /* calculate missing */)
```

## Next Steps After Capture

1. **Verify all screenshots captured**
   - Check file count: should be 51 PNG files
   - Check file sizes: should be >10KB each (not blank)

2. **Review quality**
   - Open each screenshot
   - Verify text is readable
   - Check that UI elements are clearly visible
   - Ensure no sensitive data is visible

3. **Optimize if needed**
   - Use image optimization tools (pngquant, ImageOptim)
   - Reduce file size without losing quality
   - Target: <500KB per screenshot

4. **Test documentation**
   - Open README.md in a markdown viewer
   - Verify all images display correctly
   - Check that images match their context

5. **Update completion status**
   - Update SCREENSHOTS-NEEDED.md completion count
   - Mark manual as complete in MANUAL-SUMMARY.md

## Troubleshooting Browser MCP Tools

### Tools Not Available
Check if MCP server is running:
```bash
# Check MCP server status
curl http://localhost:YOUR_MCP_PORT/health
```

### Can't Connect to Frontend
Verify frontend is running:
```bash
# Check if frontend is accessible
curl http://localhost:3000
```

### Selectors Not Working
Use browser inspector to find correct selectors:
1. Open browser dev tools
2. Inspect the element
3. Copy the selector
4. Test in browser console first
5. Use in script

## Alternative: Manual Screenshot Tool

If browser MCP tools remain unavailable, use this manual workflow:

1. Install a screenshot tool (Lightshot, ShareX, Snagit)
2. Configure hotkey for region capture
3. Follow SCREENSHOTS-NEEDED.md systematically
4. Save each with exact filename to images/ directory
5. Verify quality and completeness

---

**Ready to capture screenshots when browser MCP tools become available!**


