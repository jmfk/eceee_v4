"""
Service for handling duplicate file detection and resolution.
"""

import hashlib
import logging
from dataclasses import dataclass
from typing import List, Optional
from django.utils import timezone
from datetime import timedelta

from ..models import MediaFile, PendingMediaFile
from ..security import SecurityAuditLogger

logger = logging.getLogger(__name__)


@dataclass
class DuplicateCheckResult:
    """Data class to hold the result of a duplicate check operation."""

    has_duplicates: bool
    errors: List[dict]
    pending_files: List[dict]
    existing_file: Optional[MediaFile] = None
    existing_pending: Optional[PendingMediaFile] = None


class DuplicateFileHandler:
    """Service class to handle duplicate file detection and resolution."""

    def check_duplicates(self, file, namespace, user) -> DuplicateCheckResult:
        """
        Check for duplicate files and handle accordingly.

        Args:
            file: The uploaded file object
            namespace: The namespace object for the upload
            user: The user performing the upload

        Returns:
            DuplicateCheckResult containing information about any duplicates found
        """
        try:
            # Calculate file hash
            file.seek(0)
            file_content = file.read()
            file.seek(0)
            file_hash = hashlib.sha256(file_content).hexdigest()

            # Check for existing files with same hash in MediaFile (including deleted)
            existing_media_file = (
                MediaFile.objects.with_deleted().filter(file_hash=file_hash).first()
            )

            if existing_media_file:
                return self._handle_existing_media_file(
                    existing_media_file, file, namespace, user
                )

            # Check for existing files with same hash in PendingMediaFile
            existing_pending_file = PendingMediaFile.objects.filter(
                file_hash=file_hash,
                status__in=["pending", "approved"],
            ).first()

            if existing_pending_file:
                return self._handle_existing_pending_file(
                    existing_pending_file, file, namespace, user
                )

            # No duplicates found
            return DuplicateCheckResult(
                has_duplicates=False,
                errors=[],
                pending_files=[],
            )

        except Exception as e:
            logger.error(f"Error checking duplicates for {file.name}: {e}")
            return DuplicateCheckResult(
                has_duplicates=True,
                errors=[
                    {
                        "filename": file.name,
                        "error": "An error occurred while checking for duplicates. Please try again.",
                        "technical_details": str(e),
                        "status": "error",
                    }
                ],
                pending_files=[],
            )

    def _handle_existing_media_file(
        self, existing_file: MediaFile, uploaded_file, namespace, user
    ) -> DuplicateCheckResult:
        """Handle case where file exists in MediaFile table."""
        if existing_file.is_deleted:
            # Restore deleted file
            existing_file.restore(user)
            # Create pending file for re-approval
            pending_file = self._create_or_update_pending_file(
                None, uploaded_file, existing_file, namespace, user  # Create new
            )

            return DuplicateCheckResult(
                has_duplicates=True,
                errors=[],
                pending_files=[
                    {
                        "id": pending_file.id,
                        "original_filename": pending_file.original_filename,
                        "file_type": pending_file.file_type,
                        "file_size": pending_file.file_size,
                        "width": pending_file.width,
                        "height": pending_file.height,
                        "status": "pending_approval",
                    }
                ],
                existing_file=existing_file,
            )
        else:
            # File exists and is not deleted - update/create pending file for tag merging
            try:
                # Try to get existing pending file first
                pending_file = PendingMediaFile.objects.filter(
                    file_hash=existing_file.file_hash,
                    status__in=["pending", "approved"],
                ).first()
            except PendingMediaFile.DoesNotExist:
                pending_file = None

            # Create new or update existing pending file
            pending_file = self._create_or_update_pending_file(
                pending_file,
                uploaded_file,
                existing_file,
                namespace,
                user,
            )

            SecurityAuditLogger.log_file_upload(
                user,
                {
                    "filename": uploaded_file.name,
                    "size": uploaded_file.size,
                    "hash": existing_file.file_hash,
                    "rejection_reason": "duplicate_file_merge_tags",
                },
                success=False,
            )

            return DuplicateCheckResult(
                has_duplicates=True,
                errors=[
                    {
                        "filename": uploaded_file.name,
                        "error": (
                            f"This file already exists in the system as '{existing_file.title}'. "
                            "Any new tags you've added will be merged with the existing file. "
                            "You can find the file in the media browser."
                        ),
                        "status": "rejected",
                        "reason": "duplicate",
                        "existing_file": {
                            "id": str(existing_file.id),
                            "title": existing_file.title,
                            "slug": existing_file.slug,
                            "created_at": existing_file.created_at.isoformat(),
                        },
                        "pending_file": {
                            "id": str(pending_file.id),
                            "original_filename": pending_file.original_filename,
                        },
                    }
                ],
                pending_files=[],
                existing_file=existing_file,
            )

    def _handle_existing_pending_file(
        self, existing_pending: PendingMediaFile, uploaded_file, namespace, user
    ) -> DuplicateCheckResult:
        """Handle case where file exists in PendingMediaFile table."""
        # Update the existing pending file instead of creating a new one
        updated_pending = self._create_or_update_pending_file(
            existing_pending,
            uploaded_file,
            None,  # No existing MediaFile
            namespace,
            user,
        )

        return DuplicateCheckResult(
            has_duplicates=True,
            errors=[
                {
                    "filename": uploaded_file.name,
                    "error": (
                        f"This file is already awaiting approval (uploaded {existing_pending.created_at.strftime('%Y-%m-%d %H:%M')}). "
                        "Any new tags you've added will be merged with the pending file. "
                        "You can check its status in the pending media section."
                    ),
                    "status": "rejected",
                    "reason": "duplicate_pending",
                    "existing_file": {
                        "id": str(updated_pending.id),
                        "original_filename": updated_pending.original_filename,
                        "status": updated_pending.status,
                        "created_at": updated_pending.created_at.isoformat(),
                    },
                }
            ],
            pending_files=[],
            existing_pending=updated_pending,
        )

    def _create_or_update_pending_file(
        self,
        existing_pending: Optional[PendingMediaFile],
        uploaded_file,
        existing_media: Optional[MediaFile],
        namespace,
        user,
    ) -> PendingMediaFile:
        """Create a new pending file or update an existing one."""
        pending_data = {
            "original_filename": uploaded_file.name,
            "namespace": namespace,
            "uploaded_by": user,
            "expires_at": timezone.now() + timedelta(hours=24),
        }

        if existing_media:
            # Use data from existing MediaFile
            pending_data.update(
                {
                    "file_path": existing_media.file_path,
                    "file_size": existing_media.file_size,
                    "content_type": existing_media.content_type,
                    "file_hash": existing_media.file_hash,
                    "file_type": existing_media.file_type,
                    "width": existing_media.width,
                    "height": existing_media.height,
                }
            )

        if existing_pending:
            # Update existing pending file
            for key, value in pending_data.items():
                setattr(existing_pending, key, value)
            existing_pending.save()
            return existing_pending
        else:
            # Create new pending file
            return PendingMediaFile.objects.create(**pending_data)
