"""
Security utilities and validators for the media management system.
"""

import hashlib
import magic
import os
import re
from typing import Dict, List, Optional, Tuple
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile
from rest_framework import permissions
from rest_framework.request import Request
from rest_framework.views import APIView
import logging

logger = logging.getLogger(__name__)


class MediaFilePermission(permissions.BasePermission):
    """
    Custom permission class for media file operations.

    Provides granular permissions based on:
    - User authentication status
    - Namespace access rights
    - File ownership
    - Access level settings
    """

    def has_permission(self, request, view):
        """Check if user has permission to access the view."""
        # All operations require authentication
        if not request.user.is_authenticated:
            return False

        # Check if user has access to any namespaces
        if not hasattr(request.user, "accessible_namespaces"):
            return request.user.is_staff

        return True

    def has_object_permission(self, request, view, obj):
        """Check if user has permission to access specific media file."""
        # Staff users have full access
        if request.user.is_staff:
            return True

        # Check namespace access
        if not request.user.accessible_namespaces.filter(id=obj.namespace_id).exists():
            return False

        # Check access level
        if obj.access_level == "private":
            return obj.created_by == request.user
        elif obj.access_level == "staff":
            return request.user.is_staff
        elif obj.access_level == "members":
            return request.user.is_authenticated
        # 'public' files are accessible to all authenticated users

        # For write operations, check ownership or staff status
        if request.method in ["PUT", "PATCH", "DELETE"]:
            return obj.created_by == request.user or request.user.is_staff

        return True


