# Version Management User Guide

The Version Management system in eceee_v4 provides powerful version control for your web pages, allowing you to create drafts, publish content, and maintain a complete history of changes.

## Overview

The version management interface is accessed through the **Versions** tab in the Page Management section. It provides:

- **Visual Version History**: See all versions of your pages with status indicators
- **Draft/Published Workflow**: Manage content through a structured approval process  
- **Version Comparison**: See exactly what changed between any two versions
- **One-Click Restoration**: Restore any previous version instantly
- **Statistics Dashboard**: Overview of draft and published version counts

## Accessing Version Management

1. Navigate to **Page Management** from the main navigation
2. Click the **Versions** tab
3. The version management interface will load with:
   - Statistics dashboard showing version counts
   - List of all page versions across your site
   - Search and filtering options

## Interface Components

### Statistics Dashboard

The top section displays key metrics:

- **Total Drafts**: Number of draft versions waiting for publication
- **Total Published**: Number of published versions currently live
- **Has Current**: Whether there are any published versions
- **Current Version Info**: Details about the currently live version

### Version Cards

Each version is displayed as a card containing:

- **Version Number**: Sequential number (e.g., v1, v2, v3)
- **Status Badge**: Visual indicator (Draft/Published/Archived)
- **Description**: User-provided description of changes
- **Timestamps**: Creation and publication dates
- **User Attribution**: Who created and published the version
- **Action Buttons**: Context-sensitive actions available

### Action Buttons

Different actions are available based on version status and permissions:

- **👁️ View**: Preview the version content
- **📤 Publish**: Publish a draft version (draft versions only)
- **📝 Edit**: Modify the version (if editable)
- **🗑️ Delete**: Remove the version (draft versions only)
- **📋 Create Draft**: Create new draft from published version
- **↩️ Restore**: Restore this version as current
- **⚖️ Compare**: Select for version comparison

## Core Workflows

### 1. Creating and Publishing Content

#### Step 1: Create Content
1. Go to **Pages** tab and edit any page
2. Make your changes (content, widgets, layout, etc.)
3. Click **Save** - this automatically creates a **draft version**
4. Add a descriptive version description when prompted

#### Step 2: Review Draft
1. Switch to **Versions** tab
2. Find your new draft version (will have "Draft" status)
3. Click the **👁️ View** button to preview changes
4. Make additional edits if needed (creates new draft versions)

#### Step 3: Publish Content
1. In the Versions tab, find your draft version
2. Click the **📤 Publish** button
3. Confirm the publish action in the dialog
4. The version status changes to "Published" and becomes live

### 2. Version Comparison

Compare any two versions to see exactly what changed:

#### Step 1: Select Versions
1. Click **⚖️ Compare** on the first version you want to compare
2. Click **⚖️ Compare** on the second version
3. The interface automatically switches to **Compare** mode

#### Step 2: Review Changes
The comparison view shows:

- **Version Details**: Basic info about both versions
- **Field Changes**: Text fields that were modified
- **Widget Changes**: 
  - Added widgets (green highlight)
  - Removed widgets (red highlight)  
  - Modified widgets (yellow highlight)
- **Visual Diff**: Side-by-side comparison where applicable

#### Step 3: Take Action
From the comparison view you can:
- Create a new draft based on either version
- Restore either version
- Return to the main version list

### 3. Content Restoration

Restore any previous version as the current content:

#### Step 1: Select Version
1. Find the version you want to restore
2. Click the **↩️ Restore** button
3. Confirm the restoration in the dialog

#### Step 2: Understand the Process
- A new version is created with the restored content
- The page content is immediately updated
- The restored version becomes the latest version
- All data (content, widgets, settings) is restored

### 4. Draft Management

Work with draft versions effectively:

#### Creating Drafts from Published Content
1. Find a published version you want to modify
2. Click **📋 Create Draft**
3. Enter a description for the new draft
4. Edit the content as needed
5. Publish when ready

#### Managing Multiple Drafts
- Only one draft per page is recommended for clarity
- Delete unnecessary drafts to keep things organized
- Use descriptive names to track different approaches

## Search and Filtering

### Quick Search
Use the search bar to find versions by:
- Page title
- Version description
- Creator username

### Advanced Filters
Filter versions by:
- **Status**: Draft, Published, Archived
- **Page**: Specific page
- **Date Range**: Created or published dates
- **User**: Who created or published
- **Current Status**: Only current versions

### Filter Examples

```
# Find all drafts created this week
Status: Draft + Created After: [last week date]

# Find all published versions by specific user  
Status: Published + Created By: john@example.com

# Find versions for homepage only
Page: Homepage
```

## Best Practices

### Version Descriptions
- Use clear, descriptive version descriptions
- Include the type of change: "Updated hero section"
- Mention significant additions: "Added contact form widget"
- Reference tickets/issues when applicable: "Fixed header issue #123"

### Draft Workflow
1. **Create drafts** for all changes, even small ones
2. **Review drafts** before publishing
3. **Delete unused drafts** to keep things clean
4. **Use meaningful descriptions** for easy identification

### Content Strategy
- **Test in draft** before publishing to live site
- **Compare with previous versions** to ensure changes are correct
- **Keep published versions** as restore points
- **Document major changes** in version descriptions

### Collaboration
- **Communicate with team** about draft changes
- **Use clear naming** so others understand changes
- **Review others' drafts** before they publish
- **Coordinate publishing** for major site updates

## Troubleshooting

### Common Issues

#### "Cannot publish version" error
- **Cause**: Version may already be published or user lacks permissions
- **Solution**: Check version status and user permissions

#### "Version not found" error  
- **Cause**: Version may have been deleted or doesn't exist
- **Solution**: Refresh the page and verify version exists

#### Changes not appearing after publish
- **Cause**: Browser cache or CDN caching
- **Solution**: Clear browser cache or wait for CDN refresh

### Recovery Scenarios

#### Accidentally published wrong content
1. Go to Versions tab
2. Find the previous good version
3. Click **↩️ Restore** to restore it
4. The bad content is immediately replaced

#### Lost draft work
1. Check Versions tab for auto-saved drafts
2. Look for versions with recent timestamps
3. Use **👁️ View** to preview content
4. Restore the version with your work

#### Need to compare with much older version
1. Use date filters to find old versions
2. Page through version history
3. Use compare function with any two versions
4. Create new draft based on comparison results

## Keyboard Shortcuts

- **Ctrl/Cmd + S**: Save current changes (creates draft version)
- **Ctrl/Cmd + Shift + P**: Quick publish current draft
- **Ctrl/Cmd + Z**: Undo last change (if in edit mode)
- **Escape**: Close modal dialogs

## Mobile Usage

The version management interface is fully responsive:

- **Touch-friendly**: Large buttons for mobile devices
- **Swipe navigation**: Swipe between version cards
- **Simplified view**: Condensed information on smaller screens
- **Full functionality**: All features available on mobile

## Integration with Page Editor

Version management integrates seamlessly with page editing:

### Automatic Version Creation
- **Save**: Creates draft version automatically
- **Publish**: Option to publish immediately or save as draft
- **Widget changes**: Each widget modification tracked in versions

### Version-Aware Editing
- **Current version indicator**: Shows which version you're editing
- **Unsaved changes warning**: Alerts about unsaved modifications
- **Draft restoration**: Easy access to restore previous drafts

### Collaboration Features
- **User attribution**: See who made each version
- **Timestamp tracking**: When each change was made
- **Change descriptions**: What was modified in each version

This comprehensive version management system ensures you never lose work and can confidently manage content changes across your entire website. 