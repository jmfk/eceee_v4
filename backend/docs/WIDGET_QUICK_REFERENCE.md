# Widget Quick Reference Guide

Comprehensive reference for all easy_widgets in the eceee_v4 project, including configuration parameters, template variables, examples, special features, and component style customization.

## Overview

The eceee_v4 project features 17 easy_widgets that provide rich content management capabilities. This document provides quick reference information for all widgets, including how to customize them using component styles.

## Naming Conventions

**CRITICAL:** The frontend and backend use different naming conventions, and this affects how you access properties in component style templates:

### Frontend to Backend Conversion

- **Frontend (JavaScript/React)**: Uses **camelCase** for all field names
  - Example: `backgroundColor`, `enableLightbox`, `menuItems`, `beforeText`
  
- **Backend (Python/Django)**: Uses **snake_case** for all field names  
  - Example: `background_color`, `enable_lightbox`, `menu_items`, `before_text`

- **Templates (Mustache/Django)**: **MUST** use **snake_case** to access parameters
  - Example: `{{ config.background_color }}`, `{{ config.menu_items }}`, `{{ config.before_text }}`

### Component Style Templates

When using widget config properties in component style templates, **always use snake_case**:

```mustache
<!-- ✅ CORRECT -->
{{config.background_color}}
{{config.text_color}}
{{config.before_text}}
{{config.menu_items}}

<!-- ❌ WRONG -->
{{config.backgroundColor}}
{{config.textColor}}
{{config.beforeText}}
{{config.menuItems}}
```

The API layer automatically converts between camelCase and snake_case using `djangorestframework-camel-case`, so:
- Frontend sends: `{ backgroundColor: "#3b82f6" }`
- Backend receives: `{ 'background_color': '#3b82f6' }`
- Template accesses: `{{ config.background_color }}`

## Template Parameter Availability

All widget configuration parameters are accessible in Mustache/Django templates through the `config` object. The `prepare_template_context()` method in each widget class processes the configuration and makes it available to templates.

### Common Parameters (Available to All Widgets)

All widgets have access to these context parameters:

```django
{# Basic configuration from Pydantic model #}
{{ config.field_name }}

{# Special context data (added by BaseWidget.prepare_template_context) #}
{{ config._context.page }}              {# Current page object #}
{{ config._context.theme }}             {# Effective theme #}
{{ config._context.path_variables }}    {# URL path variables #}
{{ config._context.widget }}            {# Widget configuration #}
{{ config._context.request }}           {# HTTP request object #}
```

### Widget-Specific Computed Parameters

Many widgets add computed parameters in their `prepare_template_context()` method:

| Widget | Computed Parameters |
|--------|-------------------|
| ContentWidget | `processed_content` - HTML with media inserts processed |
| HeroWidget | `hero_style`, `background_image_url` - Processed styles and images |
| ImageWidget | `media_items` - Resolved collection images |
| NavbarWidget | `navbar_style`, `menu_items` - Processed styles and filtered menu |
| HeaderWidget | `header_style` - Responsive image CSS variables |
| NavigationWidget | `dynamic_menu_items`, `owner_page` - Auto-generated menus |
| NewsListWidget | `news_items` - Queried news objects |
| NewsDetailWidget | `news_object`, `published_version` - Resolved news data |

## Widget Categories

Widgets are organized into functional categories:

### Content Widgets
- ContentWidget - Rich HTML content
- HeroWidget - Hero sections with headers and images
- ImageWidget - Single images and galleries

### Layout Widgets  
- TwoColumnsWidget - Two-column container
- ThreeColumnsWidget - Three-column container
- SidebarWidget - Sidebar content areas

### Navigation Widgets
- NavbarWidget - Top navigation bar
- NavigationWidget - Dynamic navigation menus
- FooterWidget - Site footer with columns

### Form Widgets
- FormsWidget - Dynamic forms with validation
- TableWidget - Advanced data tables

### Content Display Widgets
- NewsListWidget - News article listings
- NewsDetailWidget - News article detail views
- SidebarTopNewsWidget - Compact news sidebar
- TopNewsPlugWidget - Featured news grids

