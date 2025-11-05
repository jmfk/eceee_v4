# Navigation Depth Template Example

## Overview

Navigation widgets can test inheritance depth in Mustache templates to render different navigation styles based on page hierarchy level.

## Available Variables

- `inheritanceDepth` (Number): How many levels deep the widget is inherited
  - `0` = Widget is on its owner page (root level)
  - `1` = Inherited one level down
  - `2` = Inherited two levels down
  - etc.
- `isInherited` (Boolean): True if widget is inherited from a parent page

## Example Template: Depth-Based Navigation

This template shows different navigation styles based on inheritance depth:

### Template

```html
{{#items}}
  {{! Root level (depth 0) - Full navigation with icons }}
  {{^inheritanceDepth}}
  <div class="nav-item nav-root">
    <span class="nav-icon">🏠</span>
    <a href="{{url}}" class="nav-link-root">{{label}}</a>
  </div>
  {{/inheritanceDepth}}
  
  {{! Level 1 - Medium style }}
  {{#inheritanceDepth}}
    {{! Check if depth is exactly 1 by comparing with context }}
    <div class="nav-item nav-level1">
      <a href="{{url}}" class="nav-link-level1">→ {{label}}</a>
    </div>
  {{/inheritanceDepth}}
{{/items}}
```

### Better Approach: Using Helper Sections

Since Mustache doesn't support numeric comparisons directly, create helper boolean flags in the context:

**Backend Addition (navigation.py):**
```python
context = {
    # ... existing context ...
    "inheritanceDepth": config.get("inheritanceDepth", 0),
    "isRoot": config.get("inheritanceDepth", 0) == 0,
    "isLevel1": config.get("inheritanceDepth", 0) == 1,
    "isLevel2": config.get("inheritanceDepth", 0) == 2,
    "isDeepLevel": config.get("inheritanceDepth", 0) >= 3,
}
```

**Template with Helper Flags:**
```html
<nav class="depth-nav">
  {{#isRoot}}
  <div class="nav-root-container">
    <h2 class="nav-title">Main Navigation</h2>
    <ul class="nav-list nav-list-root">
      {{#items}}
      <li class="nav-item">
        <span class="nav-icon">🏠</span>
        <a href="{{url}}" class="nav-link">{{label}}</a>
      </li>
      {{/items}}
    </ul>
  </div>
  {{/isRoot}}
  
  {{#isLevel1}}
  <div class="nav-level1-container">
    <h3 class="nav-subtitle">Section Menu</h3>
    <ul class="nav-list nav-list-level1">
      {{#items}}
      <li class="nav-item-compact">
        <a href="{{url}}" class="nav-link-compact">→ {{label}}</a>
      </li>
      {{/items}}
    </ul>
  </div>
  {{/isLevel1}}
  
  {{#isLevel2}}
  <div class="nav-level2-container">
    <ul class="nav-list nav-list-minimal">
      {{#items}}
      <li class="nav-item-minimal">
        <a href="{{url}}">{{label}}</a>
      </li>
      {{/items}}
    </ul>
  </div>
  {{/isLevel2}}
  
  {{#isDeepLevel}}
  <!-- Very minimal or no navigation for deeply nested pages -->
  <div class="nav-minimal">
    <a href="{{ownerPage.path}}" class="back-link">← Back to {{ownerPage.title}}</a>
  </div>
  {{/isDeepLevel}}
</nav>
```

### CSS Example

```css
/* Root level - Full featured */
.nav-root-container {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
  border-radius: 8px;
}

.nav-title {
  color: white;
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

.nav-list-root .nav-item {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  margin: 0.5rem 0;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.nav-icon {
  font-size: 1.5rem;
  margin-right: 0.75rem;
}

.nav-list-root .nav-link {
  color: white;
  font-size: 1.1rem;
  text-decoration: none;
}

/* Level 1 - Simplified */
.nav-level1-container {
  background: #f3f4f6;
  padding: 1.5rem;
  border-left: 4px solid #667eea;
}

.nav-subtitle {
  color: #4a5568;
  font-size: 1.2rem;
  margin-bottom: 0.75rem;
}

.nav-list-level1 .nav-item-compact {
  padding: 0.5rem;
  margin: 0.25rem 0;
}

.nav-link-compact {
  color: #2d3748;
  text-decoration: none;
}

/* Level 2 - Minimal */
.nav-level2-container {
  border-top: 1px solid #e2e8f0;
  padding: 1rem 0;
}

.nav-list-minimal {
  list-style: none;
  padding: 0;
}

.nav-item-minimal {
  padding: 0.25rem 0;
  font-size: 0.9rem;
}

/* Deep levels - Just a back link */
.nav-minimal {
  padding: 1rem;
  text-align: center;
}

.back-link {
  color: #667eea;
  text-decoration: none;
  font-size: 0.9rem;
}

.back-link:hover {
  text-decoration: underline;
}
```

## Use Cases

1. **Progressive simplification**: Show full navigation at top levels, minimal at deeper levels
2. **Breadcrumb-style**: Different visual treatments based on depth
3. **Conditional rendering**: Hide navigation completely after certain depth
4. **Back navigation**: Show "back to parent" links at deep levels
5. **Visual hierarchy**: Use different colors/sizes to indicate depth

## Testing

1. Create a navigation widget with Component Style on root page
2. Set `inheritanceLevel: -1` (infinite inheritance)
3. Visit pages at different depths:
   - Root page → depth 0
   - Child page → depth 1
   - Grandchild → depth 2
4. Verify template renders different navigation at each level

