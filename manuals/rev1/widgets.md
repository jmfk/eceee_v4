# Widget System

The Widget System is the heart of content creation in eceee_v4. Widgets are reusable, configurable content components that you can add to your pages to build rich, dynamic content.

## Overview

Widgets are modular content blocks that can be added to any page. Each widget type has its own configuration options, visual appearance, and functionality.

## Widget Library

![Widget Library Panel](images/widget-library-panel.png)

The Widget Library panel displays all available widget types organized by category:

- **Content Widgets**: Text blocks, HTML, rich text editors
- **Media Widgets**: Images, galleries, videos
- **Interactive Widgets**: Buttons, forms, calendars
- **Layout Widgets**: Spacers, dividers, columns
- **Dynamic Widgets**: Events, news feeds, content listings

### Widget Categories

Each widget in the library shows:
- Widget icon and name
- Brief description
- Category tag
- Preview thumbnail

## Adding Widgets to a Page

![Adding Widgets](images/add-widget-to-page.png)

To add a widget to your page:

1. Open the page in the editor
2. Click the **"+ Add Widget"** button or open the Widget Library panel
3. Browse or search for the desired widget type
4. Click the widget to add it to the page
5. The widget appears in the content area, ready for configuration

### Drag-and-Drop Interface

You can also add widgets by dragging:

1. Open the Widget Library
2. Click and drag a widget from the library
3. Drop it into a slot on the page canvas
4. Release to place the widget
5. Configure the widget settings

## Widget Configuration Panel

![Widget Configuration Panel](images/widget-configuration-panel.png)

When a widget is selected, the configuration panel displays its settings:

### Configuration Sections

1. **Basic Settings**: Common properties like title, visibility
2. **Content Settings**: Widget-specific content options
3. **Style Settings**: Visual appearance and CSS classes
4. **Advanced Settings**: Custom attributes and behavior options

### Real-Time Validation

The configuration panel provides:
- Field validation with instant feedback
- Required field indicators
- Error messages for invalid inputs
- Helper text and examples
- Default value suggestions

## Widget Types

### Text Block Widget

![Text Block Widget](images/widget-text-block.png)

Simple plain text or formatted text content.

**Configuration Options:**
- Content (required): The text content
- Heading: Optional heading above the text
- Alignment: Left, center, right, justify
- Font size: Small, medium, large, custom
- Color: Text color selection

**Use Cases:**
- Simple paragraphs
- Descriptions
- Captions

### HTML Block Widget

![HTML Block Widget](images/widget-html-block.png)

Rich HTML content with full formatting capabilities.

**Configuration Options:**
- HTML Content (required): Raw HTML or rich text editor
- Sanitization: Enable/disable HTML sanitization
- Custom CSS classes
- Container styling

**Use Cases:**
- Rich formatted content
- Custom HTML elements
- Embedded content

### Image Widget

![Image Widget](images/widget-image.png)

Display images with advanced options.

**Configuration Options:**
- Image source (required): Upload or URL
- Alt text (required for accessibility)
- Caption: Optional image caption
- Size: Thumbnail, medium, large, full
- Alignment: Left, center, right, float
- Link: Optional clickable link
- Lazy loading: Enable/disable

**Use Cases:**
- Hero images
- Content illustrations
- Photo displays

### Button Widget

![Button Widget](images/widget-button.png)

Interactive buttons with customizable styling.

**Configuration Options:**
- Button text (required)
- Link URL (required)
- Style: Primary, secondary, outline, link
- Size: Small, medium, large
- Icon: Optional icon (left or right)
- Open in new tab: Yes/no
- Custom CSS classes

**Use Cases:**
- Call-to-action buttons
- Navigation links
- Download buttons

### Gallery Widget

![Gallery Widget](images/widget-gallery.png)

Image galleries with multiple display modes.

**Configuration Options:**
- Images (required): Upload multiple images
- Layout: Grid, masonry, carousel, lightbox
- Columns: 2, 3, 4, or custom
- Gap: Spacing between images
- Image size: Uniform sizing options
- Captions: Show/hide image captions
- Autoplay (carousel mode)

**Use Cases:**
- Photo galleries
- Product showcases
- Portfolio displays

### Events Widget

![Events Widget](images/widget-events.png)

Display upcoming or past events from the content system.

**Configuration Options:**
- Event source: Namespace filter
- Number of events: How many to display
- Time filter: Upcoming, past, or all
- Sort order: Date, title, or custom
- Layout: List, grid, or calendar view
- Show details: Which fields to display

**Use Cases:**
- Event calendars
- Upcoming events list
- Event archives

### Form Widget

![Form Widget](images/widget-form.png)

Interactive forms with schema-driven field configuration.

**Configuration Options:**
- Form fields: Define fields using JSON schema
- Validation rules: Required, format, custom validators
- Submit action: Email, API, or custom handler
- Success message: Confirmation text
- Error handling: Display options

**Use Cases:**
- Contact forms
- Registration forms
- Surveys and feedback

### Spacer Widget

