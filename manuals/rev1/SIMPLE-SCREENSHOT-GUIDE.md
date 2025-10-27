# Simple Screenshot Capture Guide

**Goal**: Capture ~50 screenshots for the user manual in about 1 hour

## Before You Start

1. **Start the frontend**:
   ```bash
   cd /Users/jmfk/code/eceee_v4
   docker-compose up frontend
   ```

2. **Open browser**: Navigate to http://localhost:3000

3. **Login** to the CMS with your admin credentials

4. **Make sure you have sample content**: Pages, widgets, etc. to make screenshots meaningful

## How to Capture Screenshots on Mac

**Quick capture**: `Cmd + Shift + 4`
- Cursor becomes crosshair
- Click and drag to select area
- Release to save to Desktop

**Tip**: After capturing, rename and move to `/Users/jmfk/code/eceee_v4/manuals/rev1/images/`

Or use `Cmd + Shift + 4` then `Spacebar` to capture entire window.

## Screenshot Checklist

### Start Here - Priority Screenshots (15 min)

#### 1. page-tree-view.png
- [ ] Go to: Pages list/tree view
- [ ] Expand a few pages to show hierarchy
- [ ] Capture entire left sidebar with page tree

#### 2. create-new-page.png
- [ ] Click "+ New Page" button
- [ ] Capture the dialog with all fields visible

#### 3. page-editor-interface.png
- [ ] Open any page for editing
- [ ] Capture full editor showing: header, content area, right sidebar

#### 4. widget-library-panel.png
- [ ] In page editor, ensure widget library is visible on right
- [ ] Capture the widget library panel showing multiple widgets

#### 5. widget-configuration-panel.png
- [ ] Click on any widget in the page
- [ ] Capture the configuration panel that appears

#### 6. publish-page-dialog.png
- [ ] Click "Publish" button
- [ ] Capture the publish dialog

#### 7. publication-status-dashboard.png
- [ ] Navigate to publication dashboard
- [ ] Capture showing statistics and page list

#### 8. page-version-history.png
- [ ] Open a page
- [ ] Click "History" or "Versions"
- [ ] Capture the version history panel

### Widget Screenshots (20 min)

For each widget type, add it to a page and capture:

#### 9. widget-text-block.png
- [ ] Add a text block widget
- [ ] Capture showing the widget and its config

#### 10. widget-image.png
- [ ] Add an image widget
- [ ] Capture showing image and configuration options

#### 11. widget-button.png
- [ ] Add a button widget
- [ ] Capture showing button configuration

#### 12. widget-gallery.png (if you have this widget)
- [ ] Add a gallery widget with multiple images
- [ ] Capture the gallery layout

#### 13. widget-html-block.png
- [ ] Add an HTML block widget
- [ ] Capture showing rich text editor

### Content Editing Screenshots (15 min)

#### 14. page-data-fields.png
- [ ] Open page settings
- [ ] Capture meta title, meta description fields

#### 15. form-validation-feedback.png
- [ ] Try to save a page with empty required fields
- [ ] Capture showing validation errors

#### 16. rich-text-editor.png
- [ ] Open any rich text field
- [ ] Capture showing the formatting toolbar

#### 17. seo-settings-panel.png
- [ ] Open page settings → SEO section
- [ ] Capture SEO fields

### Publishing Workflow Screenshots (10 min)

#### 18. schedule-publication.png
- [ ] Click Schedule button
- [ ] Capture date/time picker

#### 19. unpublish-page-dialog.png
- [ ] Click Unpublish on a published page
- [ ] Capture the confirmation dialog

#### 20. publication-timeline.png (if available)
- [ ] Navigate to publication timeline/calendar
- [ ] Capture showing scheduled publications

### Layout & Theme Screenshots (10 min)

#### 21. layout-selection.png
- [ ] Open page settings → Layout
- [ ] Capture layout selector with thumbnails

#### 22. theme-configuration-panel.png
- [ ] Open page settings → Theme
- [ ] Capture theme options

### Version Control Screenshots (10 min)

#### 23. version-details-view.png
- [ ] Click on a specific version in history
- [ ] Capture the version detail view

#### 24. compare-versions-view.png
- [ ] Select two versions to compare
- [ ] Capture the comparison view

#### 25. revert-to-version-dialog.png
- [ ] Click "Restore" on a version
- [ ] Capture the confirmation dialog

## Quick Screenshot Workflow

For efficient capturing:

1. **Batch similar screenshots**: Do all widget screenshots in one session
2. **Don't worry about perfection**: We can retake screenshots later
3. **Save directly to images folder**: Avoids having to move files later
4. **Use consistent window size**: Keep browser at same size for all screenshots

## After Capturing

1. **Move all screenshots** to `/Users/jmfk/code/eceee_v4/manuals/rev1/images/`

2. **Verify file count**:
   ```bash
   ls /Users/jmfk/code/eceee_v4/manuals/rev1/images/ | wc -l
   ```

3. **Check filenames match** the list above exactly

4. **Test the manual**:
   ```bash
   open /Users/jmfk/code/eceee_v4/manuals/rev1/README.md
   ```

## Reduced Set (If Short on Time)

If you only have 20 minutes, capture these 10 essential screenshots:

1. page-tree-view.png
2. page-editor-interface.png
3. widget-library-panel.png
4. widget-configuration-panel.png
5. publish-page-dialog.png
6. page-version-history.png
7. widget-text-block.png
8. widget-image.png
9. form-validation-feedback.png
10. publication-status-dashboard.png

The manual will still work with just these 10, though it won't be as visual.

## Need Help?

If screenshots don't match what's described, the frontend might have different UI. Just capture what you see and we'll update the documentation text to match the actual interface.

---

**Ready? Start with screenshot #1 and work your way down the list!**

