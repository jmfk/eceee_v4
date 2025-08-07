# API Separation Guide: Page vs Version Data

## Overview

The eceee_v4 API has been refactored to cleanly separate page metadata from version content. This provides a cleaner, more intuitive API structure and better performance.

## New API Structure

### 1. Page Metadata Endpoint
**GET `/api/v1/webpages/pages/{id}/`**

Returns only page-level metadata (no version content):
```json
{
  "id": 64,
  "slug": "about",
  "parent": {...},
  "sort_order": 1,
  "hostnames": [],
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-02T00:00:00Z",
  "created_by": {...},
  "last_modified_by": {...},
  "absolute_url": "/about/",
  "is_published": true,
  "breadcrumbs": [...],
  "effective_layout": {...},
  "effective_theme": {...},
  "layout_type": "code",
  "layout_inheritance_info": {...},
  "available_code_layouts": [...],
  "children_count": 3
}
```

### 2. Current Version Endpoint
**GET `/api/v1/webpages/pages/{id}/versions/current/`**

Returns the current published version data:
```json
{
  "id": 123,
  "page": {...},
  "version_number": 5,
  "version_title": "Latest content update",
  "title": "About Us",
  "page_data": {
    "title": "About Us",
    "description": "Learn about our organization",
    "meta_title": "About Us - Company Name",
    "meta_description": "...",
    "meta_keywords": "..."
  },
  "widgets": {
    "main": [...],
    "sidebar": [...]
  },
  "code_layout": "two_column",
  "theme": {...},
  "page_css_variables": {...},
  "page_custom_css": "...",
  "enable_css_injection": true,
  "effective_date": "2025-01-01T00:00:00Z",
  "expiry_date": null,
  "change_summary": {...},
  "is_published": true,
  "is_current_published": true,
  "publication_status": "published",
  "created_at": "2025-01-01T00:00:00Z",
  "created_by": {...}
}
```

### 3. Latest Version Endpoint
**GET `/api/v1/webpages/pages/{id}/versions/latest/`**

Returns the latest version (regardless of publication status) - useful for editing.

## Frontend Implementation

### Before (Single Request)
```javascript
// Old way - everything in one request
const pageData = await api.get(`/api/v1/webpages/pages/${id}/`);
// Mixed page + version data in single response
```

### After (Separated Requests)
```javascript
// New way - clean separation
const [page, currentVersion] = await Promise.all([
  api.get(`/api/v1/webpages/pages/${id}/`),
  api.get(`/api/v1/webpages/pages/${id}/versions/current/`)
]);

// page: contains metadata (layout, theme, hierarchy, etc.)
// currentVersion: contains content (title, widgets, CSS, etc.)
```

## Benefits

### 1. **Cleaner API Design**
- Clear separation of concerns
- Page metadata vs. content data
- More intuitive endpoint structure

### 2. **Better Performance**
- Smaller payloads when only metadata is needed
- Ability to cache page metadata separately from content
- More efficient for page navigation/tree views

### 3. **Improved Frontend Architecture**
- Separate state management for page vs. version data
- Better component separation
- More efficient re-renders

### 4. **Enhanced Developer Experience**
- Clear data boundaries
- Easier to understand and debug
- Better TypeScript typing possibilities

## Migration Strategy

### Phase 1: Parallel Endpoints (Current)
- New simplified endpoints available
- Legacy endpoint maintained for backward compatibility
- Frontend can migrate gradually

### Phase 2: Frontend Migration
- Update frontend to use new endpoints
- Test thoroughly with both approaches
- Update documentation and examples

### Phase 3: Legacy Deprecation
- Mark legacy endpoint as deprecated
- Provide migration timeline
- Eventually remove legacy endpoint

## Backward Compatibility

### Legacy Full Data Endpoint
**GET `/api/v1/webpages/pages/{id}/full/`**

Maintains the old behavior by returning combined page + version data. Use this during migration to ensure existing code continues working.

## API Reference

### Page Endpoints
- `GET /api/v1/webpages/pages/` - List pages (metadata only)
- `GET /api/v1/webpages/pages/{id}/` - Get page metadata
- `PUT /api/v1/webpages/pages/{id}/` - Update page metadata
- `GET /api/v1/webpages/pages/{id}/full/` - **LEGACY** - Full data

### Version Endpoints
- `GET /api/v1/webpages/pages/{id}/versions/current/` - Current published version
- `GET /api/v1/webpages/pages/{id}/versions/latest/` - Latest version (any status)
- `GET /api/v1/webpages/versions/` - List all versions
- `GET /api/v1/webpages/versions/{id}/` - Get specific version

## Implementation Details

### New Serializers
- `WebPageSimpleSerializer` - Page metadata only
- `PageVersionDetailSerializer` - Complete version data
- `WebPageDetailSerializer` - **LEGACY** - Combined data

### Performance Considerations
- Page metadata can be cached longer (changes less frequently)
- Version data cache can be more granular
- Reduced data transfer for navigation-heavy operations

### TypeScript Types
```typescript
interface PageMetadata {
  id: number;
  slug: string;
  parent?: PageMetadata;
  sort_order: number;
  hostnames: string[];
  is_published: boolean;
  // ... other metadata
}

interface PageVersion {
  id: number;
  version_number: number;
  title: string;
  page_data: {
    title: string;
    description: string;
    meta_title?: string;
    meta_description?: string;
    meta_keywords?: string;
  };
  widgets: Record<string, Widget[]>;
  // ... other version data
}
```

## Testing

All endpoints maintain the same authentication and permission requirements. The separation is purely structural and doesn't affect security or access control.
