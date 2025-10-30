# WYSIWYG Media Insert Implementation

## Overview

This document describes the implementation of image and collection insertion capabilities for the WYSIWYG editor (ContentWidgetEditorRenderer). Users can now insert images and media collections from the media manager, configure their display properties, edit them, and drag-and-drop to reposition them inline within the content.

## Features

### 1. Media Insertion
- **Insert Image Button**: New toolbar button in the WYSIWYG editor
- **Media Browser Integration**: Opens MediaBrowser modal for selecting images or collections
- **Configuration Options**:
  - Width: Full / Half / Third
  - Alignment: Left / Center / Right
  - Caption: Custom text (defaults to media title)

### 2. Media Editing
- **Click to Edit**: Click on any inserted media to open edit modal
- **Update Configuration**: Change width, alignment, and caption
- **Delete**: Remove media insert from content

### 3. Drag-and-Drop
- **Inline Repositioning**: Drag media inserts to reposition them within the text flow
- **Visual Feedback**: Blue drop indicator shows where the element will be placed
- **Atomic Elements**: Media inserts are treated as single units (contenteditable="false")

### 4. Collection Support
- **Gallery Rendering**: Collections render as image galleries
- **Dynamic Loading**: Collection files are fetched from the API and rendered on insert
- **Responsive Grid**: Gallery layout adapts to available space

## Implementation Details

### Files Created

#### 1. `/frontend/src/utils/mediaInsertRenderer.js`
Utility functions for media insert rendering:
- `fetchMediaData(mediaId, mediaType)` - Fetches media or collection from API
- `generateImgproxyUrl(baseUrl, width, height)` - Creates optimized image URLs
- `renderMediaImage(mediaData, config)` - Generates image HTML
- `renderMediaCollection(collectionData, config)` - Generates gallery HTML
- `createMediaInsertHTML(mediaData, config)` - Creates complete media insert HTML
- `updateMediaInsertHTML(element, mediaData, config)` - Updates existing media insert
- `extractMediaConfig(element)` - Extracts configuration from data-attributes

#### 2. `/frontend/src/components/media/MediaInsertModal.jsx`
Modal for inserting new media:
- Two-step process: select media, then configure
- MediaBrowser integration for selection
- Configuration form with width, alignment, and caption options
- Preview of selected media

#### 3. `/frontend/src/components/media/MediaEditModal.jsx`
Modal for editing existing media inserts:
- Pre-populated configuration form
- Delete button for removal
- Preview of media being edited
- Save changes to update in-place

### Files Modified

#### 1. `/frontend/src/widgets/easy-widgets/ContentWidgetEditorRenderer.js`
Major additions to the WYSIWYG editor:

**Updated cleanHTML() function**:
- Preserves media-insert divs and all data-attributes
- Skips processing for elements inside media inserts
- Maintains contenteditable="false" attribute

**New toolbar button**:
- "Insert Image" button with image icon
- Opens MediaInsertModal on click

**Media insert methods**:
- `createImageInsertButton()` - Creates toolbar button
- `openMediaInsertModal()` - Opens insert modal with React dynamic import
- `insertMediaAtCursor(config)` - Inserts media HTML at cursor position
- `setupMediaInsertListeners(element)` - Attaches click and drag handlers
- `handleMediaInsertClick(e)` - Opens edit modal on click
- `openMediaEditModal(mediaElement, initialConfig, mediaData)` - Opens edit modal
- `updateMediaInsert(element, mediaData, config)` - Updates media configuration
- `deleteMediaInsert(element)` - Removes media insert
- `handleMediaInsertDragStart(e)` - Starts drag operation
- `handleMediaInsertDragEnd(e)` - Ends drag operation
- `handleMediaInsertDragOver(e)` - Shows drop indicator
- `handleMediaInsertDrop(e)` - Completes repositioning
- `setupExistingMediaInserts()` - Sets up listeners for existing media in content

**CSS styles injection**:
- Comprehensive styles for media inserts, galleries, and drag feedback
- Responsive adjustments for mobile devices
- Float clearing for left/right aligned images

