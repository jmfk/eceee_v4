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

        # All authenticated users have basic access
        return True

    def has_object_permission(self, request, view, obj):
        """Check if user has permission to access specific media file."""
        # Staff users have full access
        if request.user.is_staff:
            return True

        # Check namespace access
        if not self._has_namespace_access(request.user, obj.namespace):
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

    def _has_namespace_access(self, user, namespace):
        """
        Check if user has access to the specified namespace.

        Args:
            user: User instance
            namespace: Namespace instance

        Returns:
            bool: True if user has access, False otherwise
        """
        # Staff users have access to all namespaces
        if user.is_staff:
            return True

        # Users have access to namespaces they created
        if namespace.created_by == user:
            return True

        # For now, allow access to active namespaces for authenticated users
        # This can be extended with more granular permissions later
        return namespace.is_active


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

        # Extract basic file info immediately for use throughout validation
        results["filename"] = uploaded_file.name
        results["content_type"] = uploaded_file.content_type
        results["file_size"] = uploaded_file.size

        # Extract metadata
        results["metadata"] = cls._extract_safe_metadata(uploaded_file)

        try:
            # Basic file checks
            cls._validate_file_basic(uploaded_file, results)

            # Content validation
            cls._validate_file_content(uploaded_file, results)

            # Security checks
            cls._validate_file_security(uploaded_file, results)

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
        # Validate file extension before processing content
        file_ext = os.path.splitext(uploaded_file.name)[1].lower()
        if not cls._validate_file_extension(file_ext, results):
            return

        # Read file content for analysis (limit size for memory safety)
        uploaded_file.seek(0)
        max_content_size = 50 * 1024 * 1024  # 50MB limit for content analysis
        if uploaded_file.size > max_content_size:
            # For very large files, only read the first portion for MIME detection
            file_content = uploaded_file.read(1024 * 1024)  # 1MB sample
        else:
            file_content = uploaded_file.read()
        uploaded_file.seek(0)

        # Detect actual MIME type using python-magic
        try:
            actual_mime_type = magic.from_buffer(file_content, mime=True)
        except Exception as e:
            logger.error(
                f"Could not detect MIME type for file {uploaded_file.name}: {e}"
            )
            results["errors"].append(
                "Unable to verify file type - file rejected for security"
            )
            results["is_valid"] = False
            return

        # Check if MIME type is allowed
        if actual_mime_type not in cls.ALLOWED_MIME_TYPES:
            results["errors"].append(f"File type not allowed: {actual_mime_type}")
            results["is_valid"] = False
            return

        # Cross-check client-provided content type with detected type
        if (
            uploaded_file.content_type
            and uploaded_file.content_type != actual_mime_type
        ):
            # Allow some common variations and aliases
            allowed_variations = {
                "image/jpeg": ["image/jpg"],
                "text/plain": ["text/x-plain"],
                "application/octet-stream": list(
                    cls.ALLOWED_MIME_TYPES.keys()
                ),  # Generic binary type
            }

            is_valid_variation = False
            for base_type, variations in allowed_variations.items():
                if (
                    actual_mime_type == base_type
                    and uploaded_file.content_type in variations
                ):
                    is_valid_variation = True
                    break
                elif (
                    uploaded_file.content_type == base_type
                    and actual_mime_type in variations
                ):
                    is_valid_variation = True
                    break

            if not is_valid_variation:
                results["warnings"].append(
                    f"Content-Type mismatch: client reported {uploaded_file.content_type}, "
                    f"detected {actual_mime_type}"
                )

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
        else:
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
        # Get content type and filename from results (extracted at start of validation)
        content_type = results.get("metadata", {}).get(
            "content_type", ""
        ) or results.get("content_type", "")
        filename = results.get("filename", "")

        # Fallback: if content_type is missing or generic, use file extension
        if not content_type or content_type in [
            "application/octet-stream",
            "text/plain",
        ]:
            content_type = cls._get_content_type_from_extension(filename)
            logger.info(
                f"Using extension-based content_type: {content_type} for file: {filename}"
            )
            # Update both locations with the corrected content type
            results["content_type"] = content_type
            results["metadata"]["content_type"] = content_type

        # Skip pattern detection for binary files (images, videos, audio, documents)
        binary_types = (
            "image/",
            "video/",
            "audio/",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.",
            "application/vnd.ms-",
        )
        if content_type.startswith(binary_types):
            # For binary files, only check for very specific executable patterns
            executable_patterns = [
                b"#!/bin/",  # Shell scripts
                b"#!/usr/bin/",  # Shell scripts
                b"MZ",  # Windows executable header
                b"\x7fELF",  # Linux executable header
            ]

            for pattern in executable_patterns:
                if file_content.startswith(pattern):
                    results["errors"].append(
                        f"Executable content detected in media file"
                    )
                    results["is_valid"] = False
            return

        # For text-based files, check for script injection patterns
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
                logger.warning(
                    f"Found malicious pattern {pattern} in content_type {content_type}"
                )
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

    @classmethod
    def _get_content_type_from_extension(cls, filename: str) -> str:
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
        if not SecurityAuditLogger._has_namespace_access(user, media_file.namespace):
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

    @staticmethod
    def log_file_deletion(user, file_obj, context: Dict = None):
        """Log file deletion events."""
        context_info = f", Context: {context}" if context else ""
        logger.info(
            f"File deletion - User: {user.username}, "
            f"File: {file_obj.title} ({file_obj.id}), "
            f"Filename: {file_obj.original_filename}"
            f"{context_info}"
        )

    @staticmethod
    def _has_namespace_access(user, namespace):
        """
        Check if user has access to the specified namespace.

        Args:
            user: User instance
            namespace: Namespace instance

        Returns:
            bool: True if user has access, False otherwise
        """
        # Staff users have access to all namespaces
        if user.is_staff:
            return True

        # Users have access to namespaces they created
        if namespace.created_by == user:
            return True

        # For now, allow access to active namespaces for authenticated users
        # This can be extended with more granular permissions later
        return namespace.is_active


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
                # Sanitize user agent string to prevent log injection
                sanitized_user_agent = self._sanitize_log_string(user_agent)
                SecurityAuditLogger.log_security_violation(
                    request.user,
                    "suspicious_user_agent",
                    f"User agent: {sanitized_user_agent}",
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

    def _sanitize_log_string(self, value: str, max_length: int = 200) -> str:
        """
        Sanitize strings for safe logging to prevent log injection attacks.

        Args:
            value: The string to sanitize
            max_length: Maximum length of the sanitized string

        Returns:
            Sanitized string safe for logging
        """
        import re

        if not value:
            return ""

        # Remove or replace dangerous characters
        # Replace newlines, carriage returns, and other control characters
        sanitized = re.sub(r"[\r\n\t\x00-\x1f\x7f-\x9f]", " ", str(value))

        # Remove or escape potentially dangerous sequences
        sanitized = re.sub(r'[<>"\']', "", sanitized)

        # Limit length to prevent log flooding
        if len(sanitized) > max_length:
            sanitized = sanitized[:max_length] + "..."

        return sanitized.strip()

    @classmethod
    def _validate_file_extension(cls, file_ext: str, results: Dict) -> bool:
        """
        Validate file extension before MIME type detection to prevent malicious files.

        Args:
            file_ext: File extension (including the dot)
            results: Results dictionary to update with errors

        Returns:
            True if extension is valid, False otherwise
        """
        # Get all allowed extensions from ALLOWED_MIME_TYPES
        allowed_extensions = set()
        for extensions_list in cls.ALLOWED_MIME_TYPES.values():
            allowed_extensions.update(extensions_list)

        # Check if extension is in allowed list
        if file_ext not in allowed_extensions:
            results["errors"].append(
                f"File extension '{file_ext}' is not allowed. Allowed extensions: {', '.join(sorted(allowed_extensions))}"
            )
            results["is_valid"] = False
            return False

        # Additional checks for potentially dangerous extensions
        dangerous_extensions = [
            ".exe",
            ".bat",
            ".cmd",
            ".com",
            ".scr",
            ".pif",
            ".vbs",
            ".js",
            ".jar",
            ".app",
            ".deb",
            ".pkg",
            ".dmg",
            ".msi",
            ".run",
            ".bin",
            ".sh",
            ".ps1",
            ".py",
            ".rb",
            ".pl",
            ".php",
            ".jsp",
            ".asp",
            ".aspx",
        ]

        if file_ext in dangerous_extensions:
            results["errors"].append(
                f"File extension '{file_ext}' is potentially dangerous and not allowed"
            )
            results["is_valid"] = False
            return False

        return True
