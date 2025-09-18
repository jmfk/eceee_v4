# Media File Management System

This module provides a comprehensive system for managing media files with advanced features like soft deletion, reference tracking, AI-powered analysis, and S3 storage integration.

## Core Features

### 1. Soft Delete with Reference Tracking
- Files are never immediately deleted from storage
- Files marked as "deleted" remain accessible if referenced in content
- Reference counting tracks usage across different content types
- Automatic cleanup of unreferenced files after configurable period

### 2. S3 Storage Integration
- Secure file uploads with pre-signed URLs
- Automatic file type validation
- Metadata extraction
- File deduplication
- Access control with configurable ACLs

### 3. AI-Powered Analysis (Optional)
- Content analysis for images
- Automatic tag suggestions
- Title generation from content
- Text extraction (OCR)
- Configurable confidence thresholds

## Architecture

### Models

#### `MediaFile`
- Core model for storing file metadata
- Tracks references, usage, and soft delete status
- Fields:
  ```python
  # File information
  original_filename = models.CharField(max_length=255)
  file_path = models.CharField(max_length=500)
  file_size = models.BigIntegerField()
  content_type = models.CharField(max_length=100)
  file_hash = models.CharField(max_length=64)

  # Reference tracking
  reference_count = models.PositiveIntegerField(default=0)
  referenced_in = models.JSONField(default=dict)

  # Soft delete
  is_deleted = models.BooleanField(default=False)
  deleted_at = models.DateTimeField(null=True)
  deleted_by = models.ForeignKey(User, null=True)
  ```

#### `MediaTag` and `MediaCollection`
- Organization and categorization
- Namespace support for multi-tenant setups
- Access control with visibility levels

### Storage System

The `S3MediaStorage` class provides:
- File upload/download handling
- URL generation (public and signed)
- File type validation
- Metadata extraction
- Deduplication via content hashing

```python
storage = S3MediaStorage()
url = storage.generate_signed_url('path/to/file.jpg', expires=3600)
```

### AI Integration

The `MediaAIService` provides AI-powered features (optional):
```python
ai_service = MediaAIService()
analysis = ai_service.analyze_image_content(image_bytes)
tags = ai_service.suggest_tags_from_content(text)
```

- Configurable via settings:
  ```python
  AI_SERVICE_API_KEY = 'your-api-key'  # Optional
  AI_SERVICE_URL = 'https://api.example.com'
  AI_CONFIDENCE_THRESHOLD = 0.7
  AI_CACHE_TIMEOUT = 3600
  ```

## Reference Tracking

### How It Works
1. When content includes a media file, it's tracked via `add_reference`:
   ```python
   media_file.add_reference('webpage', page_id)
   ```

2. References are stored in a JSON field:
   ```json
   {
     "webpage": ["123", "456"],
     "blog_post": ["789"]
   }
   ```

3. When content is deleted, references are removed:
   ```python
   media_file.remove_reference('webpage', page_id)
   ```

### Deletion Protection
- Files with `reference_count > 0` cannot be soft-deleted
- Force delete available for admin users
- Automatic cleanup of unreferenced files via Celery task

## Usage Examples

### 1. Upload and Process File
```python
# Upload file
file = MediaFile.objects.create(
    file=uploaded_file,
    namespace=namespace
)

# AI analysis (if configured)
analysis = ai_service.analyze_file_complete_workflow(
    file.file.read(),
    file.original_filename,
    namespace.id
)

# Update with AI results
file.ai_generated_tags = analysis['tags']
file.ai_extracted_text = analysis['extracted_text']
file.save()
```

### 2. Reference in Content
```python
# Add reference when using file
file.add_reference('webpage', page.id)

# Remove reference when content is deleted
file.remove_reference('webpage', page.id)
```

### 3. Soft Delete
```python
# Attempt to delete
success = file.delete(user=request.user)

if not success:
    # File is still referenced
    references = file.get_references()
```

## Configuration

### Required Settings
```python
AWS_STORAGE_BUCKET_NAME = 'your-bucket'
AWS_S3_REGION_NAME = 'us-east-1'
AWS_ACCESS_KEY_ID = 'your-key'
AWS_SECRET_ACCESS_KEY = 'your-secret'
```

### Optional Settings
```python
AI_SERVICE_API_KEY = 'your-api-key'
AI_SERVICE_URL = 'https://api.example.com'
AI_CONFIDENCE_THRESHOLD = 0.7
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_FILE_TYPES = {
    'image': ['image/jpeg', 'image/png'],
    'document': ['application/pdf']
}
```

## Maintenance

### Cleanup Task
A Celery task runs daily to clean up soft-deleted files:
```python
@shared_task
def cleanup_deleted_files(days=30, batch_size=100):
    """Remove soft-deleted files after specified days."""
```

### Health Checks
- Monitor reference integrity
- Track storage usage
- Validate file accessibility
- Check AI service status (if configured)

## Security

- File type validation
- Size limits
- Access control via ACLs
- Signed URLs for private content
- Namespace isolation
- User action tracking

## Best Practices

1. **Reference Management**
   - Always remove references when content is deleted
   - Use transactions when updating references
   - Regularly verify reference integrity

2. **Storage**
   - Use content hashing for deduplication
   - Implement proper error handling
   - Monitor storage usage

3. **AI Features**
   - Handle AI service unavailability gracefully
   - Cache AI results when possible
   - Validate AI suggestions before applying

4. **Performance**
   - Use appropriate indexes
   - Implement caching strategies
   - Handle large files appropriately
   - Use batch processing for bulk operations
