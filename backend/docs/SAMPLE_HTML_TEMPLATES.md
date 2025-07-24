# Sample HTML Layout Templates

This document provides comprehensive documentation for the sample HTML layout templates created for the eceee_v4 template-based layout system.

## Overview

The sample templates demonstrate the template-based layout system capabilities, providing ready-to-use layouts for common web page patterns. Each template includes:

- **Responsive CSS styling** using modern CSS Grid and Flexbox
- **Widget slot markers** with proper `data-widget-slot` attributes
- **Slot metadata** including titles, descriptions, and widget limits
- **Semantic HTML structure** for accessibility and SEO
- **Mobile-first responsive design** with multiple breakpoints

## Template Structure

### Standard Template Format

All templates follow this structure:

```html
<style>
  /* Layout-specific CSS styles */
  /* Responsive design breakpoints */
  /* Slot styling and placeholders */
</style>

<div class="layout-container">
  <element data-widget-slot="slot-name"
          data-slot-title="Human Readable Title"
          data-slot-description="Description of slot purpose"
          data-slot-max-widgets="number">
    <div class="slot-placeholder">Placeholder content</div>
  </element>
</div>
```

### Slot Attributes

Each slot element includes these data attributes:

- `data-widget-slot`: Unique slot identifier for widget placement
- `data-slot-title`: Human-readable title for the slot
- `data-slot-description`: Description of the slot's purpose and content
- `data-slot-max-widgets`: Maximum number of widgets allowed (optional)

## Available Templates

### 1. Hero Layout (`hero_layout.html`)

**Purpose**: Full-screen hero presentation with content area

**Structure**:
- Hero section (80vh) with gradient background
- Main content area with centered layout
- Footer section

**Slots**:
- `hero`: Hero section content (max 3 widgets)
- `content`: Main content area
- `footer`: Footer content (max 4 widgets)

**Best for**: Landing pages, product showcases, marketing pages

```html
<!-- Key sections -->
<section data-widget-slot="hero">
<main data-widget-slot="content">
<footer data-widget-slot="footer">
```

### 2. Grid Dashboard (`grid_dashboard.html`)

**Purpose**: Complex dashboard interface with multiple content areas

**Structure**:
- Fixed header with branding/navigation
- Sidebar for navigation and filters
- Main content area for primary interface
- Metrics panel for KPIs and statistics
- Footer for system information

**Slots**:
- `header`: Dashboard header (max 3 widgets)
- `sidebar`: Navigation sidebar (max 6 widgets)
- `main`: Main content area
- `metrics`: Metrics panel (max 8 widgets)
- `footer`: Dashboard footer (max 2 widgets)

**Best for**: Admin panels, analytics dashboards, data interfaces

**Responsive behavior**:
- Desktop: 3-column layout (sidebar | main | metrics)
- Tablet: 2-column layout (sidebar | main, metrics below)
- Mobile: Single column stack

### 3. Sidebar Layout (`sidebar_layout.html`)

**Purpose**: Traditional two-column layout with main content and sidebar

**Structure**:
- Header with navigation
- Two-column content (2fr main, 1fr sidebar)
- Sectioned sidebar with multiple widget areas
- Footer

**Slots**:
- `header`: Page header (max 3 widgets)
- `main`: Main content area
- `sidebar-top`: Top sidebar section (max 3 widgets)
- `sidebar-middle`: Middle sidebar section (max 4 widgets) 
- `sidebar-bottom`: Bottom sidebar section (max 3 widgets)
- `footer`: Footer (max 2 widgets)

**Best for**: Blogs, articles, documentation, content sites

### 4. Minimal Layout (`minimal_layout.html`)

**Purpose**: Clean, distraction-free layout focused on content

**Structure**:
- Sticky header with minimal styling
- Single content column optimized for reading
- Typography optimized for readability

**Slots**:
- `header`: Minimal header (max 2 widgets)
- `content`: Main content optimized for reading

**Best for**: Blogs, documentation, portfolios, article pages

**Features**:
- 65ch max-width for optimal reading
- Print-friendly styles
- Accessibility focus states
- Backdrop blur on sticky header

### 5. Landing Page (`landing_page.html`)

**Purpose**: Marketing-focused conversion-oriented layout

**Structure**:
- Fixed navigation header
- Hero section with strong visual impact
- Features showcase section
- Testimonials/social proof section
- Call-to-action section
- Comprehensive footer

**Slots**:
- `navigation`: Fixed top navigation (max 3 widgets)
- `hero`: Hero section (max 4 widgets)
- `features`: Features showcase (max 6 widgets)
- `testimonials`: Social proof section (max 5 widgets)
- `cta`: Call-to-action section (max 3 widgets)
- `footer`: Footer with resources (max 4 widgets)

**Best for**: Product pages, service landing pages, marketing campaigns

## Responsive Design

