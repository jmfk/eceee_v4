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
    - Disables signed URLs since files are public
    """
    
    # Force public-read ACL on all uploads
    default_acl = 'public-read'
    
    # Don't use signed URLs - files are public
    querystring_auth = False
    
    # File settings
    file_overwrite = False
    
    # Object parameters for uploads
    object_parameters = {
        'CacheControl': 'max-age=86400',
        'ACL': 'public-read',
    }
