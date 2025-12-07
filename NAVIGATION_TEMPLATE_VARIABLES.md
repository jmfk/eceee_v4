# Navigation Widget Component Style Template Variables

## Available Variables

The NavigationWidget now exposes comprehensive page hierarchy and inheritance variables for component style templates:

### Menu Items
- `items` - Combined array of all menu items (dynamic + static)
- `staticItems` - Manually configured menu items
- `dynamicItems` - Auto-generated items from child pages
- `itemCount` - Total number of items
- `hasItems` - Boolean flag

Each item has:
- `label` - Display text
- `url` - Link URL
- `isActive` - Whether item is active
- `targetBlank` - Whether to open in new tab
- `type` - Link type (internal, external, email, phone, anchor)

### Page Hierarchy Context
- `currentPage` - Current page object with `{id, title, slug, path}`
- `currentChildren` - Array of current page's child pages
- `hasCurrentChildren` - Boolean flag
- `parentPage` - Parent page object (if exists)
- `parentChildren` - Siblings of current page
- `hasParentChildren` - Boolean flag

### Inheritance Context
- `isInherited` - Whether widget is inherited from ancestor
- `inheritanceDepth` - How deep in hierarchy (0=root, 1=first level, etc.)

### Depth Helper Booleans
- `isRoot` - depth == 0
- `isLevel1` - depth == 1
- `isLevel2` - depth == 2
- `isLevel3` - depth == 3
- `isLevel1AndBelow` - depth >= 1
- `isLevel2AndBelow` - depth >= 2
- `isLevel3AndBelow` - depth >= 3
- `isDeepLevel` - depth >= 4

### Widget Configuration
- `widgetTypeCssClass` - "navigation"
- `navContainerHeight` - Container height setting

## Example Template

Your template structure will now work:

```mustache
{{#isInherited}}
  {{#hasCurrentChildren}}
  <nav class="current-page-menu">
  <ul class="current-menu-list">
    {{#currentChildren}}
    <li class="current-menu-item">
      <a href="{{path}}">{{title}}</a>
    </li>
    {{/currentChildren}} 
  </ul>
  </nav>
  {{/hasCurrentChildren}} 
  {{^hasCurrentChildren}}
    {{#parentPage}}
      {{#isLevel2AndBelow}}
      <nav class="current-page-menu">
        <ul class="current-menu-list">
          <li class="current-menu-item">
            <a href="{{parentPage.path}}">← Back to {{parentPage.title}}</a>
          </li>
        </ul>
      </nav>
      {{/isLevel2AndBelow}}
    {{/parentPage}}
  {{/hasCurrentChildren}}
{{/isInherited}}
```

## Debugging Templates

### Method 1: Display All Variables
Add this to your template to see what's available:

```mustache
<pre>
{{#.}}
{{@key}}: {{.}}
{{/.}}
</pre>
```

### Method 2: Check Specific Values
```mustache
<p>Is Inherited: {{isInherited}}</p>
<p>Has Children: {{hasCurrentChildren}}</p>
<p>Depth: {{inheritanceDepth}}</p>
<p>Children Count: {{currentChildren.length}}</p>
```

### Method 3: Backend Logs
The NavigationWidget logs context preparation. Check Django logs for errors.

## Implementation Details

### Backend Changes
1. **NavigationWidget.prepare_template_context()** - Enhanced to call `_get_page_hierarchy_context()`
2. **NavigationWidget._get_page_hierarchy_context()** - New method that queries child pages and serializes hierarchy data
3. **WebPageRenderer._build_base_context()** - Added `webpage_data` with serialized page info

### Frontend Parity
The backend now matches the frontend's `prepareNavigationContext()` function in `frontend/src/utils/mustacheRenderer.js`, ensuring templates work identically in:
- Page editor (frontend Mustache rendering)
- Published site (backend Mustache rendering)

## Notes

- All variables use camelCase for Mustache template consistency
- Page children are filtered by:
  - Publication status (`is_currently_published`)
  - Hostname (multi-site support)
  - Not deleted
- Children are ordered by `order` field, then `id`

