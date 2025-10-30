# Theme Images Object Storage Permissions

## Overview

Theme preview images are stored in the `theme_images/` folder in object storage and need to be publicly accessible for display in the frontend theme selector.

## Problem

By default, the `LinodeObjectStorage` backend returns `s3://bucket/path` URLs for imgproxy compatibility. However, theme images need direct browser access via HTTPS URLs.

## Solution Implemented

### 1. Public URL Method
Added `get_public_url()` method to `LinodeObjectStorage` class that returns proper HTTPS URLs:
- Custom domain (CDN): `https://{custom_domain}/{path}`
- Linode Object Storage: `https://{endpoint}/{bucket}/{path}`
- AWS S3: `https://{bucket}.s3.{region}.amazonaws.com/{path}`

### 2. Serializer Update
Updated `PageThemeSerializer` to convert `s3://` URLs to public HTTPS URLs automatically.

## Required Object Storage Configuration

### Option 1: Public Bucket (Recommended for theme images)

Configure your object storage bucket to allow public read access:

**Linode Object Storage:**
```bash
# Using s3cmd or AWS CLI
s3cmd setacl s3://eceee-v4-media/theme_images/ --acl-public --recursive

# Or set bucket policy
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadThemeImages",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::eceee-v4-media/theme_images/*"
    }
  ]
}
```

### Option 2: Default ACL Setting

Set in your production settings (e.g., `settings_production.py`):

```python
# Make all uploaded files public by default
AWS_DEFAULT_ACL = 'public-read'
```

**Note:** This makes ALL uploaded files public. For more granular control, use Option 1.

### Option 3: Upload-time ACL

Modify the upload code to set ACL when saving theme images:

```python
# In PageTheme model or view
theme.image.storage.object_parameters = {'ACL': 'public-read'}
```

## Testing

After configuring permissions, verify theme images are accessible:

```bash
# Get a theme with an image
curl http://localhost:8000/api/webpages/themes/

# Check the image URL in the response - should be HTTPS, not s3://
# Example expected URL:
# "image": "https://us-east-1.linodeobjects.com/eceee-v4-media/theme_images/image.png"

# Test direct access
curl -I https://us-east-1.linodeobjects.com/eceee-v4-media/theme_images/image.png
# Should return 200 OK, not 403 Forbidden
```

## Development Environment (MinIO)

For local development with MinIO, the default configuration should work:
- MinIO URL: `http://minio:9000/eceee-media/theme_images/image.png`
- MinIO defaults to public access for testing

## Troubleshooting

### Images return 403 Forbidden
- Check bucket/object ACL settings
- Verify `AWS_DEFAULT_ACL` in settings
- Check object storage bucket policy

### Images still show s3:// URLs
- Restart Django server after code changes
- Clear any API response caches
- Check that `LinodeObjectStorage` is the active storage backend

### CORS errors in browser
Add CORS configuration to your object storage bucket:
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

