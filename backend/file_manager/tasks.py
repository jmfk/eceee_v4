"""
Celery tasks for file manager operations.
"""

import logging
import os
import tempfile
from celery import shared_task
from django.core.management import call_command

logger = logging.getLogger(__name__)


@shared_task
def cleanup_deleted_files(days=30, batch_size=100):
    """
    Celery task to clean up soft-deleted files with no references.

    Args:
        days (int): Number of days after deletion to wait before cleanup
        batch_size (int): Number of files to process in each batch
    """
    try:
        # Call the management command
        call_command(
            "cleanup_deleted_files", days=days, batch_size=batch_size, dry_run=False
        )
        return True
    except Exception as e:
        logger.error(f"Failed to clean up deleted files: {str(e)}")
        return False


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_document_text(self, file_id, is_pending=True):
    """
    Extract text from document files in background.

    Args:
        file_id: UUID of MediaFile or PendingMediaFile
        is_pending: Whether this is a PendingMediaFile (True) or MediaFile (False)

    Returns:
        True if successful, False otherwise
    """
    from .models import MediaFile, PendingMediaFile
    from .storage import S3MediaStorage
    from .services.document_processor import document_processor

    try:
        # Get the file record
        if is_pending:
            file_obj = PendingMediaFile.objects.get(id=file_id)
        else:
            file_obj = MediaFile.objects.get(id=file_id)

        # Only process document types
        if file_obj.file_type != "document":
            logger.info(f"Skipping text extraction for non-document file: {file_id}")
            return True

        logger.info(f"Starting text extraction for document: {file_id}")

        # Update metadata to indicate processing started
        metadata = file_obj.metadata or {}
        metadata["text_processing_status"] = "processing"
        file_obj.metadata = metadata
        file_obj.save(update_fields=["metadata"])

        # Download file from S3 to temporary location
        storage = S3MediaStorage()
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=os.path.splitext(file_obj.original_filename)[1]
        ) as temp_file:
            temp_path = temp_file.name
            try:
                # Download from S3
                file_content = storage._read(file_obj.file_path)
                temp_file.write(file_content)
                temp_file.flush()

                # Extract text based on content type
                extracted_text = document_processor.extract_text(
                    temp_path, file_obj.content_type
                )

                # Update the file record with extracted text
                file_obj.ai_extracted_text = extracted_text
                metadata["text_processing_status"] = "completed"
                metadata["extracted_text_length"] = len(extracted_text)
                file_obj.metadata = metadata
                file_obj.save(update_fields=["ai_extracted_text", "metadata"])

                logger.info(
                    f"Successfully extracted {len(extracted_text)} characters from {file_id}"
                )
                return True

            finally:
                # Clean up temp file
                if os.path.exists(temp_path):
                    os.unlink(temp_path)

    except (MediaFile.DoesNotExist, PendingMediaFile.DoesNotExist):
        logger.error(f"File not found: {file_id}")
        return False

    except Exception as e:
        logger.error(f"Failed to extract text from document {file_id}: {e}")

        # Update metadata to indicate failure
        try:
            if is_pending:
                file_obj = PendingMediaFile.objects.get(id=file_id)
            else:
                file_obj = MediaFile.objects.get(id=file_id)

            metadata = file_obj.metadata or {}
            metadata["text_processing_status"] = "failed"
            metadata["text_processing_error"] = str(e)
            file_obj.metadata = metadata
            file_obj.save(update_fields=["metadata"])
        except Exception:
            pass

        # Retry the task
        raise self.retry(exc=e)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def generate_document_thumbnail(self, file_id, is_pending=True):
    """
    Generate thumbnail for document first page.

    Args:
        file_id: UUID of MediaFile or PendingMediaFile
        is_pending: Whether this is a PendingMediaFile (True) or MediaFile (False)

    Returns:
        True if successful, False otherwise
    """
    from .models import MediaFile, PendingMediaFile
    from .storage import S3MediaStorage
    from .services.document_processor import document_processor
    from django.core.files.uploadedfile import SimpleUploadedFile

    try:
        # Get the file record
        if is_pending:
            file_obj = PendingMediaFile.objects.get(id=file_id)
        else:
            file_obj = MediaFile.objects.get(id=file_id)

        # Only process document types
        if file_obj.file_type != "document":
            logger.info(f"Skipping thumbnail generation for non-document file: {file_id}")
            return True

        logger.info(f"Starting thumbnail generation for document: {file_id}")

        # Update metadata to indicate processing started
        metadata = file_obj.metadata or {}
        metadata["thumbnail_processing_status"] = "processing"
        file_obj.metadata = metadata
        file_obj.save(update_fields=["metadata"])

        # Download file from S3 to temporary location
        storage = S3MediaStorage()
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=os.path.splitext(file_obj.original_filename)[1]
        ) as temp_file:
            temp_path = temp_file.name
            try:
                # Download from S3
                file_content = storage._read(file_obj.file_path)
                temp_file.write(file_content)
                temp_file.flush()

                # Generate thumbnail based on content type
                thumbnail_bytes = document_processor.generate_document_thumbnail(
                    temp_path, file_obj.content_type
                )

                if thumbnail_bytes:
                    # Upload thumbnail to S3
                    thumbnail_path = storage.upload_thumbnail(
                        thumbnail_bytes, file_obj.file_path
                    )

                    # Update metadata with thumbnail path
                    metadata["thumbnail_path"] = thumbnail_path
                    metadata["thumbnail_processing_status"] = "completed"
                    file_obj.metadata = metadata
                    file_obj.save(update_fields=["metadata"])

                    logger.info(f"Successfully generated thumbnail for {file_id}")
                    return True
                else:
                    # No thumbnail generated (e.g., DOCX, MD)
                    metadata["thumbnail_processing_status"] = "not_applicable"
                    file_obj.metadata = metadata
                    file_obj.save(update_fields=["metadata"])

                    logger.info(f"No thumbnail generated for {file_id} (content type: {file_obj.content_type})")
                    return True

            finally:
                # Clean up temp file
                if os.path.exists(temp_path):
                    os.unlink(temp_path)

    except (MediaFile.DoesNotExist, PendingMediaFile.DoesNotExist):
        logger.error(f"File not found: {file_id}")
        return False

    except Exception as e:
        logger.error(f"Failed to generate thumbnail for document {file_id}: {e}")

        # Update metadata to indicate failure
        try:
            if is_pending:
                file_obj = PendingMediaFile.objects.get(id=file_id)
            else:
                file_obj = MediaFile.objects.get(id=file_id)

            metadata = file_obj.metadata or {}
            metadata["thumbnail_processing_status"] = "failed"
            metadata["thumbnail_processing_error"] = str(e)
            file_obj.metadata = metadata
            file_obj.save(update_fields=["metadata"])
        except Exception:
            pass

        # Retry the task
        raise self.retry(exc=e)
