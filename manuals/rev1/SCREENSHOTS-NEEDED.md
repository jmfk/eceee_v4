# Screenshots Needed for User Manual

This document lists all screenshots referenced in the user manual documentation. Screenshots should be captured from the running frontend at http://localhost:3000 and saved to the `images/` directory.

## Screenshot Specifications

- **Format**: PNG
- **Location**: `/manuals/rev1/images/`
- **Naming**: Use the exact filenames listed below
- **Resolution**: Capture at 1920x1080 for desktop views, actual device size for mobile
- **Quality**: High quality, clear and readable text

---

## Page Management Screenshots

### 1. page-tree-view.png
**Location**: Main page management view  
**What to show**: 
- Left sidebar with hierarchical page tree
- Pages with different status indicators (published, draft, scheduled)
- Expand/collapse functionality visible
- Page actions accessible

### 2. create-new-page.png
**Location**: Click "+ New Page" button  
**What to show**:
- New page creation dialog
- Fields: Title, Slug, Parent Page selector, Layout dropdown, Theme selector
- Create button
- Validation hints

### 3. page-editor-interface.png
**Location**: Open any page in the editor  
**What to show**:
- Complete editor interface
- Header with save/publish buttons
- Main content area with widgets
- Right sidebar with widget library
- Bottom toolbar

### 4. page-hierarchy.png
**Location**: Page tree with parent-child relationships visible  
**What to show**:
- Multi-level page hierarchy (at least 3 levels)
- Parent pages with children expanded
- Indentation showing relationship
- Breadcrumb navigation

### 5. slug-configuration.png
**Location**: Page Settings → Slug field  
**What to show**:
- Slug input field
- Auto-generated slug from title
- URL preview
- Validation feedback

### 6. page-bulk-operations.png
**Location**: Page list with multiple pages selected  
**What to show**:
- Checkboxes next to pages (some checked)
- Bulk actions toolbar/dropdown
- Available bulk operations listed

### 7. page-search.png
**Location**: Page search/filter interface  
**What to show**:
- Search input field
- Filter dropdowns (status, date, author, layout)
- Search results
- Applied filters visible

---

## Widget System Screenshots

### 8. widget-library-panel.png
**Location**: Right sidebar widget library  
**What to show**:
- Widget library organized by categories
- Multiple widget types visible
- Widget icons and names
- Category labels

### 9. add-widget-to-page.png
**Location**: Drag widget from library to page  
**What to show**:
- Widget being dragged from library
- Drop zone highlighted on page
- Visual feedback during drag operation

### 10. widget-configuration-panel.png
**Location**: Select a widget to show its configuration  
**What to show**:
- Widget selected (highlighted)
- Configuration panel on right
- Multiple configuration fields visible
- Save/cancel buttons

### 11. widget-text-block.png
**Location**: Text block widget configured on a page  
**What to show**:
- Text block widget in content area
- Sample text content
- Configuration showing text options

### 12. widget-html-block.png
**Location**: HTML block widget with rich content  
**What to show**:
- HTML block with formatted content
- Rich text editor if visible
- Formatted output

### 13. widget-image.png
**Location**: Image widget on a page  
**What to show**:
- Image widget displaying an image
- Image configuration options visible
- Alt text, caption, size options

### 14. widget-button.png
**Location**: Button widget configured  
**What to show**:
- Button widget on page
- Button configuration panel
- Style options, text, link settings

### 15. widget-gallery.png
**Location**: Gallery widget with multiple images  
**What to show**:
- Gallery widget showing multiple images
- Grid or carousel layout
- Gallery configuration options

### 16. widget-events.png
**Location**: Events widget displaying events  
**What to show**:
- Events widget with event list
- Event details visible
- Configuration options

### 17. widget-form.png
**Location**: Form widget  
**What to show**:
- Form widget with multiple fields
- Field types (text, email, checkbox, etc.)
- Submit button

### 18. widget-spacer.png
**Location**: Spacer widget between content  
**What to show**:
- Spacer widget in edit mode (shows boundaries)
- Height configuration
- Spacing between content sections

### 19. widget-reorder.png
**Location**: Drag handle on widget  
**What to show**:
- Widget with drag handle visible
- Cursor indicating draggable
- Reordering in action if possible