### Utility Widgets
- HeaderWidget - Responsive header images
- PathDebugWidget - Path variable debugger (development only)

## Quick Reference by Widget

### ContentWidget

**Purpose:** Display rich HTML content with optional lightbox support

**Key Parameters:**
- `content` (str, required) - HTML content
- `anchor` (str) - Section anchor ID
- `enableLightbox` (bool) - Auto-add lightbox to images
- `componentStyle` (str) - Theme component style

**Template Access:**
```django
{{ config.content }}
{{ config.processed_content }}  {# With media inserts processed #}
{{ config.anchor }}
```

**Basic Example:**
```json
{
  "content": "<p>Simple paragraph text</p>",
  "componentStyle": "default"
}
```

**Special Features:**
- Processes media inserts with gallery styles
- Auto-applies lightbox attributes to images
- HTML sanitization support

---

### HeroWidget

**Purpose:** Create hero sections with headers, optional text, and background images

**Key Parameters:**
- `header` (str, required) - Main header text (H1)
- `beforeText` (str) - Text before header
- `afterText` (str) - Text after header
- `image` (object) - Background image
- `textColor`, `decorColor`, `backgroundColor` (str) - Color customization

**Template Access:**
```django
{{ config.header }}
{{ config.hero_style }}  {# Computed CSS variables #}
{{ config.background_image_url }}  {# Processed imgproxy URL #}
```

**Basic Example:**
```json
{
  "header": "Welcome to Our Website",
  "textColor": "#ffffff",
  "backgroundColor": "#1f2937"
}
```

**Special Features:**
- Responsive background images via imgproxy
- CSS variable injection for colors
- Component style support

---

### ImageWidget

**Purpose:** Display single images, galleries, or video with custom styles

**Key Parameters:**
- `mediaItems` (list) - Images/videos to display
- `imageStyle` (str) - Named style from theme
- `enableLightbox` (bool) - Enable lightbox viewing
- `showCaptions` (bool) - Display captions
- `collectionId` (str) - Media collection ID

**Template Access:**
```django
{{ config.media_items }}  {# Resolved from collections #}
{{ config.enable_lightbox }}
{{ config.image_style }}
```

**Basic Example:**
```json
{
  "mediaItems": [{
    "url": "/media/photo.jpg",
    "altText": "Photo description"
  }],
  "enableLightbox": true
}
```

**Special Features:**
- Collection resolution
- Gallery/carousel style support
- Imgproxy integration for responsive images
- Lightbox support

---

### TableWidget

**Purpose:** Create advanced data tables with cell styling and merging

**Key Parameters:**
- `rows` (list, required) - Table rows with cells
- `columnWidths` (list) - Column width specifications
- `showBorders`, `stripedRows`, `hoverEffect` (bool) - Styling options
- `caption` (str) - Table caption

**Template Access:**
```django
{% for row in config.rows %}
  {% for cell in row.cells %}
    {{ cell.content }}
  {% endfor %}
{% endfor %}
```

**Special Features:**
- Cell merging (colspan/rowspan)
- Image cells support
- Custom cell styling (colors, alignment, borders)
- Special editor interface
- Responsive design

---

### NavbarWidget

**Purpose:** Create top navigation bars with primary and secondary menus

**Key Parameters:**
- `menuItems` (list) - Primary menu items
- `secondaryMenuItems` (list) - Secondary menu items (right-aligned)
- `backgroundImage`, `backgroundColor` (str) - Styling
- `hamburgerBreakpoint` (int) - Mobile breakpoint

**Template Access:**
```django
{{ config.navbar_style }}  {# Computed inline styles #}
{% for item in config.menu_items %}  {# Filtered menu items #}
  {{ item.label }} - {{ item.url }}
{% endfor %}
```

**Special Features:**
- Filters unpublished pages from menu
- Background image/color support
- Responsive hamburger menu
- Secondary menu with custom colors

---

### FooterWidget

**Purpose:** Site footer with multi-column layout and social links

**Key Parameters:**
- `columns` (list) - Footer columns with items
- `columnCount` (int) - Number of columns
- `showCopyright` (bool) - Show copyright notice
- `socialLinks` (list) - Social media links

