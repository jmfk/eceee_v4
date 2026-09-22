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
POST /api/v1/webpages/pages/{page_id}/working-copy/        // Get or create the working copy
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
// 1. Get the page's canonical working copy and save it
const { version } = await versionsApi.getOrCreateWorkingCopy(pageId)
const saved = await versionsApi.saveWorkingCopy(version.id, changes, version.updatedAt)

// 2. Then publish the version
await versionsApi.publish(saved.id, saved.updatedAt)
```

### 3. Update Working Copies

Direct version creation has been removed. All edits use the page's canonical working copy:

```javascript
// OLD: Automatic version creation on page update
await pagesApi.update(pageId, {
    title: "New Title",
    auto_publish: true,
    version_description: "Updated title"
})

// NEW: Get and save the canonical working copy
const { version } = await versionsApi.getOrCreateWorkingCopy(pageId)
const saved = await versionsApi.saveWorkingCopy(
    version.id,
    { pageData: { pageAttributes: { title: "New Title" } } },
    version.updatedAt,
)

// 2. Publish if needed
if (shouldPublish) {
    await versionsApi.publish(saved.id, saved.updatedAt)
}
```

## Backward Compatibility

`POST /api/v1/webpages/versions/` now returns `405 Method Not Allowed`. Reload an
open editor after deployment so it uses the working-copy workflow.

## Benefits

1. **Clean Separation**: Clear boundaries between page and version management
2. **Better Performance**: Direct version queries avoid page-version joins
3. **Improved Scalability**: Each viewset can be optimized independently
4. **Cleaner Code**: Reduced coupling and clearer responsibilities
5. **Better Testing**: Each viewset can be tested in isolation

## Breaking Changes

1. Direct version-creation requests now return `405 Method Not Allowed`.
2. External clients must use `working-copy/` followed by the conflict-checked `save/` action.
3. Editor tabs opened before the application-version monitor was deployed need one manual reload.

## Getting Help

- Check the API error response and the browser console
- Refer to the new endpoint documentation in `endpoints.js`
- Ask the development team for migration assistance
- Test creation, saving, and publishing through the working-copy endpoints
