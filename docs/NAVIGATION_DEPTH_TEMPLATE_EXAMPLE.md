# Navigation Depth Template Example

## Overview

Navigation widgets can test inheritance depth in Mustache templates to render different navigation styles based on page hierarchy level.

## Available Variables

### Core Variables
- `inheritanceDepth` (Number): How many levels deep the widget is inherited
  - `0` = Widget is on its owner page (root level)
  - `1` = Inherited one level down
  - `2` = Inherited two levels down
  - etc.
- `isInherited` (Boolean): True if widget is inherited from a parent page

### Helper Booleans (for Mustache templates)
These boolean helpers make it easy to test depth without numeric comparisons:

- `isRoot` - True when `inheritanceDepth === 0` (widget on owner page)
- `isLevel1` - True when `inheritanceDepth === 1` (one level down)
- `isLevel2` - True when `inheritanceDepth === 2` (two levels down)
- `isLevel3` - True when `inheritanceDepth === 3` (three levels down)
- `isLevel1AndBelow` - True when `inheritanceDepth >= 1` (level 1 or deeper)
- `isLevel2AndBelow` - True when `inheritanceDepth >= 2` (level 2 or deeper)
- `isLevel3AndBelow` - True when `inheritanceDepth >= 3` (level 3 or deeper)
- `isDeepLevel` - True when `inheritanceDepth >= 4` (very deep nesting)

## Example Template: Depth-Based Navigation

With the built-in helper variables, creating depth-based navigation is simple:

### Simple Template Example
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

