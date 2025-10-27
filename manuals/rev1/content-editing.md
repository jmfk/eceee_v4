# Content Editing

Content Editing in eceee_v4 provides powerful tools for managing page content, metadata, and structured data through an intuitive interface with real-time validation.

## Overview

The Content Editor combines widget-based page content with structured page data fields, allowing you to create rich, well-optimized pages with proper metadata and SEO configuration.

## Content Editor Interface

![Content Editor Interface](images/content-editor-interface.png)

The Content Editor is organized into three main sections:

### 1. Content Canvas
- Visual representation of your page
- Widget placement and arrangement
- Live preview of content
- Slot-based layout system

### 2. Properties Panel
- Page metadata fields
- SEO settings
- Custom data fields
- Schema-driven forms

### 3. Toolbar
- Save, publish, and preview actions
- View mode toggles
- Validation status
- Version information

## Page Data Fields

![Page Data Fields](images/page-data-fields.png)

Page data fields are structured, schema-driven fields that store metadata and configuration for each page.

### Standard Page Data Fields

**Meta Title**
- SEO-optimized page title
- Displayed in browser tabs and search results
- Recommended length: 50-60 characters
- Falls back to page title if not set

**Meta Description**
- Brief description of page content
- Displayed in search engine results
- Recommended length: 150-160 characters
- Should include relevant keywords

**Open Graph Data**
- og:title - Title for social media shares
- og:description - Description for social shares
- og:image - Image for social media previews
- og:type - Content type (article, website, etc.)

**Custom Data Fields**
- Schema-defined custom fields
- Validation rules enforced
- Type-specific input controls
- Conditional field display

## Schema-Driven Forms

![Schema Editor](images/visual-schema-editor.png)

eceee_v4 uses JSON Schema to define and validate page data structures.

### Understanding Page Schemas

Page schemas define:
- Which fields are available on a page
- Field types (text, number, date, etc.)
- Validation rules (required, format, range)
- Default values
- Help text and labels

### Common Field Types

**Text Fields**
- Single-line text input
- Pattern validation (regex)
- Min/max length constraints
- Placeholder text

**Textarea**
- Multi-line text input
- Character count display
- Auto-resize option
- Markdown support

**Number**
- Numeric input with validation
- Min/max value constraints
- Step increment
- Unit display

**Date & DateTime**
- Date picker interface
- Time selection
- Format validation
- Min/max date constraints

**Select Dropdown**
- Predefined options
- Single or multi-select
- Search/filter capability
- Custom option values

**Boolean (Checkbox)**
- True/false toggle
- Switch or checkbox display
- Default value

**Rich Text**
- WYSIWYG editor
- HTML output
- Formatting toolbar
- Media embedding

### Working with Custom Fields

![Custom Fields](images/custom-data-fields.png)

To configure custom fields:

1. Navigate to **Page Settings** → **Custom Data**
2. View available fields defined by the page schema
3. Fill in field values
4. Validation occurs in real-time
5. Save to persist changes

**Field Validation Indicators:**
- ✓ Green checkmark: Valid input
- ✗ Red error: Invalid input with error message
- ⚠ Yellow warning: Valid but needs attention
- * Asterisk: Required field

## Form Validation

![Form Validation](images/form-validation-feedback.png)

Real-time validation helps ensure data quality:

### Client-Side Validation

Instant feedback as you type:
- Required field enforcement
- Format validation (email, URL, phone)
- Length constraints
- Pattern matching
- Custom validation rules

### Server-Side Validation

Additional validation on save:
- Cross-field validation
- Database constraints
- Business logic rules
- Uniqueness checks

### Validation Feedback

**Error Messages**: Clear, actionable descriptions of what's wrong

**Inline Errors**: Displayed directly below the problematic field

**Summary Panel**: List of all validation errors at the top of the form

**Field Highlighting**: Invalid fields highlighted in red

## Rich Text Editing

![Rich Text Editor](images/rich-text-editor.png)

The rich text editor provides comprehensive formatting tools:

### Formatting Toolbar

**Text Formatting:**
- Bold, italic, underline
- Strikethrough, code
- Subscript, superscript

**Paragraph Formatting:**
- Headings (H1-H6)
- Paragraph, blockquote
- Lists (ordered, unordered)
- Code blocks

**Alignment:**
- Left, center, right
- Justify

**Content Insertion:**
- Links (with title and target)
- Images (upload or URL)
- Tables (insert and edit)
- Horizontal rules

**Advanced:**
- HTML source view
- Clear formatting
- Undo/redo
- Find and replace

### Best Practices for Rich Text

1. **Use Semantic HTML**: Choose appropriate heading levels
2. **Accessible Links**: Use descriptive link text, not "click here"
3. **Alt Text**: Always provide alt text for images
4. **Lists**: Use proper list elements for better structure
5. **Tables**: Use tables for data, not layout
6. **Clean HTML**: Avoid pasting from Word (use "Paste as Plain Text")

## SEO Optimization

![SEO Settings](images/seo-settings-panel.png)

Optimize your pages for search engines:

### SEO Checklist

✓ **Title Tag**: Unique, descriptive, 50-60 characters  
✓ **Meta Description**: Compelling, 150-160 characters  
✓ **URL Slug**: Clean, keyword-rich, readable  
✓ **Headings**: Proper H1-H6 hierarchy  
✓ **Alt Text**: All images have descriptive alt text  
✓ **Content**: High-quality, relevant content  
✓ **Links**: Internal and external links work  

### SEO Tips

