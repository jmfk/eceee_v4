# Media System API Documentation

> **Comprehensive API Reference for eceee_v4 Media Management System**  
> **Version**: 1.0  
> **Last Updated**: December 2024  
> **Base URL**: `/api/v1/media/`

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Media Files API](#media-files-api)
4. [Collections API](#collections-api)
5. [Tags API](#tags-api)
6. [Search API](#search-api)
7. [Upload API](#upload-api)
8. [Bulk Operations API](#bulk-operations-api)
9. [AI Services API](#ai-services-api)
10. [Error Handling](#error-handling)
11. [Rate Limiting](#rate-limiting)
12. [Examples](#examples)

## 🎯 Overview

The Media System API provides comprehensive endpoints for managing media files, collections, tags, and AI-powered content analysis. It supports S3-compatible storage, automatic thumbnail generation, and intelligent tagging.

### Key Features
- **File Management**: Upload, retrieve, update, and delete media files
- **Collections**: Organize media files into logical groups
- **Tags**: Categorize and search media with flexible tagging
- **AI Integration**: Automatic content analysis and tag suggestions
- **Bulk Operations**: Efficient batch processing for multiple files
- **Search**: Advanced search with filtering and sorting capabilities
- **Thumbnails**: Automatic generation for images and videos
- **Namespace Support**: Multi-tenant media organization

### Supported File Types
- **Images**: JPEG, PNG, GIF, WebP, SVG
- **Videos**: MP4, WebM, AVI, MOV
- **Documents**: PDF, DOC, DOCX, TXT
- **Audio**: MP3, WAV, OGG

## 🔐 Authentication

All API endpoints require authentication using Token-based authentication.

```http
Authorization: Token your-api-token-here
```

### Getting a Token
```bash
curl -X POST /api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "your-username", "password": "your-password"}'
```

## 📁 Media Files API

### List Media Files

```http
GET /api/v1/media/files/
```

**Query Parameters:**
- `search` (string): Search in title, description, and tags
- `file_type` (string): Filter by MIME type (e.g., 'image', 'video')
- `tags` (string): Filter by tag names (comma-separated)
- `collection` (uuid): Filter by collection ID
- `namespace` (uuid): Filter by namespace ID
- `ordering` (string): Sort by field (`created_at`, `-created_at`, `file_size`, `title`)
- `page` (integer): Page number for pagination
- `page_size` (integer): Number of items per page (max 100)

**Response:**
```json
{
  "count": 150,
  "next": "http://api.example.com/media/files/?page=2",
  "previous": null,
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Hero Banner Image",
      "slug": "hero-banner-image",
      "description": "Main banner image for homepage",
      "file_url": "https://cdn.example.com/media/hero-banner.jpg",
      "file_type": "image/jpeg",
      "file_size": 2048576,
      "file_size_display": "2.0 MB",
      "width": 1920,
      "height": 1080,
      "duration": null,
      "is_image": true,
      "is_video": false,
      "is_audio": false,
      "uploaded_by": {
        "id": 1,
        "username": "admin",
        "email": "admin@example.com"
      },
      "namespace": {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "name": "Main Site",
        "slug": "main-site"
      },
      "tags": [
        {
          "id": "789e0123-e45b-67c8-d901-234567890123",
          "name": "hero",
          "slug": "hero"
        },
        {
          "id": "456e7890-e12b-34c5-d678-901234567890",
          "name": "banner",
          "slug": "banner"
        }
      ],
      "collections": [
        {
          "id": "321e6543-e09b-87c6-d543-210987654321",
          "title": "Homepage Assets",
          "slug": "homepage-assets"
        }
      ],
      "thumbnails": {
        "small": "https://cdn.example.com/media/thumbnails/hero-banner_small.jpg",
        "medium": "https://cdn.example.com/media/thumbnails/hero-banner_medium.jpg",
        "large": "https://cdn.example.com/media/thumbnails/hero-banner_large.jpg"
      },
      "metadata": {
        "exif": {
          "camera": "Canon EOS R5",
          "lens": "RF 24-70mm F2.8 L IS USM",
          "iso": 100,
          "aperture": "f/8.0",
          "shutter_speed": "1/125"
        },
        "color_profile": "sRGB",
        "has_transparency": false
      },
      "ai_analysis": {
        "suggested_tags": ["landscape", "nature", "outdoor"],
        "confidence": 0.92,
        "extracted_text": "",
        "description": "A scenic landscape with mountains and blue sky"
      },
      "usage_count": 3,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T14:22:00Z"
    }
  ]
}
```

### Get Media File

```http
GET /api/v1/media/files/{id}/
```

**Response:** Single media file object (same structure as list item above)

### Create Media File

```http
POST /api/v1/media/files/
```

**Request Body:**
```json
{
  "title": "New Image",
  "slug": "new-image",
  "description": "Description of the new image",
  "file_url": "https://cdn.example.com/media/new-image.jpg",
  "file_type": "image/jpeg",
  "file_size": 1024576,
  "width": 1200,
  "height": 800,
  "namespace": "123e4567-e89b-12d3-a456-426614174000",
  "tags": ["tag1", "tag2"],
  "collections": ["321e6543-e09b-87c6-d543-210987654321"]
}
```

**Response:** Created media file object (201 Created)

### Update Media File

```http
PUT /api/v1/media/files/{id}/
PATCH /api/v1/media/files/{id}/
```

**Request Body:** Same as create, all fields optional for PATCH

**Response:** Updated media file object (200 OK)

### Delete Media File

```http
DELETE /api/v1/media/files/{id}/
```

**Response:** 204 No Content

### Get Media File Usage

```http
GET /api/v1/media/files/{id}/usage/
```

**Response:**
```json
{
  "usage_count": 5,
  "used_in": [
    {
      "content_type": "webpage",
      "object_id": "page-123",
      "title": "Homepage",
      "url": "/pages/homepage/",
      "usage_context": "Featured Image"
    },
    {
      "content_type": "widget",
      "object_id": "widget-456",
      "title": "Hero Banner Widget",
      "usage_context": "Background Image"
    }
  ]
}
```

## 📚 Collections API

### List Collections

```http
GET /api/v1/media/collections/
```

**Query Parameters:**
- `search` (string): Search in title and description
- `namespace` (uuid): Filter by namespace ID
- `ordering` (string): Sort by field (`title`, `created_at`, `file_count`)

**Response:**
```json
{
  "count": 25,
  "results": [
    {
      "id": "321e6543-e09b-87c6-d543-210987654321",
      "title": "Homepage Assets",
      "slug": "homepage-assets",
      "description": "All media files used on the homepage",
      "file_count": 12,
      "total_size": 15728640,
      "total_size_display": "15.0 MB",
      "created_by": {
        "id": 1,
        "username": "admin"
      },
      "namespace": {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "name": "Main Site"
      },
      "created_at": "2024-01-10T09:00:00Z",
      "updated_at": "2024-01-15T16:30:00Z"
    }
  ]
}
```

### Create Collection

```http
POST /api/v1/media/collections/
```

**Request Body:**
```json
{
  "title": "New Collection",
  "slug": "new-collection",
  "description": "Description of the new collection",
  "namespace": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Add Files to Collection

```http
POST /api/v1/media/collections/{id}/add-files/
```

**Request Body:**
```json
{
  "file_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ]
}
```

### Remove Files from Collection

```http
POST /api/v1/media/collections/{id}/remove-files/
```

**Request Body:**
```json
{
  "file_ids": [
    "550e8400-e29b-41d4-a716-446655440000"
  ]
}
```

## 🏷️ Tags API

### List Tags

```http
GET /api/v1/media/tags/
```

**Query Parameters:**
- `search` (string): Search in tag names
- `namespace` (uuid): Filter by namespace ID
- `min_usage` (integer): Minimum usage count
- `ordering` (string): Sort by field (`name`, `usage_count`, `-usage_count`)

**Response:**
```json
{
  "count": 50,
  "results": [
    {
      "id": "789e0123-e45b-67c8-d901-234567890123",
      "name": "hero",
      "slug": "hero",
      "description": "Hero images and banners",
      "color": "#3B82F6",
      "usage_count": 15,
      "namespace": {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "name": "Main Site"
      },
      "created_at": "2024-01-05T12:00:00Z"
    }
  ]
}
```

### Create Tag

```http
POST /api/v1/media/tags/
```

**Request Body:**
```json
{
  "name": "new-tag",
  "description": "Description of the new tag",
  "color": "#10B981",
  "namespace": "123e4567-e89b-12d3-a456-426614174000"
}
```

## 🔍 Search API

### Advanced Search

```http
GET /api/v1/media/search/
```

**Query Parameters:**
- `q` (string): Full-text search query
- `file_type` (string): Filter by file type category
- `tags` (string): Tag names (comma-separated)
- `collections` (string): Collection IDs (comma-separated)
- `date_from` (date): Filter files created after this date
- `date_to` (date): Filter files created before this date
- `size_min` (integer): Minimum file size in bytes
- `size_max` (integer): Maximum file size in bytes
- `has_ai_analysis` (boolean): Filter files with AI analysis
- `namespace` (uuid): Filter by namespace ID
- `ordering` (string): Sort field with direction

**Response:** Same structure as media files list

### Search Suggestions

```http
GET /api/v1/media/search/suggestions/
```

**Query Parameters:**
- `q` (string): Partial search query

**Response:**
```json
{
  "suggestions": [
    {
      "type": "tag",
      "value": "hero",
      "count": 15
    },
    {
      "type": "title",
      "value": "Hero Banner Image",
      "file_id": "550e8400-e29b-41d4-a716-446655440000"
    },
    {
      "type": "collection",
      "value": "Homepage Assets",
      "collection_id": "321e6543-e09b-87c6-d543-210987654321"
    }
  ]
}
```

## 📤 Upload API

### Single File Upload

```http
POST /api/v1/media/upload/
```

**Request:** Multipart form data
- `file` (file): The file to upload
- `title` (string, optional): Custom title
- `description` (string, optional): File description
- `namespace` (uuid, optional): Target namespace
- `tags` (string, optional): Comma-separated tag names
- `collection` (uuid, optional): Target collection ID
- `generate_ai_tags` (boolean, optional): Enable AI tag generation (default: true)

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "uploaded-image.jpg",
  "file_url": "https://cdn.example.com/media/uploaded-image.jpg",
  "file_type": "image/jpeg",
  "file_size": 1024576,
  "thumbnails": {
    "small": "https://cdn.example.com/media/thumbnails/uploaded-image_small.jpg",
    "medium": "https://cdn.example.com/media/thumbnails/uploaded-image_medium.jpg"
  },
  "ai_suggestions": {
    "suggested_title": "Beautiful Landscape Photo",
    "suggested_tags": ["landscape", "nature", "outdoor"],
    "confidence": 0.89,
    "extracted_text": ""
  },
  "upload_progress": 100,
  "processing_status": "completed"
}
```

### Bulk Upload

```http
POST /api/v1/media/bulk-upload/
```

**Request:** Multipart form data
- `files` (file[]): Multiple files to upload
- `namespace` (uuid, optional): Target namespace
- `collection` (uuid, optional): Target collection ID
- `generate_ai_tags` (boolean, optional): Enable AI tag generation

**Response:**
```json
{
  "uploaded_files": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "file1.jpg",
      "status": "success",
      "file_url": "https://cdn.example.com/media/file1.jpg"
    },
    {
      "id": null,
      "title": "file2.jpg",
      "status": "error",
      "error": "File type not supported"
    }
  ],
  "success_count": 1,
  "error_count": 1,
  "total_size": 2048576
}
```

### Upload Progress

```http
GET /api/v1/media/upload/{upload_id}/progress/
```

**Response:**
```json
{
  "upload_id": "upload-123",
  "progress": 75,
  "status": "uploading",
  "bytes_uploaded": 768000,
  "total_bytes": 1024000,
  "estimated_time_remaining": 5,
  "current_file": "large-video.mp4"
}
```

## 🔄 Bulk Operations API

### Bulk Tag Files

```http
POST /api/v1/media/bulk-tag/
```

**Request Body:**
```json
{
  "file_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ],
  "tag_ids": [
    "789e0123-e45b-67c8-d901-234567890123"
  ],
  "action": "add"  // or "remove"
}
```

### Bulk Move to Collection

```http
POST /api/v1/media/bulk-move-to-collection/
```

**Request Body:**
```json
{
  "file_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ],
  "collection_id": "321e6543-e09b-87c6-d543-210987654321",
  "action": "add"  // "add", "remove", or "move"
}
```

### Bulk Delete

```http
POST /api/v1/media/bulk-delete/
```

**Request Body:**
```json
{
  "file_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ],
  "confirm": true
}
```

**Response:**
```json
{
  "deleted_count": 2,
  "failed_deletions": [],
  "freed_space": 3072000,
  "freed_space_display": "3.0 MB"
}
```

## 🤖 AI Services API

### Analyze File Content

```http
POST /api/v1/media/ai/analyze/{file_id}/
```

**Request Body:**
```json
{
  "services": ["content_analysis", "text_extraction", "tag_suggestion"],
  "confidence_threshold": 0.7
}
```

**Response:**
```json
{
  "analysis_id": "analysis-123",
  "file_id": "550e8400-e29b-41d4-a716-446655440000",
  "content_analysis": {
    "description": "A scenic mountain landscape with blue sky and clouds",
    "objects_detected": ["mountain", "sky", "clouds", "trees"],
    "scene_type": "outdoor_landscape",
    "confidence": 0.92
  },
  "text_extraction": {
    "extracted_text": "Welcome to Mountain View Resort",
    "language": "en",
    "confidence": 0.88
  },
  "tag_suggestions": {
    "suggested_tags": ["landscape", "mountain", "nature", "outdoor", "resort"],
    "confidence_scores": {
      "landscape": 0.95,
      "mountain": 0.92,
      "nature": 0.89,
      "outdoor": 0.87,
      "resort": 0.76
    }
  },
  "processing_time": 2.3,
  "created_at": "2024-01-15T15:30:00Z"
}
```

### Generate Title and Slug

```http
POST /api/v1/media/ai/generate-metadata/
```

**Request Body:**
```json
{
  "filename": "IMG_20240115_mountain_sunset.jpg",
  "content_description": "A beautiful sunset over mountain peaks",
  "existing_tags": ["landscape", "sunset"]
}
```

**Response:**
```json
{
  "suggested_title": "Mountain Sunset Landscape",
  "suggested_slug": "mountain-sunset-landscape",
  "suggested_description": "A breathtaking sunset view over majestic mountain peaks, showcasing nature's beauty in golden hour lighting.",
  "confidence": 0.87
}
```

### Batch AI Analysis

```http
POST /api/v1/media/ai/batch-analyze/
```

**Request Body:**
```json
{
  "file_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ],
  "services": ["content_analysis", "tag_suggestion"],
  "priority": "normal"  // "low", "normal", "high"
}
```

**Response:**
```json
{
  "batch_id": "batch-456",
  "status": "queued",
  "total_files": 2,
  "estimated_completion": "2024-01-15T15:45:00Z",
  "progress_url": "/api/v1/media/ai/batch-analyze/batch-456/progress/"
}
```

## ❌ Error Handling

### Standard Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The provided data is invalid",
    "details": {
      "file_type": ["This file type is not supported"],
      "file_size": ["File size exceeds maximum limit of 100MB"]
    },
    "timestamp": "2024-01-15T15:30:00Z",
    "request_id": "req-123456"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request data validation failed |
| `AUTHENTICATION_REQUIRED` | 401 | Valid authentication token required |
| `PERMISSION_DENIED` | 403 | Insufficient permissions for operation |
| `NOT_FOUND` | 404 | Requested resource not found |
| `FILE_TOO_LARGE` | 413 | File exceeds maximum size limit |
| `UNSUPPORTED_FILE_TYPE` | 415 | File type not supported |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests in time window |
| `STORAGE_ERROR` | 500 | File storage operation failed |
| `AI_SERVICE_ERROR` | 502 | AI analysis service unavailable |
| `PROCESSING_ERROR` | 500 | File processing failed |

## ⏱️ Rate Limiting

### Limits by Endpoint Type

| Endpoint Type | Limit | Window |
|---------------|-------|---------|
| **File Upload** | 50 requests | 1 hour |
| **Bulk Operations** | 10 requests | 1 hour |
| **AI Analysis** | 100 requests | 1 hour |
| **Search/List** | 1000 requests | 1 hour |
| **CRUD Operations** | 500 requests | 1 hour |

### Rate Limit Headers

```http
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 47
X-RateLimit-Reset: 1642262400
X-RateLimit-Type: upload
```

## 📝 Examples

### Complete Upload and Tag Workflow

```javascript
// 1. Upload file
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('namespace', namespaceId);
formData.append('generate_ai_tags', 'true');

const uploadResponse = await fetch('/api/v1/media/upload/', {
  method: 'POST',
  headers: {
    'Authorization': 'Token your-token-here'
  },
  body: formData
});

const uploadedFile = await uploadResponse.json();

// 2. Apply AI-suggested tags
const tagResponse = await fetch(`/api/v1/media/files/${uploadedFile.id}/`, {
  method: 'PATCH',
  headers: {
    'Authorization': 'Token your-token-here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tags: uploadedFile.ai_suggestions.suggested_tags
  })
});

// 3. Add to collection
await fetch(`/api/v1/media/collections/${collectionId}/add-files/`, {
  method: 'POST',
  headers: {
    'Authorization': 'Token your-token-here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    file_ids: [uploadedFile.id]
  })
});
```

### Advanced Search with Filters

```javascript
const searchParams = new URLSearchParams({
  q: 'landscape nature',
  file_type: 'image',
  tags: 'outdoor,scenic',
  date_from: '2024-01-01',
  size_min: '1000000',  // 1MB minimum
  has_ai_analysis: 'true',
  ordering: '-created_at',
  page_size: '20'
});

const response = await fetch(`/api/v1/media/search/?${searchParams}`, {
  headers: {
    'Authorization': 'Token your-token-here'
  }
});

const searchResults = await response.json();
```

### Bulk Operations Example

```javascript
// Select multiple files and perform bulk operations
const selectedFileIds = [
  '550e8400-e29b-41d4-a716-446655440000',
  '660e8400-e29b-41d4-a716-446655440001',
  '770e8400-e29b-41d4-a716-446655440002'
];

// Bulk tag assignment
await fetch('/api/v1/media/bulk-tag/', {
  method: 'POST',
  headers: {
    'Authorization': 'Token your-token-here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    file_ids: selectedFileIds,
    tag_ids: ['789e0123-e45b-67c8-d901-234567890123'],
    action: 'add'
  })
});

// Bulk move to collection
await fetch('/api/v1/media/bulk-move-to-collection/', {
  method: 'POST',
  headers: {
    'Authorization': 'Token your-token-here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    file_ids: selectedFileIds,
    collection_id: '321e6543-e09b-87c6-d543-210987654321',
    action: 'add'
  })
});
```

---

## 📞 Support

For API support and questions:
- **Documentation**: [Media System User Guide](./MEDIA_SYSTEM_USER_GUIDE.md)
- **Issues**: Create an issue in the project repository
- **Email**: support@eceee.example.com

## 📄 License

This API documentation is part of the eceee_v4 project and follows the same license terms.