All templates use a mobile-first approach with these breakpoints:

- **Mobile**: 480px and below
- **Tablet**: 768px and below
- **Desktop**: 1024px and above
- **Large screens**: 1200px and above

### Common Responsive Patterns

1. **Grid Collapse**: Multi-column grids become single column on mobile
2. **Padding Reduction**: Reduced padding on smaller screens
3. **Font Scaling**: Responsive typography
4. **Stack Reordering**: Logical content flow on mobile

## CSS Architecture

### Naming Convention

Templates use BEM-inspired naming:

```css
.layout-name {}           /* Layout container */
.layout-name-section {}   /* Major sections */
.section-element {}       /* Elements within sections */
```

### Common Classes

All templates include these standardized classes:

```css
.slot-placeholder {}      /* Placeholder styling */
.container {}             /* Content containers */
```

### Responsive Utilities

```css
@media (max-width: 768px) {
  /* Tablet and below */
}

@media (max-width: 480px) {
  /* Mobile */
}
```

## Widget Integration

### Slot Discovery

The template parsing system automatically discovers slots by:

1. Finding elements with `data-widget-slot` attributes
2. Extracting slot metadata from data attributes
3. Generating slot configuration JSON
4. Creating CSS selectors for widget mounting

### Widget Mounting

Widgets are mounted into slots using React Portals:

1. Template HTML is rendered with `dangerouslySetInnerHTML`
2. Slot elements are located in the DOM
3. React widgets are mounted into slot elements via portals
4. Widget state and events are preserved

### Slot Limits

Use `data-slot-max-widgets` to control widget capacity:

```html
<div data-widget-slot="sidebar" data-slot-max-widgets="5">
```

## Security Considerations

### HTML Sanitization

Templates are sanitized with DOMPurify:

- Allowed: semantic HTML elements, CSS styling
- Stripped: script tags, iframe elements, dangerous attributes
- Validated: data attributes for slot markers

### CSS Security

CSS content is validated to prevent:

- CSS injection attacks
- Dangerous functions (url(), expression())
- External resource loading
- Clickjacking vulnerabilities

## Performance Optimization

### Template Caching

- Parsed template data is cached in memory
- CSS is extracted and cached separately
- Slot configurations are pre-computed

### Bundle Size

Templates add approximately:
- 15KB CSS (all templates combined)
- 2KB additional JavaScript for portal management
- Minimal runtime overhead for slot discovery

## Usage Examples

### Creating New Templates

1. **Start with structure**:
```html
<style>/* Layout CSS */</style>
<div class="new-layout">
  <!-- Semantic HTML structure -->
</div>
```

2. **Add slot markers**:
```html
<section data-widget-slot="main-content"
         data-slot-title="Main Content Area"
         data-slot-description="Primary page content">
```

3. **Include responsive design**:
```css
@media (max-width: 768px) {
  .new-layout {
    /* Mobile styles */
  }
}
```

4. **Test with widgets**:
- Add placeholders for development
- Test widget mounting and layout
- Validate responsive behavior

### Template Selection Guidelines

| Use Case | Recommended Template |
|----------|---------------------|
| Marketing site | Landing Page |
| Blog/Articles | Sidebar Layout |
| Documentation | Minimal Layout |
| Web app dashboard | Grid Dashboard |
| Product showcase | Hero Layout |

## File Locations

Templates are stored in:
```
backend/templates/webpages/layouts/
├── hero_layout.html
├── grid_dashboard.html
├── sidebar_layout.html
├── minimal_layout.html
├── landing_page.html
└── example_template_layout.html (original)
```

## API Integration

Templates are served via the layout API with full template data:

```json
{
  "name": "hero_layout",
  "template_based": true,
  "html": "<div class='hero-layout'>...</div>",
  "css": ".hero-layout { display: flex; ... }",
  "slot_configuration": {
    "slots": [
      {
        "name": "hero",
        "title": "Hero Section",
        "description": "Full-screen hero section...",
        "max_widgets": 3
      }
    ]
  }
}
```

## Testing

Each template should be tested for:

1. **Slot detection**: All slots properly discovered
2. **Widget mounting**: Widgets render correctly in slots
3. **Responsive behavior**: Layout adapts to screen sizes
4. **Accessibility**: Proper semantic structure and focus states
5. **Performance**: Fast rendering and minimal impact

## Future Enhancements

Planned improvements:

1. **Template variants**: Dark mode, seasonal themes
2. **Advanced layouts**: Multi-page templates, component libraries
3. **Visual editor**: Drag-and-drop template builder
4. **Template marketplace**: Community-contributed layouts
5. **A/B testing**: Template performance analytics

## Conclusion

These sample templates provide a solid foundation for the template-based layout system, demonstrating best practices for responsive design, widget integration, and user experience. They serve as both functional layouts and reference implementations for creating custom templates. 