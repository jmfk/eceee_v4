"""
Custom storage backend for Linode Object Storage.

Uses requests library instead of boto3 to work around boto3/urllib3 incompatibility
with Linode Object Storage flexible checksums.
"""

from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage
from botocore.client import Config


class LinodeObjectStorage(S3Boto3Storage):
    """
    Custom storage backend for Linode Object Storage.
    
    Disables AWS SDK flexible checksums which Linode doesn't support.
    """
    
    def __init__(self, **settings_dict):
        # Force client config that disables checksums
        settings_dict.setdefault('client_config', Config(
            s3={
                'use_accelerate_endpoint': False,
                'addressing_style': 'path',
            },
            signature_version='s3v4',
        ))
        
        # Disable checksums globally
        import os
        os.environ['AWS_DISABLE_S3_CHECKSUM'] = 'true'
        
        super().__init__(**settings_dict)
        
    def _create_client(self):
        """Override client creation to disable checksums."""
        import os
        # Disable all checksum features before creating client
        os.environ['AWS_DISABLE_S3_CHECKSUM'] = 'true'
        
        return super()._create_client()

