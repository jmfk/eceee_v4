/**
 * Component Style Scenarios
 * 
 * Provides scenario-based documentation and examples for Component Styles,
 * particularly for menu/navigation widgets.
 */

export const scenarios = [
    {
        id: 'manual-menu',
        name: 'Manual Menu',
        description: 'Static menu items configured manually in the widget',
        variables: [
            { name: 'items', type: 'Array', description: 'All menu items (combined static and dynamic)' },
            { name: 'static_items', type: 'Array', description: 'Manually configured menu items' },
            { name: 'itemCount', type: 'Number', description: 'Total number of menu items' },
            { name: 'hasItems', type: 'Boolean', description: 'True if there are any menu items' },
        ],
        itemProperties: [
            { name: 'label', type: 'String', description: 'Display text for the menu item' },
            { name: 'url', type: 'String', description: 'URL or path for the menu item' },
            { name: 'target_blank', type: 'Boolean', description: 'Open link in new tab' },
            { name: 'is_active', type: 'Boolean', description: 'Whether the item is active/enabled' },
        ],
        template: `<nav class="manual-menu">
  <ul class="menu-list">
    {{#items}}
    <li class="menu-item">
      <a href="{{url}}"{{#target_blank}} target="_blank" rel="noopener noreferrer"{{/target_blank}}>
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
                { label: 'Home', url: '/', target_blank: false, is_active: true },
                { label: 'About', url: '/about/', target_blank: false, is_active: true },
                { label: 'Contact', url: '/contact/', target_blank: false, is_active: true },
            ],
            static_items: [
                { label: 'Home', url: '/', target_blank: false, is_active: true },
                { label: 'About', url: '/about/', target_blank: false, is_active: true },
                { label: 'Contact', url: '/contact/', target_blank: false, is_active: true },
            ],
            itemCount: 3,
            hasItems: true,
        },
    },
    {
        id: 'subpage-menu',
        name: 'SubPage Menu',
        description: 'Dynamic menu generated from child pages of the current page',
        variables: [
            { name: 'items', type: 'Array', description: 'All menu items (combined static and dynamic)' },
            { name: 'dynamic_items', type: 'Array', description: 'Dynamically generated items from child pages' },
            { name: 'static_items', type: 'Array', description: 'Manually configured menu items' },
            { name: 'itemCount', type: 'Number', description: 'Total number of menu items' },
            { name: 'hasItems', type: 'Boolean', description: 'True if there are any menu items' },
        ],
        itemProperties: [
            { name: 'label', type: 'String', description: 'Page title (from child page)' },
            { name: 'url', type: 'String', description: 'Page path (from child page)' },
            { name: 'target_blank', type: 'Boolean', description: 'Always false for subpage items' },
            { name: 'is_active', type: 'Boolean', description: 'Always true for subpage items' },
        ],
        template: `<nav class="subpage-menu">
  <ul class="submenu-list">
    {{#dynamic_items}}
    <li class="submenu-item">
      <a href="{{url}}">{{label}}</a>
    </li>
    {{/dynamic_items}}
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
                { label: 'Introduction', url: '/about/introduction/', target_blank: false, is_active: true },
                { label: 'Our Team', url: '/about/team/', target_blank: false, is_active: true },
                { label: 'History', url: '/about/history/', target_blank: false, is_active: true },
            ],
            dynamic_items: [
                { label: 'Introduction', url: '/about/introduction/', target_blank: false, is_active: true },
                { label: 'Our Team', url: '/about/team/', target_blank: false, is_active: true },
                { label: 'History', url: '/about/history/', target_blank: false, is_active: true },
            ],
            static_items: [],
            itemCount: 3,
            hasItems: true,
        },
    },
    {
        id: 'crumb-trail',
        name: 'Crumb Trail',
        description: 'Breadcrumb navigation showing the path from root to current page (reference example - requires custom widget implementation)',
        variables: [
            { name: 'breadcrumbs', type: 'Array', description: 'Array of breadcrumb items from root to current' },
            { name: 'itemCount', type: 'Number', description: 'Number of breadcrumb items' },
            { name: 'hasItems', type: 'Boolean', description: 'True if there are breadcrumb items' },
        ],
        itemProperties: [
            { name: 'pageId', type: 'Number', description: 'Page ID' },
            { name: 'title', type: 'String', description: 'Page title' },
            { name: 'slug', type: 'String', description: 'Page slug' },
            { name: 'path', type: 'String', description: 'Full URL path to the page' },
        ],
        template: `<nav class="breadcrumb" aria-label="Breadcrumb">
  <ol class="breadcrumb-list">
    {{#breadcrumbs}}
    <li class="breadcrumb-item">
      {{#isLast}}
      <span class="breadcrumb-current">{{title}}</span>
      {{/isLast}}
      {{^isLast}}
      <a href="{{path}}">{{title}}</a>
      {{/isLast}}
    </li>
    {{/breadcrumbs}}
  </ol>
</nav>`,
        css: `.breadcrumb {
  padding: 0.75rem 0;
}

.breadcrumb-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.breadcrumb-item {
  display: flex;
  align-items: center;
}

.breadcrumb-item:not(:last-child)::after {
  content: '/';
  margin-left: 0.5rem;
  color: #9ca3af;
}

.breadcrumb-item a {
  color: #3b82f6;
  text-decoration: none;
}

.breadcrumb-item a:hover {
  text-decoration: underline;
}

.breadcrumb-current {
  color: #6b7280;
  font-weight: 500;
}`,
        sampleContext: {
            breadcrumbs: [
                { pageId: 1, title: 'Home', slug: 'home', path: '/' },
                { pageId: 2, title: 'About', slug: 'about', path: '/about/' },
                { pageId: 3, title: 'Our Team', slug: 'team', path: '/about/team/', isLast: true },
            ],
            itemCount: 3,
            hasItems: true,
        },
    },
    {
        id: 'anchor-menu',
        name: 'Anchor Menu',
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
        id: 'header-layout',
        name: 'Header Layout',
        description: 'Navbar/header structure - Note: NavbarWidget wraps rendered HTML as "content" variable, not direct menu access',
        variables: [
            { name: 'content', type: 'String', description: 'Rendered navbar HTML (from default template)' },
            { name: 'anchor', type: 'String', description: 'Empty for navbar' },
        ],
        itemProperties: null,
        template: `<nav class="navbar-header">
  {{{content}}}
</nav>

<!-- Or customize the navbar HTML directly if needed -->
<!-- Note: NavbarWidget renders default template first, then wraps it -->
<div class="navbar-wrapper">
  {{{content}}}
</div>`,
        css: `.navbar-header {
  /* Style the navbar wrapper */
  background: #1f2937;
  color: #ffffff;
}

.navbar-wrapper {
  /* Additional wrapper styling */
  padding: 1rem 2rem;
}

/* Style elements within the rendered navbar */
.navbar-header .primary-menu a {
  color: #ffffff;
  text-decoration: none;
  font-weight: 500;
  transition: opacity 0.2s;
}

.navbar-header .primary-menu a:hover {
  opacity: 0.8;
}

.navbar-header .secondary-menu a {
  background: #3b82f6;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  transition: background-color 0.2s;
}

.navbar-header .secondary-menu a:hover {
  background: #2563eb;
}`,
        sampleContext: {
            content: '<nav class="navbar-widget"><ul class="primary-menu">...</ul></nav>',
            anchor: '',
        },
    },
    {
        id: 'owner-page-menu',
        name: 'Owner Page Menu',
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
        name: 'Current Page Menu',
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
    {
        id: 'smart-fallback-menu',
        name: 'Smart Fallback Menu',
        description: 'Smart navigation with fallback logic: show current children, or parent children, or hide menu',
        variables: [
            { name: 'current_children', type: 'Array', description: 'Child pages of the current page' },
            { name: 'hasCurrentChildren', type: 'Boolean', description: 'True if current page has children' },
            { name: 'parent_children', type: 'Array', description: 'Child pages of the parent page' },
            { name: 'hasParentChildren', type: 'Boolean', description: 'True if parent page has children' },
            { name: 'parent_page', type: 'Object', description: 'PageMetadata object for parent page (or null)' },
        ],
        itemProperties: [
            { name: 'id', type: 'Number', description: 'Page ID' },
            { name: 'title', type: 'String', description: 'Page title' },
            { name: 'slug', type: 'String', description: 'Page slug' },
            { name: 'path', type: 'String', description: 'Full URL path to the page' },
            { name: 'description', type: 'String', description: 'Page description' },
        ],
        template: `<nav class="smart-fallback-menu">
  {{#hasCurrentChildren}}
  <!-- Show current page children -->
  <ul class="menu-list">
    {{#current_children}}
    <li class="menu-item">
      <a href="{{path}}">{{title}}</a>
    </li>
    {{/current_children}}
  </ul>
  {{/hasCurrentChildren}}
  {{^hasCurrentChildren}}
  {{#hasParentChildren}}
  <!-- Fallback: Show parent page children -->
  <ul class="menu-list">
    {{#parent_children}}
    <li class="menu-item">
      <a href="{{path}}">{{title}}</a>
    </li>
    {{/parent_children}}
  </ul>
  {{/hasParentChildren}}
  {{^hasParentChildren}}
  <!-- Fallback: Show parent link if no children anywhere -->
  {{#parent_page}}
  <div class="parent-link">
    <a href="{{parent_page.path}}">← Back to {{parent_page.title}}</a>
  </div>
  {{/parent_page}}
  {{/hasParentChildren}}
  {{/hasCurrentChildren}}
</nav>`,
        css: `.smart-fallback-menu {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
}

.menu-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.menu-item {
  margin: 0.5rem 0;
}

.menu-item a {
  color: #1f2937;
  text-decoration: none;
  padding: 0.5rem;
  display: block;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.menu-item a:hover {
  background-color: #e5e7eb;
}

.parent-link {
  padding: 0.5rem 0;
  border-top: 1px solid #e5e7eb;
  margin-top: 0.5rem;
  padding-top: 0.75rem;
}

.parent-link a {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

.parent-link a:hover {
  text-decoration: underline;
}`,
        sampleContext: {
            current_children: [],
            hasCurrentChildren: false,
            parent_children: [
                { id: 2, title: 'About', slug: 'about', path: '/about/', description: '' },
                { id: 3, title: 'Services', slug: 'services', path: '/services/', description: '' },
                { id: 4, title: 'Contact', slug: 'contact', path: '/contact/', description: '' },
            ],
            hasParentChildren: true,
            parent_page: { id: 1, title: 'Home', slug: 'home', path: '/' },
        },
    },
];

export function getScenarioById(id) {
    return scenarios.find(s => s.id === id) || scenarios[0];
}

export function getScenarioNames() {
    return scenarios.map(s => ({ id: s.id, name: s.name }));
}

