# API Refactoring Migration Guide

This guide explains how to migrate from the old scattered API approach to the new unified API client system.

## Overview

The new unified API system provides:
- ✅ Centralized endpoint management
- ✅ Consistent error handling
- ✅ Standardized response processing
- ✅ Better type safety and documentation
- ✅ No more hardcoded URLs scattered throughout components

## Migration Patterns

### 1. Import Changes

**Old:**
```javascript
import { api } from '../api/client.js'
// Hardcoded endpoints in components
const response = await api.get('/api/v1/webpages/pages/')
```

**New:**
```javascript
import { pagesApi } from '../api'
// or 
import api from '../api' // Then use api.pages.list()

const response = await pagesApi.list()
```

### 2. Component Updates

**Old Component Pattern:**
```javascript
// Multiple hardcoded API calls scattered in component
const fetchPages = async () => {
    try {
        setLoading(true)
        const response = await api.get('/api/v1/webpages/pages/')
        setPages(response.data)
    } catch (error) {
        setError(error.message) // Inconsistent error handling
    } finally {
        setLoading(false)
    }
}

const publishPage = async (pageId) => {
    try {
        const response = await api.post(`/api/v1/webpages/pages/${pageId}/publish/`)
        // Handle success
    } catch (error) {
        // Custom error handling
    }
}
```

**New Component Pattern:**
```javascript
import { pagesApi, publishingApi } from '../api'

const fetchPages = async () => {
    try {
        setLoading(true)
        const pages = await pagesApi.list() // Consistent response processing
        setPages(pages)
    } catch (error) {
        setError(error.message) // Standardized error handling
    } finally {
        setLoading(false)
    }
}

const publishPage = async (pageId) => {
    try {
        await publishingApi.publishPage(pageId) // Semantic API names
        // Handle success
    } catch (error) {
        // Consistent error handling
    }
}
```

### 3. Direct fetch() Calls

**Old:**
```javascript
// Direct fetch calls bypassing the axios client
const response = await fetch('/api/v1/webpages/widget-types/?include_template_json=true')
const data = await response.json()
```

**New:**
```javascript
import { widgetsApi } from '../api'

const data = await widgetsApi.getTypes(true) // includeTemplateJson = true
```

### 4. LayoutRenderer Updates

**Old:**
```javascript
// In LayoutRenderer.js
this.widgetTypesPromise = fetch('/api/v1/webpages/widget-types/?include_template_json=true')
    .then(response => response.json())
```

**New:**
```javascript
import { widgetsApi } from '../api'

// In LayoutRenderer.js
this.widgetTypesPromise = widgetsApi.getTypes(true)
```

## Component Migration Checklist

For each component that needs migration:

1. ✅ **Replace hardcoded URLs** with centralized API calls
2. ✅ **Remove manual error handling** (now handled by wrapApiCall)
3. ✅ **Update imports** to use the new API modules
4. ✅ **Remove manual response.data extraction** (handled automatically)
5. ✅ **Use semantic API method names** instead of generic HTTP verbs

## Benefits After Migration

1. **DRY Principle**: No more repeated endpoint URLs
2. **Error Consistency**: All API errors handled uniformly
3. **Maintainability**: Single place to update API endpoints
4. **Type Safety**: Better IntelliSense and error checking
5. **Testing**: Easier to mock API calls in tests
6. **Performance**: Automatic response caching where appropriate

## Available API Modules

- `pagesApi` - Page CRUD operations, publishing, object linking
- `versionsApi` - Version management, draft/published workflow
- `widgetsApi` - Widget operations, types, reordering
- `layoutsApi` - Layout operations, JSON configs
- `themesApi` - Theme management
- `namespacesApi` - Namespace operations
- `contentApi` - Content object operations
- `publishingApi` - Bulk publishing, scheduling operations

## Backward Compatibility

Legacy function exports are maintained for gradual migration:
```javascript
// These still work during migration period
import { getRootPages, createPage } from '../api/pages.js'
```

But prefer the new API structure:
```javascript
import { pagesApi } from '../api'
// pagesApi.getRootPages(), pagesApi.create()
```