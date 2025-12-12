"""
S3 storage backend for media files with advanced functionality.

This module provides a custom storage backend for handling media files in S3,
including features like:
- Secure file uploads with pre-signed URLs
- Automatic file type validation
- Metadata extraction
- File deduplication
- Access control
"""

import os
import boto3
import logging
import hashlib
import uuid
from typing import Optional, Dict, Any, BinaryIO
from django.conf import settings
from django.core.files.storage import Storage
from django.core.files.uploadedfile import UploadedFile
from django.utils.deconstruct import deconstructible
from botocore.exceptions import ClientError
from PIL import Image, ExifTags
import io

logger = logging.getLogger(__name__)


@deconstructible
class S3MediaStorage(Storage):
    """Custom S3 storage backend with enhanced functionality."""

    def __init__(self):
        """Initialize S3 storage with settings."""
        self.bucket_name = settings.AWS_STORAGE_BUCKET_NAME
        self.region_name = settings.AWS_S3_REGION_NAME
        self.access_key = settings.AWS_ACCESS_KEY_ID
        self.secret_key = settings.AWS_SECRET_ACCESS_KEY
        self.endpoint_url = getattr(settings, "AWS_S3_ENDPOINT_URL", None)
        self.custom_domain = getattr(settings, "AWS_S3_CUSTOM_DOMAIN", None)
        self.default_acl = getattr(settings, "AWS_DEFAULT_ACL", "private")
        self.querystring_auth = getattr(settings, "AWS_QUERYSTRING_AUTH", True)
        self.file_overwrite = getattr(settings, "AWS_S3_FILE_OVERWRITE", False)
        self.object_parameters = getattr(settings, "AWS_S3_OBJECT_PARAMETERS", {})
        self.max_file_size = getattr(
            settings, "MAX_FILE_SIZE", 100 * 1024 * 1024
        )  # 100MB
        self.allowed_file_types = getattr(
            settings,
            "ALLOWED_FILE_TYPES",
            {
                "image": ["image/jpeg", "image/png", "image/gif", "image/svg+xml"],
                "document": [
                    "application/pdf",
                    "application/msword",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ],
                "video": ["video/mp4", "video/webm"],
                "audio": ["audio/mpeg", "audio/wav"],
            },
        )

        # Initialize S3 client
        self.client = boto3.client(
            "s3",
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name=self.region_name,
            endpoint_url=self.endpoint_url,
        )

    def upload_file(self, file: UploadedFile, folder_path: str = "") -> Dict[str, Any]:
        """
        Upload a file to S3 with metadata extraction and hash generation.

        Args:
            file: Uploaded file object
            folder_path: Optional folder path for organizing files

        Returns:
            Dictionary containing:
                - file_path: S3 key/path where file is stored
                - file_size: Size of the file in bytes
                - content_type: MIME type of the file
                - file_hash: SHA-256 hash of the file content
                - width: Image width (for images only)
                - height: Image height (for images only)
        """
        # Read file content for hashing and metadata extraction
        file_content = file.read()
        file.seek(0)  # Reset file pointer

        # Generate file hash
        file_hash = hashlib.sha256(file_content).hexdigest()

        # Generate unique filename to avoid collisions
        file_extension = os.path.splitext(file.name)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"

        # Construct S3 key with folder path
        if folder_path:
            file_path = f"{folder_path.strip('/')}/{unique_filename}"
        else:
            file_path = f"uploads/{unique_filename}"

        # Get content type
        content_type = getattr(file, "content_type", "application/octet-stream")

        # Prepare result dictionary
        result = {
            "file_path": file_path,
            "file_size": file.size,
            "content_type": content_type,
            "file_hash": file_hash,
        }

        # Extract image metadata if applicable
        if content_type.startswith("image/"):
            try:
                metadata = self.extract_metadata(file_content, content_type)
                if "width" in metadata:
                    result["width"] = metadata["width"]
                if "height" in metadata:
                    result["height"] = metadata["height"]
            except Exception as e:
                logger.warning(f"Failed to extract image metadata: {e}")

        # Upload to S3
        try:
            self._save(file_path, file)
        except Exception as e:
            logger.error(f"Failed to upload file {file.name} to S3: {e}")
            raise

        return result

    def overwrite_file(self, file_path: str, file: UploadedFile) -> Dict[str, Any]:
        """
        Overwrite an existing S3 object at a known key/path.

        This is used for true in-place replacements where we must preserve the
        MediaFile record and its file_path (so existing references keep working).

        Args:
            file_path: Existing S3 key/path to overwrite
            file: Uploaded file object

        Returns:
            Dictionary containing:
                - file_path: The same S3 key/path where file is stored
                - file_size: Size of the file in bytes
                - content_type: MIME type of the file
                - file_hash: SHA-256 hash of the file content
                - width: Image width (for images only)
                - height: Image height (for images only)
        """
        # Read file content for hashing and metadata extraction
        file_content = file.read()
        file.seek(0)  # Reset file pointer

        file_hash = hashlib.sha256(file_content).hexdigest()
        content_type = getattr(file, "content_type", "application/octet-stream")

        result: Dict[str, Any] = {
            "file_path": file_path,
            "file_size": file.size,
            "content_type": content_type,
            "file_hash": file_hash,
        }

        if content_type.startswith("image/"):
            try:
                metadata = self.extract_metadata(file_content, content_type)
                if "width" in metadata:
                    result["width"] = metadata["width"]
                if "height" in metadata:
                    result["height"] = metadata["height"]
            except Exception as e:
                logger.warning(f"Failed to extract image metadata: {e}")

        try:
            self._save(file_path, file)
        except Exception as e:
            logger.error(f"Failed to overwrite file {file.name} to S3 path {file_path}: {e}")
            raise

        return result

    def upload_thumbnail(self, thumbnail_bytes: bytes, original_file_path: str) -> str:
        """
        Upload generated thumbnail to S3.

        Args:
            thumbnail_bytes: Thumbnail image bytes (JPEG format)
            original_file_path: Original file's S3 path

        Returns:
            S3 path where thumbnail was stored
        """
        # Generate thumbnail path by adding _thumb before extension
        base_path, ext = os.path.splitext(original_file_path)
        thumbnail_path = f"{base_path}_thumb.jpg"

        try:
            # Upload thumbnail to S3
            self.client.put_object(
                Bucket=self.bucket_name,
                Key=thumbnail_path,
                Body=thumbnail_bytes,
                ContentType="image/jpeg",
                **self.object_parameters,
            )

            logger.info(f"Uploaded thumbnail to S3: {thumbnail_path}")
            return thumbnail_path

        except Exception as e:
            logger.error(f"Failed to upload thumbnail for {original_file_path}: {e}")
            raise

    def _get_key(self, name: str) -> str:
        """
        Get the S3 key for a file.

        Args:
            name: File name or path

        Returns:
            S3 key
        """
        return name.lstrip("/")

    def _open(self, name: str, mode: str = "rb") -> BinaryIO:
        """
        Open a file from S3.

        Args:
            name: File name or path
            mode: File mode (only 'rb' supported)

        Returns:
            File-like object
        """
        if mode != "rb":
            raise ValueError("S3 files can only be opened in read-only mode")

        key = self._get_key(name)
        try:
            response = self.client.get_object(Bucket=self.bucket_name, Key=key)
            return response["Body"]
        except ClientError as e:
            logger.error(f"Failed to open file {name} from S3: {e}")
            raise

    def _save(self, name: str, content: UploadedFile) -> str:
        """
        Save a file to S3.

        Args:
            name: File name or path
            content: File content

        Returns:
            Saved file name
        """
        key = self._get_key(name)
        content_type = getattr(content, "content_type", None)

        # Prepare extra args
        extra_args = self.object_parameters.copy()
        if content_type:
            extra_args["ContentType"] = content_type

        if self.default_acl:
            extra_args["ACL"] = self.default_acl

        try:
            self.client.upload_fileobj(
                content, self.bucket_name, key, ExtraArgs=extra_args
            )
            return name
        except ClientError as e:
            logger.error(f"Failed to save file {name} to S3: {e}")
            raise

    def delete(self, name: str) -> None:
        """
        Delete a file from S3.

        Args:
            name: File name or path
        """
        key = self._get_key(name)
        try:
            self.client.delete_object(Bucket=self.bucket_name, Key=key)
        except ClientError as e:
            logger.error(f"Failed to delete file {name} from S3: {e}")
            raise

    def exists(self, name: str) -> bool:
        """
        Check if a file exists in S3.

        Args:
            name: File name or path

        Returns:
            True if file exists
        """
        key = self._get_key(name)
        try:
            self.client.head_object(Bucket=self.bucket_name, Key=key)
            return True
        except ClientError:
            return False

    def url(self, name: str) -> str:
        """
        Get URL for a file.

        Args:
            name: File name or path

        Returns:
            File URL
        """
        key = self._get_key(name)
        if self.custom_domain:
            return f"https://{self.custom_domain}/{key}"
        if self.endpoint_url:
            # Handle MinIO or custom S3-compatible storage
            return f"{self.endpoint_url}/{self.bucket_name}/{key}"
        return f"https://{self.bucket_name}.s3.{self.region_name}.amazonaws.com/{key}"

    def get_public_url(self, name: str) -> str:
        """
        Get public URL for a file.

        Args:
            name: File name or path

        Returns:
            Public URL
        """
        return self.url(name)

    def generate_signed_url(self, name: str, expires: int = 3600) -> str:
        """
        Generate a pre-signed URL for a file.

        Args:
            name: File name or path
            expires: URL expiration time in seconds

        Returns:
            Pre-signed URL
        """
        key = self._get_key(name)
        try:
            url = self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": key},
                ExpiresIn=expires,
            )
            return url
        except ClientError as e:
            logger.error(f"Failed to generate signed URL for {name}: {e}")
            raise

    def validate_file_type(self, file: UploadedFile) -> bool:
        """
        Validate file type against allowed types.

        Args:
            file: Uploaded file

        Returns:
            True if file type is allowed
        """
        content_type = getattr(file, "content_type", None)
        if not content_type:
            return False

        for allowed_types in self.allowed_file_types.values():
            if content_type in allowed_types:
                return True
        return False

    def validate_file_size(self, file: UploadedFile) -> bool:
        """
        Validate file size against maximum allowed size.

        Args:
            file: Uploaded file

        Returns:
            True if file size is within limit
        """
        return file.size <= self.max_file_size

    def extract_metadata(
        self, file_content: bytes, content_type: str
    ) -> Dict[str, Any]:
        """
        Extract metadata from file content.

        Args:
            file_content: File content bytes
            content_type: File content type

        Returns:
            Dictionary of metadata
        """
        metadata = {}

        if content_type.startswith("image/"):
            try:
                image = Image.open(io.BytesIO(file_content))
                metadata.update(
                    {
                        "width": image.width,
                        "height": image.height,
                        "format": image.format,
                        "mode": image.mode,
                    }
                )

                # Extract EXIF data if available
                if hasattr(image, "_getexif") and image._getexif():
                    exif = image._getexif()
                    metadata["exif"] = {
                        ExifTags.TAGS[k]: v
                        for k, v in exif.items()
                        if k in ExifTags.TAGS
                    }
            except Exception as e:
                logger.warning(f"Failed to extract image metadata: {e}")

        return metadata

    def get_file_type(self, content_type: str) -> str:
        """
        Get file type category from content type.

        Args:
            content_type: File content type

        Returns:
            File type category
        """
        for file_type, allowed_types in self.allowed_file_types.items():
            if content_type in allowed_types:
                return file_type
        return "other"

    def get_file_content(self, file_path: str) -> bytes:
        """
        Get file content from S3.

        Args:
            file_path: S3 key/path to the file

        Returns:
            File content as bytes
        """
        try:
            key = self._get_key(file_path)
            response = self.client.get_object(Bucket=self.bucket_name, Key=key)
            return response["Body"].read()
        except ClientError as e:
            logger.error(f"Failed to get file content for {file_path}: {e}")
            raise


# Create a singleton instance
storage = S3MediaStorage()
