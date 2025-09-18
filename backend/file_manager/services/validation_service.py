"""
Service for handling file validation, security checks, and AI analysis.
"""

import logging
from dataclasses import dataclass
from typing import List, Dict, Any, Optional

from ..security import FileUploadValidator, SecurityAuditLogger

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Data class to hold the result of a file validation operation."""

    is_valid: bool
    errors: List[dict]
    warnings: List[str]
    metadata: Dict[str, Any]


class FileValidationService:
    """Service class to handle file validation and security checks."""

    def validate(
        self,
        file,
        user,
        force_upload: bool = False,
    ) -> ValidationResult:
        """
        Validate a file for security and extract metadata.

        Args:
            file: The uploaded file object
            user: The user performing the upload
            force_upload: Whether to bypass security validation

        Returns:
            ValidationResult containing validation status and metadata
        """
        try:
            # Handle force upload case
            if force_upload:
                SecurityAuditLogger.log_security_violation(
                    user,
                    "force_upload_used",
                    f"User bypassed security validation for file: {file.name}",
                )
                # Extract basic metadata without security validation
                metadata = FileUploadValidator._extract_safe_metadata(file)
                return ValidationResult(
                    is_valid=True,
                    errors=[],
                    warnings=[
                        "Security validation bypassed - file accepted without checks"
                    ],
                    metadata=metadata,
                )

            # Perform comprehensive security validation
            validation_result = FileUploadValidator.validate_file(file)

            if not validation_result["is_valid"]:
                error_msg = f"File '{file.name}' failed validation: {'; '.join(validation_result['errors'])}"
                SecurityAuditLogger.log_file_upload(
                    user,
                    {"filename": file.name, "size": file.size},
                    success=False,
                )

                return ValidationResult(
                    is_valid=False,
                    errors=[
                        {
                            "filename": file.name,
                            "error": error_msg,
                            "status": "error",
                        }
                    ],
                    warnings=[],
                    metadata={},
                )

            # Log any warnings
            if validation_result["warnings"]:
                logger.warning(
                    f"File upload warnings for '{file.name}': {validation_result['warnings']}"
                )

            return ValidationResult(
                is_valid=True,
                errors=[],
                warnings=validation_result["warnings"],
                metadata=validation_result["metadata"],
            )

        except Exception as e:
            logger.error(f"Validation failed for {file.name}: {e}")
            return ValidationResult(
                is_valid=False,
                errors=[
                    {
                        "filename": file.name,
                        "error": f"Validation error: {str(e)}",
                        "status": "error",
                    }
                ],
                warnings=[],
                metadata={},
            )

    def get_content_type_category(self, content_type: str) -> str:
        """
        Determine the high-level category of a file based on its content type.

        Args:
            content_type: The MIME type of the file

        Returns:
            String indicating the file category (image, video, audio, document, other)
        """
        if content_type.startswith("image/"):
            return "image"
        elif content_type.startswith("video/"):
            return "video"
        elif content_type.startswith("audio/"):
            return "audio"
        elif content_type in [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ]:
            return "document"
        return "other"

    def validate_content_type(
        self, content_type: str, allowed_types: Optional[List[str]] = None
    ) -> bool:
        """
        Check if a content type is allowed.

        Args:
            content_type: The MIME type to check
            allowed_types: Optional list of allowed MIME types. If None, uses default allowed types.

        Returns:
            bool indicating if the content type is allowed
        """
        if allowed_types is None:
            # Default allowed types - can be moved to settings
            allowed_types = [
                "image/jpeg",
                "image/png",
                "image/gif",
                "image/webp",
                "image/svg+xml",
                "video/mp4",
                "video/webm",
                "audio/mpeg",
                "audio/wav",
                "audio/webm",
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ]

        return content_type in allowed_types

    def validate_file_size(
        self, file_size: int, max_size: Optional[int] = None
    ) -> bool:
        """
        Check if a file size is within allowed limits.

        Args:
            file_size: Size of the file in bytes
            max_size: Optional maximum allowed size in bytes. If None, uses default limit.

        Returns:
            bool indicating if the file size is allowed
        """
        if max_size is None:
            # Default 50MB limit - can be moved to settings
            max_size = 50 * 1024 * 1024

        return file_size <= max_size