**Template Access:**
```django
{% for column in config.columns %}
  <h3>{{ column.title }}</h3>
  {% for item in column.items %}
    {{ item.label }} - {{ item.url }}
  {% endfor %}
{% endfor %}
```

**Special Features:**
- Flexible column count (1-6)
- Social media link support
- Copyright text customization
- Background image/color support

---

### FormsWidget

**Purpose:** Create dynamic forms with validation and submission handling

**Key Parameters:**
- `title`, `description` (str) - Form header
- `fields` (list, required) - Form field definitions
- `submitUrl`, `submitMethod` (str) - Submission config
- `ajaxSubmit` (bool) - AJAX vs form submit
- `emailNotifications`, `storeSubmissions` (bool) - Processing options

**Template Access:**
```django
{{ config.title }}
{% for field in config.fields %}
  {{ field.label }} - {{ field.type }}
{% endfor %}
```

**Special Features:**
- Multiple field types (text, email, select, checkbox, etc.)
- Field validation rules
- Honeypot spam protection
- reCAPTCHA support
- Email notifications

---

### NavigationWidget

**Purpose:** Dynamic navigation from page sections or child pages

**Key Parameters:**
- `menus` (dict) - Menu configuration (activeGroup, formData)
- `menuItems` (list) - Static menu items
- `navigationStyle` (str) - Component style

**Template Access:**
```django
{% for item in config.dynamic_menu_items %}  {# Auto-generated #}
  {{ item.label }} - {{ item.url }}
{% endfor %}
{{ config.owner_page }}  {# For inherited widgets #}
```

**Special Features:**
- Page section navigation (from widget anchors)
- Page submenu (from child pages)
- Inheritance-aware (uses owner page for submenus)
- Context-rich rendering

---

### NewsListWidget

**Purpose:** Display list of news articles from object types

**Key Parameters:**
- `objectTypes` (list) - Object type IDs
- `limit` (int) - Max items to display
- `sortOrder` (str) - Sort order
- `showExcerpts`, `showFeaturedImage` (bool) - Display options

**Template Access:**
```django
{% for item in config.news_items %}  {# Queried items #}
  {{ item.title }}
  {{ item.excerpt_text }}
{% endfor %}
```

**Special Features:**
- Queries published objects
- Auto-generates excerpts
- Featured image support
- Hide on detail view option

---

### NewsDetailWidget

**Purpose:** Display single news article detail page

**Key Parameters:**
- `slugVariableName` (str) - Path variable name
- `objectTypes` (list) - Object type IDs
- `showMetadata`, `showFeaturedImage` (bool) - Display options
- `renderObjectWidgets` (bool) - Render object's widgets

**Template Access:**
```django
{{ config.news_object }}  {# ObjectInstance #}
{{ config.published_version }}  {# ObjectVersion #}
{{ config.content_html }}
{{ config.metadata }}
```

**Special Features:**
- Slug-based object lookup
- Multi-type support
- Object widget rendering
- Metadata display

---

## CSS Variables

All widgets define CSS variables that can be overridden in theme styles. Access them in custom CSS:

```css
.widget-type-easy-widgets-contentwidget {
    --content-font: 'Georgia', serif;
    --content-line-height: 1.8;
}
```

See each widget's `css_variables` property for available variables.

## API Endpoints

### Get All Widget Quick References
```
GET /api/webpages/widget-quick-reference/
```

Returns comprehensive documentation for all widgets.

### Get Widget Quick Reference
```
GET /api/webpages/widget-quick-reference/{widget_type}/
```

Returns documentation for a specific widget type.

## Frontend Integration

The Quick Reference is accessible from the widget editor:

1. Open any widget in the widget editor
2. Click the help icon (?) in the header
3. Browse tabs: Overview, Template Parameters, Examples, CSS Variables
4. Copy examples or view parameter documentation

## Examples Location

All widget examples are defined in `backend/easy_widgets/widget_examples.py` with both basic and advanced configurations.

## Further Reading

- [Code-Based Widget System](./CODE_BASED_WIDGET_SYSTEM.md) - Widget architecture
- [Widget Template Parameters](./WIDGET_TEMPLATE_PARAMETERS.md) - Parameter passing details
- Frontend: `/frontend/src/components/widget-help/` - Help panel components