**Keywords**: Include target keywords naturally in:
- Page title
- Meta description
- Headings
- First paragraph
- Image alt text

**Readability**: 
- Short paragraphs
- Clear headings
- Bullet points
- White space

**Engagement**:
- Compelling meta descriptions
- Clear calls to action
- Relevant imagery
- Fast load times

## Content Workflow

### Typical Editing Session

1. **Open Page**: Select page from tree or search
2. **Review Current Content**: Assess existing content and structure
3. **Edit Content**: 
   - Update widgets
   - Modify text and images
   - Adjust layout
4. **Update Metadata**:
   - Meta title and description
   - Custom data fields
   - SEO optimization
5. **Validate**: Check for errors and warnings
6. **Preview**: Review how the page looks
7. **Save**: Save as draft
8. **Publish**: Make changes live

### Unsaved Changes Protection

![Unsaved Changes Warning](images/unsaved-changes-warning.png)

The editor tracks unsaved changes:

- Indicator in the toolbar when changes are pending
- Warning when attempting to navigate away
- Option to save, discard, or cancel navigation
- Auto-save (optional, configurable)

## Content Preview

![Content Preview Modes](images/content-preview-modes.png)

Preview your content before publishing:

### Preview Modes

**Edit Mode**
- Shows widget boundaries
- Edit controls visible
- Drag handles and toolbars
- Quick access to settings

**Preview Mode**
- Visitor's view
- No edit controls
- Exact rendering
- Interactive elements functional

**Responsive Preview**
- Desktop (1920px, 1440px, 1024px)
- Tablet (768px)
- Mobile (375px, 320px)
- Custom dimensions

### Preview Features

- **Device Frames**: Optional device mockups
- **Orientation**: Portrait and landscape
- **Touch Simulation**: Test mobile interactions
- **Refresh**: Reload preview
- **New Window**: Open in separate window

## Accessibility

![Accessibility Checker](images/accessibility-checker.png)

Ensure your content is accessible to all users:

### Accessibility Checklist

✓ **Images**: Alt text for all meaningful images  
✓ **Headings**: Logical heading hierarchy (no skipping levels)  
✓ **Links**: Descriptive link text  
✓ **Color Contrast**: Sufficient contrast ratios  
✓ **Forms**: Proper labels for all inputs  
✓ **Keyboard**: All interactive elements keyboard accessible  
✓ **ARIA**: Appropriate ARIA labels where needed  

### Accessibility Tools

**Built-in Checker**: 
- Scans content for common issues
- Provides specific recommendations
- Links to WCAG guidelines

**Contrast Analyzer**:
- Check text/background color contrast
- Meet WCAG AA or AAA standards

**Keyboard Navigation Test**:
- Test tab order
- Verify all interactions work with keyboard

## Advanced Features

### Conditional Content

Show or hide content based on conditions:

- **User Role**: Display different content for different user types
- **Date/Time**: Show content during specific periods
- **Device**: Mobile-specific or desktop-specific content
- **Custom Rules**: Advanced logic-based display

### Content Templates

Save and reuse content patterns:

1. **Create Template**: Configure widgets and content as desired
2. **Save Template**: Store configuration for reuse
3. **Apply Template**: Start new pages from template
4. **Update Template**: Changes propagate to instances (optional)

### Bulk Editing

Edit multiple pages at once:

1. **Select Pages**: Use checkboxes in page tree
2. **Bulk Edit**: Access bulk editing panel
3. **Choose Fields**: Select which fields to update
4. **Apply Changes**: Update all selected pages

## Keyboard Shortcuts

- `Ctrl/Cmd + S`: Save current page
- `Ctrl/Cmd + Shift + P`: Preview mode toggle
- `Ctrl/Cmd + Z`: Undo
- `Ctrl/Cmd + Y`: Redo
- `Ctrl/Cmd + F`: Find in content
- `Ctrl/Cmd + K`: Insert link
- `Tab`: Indent list item
- `Shift + Tab`: Outdent list item

## Best Practices

### Content Quality

1. **Be Concise**: Remove unnecessary words
2. **Use Active Voice**: More engaging and direct
3. **Break Up Text**: Use headings, lists, images
4. **Proofread**: Check spelling and grammar
5. **Update Regularly**: Keep content fresh and relevant

### Metadata

1. **Unique Titles**: Each page should have a unique meta title
2. **Compelling Descriptions**: Write descriptions that encourage clicks
3. **Keyword Research**: Use relevant keywords naturally
4. **Update Dates**: Keep modified dates current
5. **Social Media**: Optimize Open Graph data for sharing

### Performance

1. **Optimize Images**: Compress before uploading
2. **Minimize Widgets**: Don't overload pages
3. **Clean HTML**: Remove unnecessary formatting
4. **External Resources**: Minimize third-party scripts
5. **Test Load Times**: Use preview performance tools

## Troubleshooting

### Common Issues

**Problem**: Can't save changes  
**Solution**: Check for validation errors. All required fields must be filled correctly.

**Problem**: Rich text editor not loading  
**Solution**: Check browser console for JavaScript errors. Try refreshing the page.

**Problem**: Images not displaying in preview  
**Solution**: Verify image URLs are correct and accessible. Check file permissions.

**Problem**: Validation errors don't make sense  
**Solution**: Check the page schema for field requirements. Contact administrator if schema seems incorrect.

**Problem**: Lost unsaved changes  
**Solution**: eceee_v4 creates auto-save versions. Check version history for recovery.

---

[← Back: Widget System](widgets.md) | [Next: Publishing Workflow →](publishing-workflow.md)


