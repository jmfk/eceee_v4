# UnifiedDataContext Test Suite

## Overview

Comprehensive test suite for the UnifiedDataContext system covering all core functionality, edge cases, and integration scenarios.

## Test Files

### Core Tests
- **`DataManager.test.ts`** - Core state management and operation processing
- **`SubscriptionManager.test.ts`** - Subscription system and notifications
- **`operations.test.ts`** - Operation validation and error handling
- **`utils.test.ts`** - Utility functions and error classes

### Integration Tests
- **`UnifiedDataContext.test.tsx`** - Context provider and hooks integration
- **`useWidgetOperations.test.tsx`** - Widget operations hook functionality
- **`useBatchOperations.test.tsx`** - Batch operations management
- **`integration.test.tsx`** - End-to-end workflow testing

## Test Coverage

### Core Functionality
- ✅ **State Management** - Initialization, updates, validation
- ✅ **Operation Processing** - All operation types, validation, errors
- ✅ **Subscription System** - State/operation subscriptions, cleanup
- ✅ **Error Handling** - Validation, rollback, error propagation
- ✅ **Dirty State Tracking** - Automatic computation, manual override

### Widget Operations
- ✅ **CRUD Operations** - Create, read, update, delete widgets
- ✅ **Configuration Updates** - Real-time config changes
- ✅ **Widget Movement** - Slot changes, reordering
- ✅ **Batch Operations** - Multiple operations, progress tracking
- ✅ **Save/Reset** - Widget persistence, state reset

### Integration Scenarios
- ✅ **Provider Setup** - Context initialization, error boundaries
- ✅ **Hook Integration** - Multiple hooks working together
- ✅ **React Integration** - Component re-renders, state updates
- ✅ **Performance** - Large operation batches, subscription efficiency

### Edge Cases
- ✅ **Missing Widgets** - Operations on non-existent widgets
- ✅ **Invalid Operations** - Type validation, payload validation
- ✅ **Subscription Errors** - Callback failures, cleanup
- ✅ **State Corruption** - Rollback on failures

## Running Tests

```bash
# Run all UnifiedDataContext tests
npm test -- --testPathPattern="unified-data"

# Run specific test file
npm test DataManager.test.ts

# Run with coverage
npm test -- --coverage --testPathPattern="unified-data"

# Watch mode for development
npm test -- --watch --testPathPattern="unified-data"
```

## Test Utilities

### Mock Data Helpers
```typescript
const createMockWidget = (id: string, overrides = {}) => ({
    id,
    type: 'core_widgets.ContentWidget',
    slot: 'main',
    config: {},
    order: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
});

const createMockState = (overrides = {}) => ({
    pages: {},
    widgets: {},
    layouts: {},
    versions: {},
    metadata: {
        lastUpdated: new Date().toISOString(),
        isLoading: false,
        isDirty: false,
        errors: {},
        widgetStates: {
            unsavedChanges: {},
            errors: {},
            activeEditors: []
        }
    },
    ...overrides
});
```

### Test Patterns

**Testing Operations:**
```typescript
await act(async () => {
    await result.current.dispatch({
        type: OperationTypes.UPDATE_WIDGET_CONFIG,
        payload: { id: 'widget1', config: { title: 'Test' } }
    });
});

expect(result.current.isDirty).toBe(true);
```

**Testing Subscriptions:**
```typescript
const callback = jest.fn();
const unsubscribe = dataManager.subscribe(
    state => state.metadata.isDirty,
    callback
);

// Trigger change...
expect(callback).toHaveBeenCalledWith(true, false);
unsubscribe();
```

**Testing Error Scenarios:**
```typescript
await expect(dataManager.dispatch({
    type: 'INVALID_OPERATION' as any,
    payload: {}
})).rejects.toThrow('Invalid operation type');
```

## Continuous Integration

These tests are designed to:
- ✅ **Run in CI/CD** environments
- ✅ **Provide comprehensive coverage** of all functionality
- ✅ **Catch regressions** in core functionality
- ✅ **Validate performance** characteristics
- ✅ **Test error scenarios** and edge cases

## Maintenance

When adding new operations or hooks:
1. **Add operation tests** to `operations.test.ts`
2. **Add hook tests** following the pattern in `useWidgetOperations.test.tsx`
3. **Add integration tests** to `integration.test.tsx`
4. **Update this README** with new test patterns

The test suite provides confidence in the UnifiedDataContext implementation and ensures reliable operation in production.
