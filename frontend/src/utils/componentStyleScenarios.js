/**
 * Component Style Scenarios
 * 
 * Provides scenario-based documentation and examples for Component Styles.
 * Each scenario shows how to use widget configuration properties in Mustache templates.
 * 
 * IMPORTANT: Templates use snake_case (e.g., config.background_color, config.before_text)
 * even though frontend sends camelCase. The API handles conversion automatically.
 */

export const scenarios = [
  // ========== NAVIGATION WIDGET SCENARIOS ==========
  {
    id: 'manual-menu',
    name: 'Navigation: Manual Menu',
    description: 'Static menu items configured manually in the widget',
    variables: [
      { name: 'items', type: 'Array', description: 'All menu items (combined static and dynamic)' },
      { name: 'staticItems', type: 'Array', description: 'Manually configured menu items' },
      { name: 'itemCount', type: 'Number', description: 'Total number of menu items' },
      { name: 'hasItems', type: 'Boolean', description: 'True if there are any menu items' },
    ],
    itemProperties: [
      { name: 'label', type: 'String', description: 'Display text for the menu item' },
      { name: 'url', type: 'String', description: 'URL or path for the menu item' },
      { name: 'targetBlank', type: 'Boolean', description: 'Open link in new tab' },
      { name: 'isActive', type: 'Boolean', description: 'Whether the item is active/enabled' },
    ],
    template: `<nav class="manual-menu">
  <ul class="menu-list">
    {{#items}}
    <li class="menu-item">
      <a href="{{url}}"{{#targetBlank}} target="_blank" rel="noopener noreferrer"{{/targetBlank}}>
        {{label}}
      </a>
    </li>
    {{/items}}
  </ul>
</nav>`,
    css: `.manual-menu {
  background: #ffffff;
  padding: 1rem;
}

.menu-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 1rem;
}

.menu-item {
  margin: 0;
}

.menu-item a {
  color: #374151;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.menu-item a:hover {
  background-color: #f3f4f6;
}`,
    sampleContext: {
      items: [
        { label: 'Home', url: '/', targetBlank: false, isActive: true },
        { label: 'About', url: '/about/', targetBlank: false, isActive: true },
        { label: 'Contact', url: '/contact/', targetBlank: false, isActive: true },
      ],
      staticItems: [
        { label: 'Home', url: '/', targetBlank: false, isActive: true },
        { label: 'About', url: '/about/', targetBlank: false, isActive: true },
        { label: 'Contact', url: '/contact/', targetBlank: false, isActive: true },
      ],
      itemCount: 3,
      hasItems: true,
    },
  },
  {
    id: 'subpage-menu',
    name: 'Navigation: SubPage Menu',
    description: 'Dynamic menu generated from child pages of the current page',
    variables: [
      { name: 'items', type: 'Array', description: 'All menu items (combined static and dynamic)' },
      { name: 'dynamicItems', type: 'Array', description: 'Dynamically generated items from child pages' },
      { name: 'staticItems', type: 'Array', description: 'Manually configured menu items' },
      { name: 'itemCount', type: 'Number', description: 'Total number of menu items' },
      { name: 'hasItems', type: 'Boolean', description: 'True if there are any menu items' },
    ],
    itemProperties: [
      { name: 'label', type: 'String', description: 'Page title (from child page)' },
      { name: 'url', type: 'String', description: 'Page path (from child page)' },
      { name: 'targetBlank', type: 'Boolean', description: 'Always false for subpage items' },
      { name: 'isActive', type: 'Boolean', description: 'Always true for subpage items' },
    ],
    template: `<nav class="subpage-menu">
  <ul class="submenu-list">
    {{#dynamicItems}}
    <li class="submenu-item">
      <a href="{{url}}">{{label}}</a>
    </li>
    {{/dynamicItems}}
  </ul>
</nav>`,
    css: `.subpage-menu {
  background: #f9fafb;
  border-left: 4px solid #3b82f6;
  padding: 1rem;
}

.submenu-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.submenu-item {
  margin: 0.5rem 0;
}

.submenu-item a {
  color: #1f2937;
  text-decoration: none;
  padding: 0.5rem;
  display: block;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.submenu-item a:hover {
  background-color: #e5e7eb;
}`,
    sampleContext: {
      items: [
        { label: 'Introduction', url: '/about/introduction/', targetBlank: false, isActive: true },
        { label: 'Our Team', url: '/about/team/', targetBlank: false, isActive: true },
        { label: 'History', url: '/about/history/', targetBlank: false, isActive: true },
      ],
      dynamicItems: [
        { label: 'Introduction', url: '/about/introduction/', targetBlank: false, isActive: true },
        { label: 'Our Team', url: '/about/team/', targetBlank: false, isActive: true },
        { label: 'History', url: '/about/history/', targetBlank: false, isActive: true },
      ],
      staticItems: [],
      itemCount: 3,
      hasItems: true,
    },
  },
  {
    id: 'anchor-menu',
    name: 'Navigation: Anchor Menu',
    description: 'Menu generated from page sections with anchor IDs',
    variables: [
      { name: 'items', type: 'Array', description: 'All menu items (combined static and dynamic)' },
      { name: 'dynamic_items', type: 'Array', description: 'Dynamically generated items from page sections with anchors' },
      { name: 'static_items', type: 'Array', description: 'Manually configured menu items' },
      { name: 'itemCount', type: 'Number', description: 'Total number of menu items' },
      { name: 'hasItems', type: 'Boolean', description: 'True if there are any menu items' },
    ],
    itemProperties: [
      { name: 'label', type: 'String', description: 'Anchor text (from widget anchor field)' },
      { name: 'url', type: 'String', description: 'Anchor link (#anchor)' },
      { name: 'target_blank', type: 'Boolean', description: 'Always false for anchor links' },
      { name: 'is_active', type: 'Boolean', description: 'Always true for anchor items' },
    ],
    template: `<nav class="anchor-menu">
  <ul class="anchor-list">
    {{#dynamic_items}}
    <li class="anchor-item">
      <a href="{{url}}">{{label}}</a>
    </li>
    {{/dynamic_items}}
  </ul>
</nav>`,
    css: `.anchor-menu {
  position: sticky;
  top: 2rem;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.anchor-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.anchor-item {
  margin: 0.25rem 0;
}

.anchor-item a {
  color: #374151;
  text-decoration: none;
  padding: 0.5rem;
  display: block;
  border-radius: 4px;
  transition: all 0.2s;
}

.anchor-item a:hover {
  background-color: #f3f4f6;
  color: #1f2937;
  padding-left: 0.75rem;
}`,
    sampleContext: {
      items: [
        { label: 'Introduction', url: '#introduction', target_blank: false, is_active: true },
        { label: 'Features', url: '#features', target_blank: false, is_active: true },
        { label: 'Pricing', url: '#pricing', target_blank: false, is_active: true },
        { label: 'Contact', url: '#contact', target_blank: false, is_active: true },
      ],
      dynamic_items: [
        { label: 'Introduction', url: '#introduction', target_blank: false, is_active: true },
        { label: 'Features', url: '#features', target_blank: false, is_active: true },
        { label: 'Pricing', url: '#pricing', target_blank: false, is_active: true },
        { label: 'Contact', url: '#contact', target_blank: false, is_active: true },
      ],
      static_items: [],
      itemCount: 4,
      hasItems: true,
    },
  },
  {
    id: 'owner-page-menu',
    name: 'Navigation: Owner Page Menu',
    description: 'Always show children of the page where the widget was originally created (regardless of inheritance)',
    variables: [
      { name: 'owner_page', type: 'Object', description: 'PageMetadata object for the page where widget was created (id, title, slug, path)' },
      { name: 'owner_children', type: 'Array', description: 'Child pages of the owner page' },
      { name: 'hasOwnerChildren', type: 'Boolean', description: 'True if owner page has children' },
      { name: 'isInherited', type: 'Boolean', description: 'True if widget is inherited from a parent page' },
    ],
    itemProperties: [
      { name: 'id', type: 'Number', description: 'Page ID' },
      { name: 'title', type: 'String', description: 'Page title' },
      { name: 'slug', type: 'String', description: 'Page slug' },
      { name: 'path', type: 'String', description: 'Full URL path to the page' },
      { name: 'description', type: 'String', description: 'Page description' },
    ],
    template: `<nav class="owner-page-menu">
  {{#hasOwnerChildren}}
  <ul class="owner-menu-list">
    {{#owner_children}}
    <li class="owner-menu-item">
      <a href="{{path}}">{{title}}</a>
    </li>
    {{/owner_children}}
  </ul>
  {{/hasOwnerChildren}}
  {{^hasOwnerChildren}}
  <p class="no-children-message">No sub-pages available</p>
  {{/hasOwnerChildren}}
</nav>`,
    css: `.owner-page-menu {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
}

.owner-menu-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.owner-menu-item {
  margin: 0.5rem 0;
}

.owner-menu-item a {
  color: #1f2937;
  text-decoration: none;
  padding: 0.5rem;
  display: block;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.owner-menu-item a:hover {
  background-color: #e5e7eb;
}

.no-children-message {
  color: #6b7280;
  font-style: italic;
  margin: 0;
}`,
    sampleContext: {
      owner_page: { id: 1, title: 'About', slug: 'about', path: '/about/' },
      owner_children: [
        { id: 2, title: 'Introduction', slug: 'introduction', path: '/about/introduction/', description: '' },
        { id: 3, title: 'Our Team', slug: 'team', path: '/about/team/', description: '' },
        { id: 4, title: 'History', slug: 'history', path: '/about/history/', description: '' },
      ],
      hasOwnerChildren: true,
      isInherited: false,
    },
  },
  {
    id: 'current-page-menu',
    name: 'Navigation: Current Page Menu',
    description: 'Show children of the current viewing page (inheritance-aware, adapts to current context)',
    variables: [
      { name: 'current_page', type: 'Object', description: 'PageMetadata object for the current viewing page' },
      { name: 'current_children', type: 'Array', description: 'Child pages of the current page' },
      { name: 'hasCurrentChildren', type: 'Boolean', description: 'True if current page has children' },
      { name: 'parent_page', type: 'Object', description: 'PageMetadata object for parent page (or null)' },
    ],
    itemProperties: [
      { name: 'id', type: 'Number', description: 'Page ID' },
      { name: 'title', type: 'String', description: 'Page title' },
      { name: 'slug', type: 'String', description: 'Page slug' },
      { name: 'path', type: 'String', description: 'Full URL path to the page' },
      { name: 'description', type: 'String', description: 'Page description' },
    ],
    template: `<nav class="current-page-menu">
  {{#hasCurrentChildren}}
  <ul class="current-menu-list">
    {{#current_children}}
    <li class="current-menu-item">
      <a href="{{path}}">{{title}}</a>
    </li>
    {{/current_children}}
  </ul>
  {{/hasCurrentChildren}}
  {{^hasCurrentChildren}}
  {{#parent_page}}
  <div class="fallback-link">
    <a href="{{parent_page.path}}">← Back to {{parent_page.title}}</a>
  </div>
  {{/parent_page}}
  {{/hasCurrentChildren}}
</nav>`,
    css: `.current-page-menu {
  background: #ffffff;
  border-left: 4px solid #3b82f6;
  padding: 1rem;
}

.current-menu-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.current-menu-item {
  margin: 0.5rem 0;
}

.current-menu-item a {
  color: #1f2937;
  text-decoration: none;
  padding: 0.5rem;
  display: block;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.current-menu-item a:hover {
  background-color: #f3f4f6;
}

.fallback-link {
  padding: 0.5rem 0;
}

.fallback-link a {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

.fallback-link a:hover {
  text-decoration: underline;
}`,
    sampleContext: {
      current_page: { id: 5, title: 'Services', slug: 'services', path: '/services/' },
      current_children: [
        { id: 6, title: 'Web Development', slug: 'web-development', path: '/services/web-development/', description: '' },
        { id: 7, title: 'Consulting', slug: 'consulting', path: '/services/consulting/', description: '' },
      ],
      hasCurrentChildren: true,
      parent_page: { id: 1, title: 'Home', slug: 'home', path: '/' },
    },
  },

  // ========== CONTENT WIDGET SCENARIOS ==========
  {
    id: 'content-card-wrapper',
    name: 'Content: Card Wrapper',
    description: 'Wrap ContentWidget in an elevated card with shadow - uses {{{content}}}',
    variables: [
      { name: 'content', type: 'String', description: 'Rendered widget HTML' },
      { name: 'config.anchor', type: 'String', description: 'Section anchor ID if provided' },
    ],
    itemProperties: null,
    template: `<div class="content-card">
  {{#config.anchor}}<div id="{{config.anchor}}"></div>{{/config.anchor}}
  <div class="card-body">
    {{{content}}}
  </div>
</div>`,
    css: `.content-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  margin: 2rem 0;
  border: 1px solid #e5e7eb;
  transition: all 0.3s;
}
.content-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}
.content-card h1,
.content-card h2,
.content-card h3 {
  color: #1f2937;
  border-bottom: 2px solid #3b82f6;
  padding-bottom: 0.5rem;
}
.content-card p {
  color: #4b5563;
  line-height: 1.8;
}`,
    sampleContext: {
      content: '<h2>Sample Title</h2><p>Sample content with HTML.</p>',
      config: { anchor: 'section-id' },
    },
  },

  {
    id: 'content-custom-render',
    name: 'Content: Custom Render',
    description: 'Render ContentWidget HTML directly from config.content (snake_case)',
    variables: [
      { name: 'config.content', type: 'String', description: 'HTML content (snake_case)' },
      { name: 'config.anchor', type: 'String', description: 'Section anchor ID' },
      { name: 'config.component_style', type: 'String', description: 'Selected component style name' },
    ],
    itemProperties: null,
    template: `<div class="content-custom">
  {{#config.anchor}}<div id="{{config.anchor}}" class="anchor-target"></div>{{/config.anchor}}
  <div class="custom-content-body">
    {{{config.content}}}
  </div>
</div>`,
    css: `.content-custom {
  background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 2.5rem;
  margin: 2rem 0;
}
.custom-content-body {
  color: #1f2937;
}
.custom-content-body h1,
.custom-content-body h2 {
  color: #3b82f6;
  font-weight: 700;
}`,
    sampleContext: {
      config: {
        content: '<h2>Direct Content Access</h2><p>This uses config.content directly.</p>',
        anchor: 'custom-section'
      }
    },
  },

  // ========== HERO WIDGET SCENARIOS ==========
  {
    id: 'hero-gradient-overlay',
    name: 'Hero: Gradient Overlay',
    description: 'HeroWidget with gradient overlay - uses config properties for full control',
    variables: [
      { name: 'content', type: 'String', description: 'Rendered hero HTML (fallback)' },
      { name: 'config.header', type: 'String', description: 'Main header text (snake_case)' },
      { name: 'config.before_text', type: 'String', description: 'Text before header (snake_case)' },
      { name: 'config.after_text', type: 'String', description: 'Text after header (snake_case)' },
      { name: 'config.text_color', type: 'String', description: 'Text color hex (snake_case)' },
      { name: 'config.background_color', type: 'String', description: 'Background color (snake_case)' },
    ],
    itemProperties: null,
    template: `<div class="hero-gradient" style="--bg-color: {{config.background_color}}; --text-color: {{config.text_color}};">
  <div class="hero-overlay"></div>
  <div class="hero-content-wrapper">
    {{#config.before_text}}<p class="before-text">{{config.before_text}}</p>{{/config.before_text}}
    <h1>{{config.header}}</h1>
    {{#config.after_text}}<p class="after-text">{{config.after_text}}</p>{{/config.after_text}}
  </div>
</div>`,
    css: `.hero-gradient {
  position: relative;
  min-height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: var(--bg-color, #0f172a);
  color: var(--text-color, white);
  overflow: hidden;
}
.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(139, 92, 246, 0.9));
  z-index: 0;
}
.hero-content-wrapper {
  position: relative;
  z-index: 1;
  max-width: 900px;
  padding: 2rem;
}
.hero-gradient h1 {
  font-size: 3.5rem;
  font-weight: 800;
  margin: 0 0 1.5rem 0;
  text-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}
.hero-gradient .before-text,
.hero-gradient .after-text {
  font-size: 1.25rem;
  opacity: 0.95;
}
@media (max-width: 768px) {
  .hero-gradient {
    min-height: 400px;
    padding: 3rem 1.5rem;
  }
  .hero-gradient h1 {
    font-size: 2.5rem;
  }
}`,
    sampleContext: {
      content: '<div class="before-text">Welcome to</div><h1>Our Amazing Platform</h1><div class="after-text">Transform your business today</div>',
      config: {
        header: 'Our Amazing Platform',
        before_text: 'Welcome to',
        after_text: 'Transform your business today',
        text_color: '#ffffff',
        background_color: '#1f2937'
      }
    },
  },

  {
    id: 'hero-split-design',
    name: 'Hero: Split Screen',
    description: 'HeroWidget with split layout - config.header, config.after_text (snake_case)',
    variables: [
      { name: 'content', type: 'String', description: 'Rendered hero HTML (fallback)' },
      { name: 'config.header', type: 'String', description: 'Main header text' },
      { name: 'config.after_text', type: 'String', description: 'Text after header' },
      { name: 'config.background_color', type: 'String', description: 'Background color' },
    ],
    itemProperties: null,
    template: `<div class="hero-split" style="--bg: {{config.background_color}};">
  <div class="hero-split-content">
    <h1>{{config.header}}</h1>
    {{#config.after_text}}<p class="after-text">{{config.after_text}}</p>{{/config.after_text}}
  </div>
  <div class="hero-split-image"></div>
</div>`,
    css: `.hero-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 500px;
  overflow: hidden;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}
.hero-split-content {
  padding: 4rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: var(--bg, #1f2937);
  color: white;
}
.hero-split-content h1 {
  font-size: 2.5rem;
  margin: 0 0 1rem 0;
}
.hero-split-content .after-text {
  font-size: 1.125rem;
  opacity: 0.9;
}
@media (max-width: 768px) {
  .hero-split {
    grid-template-columns: 1fr;
  }
  .hero-split-image {
    min-height: 300px;
  }
}`,
    sampleContext: {
      content: '<h1>Innovation</h1><p>Join us</p>',
      config: {
        header: 'Innovation Starts Here',
        after_text: 'Join us on this journey',
        background_color: '#1f2937'
      }
    },
  },

  // ========== TABLE WIDGET SCENARIOS ==========
  {
    id: 'table-modern-gradient',
    name: 'Table: Modern Gradient Header',
    description: 'TableWidget with gradient header - uses {{{content}}} wrapper',
    variables: [
      { name: 'content', type: 'String', description: 'Rendered table HTML' },
      { name: 'config.caption', type: 'String', description: 'Table caption (snake_case)' },
    ],
    itemProperties: null,
    template: `<div class="table-modern-wrapper">
  {{#config.caption}}<div class="table-title">{{config.caption}}</div>{{/config.caption}}
  {{{content}}}
</div>`,
    css: `.table-modern-wrapper {
  margin: 2rem 0;
}
.table-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1rem;
}
.table-modern-wrapper table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.table-modern-wrapper th {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.table-modern-wrapper td {
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
}
.table-modern-wrapper tr:last-child td {
  border-bottom: none;
}
.table-modern-wrapper tr:hover td {
  background: #f9fafb;
}`,
    sampleContext: {
      content: '<table><thead><tr><th>Column 1</th><th>Column 2</th></tr></thead><tbody><tr><td>Data</td><td>Data</td></tr></tbody></table>',
      config: { caption: 'Product Inventory' }
    },
  },

  {
    id: 'table-minimal-striped',
    name: 'Table: Minimal Striped',
    description: 'TableWidget with clean striped design',
    variables: [
      { name: 'content', type: 'String', description: 'Rendered table HTML' },
    ],
    itemProperties: null,
    template: `<div class="table-minimal">
  {{{content}}}
</div>`,
    css: `.table-minimal table {
  width: 100%;
  border-collapse: collapse;
}
.table-minimal th {
  background: #f9fafb;
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
}
.table-minimal td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f3f4f6;
}
.table-minimal tbody tr:nth-child(even) {
  background: #fafbfc;
}
.table-minimal tbody tr:hover {
  background: #f3f4f6;
}`,
    sampleContext: {
      content: '<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>Item 1</td><td>$100</td></tr></tbody></table>',
    },
  },

  // ========== NAVBAR WIDGET SCENARIOS ==========
  {
    id: 'navbar-gradient-modern',
    name: 'Navbar: Gradient',
    description: 'NavbarWidget with modern gradient background',
    variables: [
      { name: 'content', type: 'String', description: 'Rendered navbar HTML' },
      { name: 'config.background_color', type: 'String', description: 'Background color (snake_case)' },
    ],
    itemProperties: null,
    template: `<div class="navbar-gradient">
  {{{content}}}
</div>`,
    css: `.navbar-gradient {
  background: linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  margin-bottom: 1rem;
}
.navbar-gradient a {
  color: white;
  font-weight: 500;
  transition: opacity 0.2s;
}
.navbar-gradient a:hover {
  opacity: 0.8;
}`,
    sampleContext: {
      content: '<nav><ul class="primary-menu"><li><a href="/">Home</a></li></ul></nav>',
      config: { background_color: '#3b82f6' }
    },
  },

  {
    id: 'navbar-glassmorphism',
    name: 'Navbar: Glassmorphism',
    description: 'NavbarWidget with frosted glass effect',
    variables: [
      { name: 'content', type: 'String', description: 'Rendered navbar HTML' },
    ],
    itemProperties: null,
    template: `<div class="navbar-glass">
  {{{content}}}
</div>`,
    css: `.navbar-glass {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border-radius: 8px;
}
.navbar-glass a {
  color: #1f2937;
  font-weight: 500;
}
.navbar-glass a:hover {
  color: #3b82f6;
}`,
    sampleContext: {
      content: '<nav><ul><li><a href="/">Home</a></li></ul></nav>',
    },
  },

  // ========== FOOTER WIDGET SCENARIOS ==========
  {
    id: 'footer-dark-accent',
    name: 'Footer: Dark with Accent',
    description: 'FooterWidget with dark background and accent border',
    variables: [
      { name: 'content', type: 'String', description: 'Rendered footer HTML' },
      { name: 'config.background_color', type: 'String', description: 'Background color (snake_case)' },
      { name: 'config.text_color', type: 'String', description: 'Text color (snake_case)' },
    ],
    itemProperties: null,
    template: `<div class="footer-dark">
  {{{content}}}
</div>`,
    css: `.footer-dark {
  background: #111827;
  color: #e5e7eb;
  padding: 3rem 2rem;
  border-top: 3px solid #3b82f6;
}
.footer-dark h3 {
  color: white;
  font-size: 1.125rem;
  margin-bottom: 1.25rem;
  position: relative;
  padding-bottom: 0.75rem;
}
.footer-dark h3::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 3rem;
  height: 2px;
  background: #3b82f6;
}
.footer-dark a {
  color: #9ca3af;
  transition: color 0.2s;
}
.footer-dark a:hover {
  color: #60a5fa;
}`,
    sampleContext: {
      content: '<div class="footer-columns"><div class="footer-column"><h3>Company</h3><ul><li><a href="/about">About</a></li></ul></div></div>',
      config: {
        background_color: '#111827',
        text_color: '#e5e7eb'
      }
    },
  },

  {
    id: 'footer-gradient-vibrant',
    name: 'Footer: Gradient',
    description: 'FooterWidget with colorful gradient background',
    variables: [
      { name: 'content', type: 'String', description: 'Rendered footer HTML' },
    ],
    itemProperties: null,
    template: `<div class="footer-gradient">
  {{{content}}}
</div>`,
    css: `.footer-gradient {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 3rem 2rem;
  border-radius: 12px 12px 0 0;
}
.footer-gradient h3 {
  color: white;
  opacity: 0.95;
}
.footer-gradient a {
  color: rgba(255, 255, 255, 0.9);
  transition: opacity 0.2s;
}
.footer-gradient a:hover {
  opacity: 1;
  text-decoration: underline;
}`,
    sampleContext: {
      content: '<div class="footer-columns"><div><h3>Links</h3></div></div>',
    },
  },

  // ========== FORM WIDGET SCENARIOS ==========
  {
    id: 'form-elevated-card',
    name: 'Form: Elevated Card',
    description: 'FormsWidget in modern elevated card - uses config.title (snake_case)',
    variables: [
      { name: 'content', type: 'String', description: 'Rendered form HTML' },
      { name: 'config.title', type: 'String', description: 'Form title (snake_case)' },
      { name: 'config.description', type: 'String', description: 'Form description (snake_case)' },
      { name: 'config.anchor', type: 'String', description: 'Form anchor ID' },
    ],
    itemProperties: null,
    template: `<div class="form-card-wrapper">
  {{#config.anchor}}<div id="{{config.anchor}}"></div>{{/config.anchor}}
  <div class="form-card">
    <div class="form-card-header">
      <h2>{{config.title}}</h2>
      {{#config.description}}<p class="form-description">{{config.description}}</p>{{/config.description}}
    </div>
    {{{content}}}
  </div>
</div>`,
    css: `.form-card-wrapper {
  max-width: 600px;
  margin: 2rem auto;
}
.form-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  padding: 3rem;
  border-top: 4px solid #3b82f6;
}
.form-card-header h2 {
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}
.form-description {
  color: #6b7280;
  margin-bottom: 2rem;
}
.form-card input,
.form-card textarea,
.form-card select {
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  transition: all 0.2s;
}
.form-card input:focus,
.form-card textarea:focus,
.form-card select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}`,
    sampleContext: {
      content: '<form><input type="text" placeholder="Name"><button>Submit</button></form>',
      config: {
        title: 'Contact Form',
        description: 'Get in touch with us',
        anchor: 'contact-form'
      }
    },
  },

  {
    id: 'form-inline-newsletter',
    name: 'Form: Inline Newsletter',
    description: 'FormsWidget with horizontal inline layout',
    variables: [
      { name: 'content', type: 'String', description: 'Rendered form HTML' },
    ],
    itemProperties: null,
    template: `<div class="form-inline-newsletter">
  {{{content}}}
</div>`,
    css: `.form-inline-newsletter {
  background: #f9fafb;
  padding: 2rem;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}
.form-inline-newsletter form {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  flex-wrap: wrap;
}
.form-inline-newsletter .form-group {
  flex: 1;
  min-width: 250px;
  margin-bottom: 0;
}`,
    sampleContext: {
      content: '<form><div class="form-group"><input type="email" placeholder="your@email.com"></div><button>Subscribe</button></form>',
    },
  },

  // ========== SIDEBAR WIDGET SCENARIOS ==========
  {
    id: 'sidebar-accent-border',
    name: 'Sidebar: Accent Border',
    description: 'SidebarWidget with left accent border',
    variables: [
      { name: 'content', type: 'String', description: 'Rendered sidebar HTML' },
    ],
    itemProperties: null,
    template: `<aside class="sidebar-accent">
  {{{content}}}
</aside>`,
    css: `.sidebar-accent {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  border-left: 4px solid #3b82f6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  margin-bottom: 2rem;
}
.sidebar-accent h3 {
  color: #1f2937;
  font-size: 1.25rem;
  margin-top: 0;
  margin-bottom: 1.25rem;
}`,
    sampleContext: {
      content: '<h3>Quick Links</h3><ul><li><a href="#">Link 1</a></li></ul>',
    },
  },

  // ========== NEWS WIDGET SCENARIOS ==========
  {
    id: 'news-card-grid',
    name: 'News: Card Grid',
    description: 'NewsListWidget in responsive card grid layout',
    variables: [
      { name: 'content', type: 'String', description: 'Rendered news list HTML' },
    ],
    itemProperties: null,
    template: `<div class="news-grid-wrapper">
  {{{content}}}
</div>`,
    css: `.news-grid-wrapper {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2rem;
  padding: 2rem 0;
}
.news-grid-wrapper .news-item {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s;
}
.news-grid-wrapper .news-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}`,
    sampleContext: {
      content: '<div class="news-item"><h3>News Title</h3></div>',
    },
  },

  {
    id: 'news-timeline-vertical',
    name: 'News: Timeline',
    description: 'NewsListWidget in vertical timeline layout',
    variables: [
      { name: 'content', type: 'String', description: 'Rendered news list HTML' },
    ],
    itemProperties: null,
    template: `<div class="news-timeline">
  {{{content}}}
</div>`,
    css: `.news-timeline {
  position: relative;
  padding-left: 3rem;
}
.news-timeline::before {
  content: '';
  position: absolute;
  left: 1rem;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #e5e7eb;
}
.news-timeline .news-item::before {
  content: '';
  position: absolute;
  left: -2.5rem;
  top: 0.25rem;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: #3b82f6;
  border: 3px solid white;
  box-shadow: 0 0 0 2px #e5e7eb;
}`,
    sampleContext: {
      content: '<div class="news-item"><h3>News Title</h3></div>',
    },
  },

  // ========== COLUMN WIDGET SCENARIOS ==========
  {
    id: 'columns-feature-cards',
    name: 'Columns: Feature Cards',
    description: 'Column widgets styled as hoverable feature boxes',
    variables: [
      { name: 'content', type: 'String', description: 'Rendered column content' },
      { name: 'slots.left', type: 'Array', description: 'Left slot rendered widgets (snake_case)' },
      { name: 'slots.right', type: 'Array', description: 'Right slot rendered widgets (snake_case)' },
      { name: 'slots.center', type: 'Array', description: 'Center slot rendered widgets (for 3-column)' },
    ],
    itemProperties: null,
    template: `<div class="feature-boxes-wrapper">
  {{{content}}}
</div>`,
    css: `.feature-boxes-wrapper {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  padding: 2rem 0;
}
.feature-boxes-wrapper > * {
  background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  transition: all 0.3s;
}
.feature-boxes-wrapper > *:hover {
  border-color: #3b82f6;
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(59, 130, 246, 0.15);
}`,
    sampleContext: {
      content: '<div><h3>Feature 1</h3></div><div><h3>Feature 2</h3></div>',
    },
  },

  {
    id: 'columns-balanced-dividers',
    name: 'Columns: Balanced with Dividers',
    description: 'Column widgets with vertical dividers between columns',
    variables: [
      { name: 'content', type: 'String', description: 'Rendered column content' },
    ],
    itemProperties: null,
    template: `<div class="columns-balanced">
  {{{content}}}
</div>`,
    css: `.columns-balanced {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 3rem;
  padding: 2rem;
}
.columns-balanced > * {
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
@media (max-width: 768px) {
  .columns-balanced {
    grid-template-columns: 1fr;
  }
}`,
    sampleContext: {
      content: '<div><h3>Column 1</h3></div><div><h3>Column 2</h3></div>',
    },
  },

  // ========== IMAGE WIDGET SCENARIOS ==========
  {
    id: 'image-framed',
    name: 'Image: Framed',
    description: 'ImageWidget with decorative frame',
    variables: [
      { name: 'content', type: 'String', description: 'Rendered image HTML' },
      { name: 'config.anchor', type: 'String', description: 'Anchor ID (snake_case)' },
    ],
    itemProperties: null,
    template: `<div class="image-framed">
  {{#config.anchor}}<div id="{{config.anchor}}"></div>{{/config.anchor}}
  {{{content}}}
</div>`,
    css: `.image-framed {
  padding: 2rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  margin: 2rem auto;
  max-width: fit-content;
}
.image-framed img {
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
}
.image-framed .caption {
  margin-top: 1rem;
  text-align: center;
  color: #6b7280;
  font-style: italic;
}`,
    sampleContext: {
      content: '<img src="/sample.jpg" alt="Sample"><div class="caption">Image caption</div>',
      config: { anchor: 'gallery' }
    },
  },

  // ========== HEADER WIDGET SCENARIOS ==========
  {
    id: 'header-shadow-depth',
    name: 'Header: Shadow Depth',
    description: 'HeaderWidget with subtle shadow for depth',
    variables: [
      { name: 'content', type: 'String', description: 'Rendered header HTML' },
    ],
    itemProperties: null,
    template: `<div class="header-shadow">
  {{{content}}}
</div>`,
    css: `.header-shadow {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-radius: 0 0 8px 8px;
  overflow: hidden;
  margin-bottom: 1rem;
}`,
    sampleContext: {
      content: '<img src="/header.jpg" alt="Header">',
    },
  },

  // ========== PASSTHROUGH SCENARIO ==========
  {
    id: 'passthrough',
    name: 'Passthrough: CSS Only',
    description: 'Use default widget template but inject custom CSS - set template to {{passthru}}',
    variables: [
      { name: 'passthru', type: 'Marker', description: 'Special marker to use default template with custom CSS' },
    ],
    itemProperties: null,
    template: `{{passthru}}`,
    css: `/* Add your custom CSS here to style the default widget template */

/* ContentWidget */
.widget-type-easy-widgets-contentwidget {
  font-family: Georgia, serif;
  line-height: 1.8;
}

/* HeroWidget */
.widget-type-easy-widgets-herowidget {
  border-radius: 12px;
  overflow: hidden;
}

/* FooterWidget */
.widget-type-easy-widgets-footerwidget {
  background: linear-gradient(135deg, #1f2937, #111827);
}`,
    sampleContext: {
      passthru: 'Default widget template will be used',
    },
  },
];

export function getScenarioById(id) {
  return scenarios.find(s => s.id === id) || scenarios[0];
}

export function getScenarioNames() {
  return scenarios.map(s => ({ id: s.id, name: s.name }));
}
