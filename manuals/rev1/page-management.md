# Page Management

Page Management is the core feature of eceee_v4, allowing you to create, organize, and manage your website's hierarchical structure.

## Overview

Pages in eceee_v4 are organized in a tree structure, with parent-child relationships that reflect your site's navigation hierarchy. Each page has a unique slug and can contain widgets, custom data, and metadata.

## Page Tree View

![Page Tree View](images/page-tree-view.png)

The page tree view provides a visual representation of your site's structure. You can:

- Expand and collapse page hierarchies
- View page status (published, draft, scheduled)
- See page metadata at a glance
- Drag and drop to reorganize pages
- Quick access to page actions

### Understanding Page Status Indicators

- **Green checkmark**: Published and live
- **Yellow clock**: Scheduled for future publication
- **Gray dot**: Draft (unpublished)
- **Red icon**: Page with validation errors

## Creating a New Page

![Create New Page](images/create-new-page.png)

To create a new page:

1. Click the **"+ New Page"** button in the page tree toolbar
2. Enter the page details in the creation dialog:
   - **Title**: The display name of your page
   - **Slug**: URL-friendly identifier (auto-generated from title)
   - **Parent Page**: Select a parent or leave empty for top-level pages
   - **Layout**: Choose a layout template
   - **Theme**: Select a theme (or inherit from parent)

3. Click **"Create"** to initialize the page

### Page Slug Rules

- Slugs must be unique within the same parent
- Only lowercase letters, numbers, and hyphens allowed
- Automatically validated as you type
- Cannot start or end with a hyphen

## Page Editor Interface

![Page Editor Interface](images/page-editor-interface.png)

The page editor is divided into several key areas:

### 1. Header Section
- Page title and breadcrumb navigation
- Save, publish, and preview buttons
- Version indicator
- Status badges

### 2. Main Content Area
- Widget canvas where you add and arrange content
- Drag-and-drop interface for widget positioning
- Live preview of page content
- Slot-based layout system

### 3. Right Sidebar
- Widget library panel
- Page properties
- SEO settings
- Advanced options

### 4. Bottom Toolbar
- Quick actions
- Validation status
- Unsaved changes indicator

## Managing Parent-Child Relationships

![Page Hierarchy](images/page-hierarchy.png)

### Creating Child Pages

1. Select the parent page in the tree
2. Click **"+ Add Child Page"** or use the context menu
3. The new page automatically inherits:
   - Theme (unless overridden)
   - Layout preferences
   - Some widget configurations (if inheritance enabled)

### Moving Pages

To reorganize your page hierarchy:

1. Drag the page from its current location
2. Drop it onto the desired parent page
3. Confirm the move in the dialog
4. The page's URL path will update automatically

### Deleting Pages

**Warning**: Deleting a page with children will also delete all child pages.

1. Right-click the page in the tree
2. Select **"Delete"**
3. Review the list of pages to be deleted
4. Type the page title to confirm
5. Click **"Delete Permanently"**

## URL and Slug Configuration

![Slug Configuration](images/slug-configuration.png)

### Automatic URL Generation

Page URLs are automatically generated based on:
- The page slug
- Parent page paths
- Site configuration

Example hierarchy:
```
/about                    (slug: about)
/about/team              (slug: team, parent: about)
/about/team/leadership   (slug: leadership, parent: team)
```

### Changing a Page Slug

1. Open the page in the editor
2. Navigate to **Page Settings** in the right sidebar
3. Click on the **Slug** field
4. Enter the new slug
5. Review the warning about URL changes
6. Save and publish to apply changes

**Important**: Changing a slug will break existing links to the page. Consider setting up redirects for published pages.

## Page Properties

### Basic Properties

- **Title**: Display name shown in navigation and headers
- **Slug**: URL-friendly identifier
- **Status**: Draft, Published, Scheduled
- **Created Date**: When the page was first created
- **Modified Date**: Last modification timestamp
- **Author**: User who created the page

### Advanced Properties

- **Meta Title**: SEO title tag (defaults to page title)
- **Meta Description**: SEO description tag
- **Layout**: Page layout template
- **Theme**: Visual theme configuration
- **Custom Data**: Schema-driven custom fields
- **Visibility**: Public, private, or restricted access

## Bulk Operations

![Bulk Operations](images/page-bulk-operations.png)

Select multiple pages using checkboxes to perform bulk operations:

- **Publish Multiple Pages**: Publish several pages at once
- **Unpublish**: Remove pages from live site
- **Schedule Publication**: Set future publish dates
- **Change Theme**: Apply a theme to multiple pages
- **Export**: Export page configurations
- **Delete**: Remove multiple pages

## Search and Filtering

![Page Search](images/page-search.png)

Use the search and filter tools to find pages:

- **Text Search**: Search by title, slug, or content
- **Status Filter**: Show only published, draft, or scheduled pages
- **Date Filter**: Filter by creation or modification date
- **Author Filter**: Show pages by specific authors
- **Layout Filter**: Find pages using specific layouts

## Best Practices

### Organizing Your Site Structure

1. **Plan your hierarchy**: Sketch out your site structure before creating pages
2. **Keep it shallow**: Avoid deep nesting (3-4 levels maximum recommended)
3. **Use descriptive slugs**: Make URLs meaningful and SEO-friendly
4. **Consistent naming**: Use a consistent naming convention across your site

### Page Naming Conventions

- Use title case for page titles: "About Our Team"
- Use lowercase with hyphens for slugs: "about-our-team"
- Be descriptive but concise
- Avoid special characters and accents

### Managing Large Sites

- Use the search and filter tools to navigate
- Organize pages into logical sections
- Use themes to maintain visual consistency
- Leverage page templates for common page types
- Regular cleanup: archive or delete unused pages

## Keyboard Shortcuts

- `Ctrl/Cmd + S`: Save current page
- `Ctrl/Cmd + P`: Publish page
- `Ctrl/Cmd + N`: Create new page
- `Esc`: Close dialogs
- `Arrow Keys`: Navigate page tree

## Troubleshooting

### Common Issues

**Problem**: "Slug already exists" error  
**Solution**: Choose a different slug or check if a sibling page has the same slug

**Problem**: Can't delete a page  
**Solution**: Check if the page is referenced by other pages or has children that need to be removed first

**Problem**: Page doesn't appear in navigation  
**Solution**: Verify the page is published and check navigation configuration

**Problem**: Changes not saving  
**Solution**: Check for validation errors in the page editor and ensure all required fields are filled

---

[← Back to Index](README.md) | [Next: Widget System →](widgets.md)