### 20. widget-inheritance.png
**Location**: Child page with inherited widgets  
**What to show**:
- Inherited widget with special indicator
- Inheritance controls (break/restore)
- Visual distinction from non-inherited widgets

### 21. widget-preview.png
**Location**: Preview mode toggle  
**What to show**:
- Edit mode and preview mode side by side (or toggle)
- Device preview options (desktop, tablet, mobile)
- Preview toolbar

---

## Content Editing Screenshots

### 22. content-editor-interface.png
**Location**: Main content editor  
**What to show**:
- Content canvas with widgets
- Properties panel with page data fields
- Toolbar with actions
- Overall editor layout

### 23. page-data-fields.png
**Location**: Page Settings → Page Data  
**What to show**:
- Meta title field
- Meta description field
- Other metadata fields
- Character count indicators

### 24. visual-schema-editor.png
**Location**: Schema editor (if accessible to users)  
**What to show**:
- Schema definition interface
- Field types and validation rules
- Visual representation of schema

### 25. custom-data-fields.png
**Location**: Page Settings → Custom Data  
**What to show**:
- Custom fields defined by schema
- Various field types (text, number, date, select)
- Filled in examples

### 26. form-validation-feedback.png
**Location**: Form with validation errors  
**What to show**:
- Required field indicators
- Error messages (red)
- Valid field indicators (green)
- Inline validation feedback

### 27. rich-text-editor.png
**Location**: Rich text field in edit mode  
**What to show**:
- Rich text editor toolbar
- Formatting options visible
- Sample formatted content
- Source view toggle if available

### 28. seo-settings-panel.png
**Location**: Page Settings → SEO  
**What to show**:
- SEO-specific fields
- Meta title and description
- Open Graph fields
- SEO recommendations/checklist

### 29. unsaved-changes-warning.png
**Location**: Try to navigate away with unsaved changes  
**What to show**:
- Warning dialog
- Options: Save, Discard, Cancel
- Unsaved changes indicator in toolbar

### 30. content-preview-modes.png
**Location**: Preview mode selector  
**What to show**:
- Edit/Preview toggle
- Device selector (desktop, tablet, mobile)
- Preview rendering

### 31. accessibility-checker.png
**Location**: Accessibility tools panel  
**What to show**:
- Accessibility scan results
- Issues and recommendations
- WCAG compliance indicators

---

## Publishing Workflow Screenshots

### 32. publish-page-dialog.png
**Location**: Click Publish button  
**What to show**:
- Publication dialog
- Version information
- Publication options
- Publish now button

### 33. schedule-publication.png
**Location**: Schedule → Schedule for Later  
**What to show**:
- Date/time picker for publication
- Optional unpublish date
- Scheduling notes field
- Schedule button

### 34. unpublish-page-dialog.png
**Location**: Click Unpublish button  
**What to show**:
- Unpublish confirmation dialog
- Options: now or scheduled
- Unpublish reason field
- Confirm button

### 35. publication-status-dashboard.png
**Location**: Pages → Publication Dashboard  
**What to show**:
- Overview statistics (total, published, drafts, scheduled)
- Status filters
- List of pages with status indicators
- Quick actions toolbar

### 36. publication-timeline.png
**Location**: Publication → Timeline  
**What to show**:
- Calendar view of scheduled publications
- Color-coded events
- Timeline navigation
- Upcoming publications visible

### 37. bulk-publishing-operations.png
**Location**: Select multiple pages → Bulk Actions  
**What to show**:
- Multiple pages selected
- Bulk publish dialog
- Options for all selected pages
- Progress indicator or confirmation

---

## Layouts & Themes Screenshots

### 38. layout-selection.png
**Location**: Page Settings → Layout  
**What to show**:
- Layout selector with thumbnails
- Multiple layout options visible
- Layout names and descriptions
- Current layout highlighted

### 39. theme-configuration-panel.png
**Location**: Page Settings → Theme  
**What to show**:
- Theme properties
- Color palette settings
- Typography options
- Spacing controls

### 40. apply-theme-dialog.png
**Location**: Click Apply Theme  
**What to show**:
- Theme browser/selector
- Theme previews
- Apply theme button
- Theme details