#### 2. `/frontend/src/widgets/easy-widgets/eceeeContentWidget.jsx`
- Added `namespace` prop support
- Passes namespace to ContentWidgetEditorRenderer
- Updated ContentWidgetEditor to accept and forward namespace

#### 3. `/frontend/src/components/media/index.js`
- Exported MediaInsertModal and MediaEditModal

### Data Structure

Media inserts are stored as HTML with special data-attributes:

```html
<div 
  class="media-insert media-width-full media-align-center" 
  data-media-insert="true"
  data-media-type="image|collection"
  data-media-id="123"
  data-width="full|half|third"
  data-align="left|center|right"
  contenteditable="false"
  draggable="true"
>
  <img src="..." alt="..." width="1200" height="900" loading="lazy" />
  <div class="media-caption">Caption text</div>
</div>
```

## CSS Classes

### Width Classes
- `.media-width-full` - 100% width
- `.media-width-half` - 50% width
- `.media-width-third` - 33.333% width

### Alignment Classes
- `.media-align-left` - Float left with right margin
- `.media-align-center` - Centered with auto margins
- `.media-align-right` - Float right with left margin

### Other Classes
- `.media-insert` - Base styles with hover effects
- `.media-caption` - Caption styling below images
- `.media-gallery` - Grid layout for collections
- `.media-gallery-item` - Individual gallery items
- `.media-drop-indicator` - Blue line showing drop location

## User Workflow

### Inserting Media

1. Click "Insert Image" button in toolbar
2. Select image or collection from MediaBrowser
3. Configure width, alignment, and caption
4. Click "Insert Media"
5. Media appears at cursor position or end of content

### Editing Media

1. Click on inserted media
2. Edit modal opens with current configuration
3. Update width, alignment, or caption
4. Click "Save Changes" to update
5. Or click "Delete" to remove

### Repositioning Media

1. Hover over media insert (cursor changes to move)
2. Click and drag the element
3. Blue drop indicator shows placement
4. Release to drop at new location

## Collections as Galleries

When a collection is inserted:
1. System fetches all files in the collection
2. Renders as responsive grid gallery
3. Each image optimized via imgproxy
4. Grid adapts to screen size (4 columns → 2 on mobile)

## Image Optimization

All inserted images use imgproxy for optimization:
- Full width: 1200px
- Half width: 600px  
- Third width: 400px
- Aspect ratio maintained automatically
- Lazy loading enabled

## Sanitization

The cleanHTML() function preserves media inserts:
- Media-insert divs bypass normal cleaning
- All data-attributes preserved
- Nested img and caption elements maintained
- contenteditable and draggable attributes kept

## Browser Compatibility

- Modern browsers with ES6+ support
- Drag-and-drop API support required
- Dynamic imports for React components
- CSS Grid for gallery layouts

## Future Enhancements

Potential improvements for future iterations:
- Image cropping/editing capabilities
- Multiple image selection for galleries
- Video and audio embed support
- Custom gallery layouts (masonry, carousel)
- Keyboard shortcuts for quick insertion
- Image compression settings
- Alt text management for accessibility
- Link wrapping for images

## Testing Checklist

✅ Insert single image from media browser
✅ Insert collection from media browser  
✅ Edit existing media insert (change width, alignment, caption)
✅ Delete media insert via modal and keyboard
✅ Drag-and-drop repositioning works smoothly
✅ Media inserts survive cleanHTML() sanitization
✅ Collections render as galleries with all images
✅ Width options render correctly (full/half/third)
✅ Alignment options work (left/center/right with text wrap)
✅ Captions display correctly below images
✅ Imgproxy optimization works for inserted images

## Dependencies

- React 19 (for modals)
- MediaBrowser component
- mediaApi (for fetching media data)
- imgproxy (for image optimization)
- Existing ContentWidgetEditorRenderer infrastructure

## Notes

- Namespace parameter is optional; defaults to null if not provided
- Media inserts use dynamic imports to avoid bundle bloat
- Vanilla JS approach maintains compatibility with existing editor
- React modals rendered via portals to document.body
- CSS styles injected once on script load

