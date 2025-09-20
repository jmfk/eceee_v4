# Developer Experience Tools Guide

## Overview

The UnifiedDataContext includes a comprehensive suite of developer tools designed to make debugging, performance optimization, and development easier and more efficient. These tools are only available in development mode and provide deep insights into data operations, state management, and system performance.

## Table of Contents

1. [Getting Started](#getting-started)
2. [DevTools Panel](#devtools-panel)
3. [Operation Debugging](#operation-debugging)
4. [State Inspection](#state-inspection)
5. [Performance Profiling](#performance-profiling)
6. [Session Recording & Replay](#session-recording--replay)
7. [Browser Console Integration](#browser-console-integration)
8. [Performance Optimization](#performance-optimization)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

## Getting Started

### Accessing DevTools

The DevTools are automatically available in development mode. You'll see a purple bug icon (🐛) in the bottom-right corner of your application.

```jsx
// DevTools are automatically included when you use UnifiedDataProvider
import { UnifiedDataProvider, DevToolsTrigger } from './contexts/unified-data';

function App() {
  return (
    <UnifiedDataProvider enableDevTools={true}>
      <YourApp />
      <DevToolsTrigger /> {/* Purple bug icon */}
    </UnifiedDataProvider>
  );
}
```

### Browser Console Access

All DevTools functionality is also available through the browser console:

```javascript
// Available in browser console
const devTools = window.__UNIFIED_DATA_DEVTOOLS_HOOK__;

// Quick commands
devTools.startRecording('Debug Session');
devTools.showStateInspector();
devTools.showPerformanceProfiler();
devTools.getCurrentState();
```

## DevTools Panel

### Opening the Panel

Click the purple bug icon or use the keyboard shortcut `Ctrl+Shift+D` (when implemented) to open the DevTools panel.

### Panel Tabs

#### 1. Operations Tab
- **View all operations** executed in the application
- **Real-time operation log** with timestamps and duration
- **Filter operations** by type or payload content
- **Operation details** including payload and metadata
- **Success/failure indicators** with error details

#### 2. State Tab
- **Current state overview** with entity counts
- **State size monitoring** for performance tracking
- **isDirty and loading status** indicators
- **Unsaved changes tracking** by widget
- **Quick state inspection** button

#### 3. Performance Tab
- **Operation performance metrics** with timing data
- **Success rates** and error counts by operation type
- **Performance insights** and optimization suggestions
- **Memory usage tracking** (when available)

#### 4. Sessions Tab
- **Recording session management** for bug reproduction
- **Session export/import** for sharing with team
- **Session replay** at configurable speeds
- **Operation search** within sessions

#### 5. Settings Tab
- **Enable/disable DevTools** functionality
- **Configure logging levels** and features
- **Clear debug data** and reset metrics
- **Export/import** complete debug datasets

## Operation Debugging

### Real-time Operation Monitoring

```javascript
// Monitor all operations
devTools.getOperationLogs().forEach(log => {
  console.log(`${log.operation.type}: ${log.duration}ms`);
});

// Search for specific operations
const slowOperations = devTools.searchOperations({
  minDuration: 100,
  type: 'UPDATE_WIDGET_CONFIG'
});

// Get operation statistics
const stats = devTools.getOperationStats();
console.table(stats);
```

### Operation Analysis

**View Operation Details:**
- Operation type and payload
- Execution time and success status
- State before and after operation
- Stack trace for debugging
- Error details if operation failed

**Filter Operations:**
- By operation type
- By execution time
- By success/failure status
- By date range
- By payload content

## State Inspection

### Interactive State Explorer

The state inspector provides a visual tree view of the entire application state:

```javascript
// Open state inspector
devTools.showStateInspector();

// Get current state programmatically
const state = devTools.getCurrentState();

// Inspect specific entities
console.log('Pages:', state.pages);
console.log('Widgets:', state.widgets);
console.log('Metadata:', state.metadata);
```

### State Features

**Entity Overview:**
- **Pages**: Count and basic information
- **Widgets**: Count and slot distribution
- **Layouts**: Available layouts and themes
- **Versions**: Version history and status
- **Metadata**: System state (isDirty, isLoading, errors)

**Interactive Features:**
- **Expandable tree view** for deep state exploration
- **Search and filter** functionality
- **Copy to clipboard** for any value or object
- **Real-time updates** as state changes
- **Export state** to JSON file

### State Analysis

```javascript
// Analyze state size and structure
const stateSize = JSON.stringify(state).length;
console.log(`State size: ${(stateSize / 1024).toFixed(1)}KB`);

// Check for potential issues
if (Object.keys(state.widgets).length > 1000) {
  console.warn('Large number of widgets - consider pagination');
}

if (state.metadata.isDirty) {
  console.log('Unsaved changes detected');
}
```

## Performance Profiling

### Performance Monitoring

```javascript
// Show performance profile
devTools.showPerformanceProfiler();

// Get performance insights
const insights = devTools.getPerformanceInsights();
console.log('Slow operations:', insights.slowOperations);
console.log('Recommendations:', insights.recommendations);
```

### Performance Metrics

**Operation Performance:**
- **Average execution time** per operation type
- **Success rates** and error counts
- **Slowest operations** identification
- **Memory usage** tracking per operation

**System Performance:**
- **State size growth** over time
- **Subscription count** monitoring
- **Memory leak detection** 
- **Performance score** (0-100 scale)

### Optimization Suggestions

The profiler automatically provides optimization suggestions:

- **Slow operations** → Implement batching or debouncing
- **Large state size** → Consider data pagination or cleanup
- **Memory leaks** → Review subscription cleanup
- **High operation count** → Implement operation batching

## Session Recording & Replay

### Recording User Sessions

```javascript
// Start recording
const sessionId = devTools.startRecording('Bug Reproduction');

// Perform user actions...

// Stop recording
const session = devTools.stopRecording();
console.log(`Recorded ${session.operations.length} operations`);
```

### Replaying Sessions

```javascript
// Replay at normal speed
await devTools.replaySession(sessionId);

// Replay at 2x speed
await devTools.replaySession(sessionId, 2);

// Replay with custom callback
await devTools.replaySession(sessionId, 1, (operation, index) => {
  console.log(`Replaying ${index}: ${operation.type}`);
});
```

### Session Management

**Export Session:**
```javascript
const sessionData = devTools.exportSession(sessionId);
// Save to file or send to team
```

**Import Session:**
```javascript
const importedSessionId = devTools.importSession(sessionData);
// Replay imported session
await devTools.replaySession(importedSessionId);
```

**Session Search:**
```javascript
// Find operations in recorded sessions
const failedOperations = devTools.searchOperations({
  success: false,
  dateRange: { start: '2024-01-01', end: '2024-01-02' }
});
```

## Browser Console Integration

### Quick Commands

```javascript
const devTools = window.__UNIFIED_DATA_DEVTOOLS_HOOK__;

// State inspection
devTools.getCurrentState();
devTools.showStateInspector();

// Performance analysis
devTools.getOperationStats();
devTools.showPerformanceProfiler();

// Recording
devTools.startRecording('Console Session');
devTools.stopRecording();

// Data management
devTools.exportDebugData();
devTools.clearDebugData();
```

### Advanced Console Usage

```javascript
// Search for specific operations
const slowWidgetOps = devTools.searchOperations({
  type: 'UPDATE_WIDGET_CONFIG',
  minDuration: 50
});

// Analyze operation patterns
const stats = devTools.getOperationStats();
Object.entries(stats).forEach(([type, stat]) => {
  if (stat.averageTime > 100) {
    console.warn(`Slow operation: ${type} (${stat.averageTime}ms avg)`);
  }
});

// Export specific data
const debugData = devTools.exportDebugData();
console.log('Debug data exported:', debugData);
```

## Performance Optimization

### Identifying Performance Issues

**1. Slow Operations:**
```javascript
const insights = devTools.getPerformanceInsights();
insights.slowOperations.forEach(op => {
  console.log(`Optimize: ${op.type} (${op.averageTime}ms)`);
});
```

**2. Memory Leaks:**
```javascript
insights.memoryLeaks.forEach(op => {
  console.warn(`Memory leak: ${op.type} (+${op.memoryDelta}MB)`);
});
```

**3. State Growth:**
```javascript
const report = devTools.getPerformanceReport();
report.heavyStateOperations.forEach(op => {
  console.log(`Heavy state operation: ${op.type} (+${op.stateSizeDelta}KB)`);
});
```

### Optimization Strategies

**Operation Batching:**
```javascript
// Instead of multiple individual operations
operations.forEach(op => dispatch(op));

// Use batch operations
batchDispatch(operations);
```

**Debouncing Rapid Changes:**
```javascript
// Use debounced operations for rapid changes
dispatch(operation, { debounce: 500 }); // 500ms debounce
```

**Memory Management:**
```javascript
// Regular cleanup
devTools.clearDebugData(); // Clear old debug data
dataManager.clear(); // Clear subscriptions and caches
```

## Troubleshooting

### Common Issues

**1. DevTools Not Appearing:**
```javascript
// Check if enabled
console.log(process.env.NODE_ENV); // Should be 'development'

// Check provider configuration
<UnifiedDataProvider enableDevTools={true}>
```

**2. Performance Issues:**
```javascript
// Check operation count
const stats = devTools.getOperationStats();
const totalOps = Object.values(stats).reduce((sum, stat) => sum + stat.count, 0);

if (totalOps > 1000) {
  console.warn('High operation count detected');
}
```

**3. Memory Issues:**
```javascript
// Monitor memory usage
const insights = devTools.getPerformanceInsights();
if (insights.memoryLeaks.length > 0) {
  console.warn('Memory leaks detected:', insights.memoryLeaks);
}
```

### Debug Mode

Enable verbose logging for detailed debugging:

```javascript
// Enable debug logging
devTools.updateConfig({
  logLevel: 'debug',
  captureStackTraces: true
});
```

## Best Practices

### 1. Regular Performance Monitoring

```javascript
// Check performance regularly during development
setInterval(() => {
  const report = devTools.getPerformanceReport();
  if (report.score < 80) {
    console.warn('Performance score low:', report.score);
    console.log('Recommendations:', report.recommendations);
  }
}, 30000); // Every 30 seconds
```

### 2. Session Recording for Bug Reports

```javascript
// Start recording when user reports an issue
const sessionId = devTools.startRecording('Bug Report #123');

// Include session data in bug reports
const sessionData = devTools.exportSession(sessionId);
// Attach sessionData to bug report
```

### 3. Performance Testing

```javascript
// Test operation performance
const startTime = performance.now();
await dispatch(operation);
const duration = performance.now() - startTime;

if (duration > 100) {
  console.warn(`Slow operation detected: ${operation.type} (${duration}ms)`);
}
```

### 4. State Validation

```javascript
// Regular state validation during development
const validation = useValidation();

if (!validation.isStateValid) {
  console.error('State validation failed:', validation.getStateErrors());
}
```

### 5. Memory Management

```javascript
// Clear debug data periodically
useEffect(() => {
  const cleanup = setInterval(() => {
    devTools.clearDebugData();
  }, 300000); // Every 5 minutes

  return () => clearInterval(cleanup);
}, []);
```

## Production Considerations

### Safety Features

- **Development-only**: DevTools are automatically disabled in production
- **No performance impact**: Zero overhead in production builds
- **Secure**: No sensitive data exposure in production
- **Memory efficient**: Automatic cleanup and limits

### Deployment

```javascript
// Production build automatically excludes DevTools
if (process.env.NODE_ENV === 'development') {
  // DevTools code is only included in development
}
```

## Advanced Usage

### Custom Performance Monitoring

```javascript
// Create custom performance monitor
const performanceProfiler = new PerformanceProfiler({
  enabled: true,
  maxProfiles: 2000
});

// Profile specific operations
const profileId = performanceProfiler.startProfiling(operation, state);
// ... operation execution ...
const profile = performanceProfiler.endProfiling(profileId, newState);
```

### Custom Validation Rules

```javascript
const validation = useValidation();

// Add custom validation rule
validation.addValidationRule('page', {
  name: 'custom-title-length',
  severity: 'warning',
  validate: (page) => ({
    isValid: true,
    errors: [],
    warnings: page.title.length > 100 ? [{
      field: 'title',
      message: 'Title is very long',
      code: 'LONG_TITLE'
    }] : []
  })
});
```

### Integration with External Tools

```javascript
// Export data for external analysis
const debugData = devTools.exportDebugData();

// Send to analytics service
analytics.track('debug_data_exported', {
  operationCount: debugData.devTools.operations.length,
  sessionCount: debugData.sessions.length,
  performanceScore: debugData.devTools.insights.score
});
```

## API Reference

### useDevTools Hook

```typescript
const {
  // State
  isEnabled,
  isRecording,
  isReplaying,
  
  // Recording
  startRecording,
  stopRecording,
  
  // Analysis
  getOperationStats,
  getPerformanceInsights,
  searchOperations,
  
  // State inspection
  getCurrentState,
  showStateInspector,
  showPerformanceProfiler,
  
  // Session management
  getSessions,
  replaySession,
  exportSession,
  importSession,
  
  // Controls
  enableDevTools,
  clearDebugData,
  exportDebugData
} = useDevTools();
```

### DevToolsManager API

```typescript
const devToolsManager = new DevToolsManager({
  enabled: true,
  maxOperationLogs: 1000,
  captureStackTraces: true,
  enableTimeTravel: true,
  logLevel: 'debug'
});

// Log operations
devToolsManager.logOperation(operation, stateBefore, stateAfter, duration);

// Create snapshots
devToolsManager.createStateSnapshot(state, operationId, 'Custom snapshot');

// Time travel
devToolsManager.timeTravel(snapshotId);

// Get insights
devToolsManager.getPerformanceInsights();
```

### OperationLogger API

```typescript
const operationLogger = new OperationLogger();

// Recording
const sessionId = operationLogger.startRecording('Session Name');
operationLogger.stopRecording();

// Replay
await operationLogger.replaySession(sessionId, speed);

// Search
const operations = operationLogger.searchOperations({
  type: 'UPDATE_WIDGET_CONFIG',
  success: false,
  minDuration: 100
});
```

### PerformanceProfiler API

```typescript
const profiler = new PerformanceProfiler({ enabled: true });

// Profile operations
const profileId = profiler.startProfiling(operation, state);
const profile = profiler.endProfiling(profileId, newState);

// Generate reports
const report = profiler.generateReport();
console.log('Performance score:', report.score);
console.log('Recommendations:', report.recommendations);
```

## Examples

### Debugging Slow Widget Updates

```javascript
// 1. Start recording
const sessionId = devTools.startRecording('Slow Widget Debug');

// 2. Perform the slow operation
// ... user edits widget ...

// 3. Stop recording and analyze
const session = devTools.stopRecording();

// 4. Find slow operations
const slowOps = devTools.searchOperations({
  type: 'UPDATE_WIDGET_CONFIG',
  minDuration: 100
});

console.log('Slow widget operations:', slowOps);

// 5. Get optimization suggestions
const insights = devTools.getPerformanceInsights();
console.log('Suggestions:', insights.recommendations);
```

### Reproducing User Bugs

```javascript
// 1. User reports bug - start recording
const sessionId = devTools.startRecording('Bug Report #456');

// 2. User performs actions that cause the bug
// ... user interactions ...

// 3. Export session for analysis
const sessionData = devTools.exportSession(sessionId);

// 4. Developer imports and replays session
const importedSessionId = devTools.importSession(sessionData);
await devTools.replaySession(importedSessionId);
```

### Performance Optimization Workflow

```javascript
// 1. Enable performance monitoring
devTools.showPerformanceProfiler();

// 2. Perform typical user workflows
// ... normal app usage ...

// 3. Analyze performance
const report = devTools.getPerformanceReport();

if (report.score < 80) {
  console.warn('Performance needs improvement');
  
  // 4. Implement optimizations based on recommendations
  report.recommendations.forEach(rec => {
    console.log('TODO:', rec);
  });
  
  // 5. Re-test after optimizations
  devTools.clearDebugData();
  // ... test again ...
}
```

### State Validation During Development

```javascript
// Regular state validation
const validation = useValidation();

useEffect(() => {
  if (!validation.isStateValid) {
    console.error('State validation failed:');
    validation.getStateErrors().errors.forEach(error => {
      console.error(`${error.field}: ${error.message}`);
    });
  }
}, [validation.isStateValid]);

// Custom validation for business rules
validation.addValidationRule('page', {
  name: 'published-page-requirements',
  severity: 'error',
  validate: (page) => {
    if (page.status === 'published') {
      const errors = [];
      if (!page.metadata.description) {
        errors.push({
          field: 'metadata.description',
          message: 'Published pages must have descriptions',
          code: 'REQUIRED_FOR_PUBLISHED'
        });
      }
      return { isValid: errors.length === 0, errors, warnings: [] };
    }
    return { isValid: true, errors: [], warnings: [] };
  }
});
```

## Tips and Tricks

### 1. Keyboard Shortcuts (Browser Console)

```javascript
// Create shortcuts for common tasks
window.dt = window.__UNIFIED_DATA_DEVTOOLS_HOOK__;
window.state = () => dt.getCurrentState();
window.stats = () => dt.getOperationStats();
window.perf = () => dt.showPerformanceProfiler();
```

### 2. Automated Testing Integration

```javascript
// Use DevTools in tests
describe('Performance Tests', () => {
  it('should complete operations within time limit', async () => {
    const devTools = useDevTools();
    
    const startTime = performance.now();
    await performComplexOperation();
    const duration = performance.now() - startTime;
    
    expect(duration).toBeLessThan(1000); // 1 second limit
    
    const insights = devTools.getPerformanceInsights();
    expect(insights.slowOperations.length).toBe(0);
  });
});
```

### 3. CI/CD Integration

```javascript
// Export performance data for CI/CD
const performanceData = {
  score: devTools.getPerformanceReport().score,
  slowOperations: devTools.getPerformanceInsights().slowOperations.length,
  memoryLeaks: devTools.getPerformanceInsights().memoryLeaks.length
};

// Fail build if performance is poor
if (performanceData.score < 70) {
  throw new Error('Performance score too low for deployment');
}
```

## Conclusion

The UnifiedDataContext DevTools provide a comprehensive debugging and optimization suite that makes development faster, easier, and more reliable. Use these tools regularly during development to:

- **Debug complex state interactions**
- **Optimize application performance**
- **Reproduce and fix user-reported bugs**
- **Validate data integrity**
- **Monitor system health**

The DevTools are designed to be non-intrusive and safe for development use, with automatic production exclusion and comprehensive error handling.

Happy debugging! 🐛✨
