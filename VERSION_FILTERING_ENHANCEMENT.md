# Version Filtering Enhancement

## Overview

Enhanced the Page Structure Query Library to include version information when querying pages. Both backend (Python) and frontend (TypeScript) implementations have been updated with identical APIs.

## Changes Made

### 1. New Types

#### Backend (`structure_types.py`)
```python
class VersionFilter(str, Enum):
    """Filter for which version to retrieve"""
    CURRENT_PUBLISHED = "current_published"  # Currently live version
    LATEST = "latest"  # Most recent version regardless of status
    LATEST_DRAFT = "latest_draft"  # Most recent draft version
    LATEST_PUBLISHED = "latest_published"  # Most recent published (current or expired)
```

#### Frontend (`pageStructure.ts`)
```typescript
export enum VersionFilter {
    CURRENT_PUBLISHED = 'current_published',
    LATEST = 'latest',
    LATEST_DRAFT = 'latest_draft',
    LATEST_PUBLISHED = 'latest_published'
}
```

### 2. Updated PageMetadata

Added optional `version` field to `PageMetadata`:

```typescript
export interface PageMetadata {
    // ... existing fields ...
    version?: VersionMetadata | null  // Included when version_filter is provided
}
```

### 3. Updated Methods

#### Backend Methods
```python
# structure_helpers.py
def get_page_by_id(
    self, 
    page_id: int, 
    version_filter: Optional[VersionFilter] = None
) -> Optional[PageMetadata]:
    """Get page with optional version info"""
    
def get_page_by_path(
    self,
    path: str,
    hostname: Optional[str] = None,
    version_filter: Optional[VersionFilter] = None,
) -> Optional[PageMetadata]:
    """Get page by path with optional version info"""
```

#### Frontend Methods
```typescript
// pageStructure.ts
async getPageById(
    pageId: number, 
    versionFilter?: VersionFilter
): Promise<PageMetadata | null>

async getPageByPath(
    path: string, 
    hostname?: string, 
    versionFilter?: VersionFilter
): Promise<PageMetadata | null>
```

### 4. React Hooks Updated
```typescript
// usePageStructure.ts
usePageMetadata(
    pageId: number | null, 
    versionFilter?: VersionFilter
): UseQueryResult<PageMetadata | null>

usePageByPath(
    path: string | null,
    hostname?: string,
    versionFilter?: VersionFilter
): UseQueryResult<PageMetadata | null>
```

### 5. API Endpoints Updated

Both endpoints now accept `version_filter` query parameter:
- `GET /api/webpages/pages/{page_id}/metadata/?version_filter=current_published`
- `GET /api/webpages/pages/by-path/?path=/about&version_filter=latest`

## Usage Examples

### Backend (Python)

```python
from webpages.structure_helpers import get_structure_helpers
from webpages.structure_types import VersionFilter

helpers = get_structure_helpers()

# Get page with current published version
page = helpers.get_page_by_id(123, version_filter=VersionFilter.CURRENT_PUBLISHED)
if page.version:
    print(f"Page: {page.title}")
    print(f"Version: {page.version.version_number}")
    print(f"Status: {page.version.status}")
    print(f"Layout: {page.version.code_layout}")

# Get page with latest version (including drafts)
page = helpers.get_page_by_id(123, version_filter=VersionFilter.LATEST)
if page.version:
    print(f"Latest version: {page.version.version_number}")
    print(f"Is draft: {page.version.effective_date is None}")

# Get page with latest draft version
page = helpers.get_page_by_id(123, version_filter=VersionFilter.LATEST_DRAFT)
if page.version:
    print(f"Draft version: {page.version.version_number}")

# Get page by path with version
page = helpers.get_page_by_path(
    "/about/team", 
    version_filter=VersionFilter.CURRENT_PUBLISHED
)
if page and page.version:
    print(f"Page {page.title} is using layout {page.version.code_layout}")

# Get page without version (backward compatible)
page = helpers.get_page_by_id(123)  # No version included
```

### Frontend (React)

```typescript
import { usePageMetadata } from '@/hooks/usePageStructure'
import { VersionFilter } from '@/types/pageStructure'

function PageEditor({ pageId }) {
    // Get page with current published version
    const { data: page, isLoading } = usePageMetadata(
        pageId, 
        VersionFilter.CURRENT_PUBLISHED
    )
    
    if (isLoading) return <Spinner />
    
    return (
        <div>
            <h1>{page?.title}</h1>
            {page?.version && (
                <div className="version-info">
                    <p>Version: {page.version.version_number}</p>
                    <p>Status: {page.version.status}</p>
                    <p>Layout: {page.version.code_layout}</p>
                    <p>Theme: {page.version.theme_name}</p>
                    {page.version.effective_date && (
                        <p>Published: {new Date(page.version.effective_date).toLocaleDateString()}</p>
                    )}
                </div>
            )}
        </div>
    )
}

function DraftEditor({ pageId }) {
    // Get page with latest draft version
    const { data: page } = usePageMetadata(
        pageId,
        VersionFilter.LATEST_DRAFT
    )
    
    return (
        <div>
            <h1>Editing Draft</h1>
            {page?.version ? (
                <div>
                    <p>Draft Version: {page.version.version_number}</p>
                    <p>Created: {new Date(page.version.created_at).toLocaleDateString()}</p>
                </div>
            ) : (
                <p>No draft version exists</p>
            )}
        </div>
    )
}

function PageVersionCompare({ pageId }) {
    // Get published and latest versions
    const { data: published } = usePageMetadata(
        pageId,
        VersionFilter.CURRENT_PUBLISHED
    )
    
    const { data: latest } = usePageMetadata(
        pageId,
        VersionFilter.LATEST
    )
    
    const hasChanges = published?.version?.version_number !== latest?.version?.version_number
    
    return (
        <div>
            <h2>Version Comparison</h2>
            {hasChanges ? (
                <div className="alert alert-info">
                    <p>There are unpublished changes</p>
                    <p>Published: v{published?.version?.version_number}</p>
                    <p>Latest: v{latest?.version?.version_number}</p>
                </div>
            ) : (
                <p>No unpublished changes</p>
            )}
        </div>
    )
}
```

