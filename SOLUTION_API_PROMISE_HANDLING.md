# Solution: API Promise Handling - Preventing Missing Await Keywords

## Problem Statement

The frontend API wrapper returns promises that need to be properly awaited or handled with `.then()`, but this pattern was frequently missed during development, causing bugs where:
- API calls returned Promise objects instead of data
- Components never updated with new data
- Silent failures occurred without proper error handling

## Implemented Solutions

### 1. ✅ ESLint Rule (Primary Solution)

**File**: `frontend/.eslintrc-api-rules.js`
**Integration**: `frontend/eslint.config.js`

Created a custom ESLint rule `api-rules/require-await-on-api-calls` that:
- Detects API calls using patterns: `*Api.*()` and `api.get/post/put/patch/delete()`
- Ensures they are either awaited, returned, or chained with `.then()`
- Provides automatic fixes by suggesting `await` keyword
- Runs during development and CI/CD

**Example Detection**:
```javascript
// ❌ ESLint Error: API calls must be awaited or returned
const result = mediaCollectionsApi.list();

// ✅ Correct
const result = await mediaCollectionsApi.list();
```

### 2. ✅ TypeScript Definitions

**File**: `frontend/src/api/types.d.ts`

Added comprehensive TypeScript definitions that:
- Define `ApiPromise<T>` type for all API functions
- Provide `MustAwait<T>` utility type
- Include interfaces for all API modules
- Make promise handling explicit in IDE

### 3. ✅ Comprehensive Documentation

**File**: `frontend/src/api/API_USAGE_GUIDE.md`

Created detailed documentation covering:
- ✅ Correct usage patterns with examples
- ❌ Common mistakes to avoid
- React component patterns (useEffect, event handlers)
- Error handling best practices
- Quick checklist for code reviews

### 4. ✅ VS Code Snippets

**File**: `frontend/.vscode/snippets.json`

Added code snippets for common patterns:
- `api-useeffect` - Load data in useEffect with proper error handling
- `api-handler` - Event handler with loading states
- `api-save` - Create/update operations
- `api-delete` - Delete with confirmation
- `api-query` - React Query integration
- `api-mutation` - React Query mutations
- `api-try` - Basic try-catch blocks

## How to Use Going Forward

### For Development

1. **ESLint will catch missing awaits automatically**:
   ```bash
   npm run lint  # Shows API promise handling errors
   ```

2. **Use VS Code snippets**:
   - Type `api-useeffect` for loading data
   - Type `api-handler` for event handlers
   - Type `api-save` for save operations

3. **Follow the patterns in API_USAGE_GUIDE.md**

### For Code Reviews

Check that all API calls follow these patterns:
- [ ] All `*Api.*()` calls have `await` or are returned
- [ ] All `api.get/post/put/patch/delete()` calls have `await` or are returned  
- [ ] Functions calling API methods are marked `async`
- [ ] Error handling is in place with try/catch
- [ ] ESLint shows no `require-await-on-api-calls` errors

### Common Patterns

#### ✅ Loading Data in useEffect
```javascript
useEffect(() => {
  const loadData = async () => {
    try {
      setLoading(true);
      const result = await mediaCollectionsApi.list();
      setCollections(result.results || result);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  loadData();
}, []);
```

#### ✅ Event Handlers
```javascript
const handleSave = async () => {
  try {
    setSaving(true);
    const result = await mediaCollectionsApi.create(formData);
    onSuccess(result);
  } catch (error) {
    setError(error.message);
  } finally {
    setSaving(false);
  }
};
```

#### ✅ React Query
```javascript
const { data, isLoading, error } = useQuery({
  queryKey: ['collections'],
  queryFn: () => mediaCollectionsApi.list(), // Return promise directly
});
```

## Testing the Solution

The ESLint rule is currently detecting several existing issues:
- `src/api/tags.js:139` - Missing await in bulkDelete
- `src/components/LayoutSchemaManager.jsx:27` - Missing await on API calls
- `src/components/NamespaceManager.jsx:69` - Missing await on API call
- Multiple files in media components

## Benefits

1. **Automatic Detection**: ESLint catches missing awaits during development
2. **IDE Support**: TypeScript definitions provide better autocomplete
3. **Consistency**: Standardized patterns across the codebase
4. **Documentation**: Clear examples and guidelines
5. **Productivity**: VS Code snippets speed up development
6. **Quality**: Prevents silent failures and improves error handling

## Next Steps

1. Fix existing ESLint errors found by the new rule
2. Update team development workflow to include ESLint checks
3. Consider adding the rule to pre-commit hooks
4. Train team members on the new patterns and tools

This comprehensive solution ensures that API promise handling issues will be caught automatically and provides clear guidance for proper implementation patterns.
