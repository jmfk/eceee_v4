"""
Custom storage backend for Linode Object Storage.

Configured for boto3 1.26.137 (before flexible checksums) with s3:// URLs for imgproxy.
"""

from storages.backends.s3boto3 import S3Boto3Storage
from django.conf import settings


class LinodeObjectStorage(S3Boto3Storage):
    """
    Custom storage backend for Linode Object Storage.
    
    - Works with boto3 1.26.137 (before flexible checksums)
    - Returns s3:// protocol URLs for imgproxy to process
    - imgproxy uses its own S3 credentials to fetch files
    """
    
    def url(self, name, parameters=None, expire=None, http_method=None):
        """
        Return S3 protocol URL for imgproxy.
        
        Instead of returning HTTPS URLs (which would need to be public or signed),
        we return s3://bucket/path URLs that imgproxy can access using its
        configured S3 credentials.
        """
        # Clean the name (remove any leading slashes)
        name = name.lstrip('/')
        
        # Get bucket name from settings
        bucket = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'eceee-media')
        
        # Return S3 protocol URL that imgproxy understands
        return f"s3://{bucket}/{name}"
