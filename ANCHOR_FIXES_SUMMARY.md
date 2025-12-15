# Anchor Selection and Link Resolution Fixes

## Issues Fixed

### 1. Anchor Selection Not Working ✅
**Problem**: When selecting a page in the Link Modal, anchors weren't displayed even though the backend returned them correctly.

**Root Cause**: The API client returns an Axios response with structure `{data: [...], status: 200, ...}`, but the response parser only checked for direct array format or `response.results` format, missing `response.data`.

**Fix**: Added check for `response.data` format in LinkPicker.jsx AnchorSelector queryFn.

**Files Changed**:
- `frontend/src/components/LinkPicker.jsx` - Added `if (response && Array.isArray(response.data))` check

### 2. Current Page Quick Select ✅
**Problem**: No easy way to select the current page for anchor links (common use case).

**Solution**: Added a "Current Page" button at the top of the page browser that appears when `currentPageId` is available.

**Files Changed**:
- `frontend/src/components/LinkPicker.jsx` - Added Current Page button in InternalPageTab

### 3. Link Resolution in ContentCardWidget ✅
**Problem**: Links stored as JSON objects (e.g., `{"type":"internal","pageId":30,"anchor":"test1"}`) weren't being resolved to proper URLs in ContentCardWidget, resulting in URL-encoded JSON in hrefs.

**Root Cause**: ContentCardWidget's `prepare_template_context()` didn't resolve links in HTML content, unlike ContentWidget which does.

**Fix**: Added link resolution to ContentCardWidget similar to ContentWidget implementation.

**Files Changed**:
- `backend/easy_widgets/widgets/content_card.py` - Added `resolve_links_in_html()` call in `prepare_template_context()`

## Testing

### Test Anchor Selection
1. Open any page editor
2. Add or edit a ContentWidget or TableWidget
3. Select text and click the link button
4. Go to "Internal Page" tab
5. Select a page with anchors (like "Summer Study" with test1, test2, test anchors)
6. **Expected**: Right panel shows the page info and lists all available anchors
7. Click an anchor to add it to the link

### Test Current Page Button
1. Open link modal from any editor
2. Go to "Internal Page" tab
3. **Expected**: See a blue "Current Page" button at the top
4. Click it to quickly select the current page
5. **Expected**: Anchors for the current page are displayed

### Test Link Resolution
1. Create a ContentCardWidget with HTML content containing a link
2. Use the link modal to create an internal link with an anchor
3. Save and view the page in the backend (published view)
4. **Expected**: Link href should be a proper URL like `/summer-study/#test1` not URL-encoded JSON

## Summary

- **Fixed**: Axios response.data format now recognized for anchor fetching
- **Added**: Current Page quick select button for anchor links
- **Fixed**: ContentCardWidget now resolves link objects to proper URLs
- **Removed**: All debug instrumentation from production code

