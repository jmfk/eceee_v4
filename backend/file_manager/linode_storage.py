"""
Custom storage backend for Linode Object Storage.

Configured for boto3 1.26.137 (before flexible checksums) with public-read ACL.
"""

from storages.backends.s3boto3 import S3Boto3Storage
from django.conf import settings


class LinodeObjectStorage(S3Boto3Storage):
    """
    Custom storage backend for Linode Object Storage.
    
    - Works with boto3 1.26.137 (before flexible checksums that broke Linode compatibility)
    - Uploads files with public-read ACL for direct access
    - Returns s3:// protocol URLs for imgproxy
    """
    
    # Force public-read ACL on all uploads
    default_acl = 'public-read'
    
    # Don't sign URLs - use direct s3:// protocol for imgproxy
    querystring_auth = False
    
    # File settings
    file_overwrite = False
    
    # Object parameters for uploads
    object_parameters = {
        'CacheControl': 'max-age=86400',
        'ACL': 'public-read',
    }
    
    # Custom domain uses s3:// protocol for imgproxy
    custom_domain = None
    
    def __init__(self, **settings_dict):
        super().__init__(**settings_dict)
        # Disable URL signing globally
        self.querystring_auth = False
    
    def url(self, name, parameters=None, expire=None, http_method=None):
        """
        Return S3 protocol URL for imgproxy.
        
        imgproxy connects to S3 using its own credentials, so we return
        s3://bucket/path format instead of HTTPS URLs.
        """
        # Clean the name (remove any leading slashes)
        name = name.lstrip('/')
        
        # Return S3 protocol URL
        bucket = settings.AWS_STORAGE_BUCKET_NAME
        return f"s3://{bucket}/{name}"
