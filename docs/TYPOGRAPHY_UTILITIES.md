# Typography Utilities Reference

This document describes the custom typography system available in the eceee_v4 project.

## Default Content Typography

**Content typography is automatically applied to unclassed HTML tags.** You don't need to add classes for standard content:

```html
<h1>This heading automatically gets content h1 styling</h1>
<h2>This heading automatically gets content h2 styling</h2>
<h3>This heading automatically gets content h3 styling</h3>
<p>This paragraph automatically gets content paragraph styling</p>
<ul>
  <li>List items inherit from parent styling</li>
</ul>
```

### Default Styles Applied

- **h1**: 41px/44px, semibold weight, 22px bottom margin
- **h2**: 36px/43px, medium weight, 22px bottom margin
- **h3**: 22px/26px, bold weight, 22px bottom margin
- **p**: 16px/22px, light weight, 22px bottom margin
- **ul, ol**: 22px bottom margin

## Contextual Typography Utilities

For special sections (hero and sidebar), use these utility classes:

### Hero Typography

**Hero H1**: Use for large hero headings
```html
<h1 class="text-hero-h1 font-light">Hero Heading</h1>
```
- Font size: 54px
- Line height: 65px
- Recommended weight: `font-light`
- Note: Margin is inherited from default h1 styling (22px)

### Sidebar Typography

**Sidebar H4**: Use for sidebar headings
```html
<h4 class="text-sidebar-h4 font-bold">Sidebar Heading</h4>
```
- Font size: 18px
- Line height: 22px
- Recommended weight: `font-bold`
- Margin: Inherits 22px from default

**Sidebar Paragraph**: Use for sidebar text
```html
<p class="text-sidebar-p font-light">Sidebar paragraph text.</p>
```
- Font size: 14px
- Line height: 17px
- Recommended weight: `font-light`
- Margin: Inherits 22px from default

**Sidebar List Items**: Use for sidebar lists
```html
<ul>
  <li class="text-sidebar-li">List item text</li>
</ul>
```
- Font size: 14px
- Line height: 17px
- Recommended weight: `font-normal` (regular)
- Margin: List container inherits 22px from default

## Usage Notes

1. **Default Content Styling**: Standard HTML tags (h1, h2, h3, p, ul, ol) automatically receive content typography styling. No classes needed for regular content.

2. **Override When Needed**: Use utility classes for special sections:
   - Hero sections: Use `text-hero-h1` with `font-light`
   - Sidebar sections: Use `text-sidebar-*` utilities with appropriate weights

3. **Font Weights**: Available font weight utilities:
   - `font-light` (300) - for hero h1 and content paragraphs
   - `font-normal` (400) - for sidebar list items
   - `font-medium` (500) - for content h2
   - `font-semibold` (600) - for content h1 (default)
   - `font-bold` (700) - for content h3 and sidebar h4

4. **Spacing**: All typography elements have 22px bottom margin by default. Override with Tailwind spacing utilities if needed (e.g., `mb-0`, `mb-4`)

5. **Optional mb-text Utility**: A `mb-text` utility (22px) is available if you need to manually apply the standard spacing

## Complete Examples

### Hero Section
```html
<section class="hero">
  <h1 class="text-hero-h1 font-light">
    Welcome to ECEEE
  </h1>
</section>
```

### Content Section (Default - No Classes Needed!)
```html
<article class="content">
  <!-- All elements below use default typography automatically -->
  <h1>Main Article Title</h1>
  
  <h2>Section Heading</h2>
  
  <p>
    This is a paragraph of body text with the standard content styling.
    No classes needed!
  </p>
  
  <h3>Subsection Heading</h3>
  
  <p>Another paragraph of body text.</p>
  
  <ul>
    <li>List item one</li>
    <li>List item two</li>
  </ul>
</article>
```

### Sidebar Section
```html
<aside class="sidebar">
  <h4 class="text-sidebar-h4 font-bold">
    Quick Links
  </h4>
  
  <p class="text-sidebar-p font-light">
    Find important resources below:
  </p>
  
  <ul>
    <li class="text-sidebar-li">Resource One</li>
    <li class="text-sidebar-li">Resource Two</li>
    <li class="text-sidebar-li">Resource Three</li>
  </ul>
</aside>
```

## Configuration

The typography system is defined in `backend/tailwind.config.js`:

### Base Styles (Auto-applied to HTML tags)
```javascript
plugins: [
  function ({ addBase }) {
    addBase({
      // Content typography - applied to unclassed HTML tags
      'h1': {
        'font-size': '41px',
        'line-height': '44px',
        'font-weight': '600', // semibold
        'margin-bottom': '22px',
      },
      'h2': {
        'font-size': '36px',
        'line-height': '43px',
        'font-weight': '500', // medium
        'margin-bottom': '22px',
      },
      'h3': {
        'font-size': '22px',
        'line-height': '26px',
        'font-weight': '700', // bold
        'margin-bottom': '22px',
      },
      'p': {
        'font-size': '16px',
        'line-height': '22px',
        'font-weight': '300', // light
        'margin-bottom': '22px',
      },
      'ul, ol': {
        'margin-bottom': '22px',
      },
    })
  }
]
```

### Utility Classes (For Hero & Sidebar)
```javascript
fontSize: {
  // Hero typography
  'hero-h1': ['54px', '65px'],
  
  // Sidebar typography
  'sidebar-h4': ['18px', '22px'],
  'sidebar-p': ['14px', '17px'],
  'sidebar-li': ['14px', '17px'],
},
spacing: {
  'text': '22px', // Optional manual spacing utility
},
```

