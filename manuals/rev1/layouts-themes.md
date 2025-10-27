# Layouts & Themes

The Layouts & Themes system in eceee_v4 provides powerful tools for controlling the visual structure and styling of your pages through a flexible template and theming system.

## Overview

eceee_v4 separates structure (layouts) from styling (themes), allowing you to:

- Apply consistent page structures across your site
- Customize visual appearance with themes
- Inherit layouts and themes from parent pages
- Create custom layouts and themes
- Preview changes before applying

## Understanding Layouts

Layouts define the structural template of a page, including:

- Overall page structure
- Content slots for widgets
- Header and footer areas
- Sidebar placements
- Grid and column systems

### Layout Components

**Slots**
- Named areas where widgets can be placed
- Examples: main-content, sidebar, header, footer
- Can have size and position constraints
- Support for nested slots

**Regions**
- Larger structural divisions
- Can contain multiple slots
- Examples: header region, content region, footer region

**Grid System**
- Responsive column layout
- Breakpoints for different screen sizes
- Flexible or fixed width options

## Layout Selection

![Layout Selection](images/layout-selection.png)

To choose a layout for a page:

1. Open the page in the editor
2. Navigate to **Page Settings** → **Layout**
3. View available layouts with thumbnails
4. Click a layout to see detailed preview
5. Select **"Apply Layout"**
6. Existing widgets are mapped to appropriate slots
7. Save the page

### Available Layout Types

**Single Column**
- One main content area
- Full-width design
- Best for: landing pages, articles, simple content

**Two Column (Sidebar Left)**
- Main content on right
- Sidebar on left
- Best for: blogs, documentation, content with navigation

**Two Column (Sidebar Right)**
- Main content on left
- Sidebar on right
- Best for: traditional page layouts, content with supplementary info

**Three Column**
- Center main content
- Sidebars on both sides
- Best for: complex content, dashboards, rich media

**Hero + Content**
- Full-width hero section
- Content sections below
- Best for: marketing pages, product pages, campaign landing pages

**Grid Layout**
- Card-based grid system
- Responsive columns
- Best for: galleries, portfolios, product listings

**Custom Layouts**
- User-defined templates
- Maximum flexibility
- Best for: unique page requirements

## Theme System

![Theme Configuration](images/theme-configuration-panel.png)

Themes control the visual appearance of pages:

### Theme Properties

**Colors**
- Primary color palette
- Secondary colors
- Accent colors
- Background colors
- Text colors
- Link colors

**Typography**
- Font families (headings, body, mono)
- Font sizes and scale
- Line heights
- Letter spacing
- Font weights

**Spacing**
- Padding values
- Margin values
- Gap between elements
- Container widths

**Components**
- Button styles
- Form element styles
- Card styles
- Navigation styles

**Effects**
- Border radius
- Shadows
- Transitions
- Hover effects

## Applying Themes

![Apply Theme](images/apply-theme-dialog.png)

To apply a theme to a page:

1. Open **Page Settings** → **Theme**
2. Browse available themes or search
3. Click a theme to preview
4. View theme details and properties
5. Click **"Apply Theme"**
6. Preview the page with the new theme
7. Save to persist changes

### Theme Options

**Inherit from Parent**
- Use the same theme as the parent page
- Automatic updates when parent theme changes
- Maintains consistency in page hierarchies

**Custom Theme**
- Create a page-specific theme
- Customize colors, fonts, spacing
- Override inherited theme properties

**Global Theme**
- Site-wide theme applied to all pages
- Can be overridden at page level
- Useful for consistent branding

## Layout Inheritance

![Layout Inheritance Visualization](images/layout-inheritance-visualization.png)

Child pages can inherit layouts from parent pages, creating consistency across page hierarchies.

### How Layout Inheritance Works

**Automatic Inheritance**
- New child pages inherit parent's layout by default
- Changes to parent layout don't automatically affect existing children
- New children always get current parent layout

**Explicit Inheritance**
- Enable "Inherit layout from parent" option
- Layout updates when parent layout changes
- Break inheritance to customize child layout

**Inheritance Chain**
- Layouts can inherit through multiple levels
- Each level can override or extend
- Visualization shows inheritance path

### Managing Layout Inheritance

**To enable inheritance:**
1. Open page settings
2. Check **"Inherit layout from parent"**
3. Save the page
4. Layout updates to match parent

