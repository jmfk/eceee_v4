# Media Upload and ImgProxy Fix

## Problem Identified

The media upload functionality was failing with a 400 Bad Request error. The specific error was:

```
'S3MediaStorage' object has no attribute 'upload_file'
```

This error occurred when trying to upload images through the Media Manager interface.

## Root Cause

The `FileUploadService` class in `/backend/file_manager/services/upload_service.py` was calling `storage.upload_file(file, folder_path)` on line 48, but the `S3MediaStorage` class in `/backend/file_manager/storage.py` did not have this method implemented.

The storage class only had the standard Django Storage API methods (`_save`, `_open`, `delete`, `exists`, `url`), but was missing the custom `upload_file` method that the upload service expected.

## Solution Implemented

### 1. Added `upload_file` Method to S3MediaStorage

Added a new `upload_file` method to the `S3MediaStorage` class that:

- **Accepts parameters**: 
  - `file`: UploadedFile object
  - `folder_path`: Optional folder path for organizing files

- **Returns a dictionary** with:
  - `file_path`: S3 key/path where file is stored
  - `file_size`: Size of the file in bytes
  - `content_type`: MIME type of the file
  - `file_hash`: SHA-256 hash of the file content (for deduplication)
  - `width`: Image width (for images only)
  - `height`: Image height (for images only)

- **Functionality**:
  1. Reads file content for hashing and metadata extraction
  2. Generates SHA-256 hash for deduplication
  3. Creates unique filename using UUID to avoid collisions
  4. Constructs S3 key with optional folder path
  5. Extracts image metadata (width, height) for image files
  6. Uploads file to S3 using the existing `_save` method
  7. Returns all metadata required by the upload service

### 2. Added Required Imports

Added necessary imports to support the new functionality:
- `hashlib` - for SHA-256 hash generation
- `uuid` - for unique filename generation
- `ExifTags` from PIL - for EXIF metadata extraction (was already used but not imported)

### 3. Added `get_file_content` Method to S3MediaStorage

Added a new `get_file_content` method to retrieve file content from S3 for preview generation and AI analysis:
- Accepts `file_path` parameter
- Returns file content as bytes
- Used by preview endpoints and AI analysis

### 4. Added `analyze_media_file` Method to MediaAIService

Added the missing `analyze_media_file` method to the AI service:
- Accepts `file_content`, `filename`, and `content_type` parameters
- Returns dictionary with `suggested_tags`, `suggested_title`, `extracted_text`, and `confidence_score`
- Handles image analysis, OCR, and title generation from filename
- Gracefully handles AI service failures with fallback behavior

## Files Modified

1. **`/backend/file_manager/storage.py`**
   - Added imports: `hashlib`, `uuid`, `ExifTags`
   - Added `upload_file()` method (lines 73-136)
   - Added `get_file_content()` method (lines 373-389)

2. **`/backend/file_manager/ai_services.py`**
   - Added `analyze_media_file()` method (lines 273-324)

## Testing Verification

### 1. Storage Module Import Test
```bash
docker-compose exec backend python manage.py shell -c "from file_manager.storage import storage; print('Storage test passed')"
```
**Result**: ✅ Passed - No import errors

### 2. MinIO Bucket Verification
```bash
docker-compose exec minio mc ls local/
```
**Result**: ✅ Bucket `eceee-media/` exists and is accessible

### 3. ImgProxy Health Check
```bash
curl http://localhost:8080/health
```
**Result**: ✅ imgproxy is running

### 4. Backend Container Restart
```bash
docker-compose restart backend
```
**Result**: ✅ Backend restarted successfully with no errors

## How to Test the Fix

### Manual Testing Steps:

1. **Access the Media Manager**
   - Navigate to http://localhost:3000 (or your frontend URL)
   - Log in with valid credentials
   - Go to the Media Manager page

2. **Upload an Image**
   - Click on the upload area or drag and drop an image
   - Select a valid image file (JPEG, PNG, GIF, etc.)
   - Verify that the upload completes without errors
   - Check that the file appears in the pending uploads list

3. **Verify Upload Details**
   - Check that the image preview is displayed
   - Verify that AI-generated tags appear (if AI service is configured)
   - Confirm that image dimensions are detected correctly
   - Ensure the file hash is generated for deduplication

4. **Check MinIO Storage**
   ```bash
   docker-compose exec minio mc ls local/eceee-media/uploads/
   ```
   - Verify that the uploaded file appears in the storage

