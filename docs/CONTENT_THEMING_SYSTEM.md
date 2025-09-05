# Content Theming System

## Overview

The Content Theming System allows you to apply custom CSS designs to regular HTML elements (headings, paragraphs, lists, etc.) in content editors and widget previews. Themes only affect content areas and do not interfere with the admin interface styling.

## How It Works

### 1. Theme Scoping

Themes are applied using CSS scoping to specific content areas:

- **`.theme-content`** - General content areas
- **`.widget-content`** - Widget content previews  
- **`.content-editor-theme`** - Content editor areas

### 2. CSS Variable System

Themes use CSS custom properties (variables) that can be overridden:

```css
.theme-content {
  --primary: #3b82f6;
  --text: #1f2937;
  --background: #ffffff;
  --heading-color: var(--primary);
  --link-color: var(--primary);
}
```

### 3. Supported Elements

The theming system styles these HTML elements in content areas:

- **Headings**: `h1`, `h2`, `h3`, `h4`, `h5`, `h6`
- **Text**: `p`, `span`, `div`
- **Links**: `a`
- **Lists**: `ul`, `ol`, `li`
- **Code**: `code`, `pre`
- **Quotes**: `blockquote`

## Usage

### 1. Create a Theme

1. Go to **Theme Editor** in the admin interface
2. Create a new theme with:
   - **CSS Variables**: Define color scheme and styling variables
   - **Custom CSS**: Add specific styling rules

Example theme variables:
```json
{
  "primary": "#10b981",
  "text": "#065f46", 
  "background": "#f0fdf4",
  "heading-weight": "700",
  "link-decoration": "none"
}
```

### 2. Apply Theme to Page

1. Open **Page Editor**
2. Go to **Theme** tab
3. Select a theme from available options
4. Theme will be applied to all content areas in the page

### 3. Content Areas Affected

**In ContentWidget Editor Mode:**
- The rich text editor content gets themed
- Toolbar remains unaffected (admin interface)

**In ContentWidget Preview Mode:**
- The rendered HTML content gets themed
- Widget container remains unaffected

**In Layout Previews:**
- All widget content areas get themed
- Layout structure and admin controls remain unaffected

## Theme Variables Reference

### Core Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `--primary` | Primary color for headings, links | `#3b82f6` |
| `--text` | Main text color | `#1f2937` |
| `--text-muted` | Muted text color | `#6b7280` |
| `--background` | Content background | `transparent` |
| `--surface` | Widget surface background | `transparent` |

### Typography Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `--font-family` | Content font family | `inherit` |
| `--line-height` | Content line height | `1.6` |
| `--heading-color` | Heading color | `var(--primary)` |
| `--heading-weight` | Heading font weight | `600` |
| `--h1-size` through `--h6-size` | Heading sizes | `2.25rem` to `1rem` |

### Link Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `--link-color` | Link color | `var(--primary)` |
| `--link-hover-color` | Link hover color | `var(--primary-dark)` |
| `--link-decoration` | Link text decoration | `underline` |

### Code Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `--code-bg` | Code background | `#f3f4f6` |
| `--code-color` | Code text color | `#1f2937` |
| `--code-font` | Code font family | `ui-monospace, 'SF Mono', monospace` |

## Example Theme

Here's an example of a complete theme configuration:

```json
{
  "name": "Green Nature Theme",
  "description": "A nature-inspired green theme",
  "cssVariables": {
    "primary": "#10b981",
    "primary-dark": "#059669", 
    "text": "#065f46",
    "text-muted": "#6b7280",
    "background": "#f0fdf4",
    "surface": "#ffffff",
    "heading-color": "#064e3b",
    "link-color": "#059669",
    "code-bg": "#ecfdf5",
    "blockquote-border": "4px solid #10b981"
  },
  "customCss": "h1 { font-size: 3rem; font-weight: 800; }\np { font-size: 1.125rem; }"
}
```

## Technical Implementation

### Components Involved

1. **`useTheme` Hook** - Manages theme CSS injection
2. **`ThemeSelector`** - UI for selecting page themes
3. **`ContentWidget`** - Applies theme classes to content
4. **`LayoutRenderer`** - Injects theme CSS for widget previews
5. **`widgetRenderer`** - Adds theme classes to widget HTML

### CSS Injection Flow

1. Theme is selected in PageEditor
2. `ContentEditor` detects theme change
3. `LayoutRenderer.applyTheme()` is called
4. Theme CSS is generated and injected into `<head>`
5. Content areas with theme classes receive styling

### Security

- All CSS is sanitized before injection
- Dangerous patterns (script injection, etc.) are blocked
- CSS is scoped to content areas only
- Admin interface styling is protected

## Best Practices

### Creating Themes

1. **Use CSS Variables**: Prefer variables over hardcoded values for flexibility
2. **Test Responsiveness**: Ensure themes work on different screen sizes
3. **Maintain Readability**: Ensure sufficient color contrast
4. **Scope Carefully**: Test that admin interface isn't affected

### Using Themes

1. **Preview First**: Use the preview feature before applying
2. **Test Content**: Check how different content types look
3. **Version Control**: Theme changes are tracked with page versions
4. **Inheritance**: Consider how themes affect child pages

## Troubleshooting

### Theme Not Applying

1. Check if theme is active (`isActive: true`)
2. Verify content has theme classes (`.theme-content`, etc.)
3. Check browser console for CSS injection errors
4. Ensure theme CSS variables are valid

### Conflicts with Admin Styling

1. Verify CSS is properly scoped to content areas
2. Check for overly broad selectors in custom CSS
3. Use more specific selectors if needed
4. Test in both edit and preview modes

### Performance Issues

1. Themes are cached after first load
2. CSS injection is optimized for minimal DOM manipulation
3. Large custom CSS should be avoided
4. Use CSS variables instead of complex selectors when possible
