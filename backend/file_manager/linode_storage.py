"""
Custom storage backend for Linode Object Storage.

Configured for boto3 1.26.137 (before flexible checksums) with public-read ACL.
"""

from storages.backends.s3boto3 import S3Boto3Storage


class LinodeObjectStorage(S3Boto3Storage):
    """
    Custom storage backend for Linode Object Storage.
    
    - Works with boto3 1.26.137 (before flexible checksums that broke Linode compatibility)
    - Uploads files with public-read ACL for direct access
    - Uses imgproxy-compatible URLs (s3:// protocol)
    """
    
    # Force public-read ACL on all uploads
    default_acl = 'public-read'
    
    # File settings
    file_overwrite = False
    
    # Object parameters for uploads
    object_parameters = {
        'CacheControl': 'max-age=86400',
        'ACL': 'public-read',
    }
    
    def url(self, name, parameters=None, expire=None, http_method=None):
        """
        Return S3 protocol URL for imgproxy compatibility.
        
        Returns s3://bucket/path instead of HTTPS URL so imgproxy can process it.
        """
        from django.conf import settings
        # Return S3 protocol URL that imgproxy understands
        return f"s3://{settings.AWS_STORAGE_BUCKET_NAME}/{name}"
