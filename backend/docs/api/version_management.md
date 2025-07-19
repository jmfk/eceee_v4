# Page Version Management API

The Page Version Management system provides comprehensive version control for web pages, supporting draft/published workflows, version comparison, restoration, and complete audit trails.

## Overview

The versioning system enables:
- **Draft/Published Workflow**: Create drafts, publish them, and manage version states
- **Version Comparison**: Compare changes between any two versions
- **Version Restoration**: Restore any previous version as the current state
- **Complete Audit Trail**: Track all changes with user attribution and timestamps
- **Advanced Filtering**: Find versions by status, date ranges, users, and more

## Data Models

### PageVersion

The core model that stores page version data:

```python
class PageVersion(models.Model):
    page = models.ForeignKey(WebPage, on_delete=models.CASCADE)
    version_number = models.PositiveIntegerField()
    description = models.TextField()
    page_data = models.JSONField()  # Complete page state snapshot
    is_current = models.BooleanField(default=False)
    
    # Status tracking
    status = models.CharField(max_length=20, choices=VERSION_STATUS_CHOICES, default='draft')
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    
    # Publishing fields
    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey(User, null=True, blank=True, related_name='published_versions')
    
    # Change tracking
    change_summary = models.JSONField(default=dict, blank=True)
```

### Version Status Choices

- `draft`: Version is in draft state, not live
- `published`: Version is published and live
- `archived`: Version is archived (future use)

## API Endpoints

### Base URL
All version endpoints are under: `/api/webpages/versions/`

### 1. List Versions

**GET** `/api/webpages/versions/`

Lists all page versions with extensive filtering options.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | Integer | Filter by page ID |
| `page_title` | String | Filter by page title (case-insensitive) |
| `page_slug` | String | Filter by page slug (case-insensitive) |
| `status` | String | Filter by version status (`draft`, `published`, `archived`) |
| `status_in` | String | Comma-separated list of statuses |
| `is_current` | Boolean | Filter by current version status |
| `version_number` | Integer | Filter by exact version number |
| `version_number_gte` | Integer | Filter versions >= number |
| `version_number_lte` | Integer | Filter versions <= number |
| `created_after` | DateTime | Filter versions created after date |
| `created_before` | DateTime | Filter versions created before date |
| `created_on_date` | Date | Filter versions created on specific date |
| `published_after` | DateTime | Filter versions published after date |
| `published_before` | DateTime | Filter versions published before date |
| `published_on_date` | Date | Filter versions published on specific date |
| `is_published` | Boolean | Filter by published status |
| `created_by` | String | Filter by creator username (case-insensitive) |
| `published_by` | String | Filter by publisher username (case-insensitive) |
| `has_drafts` | Boolean | Filter pages that have draft versions |
| `has_published` | Boolean | Filter pages that have published versions |
| `needs_publish` | Boolean | Filter pages with unpublished changes |

#### Example Response

```json
{
    "count": 25,
    "next": "http://localhost:8000/api/webpages/versions/?page=2",
    "previous": null,
    "results": [
        {
            "id": 1,
            "page": {
                "id": 1,
                "title": "Homepage",
                "slug": "homepage"
            },
            "version_number": 3,
            "description": "Updated hero section",
            "status": "published",
            "is_current": true,
            "created_at": "2024-01-15T10:30:00Z",
            "created_by": {
                "id": 1,
                "username": "admin"
            },
            "published_at": "2024-01-15T11:00:00Z",
            "published_by": {
                "id": 1,
                "username": "admin"
            },
            "change_summary": {
                "fields_changed": ["content"],
                "widgets_modified": 1
            }
        }
    ]
}
```

### 2. Get Version Details

**GET** `/api/webpages/versions/{id}/`

Retrieves detailed information about a specific version.

#### Response