### Frontend (Direct API Calls)

```typescript
import { getPageById, getPageByPath } from '@/utils/pageStructure'
import { VersionFilter } from '@/types/pageStructure'

async function loadPageData(pageId: number) {
    // Get page with current published version
    const page = await getPageById(pageId, VersionFilter.CURRENT_PUBLISHED)
    
    if (page?.version) {
        console.log('Page:', page.title)
        console.log('Version:', page.version.version_number)
        console.log('Layout:', page.version.code_layout)
        console.log('Status:', page.version.status)
    }
}

async function checkForDraft(pageId: number) {
    // Check if page has a draft version
    const page = await getPageById(pageId, VersionFilter.LATEST_DRAFT)
    
    if (page?.version) {
        console.log('Draft exists:', page.version.version_number)
        return true
    }
    
    console.log('No draft version')
    return false
}

async function getPageWithLatest(path: string) {
    // Get page by path with latest version
    const page = await getPageByPath(
        path, 
        undefined,  // no hostname 
        VersionFilter.LATEST
    )
    
    return page
}
```

## Version Filter Behavior

### CURRENT_PUBLISHED
- Returns the currently active published version
- Must have `effective_date <= now`
- Must have `expiry_date > now` or `expiry_date` is null
- Returns `null` if no published version exists

### LATEST
- Returns the most recent version by version_number
- Includes draft versions (no effective_date)
- Includes scheduled versions (effective_date in future)
- Includes expired versions
- Always returns a version if page has any versions

### LATEST_DRAFT
- Returns the most recent draft version (effective_date is null)
- Returns `null` if no draft versions exist
- Useful for checking if unpublished changes exist

### LATEST_PUBLISHED
- Returns the most recent version with effective_date set
- Includes current, scheduled, and expired versions
- Returns `null` if no published versions exist (only drafts)

## Backward Compatibility

All methods remain backward compatible:
- If `version_filter` is not provided, `page.version` will be `null`
- Existing code without version filtering continues to work unchanged
- New code can optionally request version information

## Benefits

1. **Single API Call**: Get page and version data together (no separate requests)
2. **Flexible Filtering**: Choose exactly which version you need
3. **Type Safety**: Full TypeScript support for version data
4. **Consistent API**: Backend and frontend work identically
5. **Performance**: Optimized queries fetch related data efficiently
6. **Caching**: React Query caches results by version_filter

## Use Cases

1. **Content Editors**: View current published version while editing
2. **Draft Management**: Check for unpublished changes
3. **Version History**: Display version information alongside page data
4. **Publishing Workflow**: Compare drafts with published versions
5. **Preview Mode**: Show latest changes before publishing
6. **Admin Dashboards**: Display version status for pages

## Migration Notes

No migration required! This is a backward-compatible enhancement:

```python
# Old code (still works)
page = helpers.get_page_by_id(123)
# page.version is None

# New code (optionally get version)
page = helpers.get_page_by_id(123, version_filter=VersionFilter.CURRENT_PUBLISHED)
# page.version contains VersionMetadata if published version exists
```

## Files Modified

### Backend
- `backend/webpages/structure_types.py` - Added `VersionFilter` enum
- `backend/webpages/structure_helpers.py` - Updated query methods, added `_get_version_by_filter()`
- `backend/webpages/api_structure_views.py` - Updated API endpoints to accept `version_filter`

### Frontend
- `frontend/src/types/pageStructure.ts` - Added `VersionFilter` enum
- `frontend/src/utils/pageStructure.ts` - Updated helper methods
- `frontend/src/hooks/usePageStructure.ts` - Updated React hooks

## Testing

Test all version filters:

```python
# Backend tests
def test_version_filtering():
    helpers = get_structure_helpers()
    
    # Test current published
    page = helpers.get_page_by_id(1, VersionFilter.CURRENT_PUBLISHED)
    assert page.version is not None
    assert page.version.status == VersionStatus.CURRENT
    
    # Test latest
    page = helpers.get_page_by_id(1, VersionFilter.LATEST)
    assert page.version is not None
    
    # Test latest draft
    page = helpers.get_page_by_id(1, VersionFilter.LATEST_DRAFT)
    # May be None if no drafts exist
    
    # Test no filter (backward compatibility)
    page = helpers.get_page_by_id(1)
    assert page.version is None
```

## Summary

This enhancement provides a powerful, flexible way to include version information when querying pages, with full backward compatibility and identical APIs across backend and frontend. The implementation supports all common use cases for content management and publishing workflows.

