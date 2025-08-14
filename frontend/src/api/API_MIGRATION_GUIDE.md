# API Migration Guide: WebPage/PageVersion Separation

This guide documents the changes made to separate WebPageViewSet and PageVersionViewSet APIs and how to migrate your code.

## Overview of Changes

The API has been refactored to achieve complete separation between page and version management:

- **WebPageViewSet** now handles only WebPage operations (CRUD, hierarchy, publishing status)
- **PageVersionViewSet** now handles all version-related operations (creation, publishing, history)

## URL Changes

### Old (Deprecated) Endpoints

```javascript
// Old page-nested version endpoints (DEPRECATED)
GET /api/v1/webpages/pages/{id}/versions/
GET /api/v1/webpages/pages/{id}/versions/current/
GET /api/v1/webpages/pages/{id}/versions/latest/
GET /api/v1/webpages/pages/{id}/versions/{version_id}/
POST /api/v1/webpages/pages/{id}/publish/
POST /api/v1/webpages/pages/{id}/unpublish/
```

### New (Consistent Path-Based) Endpoints

```javascript
// New consistent path-based endpoints (no query strings)
GET /api/v1/webpages/pages/{id}/versions/                  // List versions for page
GET /api/v1/webpages/pages/{id}/versions/current/          // Current published version
GET /api/v1/webpages/pages/{id}/versions/latest/           // Latest version
GET /api/v1/webpages/pages/{id}/versions/{version_id}/     // Get specific version
GET /api/v1/webpages/versions/{version_id}/                // Direct version access
POST /api/v1/webpages/versions/{version_id}/publish/       // Publish version
POST /api/v1/webpages/versions/                            // Create new version
```

## Frontend API Changes

### Updated Methods

#### versions.js

```javascript
// OLD: Mixed query string approach
versionsApi.getPageVersionsList(pageId)  // Used inconsistent endpoints

// NEW: Consistent path-based endpoints
versionsApi.getPageVersionsList(pageId)      // Uses /pages/{id}/versions/
versionsApi.getVersionsForPage(pageId)       // Uses /pages/{id}/versions/
versionsApi.getCurrentVersionForPage(pageId) // Uses /pages/{id}/versions/current/
versionsApi.getLatestVersionForPage(pageId)  // Uses /pages/{id}/versions/latest/
```

#### pages.js

```javascript
// OLD: Mixed approach with query strings
pagesApi.versionCurrent(pageId)              // Used mixed query string approach
pagesApi.getVersion(pageId, versionId)       // Used inconsistent routing

// NEW: Consistent path-based endpoints
pagesApi.versionCurrent(pageId)              // Uses /pages/{id}/versions/current/
pagesApi.getVersion(pageId, versionId)       // Uses /pages/{id}/versions/{versionId}/
```

## Migration Steps

### 1. Update API Calls

Replace old page-nested version calls with new direct version calls:

```javascript
// OLD CODE
const currentVersion = await pagesApi.versionCurrent(pageId)
const versions = await versionsApi.getPageVersionsList(pageId)

// NEW CODE (same interface, updated implementation)
const currentVersion = await pagesApi.versionCurrent(pageId)
const versions = await versionsApi.getPageVersionsList(pageId)

// OR use new dedicated methods
const currentVersion = await versionsApi.getCurrentVersionForPage(pageId)
const versions = await versionsApi.getVersionsForPage(pageId)
```

### 2. Update Publishing Workflows

The publishing workflow has changed:

```javascript
// OLD: Page-level publishing
await pagesApi.publish(pageId)

// NEW: Version-level publishing
// 1. Create a version first
const version = await versionsApi.create({
    page: pageId,
    version_title: "Ready for publish",
    // ... other version data
})

// 2. Then publish the version
await versionsApi.publish(version.id)
```

### 3. Update Version Creation

Version creation is now explicit rather than automatic:

```javascript
// OLD: Automatic version creation on page update
await pagesApi.update(pageId, {
    title: "New Title",
    auto_publish: true,
    version_description: "Updated title"
})

// NEW: Explicit version creation
// 1. Update page metadata
await pagesApi.update(pageId, {
    title: "New Title"
})

// 2. Create version with content explicitly
const version = await versionsApi.create({
    page: pageId,
    version_title: "Updated title",
    // ... content data
})

// 3. Publish if needed
if (shouldPublish) {
    await versionsApi.publish(version.id)
}
```

## Backward Compatibility

- All old endpoints still work but emit deprecation warnings
- Frontend API methods have been updated to use new endpoints internally
- Existing component code should continue to work without changes
- Deprecation warnings will be visible in browser console

## Timeline

- **Phase 1-3**: New endpoints available, old endpoints deprecated
- **Phase 4-6**: Frontend migration and testing
- **6 months**: Old endpoints will be removed (sunset date TBD)

## Benefits

1. **Clean Separation**: Clear boundaries between page and version management
2. **Better Performance**: Direct version queries avoid page-version joins
3. **Improved Scalability**: Each viewset can be optimized independently
4. **Cleaner Code**: Reduced coupling and clearer responsibilities
5. **Better Testing**: Each viewset can be tested in isolation

## Breaking Changes (Future)

When legacy endpoints are removed (6+ months), these changes will be breaking:

1. Direct calls to deprecated endpoints will return 404
2. Any hardcoded URLs in components will need updating
3. Custom API clients outside our wrapper functions will need updating

## Getting Help

- Check the browser console for deprecation warnings
- Refer to the new endpoint documentation in `endpoints.js`
- Ask the development team for migration assistance
- Test thoroughly using the new endpoints before legacy removal