**To customize an inherited layout:**
1. Click **"Break Inheritance"**
2. Modify layout as needed
3. Save changes
4. Page now has independent layout

**To restore inheritance:**
1. Click **"Restore Parent Layout"**
2. Confirm restoration
3. Local layout changes are discarded
4. Inheritance re-enabled

## Theme Inheritance

Themes work similarly to layout inheritance:

**Cascade Rules**
- Child pages inherit parent themes unless overridden
- Theme properties cascade (can override individual properties)
- Global theme as fallback

**Partial Overrides**
- Override only specific theme properties
- Inherit everything else from parent
- Example: Keep parent colors but change fonts

**Theme Variants**
- Create theme variations for specific sections
- Based on parent theme with modifications
- Useful for sub-brands or content sections

## Template Preview

![Template Preview](images/template-preview-panel.png)

Preview layouts and themes before applying:

### Preview Features

**Visual Preview**
- Full-page preview of layout structure
- Theme colors and typography applied
- Sample content populated
- Interactive elements functional

**Device Preview**
- Desktop, tablet, mobile views
- Orientation options
- Test responsive behavior
- Check breakpoint transitions

**Side-by-Side Comparison**
- Compare current vs. proposed layout/theme
- Highlight differences
- A/B comparison view

**Print Preview**
- How the page will look when printed
- Print-specific styling
- Page break handling

## Creating Custom Layouts

For advanced users, create custom layouts:

### Layout Editor

![Layout Editor](images/layout-editor-interface.png)

1. Navigate to **Layouts** → **Create New Layout**
2. Name your layout
3. Define layout structure:
   - Add regions
   - Create slots
   - Set constraints
4. Configure responsive behavior
5. Set default widget positions
6. Preview with sample content
7. Save and activate

### Layout Configuration

**Slot Properties:**
- Name and identifier
- Allowed widget types
- Min/max widget count
- Width and height constraints
- Visibility rules

**Responsive Breakpoints:**
- Desktop (>1024px)
- Tablet (768px-1024px)
- Mobile (<768px)
- Custom breakpoints

**Grid Settings:**
- Number of columns
- Gutter size
- Column behavior at breakpoints

## Creating Custom Themes

Build custom themes to match your brand:

### Theme Builder

![Theme Builder](images/theme-builder-interface.png)

1. Navigate to **Themes** → **Create New Theme**
2. Choose a base theme or start from scratch
3. Configure theme properties:

**Color Palette:**
- Primary: Brand color
- Secondary: Complementary color
- Accent: Call-to-action color
- Neutral: Backgrounds and text
- Semantic: Success, warning, error, info

**Typography:**
- Heading fonts: Family, size, weight
- Body text: Family, size, line height
- Code: Monospace font
- Import custom fonts (Google Fonts, Adobe Fonts, etc.)

**Spacing Scale:**
- Base unit (typically 4px or 8px)
- Multipliers: 0.5x, 1x, 2x, 3x, 4x, 6x, 8x
- Custom values for specific needs

**Component Styles:**
- Buttons: Sizes, states, variants
- Forms: Input styles, focus states
- Cards: Borders, shadows, padding
- Navigation: Link styles, active states

4. Preview theme on sample pages
5. Test across different page types
6. Save and apply

### Theme Variables

Themes use CSS custom properties (variables):

```css
--color-primary: #007bff;
--color-secondary: #6c757d;
--font-family-base: 'Inter', sans-serif;
--font-size-base: 16px;
--spacing-unit: 8px;
--border-radius: 4px;
```

Advanced users can edit variables directly for fine-tuned control.

## Layout & Theme Library

Browse and install layouts and themes from the library:

### Library Features

**Featured Layouts/Themes**
- Curated selections
- Popular choices
- Seasonal themes
- Industry-specific templates

**Categories**
- Business, Blog, Portfolio, E-commerce
- Minimal, Bold, Classic, Modern
- Light, Dark, High Contrast

**Search and Filter**
- Keyword search
- Filter by category, color, features
- Sort by popularity, date, rating

**Preview and Install**
- Live preview before installing
- One-click installation
- Update notifications

## Responsive Design

Ensure your layouts and themes work across all devices:

### Mobile-First Approach

1. **Design for mobile first**
2. **Progressive enhancement** for larger screens
3. **Test on actual devices** when possible
4. **Use relative units** (rem, em, %) over fixed pixels

### Breakpoint Strategy

