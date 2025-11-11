"""
Service for handling ZIP file extraction and upload.
"""

import os
import zipfile
import tempfile
import shutil
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from django.conf import settings
from django.core.files.uploadedfile import InMemoryUploadedFile
import logging

from ..models import MediaFile, MediaCollection, MediaTag, PendingMediaFile
from ..services.upload_service import FileUploadService, UploadResult
from ..services.validation_service import FileValidationService
from content.models import Namespace

logger = logging.getLogger(__name__)


@dataclass
class ZipExtractionResult:
    """Result of ZIP extraction operation."""
    success: bool
    files: List[MediaFile]
    errors: List[Dict[str, Any]]
    warnings: List[str]
    collection: Optional[MediaCollection] = None
    file_count: int = 0
    skipped_count: int = 0


class ZipExtractionService:
    """Service for extracting and processing ZIP files."""
    
    # Default max ZIP size: 100MB (can be overridden)
    DEFAULT_MAX_ZIP_SIZE = 100 * 1024 * 1024
    
    # Maximum uncompressed size to prevent zip bombs
    MAX_UNCOMPRESSED_SIZE = 500 * 1024 * 1024  # 500MB
    
    # Maximum number of files in a ZIP
    MAX_FILES_IN_ZIP = 100
    
    def __init__(self):
        self.upload_service = FileUploadService()
        self.validation_service = FileValidationService()
    
    def validate_zip(self, zip_file, max_size: Optional[int] = None) -> Dict[str, Any]:
        """
        Validate ZIP file before extraction.
        
        Args:
            zip_file: The uploaded ZIP file
            max_size: Maximum allowed ZIP file size in bytes
            
        Returns:
            Dict with validation result
        """
        errors = []
        warnings = []
        
        # Check file size
        max_allowed = max_size or self.DEFAULT_MAX_ZIP_SIZE
        if zip_file.size > max_allowed:
            max_mb = max_allowed / (1024 * 1024)
            actual_mb = zip_file.size / (1024 * 1024)
            errors.append(
                f"ZIP file too large: {actual_mb:.1f}MB exceeds limit of {max_mb:.0f}MB"
            )
            return {"is_valid": False, "errors": errors, "warnings": warnings}
        
        # Try to open as ZIP
        try:
            # Save to temp file for validation
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
            try:
                for chunk in zip_file.chunks():
                    temp_file.write(chunk)
                temp_file.close()
                
                # Validate ZIP structure
                with zipfile.ZipFile(temp_file.name, 'r') as zf:
                    # Check if it's a valid ZIP
                    bad_file = zf.testzip()
                    if bad_file:
                        errors.append(f"Corrupted file in ZIP: {bad_file}")
                        return {"is_valid": False, "errors": errors, "warnings": warnings}
                    
                    # Get file list
                    file_list = zf.namelist()
                    
                    # Check number of files
                    actual_files = [f for f in file_list if not f.endswith('/')]
                    if len(actual_files) > self.MAX_FILES_IN_ZIP:
                        errors.append(
                            f"Too many files in ZIP: {len(actual_files)} exceeds limit of {self.MAX_FILES_IN_ZIP}"
                        )
                        return {"is_valid": False, "errors": errors, "warnings": warnings}
                    
                    # Check for empty ZIP
                    if len(actual_files) == 0:
                        errors.append("ZIP file contains no files")
                        return {"is_valid": False, "errors": errors, "warnings": warnings}
                    
                    # Check uncompressed size (zip bomb protection)
                    total_uncompressed = sum(zf.getinfo(f).file_size for f in actual_files)
                    if total_uncompressed > self.MAX_UNCOMPRESSED_SIZE:
                        max_mb = self.MAX_UNCOMPRESSED_SIZE / (1024 * 1024)
                        actual_mb = total_uncompressed / (1024 * 1024)
                        errors.append(
                            f"Uncompressed size too large: {actual_mb:.1f}MB exceeds limit of {max_mb:.0f}MB"
                        )
                        return {"is_valid": False, "errors": errors, "warnings": warnings}
                    
                    # Check for path traversal attempts
                    for filename in file_list:
                        if '..' in filename or filename.startswith('/'):
                            errors.append(f"Invalid file path in ZIP: {filename}")
                            return {"is_valid": False, "errors": errors, "warnings": warnings}
                    
                    # Warn about hidden files
                    hidden_files = [f for f in actual_files if os.path.basename(f).startswith('.')]
                    if hidden_files:
                        warnings.append(
                            f"ZIP contains {len(hidden_files)} hidden file(s) that will be skipped"
                        )
                
            finally:
                # Clean up temp file
                os.unlink(temp_file.name)
                
        except zipfile.BadZipFile:
            errors.append("File is not a valid ZIP archive")
            return {"is_valid": False, "errors": errors, "warnings": warnings}
        except Exception as e:
            logger.error(f"Error validating ZIP: {e}")
            errors.append(f"Failed to validate ZIP: {str(e)}")
            return {"is_valid": False, "errors": errors, "warnings": warnings}
        
        return {
            "is_valid": True,
            "errors": errors,
            "warnings": warnings,
            "file_count": len(actual_files)
        }
    
    def extract_zip(
        self,
        zip_file,
        namespace: Namespace,
        user,
        collection: Optional[MediaCollection] = None,
        collection_slug: Optional[str] = None,
        tags: Optional[List[str]] = None,
        max_size: Optional[int] = None
    ) -> ZipExtractionResult:
        """
        Extract ZIP file and upload contents to media library.
        
        Args:
            zip_file: The uploaded ZIP file
            namespace: Target namespace
            user: User performing the upload
            collection: Existing collection to add files to (optional)
            collection_slug: Slug for new collection if creating one
            tags: List of tag IDs to apply to files
            max_size: Maximum ZIP size override
            
        Returns:
            ZipExtractionResult with extracted files and any errors
        """
        # Validate ZIP first
        validation = self.validate_zip(zip_file, max_size)
        if not validation["is_valid"]:
            return ZipExtractionResult(
                success=False,
                files=[],
                errors=[{"error": err} for err in validation["errors"]],
                warnings=validation["warnings"],
                file_count=0,
                skipped_count=0
            )
        
        warnings = validation.get("warnings", [])
        extracted_files = []
        errors = []
        skipped_count = 0
        temp_dir = None
        
        try:
            # Create temporary directory for extraction
            temp_dir = tempfile.mkdtemp(prefix='zip_extract_')
            
            # Save ZIP to temp file
            temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
            try:
                for chunk in zip_file.chunks():
                    temp_zip.write(chunk)
                temp_zip.close()
                
                # Extract ZIP
                with zipfile.ZipFile(temp_zip.name, 'r') as zf:
                    zf.extractall(temp_dir)
                    
                    # Get list of extracted files
                    file_list = []
                    for root, dirs, files in os.walk(temp_dir):
                        for filename in files:
                            # Skip hidden files and system files
                            if filename.startswith('.') or filename.startswith('__'):
                                skipped_count += 1
                                continue
                            
                            file_path = os.path.join(root, filename)
                            file_list.append((filename, file_path))
                    
                    # Create or get collection
                    created_collection = None
                    if collection is None and collection_slug:
                        # Create new collection from ZIP filename
                        created_collection = self._create_collection_from_zip(
                            zip_file.name,
                            collection_slug,
                            namespace,
                            user,
                            tags
                        )
                        collection = created_collection
                    
                    # Get tags for files
                    file_tags = []
                    if collection:
                        # Use collection's tags
                        file_tags = list(collection.tags.values_list('id', flat=True))
                    elif tags:
                        # Use provided tags
                        file_tags = tags
                    
                    # Process each extracted file
                    pending_files_to_approve = []
                    
                    for original_filename, file_path in file_list:
                        try:
                            # Open extracted file
                            with open(file_path, 'rb') as f:
                                file_content = f.read()
                            
                            # Create an in-memory uploaded file
                            from django.core.files.uploadedfile import SimpleUploadedFile
                            uploaded_file = SimpleUploadedFile(
                                original_filename,
                                file_content,
                                content_type=self._guess_content_type(original_filename)
                            )
                            
                            # Validate file
                            validation_result = self.validation_service.validate(
                                uploaded_file,
                                user,
                                force_upload=False
                            )
                            
                            if not validation_result.is_valid:
                                errors.extend(validation_result.errors)
                                continue
                            
                            # Upload to pending
                            upload_result = self.upload_service.upload(
                                uploaded_file,
                                "",  # No folder path
                                namespace,
                                user,
                                skip_ai_analysis=False
                            )
                            
                            if upload_result.errors:
                                errors.extend(upload_result.errors)
                                continue
                            
                            # Store pending files for approval
                            pending_files_to_approve.extend(upload_result.files)
                            
                        except Exception as e:
                            logger.error(f"Error processing extracted file {original_filename}: {e}")
                            errors.append({
                                "filename": original_filename,
                                "error": str(e),
                                "status": "error"
                            })
                    
                    # Auto-approve all pending files
                    for pending_file in pending_files_to_approve:
                        try:
                            media_file = pending_file.approve_and_create_media_file(
                                title=pending_file.ai_suggested_title or pending_file.original_filename,
                                slug=None,  # Auto-generate
                                description=pending_file.ai_suggested_description or "",
                                tags=file_tags,
                                access_level="public"
                            )
                            
                            # Add to collection if provided
                            if collection:
                                collection.mediafile_set.add(media_file)
                            
                            extracted_files.append(media_file)
                            
                        except Exception as e:
                            logger.error(f"Error approving file {pending_file.original_filename}: {e}")
                            errors.append({
                                "filename": pending_file.original_filename,
                                "error": f"Failed to approve: {str(e)}",
                                "status": "error"
                            })
                
            finally:
                # Clean up temp ZIP file
                os.unlink(temp_zip.name)
            
        except Exception as e:
            logger.error(f"Error extracting ZIP: {e}")
            errors.append({
                "error": f"Failed to extract ZIP: {str(e)}",
                "status": "error"
            })
        finally:
            # Clean up temp directory
            if temp_dir and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)
        
        return ZipExtractionResult(
            success=len(extracted_files) > 0,
            files=extracted_files,
            errors=errors,
            warnings=warnings,
            collection=created_collection or collection,
            file_count=len(extracted_files),
            skipped_count=skipped_count
        )
    
    def _create_collection_from_zip(
        self,
        zip_filename: str,
        collection_slug: str,
        namespace: Namespace,
        user,
        tags: Optional[List[str]] = None
    ) -> MediaCollection:
        """Create a new collection from ZIP filename."""
        # Get title from filename (remove .zip extension)
        title = os.path.splitext(zip_filename)[0]
        
        # Clean up title
        title = title.replace('_', ' ').replace('-', ' ').strip()
        if not title:
            title = "Imported Collection"
        
        # Create collection
        collection = MediaCollection.objects.create(
            title=title,
            slug=collection_slug,
            namespace=namespace,
            created_by=user,
            last_modified_by=user,
            description=f"Imported from {zip_filename}"
        )
        
        # Add tags if provided
        if tags:
            tag_objects = MediaTag.objects.filter(id__in=tags, namespace=namespace)
            collection.tags.set(tag_objects)
        
        return collection
    
    def _guess_content_type(self, filename: str) -> str:
        """Guess content type from filename."""
        import mimetypes
        content_type, _ = mimetypes.guess_type(filename)
        return content_type or 'application/octet-stream'

