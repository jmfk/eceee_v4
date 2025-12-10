# Typography Utilities Reference

This document describes the custom typography system available in the eceee_v4 project.

## Styled Div/Span Approach

**The eceee_v4 project uses styled divs and spans with Tailwind utility classes instead of semantic HTML tags.** This provides maximum styling flexibility and consistency.

### Standard Typography Classes

Use these Tailwind utility classes for consistent typography:

```jsx
<div className="text-4xl font-semibold mb-6">Heading 1</div>
<div className="text-3xl font-medium mb-6">Heading 2</div>
<div className="text-2xl font-bold mb-6">Heading 3</div>
<div className="text-xl font-semibold mb-4">Heading 4</div>
<div className="text-lg font-semibold mb-4">Heading 5</div>
<div className="text-base font-semibold mb-4">Heading 6</div>

<div className="text-base font-light mb-6">
  Paragraph text with <span className="font-bold">bold text</span> and <span className="italic">italic text</span>.
</div>

<div className="mb-6 pl-6" role="list">
  <div className="mb-2 list-item list-disc">List item one</div>
  <div className="mb-2 list-item list-disc">List item two</div>
</div>
```

### Default Styling Reference

- **Heading 1**: `text-4xl font-semibold mb-6` (36px, semibold, 24px margin)
- **Heading 2**: `text-3xl font-medium mb-6` (30px, medium, 24px margin)
- **Heading 3**: `text-2xl font-bold mb-6` (24px, bold, 24px margin)
- **Heading 4**: `text-xl font-semibold mb-4` (20px, semibold, 16px margin)
- **Heading 5**: `text-lg font-semibold mb-4` (18px, semibold, 16px margin)
- **Heading 6**: `text-base font-semibold mb-4` (16px, semibold, 16px margin)
- **Paragraph**: `text-base font-light mb-6` (16px, light, 24px margin)
- **Lists**: `mb-6 pl-6` with `list-disc` or `list-decimal`
- **List items**: `mb-2 list-item`

## Contextual Typography Utilities

For special sections (hero and sidebar), use these utility classes:

### Hero Typography

**Hero H1**: Use for large hero headings
```jsx
<div className="text-hero-h1 font-light">Hero Heading</div>
```
- Font size: 54px
- Line height: 65px
- Recommended weight: `font-light`

### Sidebar Typography

**Sidebar H4**: Use for sidebar headings
```jsx
<div className="text-sidebar-h4 font-bold">Sidebar Heading</div>
```
- Font size: 18px
- Line height: 22px
- Recommended weight: `font-bold`

**Sidebar Paragraph**: Use for sidebar text
```jsx
<div className="text-sidebar-p font-light">Sidebar paragraph text.</div>
```
- Font size: 14px
- Line height: 17px
- Recommended weight: `font-light`

**Sidebar List Items**: Use for sidebar lists
```jsx
<div className="mb-6 pl-6" role="list">
  <div className="text-sidebar-li">List item text</div>
</div>
```
- Font size: 14px
- Line height: 17px
- Recommended weight: `font-normal` (regular)

## Usage Notes

1. **Styled Divs/Spans**: Use divs for block-level elements (headings, paragraphs, lists) and spans for inline elements (bold, italic, code).

2. **Accessibility**: Add appropriate ARIA attributes when semantic meaning is needed:
   - Headings: Add `role="heading"` and `aria-level="1-6"`
   - Lists: Add `role="list"` to container

3. **Font Weights**: Available font weight utilities:
   - `font-light` (300) - for hero h1 and content paragraphs
   - `font-normal` (400) - for sidebar list items
   - `font-medium` (500) - for heading 2
   - `font-semibold` (600) - for heading 1 (default)
   - `font-bold` (700) - for heading 3 and sidebar h4

4. **Spacing**: Use Tailwind margin utilities (`mb-0`, `mb-2`, `mb-4`, `mb-6`) for consistent spacing

5. **Interactive Elements**: Keep `<a>`, `<button>`, `<input>`, `<form>` as-is - only replace text/content elements

## Complete Examples

### Hero Section
```jsx
<section className="hero">
  <div className="text-hero-h1 font-light">
    Welcome to ECEEE
  </div>
</section>
```

### Content Section with Styled Divs
```jsx
<article className="content">
  <div className="text-4xl font-semibold mb-6" role="heading" aria-level="1">
    Main Article Title
  </div>
  
  <div className="text-3xl font-medium mb-6" role="heading" aria-level="2">
    Section Heading
  </div>
  
  <div className="text-base font-light mb-6">
    This is a paragraph of body text with styled divs.
    Use <span className="font-bold">bold</span> and <span className="italic">italic</span> spans for inline emphasis.
  </div>
  
  <div className="text-2xl font-bold mb-6" role="heading" aria-level="3">
    Subsection Heading
  </div>
  
  <div className="text-base font-light mb-6">Another paragraph of body text.</div>
  
  <div className="mb-6 pl-6" role="list">
    <div className="mb-2 list-item list-disc">List item one</div>
    <div className="mb-2 list-item list-disc">List item two</div>
  </div>
</article>
```

### Sidebar Section
```jsx
<aside className="sidebar">
  <div className="text-sidebar-h4 font-bold">
    Quick Links
  </div>
  
  <div className="text-sidebar-p font-light">
    Find important resources below:
  </div>
  
  <div className="pl-6" role="list">
    <div className="text-sidebar-li">Resource One</div>
    <div className="text-sidebar-li">Resource Two</div>
    <div className="text-sidebar-li">Resource Three</div>
  </div>
</aside>
```

### Special Elements

**Blockquote**
```jsx
<div className="border-l-4 border-blue-500 pl-4 my-6 italic">
  This is a blockquote styled with Tailwind utilities.
</div>
```

**Code Elements**
```jsx
<div className="text-base font-light mb-6">
  Here's some <span className="font-mono text-sm bg-gray-100 px-1 py-0.5 rounded">inline code</span> in text.
</div>

<div className="bg-gray-100 p-4 rounded overflow-x-auto font-mono text-sm">
  {`function example() {
  return "Code block";
}`}
</div>
```

## Configuration

The typography system uses Tailwind utility classes. Custom typography utilities can be added in `frontend/tailwind.config.js`:

### Custom Font Sizes
```javascript
fontSize: {
  // Hero typography
  'hero-h1': ['54px', '65px'],
  
  // Sidebar typography
  'sidebar-h4': ['18px', '22px'],
  'sidebar-p': ['14px', '17px'],
  'sidebar-li': ['14px', '17px'],
},
```

### Theme-Based Styling

For content areas that need theme-based styling, use the `.theme-content` wrapper with class selectors:

```css
.theme-content .text-h1 {
  color: var(--heading-color);
  font-size: var(--h1-size, 2.25rem);
}

.theme-content .text-p {
  color: var(--text);
  margin-bottom: var(--paragraph-spacing, 1em);
}
```