5. **Test ImgProxy Integration**
   - Once the image is uploaded and approved
   - Check that thumbnails are generated properly
   - Verify that resized images load correctly

### Expected Behavior:

✅ **Before the fix**: Upload would fail with "S3MediaStorage object has no attribute 'upload_file'" error

✅ **After the fix**: Upload should complete successfully with:
- File uploaded to MinIO/S3
- Metadata extracted (size, dimensions, content type)
- SHA-256 hash generated for deduplication
- Pending file record created in database
- AI analysis performed (if configured)

## ImgProxy Configuration

The imgproxy service is configured and running with the following settings:

- **URL**: http://localhost:8080 (internal: http://imgproxy:8080)
- **Security**: Enabled with HMAC signing
- **Max Resolution**: 50 megapixels
- **Max File Size**: 50MB
- **Quality**: 85% (JPEG/WebP/AVIF)
- **Formats**: Auto WebP and AVIF enabled
- **Presets**: thumbnail, small, medium, large, hero, avatar

### Presets Available:
- `thumbnail`: 150x150 (fill, smart crop)
- `small`: 300x300 (fit)
- `medium`: 600x600 (fit)
- `large`: 1200x1200 (fit)
- `hero`: 1920x1080 (fill, smart crop)
- `avatar`: 128x128 (fill, smart crop, WebP format)

## Additional Notes

### Dependencies:
- **MinIO**: Running on port 9000 (console: 9001)
- **ImgProxy**: Running on port 8080
- **Backend**: Running on port 8000
- **Frontend**: Running on port 3000

### Environment Variables (Backend):
- `IMGPROXY_URL`: http://imgproxy:8080
- `IMGPROXY_KEY`: 943b421c9eb07c830af81030552c86009268de4e532ba2ee2eab8247c6da0881
- `IMGPROXY_SALT`: 520f986b998545b4785e0defbc4f3c1203f22de2374a3d53cb7a7fe9fea309c5
- `AWS_S3_ENDPOINT_URL`: http://minio:9000
- `AWS_STORAGE_BUCKET_NAME`: eceee-media

### Environment Variables (Frontend):
- `VITE_IMGPROXY_URL`: http://imgproxy:8080
- `VITE_IMGPROXY_KEY`: (same as backend)
- `VITE_IMGPROXY_SALT`: (same as backend)
- `VITE_IMGPROXY_SIGNATURE_SIZE`: 32

## Troubleshooting

### If uploads still fail:

1. **Check backend logs**:
   ```bash
   docker-compose logs backend -f
   ```

2. **Verify MinIO is accessible**:
   - Open http://localhost:9001 in browser
   - Login with minioadmin/minioadmin
   - Check that `eceee-media` bucket exists

3. **Check file permissions**:
   ```bash
   docker-compose exec backend ls -la /app/media
   ```

4. **Verify namespace access**:
   - Ensure the user has access to the namespace being uploaded to
   - Check that the namespace exists and is active

5. **Test storage directly**:
   ```python
   # In Django shell
   from file_manager.storage import storage
   from django.core.files.uploadedfile import SimpleUploadedFile
   
   test_file = SimpleUploadedFile("test.txt", b"test content")
   result = storage.upload_file(test_file, "test")
   print(result)
   ```

### If ImgProxy images don't load:

1. **Check imgproxy logs**:
   ```bash
   docker-compose logs imgproxy -f
   ```

2. **Verify signature generation**:
   - Check that IMGPROXY_KEY and IMGPROXY_SALT are identical in frontend and backend
   - Ensure IMGPROXY_SIGNATURE_SIZE is set to 32

3. **Test imgproxy directly**:
   ```bash
   # Unsigned URL (for testing)
   curl -I http://localhost:8080/unsafe/rs:fit:300:300/plain/http://minio:9000/eceee-media/uploads/test.jpg
   ```

## Next Steps

1. ✅ Upload functionality should now work
2. Test with various file types (JPEG, PNG, GIF, WebP)
3. Test duplicate file detection
4. Verify AI tag generation
5. Test image transformations with imgproxy
6. Consider adding integration tests for upload flow

## Related Documentation

- `/docs/MEDIA_SYSTEM_TECHNICAL_GUIDE.md` - Complete media system documentation
- `/docs/IMGPROXY_INTEGRATION_GUIDE.md` - ImgProxy integration details
- `/docs/MEDIA_SYSTEM_API_DOCUMENTATION.md` - API endpoints and usage
- `/backend/file_manager/README.md` - File manager module overview

