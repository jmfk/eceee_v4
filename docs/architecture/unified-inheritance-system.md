# Unified Inheritance System

## Overview

The Unified Inheritance System consolidates all types of inheritance data (widgets, layouts, themes) into a single, consistent interface. This document explains the architecture, usage, and migration path.

## Architecture

### Backend Computation

All inheritance data is computed on the backend for optimal performance:

1. **Widget Inheritance** - Computed in `WebPage.get_widgets_inheritance_info()` and via inheritance tree
2. **Layout Inheritance** - Computed in `WebPage.get_layout_inheritance_info()`
3. **Theme Inheritance** - Computed in `WebPage.get_theme_inheritance_info()`

### API Response Structure

The page detail API (`/api/webpages/pages/{id}/`) now includes:

```json
{
  "id": 123,
  "title": "Example Page",
  "effectiveLayout": {...},
  "effectiveTheme": {...},
  "layoutInheritanceInfo": {
    "effectiveLayout": {...},
    "inheritedFrom": {"id": 100, "title": "Parent Page"},
    "inheritanceChain": [...],
    "overrideOptions": {...}
  },
  "themeInheritanceInfo": {
    "effectiveTheme": {...},
    "inheritedFrom": {"id": 100, "title": "Parent Page", "slug": "parent"},
    "inheritanceChain": [...],
    "overrideOptions": [...]
  }
}
```

### Frontend Hook

The `usePageInheritance` hook provides a unified interface:

```javascript
import { usePageInheritance } from '../hooks/usePageInheritance'

const inheritance = usePageInheritance(pageId)

// Access widget inheritance
const { inherited, rules, hasContent } = inheritance.widgets

// Access layout inheritance
const { effective, inheritedFrom, chain } = inheritance.layout

// Access theme inheritance
const { effective, inheritedFrom, chain, overrideOptions } = inheritance.theme

// Combined loading state
if (inheritance.isLoading) { ... }

// Refetch all inheritance data
inheritance.refetch()
```

## Usage Examples

### Basic Usage in Components

```javascript
function MyComponent({ pageId }) {
  const inheritance = usePageInheritance(pageId)
  
  // Check if page has any inherited content
  const hasInheritance = 
    inheritance.widgets.hasContent ||
    inheritance.layout.inheritedFrom ||
    inheritance.theme.inheritedFrom
  
  return (
    <div>
      {hasInheritance && (
        <div>This page inherits content from parent pages</div>
      )}
    </div>
  )
}
```

### Widget Inheritance Only

```javascript
import { useWidgetInheritanceOnly } from '../hooks/usePageInheritance'

function WidgetEditor({ pageId }) {
  const widgets = useWidgetInheritanceOnly(pageId)
  
  return (
    <WidgetSlot
      inheritedWidgets={widgets.inherited}
      slotInheritanceRules={widgets.rules}
    />
  )
}
```

### Theme Inheritance Only

```javascript
import { useThemeInheritanceOnly } from '../hooks/usePageInheritance'

function ThemeSelector({ pageId }) {
  const theme = useThemeInheritanceOnly(pageId)
  
  return (
    <div>
      {theme.inheritedFrom && (
        <p>Theme inherited from {theme.inheritedFrom.title}</p>
      )}
    </div>
  )
}
```

### Inheritance Summary

```javascript
import { useInheritanceSummary } from '../hooks/usePageInheritance'

function InheritanceBadge({ pageId }) {
  const summary = useInheritanceSummary(pageId)
  
  return (
    <div>
      <p>Widgets: {summary.summary.widgets}</p>
      <p>Layout: {summary.summary.layout}</p>
      <p>Theme: {summary.summary.theme}</p>
    </div>
  )
}
```

## Data Structures

### Widget Inheritance

```typescript
{
  inherited: {
    [slotName]: Array<Widget>
  },
  rules: {
    [slotName]: {
      inheritanceAllowed: boolean,
      allowMerge: boolean,
      mergeMode: boolean,
      inheritableTypes: string[],
      collapseBehavior: string
    }
  },
  hasContent: boolean,
  parentId: number | null,
  hasParent: boolean
}
```

### Layout Inheritance

```typescript
{
  effective: Layout | null,
  inheritanceInfo: {
    effectiveLayout: Layout,
    inheritedFrom: { id, title } | null,
    inheritanceChain: Array<{
      pageId: number,
      pageTitle: string,
      codeLayout: string,
      isOverride: boolean
    }>,
    overrideOptions: {
      codeLayouts: Layout[]
    }
  },
  chain: Array<ChainItem>,
  inheritedFrom: { id, title } | null,
  type: string | null
}
```