![Spacer Widget](images/widget-spacer.png)

Add vertical spacing between content sections.

**Configuration Options:**
- Height: Small (20px), medium (40px), large (80px), custom
- Mobile height: Responsive spacing override
- Background color: Optional background
- Divider line: Optional horizontal rule

**Use Cases:**
- Visual separation
- Layout spacing
- Section breaks

## Widget Management

### Reordering Widgets

![Reordering Widgets](images/widget-reorder.png)

Change the order of widgets on a page:

1. Hover over a widget to reveal the drag handle
2. Click and hold the drag handle (⋮⋮)
3. Drag the widget to the new position
4. Drop to place
5. Save the page to persist changes

### Duplicating Widgets

To duplicate a widget:

1. Select the widget
2. Click the **"Duplicate"** icon in the widget toolbar
3. A copy is created immediately below the original
4. Modify the duplicate as needed

### Deleting Widgets

To remove a widget:

1. Select the widget
2. Click the **"Delete"** icon in the widget toolbar
3. Confirm the deletion
4. The widget is removed from the page

**Note**: Deleted widgets cannot be recovered unless you revert to a previous page version.

## Widget Inheritance

![Widget Inheritance](images/widget-inheritance.png)

Child pages can inherit widgets from parent pages:

### How Inheritance Works

- Inherited widgets appear with a special indicator
- Changes to parent widgets propagate to children
- Child pages can override inherited widgets
- Break inheritance to create independent versions

### Managing Inherited Widgets

**To inherit from parent:**
1. Open page settings
2. Enable "Inherit widgets from parent"
3. Save the page

**To override an inherited widget:**
1. Select the inherited widget
2. Click "Break inheritance"
3. Modify the widget independently

**To restore inheritance:**
1. Select the overridden widget
2. Click "Restore from parent"
3. Local changes are discarded

## Widget Preview

![Widget Preview](images/widget-preview.png)

Preview widgets before publishing:

- **Edit Mode**: See widgets with edit controls and outlines
- **Preview Mode**: View widgets as they'll appear to visitors
- **Device Preview**: Test responsive behavior (desktop, tablet, mobile)

Toggle between modes using the preview toolbar.

## Advanced Widget Features

### Custom Widget Configuration

For advanced users, widgets support:

- **JSON Schema Validation**: Define custom configuration schemas
- **Custom CSS**: Add widget-specific styles
- **Conditional Display**: Show/hide based on rules
- **Dynamic Content**: Integrate with external data sources

### Widget Templates

Create widget templates for reuse:

1. Configure a widget with your desired settings
2. Click "Save as template"
3. Name the template
4. Use the template to create new widgets with same settings

## Best Practices

### Choosing the Right Widget

- **Text Content**: Use Text Block for simple content, HTML Block for rich formatting
- **Images**: Use Image for single images, Gallery for multiple images
- **Calls to Action**: Use Button widget for clear, actionable links
- **Forms**: Use Form widget instead of HTML forms for better integration
- **Spacing**: Use Spacer widget instead of empty paragraphs

### Widget Organization

1. **Logical Flow**: Arrange widgets in reading order (top to bottom)
2. **Visual Balance**: Mix text and media widgets for variety
3. **Spacing**: Use spacers to create breathing room
4. **Consistency**: Use similar widget configurations across pages
5. **Mobile-First**: Test how widgets stack on mobile devices

### Performance Considerations

- **Image Optimization**: Always optimize images before uploading
- **Lazy Loading**: Enable lazy loading for images below the fold
- **Widget Limit**: Avoid using too many widgets on a single page (20-30 max recommended)
- **Complex Widgets**: Use sparingly (galleries, forms, dynamic content)

### Accessibility

- **Alt Text**: Always provide descriptive alt text for images
- **Semantic HTML**: Use appropriate heading levels in HTML Block
- **Color Contrast**: Ensure text has sufficient contrast
- **Keyboard Navigation**: Test that interactive widgets are keyboard accessible
- **Screen Readers**: Consider how widgets are announced

## Keyboard Shortcuts

- `Ctrl/Cmd + D`: Duplicate selected widget
- `Delete`: Remove selected widget
- `↑/↓ Arrow Keys`: Navigate between widgets
- `Ctrl/Cmd + ↑/↓`: Move widget up/down
- `Esc`: Deselect widget

## Troubleshooting

### Common Issues

**Problem**: Widget not appearing on page  
**Solution**: Check if the widget is hidden or has display conditions. Verify it's in a valid slot.

**Problem**: Widget configuration not saving  
**Solution**: Check for validation errors. Ensure all required fields are filled correctly.

**Problem**: Image widget showing broken image  
**Solution**: Verify image URL is accessible. Check file upload completed successfully.

**Problem**: Widget looks different on mobile  
**Solution**: Check responsive settings. Some widgets have mobile-specific configurations.

**Problem**: Can't delete inherited widget  
**Solution**: You must first break inheritance, then delete the widget.

---

[← Back: Page Management](page-management.md) | [Next: Content Editing →](content-editing.md)


