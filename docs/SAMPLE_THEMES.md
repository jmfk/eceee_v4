# Sample Themes for Content Styling

## Example 1: Modern Blue Theme

**Theme Configuration:**
```json
{
  "name": "Modern Blue",
  "description": "Clean, modern design with blue accents",
  "cssVariables": {
    "primary": "#2563eb",
    "primary-dark": "#1d4ed8",
    "primary-light": "#93c5fd",
    "text": "#1f2937",
    "text-muted": "#6b7280",
    "background": "#ffffff",
    "surface": "#f8fafc",
    "heading-color": "#1e40af",
    "heading-weight": "700",
    "link-color": "#2563eb",
    "link-decoration": "none",
    "paragraph-spacing": "1.25em",
    "h1-size": "2.5rem",
    "h2-size": "2rem"
  },
  "customCss": "h1 { border-bottom: 2px solid var(--primary); padding-bottom: 0.5rem; }\na:hover { background-color: var(--primary-light); padding: 0.125rem 0.25rem; border-radius: 0.25rem; }"
}
```

## Example 2: Dark Theme

**Theme Configuration:**
```json
{
  "name": "Dark Professional",
  "description": "Dark theme for professional content",
  "cssVariables": {
    "primary": "#8b5cf6",
    "primary-dark": "#7c3aed",
    "primary-light": "#c4b5fd",
    "text": "#f9fafb",
    "text-muted": "#d1d5db",
    "background": "#111827",
    "surface": "#1f2937",
    "heading-color": "#c4b5fd",
    "heading-weight": "600",
    "link-color": "#8b5cf6",
    "code-bg": "#374151",
    "code-color": "#f3f4f6",
    "blockquote-border": "4px solid #8b5cf6"
  },
  "customCss": "blockquote { background-color: var(--surface); padding: 1rem; border-radius: 0.5rem; }"
}
```

## Example 3: Elegant Typography Theme

**Theme Configuration:**
```json
{
  "name": "Elegant Typography",
  "description": "Focus on beautiful typography and readability",
  "cssVariables": {
    "primary": "#059669",
    "text": "#374151",
    "text-muted": "#6b7280",
    "background": "#ffffff",
    "surface": "#f9fafb",
    "font-family": "'Crimson Text', Georgia, serif",
    "heading-color": "#1f2937",
    "heading-weight": "400",
    "h1-size": "3rem",
    "h2-size": "2.25rem",
    "h3-size": "1.75rem",
    "line-height": "1.8",
    "paragraph-spacing": "1.5em",
    "link-decoration": "none",
    "code-font": "'Fira Code', 'SF Mono', monospace"
  },
  "customCss": "h1, h2, h3 { font-family: 'Playfair Display', serif; letter-spacing: -0.025em; }\np { font-size: 1.125rem; }\ncode { background-color: #f1f5f9; border: 1px solid #e2e8f0; }"
}
```

## Example 4: Minimal Theme

**Theme Configuration:**
```json
{
  "name": "Minimal Clean",
  "description": "Ultra-minimal design with subtle styling",
  "cssVariables": {
    "primary": "#000000",
    "text": "#333333",
    "text-muted": "#666666",
    "background": "#ffffff",
    "heading-color": "#000000",
    "heading-weight": "500",
    "link-color": "#000000",
    "link-decoration": "underline",
    "paragraph-spacing": "1.2em",
    "heading-margin-top": "2em",
    "heading-margin-bottom": "0.8em"
  },
  "customCss": "h1, h2, h3 { font-family: 'Inter', sans-serif; }\na { border-bottom: 1px solid currentColor; text-decoration: none; }\na:hover { border-bottom: 2px solid currentColor; }"
}
```

## Testing Your Themes

### 1. Create Test Content

Use this sample HTML content to test your themes:

```html
<h1>Main Heading</h1>
<p>This is a paragraph with <a href="#">a link</a> and some <strong>bold text</strong>.</p>

<h2>Secondary Heading</h2>
<p>Another paragraph with more content to see how the spacing and typography work.</p>

<h3>Lists Example</h3>
<ul>
  <li>First list item</li>
  <li>Second list item with <em>italic text</em></li>
  <li>Third item</li>
</ul>

<blockquote>
  This is a blockquote to test quote styling.
</blockquote>

<p>Here's some <code>inline code</code> and a code block:</p>

<pre><code>function example() {
  return "Hello, World!";
}</code></pre>
```

### 2. Test in Different Modes

- **Editor Mode**: Check how content looks while editing
- **Preview Mode**: Verify final appearance
- **Different Widgets**: Test with ContentWidget, HeaderWidget, etc.

### 3. Verify Scoping

Ensure that:
- Admin interface styling is not affected
- Only content areas receive theme styling
- Theme classes are properly applied

## CSS Variable Reference

### Essential Variables

- `--primary`: Primary brand color
- `--text`: Main text color  
- `--background`: Content background
- `--heading-color`: Heading text color
- `--link-color`: Link color

### Typography Variables

- `--font-family`: Content font family
- `--line-height`: Text line height
- `--heading-weight`: Heading font weight
- `--paragraph-spacing`: Space between paragraphs

### Size Variables

- `--h1-size` through `--h6-size`: Heading sizes
- `--code-size`: Code font size

### Spacing Variables

- `--heading-margin-top`: Space above headings
- `--heading-margin-bottom`: Space below headings
- `--list-margin`: List margins
- `--blockquote-margin`: Blockquote margins

## Advanced Customization

### Custom CSS Examples

**Fancy Headings:**
```css
h1 {
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

**Styled Links:**
```css
a {
  position: relative;
  text-decoration: none;
}

a::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 2px;
  background: var(--primary);
  transition: width 0.3s ease;
}

a:hover::after {
  width: 100%;
}
```

**Custom Lists:**
```css
ul li {
  position: relative;
  padding-left: 1.5em;
  list-style: none;
}

ul li::before {
  content: '→';
  position: absolute;
  left: 0;
  color: var(--primary);
  font-weight: bold;
}
```

## Troubleshooting

### Theme Not Showing

1. **Check Theme Selection**: Ensure theme is selected in Page Editor → Theme tab
2. **Verify Content Classes**: Content should have `.theme-content` or `.widget-content` classes
3. **CSS Validation**: Check browser console for CSS errors
4. **Cache Issues**: Try refreshing the page

### Admin Interface Affected

1. **CSS Scoping**: Ensure custom CSS uses proper scoping
2. **Specific Selectors**: Use `.theme-content` prefix for all custom rules
3. **Avoid Global Styles**: Don't use `body`, `html`, or other global selectors

### Performance Issues

1. **Large CSS**: Keep custom CSS minimal
2. **Complex Selectors**: Use simple, efficient CSS selectors
3. **Variable Overuse**: Don't define too many CSS variables

## Migration Guide

If you have existing custom CSS that needs to be converted to themes:

1. **Extract Variables**: Identify repeated values (colors, sizes, etc.)
2. **Add Scoping**: Prefix selectors with `.theme-content`
3. **Test Thoroughly**: Ensure no admin interface conflicts
4. **Use Variables**: Replace hardcoded values with CSS variables
