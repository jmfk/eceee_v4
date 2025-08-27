# API Usage Guide - CRITICAL: Always Await API Calls

## ⚠️ IMPORTANT: All API Functions Return Promises

**Every API function in this project returns a Promise that MUST be awaited or handled with `.then()`**

## Common Patterns

### ✅ CORRECT Usage

```javascript
// 1. Using await (preferred)
const handleLoadData = async () => {
  try {
    const result = await mediaCollectionsApi.list();
    setData(result.results || result);
  } catch (error) {
    console.error('Failed to load data:', error);
  }
};

// 2. Using .then() chain
const handleLoadData = () => {
  mediaCollectionsApi.list()
    .then(result => {
      setData(result.results || result);
    })
    .catch(error => {
      console.error('Failed to load data:', error);
    });
};

// 3. Returning the promise (for React Query, etc.)
const fetchData = () => {
  return mediaCollectionsApi.list(); // Promise is returned, will be awaited by caller
};
```

### ❌ INCORRECT Usage (Will Cause Bugs)

```javascript
// DON'T DO THIS - Missing await
const handleLoadData = async () => {
  const result = mediaCollectionsApi.list(); // ❌ This returns a Promise, not data!
  setData(result.results); // ❌ Will fail - result is a Promise object
};

// DON'T DO THIS - Not handling the promise
const handleLoadData = () => {
  mediaCollectionsApi.list(); // ❌ Promise is ignored, data is never processed
  // Component will never update with new data
};
```

## API Function Categories

### 1. Wrapped API Functions (via wrapApiCall)
All functions in these modules return Promises:
- `mediaCollectionsApi.*`
- `mediaTagsApi.*` 
- `pagesApi.*`
- `versionsApi.*`
- `contentApi.*`
- `publishingApi.*`

```javascript
// Examples - ALL require await
await mediaCollectionsApi.list();
await mediaCollectionsApi.create(data);
await mediaTagsApi.getOrCreate(tagName);
await pagesApi.get(pageId);
await versionsApi.publish(versionId);
```

### 2. Raw API Client Methods
Direct axios calls also return Promises:
- `api.get()`
- `api.post()`
- `api.put()`
- `api.patch()`
- `api.delete()`

```javascript
// Examples - ALL require await
await api.get('/api/v1/some-endpoint/');
await api.post('/api/v1/create/', data);
```

## React Component Patterns

### Loading Data in useEffect

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

### Event Handlers

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

### React Query Integration

```javascript
const { data, isLoading, error } = useQuery({
  queryKey: ['collections'],
  queryFn: () => mediaCollectionsApi.list(), // Return promise directly
});
```

## Error Handling

All API functions use consistent error handling via `wrapApiCall`. Errors are already processed and include:
- Meaningful error messages
- Proper HTTP status codes
- Context about the failed operation

```javascript
try {
  await mediaCollectionsApi.create(data);
} catch (error) {
  // error.message contains user-friendly message
  // error.status contains HTTP status code
  // error.details contains additional context
  console.error('API Error:', error);
}
```

## ESLint Rule

We have an ESLint rule that will catch missing `await` keywords:
- Rule: `api-rules/require-await-on-api-calls`
- Automatically suggests adding `await`
- Catches both `*Api.*()` and `api.*()` patterns

## Quick Checklist

Before submitting code, verify:
- [ ] All `*Api.*()` calls have `await` or are returned
- [ ] All `api.get/post/put/patch/delete()` calls have `await` or are returned  
- [ ] Functions calling API methods are marked `async`
- [ ] Error handling is in place with try/catch
- [ ] ESLint shows no `require-await-on-api-calls` errors

## Common Mistakes to Avoid

1. **Forgetting async/await in event handlers**
   ```javascript
   // ❌ Wrong
   const handleClick = () => {
     const result = await api.get('/data/'); // SyntaxError!
   };
   
   // ✅ Correct  
   const handleClick = async () => {
     const result = await api.get('/data/');
   };
   ```

2. **Not awaiting in loops**
   ```javascript
   // ❌ Wrong - promises run in parallel, not sequentially
   items.forEach(async (item) => {
     await api.post('/process/', item);
   });
   
   // ✅ Correct - sequential processing
   for (const item of items) {
     await api.post('/process/', item);
   }
   
   // ✅ Correct - parallel processing
   await Promise.all(items.map(item => api.post('/process/', item)));
   ```

3. **Missing error handling**
   ```javascript
   // ❌ Wrong - unhandled promise rejection
   const result = await api.get('/data/');
   
   // ✅ Correct
   try {
     const result = await api.get('/data/');
   } catch (error) {
     console.error('Failed to load data:', error);
   }
   ```

Remember: **When in doubt, add `await`!** All our API functions are asynchronous.