class FileUploadValidator:
    """
    Comprehensive file upload validation and security checks.
    """

    # Allowed MIME types with their corresponding file extensions
    ALLOWED_MIME_TYPES = {
        # Images
        "image/jpeg": [".jpg", ".jpeg"],
        "image/png": [".png"],
        "image/gif": [".gif"],
        "image/webp": [".webp"],
        "image/svg+xml": [".svg"],
        # Videos
        "video/mp4": [".mp4"],
        "video/webm": [".webm"],
        "video/avi": [".avi"],
        "video/quicktime": [".mov"],
        # Documents
        "application/pdf": [".pdf"],
        "application/msword": [".doc"],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
            ".docx"
        ],
        "text/plain": [".txt"],
        # Audio
        "audio/mpeg": [".mp3"],
        "audio/wav": [".wav"],
        "audio/ogg": [".ogg"],
    }

    # Maximum file sizes by type (in bytes)
    MAX_FILE_SIZES = {
        "image": 50 * 1024 * 1024,  # 50MB
        "video": 500 * 1024 * 1024,  # 500MB
        "document": 100 * 1024 * 1024,  # 100MB
        "audio": 100 * 1024 * 1024,  # 100MB
    }

    # Dangerous file patterns to reject
    DANGEROUS_PATTERNS = [
        r"\.php$",
        r"\.asp$",
        r"\.jsp$",
        r"\.exe$",
        r"\.bat$",
        r"\.cmd$",
        r"\.scr$",
        r"\.com$",
        r"\.pif$",
        r"\.vbs$",
        r"\.js$",
        r"\.jar$",
        r"\.sh$",
        r"\.py$",
        r"\.pl$",
        r"\.rb$",
    ]

    # Suspicious filename patterns
    SUSPICIOUS_PATTERNS = [
        r"\.\./",
        r'[<>:"|?*]',
        r"^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$",
    ]

    @classmethod
    def validate_file(cls, uploaded_file: UploadedFile) -> Dict[str, any]:
        """
        Comprehensive file validation.

        Args:
            uploaded_file: Django UploadedFile instance

        Returns:
            Dict with validation results and metadata

        Raises:
            ValidationError: If file fails validation
        """
        results = {"is_valid": True, "errors": [], "warnings": [], "metadata": {}}

        try:
            # Basic file checks
            cls._validate_file_basic(uploaded_file, results)

            # Content validation
            cls._validate_file_content(uploaded_file, results)

            # Security checks
            cls._validate_file_security(uploaded_file, results)

            # Extract metadata
            results["metadata"] = cls._extract_safe_metadata(uploaded_file)

        except Exception as e:
            logger.error(f"File validation error: {e}")
            results["is_valid"] = False
            results["errors"].append(f"Validation failed: {str(e)}")

        return results

    @classmethod
    def _validate_file_basic(cls, uploaded_file: UploadedFile, results: Dict):
        """Basic file validation checks."""
        # Check file size
        if uploaded_file.size == 0:
            results["errors"].append("File is empty")
            results["is_valid"] = False
            return

        # Check filename
        if not uploaded_file.name:
            results["errors"].append("Filename is required")
            results["is_valid"] = False
            return

        # Check for dangerous filename patterns
        filename_lower = uploaded_file.name.lower()
        for pattern in cls.DANGEROUS_PATTERNS:
            if re.search(pattern, filename_lower):
                results["errors"].append(
                    f"Dangerous file type detected: {uploaded_file.name}"
                )
                results["is_valid"] = False
                return

        # Check for suspicious filename patterns
        for pattern in cls.SUSPICIOUS_PATTERNS:
            if re.search(pattern, uploaded_file.name, re.IGNORECASE):
                results["warnings"].append(
                    f"Suspicious filename pattern: {uploaded_file.name}"
                )

    @classmethod
    def _validate_file_content(cls, uploaded_file: UploadedFile, results: Dict):
        """Validate file content and MIME type."""
        # Read file content for analysis
        uploaded_file.seek(0)
        file_content = uploaded_file.read()
        uploaded_file.seek(0)

        # Detect actual MIME type using python-magic
        try:
            actual_mime_type = magic.from_buffer(file_content, mime=True)
        except Exception as e:
            logger.warning(f"Could not detect MIME type: {e}")
            actual_mime_type = uploaded_file.content_type

        # Check if MIME type is allowed
        if actual_mime_type not in cls.ALLOWED_MIME_TYPES:
            results["errors"].append(f"File type not allowed: {actual_mime_type}")
            results["is_valid"] = False
            return

        # Verify file extension matches MIME type
        file_ext = os.path.splitext(uploaded_file.name)[1].lower()
        allowed_extensions = cls.ALLOWED_MIME_TYPES[actual_mime_type]

        if file_ext not in allowed_extensions:
            results["errors"].append(
                f"File extension {file_ext} doesn't match content type {actual_mime_type}"
            )
            results["is_valid"] = False
            return

        # Check file size limits
        file_type = cls._get_file_type_from_mime(actual_mime_type)
        max_size = cls.MAX_FILE_SIZES.get(file_type, cls.MAX_FILE_SIZES["document"])

        if uploaded_file.size > max_size:
            results["errors"].append(
                f"File too large: {uploaded_file.size} bytes (max: {max_size} bytes)"
            )
            results["is_valid"] = False
            return

        results["metadata"]["actual_mime_type"] = actual_mime_type
        results["metadata"]["file_type"] = file_type

    @classmethod
    def _validate_file_security(cls, uploaded_file: UploadedFile, results: Dict):
        """Additional security validation checks."""
        uploaded_file.seek(0)
        file_content = uploaded_file.read()
        uploaded_file.seek(0)

        # Check for embedded scripts in images
        if results["metadata"].get("file_type") == "image":
            cls._check_image_security(file_content, results)

        # Check for malicious content patterns
        cls._check_malicious_patterns(file_content, results)

        # Generate file hash for deduplication
        file_hash = hashlib.sha256(file_content).hexdigest()
        results["metadata"]["file_hash"] = file_hash

    @classmethod
    def _check_image_security(cls, file_content: bytes, results: Dict):
        """Check images for embedded scripts and malicious content."""
        # Check for script tags in SVG files
        if b"<script" in file_content.lower():
            results["errors"].append("SVG contains script tags")
            results["is_valid"] = False

        # Check for suspicious metadata in JPEG files
        if file_content.startswith(b"\xff\xd8\xff"):  # JPEG magic bytes
            # Look for suspicious patterns in EXIF data
            suspicious_patterns = [b"<?php", b"<script", b"javascript:", b"eval("]
            for pattern in suspicious_patterns:
                if pattern in file_content.lower():
                    results["warnings"].append(
                        "Suspicious content detected in image metadata"
                    )
                    break

    @classmethod
    def _check_malicious_patterns(cls, file_content: bytes, results: Dict):
        """Check for common malicious patterns."""
        malicious_patterns = [
            b"<?php",
            b"<%",
            b"<script",
            b"javascript:",
            b"vbscript:",
            b"data:text/html",
            b"data:application/",
            b"eval(",
            b"exec(",
            b"system(",
            b"shell_exec(",
            b"passthru(",
            b"base64_decode(",
        ]

        content_lower = file_content.lower()
        for pattern in malicious_patterns:
            if pattern in content_lower:
                results["errors"].append(
                    f"Malicious pattern detected: {pattern.decode('utf-8', errors='ignore')}"
                )
                results["is_valid"] = False
                break

    @classmethod
    def _extract_safe_metadata(cls, uploaded_file: UploadedFile) -> Dict:
        """Extract safe metadata from file."""
        metadata = {
            "original_filename": uploaded_file.name,
            "file_size": uploaded_file.size,
            "content_type": uploaded_file.content_type,
        }

        # Add image-specific metadata if applicable
        if uploaded_file.content_type.startswith("image/"):
            try:
                from PIL import Image

                uploaded_file.seek(0)
                with Image.open(uploaded_file) as img:
                    metadata["width"] = img.width
                    metadata["height"] = img.height
                    metadata["format"] = img.format
                uploaded_file.seek(0)
            except Exception as e:
                logger.warning(f"Could not extract image metadata: {e}")

        return metadata

    @classmethod
    def _get_file_type_from_mime(cls, mime_type: str) -> str:
        """Get file type category from MIME type."""
        if mime_type.startswith("image/"):
            return "image"
        elif mime_type.startswith("video/"):
            return "video"
        elif mime_type.startswith("audio/"):
            return "audio"
        elif mime_type in ["application/pdf", "application/msword", "text/plain"]:
            return "document"
        else:
            return "other"


