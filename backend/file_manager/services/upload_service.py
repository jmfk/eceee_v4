"""
Service class for handling file uploads with comprehensive error handling and cleanup.
"""

import logging
from dataclasses import dataclass
from typing import List, Optional
from django.utils import timezone
from datetime import timedelta
from django.db import IntegrityError

from ..models import PendingMediaFile
from ..storage import storage
from ..ai_services import ai_service

logger = logging.getLogger(__name__)


@dataclass
class UploadResult:
    """Data class to hold the result of a file upload operation."""

    files: List[dict]
    errors: List[dict]
    file_path: Optional[str] = None
    file_hash: Optional[str] = None
    existing_file: bool = False


class FileUploadService:
    """Service class to handle the core file upload logic."""

    def upload(self, file, folder_path: str, namespace, user) -> UploadResult:
        """
        Handle the upload of a single file, including storage and pending file creation.

        Args:
            file: The uploaded file object
            folder_path: The target folder path for the file
            namespace: The namespace object for the upload
            user: The user performing the upload

        Returns:
            UploadResult object containing the upload results and any errors
        """
        try:
            # Upload to storage
            upload_result = storage.upload_file(file, folder_path)

            # Determine file type
            file_type = self._determine_file_type(upload_result["content_type"])

            # Get AI analysis
            ai_analysis = self._get_ai_analysis(file, upload_result)

            # Create pending file
            pending_file = self._create_pending_file(
                file=file,
                upload_result=upload_result,
                file_type=file_type,
                ai_analysis=ai_analysis,
                namespace=namespace,
                folder_path=folder_path,
                user=user,
            )

            return UploadResult(
                files=[
                    {
                        "id": pending_file.id,
                        "original_filename": pending_file.original_filename,
                        "file_type": pending_file.file_type,
                        "file_size": pending_file.file_size,
                        "width": pending_file.width,
                        "height": pending_file.height,
                        "ai_suggestions": {
                            "tags": ai_analysis.get("suggested_tags", []),
                            "title": ai_analysis.get("suggested_title", ""),
                            "confidence_score": ai_analysis.get(
                                "confidence_score", 0.0
                            ),
                            "extracted_text": ai_analysis.get("extracted_text", ""),
                        },
                        "status": "pending_approval",
                    }
                ],
                errors=[],
                file_path=upload_result["file_path"],
                file_hash=upload_result["file_hash"],
                existing_file=upload_result.get("existing_file", False),
            )

        except Exception as e:
            logger.error(f"Upload failed for {file.name}: {e}")
            return UploadResult(
                files=[],
                errors=[{"filename": file.name, "error": str(e), "status": "error"}],
            )

    def _determine_file_type(self, content_type: str) -> str:
        """Determine the file type based on content type."""
        if content_type.startswith("image/"):
            return "image"
        elif content_type.startswith("video/"):
            return "video"
        elif content_type.startswith("audio/"):
            return "audio"
        elif content_type in ["application/pdf", "application/msword"]:
            return "document"
        return "other"

    def _get_ai_analysis(self, file, upload_result: dict) -> dict:
        """Get AI analysis for the uploaded file."""
        try:
            analysis = ai_service.analyze_media_file(
                file.read(), file.name, upload_result["content_type"]
            )
            file.seek(0)  # Reset file pointer
            return analysis
        except Exception as e:
            logger.error(f"AI analysis failed for {file.name}: {e}")
            return {}

    def _create_pending_file(
        self,
        file,
        upload_result: dict,
        file_type: str,
        ai_analysis: dict,
        namespace,
        folder_path: str,
        user,
    ) -> PendingMediaFile:
        """Create a pending file record in the database."""
        try:
            return PendingMediaFile.objects.create(
                original_filename=file.name,
                file_path=upload_result["file_path"],
                file_size=upload_result["file_size"],
                content_type=upload_result["content_type"],
                file_hash=upload_result["file_hash"],
                file_type=file_type,
                width=upload_result.get("width"),
                height=upload_result.get("height"),
                ai_generated_tags=ai_analysis.get("suggested_tags", []),
                ai_suggested_title=ai_analysis.get("suggested_title", ""),
                ai_extracted_text=ai_analysis.get("extracted_text", ""),
                ai_confidence_score=ai_analysis.get("confidence_score", 0.0),
                namespace=namespace,
                folder_path=folder_path,
                uploaded_by=user,
                expires_at=timezone.now() + timedelta(hours=24),
            )
        except IntegrityError as e:
            # Handle duplicate file hash constraint
            if "file_hash" in str(e) and "uniq" in str(e):
                existing_pending = PendingMediaFile.objects.filter(
                    file_hash=upload_result["file_hash"]
                ).first()

                if existing_pending:
                    # Update existing pending file
                    self._update_existing_pending_file(
                        existing_pending,
                        file,
                        upload_result,
                        file_type,
                        ai_analysis,
                        namespace,
                        folder_path,
                        user,
                    )
                    return existing_pending

            raise e

    def _update_existing_pending_file(
        self,
        existing_pending: PendingMediaFile,
        file,
        upload_result: dict,
        file_type: str,
        ai_analysis: dict,
        namespace,
        folder_path: str,
        user,
    ) -> None:
        """Update an existing pending file with new data."""
        existing_pending.original_filename = file.name
        existing_pending.file_path = upload_result["file_path"]
        existing_pending.file_size = upload_result["file_size"]
        existing_pending.content_type = upload_result["content_type"]
        existing_pending.file_type = file_type
        existing_pending.width = upload_result.get("width")
        existing_pending.height = upload_result.get("height")
        existing_pending.ai_generated_tags = ai_analysis.get("suggested_tags", [])
        existing_pending.ai_suggested_title = ai_analysis.get("suggested_title", "")
        existing_pending.ai_extracted_text = ai_analysis.get("extracted_text", "")
        existing_pending.ai_confidence_score = ai_analysis.get("confidence_score", 0.0)
        existing_pending.namespace = namespace
        existing_pending.folder_path = folder_path
        existing_pending.uploaded_by = user
        existing_pending.expires_at = timezone.now() + timedelta(hours=24)
        existing_pending.status = "pending"
        existing_pending.created_at = timezone.now()
        existing_pending.save()