### 41. layout-inheritance-visualization.png
**Location**: Child page showing layout inheritance  
**What to show**:
- Inheritance indicator
- Parent layout reference
- Break/restore inheritance controls
- Inheritance chain visualization

### 42. template-preview-panel.png
**Location**: Preview a layout or theme  
**What to show**:
- Preview panel with sample content
- Layout structure visible
- Theme styling applied
- Preview controls

### 43. layout-editor-interface.png
**Location**: Layouts → Create New Layout (admin)  
**What to show**:
- Layout editor interface
- Slot configuration
- Grid settings
- Save/preview options

### 44. theme-builder-interface.png
**Location**: Themes → Create New Theme (admin)  
**What to show**:
- Theme builder with color pickers
- Typography settings
- Component style options
- Preview panel

---

## Version Control Screenshots

### 45. page-version-history.png
**Location**: Click History button  
**What to show**:
- Version history panel/page
- Chronological list of versions
- Version numbers, dates, authors
- Actions for each version

### 46. version-details-view.png
**Location**: Click on a specific version  
**What to show**:
- Version detail view
- Content snapshot from that version
- Version metadata (date, author, note)
- Restore/compare buttons

### 47. compare-versions-view.png
**Location**: Version History → Compare  
**What to show**:
- Side-by-side comparison of two versions
- Highlighted differences
- Change summary
- Navigation between changes

### 48. revert-to-version-dialog.png
**Location**: Version → Restore This Version  
**What to show**:
- Restore confirmation dialog
- Restore options (as draft, publish, schedule)
- Version being restored information
- Confirm button

### 49. add-version-note.png
**Location**: Save page → Add note dialog  
**What to show**:
- Version note input field
- Optional note during save
- Save with/without note options

### 50. version-annotations.png
**Location**: Version with annotations  
**What to show**:
- Version annotation interface
- Existing annotations on timeline
- Add annotation button
- @mention functionality if available

### 51. field-level-diff.png
**Location**: Version comparison focusing on specific fields  
**What to show**:
- Detailed field-by-field comparison
- Changed values highlighted
- Old vs new values side by side

---

## General Interface Screenshots

### 52. main-dashboard.png (Optional)
**Location**: Main dashboard/home  
**What to show**:
- Overall CMS dashboard
- Quick stats
- Recent activity
- Navigation menu

### 53. login-page.png (Optional)
**Location**: Login screen  
**What to show**:
- Login interface
- Username/password fields
- Login button
- Branding

---

## Screenshot Capture Instructions

### Using Browser MCP Tools (when available)

```
For each screenshot:
1. Navigate to the specified location in the frontend
2. Ensure the view shows the described elements
3. Use takeScreenshot() to capture
4. Save to /manuals/rev1/images/ with the specified filename
```

### Manual Screenshot Capture

1. Navigate to http://localhost:3000
2. Login to the CMS
3. Navigate to each location listed above
4. Capture screenshot using:
   - Mac: Cmd + Shift + 4
   - Windows: Win + Shift + S
   - Browser: F12 → Device toolbar → Screenshot
5. Save with exact filename to `/manuals/rev1/images/`
6. Verify image quality and visibility of text

### Quality Checklist

For each screenshot verify:
- [ ] Text is readable and not blurry
- [ ] UI elements are clearly visible
- [ ] Colors are accurate
- [ ] No sensitive information visible
- [ ] Consistent window size (1920x1080 recommended)
- [ ] No browser chrome unless intentional
- [ ] Proper filename and location

---

## Priority Levels

### High Priority (Essential for manual usability)
- page-tree-view.png
- create-new-page.png
- page-editor-interface.png
- widget-library-panel.png
- widget-configuration-panel.png
- content-editor-interface.png
- publish-page-dialog.png
- publication-status-dashboard.png
- page-version-history.png

### Medium Priority (Helpful but not critical)
- All widget type screenshots (text, image, button, gallery, etc.)
- Layout and theme screenshots
- Version comparison views
- Bulk operations

### Low Priority (Nice to have)
- Advanced features
- Admin-only interfaces
- Optional tools and settings

---

## Completion Tracking

Total screenshots needed: **51**  
Captured: **0**  
Remaining: **51**

Update this count as screenshots are captured.