```json
{
    "id": 1,
    "page": {
        "id": 1,
        "title": "Homepage",
        "slug": "homepage",
        "layout": {
            "id": 1,
            "name": "Main Layout"
        },
        "theme": {
            "id": 1,
            "name": "Default Theme"
        }
    },
    "version_number": 3,
    "description": "Updated hero section",
    "page_data": {
        "title": "Homepage",
        "description": "Welcome to our site",
        "content": "Updated content here...",
        "widgets": [
            {
                "id": 1,
                "widget_type_id": 1,
                "slot_name": "hero",
                "sort_order": 0,
                "configuration": {
                    "title": "Welcome",
                    "content": "Updated hero content"
                }
            }
        ]
    },
    "status": "published",
    "is_current": true,
    "created_at": "2024-01-15T10:30:00Z",
    "created_by": {
        "id": 1,
        "username": "admin",
        "email": "admin@example.com"
    },
    "published_at": "2024-01-15T11:00:00Z",
    "published_by": {
        "id": 1,
        "username": "admin"
    },
    "change_summary": {
        "fields_changed": ["content"],
        "widgets_modified": 1,
        "summary": "Updated hero section content"
    }
}
```

### 3. Create Version

**POST** `/api/webpages/versions/`

Creates a new version of a page. Note: This is typically done automatically when updating pages, but can be called directly for manual version creation.

#### Request Body

```json
{
    "page": 1,
    "description": "Manual version creation",
    "status": "draft"
}
```

#### Response

Returns the created version object (same format as GET details).

### 4. Publish Version

**POST** `/api/webpages/versions/{id}/publish/`

Publishes a draft version, making it the current live version.

#### Response

```json
{
    "message": "Published version 3",
    "version": {
        "id": 1,
        "version_number": 3,
        "status": "published",
        "is_current": true,
        "published_at": "2024-01-15T11:00:00Z",
        "published_by": {
            "id": 1,
            "username": "admin"
        }
    }
}
```

### 5. Create Draft from Published

**POST** `/api/webpages/versions/{id}/create_draft/`

Creates a new draft version based on a published version.

#### Request Body

```json
{
    "description": "New draft for upcoming changes"
}
```

#### Response

```json
{
    "message": "Created draft version 4 from published version 3",
    "version": {
        "id": 2,
        "version_number": 4,
        "status": "draft",
        "is_current": false,
        "description": "New draft for upcoming changes"
    }
}
```

### 6. Restore Version

**POST** `/api/webpages/versions/{id}/restore/`

Restores a version as the current state of the page. This creates a new version based on the restored version's data.

#### Response

```json
{
    "message": "Restored page from version 2",
    "new_version": {
        "id": 3,
        "version_number": 5,
        "description": "Restored from version 2"
    }
}
```

### 7. Compare Versions

**GET** `/api/webpages/versions/compare/?version1={id}&version2={id}`

Compares two versions and returns detailed information about changes.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `version1` | Integer | Yes | ID of first version |
| `version2` | Integer | Yes | ID of second version |

#### Response

```json
{
    "version1": {
        "id": 1,
        "version_number": 2,
        "description": "Original version",
        "created_at": "2024-01-15T10:00:00Z"
    },
    "version2": {
        "id": 2,
        "version_number": 3,
        "description": "Updated version", 
        "created_at": "2024-01-15T11:00:00Z"
    },
    "changes": {
        "fields_changed": [
            {
                "field": "title",
                "old_value": "Old Title",
                "new_value": "New Title"
            },
            {
                "field": "content",
                "old_value": "Old content...",
                "new_value": "New content..."
            }
        ],
        "widgets_added": [
            {
                "slot_name": "sidebar",
                "widget_type_id": 2,
                "configuration": {
                    "title": "New Widget"
                }
            }
        ],
        "widgets_removed": [
            {
                "slot_name": "footer", 
                "widget_type_id": 1,
                "configuration": {
                    "title": "Old Widget"
                }
            }
        ],
        "widgets_modified": [
            {
                "old": {
                    "slot_name": "hero",
                    "configuration": {
                        "title": "Old Hero"
                    }
                },
                "new": {
                    "slot_name": "hero", 
                    "configuration": {
                        "title": "New Hero"
                    }
                }
            }
        ]
    }
}
```

