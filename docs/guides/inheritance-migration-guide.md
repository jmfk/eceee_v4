# Inheritance System Migration Guide

## Quick Start

If you're working with page inheritance in the eceee_v4 frontend, you can now use the unified `usePageInheritance` hook instead of multiple separate hooks.

## What Changed?

### Backend
- ✅ Added `theme_inheritance_info` field to page detail API response
- ✅ Theme inheritance now computed on backend (like layout inheritance)
- ✅ All inheritance data available in single page API call

### Frontend
- ✅ New `usePageInheritance` hook combines widgets, layout, and theme inheritance
- ✅ ThemeSelector updated to handle backend-computed inheritance info
- ✅ PageEditor migrated to use unified hook
- ✅ Backward compatible with old hooks

## Step-by-Step Migration

### 1. Import the New Hook

```javascript
// Old way
import { useWidgetInheritance } from '../hooks/useWidgetInheritance'
import { useTheme } from '../hooks/useTheme'

// New way
import { usePageInheritance } from '../hooks/usePageInheritance'
```

### 2. Replace Hook Calls

```javascript
// Old way
const widgetInheritance = useWidgetInheritance(pageId)
const pageQuery = useQuery(['page', pageId], () => pagesApi.get(pageId))

// New way
const inheritance = usePageInheritance(pageId)
```

### 3. Update Data Access

```javascript
// Old way
const inheritedWidgets = widgetInheritance.inheritedWidgets
const slotRules = widgetInheritance.slotInheritanceRules
const layoutInfo = pageQuery.data?.layoutInheritanceInfo

// New way
const inheritedWidgets = inheritance.widgets.inherited
const slotRules = inheritance.widgets.rules
const layoutInfo = inheritance.layout.inheritanceInfo
const themeInfo = inheritance.theme.inheritanceInfo // NEW!
```

### 4. Update Component Props

```javascript
// Old way
<ThemeSelector
  themeInheritanceInfo={pageVersionData?.themeInheritanceInfo}
/>

// New way
<ThemeSelector
  themeInheritanceInfo={inheritance.theme.inheritanceInfo}
/>
```

## Migration Examples

### Example 1: PageEditor Component

**Before:**
```javascript
const PageEditor = ({ pageId }) => {
  const widgetInheritance = useWidgetInheritance(pageId)
  const pageQuery = useQuery(['page', pageId], () => pagesApi.get(pageId))
  
  return (
    <div>
      <WidgetSlot
        inheritedWidgets={widgetInheritance.inheritedWidgets}
        slotRules={widgetInheritance.slotInheritanceRules}
      />
      <ThemeSelector
        themeInheritanceInfo={pageQuery.data?.themeInheritanceInfo}
      />
    </div>
  )
}
```

**After:**
```javascript
const PageEditor = ({ pageId }) => {
  const inheritance = usePageInheritance(pageId)
  
  return (
    <div>
      <WidgetSlot
        inheritedWidgets={inheritance.widgets.inherited}
        slotRules={inheritance.widgets.rules}
      />
      <ThemeSelector
        themeInheritanceInfo={inheritance.theme.inheritanceInfo}
      />
    </div>
  )
}
```

### Example 2: Simple Widget Display

**Before:**
```javascript
const WidgetDisplay = ({ pageId, slotName }) => {
  const { inheritedWidgets, isLoading } = useWidgetInheritance(pageId)
  
  if (isLoading) return <Spinner />
  
  const widgets = inheritedWidgets[slotName] || []
  return <div>{widgets.map(w => <Widget key={w.id} {...w} />)}</div>
}
```

**After:**
```javascript
const WidgetDisplay = ({ pageId, slotName }) => {
  const widgets = useWidgetInheritanceOnly(pageId)
  
  if (widgets.isLoading) return <Spinner />
  
  const slotWidgets = widgets.inherited[slotName] || []
  return <div>{slotWidgets.map(w => <Widget key={w.id} {...w} />)}</div>
}
```

### Example 3: Inheritance Status Badge

**Before:**
```javascript
const InheritanceStatus = ({ pageId }) => {
  const widgetInheritance = useWidgetInheritance(pageId)
  const pageQuery = useQuery(['page', pageId], () => pagesApi.get(pageId))
  
  const hasWidgets = widgetInheritance.hasInheritedContent
  const hasLayout = !!pageQuery.data?.layoutInheritanceInfo?.inheritedFrom
  
  return (
    <div>
      {hasWidgets && <Badge>Widgets Inherited</Badge>}
      {hasLayout && <Badge>Layout Inherited</Badge>}
    </div>
  )
}
```