## Component Style Property Access

Component styles can access widget configuration properties for granular styling control.

### How It Works

When a widget uses a component style, the Mustache template receives:

1. **`content`** - Pre-rendered widget HTML
2. **`config`** - Raw widget configuration (snake_case)
3. **`slots`** - Slot data for container widgets
4. **Style variables** - Custom variables from the style definition

### Example: Hero Widget

**Widget Configuration (camelCase from frontend):**
```json
{
  "header": "Welcome",
  "beforeText": "Introduction",
  "afterText": "Join us today",
  "textColor": "#ffffff",
  "backgroundColor": "#1f2937"
}
```

**Component Style Template (snake_case):**
```mustache
<div class="custom-hero" style="background: {{config.background_color}}; color: {{config.text_color}};">
  {{#config.before_text}}<p class="intro">{{config.before_text}}</p>{{/config.before_text}}
  <h1>{{config.header}}</h1>
  {{#config.after_text}}<p class="cta">{{config.after_text}}</p>{{/config.after_text}}
</div>
```

### Three Approaches

**Approach 1: Wrapper** - Style the container
```mustache
<div class="card-wrapper">
  {{{content}}}
</div>
```

**Approach 2: Direct** - Rebuild from config
```mustache
<div style="background: {{config.background_color}};">
  <h1>{{config.header}}</h1>
</div>
```

**Approach 3: Hybrid** (Recommended)
```mustache
<div class="hero-custom" style="--color: {{config.text_color}};">
  <h1>{{config.header}}</h1>
  <div class="default-content">{{{content}}}</div>
</div>
```

### Available in Component Style Scenarios

The component style editor includes scenarios for all widget types showing how to use config properties. Look for scenarios prefixed with the widget name:

- **Content:** Card Wrapper, Custom Render
- **Hero:** Gradient Overlay, Split Screen
- **Table:** Modern Gradient Header, Minimal Striped
- **Navbar:** Gradient, Glassmorphism
- **Footer:** Dark with Accent, Gradient
- **Form:** Elevated Card, Inline Newsletter
- **Navigation:** Manual Menu, SubPage Menu, Anchor Menu
- **News:** Card Grid, Timeline
- **Columns:** Feature Cards, Balanced Dividers
- **Image:** Framed
- **Header:** Shadow Depth
- **Sidebar:** Accent Border

Each scenario documents available config properties and shows how to use them.

## Component Style Configuration Access

Component styles provide **two levels of access** to widget data:

### 1. Rendered Content (Traditional)

The `{{{content}}}` variable contains the fully rendered widget HTML using the default template:

```mustache
<div class="custom-wrapper">
  {{{content}}}
</div>
```

This wraps the widget's default appearance with custom styling.

### 2. Raw Configuration (New)

The `config` object contains **all widget configuration properties** in snake_case:

```mustache
<div class="custom-hero" style="background: {{config.background_color}}; color: {{config.text_color}};">
  {{#config.before_text}}<p>{{config.before_text}}</p>{{/config.before_text}}
  <h1>{{config.header}}</h1>
  {{#config.after_text}}<p>{{config.after_text}}</p>{{/config.after_text}}
</div>
```

This allows complete control over widget rendering from scratch.

### 3. Hybrid Approach (Recommended)

Combine both for maximum flexibility:

```mustache
<div class="hero-custom" style="--primary: {{config.text_color}};">
  <div class="custom-header">
    <h1>{{config.header}}</h1>
  </div>
  <div class="default-content">
    {{{content}}}
  </div>
</div>
```

### Available Config Properties by Widget

#### ContentWidget
```mustache
{{config.content}}          {# Raw HTML content (snake_case) #}
{{config.anchor}}           {# Section anchor ID #}
{{config.allow_scripts}}    {# Boolean (snake_case) #}
{{config.sanitize_html}}    {# Boolean (snake_case) #}
{{config.enable_lightbox}}  {# Boolean (snake_case) #}
```

