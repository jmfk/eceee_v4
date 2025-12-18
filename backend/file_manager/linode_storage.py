"""
Custom storage backend for Linode Object Storage.

Configured for boto3 1.26.137 (before flexible checksums) with s3:// URLs for imgproxy.
Files are uploaded with public-read ACL to allow direct browser access.
"""

from storages.backends.s3boto3 import S3Boto3Storage
from django.conf import settings


class LinodeObjectStorage(S3Boto3Storage):
    """
    Custom storage backend for Linode Object Storage.

    - Works with boto3 1.26.137 (before flexible checksums)
    - Returns s3:// protocol URLs for imgproxy to process
    - Files are uploaded with public-read ACL for direct browser access
    - imgproxy uses its own S3 credentials to fetch files
    """
    
    def __init__(self, *args, **kwargs):
        """Initialize storage with public-read ACL for theme images."""
        super().__init__(*args, **kwargs)
        # Override default ACL to public-read for theme images
        # This allows direct browser access without authentication
        self.default_acl = getattr(settings, "AWS_DEFAULT_ACL", "public-read")

    def url(self, name, parameters=None, expire=None, http_method=None):
        """
        Return S3 protocol URL for imgproxy.

        Instead of returning HTTPS URLs (which would need to be public or signed),
        we return s3://bucket/path URLs that imgproxy can access using its
        configured S3 credentials.
        """
        # Clean the name (remove any leading slashes)
        name = name.lstrip("/")

        # Get bucket name from settings
        bucket = getattr(settings, "AWS_STORAGE_BUCKET_NAME", "eceee-media")

        # Return S3 protocol URL that imgproxy understands
        return f"s3://{bucket}/{name}"

    def get_public_url(self, name):
        """
        Return public HTTPS URL for direct browser access.

        This method is used for files that need to be accessed directly
        (like theme images) rather than through imgproxy.

        Args:
            name: File name or path

        Returns:
            Public HTTPS URL
        """
        # Clean the name (remove any leading slashes)
        name = name.lstrip("/")

        # Get configuration from settings
        bucket = getattr(settings, "AWS_STORAGE_BUCKET_NAME", "eceee-media")
        custom_domain = getattr(settings, "AWS_S3_CUSTOM_DOMAIN", None)
        endpoint_url = getattr(settings, "AWS_S3_ENDPOINT_URL", None)
        region = getattr(settings, "AWS_S3_REGION_NAME", "us-east-1")

        # Priority 1: Use custom domain if configured (CDN)
        if custom_domain:
            return f"https://{custom_domain}/{name}"

        # Priority 2: Construct from endpoint_url (Linode/MinIO)
        if endpoint_url:
            # Remove http:// or https:// prefix to rebuild with proper protocol
            endpoint = endpoint_url.replace("http://", "").replace("https://", "")
            # Use HTTPS for production, HTTP for local dev (MinIO)
            protocol = "https" if "linodeobjects.com" in endpoint else "http"
            return f"{protocol}://{endpoint}/{bucket}/{name}"

        # Priority 3: Standard AWS S3 URL format
        return f"https://{bucket}.s3.{region}.amazonaws.com/{name}"
    
    def make_public(self, name):
        """
        Set an existing file to public-read ACL.
        
        This is useful for fixing files that were uploaded before
        public-read ACL was configured.
        
        Args:
            name: File name or path
            
        Returns:
            True if successful, False otherwise
        """
        try:
            name = name.lstrip("/")
            self.connection.meta.client.put_object_acl(
                Bucket=self.bucket_name,
                Key=name,
                ACL='public-read'
            )
            return True
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to set public-read ACL for {name}: {e}")
            return False
    
    def listdir(self, path):
        """
        List the contents of the specified path.
        
        Args:
            path: Directory path to list
            
        Returns:
            Tuple of (directories, files) lists
        """
        # Ensure path ends with / for directory listing
        if path and not path.endswith('/'):
            path = path + '/'
        
        directories = []
        files = []
        
        try:
            # Get the S3 connection
            connection = self.connection
            bucket = connection.Bucket(self.bucket_name)
            
            # Use list_objects to get all objects with the prefix
            paginator = connection.meta.client.get_paginator('list_objects_v2')
            pages = paginator.paginate(
                Bucket=self.bucket_name,
                Prefix=path,
                Delimiter='/'
            )
            
            for page in pages:
                # Get subdirectories (CommonPrefixes)
                for prefix in page.get('CommonPrefixes', []):
                    dir_name = prefix['Prefix'].rstrip('/').split('/')[-1]
                    if dir_name:
                        directories.append(dir_name)
                
                # Get files (Contents)
                for obj in page.get('Contents', []):
                    # Skip the directory itself
                    if obj['Key'] == path:
                        continue
                    # Only get direct children (not nested)
                    file_path = obj['Key'][len(path):]
                    if '/' not in file_path:
                        files.append(file_path)
            
            return (directories, files)
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error listing directory {path}: {str(e)}")
            return ([], [])