**After:**
```javascript
const InheritanceStatus = ({ pageId }) => {
  const summary = useInheritanceSummary(pageId)
  
  return (
    <div>
      {summary.hasInheritedWidgets && <Badge>Widgets Inherited</Badge>}
      {summary.hasInheritedLayout && <Badge>Layout Inherited</Badge>}
      {summary.hasInheritedTheme && <Badge>Theme Inherited</Badge>}
    </div>
  )
}
```

## Common Patterns

### Pattern 1: Conditional Rendering Based on Inheritance

```javascript
const { widgets, layout, theme } = usePageInheritance(pageId)

// Check if anything is inherited
if (widgets.hasContent || layout.inheritedFrom || theme.inheritedFrom) {
  return <InheritedContentBanner />
}
```

### Pattern 2: Showing Inheritance Source

```javascript
const { theme } = usePageInheritance(pageId)

if (theme.inheritedFrom) {
  return (
    <p>
      Theme inherited from{' '}
      <Link to={`/pages/${theme.inheritedFrom.id}`}>
        {theme.inheritedFrom.title}
      </Link>
    </p>
  )
}
```

### Pattern 3: Loading States

```javascript
const inheritance = usePageInheritance(pageId)

if (inheritance.isLoading) {
  return <Spinner />
}

if (inheritance.error) {
  return <ErrorMessage error={inheritance.error} />
}

// Use inheritance data
```

## Backward Compatibility

The old hooks still work! You can migrate incrementally:

```javascript
// ✅ Still works
const widgetInheritance = useWidgetInheritance(pageId)

// ✅ Also works
const { widgets } = usePageInheritance(pageId)

// Both provide the same data (with different structure)
```

## Data Structure Changes

### Theme Inheritance Info

**Old Structure (client-built):**
```javascript
{
  source: 'inherited',
  inheritedFrom: {
    pageTitle: 'Parent Page',
    pageId: 100
  }
}
```

**New Structure (backend-provided):**
```javascript
{
  effectiveTheme: { id, name, description, ... },
  inheritedFrom: { id: 100, title: 'Parent Page', slug: 'parent' },
  inheritanceChain: [...],
  overrideOptions: [...]
}
```

ThemeSelector now handles both formats automatically!

## Testing Your Migration

1. **Check theme inheritance displays correctly**
   - Navigate to a child page
   - Open Theme tab
   - Verify "Inherited from [Parent]" banner shows

2. **Check widget inheritance works**
   - Add widgets to parent page
   - Check child page shows inherited widgets
   - Verify slot rules apply correctly

3. **Check loading states**
   - Verify spinner shows while loading
   - Check error states display properly

4. **Check refetch functionality**
   - Make changes to parent
   - Verify child refetches inheritance data

## Troubleshooting

### Issue: Theme inheritance not showing

**Solution:**
```javascript
// Make sure you're passing the right prop
<ThemeSelector
  themeInheritanceInfo={inheritance.theme.inheritanceInfo}
  // NOT: themeInheritanceInfo={inheritance.theme}
/>
```

### Issue: Widget data structure different

**Solution:**
```javascript
// Old: widgetInheritance.inheritedWidgets
// New: inheritance.widgets.inherited

// Access the same way:
const widgets = inheritance.widgets.inherited[slotName]
```

### Issue: Multiple loading states

**Solution:**
```javascript
// Old way (multiple loaders)
const isLoading = widgetInheritance.isLoading || pageQuery.isLoading

// New way (unified)
const isLoading = inheritance.isLoading
```

## Checklist

- [ ] Replace `useWidgetInheritance` with `usePageInheritance`
- [ ] Update data access patterns (`inherited` vs `inheritedWidgets`)
- [ ] Pass `inheritance.theme.inheritanceInfo` to ThemeSelector
- [ ] Update loading state checks
- [ ] Test theme inheritance display
- [ ] Test widget inheritance functionality
- [ ] Verify error handling works

## Need Help?

- See [Unified Inheritance System Documentation](../architecture/unified-inheritance-system.md)
- Check [API Documentation](../api/inheritance-endpoints.md)
- Ask in #frontend-dev channel

## Summary

**Benefits of Migration:**
- ✅ Fewer API calls (better performance)
- ✅ Single hook to import (simpler code)
- ✅ Backend-computed inheritance (more accurate)
- ✅ Better TypeScript support
- ✅ Consistent data structure

**Migration Effort:**
- Small components: ~5 minutes
- Medium components: ~15 minutes
- Large components: ~30 minutes

**Priority Components:**
1. ✅ PageEditor (completed)
2. ✅ ThemeSelector (completed)
3. ContentEditor
4. LayoutSelector
5. Custom page components