## Page Model Integration

The versioning system integrates seamlessly with the WebPage model through helper methods:

### WebPage Helper Methods

```python
# Get current published version (marked as is_current=True)
current_version = page.get_current_version()

# Get latest published version by version number
latest_published = page.get_latest_published_version()

# Get latest draft version
latest_draft = page.get_latest_draft()

# Check if page has unpublished changes
has_changes = page.has_unpublished_changes()

# Create a new version
version = page.create_version(
    user=request.user,
    description="Updated content",
    status="draft",  # or "published"
    auto_publish=False  # Set to True to publish immediately
)
```

#### Version Retrieval Methods Explained

- **`get_current_version()`**: Returns the published version marked as `is_current=True` (the currently active live version)
- **`get_latest_published_version()`**: Returns the published version with the highest version number (most recently published)
- **`get_latest_draft()`**: Returns the draft version with the highest version number (most recent draft)

**Note**: `get_current_version()` and `get_latest_published_version()` may return different versions if multiple published versions exist and an older one is marked as current.

### Automatic Version Creation

Versions are automatically created when:

1. **Page Updates**: Any update to a WebPage via the API creates a draft version
2. **Widget Changes**: Adding, removing, or modifying widgets creates a version
3. **Publishing**: Using the publish endpoint creates a published version

### Auto-Publish Option

When updating pages via API, you can include:

```json
{
    "title": "Updated Title",
    "auto_publish": true,
    "version_description": "Updated title and published"
}
```

This will create a published version immediately instead of a draft.

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
    "error": "Cannot create draft from non-published version"
}
```

#### 404 Not Found
```json
{
    "error": "One or both versions not found"
}
```

#### 403 Forbidden
```json
{
    "error": "Permission denied to publish versions"
}
```

## Usage Examples

### Frontend Integration

```javascript
// Get all versions for a page
const versions = await getPageVersions(pageId, {
    status: 'draft',
    created_after: '2024-01-01'
});

// Publish a draft version
await publishVersion(versionId);

// Create a draft from published version
await createDraftFromPublished(publishedVersionId, "New draft description");

// Compare two versions
const comparison = await compareVersions(version1Id, version2Id);

// Restore an old version
await restoreVersion(oldVersionId);
```

### Backend Usage

```python
from webpages.models import WebPage, PageVersion

# Get page and create version
page = WebPage.objects.get(id=1)
version = page.create_version(
    user=request.user,
    description="Major content update",
    auto_publish=True
)

# Get different types of versions
current = page.get_current_version()  # Currently active published version
latest_published = page.get_latest_published_version()  # Most recent published version
latest_draft = page.get_latest_draft()  # Most recent draft

# Check for unpublished changes
if page.has_unpublished_changes():
    print("Page has draft versions newer than published")

# Compare versions
v1 = PageVersion.objects.get(id=1)
v2 = PageVersion.objects.get(id=2) 
changes = v2.compare_with(v1)

# Publish a draft
draft = PageVersion.objects.get(id=3, status='draft')
published = draft.publish(request.user)
```

## Performance Considerations

1. **Page Data Storage**: Complete page state is stored in JSON for each version
2. **Indexing**: Indexes on `page`, `status`, `is_current`, and `created_at` for fast queries
3. **Filtering**: Advanced filtering is optimized for common use cases
4. **Pagination**: All list endpoints support pagination to handle large datasets

## Security & Permissions

- **Authentication Required**: All endpoints require user authentication
- **Version Creation**: Any authenticated user can create versions
- **Publishing**: Publishing permissions can be restricted based on user roles
- **Data Integrity**: Version data is immutable once created
- **Audit Trail**: All changes are tracked with user attribution

This comprehensive version management system provides enterprise-level version control capabilities for the eceee_v4 page management platform. 