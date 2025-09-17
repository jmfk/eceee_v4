"""
S3-compatible storage service for media file management.

This module provides a unified interface for S3-compatible storage backends
including AWS S3, Linode Object Storage, and local MinIO development.
"""

import os
import io
import hashlib
import logging
from typing import Optional, Dict, Any, Tuple, List
from urllib.parse import urljoin
from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from django.utils import timezone
from PIL import Image, ImageOps
import boto3
from botocore.exceptions import ClientError, NoCredentialsError

import magic

logger = logging.getLogger(__name__)


class S3MediaStorage:
    """S3-compatible storage handler with multiple backend support."""

    def __init__(self):
        """Initialize S3 client with configuration from settings."""
        self.bucket_name = getattr(settings, "AWS_STORAGE_BUCKET_NAME", "eceee-media")
        self.region = getattr(settings, "AWS_S3_REGION_NAME", "us-east-1")
        self.endpoint_url = getattr(settings, "AWS_S3_ENDPOINT_URL", None)
        self.use_ssl = getattr(settings, "AWS_S3_USE_SSL", True)

        # Lazy initialization - client will be created when first needed
        self.s3_client = None
        self._bucket_checked = False

    def _create_s3_client(self):
        """Create S3 client with proper configuration."""
        try:
            session = boto3.Session(
                aws_access_key_id=getattr(settings, "AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=getattr(settings, "AWS_SECRET_ACCESS_KEY"),
                region_name=self.region,
            )

            client_config = {
                "region_name": self.region,
            }

            if self.endpoint_url:
                client_config["endpoint_url"] = self.endpoint_url
                client_config["use_ssl"] = self.use_ssl

            return session.client("s3", **client_config)

        except NoCredentialsError:
            logger.error("AWS credentials not found")
            raise
        except Exception as e:
            logger.error(f"Failed to create S3 client: {e}")
            raise

    def _get_s3_client(self):
        """Get or create S3 client with lazy initialization."""
        if self.s3_client is None:
            self.s3_client = self._create_s3_client()
        return self.s3_client

    def _ensure_bucket_exists(self):
        """Ensure the S3 bucket exists, create if it doesn't."""
        if self._bucket_checked:
            return

        try:
            client = self._get_s3_client()
            client.head_bucket(Bucket=self.bucket_name)
            logger.info(f"Bucket {self.bucket_name} exists")
            self._bucket_checked = True
        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            if error_code == "404":
                try:
                    client = self._get_s3_client()
                    if self.region == "us-east-1":
                        client.create_bucket(Bucket=self.bucket_name)
                    else:
                        client.create_bucket(
                            Bucket=self.bucket_name,
                            CreateBucketConfiguration={
                                "LocationConstraint": self.region
                            },
                        )
                    logger.info(f"Created bucket {self.bucket_name}")
                    self._bucket_checked = True
                except ClientError as create_error:
                    logger.error(f"Failed to create bucket: {create_error}")
                    raise
            else:
                logger.error(f"Error checking bucket: {e}")
                raise
        except Exception as e:
            logger.warning(f"Could not connect to S3 storage: {e}")
            # Don't raise exception during initialization - let it fail later when actually used

    def upload_file(self, file: UploadedFile, folder_path: str = "") -> Dict[str, Any]:
        """
        Upload file with automatic path generation and metadata extraction.

        Args:
            file: Django UploadedFile instance
            folder_path: Optional folder path prefix

        Returns:
            Dict containing file metadata and S3 information
        """
        try:
            # Read file content
            file.seek(0)
            file_content = file.read()
            file.seek(0)

            # Generate file hash for deduplication
            file_hash = hashlib.sha256(file_content).hexdigest()

            # Extract metadata
            metadata = self.extract_metadata(file, file_content)

            # Generate S3 key/path
            file_extension = os.path.splitext(file.name)[1].lower()
            s3_key = self._generate_s3_key(file_hash, file_extension, folder_path)

            # Check if file already exists in S3 storage
            if self._file_exists(s3_key):
                logger.info(f"Duplicate file detected - already exists in S3: {s3_key}")
                return {
                    "file_path": s3_key,
                    "file_hash": file_hash,
                    "file_size": len(file_content),
                    "content_type": metadata["content_type"],
                    "width": metadata.get("width"),
                    "height": metadata.get("height"),
                    "existing_file": True,
                    "duplicate_detected": True,
                }

            # Ensure bucket exists and get client
            self._ensure_bucket_exists()
            client = self._get_s3_client()

            # Upload to S3
            extra_args = {
                "ContentType": metadata["content_type"],
                "Metadata": {
                    "original-filename": self._encode_filename_for_s3(file.name),
                    "file-hash": file_hash,
                    "upload-timestamp": timezone.now().isoformat(),
                },
            }

            client.put_object(
                Bucket=self.bucket_name, Key=s3_key, Body=file_content, **extra_args
            )

            logger.info(f"Uploaded file to S3: {s3_key}")

            # Generate thumbnails for images
            thumbnail_paths = []
            if metadata.get("is_image"):
                thumbnail_paths = self.generate_thumbnails(file_content, file_hash)

            return {
                "file_path": s3_key,
                "file_hash": file_hash,
                "file_size": len(file_content),
                "content_type": metadata["content_type"],
                "width": metadata.get("width"),
                "height": metadata.get("height"),
                "thumbnail_paths": thumbnail_paths,
                "existing_file": False,
            }

        except Exception as e:
            logger.error(f"Failed to upload file {file.name}: {e}")
            raise

    def _generate_s3_key(
        self, file_hash: str, extension: str, folder_path: str = ""
    ) -> str:
        """
        Generate S3 key/path for file storage using hash as unique identifier.

        This ensures that files with identical content will have the same S3 key,
        preventing duplicate storage and enabling automatic deduplication.
        """
        # Use first 2 characters of hash for directory structure
        prefix = file_hash[:2]
        middle = file_hash[2:4]

        if folder_path:
            # Validate folder_path to prevent path traversal attacks
            sanitized_folder_path = self._validate_folder_path(folder_path)
            return f"{sanitized_folder_path}/{prefix}/{middle}/{file_hash}{extension}"
        else:
            return f"media/{prefix}/{middle}/{file_hash}{extension}"

    def _file_exists(self, s3_key: str) -> bool:
        """Check if file exists in S3."""
        try:
            client = self._get_s3_client()
            client.head_object(Bucket=self.bucket_name, Key=s3_key)
            return True
        except ClientError:
            return False

    def _encode_filename_for_s3(self, filename: str) -> str:
        """
        Encode filename for S3 metadata (ASCII only).

        S3 metadata only supports ASCII characters, so we need to encode
        non-ASCII characters properly.
        """
        import urllib.parse

        try:
            # First try to encode as ASCII
            filename.encode("ascii")
            return filename
        except UnicodeEncodeError:
            # If it contains non-ASCII characters, URL encode it
            encoded = urllib.parse.quote(filename, safe="")

            # If the encoded version is too long, truncate and add hash
            if (
                len(encoded) > 200
            ):  # S3 metadata value limit is ~2KB, but keep it reasonable
                import hashlib

                name_hash = hashlib.md5(filename.encode("utf-8")).hexdigest()[:8]
                # Take first part of encoded name and add hash
                truncated = encoded[:180]
                # Sanitize the truncated part to prevent XSS
                truncated = self._sanitize_filename_for_display(truncated)
                encoded = f"{truncated}...{name_hash}"

            return encoded

    def _sanitize_filename_for_display(self, filename: str) -> str:
        """
        Sanitize filename to prevent XSS when displayed in frontend.

        Args:
            filename: The filename to sanitize

        Returns:
            Sanitized filename safe for display
        """
        import re

        if not filename:
            return ""

        # Remove or replace potentially dangerous characters
        # Remove HTML/XML tags
        sanitized = re.sub(r"<[^>]*>", "", filename)

        # Remove JavaScript event handlers and other dangerous patterns
        sanitized = re.sub(
            r"(on\w+\s*=|javascript:|data:)", "", sanitized, flags=re.IGNORECASE
        )

        # Remove control characters but keep basic punctuation
        sanitized = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", sanitized)

        # Limit consecutive special characters to prevent visual confusion
        sanitized = re.sub(r'[<>"\'\&]{2,}', "", sanitized)

        return sanitized.strip()

    def _validate_folder_path(self, folder_path: str) -> str:
        """
        Validate and sanitize folder path to prevent path traversal attacks.

        Args:
            folder_path: The folder path to validate

        Returns:
            Sanitized folder path

        Raises:
            ValueError: If path contains dangerous patterns
        """
        import os
        import re

        if not folder_path:
            return ""

        # Remove any leading/trailing whitespace
        folder_path = folder_path.strip()

        # Check for dangerous path traversal patterns
        dangerous_patterns = [
            "..",  # Parent directory traversal
            "~",  # Home directory
            "/",  # Absolute path (at start)
            "\\",  # Windows path separator
            "\x00",  # Null byte
        ]

        # Check for dangerous patterns
        for pattern in dangerous_patterns:
            if pattern in folder_path:
                raise ValueError(
                    f"Invalid folder path: contains dangerous pattern '{pattern}'"
                )

        # Check for absolute paths (starting with /)
        if folder_path.startswith("/"):
            raise ValueError("Absolute paths are not allowed")

        # Remove any control characters
        folder_path = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", folder_path)

        # Normalize the path to resolve any remaining relative components
        normalized = os.path.normpath(folder_path)

        # Ensure the normalized path doesn't start with .. or contain ..
        if normalized.startswith("..") or "/.." in normalized or "\\.." in normalized:
            raise ValueError("Path traversal attempt detected")

        # Only allow alphanumeric, hyphens, underscores, and forward slashes
        if not re.match(r"^[a-zA-Z0-9/_-]+$", normalized):
            raise ValueError("Folder path contains invalid characters")

        return normalized

    def _decode_filename_from_s3(self, encoded_filename: str) -> str:
        """
        Decode filename from S3 metadata back to original form.

        Args:
            encoded_filename: URL-encoded filename from S3 metadata

        Returns:
            Original filename with proper Unicode characters
        """
        import urllib.parse

        try:
            # Check if it looks like a URL-encoded string
            if "%" in encoded_filename:
                return urllib.parse.unquote(encoded_filename)
            else:
                # Already ASCII, return as-is
                return encoded_filename
        except Exception:
            # If decoding fails, return the encoded version
            return encoded_filename

    def extract_metadata(
        self, file: UploadedFile, file_content: bytes
    ) -> Dict[str, Any]:
        """Extract metadata from uploaded file."""
        metadata = {
            "content_type": file.content_type,
            "is_image": False,
            "is_document": False,
            "is_video": False,
            "is_audio": False,
        }

        # Use python-magic for more accurate MIME type detection
        try:
            detected_mime = magic.from_buffer(file_content, mime=True)
            if detected_mime:
                metadata["content_type"] = detected_mime
        except Exception as e:
            logger.warning(f"Failed to detect MIME type: {e}")

        # Fallback: if content type is still missing or generic, use file extension
        if not metadata["content_type"] or metadata["content_type"] in [
            "application/octet-stream",
            "text/plain",
        ]:
            extension_based_type = self._get_content_type_from_extension(file.name)
            if extension_based_type:
                metadata["content_type"] = extension_based_type
                logger.info(
                    f"Using extension-based content_type: {extension_based_type} for file: {file.name}"
                )

        # Determine file type
        content_type = metadata["content_type"].lower()
        if content_type.startswith("image/"):
            metadata["is_image"] = True
            # Extract image dimensions
            try:
                with Image.open(io.BytesIO(file_content)) as img:
                    metadata["width"] = img.width
                    metadata["height"] = img.height
                    metadata["format"] = img.format
            except Exception as e:
                logger.warning(f"Failed to extract image metadata: {e}")

        elif content_type.startswith("video/"):
            metadata["is_video"] = True
        elif content_type.startswith("audio/"):
            metadata["is_audio"] = True
        elif content_type in [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ]:
            metadata["is_document"] = True

        return metadata

    def generate_thumbnails(
        self, image_content: bytes, file_hash: str
    ) -> List[Dict[str, Any]]:
        """Generate multiple thumbnail sizes for images."""
        thumbnail_sizes = {
            "small": (150, 150),
            "medium": (300, 300),
            "large": (600, 600),
            "xlarge": (1200, 1200),
        }

        thumbnail_paths = []

        try:
            with Image.open(io.BytesIO(image_content)) as img:
                # Convert to RGB if necessary
                if img.mode in ("RGBA", "LA", "P"):
                    img = img.convert("RGB")

                for size_name, (width, height) in thumbnail_sizes.items():
                    # Create thumbnail
                    thumbnail = img.copy()
                    thumbnail.thumbnail((width, height), Image.Resampling.LANCZOS)

                    # Save as WebP for better compression
                    thumbnail_buffer = io.BytesIO()
                    thumbnail.save(
                        thumbnail_buffer, format="WEBP", quality=85, optimize=True
                    )
                    thumbnail_content = thumbnail_buffer.getvalue()

                    # Generate S3 key for thumbnail
                    thumbnail_key = f"thumbnails/{file_hash[:2]}/{file_hash[2:4]}/{file_hash}_{size_name}.webp"

                    # Upload thumbnail
                    client = self._get_s3_client()
                    client.put_object(
                        Bucket=self.bucket_name,
                        Key=thumbnail_key,
                        Body=thumbnail_content,
                        ContentType="image/webp",
                        Metadata={
                            "original-hash": file_hash,
                            "thumbnail-size": size_name,
                            "dimensions": f"{thumbnail.width}x{thumbnail.height}",
                        },
                    )

                    thumbnail_paths.append(
                        {
                            "size": size_name,
                            "path": thumbnail_key,
                            "width": thumbnail.width,
                            "height": thumbnail.height,
                            "file_size": len(thumbnail_content),
                        }
                    )

                    logger.info(f"Generated {size_name} thumbnail: {thumbnail_key}")

        except Exception as e:
            logger.error(f"Failed to generate thumbnails: {e}")

        return thumbnail_paths

    def delete_file(self, file_path: str) -> bool:
        """Delete file and all associated thumbnails."""
        try:
            # Delete main file
            client = self._get_s3_client()
            client.delete_object(Bucket=self.bucket_name, Key=file_path)

            # Delete thumbnails if it's an image
            file_hash = os.path.splitext(os.path.basename(file_path))[0]
            thumbnail_prefix = (
                f"thumbnails/{file_hash[:2]}/{file_hash[2:4]}/{file_hash}_"
            )

            # List and delete thumbnails
            response = client.list_objects_v2(
                Bucket=self.bucket_name, Prefix=thumbnail_prefix
            )

            if "Contents" in response:
                for obj in response["Contents"]:
                    client.delete_object(Bucket=self.bucket_name, Key=obj["Key"])
                    logger.info(f"Deleted thumbnail: {obj['Key']}")

            logger.info(f"Deleted file and thumbnails: {file_path}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete file {file_path}: {e}")
            return False

    def get_signed_url(self, file_path: str, expires_in: int = 3600) -> Optional[str]:
        """Generate signed URL for secure access."""
        try:
            client = self._get_s3_client()
            url = client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": file_path},
                ExpiresIn=expires_in,
            )
            return url
        except Exception as e:
            logger.error(f"Failed to generate signed URL for {file_path}: {e}")
            return None

    def get_public_url(self, file_path: str) -> str:
        """Get public URL for file (if bucket is public)."""
        if self.endpoint_url:
            # For MinIO or custom S3 endpoints
            base_url = self.endpoint_url.rstrip("/")
            return f"{base_url}/{self.bucket_name}/{file_path}"
        else:
            # For AWS S3
            return (
                f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{file_path}"
            )

    def copy_file(self, source_path: str, destination_path: str) -> bool:
        """Copy file within the same bucket."""
        try:
            client = self._get_s3_client()
            copy_source = {"Bucket": self.bucket_name, "Key": source_path}
            client.copy_object(
                CopySource=copy_source, Bucket=self.bucket_name, Key=destination_path
            )
            logger.info(f"Copied file from {source_path} to {destination_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to copy file: {e}")
            return False

    def get_file_info(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Get file information from S3."""
        try:
            client = self._get_s3_client()
            response = client.head_object(Bucket=self.bucket_name, Key=file_path)

            # Decode metadata filenames
            metadata = response.get("Metadata", {})
            if "original-filename" in metadata:
                metadata["original-filename"] = self._decode_filename_from_s3(
                    metadata["original-filename"]
                )

            return {
                "size": response["ContentLength"],
                "last_modified": response["LastModified"],
                "content_type": response["ContentType"],
                "metadata": metadata,
                "etag": response["ETag"].strip('"'),
            }
        except Exception as e:
            logger.error(f"Failed to get file info for {file_path}: {e}")
            return None

    def get_file_content(self, file_path: str) -> Optional[bytes]:
        """Get file content from S3."""
        try:
            client = self._get_s3_client()
            response = client.get_object(Bucket=self.bucket_name, Key=file_path)
            return response["Body"].read()
        except Exception as e:
            logger.error(f"Failed to get file content for {file_path}: {e}")
            return None

    def _get_content_type_from_extension(self, filename: str) -> str:
        """Get content type from file extension as fallback."""
        import os

        if not filename:
            return ""

        file_ext = os.path.splitext(filename)[1].lower()

        # Extension to MIME type mapping
        extension_mime_map = {
            # Images
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".svg": "image/svg+xml",
            ".bmp": "image/bmp",
            ".tiff": "image/tiff",
            ".ico": "image/x-icon",
            # Documents
            ".pdf": "application/pdf",
            ".doc": "application/msword",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xls": "application/vnd.ms-excel",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".ppt": "application/vnd.ms-powerpoint",
            ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ".txt": "text/plain",
            ".csv": "text/csv",
            ".rtf": "application/rtf",
            # Videos
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".avi": "video/x-msvideo",
            ".mov": "video/quicktime",
            ".wmv": "video/x-ms-wmv",
            ".flv": "video/x-flv",
            ".mkv": "video/x-matroska",
            # Audio
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".ogg": "audio/ogg",
            ".aac": "audio/aac",
            ".flac": "audio/flac",
            ".wma": "audio/x-ms-wma",
            ".m4a": "audio/mp4",
            # Archives
            ".zip": "application/zip",
            ".rar": "application/x-rar-compressed",
            ".7z": "application/x-7z-compressed",
            ".tar": "application/x-tar",
            ".gz": "application/gzip",
        }

        return extension_mime_map.get(file_ext, "")


# Global storage instance
storage = S3MediaStorage()
