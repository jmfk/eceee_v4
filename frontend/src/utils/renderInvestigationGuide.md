# React Re-rendering Investigation Guide

## Quick Start Investigation

### 1. Enable Debug Mode
Add this to any component you suspect is re-rendering too much:

```jsx
import { useRenderTracker, useStabilityTracker } from '../utils/debugHooks'

const MyComponent = ({ config, onConfigChange }) => {
  // Add these at the top of your component
  const renderCount = useRenderTracker('MyComponent', { config, onConfigChange })
  useStabilityTracker(config, 'MyComponent.config')
  useStabilityTracker(onConfigChange, 'MyComponent.onConfigChange')
  
  // ... rest of component
}
```

### 2. Browser Console Investigation

Open Developer Tools → Console and run these commands:

```javascript
// 1. Generate current render report
renderMonitor.generateReport()

// 2. Check specific component stats
renderMonitor.components.get('ContentWidget')

// 3. Monitor all component names
Array.from(renderMonitor.components.keys())

// 4. Find components with most renders
Array.from(renderMonitor.components.entries())
  .sort((a, b) => b[1].renderCount - a[1].renderCount)
  .slice(0, 5)

// 5. Check for prop stability issues
renderMonitor.components.get('ContentWidget')?.propChanges
```

### 3. React DevTools Profiler

1. Install React DevTools browser extension
2. Open DevTools → Profiler tab
3. Click "Start profiling"
4. Interact with the problematic component
5. Click "Stop profiling"
6. Analyze the flame graph for:
   - Components that render frequently
   - Long render times
   - Unexpected render cascades

## Common Re-rendering Causes & Solutions

### 1. Inline Function Props ❌
```jsx
// BAD - Creates new function on every render
<Component onDirtyChange={(isDirty) => setIsDirty(isDirty)} />

// GOOD - Memoized function
const handleDirtyChange = useCallback((isDirty) => setIsDirty(isDirty), [])
<Component onDirtyChange={handleDirtyChange} />
```

### 2. Object/Array Recreation ❌
```jsx
// BAD - Creates new object every render
const config = { content: text, enabled: true }

// GOOD - Memoized object
const config = useMemo(() => ({ content: text, enabled: true }), [text])
```

### 3. Missing React.memo ❌
```jsx
// BAD - Re-renders on any parent change
const MyComponent = ({ config }) => { ... }

// GOOD - Only re-renders when props change
const MyComponent = memo(({ config }) => { ... })
```

### 4. Unstable useEffect Dependencies ❌
```jsx
// BAD - Effect runs every render
useEffect(() => { ... }, [someObject])

// GOOD - Stable dependencies
const stableObject = useMemo(() => someObject, [someObject.key])
useEffect(() => { ... }, [stableObject])
```

## Investigation Results So Far

### Fixed Issues ✅

1. **ContentWidget inline callbacks** - Added `useCallback` to all event handlers
2. **ContentWidget missing memo** - Wrapped component in `React.memo`
3. **PageEditor inline onDirtyChange** - Memoized the callback function
4. **PageEditor updatePageData** - Added `useCallback` wrapper
5. **Change detection** - Only call callbacks when content actually changes

### Suspected Remaining Issues 🔍

1. **LayoutRenderer widget updates** - May be triggering too frequently
2. **Widget store updates** - Zustand store changes causing cascading re-renders
3. **JSON serialization** - `JSON.stringify(widgets)` might be expensive
4. **React root recreation** - LayoutRendererWithWidgetFactory creating new roots

## Next Investigation Steps

### 1. Check LayoutRenderer Update Frequency
```javascript
// Add to LayoutRenderer.js updateSlot method
console.log(`🔄 LayoutRenderer.updateSlot called for ${slotName}`)
```

### 2. Monitor Widget Store Changes
```javascript
// Add to widget store actions
console.log('🏪 Widget store update:', action, data)
```

### 3. Track React Root Creation
```javascript
// Add to LayoutRendererWithWidgetFactory.js
console.log('⚛️  Creating new React root for widget:', widget.id)
```

### 4. Analyze JSON Serialization Performance
```javascript
// Time the JSON.stringify calls
console.time('widgets-serialize')
const json = JSON.stringify(widgets)
console.timeEnd('widgets-serialize')
```

## Performance Benchmarks

Target performance metrics:
- **Component renders**: < 5 per user action
- **Render time**: < 16.67ms (60fps)
- **Effect triggers**: Only when dependencies actually change
- **Memory usage**: Stable over time

## Tools Available

- `debugHooks.js` - React hooks for tracking renders
- `renderInvestigationScript.js` - Global render monitoring
- `PerformanceProfiler.jsx` - React Profiler wrapper
- `RenderInvestigation.jsx` - Test page for investigation

Run the investigation page at `/render-investigation` to test fixes in isolation.