class RateLimitMixin:
    """
    Rate limiting mixin for API views.
    """

    rate_limit_key = None
    rate_limit_rate = "100/hour"  # Default rate limit

    def check_rate_limit(self, request):
        """Check if request exceeds rate limit."""
        # This would integrate with Django rate limiting
        # For now, we'll implement a simple in-memory rate limiter
        pass


class SecureFileAccess:
    """
    Utilities for secure file access and URL generation.
    """

    @staticmethod
    def generate_secure_url(file_path: str, expiration: int = 3600) -> str:
        """
        Generate secure, time-limited URL for file access.

        Args:
            file_path: S3 file path/key
            expiration: URL expiration time in seconds

        Returns:
            Signed URL for secure file access
        """
        from .storage import S3MediaStorage

        storage = S3MediaStorage()
        return storage.generate_presigned_url(file_path, expiration)

    @staticmethod
    def validate_file_access(user, media_file) -> bool:
        """
        Validate if user has access to specific media file.

        Args:
            user: Django User instance
            media_file: MediaFile instance

        Returns:
            True if access is allowed, False otherwise
        """
        # Check authentication
        if not user.is_authenticated:
            return False

        # Staff users have full access
        if user.is_staff:
            return True

        # Check namespace access
        if not user.accessible_namespaces.filter(id=media_file.namespace_id).exists():
            return False

        # Check access level
        if media_file.access_level == "private":
            return media_file.created_by == user
        elif media_file.access_level == "staff":
            return user.is_staff
        elif media_file.access_level == "members":
            return user.is_authenticated

        # Public files are accessible to all authenticated users with namespace access
        return True


class SecurityAuditLogger:
    """
    Security event logging for audit trails.
    """

    @staticmethod
    def log_file_upload(user, file_info: Dict, success: bool = True):
        """Log file upload events."""
        logger.info(
            f"File upload - User: {user.username if user.is_authenticated else 'Anonymous'}, "
            f"File: {file_info.get('filename', 'Unknown')}, "
            f"Size: {file_info.get('size', 0)}, "
            f"Success: {success}"
        )

    @staticmethod
    def log_file_access(user, media_file, access_type: str = "view"):
        """Log file access events."""
        logger.info(
            f"File access - User: {user.username}, "
            f"File: {media_file.title} ({media_file.id}), "
            f"Type: {access_type}"
        )

    @staticmethod
    def log_security_violation(user, violation_type: str, details: str):
        """Log security violations."""
        logger.warning(
            f"Security violation - User: {user.username if user.is_authenticated else 'Anonymous'}, "
            f"Type: {violation_type}, "
            f"Details: {details}"
        )


# Security middleware for additional protection
class MediaSecurityMiddleware:
    """
    Middleware for additional media security checks.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Pre-process security checks
        if request.path.startswith("/api/v1/media/"):
            self._check_request_security(request)

        response = self.get_response(request)

        # Post-process security headers
        if request.path.startswith("/api/v1/media/"):
            self._add_security_headers(response)

        return response

    def _check_request_security(self, request):
        """Perform security checks on media requests."""
        # Check for suspicious user agents
        user_agent = request.META.get("HTTP_USER_AGENT", "")
        suspicious_agents = ["curl", "wget", "python-requests"]

        if any(agent in user_agent.lower() for agent in suspicious_agents):
            if not request.user.is_authenticated:
                SecurityAuditLogger.log_security_violation(
                    request.user, "suspicious_user_agent", f"User agent: {user_agent}"
                )

    def _add_security_headers(self, response):
        """Add security headers to media responses."""
        response["X-Content-Type-Options"] = "nosniff"
        response["X-Frame-Options"] = "DENY"
        response["X-XSS-Protection"] = "1; mode=block"
        response["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Prevent caching of sensitive content
        if "private" in response.get("Cache-Control", ""):
            response["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response["Pragma"] = "no-cache"
            response["Expires"] = "0"
