"""
Services package for file manager application.
"""

from .upload_service import FileUploadService, UploadResult
from .duplicate_handler import DuplicateFileHandler, DuplicateCheckResult
from .validation_service import FileValidationService, ValidationResult
from .response_builder import UploadResponseBuilder, UploadResponseData
from .namespace_service import NamespaceAccessService, NamespaceResult

__all__ = [
    "FileUploadService",
    "UploadResult",
    "DuplicateFileHandler",
    "DuplicateCheckResult",
    "FileValidationService",
    "ValidationResult",
    "UploadResponseBuilder",
    "UploadResponseData",
    "NamespaceAccessService",
    "NamespaceResult",
]