#### HeroWidget
```mustache
{{config.header}}            {# Main header text (required) #}
{{config.before_text}}       {# Text before header (snake_case) #}
{{config.after_text}}        {# Text after header (snake_case) #}
{{config.text_color}}        {# Text color hex (snake_case) #}
{{config.decor_color}}       {# Decoration color (snake_case) #}
{{config.background_color}}  {# Background color (snake_case) #}
{{config.background_image_url}} {# Processed imgproxy URL (computed) #}
```

#### TableWidget
```mustache
{{config.caption}}          {# Table caption #}
{{config.show_borders}}     {# Boolean (snake_case) #}
{{config.striped_rows}}     {# Boolean (snake_case) #}
{{config.hover_effect}}     {# Boolean (snake_case) #}
{{config.responsive}}       {# Boolean #}
{{config.table_width}}      {# "auto" or "full" (snake_case) #}
{{#config.rows}}            {# Array of row objects #}
  {{#cells}}
    {{content}}
  {{/cells}}
{{/config.rows}}
```

#### FormWidget
```mustache
{{config.title}}                {# Form title (required) #}
{{config.description}}          {# Form description #}
{{config.submit_button_text}}   {# Submit button text (snake_case) #}
{{config.success_message}}      {# Success message (snake_case) #}
{{config.ajax_submit}}          {# Boolean (snake_case) #}
{{#config.fields}}              {# Array of form fields #}
  {{name}} {{label}} {{type}}
{{/config.fields}}
```

#### NavbarWidget
```mustache
{{config.background_color}}     {# Background color (snake_case) #}
{{config.background_alignment}} {# Image alignment (snake_case) #}
{{config.hamburger_breakpoint}} {# Mobile breakpoint px (snake_case) #}
{{#config.menu_items}}          {# Filtered menu items (snake_case) #}
  {{label}} {{url}} {{is_active}}
{{/config.menu_items}}
```

#### FooterWidget
```mustache
{{config.column_count}}         {# Number of columns (snake_case) #}
{{config.show_copyright}}       {# Boolean (snake_case) #}
{{config.copyright_text}}       {# Copyright text (snake_case) #}
{{config.background_color}}     {# Background color (snake_case) #}
{{#config.columns}}             {# Array of column objects #}
  {{title}}
  {{#items}}
    {{label}} {{url}}
  {{/items}}
{{/config.columns}}
```

#### Container Widgets (TwoColumns, ThreeColumns)

Container widgets also provide **slot data**:

```mustache
{{config.layout_style}}         {# Selected layout style (snake_case) #}
{{#slots.left}}                 {# Left slot widgets #}
  {{{html}}}                    {# Rendered widget HTML #}
{{/slots.left}}
{{#slots.right}}                {# Right slot widgets #}
  {{{html}}}
{{/slots.right}}
{{#slots.center}}               {# Center slot (ThreeColumns only) #}
  {{{html}}}
{{/slots.center}}
```

### Component Style Scenarios

The component style editor includes pre-built scenarios showing how to use config properties. Access these when editing a component style:

1. Navigate to Theme Editor → Component Styles
2. Edit or create a component style
3. Click "Quick Reference" dropdown
4. Select a scenario prefixed with the widget name

**Example Scenarios:**
- **Content: Custom Render** - Shows direct `{{config.content}}` access
- **Hero: Gradient Overlay** - Shows `{{config.header}}`, `{{config.text_color}}` usage
- **Form: Elevated Card** - Shows `{{config.title}}`, `{{config.description}}` usage
- **Table: Modern Gradient** - Shows table styling with config access
- **Navbar: Gradient** - Shows navbar background customization
- **Footer: Dark with Accent** - Shows footer with config-based colors

### Remember: snake_case in Templates!

The most common mistake is using camelCase in templates:

```mustache
<!-- ❌ WRONG - Won't work -->
<div style="color: {{config.textColor}};">
  <h1>{{config.beforeText}}</h1>
</div>

<!-- ✅ CORRECT - Use snake_case -->
<div style="color: {{config.text_color}};">
  <h1>{{config.before_text}}</h1>
</div>
```

Even though your frontend code sends `textColor` and `beforeText`, the backend converts these to `text_color` and `before_text`, so templates must use snake_case.