### Theme Inheritance

```typescript
{
  effective: Theme | null,
  inheritanceInfo: {
    effectiveTheme: Theme,
    inheritedFrom: { id, title, slug } | null,
    inheritanceChain: Array<{
      pageId: number,
      pageTitle: string,
      themeId: number | null,
      themeName: string | null,
      isOverride: boolean
    }>,
    overrideOptions: Theme[]
  },
  chain: Array<ChainItem>,
  inheritedFrom: { id, title, slug } | null,
  overrideOptions: Theme[]
}
```

## Migration Guide

### Migrating from Old Pattern

**Before:**
```javascript
// Multiple hooks for different inheritance types
const widgetInheritance = useWidgetInheritance(pageId)
const pageData = useQuery(['page', pageId], () => pagesApi.get(pageId))
const theme = useTheme({ themeId: pageData.theme })
```

**After:**
```javascript
// Single unified hook
const inheritance = usePageInheritance(pageId)

// Access all data from one place
const widgets = inheritance.widgets
const layout = inheritance.layout
const theme = inheritance.theme
```

### Updating Components

1. **Import the new hook:**
   ```javascript
   import { usePageInheritance } from '../hooks/usePageInheritance'
   ```

2. **Replace multiple hook calls:**
   ```javascript
   // Before
   const widgetInheritance = useWidgetInheritance(pageId)
   
   // After
   const inheritance = usePageInheritance(pageId)
   const widgets = inheritance.widgets
   ```

3. **Update prop passing:**
   ```javascript
   // Before
   <ThemeSelector themeInheritanceInfo={pageData.themeInheritanceInfo} />
   
   // After
   <ThemeSelector themeInheritanceInfo={inheritance.theme.inheritanceInfo} />
   ```

### Backward Compatibility

The system maintains backward compatibility:

- Old `useWidgetInheritance` hook still works
- Old `useTheme` hook still works
- Components can migrate incrementally
- Both old and new data structures are supported

## Benefits

### Performance
- Backend computes inheritance once
- Frontend receives pre-computed data
- Reduced API calls
- Better caching

### Developer Experience
- Single source of truth
- Consistent API
- Less prop drilling
- Better TypeScript support
- Easier debugging

### Maintainability
- Centralized inheritance logic
- Easier to test
- Clear data flow
- Better documentation

## Best Practices

1. **Use the unified hook** when you need multiple types of inheritance
2. **Use specialized hooks** (`useWidgetInheritanceOnly`, etc.) when you only need one type
3. **Access raw data** via `inheritance._raw` only for debugging
4. **Handle loading states** using the combined `isLoading` flag
5. **Refetch all data** using the unified `refetch()` method

## Testing

### Unit Tests

```javascript
import { renderHook } from '@testing-library/react'
import { usePageInheritance } from '../hooks/usePageInheritance'

test('provides unified inheritance data', async () => {
  const { result } = renderHook(() => usePageInheritance(123))
  
  await waitFor(() => !result.current.isLoading)
  
  expect(result.current.widgets).toBeDefined()
  expect(result.current.layout).toBeDefined()
  expect(result.current.theme).toBeDefined()
})
```

### Integration Tests

1. Create a page with parent
2. Verify widget inheritance appears
3. Verify theme inheritance shows parent theme
4. Verify layout inheritance works correctly
5. Verify override functionality

## Troubleshooting

### Theme inheritance not showing
- Check that backend includes `theme_inheritance_info` in response
- Verify page has a parent with a theme
- Check that `themeInheritanceInfo` is passed to ThemeSelector

### Widget inheritance missing
- Verify `includeWidgets` option is true
- Check that parent page has widgets in the relevant slot
- Verify slot inheritance rules allow inheritance

### Loading state stuck
- Check network tab for failed API calls
- Verify `enabled` option is set correctly
- Check React Query cache

## Future Enhancements

- Add mutation helpers for overriding inherited values
- Support optimistic updates for inheritance changes
- Add inheritance visualization components
- Implement inheritance diff viewer
- Add inheritance history tracking

## Related Documentation

- [Widget Inheritance](./widget-inheritance.md)
- [Layout System](./layout-system.md)
- [Theme System](./theme-system.md)
- [API Documentation](../api/inheritance-endpoints.md)