**Mobile Portrait** (320px - 479px)
- Single column layout
- Stacked navigation
- Touch-friendly targets (44px minimum)

**Mobile Landscape** (480px - 767px)
- Similar to portrait with more horizontal space
- May show minimal sidebar

**Tablet** (768px - 1023px)
- Two-column layouts possible
- Collapsible sidebars
- Responsive navigation

**Desktop** (1024px+)
- Full multi-column layouts
- Expanded navigation
- Larger images and media

### Testing Responsive Layouts

Use the preview tools to test:
- Content reflow at breakpoints
- Navigation transforms (hamburger menus)
- Image scaling and cropping
- Typography sizing
- Touch target sizes on mobile

## Best Practices

### Layout Design

1. **Consistency**: Use similar layouts for similar page types
2. **Simplicity**: Don't overcomplicate layout structure
3. **Flexibility**: Allow widgets to adapt to content
4. **Accessibility**: Ensure logical tab order and semantic HTML
5. **Performance**: Minimize layout complexity for faster rendering

### Theme Design

1. **Contrast**: Ensure sufficient color contrast (WCAG AA minimum)
2. **Readability**: Choose legible fonts and appropriate sizes
3. **Hierarchy**: Use typography to establish visual hierarchy
4. **Consistency**: Limit color palette and font choices
5. **Testing**: Test themes with real content, not just placeholders

### Inheritance Strategy

1. **Use inheritance** for consistent site sections
2. **Override sparingly** to maintain cohesion
3. **Document overrides** so they're intentional, not forgotten
4. **Review periodically** to ensure inheritance still makes sense
5. **Test changes** to parent templates carefully (they affect many pages)

## Advanced Features

### Dynamic Theming

Support for dynamic theme switching:

- **User Preferences**: Light/dark mode toggle
- **Time-Based**: Automatic theme based on time of day
- **Context-Based**: Theme changes based on content type
- **A/B Testing**: Test different themes with user segments

### Custom CSS

For advanced customization:

1. Navigate to **Theme Settings** → **Custom CSS**
2. Add your custom CSS rules
3. Preview changes live
4. Save and apply

**Warning**: Custom CSS can override theme settings. Use with caution.

### Layout Slots API

Developers can define custom slot behaviors:

- **Conditional slots**: Show/hide based on rules
- **Dynamic slots**: Populate from data sources
- **Slot templates**: Reusable slot configurations
- **Slot constraints**: Enforce content rules

## Keyboard Shortcuts

- `Alt + L`: Open layout selector
- `Alt + T`: Open theme selector
- `Ctrl/Cmd + Shift + P`: Toggle preview mode
- `Ctrl/Cmd + Shift + M`: Toggle mobile preview

## Troubleshooting

### Common Issues

**Problem**: Layout doesn't look right after applying  
**Solution**: Check that widgets are in appropriate slots. Some widgets may not be compatible with certain layouts.

**Problem**: Theme colors not applying  
**Solution**: Check for custom CSS overrides. Clear browser cache. Ensure theme is saved and published.

**Problem**: Inherited layout not updating when parent changes  
**Solution**: Verify inheritance is enabled. Break and restore inheritance to force update.

**Problem**: Mobile layout broken  
**Solution**: Check responsive breakpoint settings. Test each breakpoint individually. Verify widget responsive behavior.

**Problem**: Custom fonts not loading  
**Solution**: Verify font URL is correct and accessible. Check browser console for loading errors. Ensure font formats are supported.

### Layout Conflicts

**Issue**: Widgets overlap or appear in wrong positions  
**Fix**: Review layout slot configuration. Check for conflicting absolute positioning. Verify widget sizes fit slot constraints.

**Issue**: Responsive layout breaks at certain screen sizes  
**Fix**: Test each breakpoint. Adjust breakpoint values. Check for fixed-width elements causing overflow.

## Performance Considerations

### Optimizing Layouts

- **Minimize DOM complexity**: Fewer nested elements
- **Lazy load non-critical content**: Below-the-fold content
- **Optimize CSS**: Remove unused styles
- **Reduce reflows**: Avoid layout thrashing

### Optimizing Themes

- **Limit custom fonts**: Each font adds load time
- **Optimize font loading**: Use font-display: swap
- **Minimize CSS size**: Remove redundant rules
- **Use system fonts**: When performance is critical

---

[← Back: Publishing Workflow](publishing-workflow.md) | [Next: Version Control →](version-control.md)


